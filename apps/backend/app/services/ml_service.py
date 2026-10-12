"""
ML service: image -> CNN class label + confidence.

This module is the single integration point for the leaf-disease CNN.
The rest of the backend only ever calls `get_ml_service().predict(path)`
and consumes the `CNNPrediction` it returns, so swapping the model in
never touches the routes or the retrieval wiring.

Pipeline position:
    upload  ->  [ CNN  (this file) ]  ->  retrieval service  ->  UI

Model loading priority:
    1. TFLite model at settings.model_path   (preferred; small + fast)
    2. Keras / H5 model at settings.model_path
    3. Deterministic mock (no model file present) - for development only

TO INTEGRATE THE REAL CNN, see `_run_inference()` below. It must return one
probability per entry in DISEASE_CLASSES, in that order. Everything else
(top-k, runner-up, severity, healthy flag) is derived from that vector.
"""
import hashlib
import random
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import numpy as np
from loguru import logger
from PIL import Image

from ..config import get_settings

settings = get_settings()

# ── Disease classes (PlantVillage + Indoor datasets) ─────────────────────────
# ORDER MATTERS: index i of the CNN's output vector must correspond to
# DISEASE_CLASSES[i]. Keep this list in sync with the training label order.
DISEASE_CLASSES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___healthy",
    "Aloe_Vera___Rust",
    "Aloe_Vera___healthy",
    "Money_Plant___Bacterial_Wilt",
    "Money_Plant___healthy",
    "Snake_Plant___Fungal_Leaf_Spot",
    "Snake_Plant___healthy",
    "Rose___Black_spot",
    "Rose___healthy",
    "Pepper___bell___Bacterial_spot",
    "Pepper___bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Miner",
    "Tomato___Leaf_mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___healthy",
]

SEVERITY_MAP = {
    "Late_blight": "critical",
    "Bacterial_Wilt": "critical",
    "Yellow_Leaf_Curl_Virus": "critical",
    "Early_blight": "moderate",
    "Black_rot": "high",
    "Black_spot": "high",
    "Bacterial_spot": "high",
    "Leaf_scorch": "moderate",
    "Fungal_Leaf_Spot": "moderate",
    "Rust": "moderate",
    "Leaf_mold": "moderate",
    "Septoria_leaf_spot": "moderate",
    "Spider_mites": "low",
    "Target_Spot": "moderate",
    "Leaf_Miner": "moderate",
    "Apple_scab": "high",
    "healthy": "low",
}

TOP_K = 3           # how many candidates we keep for the UI / look-alike check
INPUT_SIZE = (224, 224)

# Classes the retrieval knowledge base (apps/retrieval, 38 PlantVillage classes)
# can answer for. Only used by the mock predictor so demo scans mostly reach
# the full treatment pipeline; the real model is free to output any class.
_KB_COVERED_PREFIXES = ("Apple___", "Pepper___bell___", "Potato___", "Strawberry___", "Tomato___")
_KB_UNCOVERED = {"Tomato___Leaf_Miner"}
KB_COVERED_CLASSES = [
    c for c in DISEASE_CLASSES
    if c.startswith(_KB_COVERED_PREFIXES) and c not in _KB_UNCOVERED
]


def _get_severity(disease_name: str) -> str:
    for key, sev in SEVERITY_MAP.items():
        if key.lower() in disease_name.lower():
            return sev
    return "moderate"


# ── Output contract ───────────────────────────────────────────────────────────

@dataclass
class Candidate:
    label: str
    confidence: float


@dataclass
class CNNPrediction:
    """What the CNN step hands to the rest of the pipeline."""
    label: str                                 # top class, e.g. "Tomato___Late_blight"
    confidence: float                          # top-1 probability, 0..1
    candidates: list[Candidate] = field(default_factory=list)   # top-k, best first
    model_source: str = "mock"                 # "tflite" | "keras" | "mock"

    @property
    def runner_up(self) -> Optional[Candidate]:
        return self.candidates[1] if len(self.candidates) > 1 else None

    @property
    def is_healthy(self) -> bool:
        return "healthy" in self.label.lower()

    @property
    def severity(self) -> str:
        return _get_severity(self.label)

    def to_dict(self) -> dict:
        return {
            "disease_name": self.label,
            "confidence": self.confidence,
            "severity": self.severity,
            "is_healthy": self.is_healthy,
            "model_source": self.model_source,
            "candidates": [asdict(c) for c in self.candidates],
            "runner_up": asdict(self.runner_up) if self.runner_up else None,
        }


# ── Service ───────────────────────────────────────────────────────────────────

class MLService:
    def __init__(self):
        self.interpreter = None
        self.keras_model = None
        self.input_size = INPUT_SIZE
        self.model_source = "mock"
        self._load_model()

    # ---- model loading ------------------------------------------------------

    def _load_model(self):
        model_path = Path(settings.model_path)
        if model_path.exists():
            try:
                if model_path.suffix == ".tflite":
                    import tflite_runtime.interpreter as tflite
                    self.interpreter = tflite.Interpreter(model_path=str(model_path))
                    self.interpreter.allocate_tensors()
                    self.model_source = "tflite"
                    logger.info(f"TFLite model loaded: {model_path}")
                    return
            except ImportError:
                pass
            try:
                import tensorflow as tf
                if model_path.suffix == ".tflite":
                    self.interpreter = tf.lite.Interpreter(model_path=str(model_path))
                    self.interpreter.allocate_tensors()
                    self.model_source = "tflite"
                    logger.info(f"TFLite (tf) model loaded: {model_path}")
                    return
                elif model_path.suffix in (".h5", ".keras"):
                    self.keras_model = tf.keras.models.load_model(str(model_path))
                    self.model_source = "keras"
                    logger.info(f"Keras model loaded: {model_path}")
                    return
            except Exception as e:
                logger.warning(f"Could not load model: {e}")
        logger.info(
            f"No CNN model at {model_path} — using deterministic mock predictor. "
            "Drop a .tflite/.keras file there (or set MODEL_PATH) to enable real inference."
        )

    # ---- preprocessing ------------------------------------------------------

    def _preprocess(self, image_path: str) -> np.ndarray:
        """Resize to the model's input size and scale to [0, 1], batch of 1.

        Adjust here if your model expects different normalisation
        (e.g. ImageNet mean/std, or [-1, 1] for MobileNet-style models).
        """
        img = Image.open(image_path).convert("RGB").resize(self.input_size)
        arr = np.array(img, dtype=np.float32) / 255.0
        return np.expand_dims(arr, axis=0)

    # ---- inference ----------------------------------------------------------

    def _run_inference(self, image_path: str) -> list[float]:
        """
        ╔══════════════════════════════════════════════════════════════════╗
        ║  CNN INTEGRATION POINT                                            ║
        ║                                                                   ║
        ║  Return a list of probabilities, one per DISEASE_CLASSES entry,   ║
        ║  in the same order, summing to ~1.0.                              ║
        ║                                                                   ║
        ║  The TFLite / Keras branches below already do this when a model   ║
        ║  file is present at settings.model_path. To plug in a different   ║
        ║  runtime (PyTorch, ONNX, a remote inference server, ...), replace ║
        ║  or extend this method only. Nothing else needs to change.        ║
        ╚══════════════════════════════════════════════════════════════════╝
        """
        if self.interpreter is not None:
            arr = self._preprocess(image_path)
            input_details = self.interpreter.get_input_details()
            output_details = self.interpreter.get_output_details()
            self.interpreter.set_tensor(input_details[0]["index"], arr)
            self.interpreter.invoke()
            return self.interpreter.get_tensor(output_details[0]["index"])[0].tolist()

        if self.keras_model is not None:
            arr = self._preprocess(image_path)
            return self.keras_model.predict(arr, verbose=0)[0].tolist()

        return self._mock_probabilities(image_path)

    def _mock_probabilities(self, image_path: str) -> list[float]:
        """Deterministic stand-in: the image bytes seed a fake probability vector.

        The same image always yields the same answer, so the UI is testable
        without a model. Healthy classes are favoured ~30% of the time and a
        small share of results land in the retrieval service's "unsure" band
        so that branch of the UI can be exercised too.
        """
        with open(image_path, "rb") as f:
            seed = int(hashlib.md5(f.read()).hexdigest()[:8], 16)
        rng = random.Random(seed)

        # ~85% of demo scans land on a class the treatment KB covers, so the
        # full pipeline is exercised; the rest show the "built-in guidance" path.
        pool_top = KB_COVERED_CLASSES if rng.random() < 0.85 else DISEASE_CLASSES
        top = rng.choice(pool_top)
        if rng.random() < 0.3:
            top = rng.choice([c for c in pool_top if c.endswith("___healthy")])

        roll = rng.random()
        if roll < 0.12:
            top_conf = rng.uniform(0.42, 0.58)     # "unsure" band
        else:
            top_conf = rng.uniform(0.72, 0.98)

        probs = [0.0] * len(DISEASE_CLASSES)
        probs[DISEASE_CLASSES.index(top)] = top_conf

        # Spread the remainder over a few other classes, preferring the same crop
        # so the runner-up looks plausible (e.g. Early vs Late blight).
        crop = top.split("___")[0]
        same_crop = [c for c in DISEASE_CLASSES if c.startswith(crop + "___") and c != top]
        others = [c for c in DISEASE_CLASSES if c not in same_crop and c != top]
        same_pick = rng.sample(same_crop, k=min(2, len(same_crop)))
        other_pick = rng.sample(others, k=min(3, len(others)))
        # same-crop classes get ~4x the weight so the runner-up is a plausible look-alike
        pool = [(c, 4.0 * rng.random()) for c in same_pick] + [(c, rng.random()) for c in other_pick]
        remaining = 1.0 - top_conf
        total = sum(w for _, w in pool) or 1.0
        for cls, w in pool:
            probs[DISEASE_CLASSES.index(cls)] += remaining * (w / total)
        return probs

    # ---- public API ---------------------------------------------------------

    def predict(self, image_path: str) -> CNNPrediction:
        source = self.model_source
        try:
            probs = self._run_inference(image_path)
        except Exception as e:
            logger.error(f"CNN inference failed, falling back to mock: {e}")
            probs = self._mock_probabilities(image_path)
            source = "mock"

        probs = np.asarray(probs, dtype=np.float64).ravel()
        if probs.shape[0] != len(DISEASE_CLASSES):
            logger.warning(
                f"Model returned {probs.shape[0]} classes but DISEASE_CLASSES has "
                f"{len(DISEASE_CLASSES)}; truncating/padding. Fix the class list!"
            )
            fixed = np.zeros(len(DISEASE_CLASSES))
            n = min(len(fixed), probs.shape[0])
            fixed[:n] = probs[:n]
            probs = fixed

        order = np.argsort(probs)[::-1][:TOP_K]
        candidates = [
            Candidate(label=DISEASE_CLASSES[int(i)], confidence=round(float(probs[i]), 4))
            for i in order
            if probs[i] > 0
        ]
        if not candidates:                          # degenerate output; never crash the request
            candidates = [Candidate(label=DISEASE_CLASSES[0], confidence=0.0)]

        return CNNPrediction(
            label=candidates[0].label,
            confidence=candidates[0].confidence,
            candidates=candidates,
            model_source=source,
        )


_ml_service: Optional[MLService] = None


def get_ml_service() -> MLService:
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service

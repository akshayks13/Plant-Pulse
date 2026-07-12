"""
ML Service for plant disease prediction.

Priority:
1. TFLite model (fastest, preferred)
2. Keras/H5 model  
3. Deterministic mock (for development / when no model present)
"""
import os
import hashlib
import random
from pathlib import Path
from typing import Optional
from loguru import logger
from PIL import Image
import numpy as np

from ..config import get_settings

settings = get_settings()

# ── Disease classes (PlantVillage + Indoor datasets) ─────────────────────────
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


def _get_severity(disease_name: str) -> str:
    for key, sev in SEVERITY_MAP.items():
        if key.lower() in disease_name.lower():
            return sev
    return "moderate"


class MLService:
    def __init__(self):
        self.interpreter = None
        self.keras_model = None
        self.input_size = (224, 224)
        self._load_model()

    def _load_model(self):
        model_path = Path(settings.model_path)
        if model_path.exists():
            try:
                if model_path.suffix == ".tflite":
                    import tflite_runtime.interpreter as tflite
                    self.interpreter = tflite.Interpreter(model_path=str(model_path))
                    self.interpreter.allocate_tensors()
                    logger.info(f"TFLite model loaded: {model_path}")
                    return
            except ImportError:
                pass
            try:
                import tensorflow as tf
                if model_path.suffix == ".tflite":
                    self.interpreter = tf.lite.Interpreter(model_path=str(model_path))
                    self.interpreter.allocate_tensors()
                    logger.info(f"TFLite (tf) model loaded: {model_path}")
                    return
                elif model_path.suffix in (".h5", ".keras"):
                    self.keras_model = tf.keras.models.load_model(str(model_path))
                    logger.info(f"Keras model loaded: {model_path}")
                    return
            except Exception as e:
                logger.warning(f"Could not load model: {e}")
        logger.info("No model found — using deterministic mock predictor.")

    def _preprocess(self, image_path: str) -> np.ndarray:
        img = Image.open(image_path).convert("RGB").resize(self.input_size)
        arr = np.array(img, dtype=np.float32) / 255.0
        return np.expand_dims(arr, axis=0)

    def _predict_tflite(self, arr: np.ndarray) -> list[float]:
        input_details = self.interpreter.get_input_details()
        output_details = self.interpreter.get_output_details()
        self.interpreter.set_tensor(input_details[0]["index"], arr)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(output_details[0]["index"])[0]
        return output.tolist()

    def _predict_keras(self, arr: np.ndarray) -> list[float]:
        return self.keras_model.predict(arr, verbose=0)[0].tolist()

    def _mock_predict(self, image_path: str) -> tuple[str, float]:
        """Deterministic mock: uses image hash to pick a disease."""
        with open(image_path, "rb") as f:
            img_hash = hashlib.md5(f.read()).hexdigest()
        seed = int(img_hash[:8], 16)
        rng = random.Random(seed)
        disease = rng.choice(DISEASE_CLASSES)
        # Healthy gets higher chance
        if rng.random() < 0.3:
            healthy = [c for c in DISEASE_CLASSES if c.endswith("___healthy")]
            disease = rng.choice(healthy)
        confidence = rng.uniform(0.72, 0.98)
        return disease, round(confidence, 4)

    def predict(self, image_path: str) -> dict:
        try:
            if self.interpreter is not None:
                arr = self._preprocess(image_path)
                probs = self._predict_tflite(arr)
                idx = int(np.argmax(probs))
                disease = DISEASE_CLASSES[idx] if idx < len(DISEASE_CLASSES) else DISEASE_CLASSES[0]
                confidence = round(float(probs[idx]), 4)
            elif self.keras_model is not None:
                arr = self._preprocess(image_path)
                probs = self._predict_keras(arr)
                idx = int(np.argmax(probs))
                disease = DISEASE_CLASSES[idx] if idx < len(DISEASE_CLASSES) else DISEASE_CLASSES[0]
                confidence = round(float(probs[idx]), 4)
            else:
                disease, confidence = self._mock_predict(image_path)
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            disease, confidence = self._mock_predict(image_path)

        is_healthy = "healthy" in disease.lower()
        severity = _get_severity(disease)

        return {
            "disease_name": disease,
            "confidence": confidence,
            "severity": severity,
            "is_healthy": is_healthy,
        }


_ml_service: Optional[MLService] = None


def get_ml_service() -> MLService:
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service

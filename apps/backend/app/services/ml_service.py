"""
ML Service for plant disease prediction.

Priority:
1. PyTorch DenseNet-121 checkpoint (.pt / .pth) - the trained PlantVillage model
2. TFLite model
3. Keras/H5 model
4. Deterministic mock (for development / when no model present)
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
    "Haunglongbing": "critical",
    "mosaic_virus": "critical",
    "Esca": "high",
    "Northern_Leaf_Blight": "high",
    "Powdery_mildew": "moderate",
    "Cercospora": "moderate",
    "Leaf_blight": "moderate",
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


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class MLService:
    def __init__(self):
        self.interpreter = None
        self.keras_model = None
        self.torch_model = None
        self.class_names: list[str] = DISEASE_CLASSES
        self.input_size = (224, 224)
        self._load_model()

    def _load_torch_model(self, model_path: Path) -> bool:
        """Load the DenseNet-121 checkpoint written by the training notebook."""
        try:
            import torch
            from torchvision.models import densenet121

            # weights_only: the checkpoint is plain tensors + lists, never needs arbitrary unpickling
            ckpt = torch.load(str(model_path), map_location="cpu", weights_only=True)
            class_names = list(ckpt["class_names"])
            model = densenet121(weights=None)
            model.classifier = torch.nn.Linear(model.classifier.in_features, len(class_names))
            model.load_state_dict(ckpt["model_state_dict"])
            model.eval()
        except Exception as e:
            logger.warning(f"Could not load PyTorch model {model_path}: {e}")
            return False

        size = int(ckpt.get("image_size", 192))
        self.torch_model = model
        self.class_names = class_names
        self.input_size = (size, size)
        logger.info(f"PyTorch {ckpt.get('model_name', 'densenet121')} loaded: {model_path} "
                    f"({len(class_names)} classes, {size}px, val_acc={ckpt.get('val_acc')})")
        return True

    def _load_model(self):
        model_path = Path(settings.model_path)
        if model_path.exists():
            if model_path.suffix in (".pt", ".pth"):
                if self._load_torch_model(model_path):
                    return
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

    def _predict_torch(self, image_path: str) -> list[float]:
        import torch

        img = Image.open(image_path).convert("RGB").resize(self.input_size)
        arr = (np.asarray(img, dtype=np.float32) / 255.0 - IMAGENET_MEAN) / IMAGENET_STD
        x = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)  # HWC -> NCHW
        with torch.no_grad():
            return torch.softmax(self.torch_model(x), dim=1)[0].tolist()

    def predict(self, image_path: str) -> dict:
        runner_up = None
        try:
            if self.torch_model is not None:
                probs = self._predict_torch(image_path)
            elif self.interpreter is not None:
                probs = self._predict_tflite(self._preprocess(image_path))
            elif self.keras_model is not None:
                probs = self._predict_keras(self._preprocess(image_path))
            else:
                probs = None

            if probs is not None:
                order = np.argsort(probs)[::-1]
                idx = int(order[0])
                disease = self.class_names[idx] if idx < len(self.class_names) else self.class_names[0]
                confidence = round(float(probs[idx]), 4)
                if len(order) > 1 and int(order[1]) < len(self.class_names):
                    second = int(order[1])
                    runner_up = {
                        "class_label": self.class_names[second],
                        "confidence": round(float(probs[second]), 4),
                    }
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
            "runner_up": runner_up,
        }


_ml_service: Optional[MLService] = None


def get_ml_service() -> MLService:
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service

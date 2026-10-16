"""
ml_service.py - runs our trained plant disease CNN models.

We trained 3 PyTorch models. Their checkpoints live in apps/model_file/:

    efficientnet  ->  efficientnet_b0_model.pth
    mobilenet     ->  mobilenetv3_large_model.pth
    densenet      ->  densenet121_model.pth

Each .pth file is a dictionary saved during training:

    {
        "model_state_dict": the trained weights,
        "class_names":      the 20 class names, in the order the model outputs them,
        "val_acc":          validation accuracy (%),
        "model_meta":       size / parameter info,
        "epoch":            the epoch the best weights came from,
    }

How one prediction works:
    1. Build the same network architecture with timm (empty weights).
    2. Load the trained weights from the .pth file into it.
    3. Resize + normalize the photo exactly like during training.
    4. Run the network, turn the scores into probabilities with softmax,
       and keep the top 3 classes.

Models are loaded once (at server start-up) and then kept in memory.
"""
import gc
import threading
from pathlib import Path

import timm
import torch
from loguru import logger
from PIL import Image, ImageOps
from torch import nn
from torchvision import transforms

from ..config import get_settings

settings = get_settings()


# ── The models the user can pick on the scan page ────────────────────────────
# "arch" is the timm model name whose layers match the checkpoint exactly.
MODELS = {
    "efficientnet": {
        "file": "efficientnet_b0_model.pth",
        "arch": "efficientnet_b0",
        "label": "EfficientNet-B0",
    },
    "mobilenet": {
        "file": "mobilenetv3_large_model.pth",
        "arch": "mobilenetv3_large_100",
        "label": "MobileNetV3-Large",
    },
    "densenet": {
        "file": "densenet121_model.pth",
        "arch": "densenet121",
        "label": "DenseNet-121",
    },
}
DEFAULT_MODEL = "efficientnet"
TOP_K = 3   # how many guesses we keep (the 2nd one is used for the look-alike check)


# ── Image preprocessing (must match training) ────────────────────────────────
# 224x224 RGB, scaled to [0, 1], then normalized with the ImageNet mean/std
# that the pretrained timm backbones were trained with.
IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

preprocess = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])


# ── How bad is each disease? (used for the severity badge) ───────────────────
# Checked in order, first match wins.
SEVERITY = {
    "Healthy": "low",
    "Ringspot": "critical",            # viral, no cure
    "Yellow_Vein_Mosaic": "critical",  # viral, no cure
    "Bacterial_Spot": "high",
    "Anthracnose": "high",
    "Leaf_Blight": "high",
    "Black_Spot": "moderate",
    "Powdery_Mildew": "moderate",
    "Rust": "moderate",                # also matches "Red_Rust"
    "Leaf_Spot": "moderate",
    "Algal_Spot": "low",
}


def get_severity(label):
    for keyword, severity in SEVERITY.items():
        if keyword.lower() in label.lower():
            return severity
    return "moderate"


def is_healthy(label):
    return "healthy" in label.lower()


# ── Device: use the GPU if there is one ──────────────────────────────────────
def pick_device():
    if torch.cuda.is_available():            # NVIDIA GPU
        return torch.device("cuda")
    if torch.backends.mps.is_available():    # Apple Silicon GPU
        return torch.device("mps")
    return torch.device("cpu")


DEVICE = pick_device()


class ModelNotAvailable(Exception):
    """Raised when the chosen model name is unknown or its .pth file is missing."""


# Loaded models are cached here: {"efficientnet": {"network": ..., "class_names": [...], ...}}
_loaded_models = {}
# One lock so two requests never load or run a model at the same moment.
_lock = threading.Lock()


def build_network(arch, num_classes):
    """Create the empty network with the right number of output classes."""
    network = timm.create_model(arch, pretrained=False, num_classes=num_classes)

    # The DenseNet checkpoint was trained with a Dropout + Linear head
    # (its weights are saved as "classifier.1.weight"), so we rebuild that head.
    if arch == "densenet121":
        in_features = network.classifier.in_features
        network.classifier = nn.Sequential(nn.Dropout(0.2), nn.Linear(in_features, num_classes))

    return network


def _load_model(name):
    """Load one model from disk (call only while holding _lock)."""
    if name in _loaded_models:
        return _loaded_models[name]

    if name not in MODELS:
        raise ModelNotAvailable(f"Unknown model '{name}'. Choose one of: {', '.join(MODELS)}")

    info = MODELS[name]
    path = Path(settings.model_dir) / info["file"]
    if not path.exists():
        raise ModelNotAvailable(f"Model file not found: {path}")

    # weights_only=True is the safe way to load: it only reads tensors and
    # plain data, never runs pickled code.
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    class_names = checkpoint["class_names"]

    network = build_network(info["arch"], len(class_names))
    network.load_state_dict(checkpoint["model_state_dict"])   # strict: every weight must match
    network.to(DEVICE)
    network.eval()   # turns off dropout and uses the saved batch-norm statistics

    _loaded_models[name] = {
        "network": network,
        "class_names": class_names,
        "val_acc": checkpoint.get("val_acc"),
        "meta": checkpoint.get("model_meta", {}),
    }
    del checkpoint

    # Small hosts: keep only the most recently loaded models in memory.
    limit = settings.max_loaded_models
    while limit > 0 and len(_loaded_models) > limit:
        evicted = next(iter(_loaded_models))
        del _loaded_models[evicted]
        gc.collect()
        logger.info(f"Unloaded {MODELS[evicted]['label']} to stay within MAX_LOADED_MODELS={limit}")
    logger.info(f"Loaded {info['label']} from {path.name} on {DEVICE} ({len(class_names)} classes)")
    return _loaded_models[name]


def load_all_models():
    """Load models at start-up so the first scan is fast (all, or the PRELOAD_MODELS list). Missing files are only logged."""
    wanted = [n.strip() for n in settings.preload_models.split(",") if n.strip()] or list(MODELS)
    for name in wanted:
        try:
            with _lock:
                _load_model(name)
        except Exception as e:
            logger.warning(f"Could not load model '{name}': {e}")


def predict(image_path, model_name=DEFAULT_MODEL):
    """
    Classify one leaf photo.

    Returns a dict like:
        {
            "model": "efficientnet",
            "label": "Papaya_Ringspot",
            "confidence": 0.9731,
            "candidates": [{"label": ..., "confidence": ...}, ...],   # top 3, best first
        }
    """
    # 1. Open the photo. exif_transpose rotates phone photos the right way up.
    image = Image.open(image_path)
    image = ImageOps.exif_transpose(image).convert("RGB")

    # 2. Turn it into a batch of one: shape [1, 3, 224, 224]
    batch = preprocess(image).unsqueeze(0)

    with _lock:
        model = _load_model(model_name)
        network = model["network"]

        # 3. Forward pass. no_grad() because we are not training.
        with torch.no_grad():
            scores = network(batch.to(DEVICE))
            probabilities = torch.softmax(scores, dim=1)[0].cpu()

    # 4. Keep the top 3 guesses.
    k = min(TOP_K, len(probabilities))
    top_probs, top_indexes = torch.topk(probabilities, k)

    candidates = []
    for prob, index in zip(top_probs.tolist(), top_indexes.tolist()):
        candidates.append({
            "label": model["class_names"][index],
            "confidence": round(prob, 4),
        })

    return {
        "model": model_name,
        "label": candidates[0]["label"],
        "confidence": candidates[0]["confidence"],
        "candidates": candidates,
    }


def list_models():
    """Info about each model for the model picker on the scan page."""
    result = []
    for name, info in MODELS.items():
        loaded = _loaded_models.get(name)
        meta = loaded["meta"] if loaded else {}
        result.append({
            "key": name,
            "label": info["label"],
            "file": info["file"],
            "available": loaded is not None,
            "val_acc": round(loaded["val_acc"], 2) if loaded and loaded["val_acc"] else None,
            "params_m": meta.get("params_m"),
            "size_mb": meta.get("fp32_size_mb"),
            "is_default": name == DEFAULT_MODEL,
        })
    return result

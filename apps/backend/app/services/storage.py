import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException
from ..config import get_settings

settings = get_settings()
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


async def save_image(file: UploadFile) -> tuple[str, str]:
    """Save uploaded file. Returns (file_path, public_url)."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP images are accepted.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 10MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"

    upload_dir = Path(settings.upload_dir) / "images"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    public_url = f"/uploads/images/{filename}"
    return str(file_path), public_url

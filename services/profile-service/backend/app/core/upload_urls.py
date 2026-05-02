"""Build URLs for files under /uploads that the browser can load (same-origin path by default)."""
from app.core.config import settings


def public_upload_url(filename: str) -> str:
    base = (settings.public_uploads_base or "").strip().rstrip("/")
    if base:
        return f"{base}/uploads/{filename}"
    return f"/uploads/{filename}"

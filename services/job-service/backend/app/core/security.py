import base64
import binascii
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def verify_jwt(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header_b64, payload_b64, signature_b64 = parts
    signing = f"{header_b64}.{payload_b64}".encode()
    try:
        secret = settings.jwt_secret.encode()
        mac = hmac.new(secret, signing, hashlib.sha256).digest()
        sig_calc = base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")
        sig_in = (signature_b64 or "").rstrip("=")
        if not hmac.compare_digest(sig_calc, sig_in):
            return None
        payload_json = _b64url_decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
        exp = payload.get("exp")
        if exp and exp < int(time.time()):
            return None
        return payload
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None


def get_current_user_optional(
    cred: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any] | None:
    if not cred or cred.scheme.lower() != "bearer":
        return None
    return verify_jwt(cred.credentials)


def require_auth(user: dict | None = Depends(get_current_user_optional)) -> dict[str, Any]:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "Not authenticated"})
    return user


def require_role(role: str):
    def _inner(user: dict = Depends(require_auth)) -> dict:
        if user.get("role") != role:
            rid = user.get("role") or "unknown"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": f"Access denied. Required role: {role}. Your role: {rid}",
                },
            )
        return user

    return _inner

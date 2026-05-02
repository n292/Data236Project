import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def verify_jwt(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode()
    try:
        mac = hmac.new(settings.jwt_secret.encode(), signing_input, hashlib.sha256).digest()
        sig_calc = base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")
        sig_in = (signature_b64 or "").rstrip("=")
        if not hmac.compare_digest(sig_calc, sig_in):
            return None
        pad = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + pad).decode("utf-8"))
        exp = payload.get("exp")
        if exp and exp < int(time.time()):
            return None
        return payload
    except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
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

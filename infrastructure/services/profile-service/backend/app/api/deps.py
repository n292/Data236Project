from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.auth_service import get_current_user_from_token


def _get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_current_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_role(role: str):
    def dependency(current_user: dict = Depends(_get_current_user)) -> dict:
        if current_user.get("role") != role:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {role}. Your role: {current_user.get('role')}",
            )
        return current_user
    return dependency


def get_current_user(current_user: dict = Depends(_get_current_user)) -> dict:
    return current_user


require_member = require_role("member")
require_recruiter = require_role("recruiter")

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.services.auth_service import (
    register,
    login,
    get_google_auth_url,
    google_callback,
    get_current_user_from_token,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str = "member"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register_route(req: RegisterRequest, db: Session = Depends(get_db)):
    ok, message, token = register(db, req.first_name, req.last_name, req.email, req.password, req.role)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "token": token}


@router.post("/login")
def login_route(req: LoginRequest, db: Session = Depends(get_db)):
    ok, message, token = login(db, req.email, req.password)
    if not ok:
        raise HTTPException(status_code=401, detail=message)
    return {"success": True, "message": message, "token": token}


@router.get("/me")
def me_route(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_current_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"success": True, "user": user}


@router.get("/google")
def google_login():
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    return RedirectResponse(get_google_auth_url())


@router.get("/google/callback")
def google_callback_route(code: str = "", error: str = "", db: Session = Depends(get_db)):
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_denied")
    ok, message, token = google_callback(db, code)
    if not ok:
        return RedirectResponse(f"{settings.frontend_url}/login?error=google_failed")
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={token}")

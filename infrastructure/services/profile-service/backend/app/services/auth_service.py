import json
from uuid import uuid4
from typing import Optional
import httpx
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.member import Member
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

VALID_ROLES = {"member", "recruiter"}


def _make_member_id() -> str:
    return f"m_{uuid4().hex[:12]}"


def _make_user_id() -> str:
    return f"u_{uuid4().hex[:12]}"


def _user_to_token_payload(user: User) -> dict:
    return {
        "sub": user.user_id,
        "email": user.email,
        "member_id": user.member_id,
        "role": user.role or "member",
    }


def register(
    db: Session,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
    role: str = "member",
) -> tuple[bool, str, Optional[str]]:
    if role not in VALID_ROLES:
        return False, "Invalid role. Must be 'member' or 'recruiter'.", None

    if db.query(User).filter(User.email == email).first():
        return False, "An account with this email already exists.", None

    existing_member = db.query(Member).filter(Member.email == email).first()
    if existing_member:
        member_id = existing_member.member_id
    else:
        member_id = _make_member_id()
        member = Member(
            member_id=member_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            skills_json=json.dumps([]),
            experience_json=json.dumps([]),
            education_json=json.dumps([]),
        )
        db.add(member)

    user = User(
        user_id=_make_user_id(),
        email=email,
        hashed_password=hash_password(password),
        member_id=member_id,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(_user_to_token_payload(user))
    return True, "Account created successfully.", token


def login(db: Session, email: str, password: str) -> tuple[bool, str, Optional[str]]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.hashed_password:
        return False, "Invalid email or password.", None
    if not verify_password(password, user.hashed_password):
        return False, "Invalid email or password.", None

    token = create_access_token(_user_to_token_payload(user))
    return True, "Login successful.", token


def get_google_auth_url(state: str = "") -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{query}"


def google_callback(db: Session, code: str) -> tuple[bool, str, Optional[str]]:
    try:
        resp = httpx.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        }, timeout=10)
        resp.raise_for_status()
        tokens = resp.json()
    except Exception as e:
        return False, f"Google token exchange failed: {e}", None

    try:
        info_resp = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=10,
        )
        info_resp.raise_for_status()
        info = info_resp.json()
    except Exception as e:
        return False, f"Google userinfo failed: {e}", None

    google_id = info.get("sub")
    email = info.get("email", "")
    first_name = info.get("given_name", "")
    last_name = info.get("family_name", "")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        if not user.google_id:
            user.google_id = google_id
            db.commit()
    else:
        existing_member = db.query(Member).filter(Member.email == email).first()
        if existing_member:
            member_id = existing_member.member_id
        else:
            member_id = _make_member_id()
            member = Member(
                member_id=member_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                skills_json=json.dumps([]),
                experience_json=json.dumps([]),
                education_json=json.dumps([]),
            )
            db.add(member)

        user = User(
            user_id=_make_user_id(),
            email=email,
            google_id=google_id,
            member_id=member_id,
            role="member",  # Google OAuth defaults to member
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(_user_to_token_payload(user))
    return True, "Google login successful.", token


def get_current_user_from_token(db: Session, token: str) -> Optional[dict]:
    from app.core.security import decode_token
    payload = decode_token(token)
    if not payload:
        return None
    user = db.query(User).filter(User.user_id == payload.get("sub")).first()
    if not user:
        return None
    member = db.query(Member).filter(Member.member_id == user.member_id).first()
    return {
        "user_id": user.user_id,
        "email": user.email,
        "member_id": user.member_id,
        "first_name": member.first_name if member else "",
        "last_name": member.last_name if member else "",
        "headline": member.headline if member else "",
        "profile_photo_url": member.profile_photo_url if member else None,
        "google_id": user.google_id,
        "role": user.role or "member",
    }

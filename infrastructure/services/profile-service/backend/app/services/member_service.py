import json
from pathlib import Path
from uuid import uuid4
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

STATE_ABBREVS = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}


def _location_filter(query, location: str):
    parts = [p.strip() for p in location.split(",") if p.strip()]
    if len(parts) >= 2:
        city_q = parts[0]
        state_raw = parts[1]
        state_q = STATE_ABBREVS.get(state_raw.upper(), state_raw)
        city_cond = or_(
            Member.city.ilike(f"%{city_q}%"),
            Member.state.ilike(f"%{city_q}%"),
            Member.country.ilike(f"%{city_q}%"),
        )
        state_cond = or_(
            Member.state.ilike(f"%{state_q}%"),
            Member.state.ilike(f"%{state_raw}%"),
            Member.country.ilike(f"%{state_q}%"),
        )
        return query.filter(and_(city_cond, state_cond))
    loc = f"%{location}%"
    return query.filter(or_(Member.city.ilike(loc), Member.state.ilike(loc), Member.country.ilike(loc)))
from app.models.member import Member
from app.schemas.member import MemberCreate, MemberUpdate, MemberSearchRequest


def _member_to_dict(member: Member) -> dict:
    return {
        "member_id": member.member_id,
        "first_name": member.first_name,
        "last_name": member.last_name,
        "email": member.email,
        "phone": member.phone,
        "city": member.city,
        "state": member.state,
        "country": member.country,
        "headline": member.headline,
        "about_summary": member.about_summary,
        "experience": json.loads(member.experience_json or "[]"),
        "education": json.loads(member.education_json or "[]"),
        "skills": json.loads(member.skills_json or "[]"),
        "profile_photo_url": member.profile_photo_url,
        "resume_text": member.resume_text,
        "connections_count": member.connections_count,
        "profile_views_daily": member.profile_views_daily,
        "created_at": member.created_at.isoformat() if member.created_at else None,
        "updated_at": member.updated_at.isoformat() if member.updated_at else None,
    }


def create_member(db: Session, payload: MemberCreate) -> tuple[bool, str, str | None, dict | None]:
    existing = db.query(Member).filter(Member.email == payload.email).first()
    if existing:
        return False, "Duplicate email/user", None, None

    member_id = f"m_{uuid4().hex[:12]}"
    member = Member(
        member_id=member_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        phone=payload.phone,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        headline=payload.headline,
        about_summary=payload.about_summary,
        experience_json=json.dumps(payload.experience),
        education_json=json.dumps(payload.education),
        skills_json=json.dumps(payload.skills),
        profile_photo_url=payload.profile_photo_url,
        resume_text=payload.resume_text,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return True, "Member profile created successfully", member_id, _member_to_dict(member)


def get_member(db: Session, member_id: str) -> dict | None:
    member = db.query(Member).filter(Member.member_id == member_id).first()
    return _member_to_dict(member) if member else None


def update_member(db: Session, payload: MemberUpdate) -> tuple[bool, str, dict | None]:
    member = db.query(Member).filter(Member.member_id == payload.member_id).first()
    if not member:
        return False, "Member not found", None

    if payload.email and payload.email != member.email:
        existing = db.query(Member).filter(Member.email == str(payload.email)).first()
        if existing:
            return False, "A member with this email already exists.", None

    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("member_id", None)
    for key, value in update_data.items():
        if key == "experience":
            member.experience_json = json.dumps(value)
        elif key == "education":
            member.education_json = json.dumps(value)
        elif key == "skills":
            member.skills_json = json.dumps(value)
        else:
            setattr(member, key, str(value) if key == "email" and value is not None else value)
    db.commit()
    db.refresh(member)
    return True, "Member updated successfully", _member_to_dict(member)


def delete_member(db: Session, member_id: str) -> bool:
    member = db.query(Member).filter(Member.member_id == member_id).first()
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True


def search_members(db: Session, payload: MemberSearchRequest) -> list[dict]:
    query = db.query(Member)
    if payload.skill:
        query = query.filter(Member.skills_json.ilike(f"%{payload.skill}%"))
    if payload.location:
        query = _location_filter(query, payload.location)
    if payload.keyword:
        kw = f"%{payload.keyword}%"
        full_name = func.concat(Member.first_name, ' ', Member.last_name)
        query = query.filter(
            or_(
                full_name.ilike(kw),
                Member.first_name.ilike(kw),
                Member.last_name.ilike(kw),
                Member.headline.ilike(kw),
                Member.about_summary.ilike(kw),
                Member.skills_json.ilike(kw),
            )
        )
    limit = getattr(payload, 'limit', None) or 50
    return [_member_to_dict(m) for m in query.order_by(Member.connections_count.desc()).limit(limit).all()]


def increment_connections_count(db: Session, member_id: str) -> bool:
    member = db.query(Member).filter(Member.member_id == member_id).first()
    if not member:
        return False
    member.connections_count = (member.connections_count or 0) + 1
    db.commit()
    return True


def increment_profile_views_daily(db: Session, member_id: str) -> bool:
    member = db.query(Member).filter(Member.member_id == member_id).first()
    if not member:
        return False
    member.profile_views_daily = (member.profile_views_daily or 0) + 1
    db.commit()
    return True


def delete_photo_file(upload_root: Path, profile_photo_url: str | None):
    if not profile_photo_url or "/uploads/" not in profile_photo_url:
        return
    filename = profile_photo_url.rsplit("/", 1)[-1]
    path = upload_root / filename
    if path.exists() and path.is_file():
        path.unlink()

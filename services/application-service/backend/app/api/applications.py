import json
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import require_role
from app.db.session import get_db
from app.kafka_app import publish_application_submitted, publish_status_updated

router = APIRouter()

ALLOWED_STATUSES = frozenset(
    {"draft", "submitted", "reviewing", "reviewed", "rejected", "interview", "offer", "accepted", "withdrawn"}
)


def _row_to_app(row) -> dict[str, Any]:
    d = dict(row._mapping)
    meta = d.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            meta = {}
    return {
        "application_id": d.get("application_id"),
        "job_id": d.get("job_id"),
        "member_id": d.get("member_id"),
        "recruiter_id": d.get("recruiter_id"),
        "resume_url": d.get("resume_url"),
        "cover_letter": d.get("cover_letter"),
        "metadata": meta or {},
        "status": d.get("status"),
        "recruiter_note": d.get("recruiter_note"),
        "created_at": str(d.get("created_at")) if d.get("created_at") is not None else None,
        "updated_at": str(d.get("updated_at")) if d.get("updated_at") is not None else None,
    }


def _is_job_closed(job_id: str) -> bool:
    url = settings.job_service_url.rstrip("/") + "/jobs/get"
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.post(url, json={"job_id": job_id})
            data = r.json()
            return data.get("status") == "closed"
    except Exception:
        return False


@router.post("/submit")
def submit_application(
    job_id: str = Form(...),
    member_id: str = Form(...),
    recruiter_id: str | None = Form(None),
    resume_ref: str | None = Form(None),
    cover_letter: str | None = Form(None),
    metadata: str | None = Form(None),
    is_draft: str | None = Form(None),
    resume: UploadFile | None = File(None),
    user: dict = Depends(require_role("member")),
    db: Session = Depends(get_db),
):
    meta: dict = {}
    if metadata:
        try:
            meta = json.loads(metadata)
        except json.JSONDecodeError:
            meta = {}
    is_draft_b = is_draft in ("true", "True", True, "1")

    if not job_id or not member_id:
        raise HTTPException(status_code=400, detail={"message": "job_id and member_id are required"})

    if _is_job_closed(job_id):
        raise HTTPException(status_code=400, detail={"message": "Cannot apply to a closed job"})

    dup = db.execute(
        text("SELECT * FROM applications WHERE job_id = :j AND member_id = :m"),
        {"j": job_id, "m": member_id},
    ).first()
    if dup:
        ddup = dict(dup._mapping)
        st = ddup.get("status")
        if not is_draft_b and st not in ("draft", "withdrawn"):
            raise HTTPException(status_code=409, detail={"message": "Duplicate application not allowed"})

    upload_dir = Path(__file__).resolve().parent.parent / "uploads" / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)

    resume_url = None
    if resume and resume.filename:
        safe = resume.filename.replace(" ", "_")
        fname = f"{uuid.uuid4().hex}-{safe}"
        dest = upload_dir / fname
        dest.write_bytes(resume.file.read())
        resume_url = f"uploads/resumes/{fname}"
    elif resume_ref:
        resume_url = resume_ref

    application_id = (
        str(dict(dup._mapping)["application_id"]) if dup else str(uuid.uuid4())
    )
    application = {
        "application_id": application_id,
        "job_id": job_id,
        "member_id": member_id,
        "recruiter_id": recruiter_id or user.get("member_id"),
        "resume_url": resume_url,
        "cover_letter": cover_letter,
        "metadata": meta,
        "status": "draft" if is_draft_b else "submitted",
    }

    db.execute(
        text(
            """INSERT INTO applications
               (application_id, job_id, member_id, recruiter_id, resume_url, cover_letter, metadata, status)
               VALUES (:aid, :jid, :mid, :rid, :ru, :cl, :meta, :st)
               ON DUPLICATE KEY UPDATE
                 resume_url = VALUES(resume_url),
                 cover_letter = VALUES(cover_letter),
                 metadata = VALUES(metadata),
                 status = VALUES(status),
                 updated_at = CURRENT_TIMESTAMP"""
        ),
        {
            "aid": application_id,
            "jid": job_id,
            "mid": member_id,
            "rid": application.get("recruiter_id"),
            "ru": application["resume_url"],
            "cl": cover_letter,
            "meta": json.dumps(meta) if meta else None,
            "st": application["status"],
        },
    )
    db.commit()

    if not is_draft_b:
        try:
            publish_application_submitted(application)
        except Exception as e:
            print(f"Kafka publish failed (application persisted): {e}")

    msg = "Application saved as draft" if is_draft_b else "Application submitted successfully"
    payload = {"message": msg, "application": application}
    if is_draft_b:
        return JSONResponse(status_code=200, content=payload)
    return JSONResponse(status_code=201, content=payload)


@router.post("/get")
def get_application(body: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    aid = body.get("application_id")
    if not aid:
        raise HTTPException(status_code=400, detail={"message": "application_id is required"})
    row = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail={"message": "Application not found"})
    return _row_to_app(row)


@router.post("/byMember")
def by_member(body: dict = Body(default_factory=dict), db: Session = Depends(get_db), _: dict = Depends(require_role("member"))):
    mid = body.get("member_id")
    if not mid:
        raise HTTPException(status_code=400, detail={"message": "member_id is required"})
    rows = db.execute(
        text("SELECT * FROM applications WHERE member_id = :m ORDER BY created_at DESC"),
        {"m": mid},
    ).fetchall()
    return [_row_to_app(r) for r in rows]


@router.post("/byJob")
def by_job(body: dict = Body(default_factory=dict), db: Session = Depends(get_db), _: dict = Depends(require_role("recruiter"))):
    jid = body.get("job_id")
    if not jid:
        raise HTTPException(status_code=400, detail={"message": "job_id is required"})
    rows = db.execute(
        text(
            """SELECT * FROM applications WHERE job_id = :j AND status NOT IN ('draft', 'withdrawn')
               ORDER BY created_at DESC"""
        ),
        {"j": jid},
    ).fetchall()
    return [_row_to_app(r) for r in rows]


@router.post("/updateStatus")
def update_status(body: dict = Body(default_factory=dict), db: Session = Depends(get_db), _: dict = Depends(require_role("recruiter"))):
    aid = body.get("application_id")
    new_status = body.get("status")
    if not aid or not new_status:
        raise HTTPException(status_code=400, detail={"message": "application_id and status are required"})
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail={"message": "Invalid status"})
    row = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail={"message": "Application not found"})
    db.execute(text("UPDATE applications SET status = :s WHERE application_id = :a"), {"s": new_status, "a": aid})
    db.commit()
    publish_status_updated(aid, new_status, "recruiter")
    row2 = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    return {"message": "Application status updated successfully", "application": _row_to_app(row2)}


@router.post("/addNote")
def add_note(body: dict = Body(default_factory=dict), db: Session = Depends(get_db), _: dict = Depends(require_role("recruiter"))):
    aid = body.get("application_id")
    note = body.get("recruiter_note")
    if not aid or not note:
        raise HTTPException(status_code=400, detail={"message": "application_id and recruiter_note are required"})
    row = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail={"message": "Application not found"})
    db.execute(text("UPDATE applications SET recruiter_note = :n WHERE application_id = :a"), {"n": note, "a": aid})
    db.commit()
    row2 = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    return {"message": "Recruiter note added successfully", "application": _row_to_app(row2)}


@router.get("/draft/{job_id}/{member_id}")
def get_draft(job_id: str, member_id: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM applications WHERE job_id = :j AND member_id = :m"),
        {"j": job_id, "m": member_id},
    ).first()
    if not row or dict(row._mapping).get("status") != "draft":
        raise HTTPException(status_code=404, detail={"message": "No draft found"})
    return _row_to_app(row)


@router.post("/withdraw")
def withdraw(body: dict = Body(default_factory=dict), db: Session = Depends(get_db), _: dict = Depends(require_role("member"))):
    aid = body.get("application_id")
    mid = body.get("member_id")
    if not aid or not mid:
        raise HTTPException(status_code=400, detail={"message": "application_id and member_id are required"})
    row = db.execute(
        text("SELECT * FROM applications WHERE application_id = :a"),
        {"a": aid},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail={"message": "Application not found"})
    if dict(row._mapping).get("member_id") != mid:
        raise HTTPException(status_code=403, detail={"message": "Not authorised to withdraw this application"})
    db.execute(
        text(
            """UPDATE applications SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
               WHERE application_id = :a AND member_id = :m"""
        ),
        {"a": aid, "m": mid},
    )
    db.commit()
    return {"message": "Application withdrawn successfully"}

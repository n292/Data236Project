from typing import Any

from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user_optional, require_auth, require_role
from app.db.session import get_db
from app.services import job_service as svc

router = APIRouter()


def _trace(request: Request, body: dict) -> str | None:
    return request.headers.get("x-trace-id") or body.get("trace_id")


@router.post("/create")
def create(
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    user: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
):
    raw = dict(body)
    trace_id = _trace(request, raw)
    raw.pop("trace_id", None)
    raw["recruiter_id"] = user.get("member_id") or user.get("sub") or raw.get("recruiter_id")
    if raw.get("company_name") and not raw.get("company_id"):
        raw["company_id"] = svc.company_id_from_name(str(raw["company_name"]))
    out = svc.create_job(db, raw, trace_id=trace_id)
    return JSONResponse(status_code=201, content=out)


@router.post("/get")
def get_job(body: dict[str, Any] = Body(default_factory=dict), db: Session = Depends(get_db)):
    return svc.get_job(db, body)


@router.post("/update")
def update_job(
    body: dict[str, Any] = Body(default_factory=dict),
    user: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
):
    raw = dict(body)
    raw["recruiter_id"] = user.get("member_id") or user.get("sub") or raw.get("recruiter_id")
    return svc.update_job(db, raw)


@router.post("/close")
def close_job(
    body: dict[str, Any] = Body(default_factory=dict),
    user: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
):
    raw = dict(body)
    raw["recruiter_id"] = user.get("member_id") or user.get("sub") or raw.get("recruiter_id")
    return svc.close_job(db, raw)


@router.post("/search")
def search(body: dict[str, Any] = Body(default_factory=dict), db: Session = Depends(get_db)):
    return svc.search_jobs(db, body)


@router.post("/view")
def view(body: dict[str, Any] = Body(default_factory=dict), db: Session = Depends(get_db)):
    return svc.view_job(db, body)


@router.post("/save")
def save(
    body: dict[str, Any] = Body(default_factory=dict),
    _user: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    return svc.save_job(db, body)


@router.post("/unsave")
def unsave(
    body: dict[str, Any] = Body(default_factory=dict),
    _user: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    return svc.unsave_job(db, body)


@router.post("/byRecruiter")
def by_recruiter(
    body: dict[str, Any] = Body(default_factory=dict),
    user: dict = Depends(require_role("recruiter")),
    db: Session = Depends(get_db),
):
    raw = dict(body)
    raw["recruiter_id"] = user.get("member_id") or user.get("sub") or raw.get("recruiter_id")
    return svc.jobs_by_recruiter(db, raw)


@router.post("/saved")
def saved(
    body: dict[str, Any] = Body(default_factory=dict),
    _user: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    return svc.get_saved_jobs(db, body)

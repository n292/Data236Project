"""Career Coach API routes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/ai/career-coach/analyze")
async def analyze_career_fit(
    member_id: str = Form(...),
    job_id: str = Form(...),
    resume: Optional[UploadFile] = File(None),
):
    """Fetch all data server-side, score deterministically + run LLM, return coaching report.

    Accepts multipart/form-data so the client can optionally attach a resume PDF.
    """
    resume_text: Optional[str] = None
    if resume and resume.filename:
        try:
            pdf_bytes = await resume.read()
            if pdf_bytes:
                from pdfminer.high_level import extract_text
                from io import BytesIO
                resume_text = extract_text(BytesIO(pdf_bytes)) or None
        except Exception:
            pass  # resume text stays None — analysis still runs without it

    mid = (member_id or "").strip()
    jid = (job_id or "").strip()
    if not mid or not jid:
        return JSONResponse(
            status_code=400,
            content={"error": "member_id and job_id are required", "detail": "member_id and job_id are required"},
        )

    try:
        from app.services.career_coach_service import analyze
        result = await analyze(mid, jid, resume_text=resume_text)
        return {"success": True, "analysis": result}
    except ValueError as exc:
        msg = str(exc)
        return JSONResponse(
            status_code=404,
            content={"error": msg, "message": msg, "detail": msg},
        )
    except Exception as exc:
        msg = str(exc)
        return JSONResponse(status_code=500, content={"error": msg, "message": msg, "detail": msg})

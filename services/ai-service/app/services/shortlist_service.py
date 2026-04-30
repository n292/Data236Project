"""AI Shortlist pipeline — async orchestrator.

Workflow states (stored in MongoDB):
  requested → parsing_resumes → scoring_candidates →
  generating_explanations → generating_outreach →
  awaiting_recruiter_approval → completed | failed
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.db.mongo import get_db
from app.kafka.producer import publish_ai_result
from app.schemas.shortlist import (
    CandidateRecommendation,
    CandidateScoreBreakdown,
    ShortlistTaskCreateRequest,
)
from app.services import data_fetcher
from app.services.scoring_service import rank_and_shortlist

log = logging.getLogger(__name__)

_TASK_CACHE: dict[str, dict] = {}   # write-through in-memory cache


# ── Timestamp helper ──────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── PDF text extraction ───────────────────────────────────────────────────────

def _extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text
        from io import BytesIO
        return extract_text(BytesIO(pdf_bytes)) or ""
    except Exception as exc:
        log.warning("PDF text extraction failed: %s", exc)
        return ""


# ── MongoDB persistence ───────────────────────────────────────────────────────

async def _save(task: dict) -> None:
    task["updated_at"] = _now()
    _TASK_CACHE[task["task_id"]] = task
    try:
        db = get_db()
        await db["ai_tasks"].replace_one(
            {"task_id": task["task_id"]}, task, upsert=True
        )
    except Exception as exc:
        log.warning("MongoDB save failed: %s", exc)


async def load_task(task_id: str) -> Optional[dict]:
    if task_id in _TASK_CACHE:
        return _TASK_CACHE[task_id]
    try:
        db = get_db()
        doc = await db["ai_tasks"].find_one({"task_id": task_id}, {"_id": 0})
        if doc:
            _TASK_CACHE[task_id] = doc
        return doc
    except Exception as exc:
        log.warning("MongoDB load failed: %s", exc)
        return None


# ── Step recorder ─────────────────────────────────────────────────────────────

async def _step(task: dict, name: str, status: str, data: dict) -> None:
    entry = {"step": name, "status": status, "timestamp": _now(), "data": data}
    task.setdefault("steps", []).append(entry)
    publish_ai_result(
        task_id=task["task_id"],
        trace_id=task["trace_id"],
        step=name,
        status=status,
        payload=data,
        actor_id=task.get("recruiter_id"),
    )
    await _save(task)


# ── Pipeline ──────────────────────────────────────────────────────────────────

async def _run_pipeline(task_id: str, req: ShortlistTaskCreateRequest) -> None:
    task = await load_task(task_id)
    if not task:
        log.error("Pipeline launched for unknown task %s", task_id)
        return

    loop = asyncio.get_running_loop()

    async def fail(reason: str) -> None:
        task["status"] = "failed"
        task["error"] = reason
        await _step(task, "failed", "error", {"reason": reason})

    try:
        # ── Step 1: Fetch job details ────────────────────────────────────────
        task["status"] = "parsing_resumes"
        await _step(task, "parsing_resumes", "started", {"job_id": req.job_id})

        job = await data_fetcher.fetch_job(req.job_id)
        if not job:
            await fail(f"Could not fetch job {req.job_id} from job-service")
            return
        task["job_data"] = job
        await _save(task)

        # ── Step 2: Fetch applications ───────────────────────────────────────
        applications = await data_fetcher.fetch_applications(req.job_id)
        if not applications:
            await fail(f"No applications found for job {req.job_id}")
            return
        await _step(task, "parsing_resumes", "fetched_applications",
                    {"count": len(applications)})

        # ── Step 3: Enrich each candidate with resume text + profile ─────────
        candidates: list[dict] = []
        for app in applications:
            member_id = app.get("member_id", "")
            resume_url = app.get("resume_url") or app.get("resume_ref") or ""
            resume_text = ""

            if resume_url and resume_url.lower().endswith(".pdf"):
                pdf_bytes = await data_fetcher.fetch_resume_pdf(resume_url)
                if pdf_bytes:
                    resume_text = _extract_pdf_text(pdf_bytes)

            profile = await data_fetcher.fetch_member_profile(member_id)

            candidate: dict = {
                "candidate_id": member_id,
                "member_id": member_id,
                "job_id": req.job_id,
                "application_id": app.get("application_id", ""),
                "resume_text": resume_text or "",
                "cover_letter": app.get("cover_letter") or "",
                "candidate_name": (
                    f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
                    if profile else ""
                ) or member_id,
                "candidate_email": (profile or {}).get("email"),
                "city": (profile or {}).get("city") or "",
                "state": (profile or {}).get("state") or "",
                "country": (profile or {}).get("country") or "",
                "headline": (profile or {}).get("headline") or "",
                "skills_from_profile": (profile or {}).get("skills_json") or [],
                "experience_json": (profile or {}).get("experience_json") or [],
            }
            candidates.append(candidate)

        await _step(task, "parsing_resumes", "completed",
                    {"candidates_enriched": len(candidates)})

        # ── Step 4: Deterministic scoring ────────────────────────────────────
        task["status"] = "scoring_candidates"
        await _step(task, "scoring_candidates", "started", {"count": len(candidates)})

        all_scored, shortlist = rank_and_shortlist(candidates, job, req.top_n)

        task["all_candidates_count"] = len(all_scored)
        avg_score = round(sum(c["match_score"] for c in all_scored) / len(all_scored), 1) if all_scored else 0
        top_score = all_scored[0]["match_score"] if all_scored else 0

        await _step(task, "scoring_candidates", "completed", {
            "total_scored": len(all_scored),
            "shortlisted": len(shortlist),
            "top_score": top_score,
            "avg_score": avg_score,
        })

        # ── Step 5: LLM — explanations (run in thread to avoid blocking loop) ─
        task["status"] = "generating_explanations"
        await _step(task, "generating_explanations", "started",
                    {"shortlist_count": len(shortlist)})

        from app.llm.chains.explanation_chain import generate_explanation
        for c in shortlist:
            try:
                expl = await loop.run_in_executor(None, generate_explanation, c, job, c)
                c["candidate_explanation"] = expl.model_dump()
            except Exception as exc:
                log.warning("Explanation generation failed for %s: %s", c.get("member_id"), exc)
                c["candidate_explanation"] = {
                    "summary": f"Match score {c['match_score']}/100.",
                    "reasons": [f"Matched {len(c.get('matched_skills', []))} skills"],
                }

        await _step(task, "generating_explanations", "completed",
                    {"count": len(shortlist)})

        # ── Step 6: LLM — outreach drafts (run in thread) ────────────────────
        if req.include_outreach:
            task["status"] = "generating_outreach"
            await _step(task, "generating_outreach", "started", {})

            from app.llm.chains.outreach_chain import generate_outreach
            for c in shortlist:
                try:
                    expl_summary = (c.get("candidate_explanation") or {}).get("summary", "")
                    draft = await loop.run_in_executor(
                        None, generate_outreach, c, job, c, expl_summary
                    )
                    c["outreach_draft"] = draft.model_dump()
                except Exception as exc:
                    log.warning("Outreach generation failed for %s: %s", c.get("member_id"), exc)
                    c["outreach_draft"] = None

            await _step(task, "generating_outreach", "completed",
                        {"count": len(shortlist)})

        # ── Step 7: Assemble final shortlist ─────────────────────────────────
        shortlist_records: list[dict] = []
        for c in shortlist:
            bd = c.get("score_breakdown", {})
            rec = CandidateRecommendation(
                candidate_id=c.get("candidate_id") or c.get("member_id", ""),
                job_id=req.job_id,
                match_score=c.get("match_score", 0),
                score_breakdown=CandidateScoreBreakdown(
                    skills_score=bd.get("skills_score", 0),
                    seniority_score=bd.get("seniority_score", 0),
                    experience_score=bd.get("experience_score", 0),
                    location_score=bd.get("location_score", 0),
                    bonus_score=bd.get("bonus_score", 0),
                    total_score=bd.get("total_score", 0),
                ),
                matched_skills=c.get("matched_skills", []),
                missing_skills=c.get("missing_skills", []),
                seniority_fit=c.get("seniority_fit", "unknown"),
                location_fit=c.get("location_fit", "unknown"),
                experience_years=c.get("experience_years"),
                inferred_seniority=c.get("inferred_seniority", "mid"),
                candidate_name=c.get("candidate_name") or c.get("member_id", ""),
                candidate_email=c.get("candidate_email"),
                candidate_explanation=c.get("candidate_explanation"),
                outreach_draft=c.get("outreach_draft"),
                approval_status="pending",
            )
            shortlist_records.append(rec.model_dump())

        # ── Persist results ───────────────────────────────────────────────────
        shortlist_rate = round(len(shortlist) / len(all_scored), 3) if all_scored else 0
        task.update({
            "status": "awaiting_recruiter_approval",
            "shortlist": shortlist_records,
            "all_candidates_count": len(all_scored),
            "approval_status": "pending",
            "metrics": {
                "candidate_count": len(all_scored),
                "shortlist_count": len(shortlist),
                "top_score": top_score,
                "avg_score": avg_score,
                "shortlist_rate": shortlist_rate,
            },
            "completed_at": _now(),
        })

        await _step(task, "awaiting_recruiter_approval", "ok", {
            "shortlist_count": len(shortlist),
            "top_score": top_score,
        })

    except Exception as exc:
        log.error("Unhandled pipeline error for task %s: %s", task_id, exc, exc_info=True)
        task["status"] = "failed"
        task["error"] = str(exc)
        try:
            await _step(task, "failed", "error", {"reason": str(exc)})
        except Exception:
            pass


# ── Public API ────────────────────────────────────────────────────────────────

async def create_task(req: ShortlistTaskCreateRequest) -> str:
    task_id = str(uuid.uuid4())
    trace_id = str(uuid.uuid4())
    task: dict = {
        "task_id": task_id,
        "trace_id": trace_id,
        "task_type": "shortlist",
        "job_id": req.job_id,
        "recruiter_id": req.recruiter_id,
        "top_n": req.top_n,
        "include_outreach": req.include_outreach,
        "status": "requested",
        "created_at": _now(),
        "updated_at": _now(),
        "steps": [],
        "shortlist": [],
        "all_candidates_count": 0,
        "approval_status": "pending",
        "metrics": {},
        "error": None,
        "job_data": None,
    }
    await _save(task)
    # Publish request event to ai.requests
    publish_ai_result(
        task_id=task_id,
        trace_id=trace_id,
        step="requested",
        status="ok",
        payload={"job_id": req.job_id, "top_n": req.top_n},
        actor_id=req.recruiter_id,
    )
    return task_id


async def approve_task(task_id: str, note: str = "") -> Optional[dict]:
    task = await load_task(task_id)
    if not task:
        return None

    recruiter_id = task.get("recruiter_id", "")
    approved_candidates = []

    for c in task.get("shortlist", []):
        if c.get("approval_status") == "pending":
            c["approval_status"] = "approved"
            approved_candidates.append(c)

    task.update({
        "status": "completed",
        "approval_status": "approved",
        "approval_note": note,
        "approval_timestamp": _now(),
    })
    await _step(task, "human_approval", "approved", {"note": note})

    # Send outreach messages to all newly approved candidates
    from app.services.messaging_client import send_outreach
    for c in approved_candidates:
        draft = c.get("outreach_draft") or {}
        subject = draft.get("subject", "Job Opportunity")
        message = draft.get("full_message", "")
        await send_outreach(recruiter_id, c.get("candidate_id", ""), subject, message)

    return task


async def edit_and_approve(
    task_id: str,
    candidate_id: str,
    edited_subject: Optional[str],
    edited_message: str,
    note: str = "",
) -> Optional[dict]:
    task = await load_task(task_id)
    if not task:
        return None

    recruiter_id = task.get("recruiter_id", "")
    send_subject = ""
    send_message = ""

    for c in task.get("shortlist", []):
        if c.get("candidate_id") == candidate_id:
            orig = c.get("outreach_draft") or {}
            send_subject = edited_subject or orig.get("subject", "Job Opportunity")
            send_message = edited_message
            c["edited_outreach"] = {
                "subject": send_subject,
                "intro": orig.get("intro", ""),
                "why_fit": orig.get("why_fit", ""),
                "full_message": edited_message,
            }
            c["approval_status"] = "edited_approved"

    # Mark task complete if all candidates reviewed
    pending = [c for c in task.get("shortlist", []) if c.get("approval_status") == "pending"]
    if not pending:
        task["status"] = "completed"
        task["approval_status"] = "approved"
    task["approval_note"] = note
    await _step(task, "human_approval", "edited_approved",
                {"candidate_id": candidate_id, "note": note})

    # Send the edited outreach message
    from app.services.messaging_client import send_outreach
    await send_outreach(recruiter_id, candidate_id, send_subject, send_message)

    return task


async def reject_task(task_id: str, reason: str = "") -> Optional[dict]:
    task = await load_task(task_id)
    if not task:
        return None
    task.update({
        "status": "completed",
        "approval_status": "rejected",
        "rejection_reason": reason,
        "approval_timestamp": _now(),
    })
    await _step(task, "human_approval", "rejected", {"reason": reason})
    return task


async def approve_candidate(task_id: str, candidate_id: str, note: str = "") -> Optional[dict]:
    task = await load_task(task_id)
    if not task:
        return None

    recruiter_id = task.get("recruiter_id", "")
    target = None
    for c in task.get("shortlist", []):
        if c.get("candidate_id") == candidate_id:
            c["approval_status"] = "approved"
            target = c
            break

    pending = [c for c in task.get("shortlist", []) if c.get("approval_status") == "pending"]
    if not pending:
        task["status"] = "completed"
        task["approval_status"] = "approved"

    await _step(task, "human_approval", "approved", {"candidate_id": candidate_id, "note": note})

    if target:
        from app.services.messaging_client import send_outreach
        draft = target.get("outreach_draft") or {}
        await send_outreach(recruiter_id, candidate_id, draft.get("subject", "Job Opportunity"), draft.get("full_message", ""))

    return task


async def reject_candidate(task_id: str, candidate_id: str, reason: str = "") -> Optional[dict]:
    task = await load_task(task_id)
    if not task:
        return None

    for c in task.get("shortlist", []):
        if c.get("candidate_id") == candidate_id:
            c["approval_status"] = "rejected"
            break

    pending = [c for c in task.get("shortlist", []) if c.get("approval_status") == "pending"]
    if not pending:
        task["status"] = "completed"
        task["approval_status"] = "approved"

    await _step(task, "human_approval", "rejected", {"candidate_id": candidate_id, "reason": reason})
    return task


def launch_pipeline(task_id: str, req: ShortlistTaskCreateRequest) -> None:
    """Schedule the async pipeline as a background task on the running event loop."""
    asyncio.create_task(_run_pipeline(task_id, req))

"""Hiring Assistant — Supervisor Agent.

Workflow:
  1. Parse resumes        (skill: resume_parser)
  2. Rank candidates      (skill: job_matcher)
  3. Draft outreach       (skill: outreach_drafter)
  4. Human-in-the-loop approval gate

Trace_id propagates through every step and every Kafka event.
State is persisted to MongoDB; in-memory dict is a write-through cache.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.resume_parser import parse_resume
from app.services.job_matcher import rank_candidates
from app.kafka.producer import publish_ai_result

_TASK_CACHE: dict[str, dict] = {}


# ── MongoDB helpers ──────────────────────────────────────────────────────────

async def _save_task_mongo(task: dict):
    try:
        from app.db.mongo import get_db
        db = get_db()
        await db["ai_tasks"].replace_one(
            {"task_id": task["task_id"]},
            task,
            upsert=True,
        )
    except Exception as exc:
        print(f"[hiring-assistant] mongo save failed: {exc}")


async def _load_task_mongo(task_id: str) -> Optional[dict]:
    try:
        from app.db.mongo import get_db
        db = get_db()
        doc = await db["ai_tasks"].find_one({"task_id": task_id}, {"_id": 0})
        return doc
    except Exception as exc:
        print(f"[hiring-assistant] mongo load failed: {exc}")
        return None


# ── Public API ───────────────────────────────────────────────────────────────

def create_task(
    job_id: str,
    job_skills: list,
    job_seniority: Optional[str],
    resumes: list,
    trace_id: Optional[str] = None,
    recruiter_id: Optional[str] = None,
) -> str:
    task_id = str(uuid.uuid4())
    task = {
        "task_id": task_id,
        "trace_id": trace_id or str(uuid.uuid4()),
        "job_id": job_id,
        "recruiter_id": recruiter_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "steps": [],
        "result": None,
        "requires_approval": False,
        "approval_status": None,
        "metrics": {},
    }
    _TASK_CACHE[task_id] = task
    return task_id


def _append_step(task: dict, step_name: str, status: str, data: dict):
    """Record a workflow step and publish to ai.results."""
    step = {
        "step": step_name,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    task["steps"].append(step)
    task["updated_at"] = datetime.now(timezone.utc).isoformat()

    publish_ai_result(
        task_id=task["task_id"],
        trace_id=task["trace_id"],
        step=step_name,
        status=status,
        payload=data,
        actor_id=task.get("recruiter_id"),
    )


def run_task_sync(
    task_id: str,
    job_id: str,
    job_skills: list,
    job_seniority: Optional[str],
    resumes: list,
    trace_id: Optional[str] = None,
    recruiter_id: Optional[str] = None,
) -> dict:
    """Synchronous version used by HTTP endpoint — runs inline."""
    task = _TASK_CACHE.get(task_id)
    if not task:
        task = {
            "task_id": task_id,
            "trace_id": trace_id or str(uuid.uuid4()),
            "job_id": job_id,
            "recruiter_id": recruiter_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "steps": [],
            "result": None,
            "requires_approval": False,
            "approval_status": None,
            "metrics": {},
        }
        _TASK_CACHE[task_id] = task

    task["status"] = "running"
    _append_step(task, "started", "ok", {"job_id": job_id, "resume_count": len(resumes)})

    # ── Step 1: Resume parsing ───────────────────────────────────────────────
    try:
        parsed = [parse_resume(r.get("text", "")) for r in resumes]
        _append_step(task, "resume_parsing", "completed", {
            "parsed_count": len(parsed),
            "sample_skills": parsed[0]["skills"][:5] if parsed else [],
        })
    except Exception as exc:
        task["status"] = "failed"
        _append_step(task, "resume_parsing", "failed", {"error": str(exc)})
        return task

    # ── Step 2: Candidate ranking ────────────────────────────────────────────
    try:
        ranked = rank_candidates(parsed, job_skills, job_seniority)
        avg_score = round(sum(r["score"] for r in ranked) / len(ranked), 1) if ranked else 0
        _append_step(task, "candidate_ranking", "completed", {
            "ranked_count": len(ranked),
            "top_score": ranked[0]["score"] if ranked else 0,
            "avg_score": avg_score,
        })
    except Exception as exc:
        task["status"] = "failed"
        _append_step(task, "candidate_ranking", "failed", {"error": str(exc)})
        return task

    # ── Step 3: Outreach draft (simple template-based) ───────────────────────
    try:
        top = ranked[0] if ranked else None
        outreach = None
        if top:
            matched = top.get("matched_skills", [])
            outreach = (
                f"Hi, we reviewed your profile and your skills in "
                f"{', '.join(matched[:3]) if matched else 'your area'} stand out "
                f"for our {job_id} opening. We'd love to connect!"
            )
        _append_step(task, "outreach_draft", "completed", {"outreach": outreach})
    except Exception as exc:
        _append_step(task, "outreach_draft", "skipped", {"reason": str(exc)})

    # ── Evaluation metrics ───────────────────────────────────────────────────
    top = ranked[0] if ranked else None
    requires_approval = top is not None and top["score"] >= 80
    shortlist = [r for r in ranked if r["score"] >= 60]

    metrics = {
        "candidate_count": len(ranked),
        "shortlist_count": len(shortlist),
        "top_score": top["score"] if top else 0,
        "avg_score": avg_score,
        "shortlist_rate": round(len(shortlist) / len(ranked), 3) if ranked else 0,
        "auto_approved": not requires_approval,
    }
    task["metrics"] = metrics

    result = {
        "job_id": job_id,
        "candidates_ranked": ranked,
        "shortlist": shortlist,
        "top_candidate": top,
        "outreach": outreach if top else None,
        "requires_human_approval": requires_approval,
        "approval_status": "pending" if requires_approval else "auto_approved",
    }
    task.update({
        "status": "awaiting_approval" if requires_approval else "completed",
        "result": result,
        "requires_approval": requires_approval,
        "approval_status": "pending" if requires_approval else "auto_approved",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    })

    _append_step(task, "completed", "ok", {
        "status": task["status"],
        "shortlist_count": len(shortlist),
        "metrics": metrics,
    })

    return task


def run_task_async(
    task_id: str,
    trace_id: str,
    job_id: str,
    job_skills: list,
    job_seniority: Optional[str],
    resumes: list,
    recruiter_id: Optional[str] = None,
):
    """Called by Kafka consumer in background thread."""
    run_task_sync(task_id, job_id, job_skills, job_seniority, resumes, trace_id, recruiter_id)


def approve_task(task_id: str, decision: str = "approved", note: str = "") -> Optional[dict]:
    task = _TASK_CACHE.get(task_id)
    if not task:
        return None
    if task.get("result"):
        task["result"]["approval_status"] = decision
    task["status"] = "completed"
    task["approval_status"] = decision
    task["updated_at"] = datetime.now(timezone.utc).isoformat()
    if note:
        task["approval_note"] = note

    # Record approval in metrics for evaluation
    task.setdefault("metrics", {})["approval_decision"] = decision

    _append_step(task, "human_approval", decision, {"note": note})

    publish_ai_result(
        task_id=task_id,
        trace_id=task["trace_id"],
        step="human_approval",
        status=decision,
        payload={"note": note},
        actor_id=task.get("recruiter_id"),
    )
    return task


def get_task(task_id: str) -> Optional[dict]:
    return _TASK_CACHE.get(task_id)


async def get_task_async(task_id: str) -> Optional[dict]:
    task = _TASK_CACHE.get(task_id)
    if task:
        return task
    return await _load_task_mongo(task_id)

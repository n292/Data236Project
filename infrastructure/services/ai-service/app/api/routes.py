"""AI Service HTTP API.

New in this revision:
- POST /ai/submit-task  — publishes to ai.requests (Kafka-orchestrated path)
- GET  /ai/task-stream/{task_id}  — SSE stream of step progress
- GET  /ai/metrics  — evaluation metrics across all tasks
- GET  /ai/metrics/{task_id}  — per-task evaluation metrics
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.resume_parser import parse_resume
from app.services.job_matcher import rank_candidates, compute_match_score
from app.services.hiring_assistant import (
    create_task,
    run_task_sync,
    approve_task,
    get_task_async,
)

router = APIRouter()


# ── Request models ───────────────────────────────────────────────────────────

class ResumeParseRequest(BaseModel):
    resume_text: str


class MatchRequest(BaseModel):
    candidate_skills: list[str]
    job_skills: list[str]
    seniority_match: bool = True


class HiringTaskRequest(BaseModel):
    job_id: str
    job_skills: list[str]
    job_seniority: Optional[str] = None
    resumes: list[dict]
    recruiter_id: Optional[str] = None
    trace_id: Optional[str] = None


class ApproveRequest(BaseModel):
    decision: str = "approved"  # approved | rejected
    note: str = ""


class CareerCoachRequest(BaseModel):
    member_skills: list[str]
    headline: str = ""
    target_job: str
    target_skills: list[str]
    years_experience: Optional[int] = None


# ── Skills endpoints ─────────────────────────────────────────────────────────

@router.post("/ai/parse-resume")
def parse_resume_endpoint(req: ResumeParseRequest):
    result = parse_resume(req.resume_text)
    return {"success": True, "parsed": result}


@router.post("/ai/match-job")
def match_job_endpoint(req: MatchRequest):
    result = compute_match_score(req.candidate_skills, req.job_skills, req.seniority_match)
    return {"success": True, "match": result}


# ── Synchronous hiring task (HTTP-only path) ─────────────────────────────────

@router.post("/ai/hiring-task")
def create_hiring_task(req: HiringTaskRequest):
    """HTTP-only path: create + run synchronously, persist to MongoDB."""
    trace_id = req.trace_id or str(uuid.uuid4())
    task_id = create_task(
        req.job_id, req.job_skills, req.job_seniority, req.resumes,
        trace_id=trace_id, recruiter_id=req.recruiter_id,
    )
    result = run_task_sync(
        task_id, req.job_id, req.job_skills, req.job_seniority,
        req.resumes, trace_id=trace_id, recruiter_id=req.recruiter_id,
    )
    return {"success": True, "task": result}


# ── Kafka-orchestrated path ──────────────────────────────────────────────────

@router.post("/ai/submit-task")
def submit_task_kafka(req: HiringTaskRequest):
    """Publishes the request to ai.requests. Supervisor picks it up via Kafka consumer.
    Returns task_id immediately — client polls GET /ai/hiring-task/{task_id} or uses SSE.
    """
    trace_id = req.trace_id or str(uuid.uuid4())
    task_id = create_task(
        req.job_id, req.job_skills, req.job_seniority, req.resumes,
        trace_id=trace_id, recruiter_id=req.recruiter_id,
    )

    topic = os.getenv("KAFKA_TOPIC_AI_REQUESTS", "ai.requests")
    brokers = os.getenv("KAFKA_BROKERS", "")

    if brokers:
        try:
            from kafka import KafkaProducer as _KP
            p = _KP(
                bootstrap_servers=brokers.split(","),
                value_serializer=lambda v: json.dumps(v).encode(),
                key_serializer=lambda k: k.encode() if k else None,
            )
            envelope = {
                "event_type": "ai.request",
                "trace_id": trace_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "actor_id": req.recruiter_id or task_id,
                "entity": {"entity_type": "ai_task", "entity_id": task_id},
                "payload": {
                    "task_id": task_id,
                    "job_id": req.job_id,
                    "job_skills": req.job_skills,
                    "job_seniority": req.job_seniority,
                    "resumes": req.resumes,
                },
                "idempotency_key": task_id,
            }
            p.send(topic, key=task_id, value=envelope)
            p.flush()
            p.close()
        except Exception as exc:
            print(f"[submit-task] Kafka publish failed, running inline: {exc}")
            run_task_sync(
                task_id, req.job_id, req.job_skills, req.job_seniority,
                req.resumes, trace_id=trace_id, recruiter_id=req.recruiter_id,
            )
    else:
        # No Kafka — run inline
        run_task_sync(
            task_id, req.job_id, req.job_skills, req.job_seniority,
            req.resumes, trace_id=trace_id, recruiter_id=req.recruiter_id,
        )

    return {"success": True, "task_id": task_id, "trace_id": trace_id}


# ── SSE task progress stream ─────────────────────────────────────────────────

@router.get("/ai/task-stream/{task_id}")
async def task_stream(task_id: str):
    """SSE endpoint — streams step-by-step progress to the recruiter UI.

    Sends an event for each new step discovered since the last poll,
    then a final 'done' event when the task reaches a terminal state.
    """
    async def generate():
        last_step_count = 0
        for _ in range(120):  # max 60s (120 × 0.5s)
            task = await get_task_async(task_id)
            if task is None:
                yield {"event": "error", "data": json.dumps({"error": "task not found"})}
                return

            steps = task.get("steps", [])
            new_steps = steps[last_step_count:]
            for step in new_steps:
                yield {
                    "event": "step",
                    "data": json.dumps({
                        "task_id": task_id,
                        "trace_id": task.get("trace_id"),
                        "step": step["step"],
                        "status": step["status"],
                        "timestamp": step["timestamp"],
                        "data": step.get("data", {}),
                    }),
                }
            last_step_count = len(steps)

            status = task.get("status")
            if status in ("completed", "awaiting_approval", "failed"):
                yield {
                    "event": "done",
                    "data": json.dumps({
                        "task_id": task_id,
                        "status": status,
                        "metrics": task.get("metrics", {}),
                        "requires_approval": task.get("requires_approval", False),
                    }),
                }
                return

            await asyncio.sleep(0.5)

        yield {"event": "timeout", "data": json.dumps({"task_id": task_id})}

    return EventSourceResponse(generate())


# ── Task fetch / approval ────────────────────────────────────────────────────

@router.get("/ai/hiring-task/{task_id}")
async def get_hiring_task(task_id: str):
    task = await get_task_async(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task": task}


@router.post("/ai/hiring-task/{task_id}/approve")
def approve_hiring_task(task_id: str, body: ApproveRequest = ApproveRequest()):
    task = approve_task(task_id, decision=body.decision, note=body.note)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task": task}


@router.post("/ai/career-coach")
def career_coach_endpoint(req: CareerCoachRequest):
    from app.services.career_coach import analyze_career_fit
    result = analyze_career_fit(
        req.member_skills, req.headline, req.target_job,
        req.target_skills, req.years_experience,
    )
    return {"success": True, "analysis": result}


@router.post("/ai/rank-candidates")
def rank_candidates_endpoint(req: HiringTaskRequest):
    ranked = rank_candidates(req.resumes, req.job_skills, req.job_seniority)
    return {"success": True, "ranked": ranked}


# ── Evaluation metrics ───────────────────────────────────────────────────────

@router.get("/ai/metrics")
async def get_all_metrics():
    """Aggregate evaluation metrics across all tasks stored in MongoDB."""
    try:
        from app.db.mongo import get_db
        db = get_db()
        tasks = await db["ai_tasks"].find(
            {}, {"task_id": 1, "metrics": 1, "status": 1, "created_at": 1, "_id": 0}
        ).to_list(length=500)

        total = len(tasks)
        completed = [t for t in tasks if t.get("status") == "completed"]
        awaiting = [t for t in tasks if t.get("status") == "awaiting_approval"]
        approved = [t for t in tasks if t.get("metrics", {}).get("approval_decision") == "approved"]
        rejected = [t for t in tasks if t.get("metrics", {}).get("approval_decision") == "rejected"]

        avg_top_score = (
            round(sum(t.get("metrics", {}).get("top_score", 0) for t in tasks) / total, 1)
            if total else 0
        )

        return {
            "total_tasks": total,
            "completed": len(completed),
            "awaiting_approval": len(awaiting),
            "approval_rate": round(len(approved) / (len(approved) + len(rejected)), 3)
            if (approved or rejected) else None,
            "avg_top_score": avg_top_score,
            "tasks": tasks,
        }
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.get("/ai/metrics/{task_id}")
async def get_task_metrics(task_id: str):
    task = await get_task_async(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {
        "task_id": task_id,
        "status": task.get("status"),
        "metrics": task.get("metrics", {}),
        "steps": [{"step": s["step"], "status": s["status"], "ts": s["timestamp"]}
                  for s in task.get("steps", [])],
        "trace_id": task.get("trace_id"),
    }

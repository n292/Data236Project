"""Shortlist API routes.

POST /ai/tasks/create
GET  /ai/tasks/{task_id}
GET  /ai/tasks/{task_id}/results
POST /ai/tasks/{task_id}/approve
POST /ai/tasks/{task_id}/edit-and-approve
POST /ai/tasks/{task_id}/reject
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.shortlist import (
    ApprovalRequest,
    ApproveCandidateRequest,
    EditAndApproveRequest,
    RejectCandidateRequest,
    RejectRequest,
    ShortlistTaskCreateRequest,
)
from app.services import shortlist_service

router = APIRouter()


@router.post("/ai/tasks/create")
async def create_shortlist_task(req: ShortlistTaskCreateRequest):
    """Create an AI shortlist task and start the pipeline in the background."""
    task_id = await shortlist_service.create_task(req)
    shortlist_service.launch_pipeline(task_id, req)
    return {
        "success": True,
        "task_id": task_id,
        "status": "requested",
        "job_id": req.job_id,
        "top_n": req.top_n,
    }


@router.get("/ai/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Return task metadata and current status (poll-friendly)."""
    task = await shortlist_service.load_task(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {
        "success": True,
        "task": {
            "task_id": task["task_id"],
            "status": task["status"],
            "job_id": task["job_id"],
            "recruiter_id": task.get("recruiter_id"),
            "top_n": task.get("top_n"),
            "created_at": task["created_at"],
            "updated_at": task["updated_at"],
            "steps": task.get("steps", []),
            "all_candidates_count": task.get("all_candidates_count", 0),
            "shortlist_count": len(task.get("shortlist", [])),
            "metrics": task.get("metrics", {}),
            "approval_status": task.get("approval_status", "pending"),
            "error": task.get("error"),
        },
    }


@router.get("/ai/tasks/{task_id}/results")
async def get_task_results(task_id: str):
    """Return the full shortlist with scores, explanations, and outreach drafts."""
    task = await shortlist_service.load_task(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {
        "success": True,
        "task_id": task_id,
        "job_id": task["job_id"],
        "status": task["status"],
        "metrics": task.get("metrics", {}),
        "all_candidates_count": task.get("all_candidates_count", 0),
        "shortlist": task.get("shortlist", []),
        "approval_status": task.get("approval_status", "pending"),
    }


@router.post("/ai/tasks/{task_id}/approve")
async def approve_task(task_id: str, body: ApprovalRequest = ApprovalRequest()):
    """Approve the entire shortlist (all pending outreach drafts become approved)."""
    task = await shortlist_service.approve_task(task_id, note=body.note)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task_id": task_id, "approval_status": task.get("approval_status")}


@router.post("/ai/tasks/{task_id}/edit-and-approve")
async def edit_and_approve(task_id: str, body: EditAndApproveRequest):
    """Save an edited outreach draft for one candidate and mark them approved."""
    task = await shortlist_service.edit_and_approve(
        task_id,
        candidate_id=body.candidate_id,
        edited_subject=body.edited_subject,
        edited_message=body.edited_message,
        note=body.note,
    )
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task_id": task_id, "status": task.get("status")}


@router.post("/ai/tasks/{task_id}/reject")
async def reject_task(task_id: str, body: RejectRequest = RejectRequest()):
    """Reject the shortlist (recruiter decided not to proceed)."""
    task = await shortlist_service.reject_task(task_id, reason=body.reason)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task_id": task_id, "approval_status": task.get("approval_status")}


@router.post("/ai/tasks/{task_id}/approve-candidate")
async def approve_candidate(task_id: str, body: ApproveCandidateRequest):
    """Approve a single candidate and send their outreach message."""
    task = await shortlist_service.approve_candidate(task_id, candidate_id=body.candidate_id, note=body.note)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task_id": task_id, "candidate_id": body.candidate_id}


@router.post("/ai/tasks/{task_id}/reject-candidate")
async def reject_candidate(task_id: str, body: RejectCandidateRequest):
    """Reject a single candidate without affecting others."""
    task = await shortlist_service.reject_candidate(task_id, candidate_id=body.candidate_id, reason=body.reason)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return {"success": True, "task_id": task_id, "candidate_id": body.candidate_id}

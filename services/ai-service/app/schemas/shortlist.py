"""Pydantic schemas for the AI Shortlist feature."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────────────

class ShortlistTaskCreateRequest(BaseModel):
    job_id: str
    recruiter_id: str
    top_n: int = Field(default=5, ge=1, le=20)
    include_outreach: bool = True


class ApprovalRequest(BaseModel):
    note: str = ""


class EditAndApproveRequest(BaseModel):
    candidate_id: str
    edited_subject: Optional[str] = None
    edited_message: str
    note: str = ""


class RejectRequest(BaseModel):
    reason: str = ""


class ApproveCandidateRequest(BaseModel):
    candidate_id: str
    note: str = ""


class RejectCandidateRequest(BaseModel):
    candidate_id: str
    reason: str = ""


# ── Score breakdown ──────────────────────────────────────────────────────────

class CandidateScoreBreakdown(BaseModel):
    skills_score: float       # 0-40
    seniority_score: float    # 0-20
    experience_score: float   # 0-15
    location_score: float     # 0-15
    bonus_score: float        # 0-10
    total_score: float        # 0-100


# ── LLM output schemas (also used as structured output targets) ──────────────

class CandidateExplanation(BaseModel):
    summary: str
    reasons: list[str]


class OutreachDraft(BaseModel):
    subject: str
    intro: str
    why_fit: str
    full_message: str


# ── Per-candidate recommendation ─────────────────────────────────────────────

class CandidateRecommendation(BaseModel):
    candidate_id: str
    job_id: str
    match_score: float
    score_breakdown: CandidateScoreBreakdown
    matched_skills: list[str]
    missing_skills: list[str]
    seniority_fit: str          # strong_fit | good_fit | partial_fit | weak_fit
    location_fit: str           # same_city | same_state | same_country | remote_eligible | different_location | unknown
    experience_years: Optional[int]
    inferred_seniority: str
    candidate_name: str
    candidate_email: Optional[str]
    candidate_explanation: Optional[CandidateExplanation]
    outreach_draft: Optional[OutreachDraft]
    edited_outreach: Optional[OutreachDraft] = None
    approval_status: str = "pending"   # pending | approved | edited_approved | rejected


# ── Task-level response shapes ────────────────────────────────────────────────

class ShortlistTaskResponse(BaseModel):
    task_id: str
    status: str
    job_id: str
    recruiter_id: str
    top_n: int
    created_at: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    created_at: str
    updated_at: str
    error: Optional[str] = None
    steps: list[dict] = []


class TaskResultResponse(BaseModel):
    task_id: str
    job_id: str
    status: str
    metrics: dict
    shortlist: list[CandidateRecommendation]
    all_candidates_count: int
    approval_status: str

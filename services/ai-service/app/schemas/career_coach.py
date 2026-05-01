"""Pydantic schemas for the Career Coach feature."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class CareerCoachAnalyzeRequest(BaseModel):
    member_id: str
    job_id: str
    resume_text: Optional[str] = None   # extracted from uploaded PDF on the frontend


class CareerCoachSuggestion(BaseModel):
    type: str        # skill_gap | headline | highlight | about | differentiator | experience
    suggestion: str  # actionable suggestion text
    rationale: str   # why this matters for the specific role


class CareerCoachLLMOutput(BaseModel):
    """Structured output target for the LLM chain."""
    strengths: list[str]
    improvement_areas: list[str]
    suggestions: list[CareerCoachSuggestion]
    headline_rewrite: Optional[str] = None
    about_rewrite: Optional[str] = None


class CareerCoachResponse(BaseModel):
    member_id: str
    job_id: str
    job_title: str
    company_name: str
    # Deterministic skill metrics
    skill_match_pct: int
    overall_rating: str     # "Strong Fit" | "Moderate Fit" | "Needs Work"
    matched_skills: list[str]
    missing_skills: list[str]
    bonus_skills: list[str]
    target_skill_count: int
    # LLM outputs
    strengths: list[str]
    improvement_areas: list[str]
    suggestions: list[dict]
    headline_rewrite: Optional[str] = None
    about_rewrite: Optional[str] = None

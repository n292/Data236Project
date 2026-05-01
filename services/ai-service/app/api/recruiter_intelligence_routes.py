"""Recruiter Intelligence — AI-powered insights on job postings and pipeline."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter()


# ── Schema ──────────────────────────────────────────────────────────────────

class JobSummary(BaseModel):
    job_id: str
    title: str
    location: Optional[str] = None
    status: Optional[str] = None
    applicants: int = 0
    views: int = 0
    salary_min: Any = None
    salary_max: Any = None
    employment_type: Optional[str] = None
    seniority_level: Optional[str] = None
    remote: Optional[str] = None
    skills: Optional[list[str]] = None
    posted_datetime: Optional[str] = None
    description_snippet: Optional[str] = None


class RecruiterIntelligenceRequest(BaseModel):
    recruiter_id: str
    jobs: list[JobSummary]
    analytics: Any = None
    ai_metrics: Any = None


class RecruiterIntelligenceResponse(BaseModel):
    insights: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _days_ago(dt_str: Optional[str]) -> Optional[int]:
    if not dt_str:
        return None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return None


def _salary_label(min_val: Any, max_val: Any) -> str:
    try:
        lo = int(float(min_val)) if min_val else None
        hi = int(float(max_val)) if max_val else None
        if lo and hi:
            return f"${lo:,} – ${hi:,}"
        if lo:
            return f"${lo:,}+"
        if hi:
            return f"up to ${hi:,}"
    except Exception:
        pass
    return "not listed"


def _build_context(req: RecruiterIntelligenceRequest) -> str:
    """Build a rich, pre-computed context string for the LLM prompt."""
    lines: list[str] = []
    lines.append(f"Total active job postings: {len(req.jobs)}")

    for j in req.jobs:
        days = _days_ago(j.posted_datetime)
        age = f"{days} days ago" if days is not None else "unknown date"
        conv = "—"
        if j.views > 0:
            pct = round((j.applicants / j.views) * 100, 1)
            conv = f"{pct}% ({j.applicants}/{j.views})"
        salary = _salary_label(j.salary_min, j.salary_max)
        remote_label = {"remote": "Remote", "hybrid": "Hybrid", "onsite": "On-site"}.get(
            (j.remote or "onsite").lower(), j.remote or "On-site"
        )
        skills_str = ", ".join((j.skills or [])[:8]) or "none listed"
        lines.append(
            f"\nJob: {j.title!r}"
            f"\n  Status: {j.status or 'open'} | Posted: {age}"
            f"\n  Location: {j.location or 'unspecified'} | Work mode: {remote_label}"
            f"\n  Seniority: {j.seniority_level or 'not specified'} | Type: {j.employment_type or 'Full-time'}"
            f"\n  Salary: {salary}"
            f"\n  Views: {j.views} | Applicants: {j.applicants} | Conversion: {conv}"
            f"\n  Required skills: {skills_str}"
        )

    if req.analytics:
        top = req.analytics.get("top_jobs") or []
        low = req.analytics.get("low_traction") or []
        if top:
            lines.append(f"\nTop performing jobs (by applicants): {[t.get('job_id') for t in top[:3]]}")
        if low:
            lines.append(f"Low-traction jobs (≤2 applicants): {[t.get('job_id') for t in low[:5]]}")

    if req.ai_metrics:
        lines.append(
            f"\nAI Shortlist stats — tasks run: {req.ai_metrics.get('total_tasks', 0)}, "
            f"avg top score: {req.ai_metrics.get('avg_top_score', '—')}, "
            f"approval rate: {req.ai_metrics.get('approval_rate', '—')}"
        )

    return "\n".join(lines)


_SYSTEM = """\
You are a senior talent acquisition strategist with deep expertise in recruiting analytics.
You are reviewing a recruiter's job postings and giving them a frank, specific briefing.

Your output must be structured as exactly 5 sections, each starting with a bold header:

**1. Pipeline Health**
Assess overall applicant volume and conversion rates. Call out any job with a view-to-applicant conversion below 3% or zero applicants. Be specific — name the job titles.

**2. Jobs Needing Immediate Action**
List any jobs that are underperforming (high views but few applicants, or posted 30+ days with <3 applicants). For each one, give ONE concrete fix: rewrite the title, add remote option, adjust salary, etc.

**3. Salary & Competitiveness**
Flag any jobs where the salary range looks low for the role, seniority, or location. Suggest a specific range adjustment if needed.

**4. Posting Quality & Skills**
Comment on roles with vague skill requirements or mismatched seniority/employment type combos. Suggest improvements.

**5. Next Steps**
Give exactly 3 prioritised actions the recruiter should take this week, ordered by impact.

Rules:
- Always name specific job titles, never say "one of your jobs"
- Use numbers from the data (views, applicants, conversion %)
- Be concise — max 280 words total
- No fluff, no generic advice that would apply to any recruiter
"""


_FALLBACK = """\
**1. Pipeline Health**
• Unable to generate live analysis — using baseline recommendations based on your job count.

**2. Jobs Needing Immediate Action**
• Review any job with 0 applicants after 7+ days — update the title to match common search terms.
• Jobs with >50 views but <2 applicants likely have a description or salary mismatch.

**3. Salary & Competitiveness**
• Benchmark salaries against current market rates for each role's location and seniority level.
• Missing salary ranges reduce applicant conversion by an estimated 20-30%.

**4. Posting Quality & Skills**
• Keep required skills lists to 5–8 items max — long lists deter qualified candidates.
• Ensure seniority level matches years of experience mentioned in the description.

**5. Next Steps**
1. Add salary ranges to any jobs that are missing them.
2. Repost or refresh job titles on roles open for 30+ days with low applicants.
3. Run the AI Shortlist tool on your highest-volume role to speed up candidate review.
"""


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/ai/recruiter-intelligence/analyze", response_model=RecruiterIntelligenceResponse)
async def analyze_recruiter_intelligence(req: RecruiterIntelligenceRequest):
    import asyncio

    context = _build_context(req)

    def _run_llm() -> str:
        try:
            from app.llm.factory import get_llm
            from langchain_core.messages import HumanMessage, SystemMessage

            llm = get_llm()
            messages = [
                SystemMessage(content=_SYSTEM),
                HumanMessage(content=f"Here is the recruiter's data:\n\n{context}"),
            ]
            result = llm.invoke(messages)
            text = result.content if hasattr(result, "content") else str(result)
            return text.strip() if text.strip() else _FALLBACK
        except Exception as exc:
            log.warning("Recruiter intelligence LLM failed: %s — using fallback", exc)
            return _FALLBACK

    insights = await asyncio.get_event_loop().run_in_executor(None, _run_llm)
    return RecruiterIntelligenceResponse(insights=insights)

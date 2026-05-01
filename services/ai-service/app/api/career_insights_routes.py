"""Career Insights — AI-powered career coaching for members."""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter()


# ── Schema ────────────────────────────────────────────────────────────────────

class StatusItem(BaseModel):
    status: str
    count: int


class RecentApp(BaseModel):
    job_id: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None


class CareerInsightsRequest(BaseModel):
    member_id: str
    profile_views_last_30d: int = 0
    views_by_day: Any = None
    total_applications: int = 0
    accepted_applications: int = 0
    application_status_breakdown: list[StatusItem] = []
    recent_applications: list[RecentApp] = []


class CareerInsightsResponse(BaseModel):
    insights: str


# ── Context builder ───────────────────────────────────────────────────────────

def _build_context(req: CareerInsightsRequest) -> str:
    lines: list[str] = []
    lines.append(f"Profile views in last 30 days: {req.profile_views_last_30d}")
    lines.append(f"Total applications submitted: {req.total_applications}")
    lines.append(f"Accepted applications: {req.accepted_applications}")

    if req.total_applications > 0:
        rate = round((req.accepted_applications / req.total_applications) * 100, 1)
        lines.append(f"Acceptance rate: {rate}%")

    if req.application_status_breakdown:
        lines.append("\nApplication status breakdown:")
        for item in req.application_status_breakdown:
            lines.append(f"  {item.status}: {item.count}")

    if req.recent_applications:
        lines.append(f"\nMost recent {len(req.recent_applications)} applications:")
        for app in req.recent_applications:
            jid = (app.job_id or "")[:8] or "unknown"
            lines.append(f"  - Job {jid}: {app.status or 'unknown'} on {app.date or 'unknown date'}")

    return "\n".join(lines)


# ── Prompts ───────────────────────────────────────────────────────────────────

_SYSTEM = """\
You are a warm, direct LinkedIn career coach reviewing a job seeker's activity dashboard.
Give them a frank, personalised briefing based on their actual numbers.

Your output must be structured as exactly 4 sections, each starting with a bold header:

**1. Profile Visibility**
Comment on their profile view count. Is it high, low, or typical for an active job seeker?
If views are low (under 20 in 30 days), give one specific action to boost visibility.

**2. Application Performance**
Assess their acceptance rate and volume using the actual numbers.
Call out if they are applying too broadly (many apps, low acceptance) or too narrowly (very few apps).

**3. Pipeline Status**
Break down where applications are sitting. If most are stuck in "submitted" with no movement, flag it.
Highlight any positive signals (reviews, interviews, offers, acceptances).

**4. Your 3 Actions This Week**
Give exactly 3 prioritised, specific actions, ordered by impact.
Make them concrete — not generic advice.

Rules:
- Speak directly as "you" — never say "the member" or "the data"
- Use the actual numbers from the dashboard in every section
- Be warm but honest — don't sugarcoat a weak pipeline
- Max 230 words total
- No filler openers like "Great job!" or "Keep it up!"
"""

_FALLBACK = """\
**1. Profile Visibility**
• Profile view data isn't available right now. Consistently engaging with posts and keeping your headline updated typically doubles views within 2 weeks.

**2. Application Performance**
• Aim for quality over quantity — 5 tailored applications outperform 20 generic ones.
• A healthy acceptance rate benchmark is 10%+; below that, focus on resume and cover letter alignment.

**3. Pipeline Status**
• If applications are sitting in "submitted" for more than 3 weeks without movement, consider following up directly or refreshing your resume before reapplying.

**4. Your 3 Actions This Week**
1. Update your headline and summary with keywords from job descriptions you're targeting.
2. Apply to 3–5 new roles with tailored cover letters referencing specific job requirements.
3. Withdraw any stale applications (30+ days, no response) and reapply with an updated resume.
"""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/ai/career-insights/analyze", response_model=CareerInsightsResponse)
async def analyze_career_insights(req: CareerInsightsRequest):
    import asyncio

    context = _build_context(req)

    def _run_llm() -> str:
        try:
            from app.llm.factory import get_llm
            from langchain_core.messages import HumanMessage, SystemMessage

            llm = get_llm()
            messages = [
                SystemMessage(content=_SYSTEM),
                HumanMessage(content=f"Here is the member's dashboard data:\n\n{context}"),
            ]
            result = llm.invoke(messages)
            text = result.content if hasattr(result, "content") else str(result)
            return text.strip() if text.strip() else _FALLBACK
        except Exception as exc:
            log.warning("Career insights LLM failed: %s — using fallback", exc)
            return _FALLBACK

    insights = await asyncio.get_event_loop().run_in_executor(None, _run_llm)
    return CareerInsightsResponse(insights=insights)

"""LangChain chain: generate a recruiter outreach draft.

Falls back to a deterministic template when the LLM is unavailable or fails.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.llm.prompts.outreach import OUTREACH_PROMPT
from app.schemas.shortlist import OutreachDraft

log = logging.getLogger(__name__)


def _first_name(full_name: str) -> str:
    return (full_name or "there").split()[0]


def _fallback(candidate: dict, job: dict, score_data: dict, explanation_summary: str) -> OutreachDraft:
    name = candidate.get("candidate_name") or candidate.get("name") or "Candidate"
    fname = _first_name(name)
    job_title = job.get("title", "the open role")
    company = job.get("company_name", "our company")
    matched = score_data.get("matched_skills", [])
    skills_str = ", ".join(matched[:3]) if matched else "your technical background"

    subject = f"Opportunity at {company}: {job_title}"
    intro = f"Hi {fname}, I came across your profile and wanted to reach out about an exciting opportunity."
    why_fit = (
        f"Your experience with {skills_str} stands out as a strong match for our {job_title} opening at {company}. "
        f"{explanation_summary}"
    )
    full_message = (
        f"{intro}\n\n"
        f"{why_fit}\n\n"
        "We'd love to learn more about your background and share details about the role. "
        "Would you be open to a brief call this week?\n\n"
        "Best regards"
    )
    return OutreachDraft(subject=subject, intro=intro, why_fit=why_fit, full_message=full_message)


def generate_outreach(
    candidate: dict,
    job: dict,
    score_data: dict,
    explanation_summary: str,
) -> OutreachDraft:
    """Generate a recruiter outreach draft for one candidate.

    Uses Gemini via LangChain with structured output; falls back to a template.
    """
    name = candidate.get("candidate_name") or candidate.get("name") or candidate.get("member_id", "Candidate")
    try:
        from app.llm.factory import get_llm
        llm = get_llm()
        structured = llm.with_structured_output(OutreachDraft)
        chain = OUTREACH_PROMPT | structured

        result = chain.invoke({
            "job_title": job.get("title", "the open role"),
            "company_name": job.get("company_name", "our company"),
            "job_location": job.get("location", "not specified"),
            "candidate_name": name,
            "matched_skills": ", ".join(score_data.get("matched_skills", [])) or "relevant skills",
            "seniority_fit": score_data.get("seniority_fit", "unknown"),
            "location_fit": score_data.get("location_fit", "unknown"),
            "experience_years": score_data.get("experience_years") or "unknown",
            "explanation_summary": explanation_summary,
        })

        if isinstance(result, OutreachDraft):
            return result
        if isinstance(result, dict):
            return OutreachDraft(**result)

    except Exception as exc:
        log.warning("LLM outreach failed for %s: %s — using fallback",
                    candidate.get("member_id", "?"), exc)

    return _fallback(candidate, job, score_data, explanation_summary)

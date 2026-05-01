"""LangChain chain: generate career coaching output from profile + job data.

Falls back to deterministic suggestions when the LLM is unavailable.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.llm.prompts.career_coach import CAREER_COACH_PROMPT
from app.schemas.career_coach import CareerCoachLLMOutput, CareerCoachSuggestion

log = logging.getLogger(__name__)


def _fallback(
    matched_skills: list[str],
    missing_skills: list[str],
    bonus_skills: list[str],
    member_ctx: dict,
    job_ctx: dict,
) -> CareerCoachLLMOutput:
    suggestions: list[CareerCoachSuggestion] = []

    if missing_skills:
        suggestions.append(CareerCoachSuggestion(
            type="skill_gap",
            suggestion=f"Learn {', '.join(missing_skills[:3])} to close your top skill gaps for this role.",
            rationale="These are required skills you don't have listed on your profile.",
        ))

    headline = member_ctx.get("headline", "")
    job_title = job_ctx.get("title", "")
    if job_title.lower() not in headline.lower():
        suggestions.append(CareerCoachSuggestion(
            type="headline",
            suggestion=f'Update your headline to include "{job_title}" or relevant keywords.',
            rationale="Recruiters filter by title — a matching headline boosts visibility.",
        ))

    if matched_skills:
        suggestions.append(CareerCoachSuggestion(
            type="highlight",
            suggestion=f"Highlight {', '.join(matched_skills[:3])} prominently in your experience.",
            rationale="You already have these required skills — make sure they're easy to spot.",
        ))

    if bonus_skills:
        suggestions.append(CareerCoachSuggestion(
            type="differentiator",
            suggestion=f"Mention {', '.join(bonus_skills[:2])} in your summary as differentiating skills.",
            rationale="Extra skills show breadth and may appeal to broader team needs.",
        ))

    strengths = [f"Proficient in {s}" for s in matched_skills[:3]] or ["Profile shows relevant industry experience"]
    improvement_areas = [f"Missing required skill: {s}" for s in missing_skills[:3]] or ["Expand skill set to match job requirements"]

    return CareerCoachLLMOutput(
        strengths=strengths,
        improvement_areas=improvement_areas,
        suggestions=suggestions,
        headline_rewrite=None,
        about_rewrite=None,
    )


def generate_coaching(
    member_ctx: dict,
    job_ctx: dict,
    matched_skills: list[str],
    missing_skills: list[str],
    bonus_skills: list[str],
    skill_match_pct: int,
    inferred_seniority: str,
    experience_years: Optional[int],
) -> CareerCoachLLMOutput:
    """Generate LLM-powered career coaching suggestions.

    Runs synchronously — call via run_in_executor from async context.
    """
    try:
        from app.llm.factory import get_llm
        llm = get_llm()
        structured = llm.with_structured_output(CareerCoachLLMOutput)
        chain = CAREER_COACH_PROMPT | structured

        result = chain.invoke({
            "job_title": job_ctx.get("title", "this role"),
            "company_name": job_ctx.get("company_name", "the company"),
            "job_seniority": job_ctx.get("seniority_level") or "not specified",
            "job_location": job_ctx.get("location") or "not specified",
            "job_description": (job_ctx.get("description") or "")[:800],
            "job_skills": ", ".join(job_ctx.get("_job_skills_display", [])) or "not specified",
            "member_headline": member_ctx.get("headline") or "not provided",
            "member_about": (member_ctx.get("about_summary") or "not provided")[:400],
            "member_skills": ", ".join(member_ctx.get("skills_list", [])) or "none listed",
            "experience_years": experience_years if experience_years is not None else "unknown",
            "inferred_seniority": inferred_seniority,
            "matched_count": len(matched_skills),
            "missing_count": len(missing_skills),
            "matched_skills": ", ".join(matched_skills) or "none",
            "missing_skills": ", ".join(missing_skills) or "none",
            "bonus_skills": ", ".join(bonus_skills[:6]) or "none",
            "skill_match_pct": skill_match_pct,
        })

        if isinstance(result, CareerCoachLLMOutput):
            return result
        if isinstance(result, dict):
            return CareerCoachLLMOutput(**result)

    except Exception as exc:
        log.warning("Career coach LLM failed: %s — using fallback", exc)

    return _fallback(matched_skills, missing_skills, bonus_skills, member_ctx, job_ctx)

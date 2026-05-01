"""Career Coach service — async orchestrator.

Fetches job + member data, computes deterministic skill metrics,
then runs the LLM chain in a thread executor.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from app.services import data_fetcher
from app.services.scoring_service import (
    _extract_skills_from_text,
    _normalise_skills,
    _extract_years,
    _infer_seniority,
)

log = logging.getLogger(__name__)


def _parse_skills_field(raw) -> list[str]:
    """Normalise skills_required / skills_json which may be list, JSON str, or CSV."""
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(s) for s in raw if s]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(s) for s in parsed if s]
        except Exception:
            pass
        return [s.strip() for s in raw.split(",") if s.strip()]
    return []


async def analyze(member_id: str, job_id: str, resume_text: Optional[str] = None) -> dict:
    """Fetch all data, score deterministically, run LLM, return CareerCoachResponse dict."""

    # ── Fetch job + member profile in parallel ────────────────────────────────
    job, profile = await asyncio.gather(
        data_fetcher.fetch_job(job_id),
        data_fetcher.fetch_member_profile(member_id),
    )

    if not job:
        raise ValueError(f"Job {job_id} not found")
    if not profile:
        raise ValueError(f"Member {member_id} not found")

    # ── Extract member skills ─────────────────────────────────────────────────
    profile_skills_raw = _parse_skills_field(profile.get("skills_json") or profile.get("skills"))
    about_text = profile.get("about_summary") or profile.get("about") or ""
    headline = profile.get("headline") or ""

    # Combine profile text for experience/skill extraction
    experience_json = profile.get("experience_json") or []
    experience_text = ""
    if isinstance(experience_json, list):
        for exp in experience_json:
            if isinstance(exp, dict):
                experience_text += f" {exp.get('title', '')} {exp.get('description', '')}"

    # Include uploaded resume text if provided
    resume_section = resume_text or ""
    combined_member_text = f"{about_text} {experience_text} {headline} {resume_section}"

    skills_from_text = _extract_skills_from_text(combined_member_text)
    all_member_skills_norm = _normalise_skills(skills_from_text + profile_skills_raw)

    years = _extract_years(combined_member_text)
    if years is None and isinstance(experience_json, list):
        years = len(experience_json) if experience_json else None
    inferred_seniority = _infer_seniority(years)

    # ── Extract job skills ────────────────────────────────────────────────────
    job_skills_raw = _parse_skills_field(job.get("skills_required"))
    if not job_skills_raw:
        job_skills_raw = _extract_skills_from_text(job.get("description") or "")
    job_skills_norm = _normalise_skills(job_skills_raw)

    # ── Deterministic skill matching ──────────────────────────────────────────
    matched_norm = sorted(all_member_skills_norm & job_skills_norm)
    missing_norm = sorted(job_skills_norm - all_member_skills_norm)
    bonus_norm = sorted(all_member_skills_norm - job_skills_norm)

    def _display(skills: list[str]) -> list[str]:
        return [s.title().replace("Nodejs", "Node.js").replace("Sql", "SQL").replace("Api", "API") for s in skills]

    matched_display = _display(matched_norm)
    missing_display = _display(missing_norm)
    bonus_display = _display(bonus_norm)

    target_skill_count = len(job_skills_norm)
    skill_match_pct = round(len(matched_norm) / target_skill_count * 100) if target_skill_count else 0

    if skill_match_pct >= 75:
        overall_rating = "Strong Fit"
    elif skill_match_pct >= 45:
        overall_rating = "Moderate Fit"
    else:
        overall_rating = "Needs Work"

    # ── Build context dicts for LLM ───────────────────────────────────────────
    member_ctx = {
        "headline": headline,
        "about_summary": (resume_text or about_text or "")[:600],
        "skills_list": _display(sorted(all_member_skills_norm)),
    }
    job_ctx = {
        "title": job.get("title", ""),
        "company_name": job.get("company_name", ""),
        "seniority_level": job.get("seniority_level"),
        "location": job.get("location"),
        "description": job.get("description") or "",
        "_job_skills_display": _display(sorted(job_skills_norm)),
    }

    # ── LLM chain (run in executor to avoid blocking event loop) ─────────────
    loop = asyncio.get_running_loop()
    from app.llm.chains.career_coach_chain import generate_coaching
    try:
        llm_output = await loop.run_in_executor(
            None,
            generate_coaching,
            member_ctx,
            job_ctx,
            matched_display,
            missing_display,
            bonus_display,
            skill_match_pct,
            inferred_seniority,
            years,
        )
    except Exception as exc:
        log.error("Career coach chain failed: %s", exc)
        from app.llm.chains.career_coach_chain import _fallback
        llm_output = _fallback(matched_display, missing_display, bonus_display, member_ctx, job_ctx)

    return {
        "member_id": member_id,
        "job_id": job_id,
        "job_title": job.get("title", ""),
        "company_name": job.get("company_name", ""),
        "skill_match_pct": skill_match_pct,
        "overall_rating": overall_rating,
        "matched_skills": matched_display,
        "missing_skills": missing_display,
        "bonus_skills": bonus_display,
        "target_skill_count": target_skill_count,
        "strengths": llm_output.strengths,
        "improvement_areas": llm_output.improvement_areas,
        "suggestions": [s.model_dump() for s in llm_output.suggestions],
        "headline_rewrite": llm_output.headline_rewrite,
        "about_rewrite": llm_output.about_rewrite,
    }

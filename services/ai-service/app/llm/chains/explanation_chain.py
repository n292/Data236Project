"""LangChain chain: generate a candidate explanation from scored data.

Falls back to a deterministic summary when the LLM is unavailable or fails.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.llm.prompts.explanation import EXPLANATION_PROMPT
from app.schemas.shortlist import CandidateExplanation

log = logging.getLogger(__name__)


def _fallback(candidate: dict, score_data: dict) -> CandidateExplanation:
    matched = score_data.get("matched_skills", [])
    years = score_data.get("experience_years")
    sfit = score_data.get("seniority_fit", "")
    score = score_data.get("match_score", 0)

    reasons: list[str] = []
    if matched:
        reasons.append(f"Matches {len(matched)} required skill(s): {', '.join(matched[:3])}")
    if years is not None:
        reasons.append(f"Estimated {years} year(s) of relevant experience")
    if sfit in ("strong_fit", "good_fit"):
        reasons.append(f"Seniority level: {sfit.replace('_', ' ')}")
    loc = score_data.get("location_fit", "")
    if loc in ("same_city", "same_state", "remote_eligible"):
        reasons.append(f"Location: {loc.replace('_', ' ')}")
    if not reasons:
        reasons = [f"Overall match score: {score}/100"]

    summary = (
        f"Candidate scored {score}/100 overall. "
        + (f"Matches {len(matched)} required skill(s). " if matched else "")
        + (f"Approximately {years} year(s) of experience." if years else "")
    ).strip()

    return CandidateExplanation(summary=summary, reasons=reasons)


def generate_explanation(
    candidate: dict,
    job: dict,
    score_data: dict,
) -> CandidateExplanation:
    """Generate a recruiter-facing explanation for one candidate.

    Uses Gemini via LangChain with structured output; falls back to heuristics.
    """
    try:
        from app.llm.factory import get_llm
        llm = get_llm()
        structured = llm.with_structured_output(CandidateExplanation)
        chain = EXPLANATION_PROMPT | structured

        result = chain.invoke({
            "job_title": job.get("title", "this role"),
            "company_name": job.get("company_name", "our company"),
            "job_skills": ", ".join(score_data.get("matched_skills", []) + score_data.get("missing_skills", [])) or "not specified",
            "job_seniority": job.get("seniority_level", "not specified"),
            "job_location": job.get("location", "not specified"),
            "candidate_name": candidate.get("candidate_name") or candidate.get("name") or candidate.get("member_id", "Candidate"),
            "match_score": score_data.get("match_score", 0),
            "skills_score": score_data.get("score_breakdown", {}).get("skills_score", 0),
            "seniority_score": score_data.get("score_breakdown", {}).get("seniority_score", 0),
            "experience_score": score_data.get("score_breakdown", {}).get("experience_score", 0),
            "location_score": score_data.get("score_breakdown", {}).get("location_score", 0),
            "bonus_score": score_data.get("score_breakdown", {}).get("bonus_score", 0),
            "matched_skills": ", ".join(score_data.get("matched_skills", [])) or "none",
            "missing_skills": ", ".join(score_data.get("missing_skills", [])) or "none",
            "seniority_fit": score_data.get("seniority_fit", "unknown"),
            "location_fit": score_data.get("location_fit", "unknown"),
            "experience_years": score_data.get("experience_years") or "unknown",
        })

        if isinstance(result, CandidateExplanation):
            return result
        # Some LLM providers return dict
        if isinstance(result, dict):
            return CandidateExplanation(**result)

    except Exception as exc:
        log.warning("LLM explanation failed for %s: %s — using fallback",
                    candidate.get("member_id", "?"), exc)

    return _fallback(candidate, score_data)

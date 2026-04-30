"""Job-Candidate Matching Skill — scores a candidate against a job posting."""
from typing import Optional


def compute_match_score(candidate_skills: list[str], job_skills: list[str], seniority_match: bool = True) -> dict:
    """Return a 0-100 match score and breakdown."""
    if not job_skills:
        return {"score": 50, "matched_skills": [], "missing_skills": [], "seniority_match": seniority_match}

    candidate_set = {s.lower() for s in candidate_skills}
    job_set = {s.lower() for s in job_skills}

    matched = list(candidate_set & job_set)
    missing = list(job_set - candidate_set)

    skill_score = len(matched) / len(job_set) * 70  # skills worth 70 points
    seniority_score = 30 if seniority_match else 0

    total = round(skill_score + seniority_score, 1)
    return {
        "score": total,
        "matched_skills": matched,
        "missing_skills": missing,
        "seniority_match": seniority_match,
    }


def rank_candidates(candidates: list[dict], job_skills: list[str], job_seniority: Optional[str] = None) -> list[dict]:
    """Rank a list of parsed candidates against a job's required skills."""
    scored = []
    for c in candidates:
        seniority_match = (job_seniority is None or c.get("inferred_seniority") == job_seniority)
        result = compute_match_score(c.get("skills", []), job_skills, seniority_match)
        scored.append({**c, **result})
    return sorted(scored, key=lambda x: x["score"], reverse=True)

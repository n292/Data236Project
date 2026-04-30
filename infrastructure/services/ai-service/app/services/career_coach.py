"""Career Coach Agent — analyzes a member's profile against a target job and returns suggestions."""
import re
from typing import Optional

COMMON_SKILLS = [
    "python", "java", "javascript", "typescript", "react", "node.js", "sql", "mysql",
    "mongodb", "postgresql", "redis", "kafka", "docker", "kubernetes", "aws", "gcp",
    "azure", "machine learning", "deep learning", "tensorflow", "pytorch", "fastapi",
    "flask", "django", "spring", "go", "rust", "c++", "c#", "scala", "spark", "hadoop",
    "figma", "user research", "agile", "scrum", "product strategy", "roadmapping",
    "terraform", "ci/cd", "rest apis", "graphql", "mlops", "data analysis",
    "communication", "leadership", "project management",
]


def _extract_skills_from_text(text: str) -> list[str]:
    text_lower = text.lower()
    return [s for s in COMMON_SKILLS if s in text_lower]


def analyze_career_fit(
    member_skills: list[str],
    headline: str,
    target_job: str,
    target_skills: list[str],
    years_experience: Optional[int] = None,
) -> dict:
    member_set = {s.lower().strip() for s in member_skills}
    target_set = {s.lower().strip() for s in target_skills}

    matched = sorted(member_set & target_set)
    missing = sorted(target_set - member_set)
    bonus = sorted(member_set - target_set)

    skill_match_pct = round(len(matched) / len(target_set) * 100) if target_set else 0

    if skill_match_pct >= 75:
        overall_rating = "Strong Fit"
        rating_color = "green"
    elif skill_match_pct >= 45:
        overall_rating = "Moderate Fit"
        rating_color = "amber"
    else:
        overall_rating = "Needs Work"
        rating_color = "red"

    # Headline analysis
    headline_lower = (headline or "").lower()
    job_words = set(re.sub(r"[^a-z\s]", "", target_job.lower()).split())
    headline_relevance = bool(job_words & set(headline_lower.split()))
    headline_suggestion = None
    if not headline_relevance:
        top_matched = matched[:2] if matched else []
        if top_matched:
            headline_suggestion = f"{target_job} | {' & '.join(s.title() for s in top_matched)}"
        else:
            headline_suggestion = f"{target_job} Professional"

    suggestions = []

    if missing:
        priority = missing[:4]
        suggestions.append({
            "type": "skill_gap",
            "priority": "high",
            "title": "Bridge your skill gaps",
            "detail": f"Add these skills to stand out: {', '.join(s.title() for s in priority)}."
                      + (" Consider online courses or personal projects to demonstrate them." if len(missing) > 2 else ""),
        })

    if not headline_relevance and headline_suggestion:
        suggestions.append({
            "type": "headline",
            "priority": "medium",
            "title": "Optimize your headline",
            "detail": f'Your current headline doesn\'t mention "{target_job}". '
                      f'Recruiters search by title — try: "{headline_suggestion}"',
        })

    if matched:
        suggestions.append({
            "type": "highlight",
            "priority": "medium",
            "title": "Lead with your strongest matched skills",
            "detail": f"You already have: {', '.join(s.title() for s in matched[:5])}. "
                      "Make sure these appear prominently in your summary and experience descriptions.",
        })

    if len(member_skills) < 6:
        suggestions.append({
            "type": "profile_completeness",
            "priority": "low",
            "title": "Add more skills to your profile",
            "detail": "Profiles with 10+ skills get significantly more recruiter views. "
                      "Add any technologies or tools you've used.",
        })

    if bonus:
        suggestions.append({
            "type": "differentiator",
            "priority": "low",
            "title": "Use your unique skills as differentiators",
            "detail": f"You have skills not required by this role ({', '.join(s.title() for s in bonus[:4])}) "
                      "— mention them in your summary to show breadth.",
        })

    return {
        "skill_match_pct": skill_match_pct,
        "overall_rating": overall_rating,
        "rating_color": rating_color,
        "matched_skills": matched,
        "missing_skills": missing,
        "bonus_skills": bonus,
        "headline_suggestion": headline_suggestion,
        "suggestions": suggestions,
        "target_job": target_job,
        "target_skill_count": len(target_set),
    }

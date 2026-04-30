"""Deterministic candidate-to-job scoring pipeline.

Weights:  skills 40 | seniority 20 | experience 15 | location 15 | bonus 10
All scores are integers in [0, max_weight].
"""
from __future__ import annotations

import re
from typing import Optional

# ── Skill normalisation ──────────────────────────────────────────────────────

_ALIASES: dict[str, str] = {
    "node.js": "nodejs", "node js": "nodejs",
    "k8s": "kubernetes",
    "scikit-learn": "sklearn", "scikit learn": "sklearn",
    "sci-kit learn": "sklearn",
    "postgresql": "postgres",
    "c++": "cpp", "c#": "csharp",
    "machine learning": "ml", "deep learning": "dl",
    "natural language processing": "nlp",
    "computer vision": "cv",
}

SKILL_KEYWORDS: list[str] = [
    # Languages
    "python", "java", "javascript", "typescript", "golang", "go", "rust",
    "cpp", "csharp", "ruby", "scala", "kotlin", "swift", "php", "r",
    # Web
    "react", "angular", "vue", "svelte", "nextjs", "nuxtjs",
    "django", "flask", "fastapi", "spring", "express", "nestjs", "laravel",
    # Backend / APIs
    "nodejs", "graphql", "rest", "grpc", "microservices", "api",
    # Databases
    "mysql", "postgres", "mongodb", "redis", "elasticsearch", "cassandra",
    "dynamodb", "sqlite", "oracle", "sql",
    # Cloud / DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "cicd", "jenkins", "linux",
    # Data / ML
    "ml", "dl", "tensorflow", "pytorch", "sklearn", "pandas", "numpy",
    "spark", "hadoop", "kafka", "rabbitmq",
    "data engineering", "data science", "nlp", "cv",
    # Soft / Process
    "agile", "scrum", "leadership",
]

_STOPWORDS = {
    "with", "that", "this", "from", "will", "have", "been", "their",
    "about", "into", "through", "which", "there", "these", "would",
    "should", "could", "their", "using", "used", "work", "working",
}

_SENIORITY_ORDER = {"entry": 0, "mid": 1, "senior": 2, "director": 3}
_SENIORITY_TARGETS = {"entry": 1, "mid": 3, "senior": 7, "director": 12}


def _normalise_skill(s: str) -> str:
    s = s.lower().strip()
    return _ALIASES.get(s, s)


def _extract_skills_from_text(text: str) -> list[str]:
    """Extract skills from free-form text using keyword matching."""
    if not text:
        return []
    lower = text.lower()
    found: list[str] = []
    for kw in SKILL_KEYWORDS:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, lower):
            found.append(kw)
    return found


def _normalise_skills(skills: list[str]) -> set[str]:
    return {_normalise_skill(s) for s in skills if s}


# ── Individual component scorers ─────────────────────────────────────────────

def _skills_score(
    candidate_skills: set[str],
    job_skills: set[str],
) -> tuple[float, list[str], list[str]]:
    """Returns (score_0_40, matched_display, missing_display)."""
    if not job_skills:
        return 20.0, [], []
    matched = candidate_skills & job_skills
    missing = job_skills - candidate_skills
    ratio = len(matched) / len(job_skills)
    score = round(ratio * 40, 1)
    return score, sorted(matched), sorted(missing)


def _seniority_score(candidate_seniority: str, job_seniority: Optional[str]) -> tuple[float, str]:
    """Returns (score_0_20, fit_label)."""
    if not job_seniority or job_seniority not in _SENIORITY_ORDER:
        return 10.0, "unknown"
    cand_order = _SENIORITY_ORDER.get(candidate_seniority, 1)
    job_order = _SENIORITY_ORDER.get(job_seniority, 1)
    diff = abs(cand_order - job_order)
    if diff == 0:
        return 20.0, "strong_fit"
    elif diff == 1:
        return 15.0, "good_fit"
    elif diff == 2:
        return 8.0, "partial_fit"
    else:
        return 0.0, "weak_fit"


def _experience_score(years: Optional[int], job_seniority: Optional[str]) -> float:
    """Returns score_0_15."""
    if years is None:
        return 6.0  # mild penalty for unknown experience
    target = _SENIORITY_TARGETS.get(job_seniority or "mid", 3)
    diff = abs(years - target)
    score = max(0.0, 15.0 - diff * 2.0)
    return round(min(15.0, score), 1)


def _location_score(
    candidate_city: Optional[str],
    candidate_state: Optional[str],
    candidate_country: Optional[str],
    job_location: Optional[str],
    job_remote: Optional[str],
) -> tuple[float, str]:
    """Returns (score_0_15, fit_label)."""
    remote = (job_remote or "").lower()
    if remote == "remote":
        return 15.0, "remote_eligible"

    cand_loc = " ".join(filter(None, [candidate_city, candidate_state, candidate_country])).lower()
    job_loc = (job_location or "").lower()

    if not cand_loc or not job_loc:
        if remote == "hybrid":
            return 8.0, "remote_possible"
        return 5.0, "unknown"

    # Tokenise job location and look for overlaps
    job_tokens = [t.strip(",.") for t in job_loc.split() if len(t) > 2]
    cand_matches = sum(1 for t in job_tokens if t in cand_loc)

    if cand_matches >= 2:
        return 15.0, "same_city"
    elif cand_matches == 1:
        return 11.0, "same_state"
    elif remote == "hybrid":
        return 8.0, "remote_possible"
    else:
        return 0.0, "different_location"


def _bonus_score(resume_text: str, job_description: str) -> float:
    """Domain relevance bonus (0-10) based on keyword overlap."""
    if not resume_text or not job_description:
        return 0.0
    words = re.findall(r"\b[a-z]{4,}\b", job_description.lower())
    keywords = {w for w in words if w not in _STOPWORDS}
    if not keywords:
        return 0.0
    resume_lower = resume_text.lower()
    hits = sum(1 for k in keywords if k in resume_lower)
    ratio = hits / len(keywords)
    return round(min(10.0, ratio * 20.0), 1)


# ── Resume field extraction ───────────────────────────────────────────────────

def _infer_seniority(years: Optional[int]) -> str:
    if years is None:
        return "mid"
    if years >= 10:
        return "director"
    if years >= 5:
        return "senior"
    if years >= 2:
        return "mid"
    return "entry"


def _extract_years(text: str) -> Optional[int]:
    """Heuristic: find the largest explicit 'X years' mention."""
    if not text:
        return None
    patterns = [
        r"(\d+)\s*\+?\s*years?\s+of\s+(?:professional\s+)?experience",
        r"(\d+)\s*\+?\s*years?\s+(?:in\s+)?(?:the\s+)?(?:industry|field|software|engineering|development)",
        r"experience\s*[:\-]?\s*(\d+)\s*\+?\s*years?",
        r"(\d{4})\s*[-–]\s*(?:present|current|now)",  # date range fallback
    ]
    candidates: list[int] = []
    for pat in patterns:
        for m in re.finditer(pat, text.lower()):
            val = int(m.group(1))
            if pat.startswith(r"(\d{4})"):
                val = max(0, 2025 - val)  # convert start year to years of experience
            if 0 < val < 50:
                candidates.append(val)
    return max(candidates) if candidates else None


def _extract_location_from_text(text: str) -> Optional[str]:
    """Try to find a city/state line near the top of a resume."""
    if not text:
        return None
    lines = text.strip().split("\n")[:15]
    # Look for "City, ST" or "City, State" pattern
    loc_pat = re.compile(r"^([A-Z][a-zA-Z ]+),\s*([A-Z]{2}|[A-Z][a-z]+ ?[A-Z]?[a-z]*)$")
    for line in lines:
        line = line.strip()
        m = loc_pat.match(line)
        if m:
            return line
    return None


# ── Main public function ──────────────────────────────────────────────────────

def score_candidate(candidate: dict, job: dict) -> dict:
    """
    Score one candidate against a job posting.

    candidate dict keys (all optional):
        resume_text, cover_letter, skills_from_profile,
        city, state, country, experience_json,
        member_id, name, email

    job dict keys:
        title, description, skills_required (list|JSON),
        seniority_level, location, remote

    Returns the candidate dict augmented with score fields.
    """
    # ── Gather candidate skills ──────────────────────────────────────────────
    resume_text = candidate.get("resume_text") or ""
    cover_text = candidate.get("cover_letter") or ""
    combined_text = f"{resume_text}\n{cover_text}"

    skills_from_text = _extract_skills_from_text(combined_text)
    profile_skills_raw = candidate.get("skills_from_profile") or []
    if isinstance(profile_skills_raw, str):
        import json as _json
        try:
            profile_skills_raw = _json.loads(profile_skills_raw)
        except Exception:
            profile_skills_raw = [profile_skills_raw]
    all_candidate_skills = _normalise_skills(skills_from_text + list(profile_skills_raw))

    # ── Gather job skills ────────────────────────────────────────────────────
    raw_job_skills = job.get("skills_required") or []
    if isinstance(raw_job_skills, str):
        import json as _json
        try:
            raw_job_skills = _json.loads(raw_job_skills)
        except Exception:
            raw_job_skills = [s.strip() for s in raw_job_skills.split(",")]
    job_skills = _normalise_skills(raw_job_skills)

    # ── Experience ───────────────────────────────────────────────────────────
    years = _extract_years(combined_text)
    if years is None and candidate.get("experience_json"):
        exp_raw = candidate["experience_json"]
        if isinstance(exp_raw, list) and exp_raw:
            years = len(exp_raw)  # rough: one entry ≈ 1 role

    inferred_seniority = _infer_seniority(years)

    # ── Location from profile or resume text ─────────────────────────────────
    city = candidate.get("city") or ""
    state = candidate.get("state") or ""
    country = candidate.get("country") or ""
    if not city:
        loc_from_text = _extract_location_from_text(resume_text)
        if loc_from_text:
            parts = [p.strip() for p in loc_from_text.split(",")]
            city = parts[0] if parts else ""
            state = parts[1] if len(parts) > 1 else ""

    # ── Score components ─────────────────────────────────────────────────────
    sk_score, matched, missing = _skills_score(all_candidate_skills, job_skills)
    sn_score, seniority_fit = _seniority_score(inferred_seniority, job.get("seniority_level"))
    ex_score = _experience_score(years, job.get("seniority_level"))
    lo_score, location_fit = _location_score(
        city or None, state or None, country or None,
        job.get("location"), job.get("remote"),
    )
    bo_score = _bonus_score(resume_text, job.get("description") or "")

    total = round(sk_score + sn_score + ex_score + lo_score + bo_score, 1)

    # Display-friendly skill names (title-case the normalised form)
    def _display(skills: list[str]) -> list[str]:
        return [s.title().replace("Nodejs", "Node.js").replace("Css", "CSS")
                .replace("Sql", "SQL").replace("Api", "API") for s in skills]

    return {
        **candidate,
        # Scoring outputs
        "match_score": total,
        "score_breakdown": {
            "skills_score": sk_score,
            "seniority_score": sn_score,
            "experience_score": ex_score,
            "location_score": lo_score,
            "bonus_score": bo_score,
            "total_score": total,
        },
        "matched_skills": _display(matched),
        "missing_skills": _display(missing),
        "seniority_fit": seniority_fit,
        "location_fit": location_fit,
        "experience_years": years,
        "inferred_seniority": inferred_seniority,
        "parsed_skills": _display(sorted(all_candidate_skills)),
    }


def rank_and_shortlist(candidates: list[dict], job: dict, top_n: int) -> tuple[list[dict], list[dict]]:
    """
    Score all candidates, sort descending, split into shortlist (top N) and rest.

    Returns (all_scored_sorted, shortlist_top_n).
    """
    scored = [score_candidate(c, job) for c in candidates]
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored, scored[:top_n]

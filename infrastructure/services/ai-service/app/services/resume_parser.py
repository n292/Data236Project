"""Resume Parser Skill — extracts structured fields from raw resume text."""
import re
from typing import Optional


SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "react", "node.js", "sql", "mysql",
    "mongodb", "postgresql", "redis", "kafka", "docker", "kubernetes", "aws", "gcp",
    "azure", "machine learning", "deep learning", "tensorflow", "pytorch", "fastapi",
    "flask", "django", "spring", "go", "rust", "c++", "c#", "scala", "spark", "hadoop",
]


def parse_resume(text: str) -> dict:
    """Extract structured fields from raw resume text using heuristics."""
    text_lower = text.lower()

    # Extract skills by keyword matching
    found_skills = [s for s in SKILL_KEYWORDS if s in text_lower]

    # Extract email
    email_match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    email = email_match.group(0) if email_match else None

    # Extract phone
    phone_match = re.search(r"(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}", text)
    phone = phone_match.group(0) if phone_match else None

    # Extract years of experience (simple heuristic)
    exp_match = re.search(r"(\d+)\s*\+?\s*years?\s+of\s+experience", text_lower)
    years_exp = int(exp_match.group(1)) if exp_match else None

    # Detect seniority level
    seniority = "entry"
    if years_exp is not None:
        if years_exp >= 8:
            seniority = "director"
        elif years_exp >= 5:
            seniority = "senior"
        elif years_exp >= 2:
            seniority = "mid"

    return {
        "email": email,
        "phone": phone,
        "skills": found_skills,
        "years_experience": years_exp,
        "inferred_seniority": seniority,
        "raw_length": len(text),
    }

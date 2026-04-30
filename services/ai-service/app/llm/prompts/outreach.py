"""Prompt template for recruiter outreach draft generation."""
from langchain_core.prompts import ChatPromptTemplate

OUTREACH_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are a professional recruiter writing a personalised outreach message. "
            "Be warm, concise, and specific. Do NOT auto-send this message. "
            "Do NOT fabricate any facts — use only the candidate and job data provided. "
            "Keep the full message under 180 words."
        ),
    ),
    (
        "human",
        """\
Job: {job_title} at {company_name}
Location: {job_location}

Candidate Name  : {candidate_name}
Matched Skills  : {matched_skills}
Seniority Fit   : {seniority_fit}
Location Fit    : {location_fit}
Experience      : {experience_years} years
Why Recommended : {explanation_summary}

Return a JSON object with exactly four keys:
  "subject"      - a short email subject line (under 12 words)
  "intro"        - one personalised opening sentence addressing {candidate_name} by first name
  "why_fit"      - 2-3 sentences explaining fit, referencing matched skills specifically
  "full_message" - the complete ready-to-edit email (subject not included), under 180 words

Only use provided data. Do not fabricate details.\
""",
    ),
])

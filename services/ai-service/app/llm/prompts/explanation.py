"""Prompt template for candidate explanation generation."""
from langchain_core.prompts import ChatPromptTemplate

EXPLANATION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are a concise recruiting assistant. "
            "Given structured match data, generate a short recruiter-friendly explanation "
            "for why this candidate was recommended. "
            "Only reference facts provided — never fabricate experience or skills. "
            "Keep the summary to 2-3 sentences and the reasons to 3-5 bullets."
        ),
    ),
    (
        "human",
        """\
Job: {job_title} at {company_name}
Required Skills: {job_skills}
Seniority Required: {job_seniority}
Location: {job_location}

Candidate: {candidate_name}
Match Score: {match_score}/100

Score Breakdown:
  Skills     : {skills_score}/40
  Seniority  : {seniority_score}/20
  Experience : {experience_score}/15
  Location   : {location_score}/15
  Domain fit : {bonus_score}/10

Matched Skills   : {matched_skills}
Missing Skills   : {missing_skills}
Seniority Fit    : {seniority_fit}
Location Fit     : {location_fit}
Est. Experience  : {experience_years} years

Return a JSON object with exactly two keys:
  "summary"  - a 2-3 sentence plain-English summary of why this candidate was recommended
  "reasons"  - a list of 3-5 short bullet strings (each under 15 words)

Only use the data provided above. Do not invent facts.\
""",
    ),
])

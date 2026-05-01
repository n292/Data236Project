"""Prompt template for Career Coach analysis."""
from langchain_core.prompts import ChatPromptTemplate

CAREER_COACH_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are an expert career coach helping professionals improve their LinkedIn profiles "
            "and job application strategies. You provide specific, actionable, and encouraging advice "
            "based on the candidate's actual profile data and the job requirements. "
            "Never fabricate skills or experience. Only reference what is provided. "
            "Be concise and direct — each suggestion should have a clear action the candidate can take today."
        ),
    ),
    (
        "human",
        """\
## Target Job
Title: {job_title}
Company: {company_name}
Seniority: {job_seniority}
Location: {job_location}
Description: {job_description}
Required Skills: {job_skills}

## Candidate Profile
Headline: {member_headline}
About: {member_about}
Skills on Profile: {member_skills}
Years of Experience: {experience_years}
Inferred Seniority: {inferred_seniority}

## Skill Match Analysis (Deterministic)
Matched Skills ({matched_count}): {matched_skills}
Missing Skills ({missing_count}): {missing_skills}
Extra Skills (not required): {bonus_skills}
Match Percentage: {skill_match_pct}%

---

Analyze this candidate's fit for the job and return a JSON object with exactly these keys:

"strengths": A list of 2-4 short strings highlighting what the candidate already does well relative to this job. Each under 20 words. Reference specific matched skills or experience.

"improvement_areas": A list of 2-4 short strings identifying the most impactful gaps to close. Be specific (e.g. "No cloud experience — AWS/GCP certification would stand out" not just "needs more skills").

"suggestions": A list of 3-5 actionable suggestion objects. Each object must have:
  - "type": one of skill_gap | headline | about | highlight | differentiator | experience
  - "suggestion": the specific action to take (under 25 words)
  - "rationale": why this will help for this specific role (under 20 words)
Prioritize by impact — put the highest-value suggestion first.

"headline_rewrite": A rewritten LinkedIn headline optimized for this job title and top matched skills. Under 120 characters. Return null if the current headline is already strong.

"about_rewrite": A rewritten first sentence of the About section that leads with the most relevant experience for this role. Under 50 words. Return null if no About section was provided.

Only use data from the sections above. Do not invent details.\
""",
    ),
])

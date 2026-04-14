# Kaggle → `job_postings` column mapping

**Dataset:** [LinkedIn Job Postings 2023 (Kaggle)](https://www.kaggle.com/datasets/rajatraj0502/linkedin-job-2023)

Download the Kaggle CSV into `services/job-service/data/` (ignored by git except `sample_jobs.csv`). For a quick smoke test without Kaggle, set `JOBS_CSV_PATH=./data/sample_jobs.csv`.

## Raw file expectations

The seed loader auto-detects headers (case-insensitive). It recognizes common aliases:

| `job_postings` column | Typical Kaggle / CSV headers |
|----------------------|------------------------------|
| `title` | `title`, `job_title`, `Title`, `position` |
| `description` | `description`, `job_description`, `Description` |
| `location` | `location`, `job_location`, `formatted_location` |
| `employment_type` | `employment_type`, `job_type`, `formatted_employment_type` |
| `company_id` | *synthetic* — derived row hash unless `company_id` / `company` present |
| `recruiter_id` | *synthetic* — stable UUID per `company_id` for demo recruiters |

## Gaps and synthetic fields

| Field | Gap | Strategy |
|-------|-----|----------|
| `salary_min` / `salary_max` | Often missing in raw jobs CSV | Optional columns `salary_min`/`salary_max` or parse `salary_range` text when present; otherwise `NULL` |
| `seniority_level` | Rarely standardized | Infer light heuristic from title keywords (`senior`, `junior`, `lead`, `intern`) or leave `NULL` |
| `skills_required` | Usually absent | Empty JSON array `[]`, or split optional `skills` / `skills_required` column if added later |
| `company_id` | Kaggle has company name, not UUID | Hash company name to deterministic UUID (v5-style namespace) so the same company shares one id |
| `recruiter_id` | No recruiter in export | One synthetic recruiter UUID per `company_id` |
| `remote` | Inconsistent | Map substring of location/description (`remote`, `hybrid`, `on-site`) → `remote` / `hybrid` / `onsite`; default `onsite` |
| `posted_datetime` | Optional | Use `posted_date` / `created_at` if present, else ingestion time |

## Full-text search (W1+)

`001_create_job_postings.sql` defines `FULLTEXT (title, description)` for `MATCH() ... AGAINST()` queries.

## Industry filter

`POST /jobs/search` may accept `industry` (team API). There is **no** `industry` column in W0. Resolve with M1/M5 whether industry comes from a future `companies` table, a denormalized column, or is dropped from filters until schema alignment.

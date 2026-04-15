# Kaggle → `job_postings` column mapping

**Dataset:** [LinkedIn Job Postings 2023 (Kaggle)](https://www.kaggle.com/datasets/rajatraj0502/linkedin-job-2023)

Download the Kaggle CSV into `services/job-service/data/` (ignored by git except `sample_jobs.csv`). Example:

```bash
JOBS_CSV_PATH=./data/job_postings.csv SEED_MAX_ROWS=5000 npm run seed
```

Use `SEED_MAX_ROWS` while testing so you do not load the full multi‑million row file at once. For a quick smoke test without Kaggle, use `JOBS_CSV_PATH=./data/sample_jobs.csv`.

## `job_postings.csv` (rajatraj0502 dataset)

The seed loader matches these headers (case-insensitive):

| `job_postings` / loader | CSV column(s) |
|-------------------------|----------------|
| `title` | `title`, `job_title`, … |
| `description` | `description` |
| `location` | `location` |
| `employment_type` | `formatted_work_type`, `work_type`, `formatted_employment_type`, … |
| `company` (for synthetic `company_id`) | `company`, `company_name`, **`company_id`** (stable hash when name missing) |
| `salary_min` / `salary_max` | **`min_salary`**, **`max_salary`** |
| `posted_datetime` | **`listed_time`**, **`original_listed_time`**, … (numeric values treated as Unix ms or seconds) |
| `seniority_level` | **`formatted_experience_level`**, else inferred from title |
| `skills_required` (JSON array) | **`skills_desc`** (split on `,` `;` `|`) |
| `remote` | text in location/description, plus **`remote_allowed`** (`1` / `true` → `remote`) |

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

Migration `002_add_industry.sql` adds nullable `industry` on `job_postings` for `POST /jobs/search`. Kaggle `job_postings.csv` does not include industry; leave `NULL` or enrich later (e.g. join `company_industries.csv` in a future loader version).

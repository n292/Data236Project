# Job Service — API contract (Member 2)

**Base URL:** `/api/v1`  
**Transport:** JSON over HTTP, `Content-Type: application/json`  
**Convention:** All job endpoints use **POST** (team / class spec).

## Swagger UI (manual testing)

With the service running (`npm run dev`), open:

`http://127.0.0.1:<PORT>/api/docs/` — use the same `PORT` as in `.env` (e.g. `3002`, `3003`).

Use **Try it out** on `POST /api/v1/jobs/create`, `get`, `update`, `close`, `search`, and `byRecruiter`. Raw OpenAPI JSON: `GET /api/docs/openapi.json`.

## Endpoints summary

| Path | Purpose |
|------|---------|
| `POST /api/v1/jobs/create` | Create job posting |
| `POST /api/v1/jobs/get` | Get one job by `job_id` |
| `POST /api/v1/jobs/update` | Partial update (recruiter ownership) |
| `POST /api/v1/jobs/search` | Keyword + filters + pagination |
| `POST /api/v1/jobs/close` | Close posting (`open` → `closed`) |
| `POST /api/v1/jobs/byRecruiter` | List jobs for a recruiter |

---

## `POST /api/v1/jobs/create`

**201** `{ "job_id": "<uuid>", "status": "open" }`

**400** `{ "error": "validation_error", "details": ["..."] }` — missing/invalid fields.

**409** `{ "error": "duplicate" }` — an **open** job already exists with the same `title`, `company_id`, and `recruiter_id`.

### Request body

| Field | Required | Notes |
|-------|----------|--------|
| `title` | yes | max 255 |
| `company_id` | yes | UUID |
| `recruiter_id` | yes | UUID |
| `location` | yes | |
| `employment_type` | yes | e.g. `FULL_TIME` |
| `description` | no | |
| `seniority_level` | no | |
| `remote` | no | `onsite` \| `remote` \| `hybrid` (case-insensitive) |
| `skills_required` | no | JSON array |
| `salary_range` | no | `{ "min": number, "max": number }` (also accepts `salary_min` / `salary_max`) |
| `industry` | no | used by search when set |
| `trace_id` | no | optional UUID for **Guideline #2**; also accepted as header `X-Trace-Id`. If omitted, server generates a new UUID for this request. Stripped from body before validation. |

### Kafka (W2 — implemented)

After a successful MySQL insert, the service publishes **`job.created`** to Kafka (when `KAFKA_BROKERS` is set). Message value is the **team JSON envelope** (Guideline #1):

- `event_type`: `job.created`
- `trace_id`: from `trace_id` / `X-Trace-Id` or generated UUID v4
- `timestamp`: ISO-8601 UTC
- `actor_id`: `recruiter_id`
- `entity`: `{ "entity_type": "job", "entity_id": "<job_id>" }`
- `payload`: `job_id`, `title`, `company_id`, `location`, `employment_type`
- `idempotency_key`: **UUID v5** over `job_id` + same `timestamp` string (Member 2 PDF)

If the broker is unreachable after retries, the job row **remains committed**; the error is logged (align with M6 on eventual consistency / replay strategy).

---

## `POST /api/v1/jobs/get`

**200** — full job object (see model below).

**400** — invalid `job_id`.

**404** — `{ "error": "not_found" }`

### Request body

```json
{ "job_id": "<uuid>" }
```

---

## `POST /api/v1/jobs/update`

**200** — updated job object.

**400** — validation.

**403** — `{ "error": "forbidden" }` — `recruiter_id` does not own the job.

**404** — job not found.

### Request body

- `job_id` (UUID, required)  
- `recruiter_id` (UUID, required) — must match row owner.  
- Updates via top-level fields and/or nested `fields_to_update` object.

Only **changed** fields are written (dirty-field guard).

Updatable: `title`, `description`, `seniority_level`, `employment_type`, `location`, `industry`, `remote`, `skills_required`, `salary_range` (or `salary_min` / `salary_max`).

---

## `POST /api/v1/jobs/close`

**200** `{ "status": "closed" }`

**400** — validation.

**403** — wrong `recruiter_id`.

**404** — job not found.

**409** `{ "error": "already_closed" }` — job already closed.

### Request body

```json
{ "job_id": "<uuid>", "recruiter_id": "<uuid>" }
```

### Kafka (W2+)

Produce **`job.closed`** after successful status transition.

---

## `POST /api/v1/jobs/search`

**200**

```json
{
  "jobs": [ /* job objects */ ],
  "total": 0,
  "page": 1
}
```

**400** `{ "error": "validation_error", ... }` — invalid `page` / `limit` / `remote` / etc.

### Request body

| Field | Required | Notes |
|-------|----------|--------|
| `page` | yes | integer ≥ 1 |
| `limit` | yes | integer 1–100 |
| `keyword` | no | `MATCH(title, description) AGAINST (... IN BOOLEAN MODE)` |
| `location` | no | `LIKE %value%` |
| `employment_type` | no | case-insensitive equality |
| `remote` | no | `onsite` \| `remote` \| `hybrid` |
| `industry` | no | exact match on `industry` column (requires migration `002`) |

If `keyword` is omitted or empty, search uses filters only (no full-text clause).

---

## `POST /api/v1/jobs/byRecruiter`

**200** `{ "jobs": [], "total": number }`

**400** — invalid UUID / pagination / `status`.

### Request body

| Field | Required | Notes |
|-------|----------|--------|
| `recruiter_id` | yes | UUID |
| `status` | no | `open` or `closed` |
| `page` | no | default `1` |
| `limit` | no | default `20`, max `100` |

**Note:** Without a recruiters registry service, **“recruiter not found” (404)** from the syllabus is not returned; an unknown recruiter with no rows yields `total: 0`. Align with M1 if a dedicated recruiters table is added later.

---

## Job object (response shape)

```json
{
  "job_id": "uuid",
  "company_id": "uuid",
  "recruiter_id": "uuid",
  "title": "string",
  "description": "string | null",
  "seniority_level": "string | null",
  "employment_type": "string",
  "location": "string",
  "industry": "string | null",
  "remote": "onsite | remote | hybrid",
  "skills_required": [],
  "salary_range": { "min": 0, "max": 0 } | null,
  "posted_datetime": "ISO-like MySQL datetime",
  "status": "open | closed",
  "views_count": 0,
  "applicants_count": 0
}
```

---

## MySQL — `job_postings`

- Migrations: `database/001_create_job_postings.sql`, `database/002_add_industry.sql`, `database/003_processed_events.sql`  
- Indexes: `location`, `company_id`, `status`, `recruiter_id`, `industry`, **FULLTEXT(title, description)**  
- Run: `npm run db:migrate`

### `processed_events` (W2)

Stores **`idempotency_key`** for the **`application.submitted`** consumer (Guideline #3 — at-least-once). Duplicate keys skip the `applicants_count` increment.

---

## Kafka topics (W2 freeze — Member 2)

| Direction | Topic (env override) | Status |
|-----------|----------------------|--------|
| **Produce** | `job.created` (`KAFKA_TOPIC_JOB_CREATED`) | **Wired** on `POST /jobs/create` |
| Produce | `job.viewed`, `job.saved`, `job.closed` | **W3 / W4** (UI + close pipeline per PDF) |
| **Consume** | `application.submitted` (`KAFKA_TOPIC_APPLICATION_SUBMITTED`) | **Wired** — increments `applicants_count` idempotently |

**Consumer group:** `KAFKA_GROUP_APPLICATION_SUBMITTED` (default `job-service-application-submitted`).

**`application.submitted` message:** full envelope; handler reads `payload.job_id` and `idempotency_key`. Same envelope shape as class spec (Guideline #1).

**Local run:** set `KAFKA_BROKERS` (e.g. `localhost:9092`). If unset, the producer is a no-op and the consumer does not start.

---

## Error codes (HTTP)

| Status | `error` field | When |
|--------|-----------------|------|
| 400 | `validation_error` | Bad body / filters |
| 403 | `forbidden` | Update/close not owner |
| 404 | `not_found` | Unknown `job_id` |
| 409 | `duplicate` | Duplicate open create |
| 409 | `already_closed` | Close on closed job |
| 500 | `internal_error` | Unexpected server failure |

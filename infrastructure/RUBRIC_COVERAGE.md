# Rubric Coverage Matrix

| Rubric Item | Status | Code / File Evidence |
|---|---|---|
| **M1 — Profile Service** | | |
| Member CRUD (create/get/update/delete/search) | ✅ Complete | [member_routes.py](services/profile-service/backend/app/api/routes/member_routes.py) |
| Profile photo upload | ✅ Complete | `POST /members/upload-photo` |
| Redis caching | ✅ Complete | [redis_cache.py](services/profile-service/backend/app/utils/redis_cache.py) |
| Kafka events: member.created, member.updated | ✅ Complete | [kafka_producer.py](services/profile-service/backend/app/utils/kafka_producer.py) |
| profile.viewed consumer → increment daily views | ✅ Complete | [kafka_consumer.py](services/profile-service/backend/app/utils/kafka_consumer.py) |
| Auth: register + login (JWT, bcrypt) | ✅ Complete | [auth_routes.py](services/profile-service/backend/app/api/routes/auth_routes.py) · [security.py](services/profile-service/backend/app/core/security.py) |
| Google OAuth2 redirect flow | ✅ Complete | `GET /auth/google` → callback → JWT |
| Kaggle Resume.csv seed (2,484 real members) | ✅ Complete | [seed_from_kaggle.py](services/profile-service/backend/database/seed_from_kaggle.py) |
| **M2 — Job Service** | | |
| Job CRUD + search + view + save + byRecruiter | ✅ Complete | [jobs.js](services/job-service/src/routes/jobs.js) |
| saved_jobs table with ON DUPLICATE KEY | ✅ Complete | [004_saved_jobs.sql](services/job-service/database/004_saved_jobs.sql) |
| Redis cache on job listings | ✅ Complete | [redisCache.js](services/job-service/src/cache/redisCache.js) |
| Kafka: job.created / closed / viewed / saved | ✅ Complete | [jobProducer.js](services/job-service/src/kafka/jobProducer.js) |
| application.submitted consumer → increment applicants_count | ✅ Complete | [applicationSubmittedHandler.js](services/job-service/src/kafka/applicationSubmittedHandler.js) |
| 10k+ seeded job postings | ✅ Complete | [seed.js](services/job-service/database/seed.js) |
| **M3 — Application Service** | | |
| Submit with resume file upload (multer) | ✅ Complete | [applicationController.js](services/application-service/src/controllers/applicationController.js) |
| DB write before Kafka publish (crash-safe) | ✅ Complete | applicationController.js L45–55 |
| Duplicate application blocked (DB constraint + pre-check) | ✅ Complete | `uq_job_member` UNIQUE constraint + `findDuplicate()` |
| Apply to closed job blocked | ✅ Complete | `isJobClosed()` HTTP check in applicationController.js |
| updateStatus / addNote | ✅ Complete | applicationRoutes.js |
| Kafka: application.submitted + application.status_updated | ✅ Fixed | [producer.js](services/application-service/src/kafka/producer.js) (topic name bug fixed) |
| Correct event envelope (entity as object) | ✅ Fixed | producer.js — entity: `{entity_type, entity_id}` |
| Kafka consumer idempotency (processed_events table) | ✅ Complete | [consumer.js](services/application-service/src/kafka/consumer.js) |
| **M4 — Messaging + Connections** | | |
| Thread open/get/byUser + message send/list | ✅ Complete | [threads.js](services/messaging-service/routes/threads.js) · [messages.js](services/messaging-service/routes/messages.js) |
| Message send retry (3 attempts, 500ms backoff) | ✅ Complete | [kafka.js](services/messaging-service/config/kafka.js) |
| Kafka: message.sent | ✅ Complete | messaging-service/routes/messages.js |
| Connection request/accept/reject/list/mutual | ✅ Complete | [connections.js](services/connection-service/routes/connections.js) |
| Accept → increments connections_count on both members | ✅ Complete | connections.js — HTTP call to profile-service |
| Kafka: connection.requested + connection.accepted | ✅ Complete | connection-service/config/kafka.js |
| **M5 — AI Service** | | |
| FastAPI microservice | ✅ Complete | [main.py](services/ai-service/app/main.py) (port 8005) |
| Supervisor/Hiring Assistant agent | ✅ Complete | [hiring_assistant.py](services/ai-service/app/services/hiring_assistant.py) |
| Skill 1: Resume Parser | ✅ Complete | [resume_parser.py](services/ai-service/app/services/resume_parser.py) — skills, email, phone, years, seniority |
| Skill 2: Job-Candidate Matcher | ✅ Complete | [job_matcher.py](services/ai-service/app/services/job_matcher.py) — 70pt skills + 30pt seniority |
| Skill 3: Outreach Draft | ✅ Complete | hiring_assistant.py step 3 — template-based outreach draft |
| Kafka-orchestrated workflow (ai.requests / ai.results) | ✅ Complete | [consumer.py](services/ai-service/app/kafka/consumer.py) · [producer.py](services/ai-service/app/kafka/producer.py) |
| POST /ai/submit-task publishes to ai.requests | ✅ Complete | routes.py — Kafka-first, inline fallback |
| Shared trace_id across all AI steps | ✅ Complete | hiring_assistant.py — trace_id in every `_append_step` + Kafka envelope |
| Persisted task traces + step results in MongoDB | ✅ Complete | hiring_assistant.py — `get_task_async()` reads MongoDB |
| SSE endpoint for real-time progress streaming | ✅ Complete | `GET /ai/task-stream/{task_id}` — EventSourceResponse |
| Human-in-the-loop approval gate | ✅ Complete | `POST /ai/hiring-task/{id}/approve` with decision + note |
| Auto-approve if score < 80, require approval if ≥ 80 | ✅ Complete | hiring_assistant.py L122–125 |
| Evaluation metrics (match quality, approval rate) | ✅ Complete | `GET /ai/metrics` + `GET /ai/metrics/{task_id}` |
| Metrics stored per task in MongoDB | ✅ Complete | task["metrics"] dict persisted |
| Recruiter UI: AI shortlist panel | ✅ Complete | [RecruiterReviewPage.jsx](frontend/src/pages/RecruiterReviewPage.jsx) — AiShortlistPanel |
| Score bar + matched/missing skills visible | ✅ Complete | RecruiterReviewPage.jsx — ScoreBar component |
| **M6 — Analytics Service** | | |
| Kafka consumer for 14 topics (incl. ai.requests/results) | ✅ Complete | [consumer.js](services/analytics-service/src/kafka/consumer.js) |
| Idempotency on event ingestion | ✅ Complete | consumer.js — idempotency_key findOne check |
| Top 10 jobs by applications **per month** | ✅ Complete | `GET /analytics/jobs/top?month=YYYY-MM` |
| Top 5 jobs with fewest applications | ✅ Complete | `GET /analytics/jobs/low-traction` |
| City-wise applications per month for a job | ✅ Complete | `GET /analytics/jobs/applications-by-city?job_id=` |
| Clicks per job posting (job.viewed events) | ✅ Complete | `GET /analytics/jobs/clicks?job_id=` |
| Saved jobs per day/week | ✅ Complete | `GET /analytics/jobs/saves?granularity=day\|week` |
| Funnel: view → save → submit → reviewed → accepted | ✅ Fixed | `GET /analytics/funnel?job_id=` — 6-stage funnel |
| Member dashboard: profile views per day (30 days) | ✅ Complete | `GET /analytics/member/dashboard?member_id=` |
| Member dashboard: application status breakdown | ✅ Complete | analytics/member/dashboard |
| Recruiter dashboard: top jobs / low traction / views / saves / funnel | ✅ Complete | `GET /analytics/recruiter/dashboard?recruiter_id=` |
| **SSE Real-time Recruiter Feed** | | |
| Live event stream for recruiter | ✅ Complete | `GET /recruiter/live-feed/:recruiter_id` — SSE |
| Broadcasts: application.submitted, job.viewed, job.saved, ai.results | ✅ Complete | consumer.js eventBus + analytics routes |
| **Failure Modes** | | |
| Duplicate email registration | ✅ Complete | auth_service.py — 400 if email exists |
| Duplicate application to same job | ✅ Complete | DB constraint + 409 response |
| Apply to closed job | ✅ Complete | isJobClosed() → 400 |
| Message send failure + retry | ✅ Complete | messaging kafka.js — 3 attempts |
| Kafka consumer idempotency | ✅ Complete | application-service processed_events table |
| Topic name consistency (application.status_updated) | ✅ Fixed | producer.js — was statusUpdated, now status_updated |
| **Performance / Scalability** | | |
| k6 Scenario A: search + view, 100 VUs, 4 configs | ✅ Complete | [scenario_a_search_view.js](tests/load/scenario_a_search_view.js) |
| k6 Scenario B: apply submit, 100 VUs, 4 configs | ✅ Complete | [scenario_b_apply_submit.js](tests/load/scenario_b_apply_submit.js) |
| Results CSV (8 files) | ✅ Complete | [tests/load/results/](tests/load/results/) |
| Benchmark summary + reproduce instructions | ✅ Complete | [BENCHMARK_RESULTS.md](tests/load/results/BENCHMARK_RESULTS.md) |
| FULLTEXT index on job_postings | ✅ Complete | 001_create_job_postings.sql |
| Automation script | ✅ Complete | [run_benchmarks.sh](tests/load/run_benchmarks.sh) |
| **Infrastructure** | | |
| Docker Compose: 8 services + Kafka + MySQL + MongoDB + Redis | ✅ Complete | [docker-compose.yml](infrastructure/docker-compose.yml) |
| Dockerfiles for all services | ✅ Complete | per-service Dockerfile |
| Frontend React app | ✅ Complete | [frontend/](frontend/) (port 3000) |

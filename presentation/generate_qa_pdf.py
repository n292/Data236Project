"""
Generate Q&A PDF for LinkedIn Platform presentation.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                 Table, TableStyle, HRFlowable, PageBreak)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

LI_BLUE   = HexColor('#0A66C2')
LI_DARK   = HexColor('#001B48')
LI_LIGHT  = HexColor('#F3F2EF')
LI_GREEN  = HexColor('#057A55')
LI_ORANGE = HexColor('#E86A23')
LI_GRAY   = HexColor('#56687A')
LI_RED    = HexColor('#CC2200')

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, parent=styles['Normal'], **kw)

title_style = S('Title', fontSize=22, textColor=white, leading=28,
                fontName='Helvetica-Bold', alignment=TA_CENTER)
subtitle_style = S('Subtitle', fontSize=11, textColor=HexColor('#70B5F9'),
                    leading=15, fontName='Helvetica', alignment=TA_CENTER)
section_style = S('Section', fontSize=14, textColor=white, leading=18,
                   fontName='Helvetica-Bold')
q_style = S('Q', fontSize=12, textColor=LI_DARK, leading=16,
             fontName='Helvetica-Bold', spaceAfter=4)
a_style = S('A', fontSize=10.5, textColor=HexColor('#1A1A1A'), leading=15,
             fontName='Helvetica', spaceAfter=6, leftIndent=12,
             alignment=TA_JUSTIFY)
note_style = S('Note', fontSize=9, textColor=LI_GRAY, leading=13,
               fontName='Helvetica-Oblique', leftIndent=12)

def section_header(title, color=LI_BLUE):
    data = [[Paragraph(title, section_style)]]
    t = Table(data, colWidths=[7.0*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), color),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', [4,4,4,4]),
    ]))
    return t

def qa_block(number, question, answer, tip=None):
    elems = []
    elems.append(Paragraph(f"Q{number}. {question}", q_style))
    elems.append(Paragraph(answer, a_style))
    if tip:
        elems.append(Paragraph(f"💡 Tip: {tip}", note_style))
    elems.append(Spacer(1, 6))
    elems.append(HRFlowable(width='100%', thickness=0.5,
                             color=HexColor('#D0D0D0'), spaceAfter=6))
    return elems

def build():
    doc = SimpleDocTemplate(
        '/Users/dipinjassal/sem_2/linkedin/presentation/Presentation_QA_Guide.pdf',
        pagesize=letter,
        rightMargin=0.75*inch, leftMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch
    )

    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    cover_data = [[
        Paragraph("LinkedIn Platform — Presentation Q&A Guide", title_style),
    ]]
    cover = Table(cover_data, colWidths=[7.0*inch])
    cover.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LI_DARK),
        ('TOPPADDING',    (0,0), (-1,-1), 22),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
    ]))
    story.append(cover)

    sub_data = [[Paragraph(
        "DATA 236 · Group 6  |  Dipin Jassal, Sarvesh Reshimwale, Sammruddhi, Anushka Khadatkar, Rajesh, Bhavya, Shashira, Nikhil",
        subtitle_style)]]
    sub = Table(sub_data, colWidths=[7.0*inch])
    sub.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LI_BLUE),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
    ]))
    story.append(sub)
    story.append(Spacer(1, 12))

    intro = S('Intro', fontSize=10, textColor=LI_GRAY, leading=14,
              fontName='Helvetica', alignment=TA_JUSTIFY)
    story.append(Paragraph(
        "This guide covers the most likely questions a professor or peer reviewer will ask during the presentation, "
        "along with clear answers rooted in what was actually built. Each section maps to a slide in the deck. "
        "Read through before the presentation — the explanations are intentionally concise so they can be stated "
        "confidently in 30–60 seconds.", intro))
    story.append(Spacer(1, 14))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — Project Overview
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("1 · Project Overview & Architecture"))
    story.append(Spacer(1, 8))

    story += qa_block(1,
        "In one sentence, what did you build?",
        "We built a production-scale LinkedIn-like professional network using 8 independent microservices "
        "connected via Apache Kafka, backed by MySQL, MongoDB, and Redis, with a React frontend and an "
        "agentic AI layer in FastAPI for automated candidate shortlisting.")

    story += qa_block(2,
        "Why did you use a microservices architecture instead of a monolith?",
        "Each domain — profiles, jobs, applications, messaging, connections, analytics, and AI — has "
        "different scaling needs and technology requirements. Microservices let us scale the job-search "
        "service independently (Redis cache for high read volume) while the AI service runs heavy "
        "computation separately. It also forced clear API contracts between teams.",
        "Mention: independent deployability, fault isolation, and team parallelism.")

    story += qa_block(3,
        "What are your 8 microservices and what port does each run on?",
        "Profile Service (FastAPI, :8002), Job Service (Node.js, :3002), Application Service (Node.js, :5003), "
        "Connection Service (Node.js, :3005), Messaging Service (Node.js, :3004), Analytics Service (Node.js, :4000), "
        "AI Service (FastAPI, :8005), and the React Frontend (:3000 dev / :80 Docker).")

    story += qa_block(4,
        "How does the frontend communicate with so many backend services?",
        "The React app uses a Vite development proxy. All API calls go to relative paths like /api/v1/jobs, "
        "/api/members, /analytics, /ai — the Vite proxy routes them to the correct service. This means "
        "the browser only ever talks to one origin (port 3000), eliminating CORS issues entirely.")

    story += qa_block(5,
        "What databases do you use and why did you split them that way?",
        "MySQL stores transactional, relational data — members, jobs, applications, connections — because "
        "these need ACID transactions, foreign keys, and full-text search indexes. MongoDB stores "
        "event logs, analytics aggregations, AI task traces, and message bodies — these are append-only, "
        "schema-flexible, and benefit from MongoDB's aggregation pipeline. Redis is a cache layer for "
        "frequently-read job search results (TTL 60s) and single job fetches (TTL 10s).",
        "Key point: justify each DB choice by its access pattern, not just 'we used both'.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — Database Schema
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("2 · Database Schema", LI_DARK))
    story.append(Spacer(1, 8))

    story += qa_block(6,
        "Walk us through your most important MySQL table.",
        "job_postings is the central table. It has a CHAR(36) UUID primary key, recruiter_id and company_id "
        "foreign keys, a FULLTEXT index on (title, description) for keyword search, a JSON column for "
        "skills_required, an ENUM for remote (onsite/remote/hybrid), and counters for views_count and "
        "applicants_count that are updated asynchronously via Kafka consumers.")

    story += qa_block(7,
        "How do you prevent a member from applying to the same job twice?",
        "Two layers: the applications table has a UNIQUE constraint on (job_id, member_id), so any duplicate "
        "INSERT fails at the DB level with a constraint violation. Before that, the applicationController "
        "calls findDuplicate() to check and return a 409 Conflict response with a human-readable message "
        "before the DB is even touched.")

    story += qa_block(8,
        "What is the processed_events table and why does it exist?",
        "Kafka guarantees at-least-once delivery, meaning the same event can arrive more than once if a "
        "consumer crashes mid-processing. The processed_events table stores idempotency_key as a PRIMARY KEY. "
        "Before processing any Kafka event, the consumer checks if that key exists. If it does, the event is "
        "skipped. This prevents double-counting analytics events and duplicate DB writes.",
        "This is the Kafka idempotency requirement from the spec.")

    story += qa_block(9,
        "Why does saved_jobs use a composite primary key instead of a surrogate?",
        "The combination of (user_id, job_id) is naturally unique — a user can only save a job once. "
        "A composite PK enforces this constraint at the DB level with zero extra code, while also serving "
        "as the index for the most common query: 'get all saved jobs for this user'.")

    story += qa_block(10,
        "What indexes did you add and why?",
        "FULLTEXT index on job_postings(title, description) for keyword search — without it, LIKE queries "
        "on 78,986 rows do full table scans. INDEX on saved_jobs(user_id) and INDEX on saved_jobs(job_id) "
        "for fast lookups from both directions. Unique index on applications(job_id, member_id) for dedup. "
        "INDEX on processed_events(idempotency_key) — it's the PK, so automatically indexed.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — Kafka
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("3 · Kafka & Event-Driven Architecture", LI_DARK))
    story.append(Spacer(1, 8))

    story += qa_block(11,
        "What Kafka topics do you have and what triggers each?",
        "14 topics: job.created (POST /jobs/create), job.closed (POST /jobs/close), job.viewed (view API call), "
        "job.saved (save endpoint), application.submitted (apply), application.status_updated (recruiter status change), "
        "connection.requested, connection.accepted, message.sent, member.created, member.updated, profile.viewed, "
        "ai.requests (recruiter submits AI task), ai.results (AI worker completes).")

    story += qa_block(12,
        "Walk us through one complete async Kafka workflow end to end.",
        "Application submission: (1) Member clicks Easy Apply → React POST /applications/submit. "
        "(2) Application service writes to MySQL first (crash-safe: the record is persisted before Kafka). "
        "(3) Producer publishes application.submitted to Kafka. "
        "(4) Job service consumes the event, increments applicants_count on that job. "
        "(5) Analytics service consumes the same event, inserts into MongoDB events collection after "
        "checking idempotency_key. "
        "(6) Recruiter dashboard queries /analytics/recruiter/dashboard and sees the updated count.",
        "Emphasize: DB write before Kafka publish — if Kafka fails, the application is still saved.")

    story += qa_block(13,
        "What is the Kafka event envelope and why is it standardized?",
        "Every Kafka message uses the same JSON structure: event_type, trace_id, timestamp (ISO-8601), "
        "actor_id, entity {entity_type, entity_id}, payload, and idempotency_key. The trace_id stays "
        "the same across a multi-step workflow — so you can trace a single job application from submit → "
        "Kafka → job service → analytics service just by filtering on trace_id in logs.")

    story += qa_block(14,
        "How do you handle Kafka consumer failure?",
        "The idempotency_key in processed_events means even if a consumer crashes and the message is "
        "re-delivered, the second processing attempt hits a PRIMARY KEY conflict and skips the event. "
        "The messaging service also has 3-attempt retry with 500ms backoff on its Kafka producer. "
        "DB writes happen before Kafka publish so partial failures leave the system consistent.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — AI Agent
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("4 · Agentic AI Service", LI_GREEN))
    story.append(Spacer(1, 8))

    story += qa_block(15,
        "What AI agents did you implement?",
        "Two agents: (1) Hiring Assistant — a supervisor agent that orchestrates a 3-step pipeline: "
        "Resume Parser → Job-Candidate Matcher → Outreach Draft Generator. "
        "(2) Career Coach — a standalone FastAPI service that takes a member's skills and a target job, "
        "computes skill gap, and returns matched/missing skills, an overall rating, and a headline suggestion.")

    story += qa_block(16,
        "How does the Hiring Assistant's multi-step workflow work?",
        "Recruiter submits a job_id via POST /ai/submit-task. The route publishes a task to the ai.requests "
        "Kafka topic. The AI worker consumer picks it up and runs: (1) parse_resume() — extracts skills, "
        "years of experience, seniority from resume text. (2) compute_match_score() — 70% weight on skills "
        "overlap + 30% on seniority match. (3) rank_candidates() — sorts by weighted score, returns top-N. "
        "Results publish to ai.results. Frontend streams progress via SSE GET /ai/task-stream/{task_id}.")

    story += qa_block(17,
        "What is human-in-the-loop and where did you implement it?",
        "After the AI ranks candidates, it does NOT automatically send outreach. If a candidate's score is "
        "≥ 80, the task requires explicit recruiter approval via POST /ai/hiring-task/{id}/approve. The "
        "recruiter sees the shortlist in the UI, can approve or reject, and only then does the outreach draft "
        "get finalized. This prevents the AI from taking consequential actions autonomously.",
        "Spec requirement: human-in-loop approval for recruiter-facing outputs.")

    story += qa_block(18,
        "What are your AI evaluation metrics?",
        "Recommendation Quality Score: 8.4/10 average AI rating. Approval Rate: 71% of tasks approved "
        "by recruiters without edits. Avg Skill Match: 67% overlap between candidate skills and job requirements. "
        "Tasks Completed: 41 applications processed. These are tracked per-task in MongoDB ai_db.tasks "
        "under a metrics dict and aggregated via GET /ai/metrics.")

    story += qa_block(19,
        "How does the Career Coach work technically?",
        "It's a synchronous FastAPI endpoint — no Kafka needed for this one since it's a request-response "
        "query, not a long workflow. The member sends their skills array and a target_role string. The service "
        "computes skill_match_pct (intersection / union of skill sets), identifies missing_skills and "
        "bonus_skills, generates an overall_rating 1-10, a headline_suggestion, and a prioritized suggestions[] list.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 5 — Performance
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("5 · Scalability & Performance (JMeter)", LI_RED))
    story.append(Spacer(1, 8))

    story += qa_block(20,
        "What did your JMeter tests show?",
        "We ran 4 test configurations, 100 threads, 5 loops (500 samples each). "
        "B (baseline, no cache): 9.3 TPS, 1,565ms avg latency, P99 = 18,513ms. "
        "B+S (+ Redis): 101.9 TPS, 2ms avg, P99 = 8ms — 10.9× throughput gain, 99.9% latency drop. "
        "B+S+K (+ Kafka): 101.8 TPS, 3ms avg. "
        "B+S+K+X (+ Auth + FTS): 101.6 TPS, 2ms avg. Zero errors across all 4 runs.")

    story += qa_block(21,
        "Why does adding Redis reduce latency from 1,565ms to 2ms?",
        "Without Redis, every job search hits MySQL — it runs a FULLTEXT search on 78,986 rows, "
        "which takes ~1.5 seconds per query. With Redis, search results are cached by sha256(query params) "
        "with a 60-second TTL. A cache hit returns in under 1ms from memory. The 99.9% latency improvement "
        "is almost entirely explained by eliminating the full-text search on every request.")

    story += qa_block(22,
        "Why did you exclude the B (baseline) bar from the charts?",
        "The baseline's 1,565ms average completely crushes the scale — the other three bars (2ms, 3ms, 2ms) "
        "would be invisible. We show B as a red callout box with the exact numbers, and the charts only show "
        "the optimized combinations on a readable scale. The full data is in the JMeter summary table on slide 11.")

    story += qa_block(23,
        "What does the concurrency scaling chart show?",
        "For the B+S (Redis cached) configuration, as concurrency increases linearly — 10, 25, 50, 100 users — "
        "throughput scales near-linearly: 18.7, 43.9, 85.9, 170.6 TPS. This demonstrates that with Redis, "
        "the system is not CPU or DB-bound — it's handling more users without degrading.")

    story += qa_block(24,
        "What does Kafka add to performance? Doesn't it add latency?",
        "Kafka adds only ~1ms overhead (B+S = 2ms vs B+S+K = 3ms). The reason is that Kafka is used for "
        "async side effects — view counter increments, analytics ingestion — not for the main request path. "
        "The HTTP response returns immediately after the DB write; Kafka publishes happen in a try/catch "
        "that does NOT block the response if Kafka is unavailable.")

    story += qa_block(25,
        "What is your cache invalidation strategy?",
        "Two keys: search:{sha256(params)} with TTL 60s, and job:{uuid} with TTL 10s. On job update or "
        "job close, we immediately delete the job:{uuid} key from Redis so the next request gets fresh data. "
        "Search cache expires naturally — 60 seconds is acceptable staleness for search results. "
        "We don't flush all search keys on every update because that would defeat the purpose of caching.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 6 — Analytics
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("6 · Analytics Dashboard", LI_BLUE))
    story.append(Spacer(1, 8))

    story += qa_block(26,
        "What analytics does the recruiter dashboard show?",
        "Top jobs by applications (bar chart), job postings by location (geographic distribution), "
        "low-traction jobs (≤ 2 applications — candidates for boosting), job views over time (daily bar chart), "
        "job saves over time, and an AI shortlist metrics panel (tasks run, avg score, approval rate).")

    story += qa_block(27,
        "How do analytics events flow from user action to dashboard?",
        "User action (e.g., views a job) → job service publishes job.viewed to Kafka → analytics service "
        "Kafka consumer receives it → checks idempotency_key in MongoDB → inserts into events collection with "
        "event_type, actor_id, entity_id, payload, and timestamp → recruiter dashboard calls "
        "GET /analytics/recruiter/dashboard which runs MongoDB aggregation pipelines to compute charts.")

    story += qa_block(28,
        "What is the member analytics dashboard?",
        "Members see: profile views per day for the last 30 days (line/bar chart from profile.viewed events), "
        "and an application status breakdown — how many applications are in submitted/reviewed/accepted/rejected "
        "state. Both come from GET /analytics/member/dashboard?member_id=.")

    story += qa_block(29,
        "How did you populate the analytics database with data?",
        "We seeded 2,021+ synthetic events (job.created, job.viewed, application.submitted) into "
        "MongoDB linkedin_analytics.events using a Node.js seed script. This gave the recruiter dashboard "
        "real data to display. Job views are also generated live as users interact with the app.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 7 — Failure Modes & Security
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("7 · Failure Modes, Security & Edge Cases", LI_ORANGE))
    story.append(Spacer(1, 8))

    story += qa_block(30,
        "What failure modes does your system handle?",
        "Six required cases: (1) Duplicate email registration — 400 from auth service if email exists. "
        "(2) Duplicate application — 409 Conflict, checked pre-DB and enforced by UNIQUE constraint. "
        "(3) Apply to closed job — 400, isJobClosed() HTTP check against job service before insert. "
        "(4) Message send failure — 3 retries with 500ms backoff in Kafka producer config. "
        "(5) Kafka consumer failure + idempotency — processed_events table prevents double processing. "
        "(6) Partial multi-step failure — DB writes happen before Kafka publish, so the record is always saved.")

    story += qa_block(31,
        "How does your authentication work?",
        "JWT tokens signed with HMAC-SHA256, shared secret across profile service (signs), job service "
        "(verifies), and application service (verifies). Tokens include member_id, role (member/recruiter), "
        "and exp timestamp. Each protected route runs the authenticate() middleware which validates the "
        "token's signature and expiry before processing the request. Role mismatches return 403.")

    story += qa_block(32,
        "How do you ensure consistency when a multi-step operation partially fails?",
        "The key pattern is DB-first: write to MySQL before publishing to Kafka. If Kafka is down, "
        "the application/job/connection still exists in the database — the Kafka event is just lost. "
        "The system is eventually consistent: if a Kafka event is re-delivered, idempotency prevents "
        "double processing. For the AI workflow, each step's result is persisted to MongoDB before "
        "the next step runs, so a crash at step 3 leaves steps 1 and 2's results available.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 8 — Docker & Infrastructure
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("8 · Docker, Infrastructure & Deployment", LI_DARK))
    story.append(Spacer(1, 8))

    story += qa_block(33,
        "How is your application containerized?",
        "Every service has its own Dockerfile. Python services use python:3.11-slim, Node.js services use "
        "node:20-alpine (minimal image), and the frontend uses a multi-stage build (node:20 to build → "
        "nginx:alpine to serve the static bundle). All 8 services + Zookeeper + Kafka + MySQL + MongoDB + Redis "
        "are orchestrated via a single docker-compose.yml.")

    story += qa_block(34,
        "What infrastructure services does your docker-compose run?",
        "Zookeeper (:2181, Kafka coordination), Kafka via Confluent Platform (:9092), Kafka UI (:18088 for "
        "topic monitoring), MySQL 8.0 (:3308 to avoid conflict with local MySQL), MongoDB 7.0 (:27017), "
        "and Redis 7 Alpine (:6379).")

    story += qa_block(35,
        "What datasets did you seed and where did they come from?",
        "78,986 job postings from the LinkedIn Job 2023 Kaggle dataset (CSV import via Node.js seed script). "
        "2,484 member profiles from the Kaggle Resume Dataset (seed_from_kaggle.py, extracting name, skills, "
        "experience from Resume.csv). Additional synthetic members generated with Faker. AI task data "
        "seeded via seed_recruiter.py into MongoDB.")

    story.append(Spacer(1, 4))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 9 — Deep-dive / Tricky Questions
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("9 · Potential Deep-Dive / Tricky Questions", LI_RED))
    story.append(Spacer(1, 8))

    story += qa_block(36,
        "Your JMeter numbers seem very fast (2ms). Are they realistic?",
        "Yes, because B+S measures the Redis cache hit path. The request hits the Vite proxy, the proxy "
        "forwards to the job service, the job service checks Redis, gets a cache hit, and returns. That's "
        "3 network hops on localhost — sub-5ms is completely realistic. The 1,565ms baseline is the "
        "realistic uncached full-text search on 78k rows, which is also realistic for a cold DB.")

    story += qa_block(37,
        "Why does P99 jump to 24ms for B+S+K but P99 for B+S+K+X is only 6ms?",
        "This is a JMeter sampling artifact — with 500 samples and 100 threads, the P99 value is computed "
        "from only 5 data points (1% of 500). A single slow request in that batch can spike P99. The median "
        "and average remain stable (2-3ms). The +X configuration happened to have no outliers in its 5 P99 "
        "samples.")

    story += qa_block(38,
        "What would you improve if you had more time?",
        "Three things: (1) Actual ML-based embeddings for the job-candidate matcher instead of simple "
        "skills set overlap — use sentence-transformers for semantic matching. "
        "(2) WebSocket connections instead of SSE for bidirectional real-time messaging. "
        "(3) Horizontal scaling: run multiple job-service instances behind a load balancer and verify "
        "that Redis cache is shared correctly across replicas (it is — Redis is external to the service).")

    story += qa_block(39,
        "How does the full-text search work technically?",
        "MySQL FULLTEXT index on job_postings(title, description) using InnoDB's built-in FTS. Queries use "
        "MATCH(title, description) AGAINST (? IN BOOLEAN MODE). Boolean mode supports +word (required), "
        "-word (excluded), and wildcard*. Minimum token length is 3 characters. The index is automatically "
        "maintained on INSERT/UPDATE.")

    story += qa_block(40,
        "Why did you use Server-Sent Events (SSE) instead of WebSockets?",
        "SSE is simpler for one-directional server-push — AI task progress only flows server → client, "
        "not the other way. SSE works over plain HTTP/1.1 (no upgrade handshake), is automatically "
        "reconnected by the browser, and is proxied correctly by Vite without any special configuration. "
        "WebSockets would add complexity for no benefit in this specific use case.")

    story += qa_block(41,
        "Explain trace_id and why it matters.",
        "trace_id is a UUID generated once when a workflow starts (e.g., application submit). It is "
        "included in every Kafka event envelope and every MongoDB document produced by that workflow. "
        "This means you can filter logs by trace_id and see the complete lifecycle: HTTP request → "
        "Kafka publish → consumer processing → DB write → analytics ingestion — all linked by one ID. "
        "This is distributed tracing without a separate tracing system.",
        "Connect to: observability, debugging in production, the spec's requirement for trace_id.")

    story += qa_block(42,
        "What is the funnel analytics endpoint and what does it show?",
        "GET /analytics/funnel?job_id= returns a 6-stage conversion funnel: "
        "job_viewed → job_saved → application_submitted → application_reviewed → application_accepted. "
        "Each stage shows the count of events that reached it. This lets a recruiter see where candidates "
        "drop off — e.g., 500 views, 50 saves, 20 applications, 5 reviewed, 2 accepted.")

    # ══════════════════════════════════════════════════════════════════════════
    # Footer
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 12))
    footer_data = [[Paragraph(
        "DATA 236 · LinkedIn Platform · Group 6  |  Spring 2025  |  42 Questions Covered",
        S('Footer', fontSize=9, textColor=white, fontName='Helvetica', alignment=TA_CENTER))]]
    footer = Table(footer_data, colWidths=[7.0*inch])
    footer.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LI_DARK),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(footer)

    doc.build(story)
    print("Saved: /Users/dipinjassal/sem_2/linkedin/presentation/Presentation_QA_Guide.pdf")

build()

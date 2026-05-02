#!/usr/bin/env python3
"""
Idempotent demo seed for Docker Compose: MySQL (data236 + application_db) + MongoDB analytics.

Runs after profile/job/application services have started (tables exist).
Env:
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD
  MYSQL_DB_DATA236 (default data236), MYSQL_DB_APPLICATION (default application_db)
  MONGODB_URI (default mongodb://mongodb:27017/linkedin_analytics)
  SEED_RECRUITER_EMAIL, SEED_RECRUITER_FIRST_NAME, SEED_RECRUITER_LAST_NAME
  SEED_PASSWORD (default Password123!)
  CSV_MAX_ROWS — if > 0, bulk-load job CSV after demo seed (default 500)
  CSV_PATH — path inside container (default /data/sample_jobs.csv)
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import pymongo
import pymysql
from pymongo.errors import BulkWriteError


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _env_or(key: str, default: str) -> str:
    v = os.getenv(key)
    return (default if v is None or not str(v).strip() else str(v).strip())


MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB_DATA236 = os.getenv("MYSQL_DB_DATA236", "data236")
MYSQL_DB_APPLICATION = os.getenv("MYSQL_DB_APPLICATION", "application_db")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/linkedin_analytics")
SEED_PASSWORD = _env_or("SEED_PASSWORD", "Password123!")
SEED_EMAIL = _env_or("SEED_RECRUITER_EMAIL", "recruiter.demo@linkedin-sim.example")
SEED_FIRST = _env_or("SEED_RECRUITER_FIRST_NAME", "Demo")
SEED_LAST = _env_or("SEED_RECRUITER_LAST_NAME", "Recruiter")

RECRUITER_MEMBER_ID = _env_or("SEED_RECRUITER_MEMBER_ID", "m_447299a83400")
RECRUITER_USER_ID = _env_or("SEED_RECRUITER_USER_ID", "u_rec_demo_seed")
COMPANY_ID = os.getenv("SEED_COMPANY_ID", str(uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")))
COMPANY_NAME = os.getenv("SEED_COMPANY_NAME", "TechNova Inc.")

CSV_PATH = Path(os.getenv("CSV_PATH", "/data/sample_jobs.csv"))
CSV_MAX_ROWS = int(os.getenv("CSV_MAX_ROWS", "500"))

MEMBER_IDS = [
    "m_aee72c551e7d",
    "m_c01cc684168f",
    "m_e266a89d26a4",
    "m_85a0f0f5b76b",
    "m_b9b113602b68",
    "m_cdb661cb50c1",
    "m_30eff1518695",
    "m_f0b15ec177a9",
    "m_c0af184cf664",
    "m_5501ee241d83",
    "m_f9d0cd120bd6",
    "m_8eb3734e02dd",
    "m_2e40a7fbe12e",
    "m_d6d76f2f55d2",
    "m_8359ebdd3a01",
    "m_c50174d41e0a",
    "m_9386b802d0c2",
    "m_00563ef00848",
    "m_ffdfed034f34",
    "m_b095fca87d2b",
]

JOBS_FIXED_IDS = [
    "job-c0c9df0e",
    "job-265cb481",
    "job-687db1f6",
    "job-f59cadd8",
    "job-e5a2e444",
    "job-376bf862",
    "job-66507afd",
    "job-311d87b3",
]

JOBS = [
    {
        "title": "Senior Software Engineer",
        "location": "San Francisco, CA",
        "employment_type": "full_time",
        "seniority_level": "Senior",
        "remote": "hybrid",
        "salary_min": 160000,
        "salary_max": 210000,
        "skills": ["Python", "AWS", "Kubernetes", "React"],
        "description": "Build scalable backend systems for our cloud platform.",
    },
    {
        "title": "Frontend Engineer",
        "location": "New York, NY",
        "employment_type": "full_time",
        "seniority_level": "Mid-Senior",
        "remote": "remote",
        "salary_min": 130000,
        "salary_max": 170000,
        "skills": ["React", "TypeScript", "GraphQL", "CSS"],
        "description": "Join our product team building next-gen user interfaces.",
    },
    {
        "title": "Data Scientist",
        "location": "Seattle, WA",
        "employment_type": "full_time",
        "seniority_level": "Mid-Senior",
        "remote": "hybrid",
        "salary_min": 145000,
        "salary_max": 195000,
        "skills": ["Python", "Machine Learning", "SQL", "PyTorch"],
        "description": "Drive ML initiatives across recommendation and personalization.",
    },
    {
        "title": "DevOps Engineer",
        "location": "Austin, TX",
        "employment_type": "full_time",
        "seniority_level": "Mid-Senior",
        "remote": "onsite",
        "salary_min": 125000,
        "salary_max": 160000,
        "skills": ["Terraform", "AWS", "Docker", "CI/CD"],
        "description": "Maintain and improve infrastructure reliability and deployments.",
    },
    {
        "title": "Product Manager",
        "location": "Chicago, IL",
        "employment_type": "full_time",
        "seniority_level": "Senior",
        "remote": "hybrid",
        "salary_min": 140000,
        "salary_max": 185000,
        "skills": ["Product Strategy", "Agile", "SQL", "Roadmapping"],
        "description": "Lead cross-functional teams to ship impactful product experiences.",
    },
    {
        "title": "Machine Learning Engineer",
        "location": "Boston, MA",
        "employment_type": "full_time",
        "seniority_level": "Senior",
        "remote": "hybrid",
        "salary_min": 165000,
        "salary_max": 220000,
        "skills": ["Python", "TensorFlow", "MLOps", "Spark"],
        "description": "Build and deploy production ML models at scale.",
    },
    {
        "title": "Backend Engineer (Node.js)",
        "location": "Denver, CO",
        "employment_type": "full_time",
        "seniority_level": "Mid",
        "remote": "remote",
        "salary_min": 115000,
        "salary_max": 150000,
        "skills": ["Node.js", "PostgreSQL", "REST APIs", "Redis"],
        "description": "Design and build APIs powering our core platform.",
    },
    {
        "title": "UX/UI Designer",
        "location": "Los Angeles, CA",
        "employment_type": "full_time",
        "seniority_level": "Mid-Senior",
        "remote": "hybrid",
        "salary_min": 110000,
        "salary_max": 145000,
        "skills": ["Figma", "User Research", "Design Systems", "Prototyping"],
        "description": "Shape visual and interaction design across web and mobile.",
    },
]

ANALYTICS_JOBS = [
    {"job_id": jid, "title": j["title"], "location": j["location"]}
    for jid, j in zip(JOBS_FIXED_IDS, JOBS)
]

STATUSES = ["submitted", "reviewed", "accepted", "rejected"]
STATUS_WEIGHTS = [4, 3, 1, 2]


def wait_mysql(timeout: float = 180.0) -> None:
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            conn = pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                charset="utf8mb4",
                connect_timeout=5,
            )
            conn.close()
            print("✓ MySQL reachable", flush=True)
            return
        except Exception as e:
            last_err = e
            time.sleep(2)
    raise RuntimeError(f"MySQL not reachable: {last_err}")


def wait_table(db: str, table: str, timeout: float = 180.0) -> None:
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            conn = pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=db,
                charset="utf8mb4",
                connect_timeout=5,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM information_schema.tables WHERE table_schema=%s AND table_name=%s",
                        (db, table),
                    )
                    if cur.fetchone():
                        print(f"✓ Table {db}.{table} exists", flush=True)
                        return
            finally:
                conn.close()
        except Exception as e:
            last_err = e
        time.sleep(2)
    raise RuntimeError(f"Timeout waiting for {db}.{table}: {last_err}")


def seed_members_and_users(hp: str) -> str:
    """Upsert recruiter + demo pool; return canonical recruiter member_id (may differ from RECRUITER_MEMBER_ID if email exists)."""
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB_DATA236,
        charset="utf8mb4",
    )
    empty = json.dumps([])
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT member_id FROM members WHERE LOWER(TRIM(email)) = LOWER(TRIM(%s)) LIMIT 1",
                (SEED_EMAIL,),
            )
            existing_email = cur.fetchone()
            if existing_email:
                recruiter_mid = existing_email[0]
                cur.execute(
                    "UPDATE members SET first_name=%s, last_name=%s WHERE member_id=%s",
                    (SEED_FIRST, SEED_LAST, recruiter_mid),
                )
            else:
                cur.execute(
                    "SELECT 1 FROM members WHERE member_id = %s LIMIT 1",
                    (RECRUITER_MEMBER_ID,),
                )
                if cur.fetchone():
                    recruiter_mid = RECRUITER_MEMBER_ID
                    cur.execute(
                        """
                        UPDATE members SET first_name=%s, last_name=%s, email=%s
                        WHERE member_id=%s
                        """,
                        (SEED_FIRST, SEED_LAST, SEED_EMAIL, recruiter_mid),
                    )
                else:
                    recruiter_mid = RECRUITER_MEMBER_ID
                    cur.execute(
                        """
                        INSERT INTO members (member_id, first_name, last_name, email, skills_json, experience_json, education_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            recruiter_mid,
                            SEED_FIRST,
                            SEED_LAST,
                            SEED_EMAIL,
                            empty,
                            empty,
                            empty,
                        ),
                    )

            cur.execute(
                "SELECT user_id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(%s)) LIMIT 1",
                (SEED_EMAIL,),
            )
            recruiter_user = cur.fetchone()
            if recruiter_user:
                cur.execute(
                    """
                    UPDATE users SET hashed_password=%s, member_id=%s, role='recruiter'
                    WHERE user_id=%s
                    """,
                    (hp, recruiter_mid, recruiter_user[0]),
                )
            else:
                cur.execute(
                    "SELECT user_id FROM users WHERE user_id=%s LIMIT 1",
                    (RECRUITER_USER_ID,),
                )
                if cur.fetchone():
                    cur.execute(
                        """
                        UPDATE users SET email=%s, hashed_password=%s, member_id=%s, role='recruiter'
                        WHERE user_id=%s
                        """,
                        (SEED_EMAIL, hp, recruiter_mid, RECRUITER_USER_ID),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO users (user_id, email, hashed_password, member_id, role)
                        VALUES (%s, %s, %s, %s, 'recruiter')
                        """,
                        (RECRUITER_USER_ID, SEED_EMAIL, hp, recruiter_mid),
                    )

            for mid in MEMBER_IDS:
                if mid == recruiter_mid:
                    continue
                suf = mid.replace("m_", "", 1)
                email = f"seed.{suf}@linkedin-sim.example"
                cur.execute(
                    """
                    INSERT INTO members (member_id, first_name, last_name, email, skills_json, experience_json, education_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name)
                    """,
                    (mid, "Seed", f"Member{suf[-6:]}", email, empty, empty, empty),
                )
                uid = f"u_{suf}"
                cur.execute(
                    """
                    INSERT INTO users (user_id, email, hashed_password, member_id, role)
                    VALUES (%s, %s, %s, %s, 'member')
                    ON DUPLICATE KEY UPDATE email=VALUES(email), hashed_password=VALUES(hashed_password),
                      member_id=VALUES(member_id), role='member'
                    """,
                    (uid, email, hp, mid),
                )
        conn.commit()
        print(
            f"✓ Recruiter ({recruiter_mid}) + {len(MEMBER_IDS)} demo members/users upserted",
            flush=True,
        )
        return recruiter_mid
    finally:
        conn.close()


def seed_jobs_data236(recruiter_mid: str) -> None:
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB_DATA236,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            for jid, job in zip(JOBS_FIXED_IDS, JOBS):
                posted = datetime.now() - timedelta(days=random.randint(1, 30))
                cur.execute(
                    """
                    INSERT INTO job_postings
                      (job_id, company_id, company_name, recruiter_id, title, description,
                       seniority_level, employment_type, location, remote,
                       skills_required, salary_min, salary_max,
                       posted_datetime, status, views_count, applicants_count)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'open', %s, 0)
                    ON DUPLICATE KEY UPDATE
                      title=VALUES(title), description=VALUES(description), company_name=VALUES(company_name),
                      recruiter_id=VALUES(recruiter_id), posted_datetime=VALUES(posted_datetime),
                      views_count=VALUES(views_count), status='open'
                    """,
                    (
                        jid,
                        COMPANY_ID,
                        COMPANY_NAME,
                        recruiter_mid,
                        job["title"],
                        job["description"],
                        job["seniority_level"],
                        job["employment_type"],
                        job["location"],
                        job["remote"],
                        json.dumps(job["skills"]),
                        job["salary_min"],
                        job["salary_max"],
                        posted,
                        random.randint(50, 400),
                    ),
                )
        conn.commit()
        print(f"✓ {len(JOBS_FIXED_IDS)} demo jobs upserted in {MYSQL_DB_DATA236}", flush=True)
    finally:
        conn.close()


def seed_applications(recruiter_mid: str) -> None:
    app_conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB_APPLICATION,
        charset="utf8mb4",
    )
    data236 = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB_DATA236,
        charset="utf8mb4",
    )
    try:
        random.seed(42)
        with app_conn.cursor() as ac:
            for i, jid in enumerate(JOBS_FIXED_IDS):
                job_title = JOBS[i]["title"]
                n = random.randint(2, 6)
                applicants = random.sample(MEMBER_IDS, min(n, len(MEMBER_IDS)))
                for member_id in applicants:
                    aid = "app-" + uuid.uuid4().hex[:8]
                    status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
                    applied_at = datetime.now() - timedelta(days=random.randint(0, 20))
                    cover = (
                        f"I am excited to apply for the {job_title} role at {COMPANY_NAME}. "
                        f"My background aligns well with your team's needs."
                    )
                    ac.execute(
                        """
                        INSERT INTO applications
                          (application_id, job_id, member_id, recruiter_id, resume_url, cover_letter, metadata, status, created_at, updated_at)
                        VALUES (%s,%s,%s,%s,NULL,%s,NULL,%s,%s,%s)
                        ON DUPLICATE KEY UPDATE status=VALUES(status), cover_letter=VALUES(cover_letter), updated_at=VALUES(updated_at)
                        """,
                        (
                            aid,
                            jid,
                            member_id,
                            recruiter_mid,
                            cover,
                            status,
                            applied_at,
                            applied_at,
                        ),
                    )
            app_conn.commit()
        print(f"✓ Applications upserted ({MYSQL_DB_APPLICATION})", flush=True)

        with app_conn.cursor() as ac:
            with data236.cursor() as jc:
                for jid in JOBS_FIXED_IDS:
                    ac.execute(
                        "SELECT COUNT(*) FROM applications WHERE job_id=%s AND status NOT IN ('draft','withdrawn')",
                        (jid,),
                    )
                    cnt = ac.fetchone()[0]
                    jc.execute(
                        "UPDATE job_postings SET applicants_count=%s WHERE job_id=%s",
                        (cnt, jid),
                    )
            data236.commit()
        print("✓ job_postings.applicants_count synced", flush=True)
    finally:
        app_conn.close()
        data236.close()


def seed_mongo_analytics(recruiter_mid: str) -> None:
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    db = client.get_database()
    meta = db.seed_meta
    col = db.events
    probe = {"idempotency_key": "job-created-job-c0c9df0e"}
    if meta.find_one({"_id": "demo_analytics_v1"}) or col.find_one(probe):
        print("⊙ Mongo analytics demo already present, skipping event inserts", flush=True)
        meta.update_one(
            {"_id": "demo_analytics_v1"},
            {"$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        client.close()
        return
    random.seed(42)
    events: list[dict] = []
    now = datetime.now(timezone.utc)

    def days_ago(n: int) -> str:
        d = now - timedelta(days=n)
        return d.isoformat()

    def ri(a: int, b: int) -> int:
        return random.randint(a, b)

    def pick_member() -> str:
        return random.choice(MEMBER_IDS)

    for job in ANALYTICS_JOBS:
        jid = job["job_id"]
        events.append(
            {
                "event_type": "job.created",
                "idempotency_key": f"job-created-{jid}",
                "timestamp": days_ago(ri(20, 30)),
                "payload": {
                    "job_id": jid,
                    "recruiter_id": recruiter_mid,
                    "title": job["title"],
                    "location": job["location"],
                },
                "_ingested_at": now,
            }
        )
        for i in range(ri(30, 150)):
            events.append(
                {
                    "event_type": "job.viewed",
                    "idempotency_key": f"job-viewed-{jid}-{i}",
                    "timestamp": days_ago(ri(0, 20)),
                    "payload": {"job_id": jid, "viewer_id": pick_member()},
                    "_ingested_at": now,
                }
            )
        for i in range(ri(5, 25)):
            events.append(
                {
                    "event_type": "job.saved",
                    "idempotency_key": f"job-saved-{jid}-{i}",
                    "timestamp": days_ago(ri(0, 15)),
                    "payload": {"job_id": jid, "user_id": pick_member()},
                    "_ingested_at": now,
                }
            )

        applicants = sorted(MEMBER_IDS, key=lambda _: random.random())[: ri(3, 7)]
        aw = [0.35, 0.30, 0.15, 0.20]
        for member_id in applicants:
            app_days = ri(0, 18)
            app_id = "app-" + uuid.uuid4().hex[:8]
            events.append(
                {
                    "event_type": "application.submitted",
                    "idempotency_key": f"app-submitted-{app_id}",
                    "timestamp": days_ago(app_days),
                    "payload": {
                        "application_id": app_id,
                        "job_id": jid,
                        "member_id": member_id,
                        "recruiter_id": recruiter_mid,
                        "status": "submitted",
                    },
                    "_ingested_at": now,
                }
            )
            if random.random() > 0.3:
                rnd = random.random()
                cumulative = 0.0
                st = "reviewed"
                for s, w in zip(STATUSES, aw):
                    cumulative += w
                    if rnd < cumulative:
                        st = s
                        break
                if st != "submitted":
                    events.append(
                        {
                            "event_type": "application.status_updated",
                            "idempotency_key": f"app-status-{app_id}-{st}",
                            "timestamp": days_ago(max(0, app_days - 1)),
                            "payload": {
                                "application_id": app_id,
                                "job_id": jid,
                                "member_id": member_id,
                                "recruiter_id": recruiter_mid,
                                "status": st,
                            },
                            "_ingested_at": now,
                        }
                    )

    inserted = 0
    try:
        if events:
            try:
                res = col.insert_many(events, ordered=False)
                inserted = len(res.inserted_ids)
            except BulkWriteError as bwe:
                details = bwe.details or {}
                errs = details.get("writeErrors") or []
                inserted = int(details.get("nInserted") or 0)
                fatal = [e for e in errs if e.get("code") != 11000]
                if fatal:
                    raise
                print(
                    f"⊙ Mongo bulk insert: {inserted} inserted, "
                    f"{len(errs)} write errors (dup keys ignored)",
                    flush=True,
                )
        meta.update_one(
            {"_id": "demo_analytics_v1"},
            {"$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        print(f"✓ Mongo analytics: {inserted} new events (stack ready)", flush=True)
    finally:
        client.close()


EMPLOYMENT_TYPES = frozenset({"PART_TIME", "FULL_TIME", "CONTRACT", "INTERNSHIP"})


def norm_employment_type(raw: str) -> str:
    s = (raw or "").strip().upper().replace("-", "_")
    m = {
        "PART_TIME": "part_time",
        "FULL_TIME": "full_time",
        "CONTRACT": "contract",
        "INTERNSHIP": "internship",
        "TEMPORARY": "temporary",
    }
    return m.get(s, s.lower().replace(" ", "_"))


def _parse_sample_jobs_line(line: str) -> dict[str, str] | None:
    """
    Parse sample_jobs.csv rows where `location` may contain commas (unquoted CSV).
    Anchors on trailing fields: views_count, applicants_count, status, posted_datetime, recruiter_id.
    """
    line = line.strip()
    if not line or line.startswith("job_id,"):
        return None
    parts = line.rsplit(",", 5)
    if len(parts) != 6:
        return None
    prefix, views_s, apps_s, status, dt_s, rid = parts
    sub = prefix.split(",")
    et_idx = None
    for i, tok in enumerate(sub):
        if tok in EMPLOYMENT_TYPES:
            et_idx = i
            break
    if et_idx is None or et_idx < 3 or len(sub) < et_idx + 5:
        return None
    job_id = sub[0].strip()
    title = sub[1].strip()
    company_id = sub[2].strip()
    location = ",".join(sub[3:et_idx]).strip()
    employment_type = sub[et_idx].strip()
    seniority_level = sub[et_idx + 1].strip()
    remote = sub[et_idx + 2].strip()
    description = ",".join(sub[et_idx + 3 : -2]).strip()
    skills_raw = sub[-2].strip()
    industry = sub[-1].strip()
    return {
        "job_id": job_id,
        "title": title,
        "company_id": company_id,
        "location": location,
        "employment_type": employment_type,
        "seniority_level": seniority_level,
        "remote": remote,
        "description": description,
        "skills_required": skills_raw,
        "industry": industry,
        "views_count": views_s.strip(),
        "applicants_count": apps_s.strip(),
        "status": status.strip(),
        "posted_datetime": dt_s.strip(),
        "recruiter_id": rid.strip(),
    }


def load_jobs_csv(max_rows: int) -> None:
    if max_rows <= 0:
        return

    if not CSV_PATH.is_file():
        print(f"⊙ CSV not found at {CSV_PATH}, skipping bulk job load", flush=True)
        return

    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB_DATA236,
        charset="utf8mb4",
    )
    inserted = 0
    processed = 0
    try:
        with conn.cursor() as cur:
            with CSV_PATH.open(encoding="utf-8") as fh:
                for line in fh:
                    if processed >= max_rows:
                        break
                    row = _parse_sample_jobs_line(line)
                    if not row:
                        continue
                    processed += 1
                    skills_list = [x.strip() for x in row["skills_required"].split("|") if x.strip()]
                    jid = row["job_id"]
                    if not jid:
                        continue
                    et = norm_employment_type(row["employment_type"])
                    remote = row["remote"].lower()
                    if remote not in ("onsite", "remote", "hybrid"):
                        remote = "onsite"
                    status = row["status"].lower()
                    if status not in ("open", "closed"):
                        status = "open"
                    try:
                        posted = datetime.strptime(row["posted_datetime"], "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        posted = datetime.now()

                    cur.execute(
                        """
                        INSERT IGNORE INTO job_postings
                          (job_id, company_id, company_name, recruiter_id, title, description,
                           seniority_level, employment_type, location, industry, remote,
                           skills_required, salary_min, salary_max,
                           posted_datetime, status, views_count, applicants_count)
                        VALUES
                          (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, NULL, %s, %s, %s, %s)
                        """,
                        (
                            jid,
                            row["company_id"],
                            None,
                            row["recruiter_id"],
                            row["title"][:255],
                            row["description"][:65000],
                            row["seniority_level"][:64] or None,
                            et[:64],
                            row["location"][:255],
                            row["industry"][:128] or None,
                            remote,
                            json.dumps(skills_list),
                            posted,
                            status,
                            int(row["views_count"] or 0),
                            int(row["applicants_count"] or 0),
                        ),
                    )
                    inserted += cur.rowcount
        conn.commit()
        print(
            f"✓ CSV job load: parsed {processed} rows (INSERT IGNORE inserted {inserted} new rows)",
            flush=True,
        )
    finally:
        conn.close()


def main() -> None:
    print("=== db-seed: demo + optional CSV ===", flush=True)
    wait_mysql()
    wait_table(MYSQL_DB_DATA236, "members")
    wait_table(MYSQL_DB_DATA236, "job_postings")
    wait_table(MYSQL_DB_APPLICATION, "applications")

    hp = _hash_password(SEED_PASSWORD)
    recruiter_mid = seed_members_and_users(hp)
    seed_jobs_data236(recruiter_mid)
    seed_applications(recruiter_mid)
    seed_mongo_analytics(recruiter_mid)
    load_jobs_csv(CSV_MAX_ROWS)
    print("=== db-seed finished OK ===", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

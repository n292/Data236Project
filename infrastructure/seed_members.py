#!/usr/bin/env python3
"""
seed_members.py — Kaggle ProxyCurl 10k US People Profiles ingestion pipeline
=============================================================================

Downloads and processes the Kaggle dataset:
  proxycurl/10000-us-people-profiles

Inserts into:
  data236.members   (profile data)
  data236.users     (auth accounts, role=member)

All seeded users can log in with:
  email:    <their email from dataset or generated>
  password: Password123!

Usage:
  python seed_members.py [--dry-run] [--inspect-only] [--limit N]

Options:
  --dry-run       Transform and print first 5 records, no DB writes
  --inspect-only  Print dataset stats and schema mapping, then exit
  --limit N       Only import first N records (default: all 10000)
  --no-users      Skip user account creation (members only)
"""

import json
import os
import re
import sys
import uuid
import hashlib
import random
import time
from pathlib import Path

# ── Dependencies ─────────────────────────────────────────────────────────────

try:
    import kagglehub
except ImportError:
    print("ERROR: pip install kagglehub", file=sys.stderr); sys.exit(1)

try:
    import pymysql
except ImportError:
    print("ERROR: pip install pymysql", file=sys.stderr); sys.exit(1)

try:
    import bcrypt
except ImportError:
    print("ERROR: pip install bcrypt", file=sys.stderr); sys.exit(1)

# ── Config ───────────────────────────────────────────────────────────────────

DATASET_ID   = "proxycurl/10000-us-people-profiles"
SEED_PASSWORD = "Password123!"
BATCH_SIZE   = 500
DB_CONFIG    = {
    "host":     os.getenv("MYSQL_HOST",     "localhost"),
    "port":     int(os.getenv("MYSQL_PORT", "3306")),
    "user":     os.getenv("MYSQL_USER",     "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DB",       "data236"),
    "charset":  "utf8mb4",
    "connect_timeout": 10,
}

DRY_RUN      = "--dry-run"      in sys.argv
INSPECT_ONLY = "--inspect-only" in sys.argv
NO_USERS     = "--no-users"     in sys.argv
LIMIT = None
for i, arg in enumerate(sys.argv):
    if arg == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

# ── Skills keyword lookup (derived from headline/occupation since dataset
#    skills field is always None) ─────────────────────────────────────────────

TITLE_SKILLS = {
    "software":     ["Python", "JavaScript", "SQL", "Git", "REST APIs", "Docker"],
    "engineer":     ["Python", "Java", "SQL", "Git", "Linux", "Agile"],
    "developer":    ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git"],
    "data":         ["Python", "SQL", "Pandas", "Tableau", "Excel", "Statistics"],
    "machine learning": ["Python", "TensorFlow", "PyTorch", "Scikit-learn", "SQL"],
    "ml":           ["Python", "TensorFlow", "PyTorch", "NumPy", "Pandas"],
    "devops":       ["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD", "Linux"],
    "cloud":        ["AWS", "GCP", "Azure", "Terraform", "Docker", "Kubernetes"],
    "frontend":     ["React", "TypeScript", "CSS", "HTML", "JavaScript", "Figma"],
    "backend":      ["Python", "Java", "Node.js", "SQL", "REST APIs", "Redis"],
    "full stack":   ["React", "Node.js", "Python", "PostgreSQL", "Docker"],
    "product":      ["Roadmapping", "Agile", "Jira", "Analytics", "SQL", "Figma"],
    "manager":      ["Leadership", "Agile", "Project Management", "Excel", "Jira"],
    "director":     ["Strategy", "Leadership", "P&L Management", "Stakeholder Management"],
    "vp":           ["Strategy", "Leadership", "Budgeting", "Team Management"],
    "analyst":      ["SQL", "Excel", "Tableau", "Python", "PowerPoint", "Jira"],
    "finance":      ["Excel", "Financial Modeling", "SQL", "Bloomberg", "Accounting"],
    "accounting":   ["Excel", "QuickBooks", "SAP", "Financial Reporting", "Tax"],
    "marketing":    ["Google Analytics", "SEO", "HubSpot", "Salesforce", "Excel"],
    "sales":        ["CRM", "Salesforce", "Negotiation", "HubSpot", "Excel"],
    "hr":           ["HRIS", "Workday", "Recruiting", "Employee Relations", "Excel"],
    "recruiter":    ["ATS", "LinkedIn Recruiter", "Sourcing", "Interviewing"],
    "design":       ["Figma", "Adobe XD", "Sketch", "Photoshop", "Illustrator"],
    "ux":           ["Figma", "User Research", "Prototyping", "Usability Testing"],
    "security":     ["SIEM", "Penetration Testing", "OWASP", "Network Security"],
    "consultant":   ["PowerPoint", "Excel", "SQL", "Project Management", "Strategy"],
    "nurse":        ["EMR", "Patient Care", "HIPAA", "Clinical Research", "Epic"],
    "healthcare":   ["EMR", "HIPAA", "Patient Care", "Clinical Documentation"],
    "teacher":      ["Curriculum Development", "Google Classroom", "Assessment"],
    "professor":    ["Research", "Publishing", "Grant Writing", "Mentoring"],
    "legal":        ["Legal Research", "Westlaw", "Contract Review", "Litigation"],
    "attorney":     ["Legal Research", "Westlaw", "Contract Review", "Negotiation"],
    "operations":   ["Process Improvement", "Six Sigma", "Excel", "ERP", "Lean"],
    "project":      ["MS Project", "Agile", "Scrum", "Risk Management", "Jira"],
    "supply chain": ["SAP", "ERP", "Logistics", "Procurement", "Excel"],
    "logistics":    ["SAP", "Logistics", "Supply Chain", "Warehousing", "Excel"],
    "construction": ["AutoCAD", "Project Management", "Safety Compliance", "Budgeting"],
    "real estate":  ["CRM", "Negotiation", "Contract Management", "Market Analysis"],
    "insurance":    ["Risk Assessment", "Underwriting", "CRM", "Policy Analysis"],
    "banking":      ["Excel", "Risk Management", "Financial Analysis", "Bloomberg"],
    "investment":   ["Financial Modeling", "Bloomberg", "Excel", "CFA", "Valuation"],
}

FALLBACK_SKILLS = ["Communication", "Teamwork", "Problem Solving", "Microsoft Office", "Excel"]

# ── Helpers ───────────────────────────────────────────────────────────────────

def make_member_id() -> str:
    return f"m_{uuid.uuid4().hex[:12]}"

def make_user_id() -> str:
    return f"u_{uuid.uuid4().hex[:12]}"

def safe_str(v, max_len=255) -> str | None:
    if v is None or str(v).lower() in ("none", "null", ""):
        return None
    return str(v).strip()[:max_len]

def derive_skills(headline: str | None, occupation: str | None) -> list[str]:
    text = " ".join(filter(None, [headline, occupation])).lower()
    matched = []
    for keyword, skills in TITLE_SKILLS.items():
        if keyword in text:
            matched.extend(skills)
    # Deduplicate while preserving order
    seen, unique = set(), []
    for s in matched:
        if s not in seen:
            seen.add(s); unique.append(s)
    if not unique:
        return random.sample(FALLBACK_SKILLS, 3)
    return unique[:8]

def transform_experiences(raw: list | None) -> list:
    if not raw:
        return []
    out = []
    for exp in raw[:5]:  # cap at 5 experiences
        if not isinstance(exp, dict):
            continue
        starts = exp.get("starts_at") or {}
        ends   = exp.get("ends_at")   or {}
        out.append({
            "company":     safe_str(exp.get("company"), 200)     or "Unknown Company",
            "title":       safe_str(exp.get("title"), 200)       or "Professional",
            "start_year":  starts.get("year"),
            "end_year":    ends.get("year") if ends else None,
            "description": safe_str(exp.get("description"), 500) or None,
            "location":    safe_str(exp.get("location"), 150)    or None,
        })
    return out

def transform_education(raw: list | None) -> list:
    if not raw:
        return []
    out = []
    for edu in raw[:3]:
        if not isinstance(edu, dict):
            continue
        ends = edu.get("ends_at") or {}
        out.append({
            "school":         safe_str(edu.get("school"), 200)         or "University",
            "degree":         safe_str(edu.get("degree_name"), 100)    or "B.S.",
            "field_of_study": safe_str(edu.get("field_of_study"), 150) or None,
            "grad_year":      ends.get("year"),
        })
    return out

def build_resume_text(rec: dict) -> str | None:
    parts = []
    fn, ln = rec.get("first_name",""), rec.get("last_name","")
    if fn or ln:
        parts.append(f"{fn} {ln}".strip())
    if rec.get("headline"):
        parts.append(rec["headline"])
    if rec.get("summary"):
        parts.append(rec["summary"])
    for exp in (rec.get("experiences") or [])[:3]:
        if isinstance(exp, dict):
            title = exp.get("title",""); company = exp.get("company","")
            desc  = exp.get("description","")
            if title or company:
                parts.append(f"{title} at {company}".strip(" at"))
            if desc:
                parts.append(str(desc)[:300])
    for edu in (rec.get("education") or [])[:2]:
        if isinstance(edu, dict):
            school  = edu.get("school","")
            degree  = edu.get("degree_name","")
            field   = edu.get("field_of_study","")
            if school:
                parts.append(f"{degree} {field} – {school}".strip())
    text = "\n".join(p for p in parts if p)
    return text[:8000] if text else None

def generate_email(first: str, last: str, used: set) -> str:
    slug = re.sub(r"[^a-z0-9]", "", f"{first.lower()}.{last.lower()}")
    slug = slug or "user"
    base = f"{slug}@linkedin-sim.example"
    if base not in used:
        return base
    # Collision — add short hash
    h = hashlib.sha1(f"{first}{last}{len(used)}".encode()).hexdigest()[:6]
    return f"{slug}.{h}@linkedin-sim.example"

def avatar_url(first: str, last: str) -> str:
    seed = re.sub(r"\s+", "_", f"{first}_{last}").lower()
    return f"https://api.dicebear.com/7.x/personas/svg?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf"

# ── Step 1+2: Load and inspect dataset ────────────────────────────────────────

def load_dataset(limit: int | None = None) -> tuple[list[dict], str]:
    print("▶ Step 1: Downloading dataset from Kaggle…")
    path = kagglehub.dataset_download(DATASET_ID)
    txt_file = next(
        (str(Path(root) / f)
         for root, _, files in os.walk(path)
         for f in files if f.endswith(".txt") or f.endswith(".json")),
        None
    )
    if not txt_file:
        print("ERROR: No .txt/.json file found in dataset", file=sys.stderr); sys.exit(1)

    print(f"  Dataset file: {txt_file}")
    print(f"  Size: {os.path.getsize(txt_file):,} bytes")

    records = []
    errors  = 0
    with open(txt_file, "r", encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f):
            if limit and i >= limit:
                break
            try:
                records.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                errors += 1

    print(f"  Loaded {len(records):,} records  ({errors} parse errors)")
    return records, txt_file


def print_schema_mapping():
    print("""
┌─────────────────────────────────────────────┬──────────────────────────┬───────────┐
│ Dataset field                               │ System field             │ Coverage  │
├─────────────────────────────────────────────┼──────────────────────────┼───────────┤
│ first_name                                  │ first_name               │ 100%      │
│ last_name                                   │ last_name                │ ~100%     │
│ headline                                    │ headline                 │ 94%       │
│ occupation (fallback)                       │ headline (fallback)      │ 89%       │
│ summary                                     │ about_summary            │ 62.8%     │
│ city                                        │ city                     │ 96.6%     │
│ state                                       │ state                    │ 66.9%     │
│ country_full_name                           │ country                  │ 100%      │
│ connections                                 │ connections_count        │ 97.9%     │
│ profile_pic_url → DiceBear avatar           │ profile_photo_url        │ 100%*     │
│ experiences[] (structured transform)        │ experience_json          │ 89.4%     │
│ education[] (structured transform)          │ education_json           │ 86.2%     │
│ DERIVED from headline/occupation            │ skills_json              │ 100%      │
│ BUILT from summary+experience+education     │ resume_text              │ ~95%      │
├─────────────────────────────────────────────┼──────────────────────────┼───────────┤
│ GENERATED                                   │ member_id  (m_<hex12>)   │ 100%      │
│ GENERATED                                   │ email                    │ 100%      │
│ GENERATED                                   │ phone  (null)            │ —         │
│ GENERATED random 0–50                       │ profile_views_daily      │ 100%      │
└─────────────────────────────────────────────┴──────────────────────────┴───────────┘
* DiceBear SVG avatars (deterministic, always loads)
""")

# ── Step 3+4: Clean and transform ─────────────────────────────────────────────

def transform_records(raw_records: list[dict]) -> list[dict]:
    print(f"\n▶ Steps 3+4: Cleaning and transforming {len(raw_records):,} records…")
    used_emails: set[str] = set()
    members: list[dict]  = []
    skipped = 0

    for rec in raw_records:
        fn = safe_str(rec.get("first_name"), 100)
        ln = safe_str(rec.get("last_name"),  100)

        if not fn:
            skipped += 1
            continue
        if not ln:
            ln = "."   # single-initial last names are valid per dataset

        headline  = safe_str(rec.get("headline"),   255)
        occupation = safe_str(rec.get("occupation"), 255)
        display_hl = headline or occupation or "Professional"

        city    = safe_str(rec.get("city"),              100)
        state   = safe_str(rec.get("state"),             100)
        country = safe_str(rec.get("country_full_name"), 100) or "United States of America"

        connections = rec.get("connections")
        if isinstance(connections, (int, float)) and connections >= 0:
            conn_count = min(int(connections), 30_000)
        else:
            conn_count = random.randint(0, 500)

        skills = derive_skills(headline, occupation)
        experiences = transform_experiences(rec.get("experiences"))
        education   = transform_education(rec.get("education"))
        summary     = safe_str(rec.get("summary"), 3000)
        resume      = build_resume_text(rec)

        email = generate_email(fn, ln, used_emails)
        used_emails.add(email)

        member_id = make_member_id()

        members.append({
            "member_id":          member_id,
            "first_name":         fn,
            "last_name":          ln,
            "email":              email,
            "phone":              None,
            "city":               city,
            "state":              state,
            "country":            country,
            "headline":           display_hl[:255],
            "about_summary":      summary,
            "experience_json":    json.dumps(experiences),
            "education_json":     json.dumps(education),
            "skills_json":        json.dumps(skills),
            "profile_photo_url":  avatar_url(fn, ln),
            "resume_text":        resume,
            "connections_count":  conn_count,
            "profile_views_daily": random.randint(0, 50),
        })

    print(f"  Transformed: {len(members):,}  |  Skipped (no name): {skipped}")
    return members


# ── Step 5+6: DB insert (members + users) ─────────────────────────────────────

MEMBER_SQL = """
    INSERT IGNORE INTO members
      (member_id, first_name, last_name, email, phone,
       city, state, country,
       headline, about_summary,
       experience_json, education_json, skills_json,
       profile_photo_url, resume_text,
       connections_count, profile_views_daily)
    VALUES (%s,%s,%s,%s,%s, %s,%s,%s, %s,%s, %s,%s,%s, %s,%s, %s,%s)
"""

USER_SQL = """
    INSERT IGNORE INTO users
      (user_id, email, hashed_password, member_id, role)
    VALUES (%s, %s, %s, %s, 'member')
"""

def insert_members(conn, members: list[dict]) -> tuple[int, int]:
    cursor = conn.cursor()
    inserted = 0
    skipped  = 0
    batch: list[tuple] = []

    for m in members:
        batch.append((
            m["member_id"], m["first_name"], m["last_name"], m["email"], m["phone"],
            m["city"], m["state"], m["country"],
            m["headline"], m["about_summary"],
            m["experience_json"], m["education_json"], m["skills_json"],
            m["profile_photo_url"], m["resume_text"],
            m["connections_count"], m["profile_views_daily"],
        ))
        if len(batch) >= BATCH_SIZE:
            cursor.executemany(MEMBER_SQL, batch)
            conn.commit()
            ins = cursor.rowcount
            inserted += ins
            skipped  += len(batch) - ins
            print(f"    members: +{ins:4d}  running total: {inserted}")
            batch = []

    if batch:
        cursor.executemany(MEMBER_SQL, batch)
        conn.commit()
        ins = cursor.rowcount
        inserted += ins
        skipped  += len(batch) - ins

    cursor.close()
    return inserted, skipped


def insert_users(conn, members: list[dict], pw_hash: str) -> tuple[int, int]:
    cursor = conn.cursor()
    inserted = 0
    skipped  = 0
    batch: list[tuple] = []

    # Only create users for members that were actually inserted
    for m in members:
        batch.append((
            make_user_id(), m["email"], pw_hash, m["member_id"]
        ))
        if len(batch) >= BATCH_SIZE:
            cursor.executemany(USER_SQL, batch)
            conn.commit()
            ins = cursor.rowcount
            inserted += ins
            skipped  += len(batch) - ins
            print(f"    users:   +{ins:4d}  running total: {inserted}")
            batch = []

    if batch:
        cursor.executemany(USER_SQL, batch)
        conn.commit()
        ins = cursor.rowcount
        inserted += ins
        skipped  += len(batch) - ins

    cursor.close()
    return inserted, skipped


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()

    # ── Step 1: Download + inspect ──
    raw, dataset_path = load_dataset(limit=LIMIT)

    # ── Step 2: Schema mapping ──
    print_schema_mapping()

    if INSPECT_ONLY:
        print("  --inspect-only flag set, exiting.")
        return

    # ── Steps 3+4: Transform ──
    members = transform_records(raw)

    if DRY_RUN:
        print("\n▶ DRY RUN — first 5 transformed records:\n")
        for m in members[:5]:
            display = {k: v for k, v in m.items()
                       if k not in ("resume_text", "about_summary", "experience_json", "education_json")}
            display["skills"] = json.loads(m["skills_json"])
            print(json.dumps(display, indent=2))
            print()
        return

    # ── Step 5: Members DB insert ──
    print(f"\n▶ Step 5: Connecting to MySQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}…")
    conn = pymysql.connect(**DB_CONFIG)

    print(f"  Inserting {len(members):,} members in batches of {BATCH_SIZE}…")
    mem_inserted, mem_skipped = insert_members(conn, members)

    # ── Step 6: User account creation ──
    user_inserted = user_skipped = 0
    if not NO_USERS:
        print(f"\n▶ Step 6: Creating user accounts (password: {SEED_PASSWORD})…")
        print("  Pre-computing bcrypt hash…")
        pw_hash = bcrypt.hashpw(SEED_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()
        print("  Inserting users…")
        user_inserted, user_skipped = insert_users(conn, members, pw_hash)

    conn.close()

    # ── Step 8: Summary ──
    elapsed = time.time() - t0
    print(f"""
╔══════════════════════════════════════════════════╗
║              IMPORT COMPLETE                     ║
╠══════════════════════════════════════════════════╣
║  Dataset records processed : {len(raw):>8,}            ║
║  Members transformed       : {len(members):>8,}            ║
║  Members inserted (new)    : {mem_inserted:>8,}            ║
║  Members skipped (dup)     : {mem_skipped:>8,}            ║
║  Users inserted (new)      : {user_inserted:>8,}            ║
║  Users skipped  (dup)      : {user_skipped:>8,}            ║
║  Elapsed time              : {elapsed:>7.1f}s            ║
╠══════════════════════════════════════════════════╣
║  LOGIN CREDENTIALS FOR ALL SEEDED MEMBERS:       ║
║    Email   : <member email>                      ║
║    Password: Password123!                        ║
╚══════════════════════════════════════════════════╝
""")

    # ── Sample 10 inserted members ──
    print("▶ Sample 10 inserted members:")
    for m in members[:10]:
        sample = {
            "member_id":    m["member_id"],
            "name":         f"{m['first_name']} {m['last_name']}",
            "email":        m["email"],
            "headline":     m["headline"],
            "location":     f"{m['city'] or ''}, {m['state'] or ''}, {m['country'] or ''}".strip(", "),
            "skills":       json.loads(m["skills_json"]),
            "connections":  m["connections_count"],
            "avatar":       m["profile_photo_url"],
        }
        print(json.dumps(sample, indent=2))


if __name__ == "__main__":
    main()

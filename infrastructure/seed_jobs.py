#!/usr/bin/env python3
"""
seed_jobs.py — LinkedIn Jobs 2023 (Kaggle) ingestion pipeline
==============================================================

Dataset:  rajatraj0502/linkedin-job-2023
Tables:   data236.job_postings  (jobs)
          data236.members        (recruiter member profiles)
          data236.users          (recruiter auth accounts)

Usage:
  python seed_jobs.py [--dry-run] [--inspect-only] [--limit N]

Flags:
  --dry-run       Transform first 5 records, print them, no DB writes
  --inspect-only  Print dataset stats and schema mapping then exit
  --limit N       Only import first N job rows

Recruiter accounts created by this script:
  email:    <first>.<last>.recruiter@linkedin-sim.example
  password: Password123!
"""

import hashlib, json, math, os, re, sys, time, uuid
from datetime import datetime, timezone
from pathlib import Path

# ── deps ──────────────────────────────────────────────────────────────────────
try:
    import kagglehub
except ImportError:
    print("ERROR: pip install kagglehub", file=sys.stderr); sys.exit(1)
try:
    import pandas as pd
except ImportError:
    print("ERROR: pip install pandas", file=sys.stderr); sys.exit(1)
try:
    import pymysql
except ImportError:
    print("ERROR: pip install pymysql", file=sys.stderr); sys.exit(1)
try:
    import bcrypt
except ImportError:
    print("ERROR: pip install bcrypt", file=sys.stderr); sys.exit(1)

# ── config ────────────────────────────────────────────────────────────────────
DATASET_ID    = "rajatraj0502/linkedin-job-2023"
SEED_PASSWORD = "Password123!"
BATCH_SIZE    = 500
DB_CONFIG     = dict(
    host     = os.getenv("MYSQL_HOST",     "localhost"),
    port     = int(os.getenv("MYSQL_PORT", "3306")),
    user     = os.getenv("MYSQL_USER",     "root"),
    password = os.getenv("MYSQL_PASSWORD", ""),
    database = os.getenv("MYSQL_DB",       "data236"),
    charset  = "utf8mb4",
    connect_timeout = 10,
)

DRY_RUN      = "--dry-run"      in sys.argv
INSPECT_ONLY = "--inspect-only" in sys.argv
LIMIT = None
for i, arg in enumerate(sys.argv):
    if arg == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

# ── skill abbreviation → full skill names ─────────────────────────────────────
SKILL_MAP = {
    "IT":   ["Python", "JavaScript", "SQL", "Linux", "AWS", "Docker", "REST APIs"],
    "SALE": ["Sales", "CRM", "Salesforce", "Negotiation", "Account Management"],
    "MGMT": ["Leadership", "Team Management", "Strategy", "Agile", "P&L Management"],
    "MNFC": ["Manufacturing", "Lean", "Six Sigma", "Quality Control", "AutoCAD"],
    "BD":   ["Business Development", "Partnerships", "Market Research", "CRM"],
    "ENG":  ["Python", "Java", "C++", "System Design", "Git", "CI/CD"],
    "OTHR": ["Communication", "Problem Solving", "Microsoft Office"],
    "HCPR": ["Patient Care", "EMR", "HIPAA", "Clinical Documentation", "Epic"],
    "FIN":  ["Excel", "Financial Modeling", "Bloomberg", "SQL", "Accounting"],
    "ACCT": ["Excel", "QuickBooks", "SAP", "Financial Reporting", "Tax", "Auditing"],
    "MRKT": ["Marketing", "SEO", "Google Analytics", "HubSpot", "Content Strategy"],
    "PRJM": ["Project Management", "Agile", "Scrum", "Jira", "Risk Management"],
    "ADM":  ["Microsoft Office", "Calendar Management", "Communication", "Excel"],
    "ANLS": ["SQL", "Excel", "Tableau", "Python", "Power BI", "Statistics"],
    "RSCH": ["Research", "Statistics", "Python", "R", "Literature Review"],
    "HR":   ["Recruiting", "HRIS", "Workday", "Employee Relations", "Payroll"],
    "CUST": ["Customer Service", "CRM", "Communication", "Problem Solving"],
    "DSGN": ["Figma", "Adobe XD", "Photoshop", "UI/UX Design", "Sketch"],
    "EDU":  ["Teaching", "Curriculum Development", "Google Classroom", "Assessment"],
    "ART":  ["Adobe Creative Suite", "Photography", "Video Editing", "Illustration"],
    "SUPL": ["Supply Chain", "SAP", "Logistics", "Procurement", "ERP"],
    "CNSL": ["Consulting", "PowerPoint", "Excel", "Problem Solving", "Strategy"],
    "TRSP": ["Logistics", "Transportation", "Fleet Management", "Route Planning"],
    "CHEM": ["Chemistry", "Lab Skills", "HPLC", "GC-MS", "Data Analysis"],
    "FOOD": ["Food Safety", "HACCP", "Kitchen Management", "Menu Development"],
    "LAWL": ["Legal Research", "Westlaw", "Contract Review", "Compliance"],
    "PREL": ["Public Relations", "Media Relations", "Press Releases", "Cision"],
    "REAL": ["Real Estate", "CRM", "Contract Management", "Market Analysis"],
    "CONS": ["AutoCAD", "Project Management", "Safety Compliance", "Budgeting"],
    "GEN":  ["Communication", "Microsoft Office", "Teamwork", "Excel"],
    "BUSA": ["Business Analysis", "SQL", "Excel", "PowerPoint", "Agile"],
    "AVIA": ["FAA Regulations", "Flight Planning", "Safety Management", "Navigation"],
    "AGRI": ["Agronomy", "GIS", "Precision Agriculture", "Pest Management"],
    "PHAR": ["Pharmacology", "GMP", "Regulatory Affairs", "Clinical Trials"],
    "FINC": ["Excel", "Financial Modeling", "Bloomberg", "CFA", "Valuation"],
}

# ── seniority normalisation ───────────────────────────────────────────────────
SENIORITY_MAP = {
    "mid-senior level": "Mid-Senior",
    "mid-senior":       "Mid-Senior",
    "entry level":      "Entry",
    "entry":            "Entry",
    "associate":        "Associate",
    "director":         "Director",
    "executive":        "Director",
    "internship":       "Internship",
    "intern":           "Internship",
}

def infer_seniority(title: str, experience_level: str | None) -> str | None:
    if experience_level and str(experience_level).lower() != "nan":
        key = str(experience_level).lower().strip()
        for k, v in SENIORITY_MAP.items():
            if k in key:
                return v
    t = (title or "").lower()
    if re.search(r"\bintern\b", t):         return "Internship"
    if re.search(r"\bjunior\b|\bjr\.?\b", t): return "Entry"
    if re.search(r"\bsenior\b|\bsr\.?\b|\blead\b|\bstaff\b|\bprincipal\b", t): return "Mid-Senior"
    if re.search(r"\bdirector\b|\bvp\b|\bvice\s+president\b|\bcto\b|\bceo\b", t): return "Director"
    return None

# ── employment type normalisation ─────────────────────────────────────────────
WORK_TYPE_MAP = {
    "FULL_TIME":  "FULL_TIME",
    "CONTRACT":   "CONTRACT",
    "PART_TIME":  "PART_TIME",
    "INTERNSHIP": "INTERNSHIP",
    "TEMPORARY":  "CONTRACT",
    "OTHER":      "FULL_TIME",
    "VOLUNTEER":  "PART_TIME",
}

# ── remote/hybrid inference ───────────────────────────────────────────────────
def infer_remote(row) -> str:
    remote_flag = row.get("remote_allowed")
    if pd.notna(remote_flag) and float(remote_flag) == 1.0:
        return "remote"
    loc = str(row.get("location") or "").lower()
    desc = str(row.get("description") or "")[:500].lower()
    if "hybrid" in loc or "hybrid" in desc:
        return "hybrid"
    if "remote" in loc:
        return "remote"
    return "onsite"

# ── salary annualisation ──────────────────────────────────────────────────────
def annualize(value, pay_period: str) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    v = float(value)
    period = str(pay_period).upper() if pay_period and str(pay_period) != "nan" else ""
    if period == "HOURLY":
        v *= 2080
    elif period == "MONTHLY":
        v *= 12
    return round(v, 2) if v > 0 else None

# ── deterministic IDs ─────────────────────────────────────────────────────────
def company_id_from_name(name: str) -> str:
    h = hashlib.sha256(str(name).lower().strip().encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-{(int(h[16], 16) % 4 + 8):x}{h[17:20]}-{h[20:32]}"

def make_member_id() -> str:
    return f"m_{uuid.uuid4().hex[:12]}"

def make_user_id() -> str:
    return f"u_{uuid.uuid4().hex[:12]}"

# ── recruiter definitions (50 deterministic accounts) ─────────────────────────
RECRUITER_NAMES = [
    ("Sarah","Chen"),    ("Michael","Rodriguez"), ("Emily","Thompson"),
    ("James","Park"),    ("Ashley","Williams"),   ("David","Nguyen"),
    ("Jessica","Brown"), ("Daniel","Martinez"),   ("Amanda","Johnson"),
    ("Christopher","Lee"),("Stephanie","Garcia"), ("Andrew","Davis"),
    ("Lauren","Wilson"),  ("Ryan","Anderson"),    ("Megan","Taylor"),
    ("Brandon","Thomas"), ("Brittany","Jackson"), ("Tyler","White"),
    ("Samantha","Harris"),("Nathan","Lewis"),      ("Rachel","Robinson"),
    ("Justin","Walker"),  ("Amber","Hall"),        ("Kevin","Allen"),
    ("Heather","Young"),  ("Eric","King"),          ("Tiffany","Wright"),
    ("Adam","Scott"),     ("Melissa","Torres"),    ("Derek","Green"),
    ("Vanessa","Adams"),  ("Patrick","Nelson"),    ("Crystal","Baker"),
    ("Timothy","Hill"),   ("Natalie","Rivera"),    ("Gregory","Campbell"),
    ("Michelle","Mitchell"),("Jeffrey","Carter"),  ("Danielle","Roberts"),
    ("Kenneth","Phillips"),("Rebecca","Evans"),    ("Brian","Turner"),
    ("Kimberly","Parker"), ("Steven","Collins"),   ("Christina","Edwards"),
    ("Gary","Stewart"),    ("Alicia","Flores"),    ("Jason","Morris"),
    ("Denise","Nguyen"),   ("Scott","Murphy"),
]

RECRUITER_COMPANIES = [
    "Google","Meta","Amazon","Microsoft","Apple","Netflix","Uber","Lyft",
    "Airbnb","Stripe","Twilio","Shopify","Salesforce","Oracle","IBM",
    "Cisco","Nvidia","Databricks","Snowflake","Confluent","Adobe","Zoom",
    "Slack","Twitter","LinkedIn","Pinterest","Square","PayPal","Intuit",
    "ServiceNow","Workday","Okta","Cloudflare","Palo Alto Networks",
    "CrowdStrike","Zscaler","Veeva","Coupa","Asana","HubSpot","Zendesk",
    "Atlassian","MongoDB","Elastic","HashiCorp","Datadog","New Relic",
    "Splunk","Tanium",
]

RECRUITER_CITIES = [
    ("San Francisco","CA"),("New York","NY"),("Seattle","WA"),
    ("Austin","TX"),("Boston","MA"),("Chicago","IL"),
    ("Los Angeles","CA"),("Denver","CO"),("Atlanta","GA"),
    ("Miami","FL"),("Portland","OR"),("San Jose","CA"),
]

def build_recruiter_pool() -> list[dict]:
    pool = []
    for i, (fn, ln) in enumerate(RECRUITER_NAMES):
        company = RECRUITER_COMPANIES[i % len(RECRUITER_COMPANIES)]
        city, state = RECRUITER_CITIES[i % len(RECRUITER_CITIES)]
        member_id = make_member_id()
        email = f"{fn.lower()}.{ln.lower()}.recruiter@linkedin-sim.example"
        pool.append({
            "member_id":   member_id,
            "user_id":     make_user_id(),
            "first_name":  fn,
            "last_name":   ln,
            "email":       email,
            "company":     company,
            "city":        city,
            "state":       state,
            "headline":    f"Talent Acquisition at {company}",
        })
    return pool

# ── dataset loading ───────────────────────────────────────────────────────────
def load_dataset() -> tuple[pd.DataFrame, dict]:
    print("▶ Step 1: Downloading dataset…")
    path = kagglehub.dataset_download(DATASET_ID)
    base = Path(path)

    jobs     = pd.read_csv(base / "job_postings.csv")
    companies= pd.read_csv(base / "companies.csv")[["company_id","name","city","state","country"]]
    skills_df= pd.read_csv(base / "job_skills.csv")
    cinds    = pd.read_csv(base / "company_industries.csv")

    print(f"  job_postings.csv : {len(jobs):,} rows")
    print(f"  companies.csv    : {len(companies):,} rows")
    print(f"  job_skills.csv   : {len(skills_df):,} rows, {skills_df['skill_abr'].nunique()} unique skills")
    print(f"  company_industries.csv: {len(cinds):,} rows")

    # company_id → name lookup
    company_lookup = {
        int(r.company_id): str(r["name"]).strip()
        for _, r in companies.iterrows()
        if pd.notna(r.company_id)
    }

    # job_id → list of skills
    skills_by_job = {}
    for _, r in skills_df.iterrows():
        jid = str(int(r.job_id)) if pd.notna(r.job_id) else None
        if jid:
            skills_by_job.setdefault(jid, []).append(r.skill_abr)

    # company_id → industry
    industry_by_company = {}
    for _, r in cinds.iterrows():
        if pd.notna(r.company_id):
            industry_by_company.setdefault(int(r.company_id), r.industry)

    return jobs, {
        "company_lookup":      company_lookup,
        "skills_by_job":       skills_by_job,
        "industry_by_company": industry_by_company,
    }

# ── transform ─────────────────────────────────────────────────────────────────
def transform(jobs: pd.DataFrame, aux: dict, recruiters: list[dict]) -> tuple[list[dict], dict]:
    lookup   = aux["company_lookup"]
    sk_map   = aux["skills_by_job"]
    ind_map  = aux["industry_by_company"]

    recruiter_ids = [r["member_id"] for r in recruiters]
    n_rec         = len(recruiter_ids)

    stats = dict(processed=0, transformed=0, skipped_no_title=0,
                 skipped_no_desc=0, dupes=0)
    seen_titles: dict[str, int] = {}
    out: list[dict] = []

    limit = LIMIT if LIMIT else len(jobs)

    for idx, row in jobs.head(limit).iterrows():
        stats["processed"] += 1
        row = row.where(pd.notna(row), None)  # replace NaN → None

        title = str(row.get("title") or "").strip()[:255]
        if not title:
            stats["skipped_no_title"] += 1; continue

        desc = str(row.get("description") or "").strip()
        if len(desc) < 20:
            stats["skipped_no_desc"] += 1; continue

        # Dedup: skip if same title+location appeared > 3 times
        key = f"{title.lower()}|{str(row.get('location') or '').lower()}"
        seen_titles[key] = seen_titles.get(key, 0) + 1
        if seen_titles[key] > 3:
            stats["dupes"] += 1; continue

        # Company
        raw_cid = row.get("company_id")
        cid_int = int(raw_cid) if raw_cid and not (isinstance(raw_cid, float) and math.isnan(raw_cid)) else None
        company_name = lookup.get(cid_int, f"Company {cid_int}" if cid_int else "Unknown Company")
        company_id   = company_id_from_name(company_name)

        # Recruiter: distribute round-robin by row index
        recruiter_id = recruiter_ids[stats["transformed"] % n_rec]

        # Seniority
        seniority = infer_seniority(title, row.get("formatted_experience_level"))

        # Employment type
        wt = str(row.get("work_type") or "FULL_TIME").upper().strip()
        employment_type = WORK_TYPE_MAP.get(wt, "FULL_TIME")

        # Location
        location = str(row.get("location") or "United States").strip()[:255]

        # Remote
        remote = infer_remote(row)

        # Salary (annualized)
        pay_period = row.get("pay_period")
        sal_min = annualize(row.get("min_salary"), pay_period)
        sal_max = annualize(row.get("max_salary"), pay_period)
        # Sanity bounds: $10k–$2M annual
        if sal_min and not (10_000 <= sal_min <= 2_000_000):
            sal_min = None
        if sal_max and not (10_000 <= sal_max <= 2_000_000):
            sal_max = None
        if sal_min and sal_max and sal_min > sal_max:
            sal_min, sal_max = sal_max, sal_min

        # Skills from job_skills.csv
        jid_str = str(int(row["job_id"])) if pd.notna(row.get("job_id")) else None
        abrs = sk_map.get(jid_str, [])
        skills: list[str] = []
        seen_skills: set[str] = set()
        for abr in abrs:
            for s in SKILL_MAP.get(abr, []):
                if s not in seen_skills:
                    seen_skills.add(s); skills.append(s)
        skills = skills[:10]  # cap

        # Industry
        industry = ind_map.get(cid_int) if cid_int else None
        if industry and len(str(industry)) > 100:
            industry = str(industry)[:100]

        # Date (epoch ms)
        raw_ts = row.get("listed_time") or row.get("original_listed_time")
        try:
            ts_sec = float(raw_ts) / 1000 if raw_ts else None
            posted = datetime.fromtimestamp(ts_sec, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if ts_sec else None
        except Exception:
            posted = None

        # views / applies
        views = row.get("views")
        views_count = int(views) if views and not (isinstance(views, float) and math.isnan(views)) else 0

        applies = row.get("applies")
        applicants_count = int(applies) if applies and not (isinstance(applies, float) and math.isnan(applies)) else 0

        out.append({
            "job_id":           str(uuid.uuid4()),
            "company_id":       company_id,
            "company_name":     company_name[:255],
            "recruiter_id":     recruiter_id,
            "title":            title,
            "description":      desc[:16000],
            "seniority_level":  seniority,
            "employment_type":  employment_type,
            "location":         location,
            "remote":           remote,
            "skills_required":  json.dumps(skills),
            "industry":         industry,
            "salary_min":       sal_min,
            "salary_max":       sal_max,
            "posted_datetime":  posted,
            "status":           "open",
            "views_count":      views_count,
            "applicants_count": applicants_count,
        })
        stats["transformed"] += 1

    stats["output"] = len(out)
    return out, stats

# ── DB helpers ────────────────────────────────────────────────────────────────
JOB_SQL = """
INSERT IGNORE INTO job_postings
  (job_id, company_id, company_name, recruiter_id,
   title, description, seniority_level, employment_type,
   location, remote, skills_required, industry,
   salary_min, salary_max, posted_datetime, status,
   views_count, applicants_count)
VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s)
"""

MEMBER_SQL = """
INSERT IGNORE INTO members
  (member_id, first_name, last_name, email, city, state, country,
   headline, skills_json, experience_json, education_json,
   connections_count, profile_views_daily)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

USER_SQL = """
INSERT IGNORE INTO users (user_id, email, hashed_password, member_id, role)
VALUES (%s,%s,%s,%s,'recruiter')
"""

def upsert_recruiters(conn, pool: list[dict], pw_hash: str) -> int:
    cur = conn.cursor()
    inserted = 0
    for r in pool:
        cur.execute(MEMBER_SQL, (
            r["member_id"], r["first_name"], r["last_name"], r["email"],
            r["city"], r["state"], "United States",
            r["headline"],
            json.dumps(["Talent Acquisition", "Recruiting", "LinkedIn Recruiter", "ATS"]),
            json.dumps([{"company": r["company"], "title": "Senior Recruiter",
                         "start_year": 2020, "end_year": None, "description": None}]),
            json.dumps([]),
            500, 30,
        ))
        cur.execute(USER_SQL, (r["user_id"], r["email"], pw_hash, r["member_id"]))
        conn.commit()
        inserted += cur.rowcount
    cur.close()
    return inserted

def insert_jobs(conn, jobs: list[dict]) -> tuple[int, int]:
    cur = conn.cursor()
    inserted = skipped = 0
    batch = []
    for j in jobs:
        batch.append((
            j["job_id"], j["company_id"], j["company_name"], j["recruiter_id"],
            j["title"], j["description"], j["seniority_level"], j["employment_type"],
            j["location"], j["remote"], j["skills_required"], j["industry"],
            j["salary_min"], j["salary_max"], j["posted_datetime"], j["status"],
            j["views_count"], j["applicants_count"],
        ))
        if len(batch) >= BATCH_SIZE:
            cur.executemany(JOB_SQL, batch)
            conn.commit()
            ins = cur.rowcount
            inserted += ins; skipped += len(batch) - ins
            print(f"    jobs: +{ins:4d}  running total: {inserted}")
            batch = []
    if batch:
        cur.executemany(JOB_SQL, batch)
        conn.commit()
        ins = cur.rowcount
        inserted += ins; skipped += len(batch) - ins
    cur.close()
    return inserted, skipped

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    t0 = time.time()

    # Step 1: Load
    jobs_df, aux = load_dataset()

    # Step 2: Schema info
    print("""
┌───────────────────────────────────────────┬──────────────────────────┬───────────┐
│ Dataset field                             │ System field             │ Source    │
├───────────────────────────────────────────┼──────────────────────────┼───────────┤
│ title                                     │ title                    │ DIRECT    │
│ description                               │ description              │ DIRECT    │
│ companies.csv → name                      │ company_name             │ JOINED    │
│ SHA-256(company_name)                     │ company_id               │ DERIVED   │
│ Recruiter pool (50 seeded accounts)       │ recruiter_id             │ SEEDED    │
│ formatted_experience_level / title infer  │ seniority_level          │ MAPPED    │
│ work_type                                 │ employment_type          │ MAPPED    │
│ location                                  │ location                 │ DIRECT    │
│ remote_allowed + location heuristic       │ remote                   │ DERIVED   │
│ job_skills.csv abrs → full names          │ skills_required          │ JOINED    │
│ company_industries.csv                    │ industry                 │ JOINED    │
│ min/max_salary + pay_period (annualized)  │ salary_min / salary_max  │ COMPUTED  │
│ listed_time (epoch ms → datetime)         │ posted_datetime          │ CONVERTED │
│ views                                     │ views_count              │ DIRECT    │
│ applies                                   │ applicants_count         │ DIRECT    │
│ ALWAYS 'open'                             │ status                   │ DEFAULT   │
└───────────────────────────────────────────┴──────────────────────────┴───────────┘
""")

    if INSPECT_ONLY:
        print("--inspect-only: exiting."); return

    # Steps 3+4: Transform
    print(f"▶ Steps 3+4: Transforming {min(LIMIT or len(jobs_df), len(jobs_df)):,} rows…")
    recruiters = build_recruiter_pool()
    jobs, stats = transform(jobs_df, aux, recruiters)
    print(f"  processed={stats['processed']:,}  transformed={stats['transformed']:,}  "
          f"skipped_title={stats['skipped_no_title']}  skipped_desc={stats['skipped_no_desc']}  "
          f"dupes={stats['dupes']}")

    if DRY_RUN:
        print("\n▶ DRY RUN — first 5 records:\n")
        for j in jobs[:5]:
            d = {k: v for k, v in j.items() if k != "description"}
            d["description_preview"] = jobs[jobs.index(j)]["description"][:120] + "…"
            print(json.dumps(d, indent=2)); print()
        return

    # Step 5: Insert
    print(f"\n▶ Step 5: Connecting to MySQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}…")
    conn = pymysql.connect(**DB_CONFIG)

    # Step 6: Recruiter pool
    print(f"\n▶ Step 6: Seeding {len(recruiters)} recruiter accounts…")
    pw_hash = bcrypt.hashpw(SEED_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()
    rec_count = upsert_recruiters(conn, recruiters, pw_hash)
    print(f"  Recruiters upserted: {rec_count}")

    print(f"\n▶ Inserting {len(jobs):,} jobs in batches of {BATCH_SIZE}…")
    job_inserted, job_skipped = insert_jobs(conn, jobs)
    conn.close()

    elapsed = time.time() - t0
    print(f"""
╔══════════════════════════════════════════════════════╗
║                IMPORT COMPLETE                       ║
╠══════════════════════════════════════════════════════╣
║  Dataset rows processed    : {stats['processed']:>8,}              ║
║  Jobs transformed          : {stats['transformed']:>8,}              ║
║  Jobs inserted (new)       : {job_inserted:>8,}              ║
║  Jobs skipped (dup)        : {job_skipped:>8,}              ║
║  Skipped – no title        : {stats['skipped_no_title']:>8,}              ║
║  Skipped – no description  : {stats['skipped_no_desc']:>8,}              ║
║  Deduplicated              : {stats['dupes']:>8,}              ║
║  Recruiter accounts        : {len(recruiters):>8,}              ║
║  Elapsed                   : {elapsed:>7.1f}s              ║
╠══════════════════════════════════════════════════════╣
║  RECRUITER LOGIN CREDENTIALS:                        ║
║    email:    <name>.recruiter@linkedin-sim.example   ║
║    password: Password123!                            ║
╚══════════════════════════════════════════════════════╝
""")

    # Sample 10
    print("▶ Sample 10 inserted jobs:")
    for j in jobs[:10]:
        print(json.dumps({
            "job_id":          j["job_id"],
            "title":           j["title"],
            "company_name":    j["company_name"],
            "location":        j["location"],
            "remote":          j["remote"],
            "employment_type": j["employment_type"],
            "seniority_level": j["seniority_level"],
            "skills":          json.loads(j["skills_required"]),
            "salary":          f"${j['salary_min']:,.0f}–${j['salary_max']:,.0f}" if j["salary_min"] and j["salary_max"] else "N/A",
            "views":           j["views_count"],
            "applies":         j["applicants_count"],
        }, indent=2))

if __name__ == "__main__":
    main()

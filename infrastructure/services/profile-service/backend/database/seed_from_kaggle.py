"""
Seed members table from Kaggle Resume dataset.
CSV: services/application-service/database/Resume/Resume.csv
Columns: ID, Resume_str, Resume_html, Category

Run:
    python seed_from_kaggle.py [--dry-run]

Env (or .env in parent dir):
    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB
"""
import csv
import json
import os
import re
import sys
import uuid
import random
from pathlib import Path
from dotenv import load_dotenv
import pymysql

load_dotenv(Path(__file__).parent.parent / ".env")

DRY_RUN = "--dry-run" in sys.argv

CSV_PATH = Path(__file__).parents[3] / "application-service" / "database" / "Resume" / "Resume.csv"

# ── Category → skills mapping ─────────────────────────────────────
CATEGORY_SKILLS = {
    "INFORMATION-TECHNOLOGY": ["Python", "Java", "JavaScript", "SQL", "Docker", "Kubernetes", "AWS", "Linux", "REST APIs", "Git"],
    "ENGINEERING":            ["Python", "MATLAB", "AutoCAD", "C++", "Java", "SQL", "Project Management", "Agile"],
    "BUSINESS-DEVELOPMENT":   ["Sales", "CRM", "Salesforce", "Market Research", "Negotiation", "Excel", "PowerPoint"],
    "FINANCE":                ["Excel", "Financial Modeling", "SQL", "Bloomberg", "Python", "Tableau", "Accounting"],
    "ACCOUNTANT":             ["Excel", "QuickBooks", "SAP", "Financial Reporting", "Tax", "Auditing", "SQL"],
    "BANKING":                ["Excel", "Financial Analysis", "SQL", "Risk Management", "Bloomberg", "Power BI"],
    "HEALTHCARE":             ["EMR", "HIPAA", "Patient Care", "Medical Coding", "Epic", "Clinical Research"],
    "HR":                     ["HRIS", "Recruiting", "Payroll", "Workday", "Employee Relations", "Excel", "ATS"],
    "CONSULTANT":             ["Excel", "PowerPoint", "SQL", "Tableau", "Agile", "Project Management", "Salesforce"],
    "DESIGNER":               ["Adobe Photoshop", "Illustrator", "Figma", "Sketch", "CSS", "HTML", "UX Design"],
    "DIGITAL-MEDIA":          ["Adobe Premiere", "After Effects", "Photoshop", "SEO", "Social Media", "Content Strategy"],
    "SALES":                  ["CRM", "Salesforce", "Negotiation", "Cold Calling", "HubSpot", "Excel", "Forecasting"],
    "TEACHER":                ["Curriculum Development", "Classroom Management", "Google Classroom", "Assessment", "EdTech"],
    "ARTS":                   ["Adobe Creative Suite", "Photography", "Video Editing", "Illustration", "Typography"],
    "AVIATION":               ["FAA Regulations", "Flight Planning", "Safety Management", "Navigation", "ATC"],
    "AGRICULTURE":            ["Precision Agriculture", "GIS", "Agronomy", "Pest Management", "Irrigation"],
    "PUBLIC-RELATIONS":       ["Media Relations", "Press Releases", "Crisis Communications", "Social Media", "Cision"],
    "FITNESS":                ["Personal Training", "Nutrition", "Group Fitness", "CPR", "Injury Prevention"],
    "CONSTRUCTION":           ["AutoCAD", "Project Management", "Safety Compliance", "Budgeting", "MS Project"],
    "ADVOCATE":               ["Legal Research", "Contract Review", "Litigation", "Westlaw", "Client Counseling"],
    "CHEF":                   ["Menu Development", "Food Safety", "Kitchen Management", "Inventory", "HACCP"],
    "APPAREL":                ["Fashion Design", "Adobe Illustrator", "Trend Analysis", "Merchandising", "Sewing"],
    "AUTOMOBILE":             ["AutoCAD", "Diagnostics", "Quality Control", "FMEA", "CAN Bus", "MATLAB"],
    "BPO":                    ["CRM", "Customer Service", "Data Entry", "Six Sigma", "Excel", "Communication"],
}

CATEGORY_HEADLINES = {
    "INFORMATION-TECHNOLOGY": ["Software Engineer", "Senior Software Engineer", "Full Stack Developer", "Backend Engineer", "DevOps Engineer", "Cloud Engineer", "SRE"],
    "ENGINEERING":            ["Mechanical Engineer", "Systems Engineer", "Electrical Engineer", "Process Engineer", "R&D Engineer"],
    "BUSINESS-DEVELOPMENT":   ["Business Development Manager", "Account Executive", "Growth Manager", "Partnership Manager"],
    "FINANCE":                ["Financial Analyst", "Finance Manager", "Investment Analyst", "FP&A Analyst"],
    "ACCOUNTANT":             ["Staff Accountant", "Senior Accountant", "Controller", "Accounting Manager"],
    "BANKING":                ["Investment Banker", "Credit Analyst", "Risk Analyst", "Relationship Manager"],
    "HEALTHCARE":             ["Registered Nurse", "Healthcare Analyst", "Clinical Coordinator", "Medical Assistant"],
    "HR":                     ["HR Generalist", "Recruiter", "HR Business Partner", "Talent Acquisition Specialist"],
    "CONSULTANT":             ["Management Consultant", "Strategy Consultant", "Business Analyst", "Senior Consultant"],
    "DESIGNER":               ["UX Designer", "Graphic Designer", "Product Designer", "Visual Designer"],
    "DIGITAL-MEDIA":          ["Digital Marketing Manager", "Content Strategist", "Social Media Manager", "Video Editor"],
    "SALES":                  ["Account Executive", "Sales Manager", "Business Development Rep", "Sales Engineer"],
    "TEACHER":                ["High School Teacher", "Professor", "Curriculum Developer", "Instructional Designer"],
    "ARTS":                   ["Creative Director", "Art Director", "Illustrator", "Photographer"],
    "AVIATION":               ["Commercial Pilot", "Flight Dispatcher", "Aviation Safety Officer"],
    "AGRICULTURE":            ["Agronomist", "Farm Manager", "Agricultural Consultant"],
    "PUBLIC-RELATIONS":       ["PR Manager", "Communications Specialist", "Media Relations Coordinator"],
    "FITNESS":                ["Personal Trainer", "Strength Coach", "Wellness Coordinator"],
    "CONSTRUCTION":           ["Project Manager", "Site Supervisor", "Civil Engineer", "Estimator"],
    "ADVOCATE":               ["Attorney", "Legal Analyst", "Compliance Officer", "Paralegal"],
    "CHEF":                   ["Executive Chef", "Sous Chef", "Culinary Director", "Pastry Chef"],
    "APPAREL":                ["Fashion Designer", "Merchandiser", "Product Development Manager"],
    "AUTOMOBILE":             ["Automotive Engineer", "Quality Engineer", "Vehicle Dynamics Engineer"],
    "BPO":                    ["Customer Service Manager", "Operations Lead", "Process Improvement Analyst"],
}

FIRST_NAMES = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Barbara",
               "David","Elizabeth","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
               "Christopher","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
               "Donald","Ashley","Steven","Dorothy","Paul","Kimberly","Andrew","Emily","George","Donna",
               "Priya","Rahul","Aisha","Mohammed","Wei","Yuki","Carlos","Sofia","Ahmed","Fatima",
               "Arjun","Meera","Sean","Chloe","Liam","Emma","Noah","Olivia","Ethan","Ava"]

LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
              "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
              "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
              "Kumar","Patel","Sharma","Nguyen","Chen","Kim","Wang","Singh","Ali","Hassan",
              "Mueller","Schmidt","Dupont","Rossi","Svensson","Kowalski","Ivanova","Yamamoto","Park","Liu"]

CITIES = [
    ("San Francisco","CA","USA"), ("New York","NY","USA"), ("Seattle","WA","USA"),
    ("Austin","TX","USA"), ("Boston","MA","USA"), ("Chicago","IL","USA"),
    ("Los Angeles","CA","USA"), ("Denver","CO","USA"), ("Atlanta","GA","USA"),
    ("Miami","FL","USA"), ("Portland","OR","USA"), ("San Jose","CA","USA"),
    ("San Diego","CA","USA"), ("Dallas","TX","USA"), ("Houston","TX","USA"),
    ("Raleigh","NC","USA"), ("Nashville","TN","USA"), ("Minneapolis","MN","USA"),
    ("Toronto","ON","Canada"), ("Vancouver","BC","Canada"), ("London","","UK"),
    ("Berlin","","Germany"), ("Amsterdam","","Netherlands"), ("Bangalore","KA","India"),
]


def extract_email(text):
    m = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    return m.group(0) if m else None


def extract_phone(text):
    m = re.search(r"(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}", text)
    return m.group(0).strip() if m else None


def extract_years(text):
    m = re.search(r"(\d+)\s*\+?\s*years?\s+(?:of\s+)?experience", text, re.I)
    if m: return int(m.group(1))
    return None


def make_member(row, used_emails):
    cat = row["Category"].strip()
    resume_text = row["Resume_str"]

    fn = random.choice(FIRST_NAMES)
    ln = random.choice(LAST_NAMES)
    member_id = f"m_{uuid.uuid4().hex[:12]}"

    # Try to reuse a real email from the resume, otherwise generate one
    real_email = extract_email(resume_text)
    if real_email and real_email not in used_emails and len(real_email) < 200:
        email = real_email.lower()
    else:
        slug = f"{fn.lower()}.{ln.lower()}.{uuid.uuid4().hex[:6]}"
        email = f"{slug}@linkedin-sim.example"

    used_emails.add(email)

    phone = extract_phone(resume_text)
    city, state, country = random.choice(CITIES)
    skills = random.sample(CATEGORY_SKILLS.get(cat, ["Communication", "Teamwork"]), min(5, len(CATEGORY_SKILLS.get(cat, ["Communication"]))))
    headline_choices = CATEGORY_HEADLINES.get(cat, [cat.replace("-", " ").title()])
    headline = random.choice(headline_choices)

    years = extract_years(resume_text)
    if years:
        headline = f"{headline} | {years}+ years experience"

    # Trim resume to ~2000 chars for about_summary
    about = " ".join(resume_text.split())[:1800].strip()
    if not about:
        about = None

    return {
        "member_id": member_id,
        "first_name": fn,
        "last_name": ln,
        "email": email,
        "phone": phone,
        "city": city,
        "state": state,
        "country": country,
        "headline": headline,
        "about_summary": about,
        "experience_json": json.dumps([{
            "company": "Previous Company",
            "title": random.choice(headline_choices),
            "start_year": random.randint(2018, 2022),
            "end_year": None,
            "description": f"Experienced {cat.replace('-',' ').lower()} professional."
        }]),
        "education_json": json.dumps([{
            "school": random.choice(["State University", "City College", "Tech Institute", "National University"]),
            "degree": "B.S.",
            "grad_year": random.randint(2010, 2022),
        }]),
        "skills_json": json.dumps(skills),
        "resume_text": resume_text[:8000],
        "connections_count": random.randint(0, 500),
        "profile_views_daily": random.randint(0, 100),
    }


def main():
    print(f"Reading {CSV_PATH} …")
    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} resume rows across {len(set(r['Category'] for r in rows))} categories")

    used_emails = set()
    members = [make_member(r, used_emails) for r in rows]
    print(f"Prepared {len(members)} member records")

    if DRY_RUN:
        print("Dry run — first 3 members:")
        for m in members[:3]:
            print(json.dumps({k: v for k, v in m.items() if k != 'resume_text' and k != 'about_summary'}, indent=2))
        return

    conn = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3308)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "Password123!"),
        database=os.getenv("MYSQL_DB", "data236"),
        charset="utf8mb4",
        connect_timeout=10,
    )
    cursor = conn.cursor()

    INSERT_SQL = """
        INSERT IGNORE INTO members
          (member_id, first_name, last_name, email, phone, city, state, country,
           headline, about_summary, experience_json, education_json, skills_json,
           resume_text, connections_count, profile_views_daily)
        VALUES
          (%s, %s, %s, %s, %s, %s, %s, %s,
           %s, %s, %s, %s, %s,
           %s, %s, %s)
    """

    batch, batch_size, inserted = [], 200, 0
    for m in members:
        batch.append((
            m["member_id"], m["first_name"], m["last_name"], m["email"], m["phone"],
            m["city"], m["state"], m["country"],
            m["headline"], m["about_summary"],
            m["experience_json"], m["education_json"], m["skills_json"],
            m["resume_text"], m["connections_count"], m["profile_views_daily"],
        ))
        if len(batch) >= batch_size:
            cursor.executemany(INSERT_SQL, batch)
            conn.commit()
            inserted += cursor.rowcount
            print(f"  Inserted batch, running total: {inserted}")
            batch = []

    if batch:
        cursor.executemany(INSERT_SQL, batch)
        conn.commit()
        inserted += cursor.rowcount

    cursor.close()
    conn.close()
    print(f"\nDone. {inserted} new members inserted (duplicates skipped via INSERT IGNORE).")


if __name__ == "__main__":
    main()

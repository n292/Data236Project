"""
Seed 8 job postings for recruiter m_447299a83400 (dipin.jassal@sjsu.edu)
and create applications from random members.
"""
import sys, uuid, random
from datetime import datetime, timedelta

sys.path.insert(0, 'services/profile-service/backend')
from app.db.session import engine
from sqlalchemy import text
import pymysql

RECRUITER_ID  = 'm_447299a83400'
COMPANY_ID    = str(uuid.uuid4())
COMPANY_NAME  = 'TechNova Inc.'

JOBS = [
    {
        'title': 'Senior Software Engineer',
        'location': 'San Francisco, CA',
        'employment_type': 'full_time',
        'seniority_level': 'Senior',
        'remote': 'hybrid',
        'salary_min': 160000, 'salary_max': 210000,
        'skills': ['Python', 'AWS', 'Kubernetes', 'React'],
        'description': 'Build scalable backend systems for our cloud platform. You will own microservices and work closely with product.',
    },
    {
        'title': 'Frontend Engineer',
        'location': 'New York, NY',
        'employment_type': 'full_time',
        'seniority_level': 'Mid-Senior',
        'remote': 'remote',
        'salary_min': 130000, 'salary_max': 170000,
        'skills': ['React', 'TypeScript', 'GraphQL', 'CSS'],
        'description': 'Join our product team building next-gen user interfaces for millions of users worldwide.',
    },
    {
        'title': 'Data Scientist',
        'location': 'Seattle, WA',
        'employment_type': 'full_time',
        'seniority_level': 'Mid-Senior',
        'remote': 'hybrid',
        'salary_min': 145000, 'salary_max': 195000,
        'skills': ['Python', 'Machine Learning', 'SQL', 'PyTorch'],
        'description': 'Drive ML initiatives across our recommendation and personalization stack.',
    },
    {
        'title': 'DevOps Engineer',
        'location': 'Austin, TX',
        'employment_type': 'full_time',
        'seniority_level': 'Mid-Senior',
        'remote': 'onsite',
        'salary_min': 125000, 'salary_max': 160000,
        'skills': ['Terraform', 'AWS', 'Docker', 'CI/CD'],
        'description': 'Maintain and improve infrastructure reliability, scalability, and deployment pipelines.',
    },
    {
        'title': 'Product Manager',
        'location': 'Chicago, IL',
        'employment_type': 'full_time',
        'seniority_level': 'Senior',
        'remote': 'hybrid',
        'salary_min': 140000, 'salary_max': 185000,
        'skills': ['Product Strategy', 'Agile', 'SQL', 'Roadmapping'],
        'description': 'Lead cross-functional teams to define and ship impactful product experiences.',
    },
    {
        'title': 'Machine Learning Engineer',
        'location': 'Boston, MA',
        'employment_type': 'full_time',
        'seniority_level': 'Senior',
        'remote': 'hybrid',
        'salary_min': 165000, 'salary_max': 220000,
        'skills': ['Python', 'TensorFlow', 'MLOps', 'Spark'],
        'description': 'Build and deploy production ML models at scale. Work with research to bring ideas to production.',
    },
    {
        'title': 'Backend Engineer (Node.js)',
        'location': 'Denver, CO',
        'employment_type': 'full_time',
        'seniority_level': 'Mid',
        'remote': 'remote',
        'salary_min': 115000, 'salary_max': 150000,
        'skills': ['Node.js', 'PostgreSQL', 'REST APIs', 'Redis'],
        'description': 'Design and build APIs powering our core platform services. High ownership, small team.',
    },
    {
        'title': 'UX/UI Designer',
        'location': 'Los Angeles, CA',
        'employment_type': 'full_time',
        'seniority_level': 'Mid-Senior',
        'remote': 'hybrid',
        'salary_min': 110000, 'salary_max': 145000,
        'skills': ['Figma', 'User Research', 'Design Systems', 'Prototyping'],
        'description': 'Shape the visual and interaction design of our product across web and mobile.',
    },
]

MEMBER_IDS = [
    'm_aee72c551e7d', 'm_c01cc684168f', 'm_e266a89d26a4', 'm_85a0f0f5b76b',
    'm_b9b113602b68', 'm_cdb661cb50c1', 'm_30eff1518695', 'm_f0b15ec177a9',
    'm_c0af184cf664', 'm_5501ee241d83', 'm_f9d0cd120bd6', 'm_8eb3734e02dd',
    'm_2e40a7fbe12e', 'm_d6d76f2f55d2', 'm_8359ebdd3a01', 'm_c50174d41e0a',
    'm_9386b802d0c2', 'm_00563ef00848', 'm_ffdfed034f34', 'm_b095fca87d2b',
    'm_a6cd0954773a', 'm_144a65658287', 'm_73f97d62d7aa', 'm_9694523b07aa',
    'm_dad3c07e80b8', 'm_c99e9bb98bee', 'm_ca7188857995', 'm_3f8622c2b321',
    'm_87ba6dd74095', 'm_e926b7c3f2b2',
]

STATUSES = ['submitted', 'reviewed', 'accepted', 'rejected']

def main():
    import json

    # ── 1. Insert jobs into data236.job_postings ──────────────────────────────
    job_ids = []
    with engine.connect() as conn:
        for job in JOBS:
            jid = 'job-' + str(uuid.uuid4())[:8]
            job_ids.append(jid)
            posted = datetime.now() - timedelta(days=random.randint(1, 30))
            conn.execute(text("""
                INSERT INTO job_postings
                  (job_id, company_id, company_name, recruiter_id, title, description,
                   seniority_level, employment_type, location, remote,
                   skills_required, salary_min, salary_max,
                   posted_datetime, status, views_count, applicants_count)
                VALUES
                  (:jid, :cid, :cname, :rid, :title, :desc,
                   :seniority, :etype, :loc, :remote,
                   :skills, :smin, :smax,
                   :posted, 'open', :views, :apps)
            """), {
                'jid': jid, 'cid': COMPANY_ID, 'cname': COMPANY_NAME,
                'rid': RECRUITER_ID, 'title': job['title'], 'desc': job['description'],
                'seniority': job['seniority_level'], 'etype': job['employment_type'],
                'loc': job['location'], 'remote': job['remote'],
                'skills': json.dumps(job['skills']),
                'smin': job['salary_min'], 'smax': job['salary_max'],
                'posted': posted, 'views': random.randint(50, 400),
                'apps': 0,
            })
            print(f'  ✓ Job created: [{jid}] {job["title"]} — {job["location"]}')
        conn.commit()

    # ── 2. Insert applications into application_db ────────────────────────────
    app_conn = pymysql.connect(
        host='127.0.0.1', user='root', password='', database='application_db', port=3306
    )
    try:
        cur = app_conn.cursor()
        # Check columns
        cur.execute('DESCRIBE applications')
        cols = [r[0] for r in cur.fetchall()]
        print(f'\napplication columns: {cols}')

        apps_inserted = 0
        for i, job_id in enumerate(job_ids):
            # 2-6 applicants per job
            n = random.randint(2, 6)
            applicants = random.sample(MEMBER_IDS, min(n, len(MEMBER_IDS)))
            for member_id in applicants:
                app_id = 'app-' + str(uuid.uuid4())[:8]
                status = random.choices(STATUSES, weights=[4, 3, 1, 2])[0]
                applied_at = datetime.now() - timedelta(days=random.randint(0, 20))

                cover_letters = [
                    f"I am excited to apply for the {JOBS[i]['title']} role. My background in {', '.join(JOBS[i]['skills'][:2])} makes me a strong fit.",
                    f"Having worked extensively with {JOBS[i]['skills'][0]}, I believe I can make a meaningful impact at {COMPANY_NAME}.",
                    f"I am passionate about this {JOBS[i]['title']} opportunity and would love to bring my skills to your team.",
                ]

                try:
                    if 'cover_letter' in cols and 'resume_text' in cols:
                        cur.execute("""
                            INSERT INTO applications
                              (application_id, job_id, member_id, recruiter_id, status, cover_letter, resume_text, created_at, updated_at)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """, (app_id, job_id, member_id, RECRUITER_ID, status,
                              random.choice(cover_letters), '', applied_at, applied_at))
                    else:
                        cur.execute("""
                            INSERT INTO applications
                              (application_id, job_id, member_id, recruiter_id, status, created_at, updated_at)
                            VALUES (%s,%s,%s,%s,%s,%s,%s)
                        """, (app_id, job_id, member_id, RECRUITER_ID, status, applied_at, applied_at))
                    apps_inserted += 1
                except Exception as e:
                    print(f'    app insert error: {e}')

            # Update applicants_count on job
            with engine.connect() as conn2:
                cur2 = cur
                actual_apps = len(applicants)
            with engine.connect() as conn2:
                conn2.execute(text('UPDATE job_postings SET applicants_count=:n WHERE job_id=:jid'),
                              {'n': len(applicants), 'jid': job_id})
                conn2.commit()

        app_conn.commit()
        print(f'\n✓ {len(job_ids)} jobs created')
        print(f'✓ {apps_inserted} applications inserted')
        print(f'\nJob IDs:')
        for jid in job_ids:
            print(f'  {jid}')
    finally:
        app_conn.close()

if __name__ == '__main__':
    main()

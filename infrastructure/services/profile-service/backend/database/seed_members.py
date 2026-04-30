"""Generate and insert 10,000 seed members into the data236 database."""
import json
import random
import sys
import uuid
from datetime import datetime, timedelta

import pymysql
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

FIRST_NAMES = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Elizabeth','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Dorothy','Paul','Kimberly','Andrew','Emily','George','Donna','Joshua','Michelle','Kevin','Carol','Brian','Amanda','Edward','Melissa','Ronald','Deborah','Timothy','Stephanie','Jason','Rebecca','Jeffrey','Sharon','Ryan','Laura','Gary','Cynthia','Jacob','Kathleen','Nicholas','Amy','Eric','Angela','Jonathan','Shirley','Stephen','Anna','Larry','Brenda','Justin','Pamela','Scott','Emma','Raymond','Nicole','Samuel','Helen','Frank','Samantha','Benjamin','Katherine','Brandon','Christine','Gregory','Debra','Raymond','Rachel','Frank','Carolyn','Alexander','Janet','Patrick','Catherine','Jack','Maria']
LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Phillips','Evans','Turner','Torres','Parker','Collins','Edwards','Stewart','Flores','Morris','Nguyen','Murphy','Rivera','Cook','Rogers','Morgan','Peterson','Cooper','Reed','Bailey','Bell','Gomez','Kelly','Howard','Ward','Cox','Diaz','Richardson','Wood','Watson','Brooks','Bennett','Gray','James','Reyes','Cruz','Hughes','Price','Myers','Long','Foster','Sanders','Ross','Morales','Powell','Sullivan','Russell','Ortiz','Jenkins','Gutierrez','Perry','Butler']
CITIES = [('San Francisco','CA'),('New York','NY'),('Seattle','WA'),('Austin','TX'),('Boston','MA'),('Chicago','IL'),('Los Angeles','CA'),('Denver','CO'),('Atlanta','GA'),('Miami','FL'),('Portland','OR'),('San Jose','CA'),('San Diego','CA'),('Dallas','TX'),('Houston','TX'),('Phoenix','AZ'),('Minneapolis','MN'),('Detroit','MI'),('Columbus','OH'),('Nashville','TN'),('Raleigh','NC'),('Salt Lake City','UT'),('Sacramento','CA'),('Tampa','FL'),('Pittsburgh','PA')]
HEADLINES = ['Software Engineer at {co}','Senior Engineer | {skill} Specialist','Full Stack Developer | Building scalable systems','Backend Engineer | Distributed Systems','Frontend Engineer | React & TypeScript','Data Engineer | Kafka & Spark','DevOps Engineer | Kubernetes & AWS','ML Engineer | NLP & Computer Vision','Product Manager | 0→1 Products','Engineering Manager | Growing high-performance teams','Staff Engineer | Platform & Infrastructure','Security Engineer | Zero Trust Architecture','QA Engineer | Test Automation','Solutions Architect | Cloud & Microservices','Tech Lead | Agile & XP']
COMPANIES = ['Google','Meta','Apple','Amazon','Microsoft','Netflix','Uber','Lyft','Airbnb','Stripe','Twilio','Shopify','Salesforce','Oracle','IBM','Cisco','Nvidia','Databricks','Snowflake','Confluent']
SKILLS_POOL = ['Python','JavaScript','TypeScript','Java','Go','Rust','C++','React','Vue','Angular','Node.js','FastAPI','Django','Spring Boot','Kubernetes','Docker','AWS','GCP','Azure','Kafka','Spark','PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','TensorFlow','PyTorch','GraphQL','REST APIs']

def rand_skills():
    n = random.randint(3, 8)
    return json.dumps(random.sample(SKILLS_POOL, n))

def rand_experience(first, last):
    co = random.choice(COMPANIES)
    years = random.randint(1, 5)
    return json.dumps([{
        'company': co,
        'title': random.choice(['Engineer','Senior Engineer','Staff Engineer','Lead Engineer']),
        'start_year': 2024 - years,
        'end_year': None,
        'description': f'Worked on core platform systems at {co}.'
    }])

def rand_education():
    schools = ['MIT','Stanford','CMU','UC Berkeley','Caltech','Georgia Tech','University of Washington','UT Austin','Cornell','Princeton']
    return json.dumps([{
        'school': random.choice(schools),
        'degree': random.choice(['B.S. Computer Science','M.S. Computer Science','B.S. Electrical Engineering','M.S. Data Science']),
        'grad_year': random.randint(2015, 2023)
    }])

conn = pymysql.connect(
    host=os.getenv('MYSQL_HOST','localhost'),
    port=int(os.getenv('MYSQL_PORT', 3306)),
    user=os.getenv('MYSQL_USER','root'),
    password=os.getenv('MYSQL_PASSWORD',''),
    database='data236',
    charset='utf8mb4'
)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS members (
  member_id VARCHAR(64) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  headline VARCHAR(255) NULL,
  about_summary TEXT NULL,
  experience_json TEXT NULL,
  education_json TEXT NULL,
  skills_json TEXT NULL,
  profile_photo_url TEXT NULL,
  resume_text LONGTEXT NULL,
  connections_count INT NOT NULL DEFAULT 0,
  profile_views_daily INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_members_email (email),
  INDEX idx_members_location (city, state, country)
)
""")
conn.commit()

SQL = """
INSERT IGNORE INTO members
  (member_id,first_name,last_name,email,phone,city,state,country,headline,about_summary,experience_json,education_json,skills_json,connections_count,profile_views_daily)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""

BATCH = 500
total = 0
rows = []
for i in range(10000):
    fn = random.choice(FIRST_NAMES)
    ln = random.choice(LAST_NAMES)
    mid = str(uuid.uuid4())
    email = f"{fn.lower()}.{ln.lower()}.{i}@example.com"
    city, state = random.choice(CITIES)
    co = random.choice(COMPANIES)
    hl = random.choice(HEADLINES).format(co=co, skill=random.choice(['Python','React','Go','Kubernetes']))
    rows.append((mid, fn, ln, email, None, city, state, 'US', hl,
                 f'Experienced engineer passionate about building great products.',
                 rand_experience(fn, ln), rand_education(), rand_skills(),
                 random.randint(0, 500), random.randint(0, 50)))
    if len(rows) == BATCH:
        cursor.executemany(SQL, rows)
        conn.commit()
        total += len(rows)
        rows = []
        print(f'  Inserted {total} members...')

if rows:
    cursor.executemany(SQL, rows)
    conn.commit()
    total += len(rows)

print(f'Done. Inserted {total} members.')
cursor.close()
conn.close()

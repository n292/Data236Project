from fastapi import FastAPI
from pydantic import BaseModel
import redis
import json
import time

app = FastAPI(title="LinkedIn Job Service - M7 Redis Caching Demo")

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

class Job(BaseModel):
    id: int
    title: str
    company: str
    location: str
    job_type: str

fake_jobs = [
    {"id": 1, "title": "Software Engineer", "company": "Google", "location": "San Jose", "job_type": "Full-time"},
    {"id": 2, "title": "Data Analyst", "company": "Amazon", "location": "Seattle", "job_type": "Full-time"},
    {"id": 3, "title": "ML Engineer", "company": "Meta", "location": "Menlo Park", "job_type": "Internship"}
]

@app.get("/health")
def health_check():
    return {"status": "running", "service": "job-service", "redis": "connected"}

@app.get("/jobs")
def get_jobs():
    cache_key = "jobs:list"
    cached = r.get(cache_key)

    if cached:
        print("CACHE HIT: /jobs", flush=True)
        return {
            "source": "redis_cache",
            "cache_status": "HIT",
            "data": json.loads(cached)
        }

    print("CACHE MISS: /jobs", flush=True)
    time.sleep(2)

    r.set(cache_key, json.dumps(fake_jobs), ex=120)

    return {
        "source": "database_simulation",
        "cache_status": "MISS",
        "data": fake_jobs
    }

@app.get("/jobs/{job_id}")
def get_job_by_id(job_id: int):
    cache_key = f"jobs:{job_id}"
    cached = r.get(cache_key)

    if cached:
        print(f"CACHE HIT: /jobs/{job_id}", flush=True)
        return {
            "source": "redis_cache",
            "cache_status": "HIT",
            "data": json.loads(cached)
        }

    print(f"CACHE MISS: /jobs/{job_id}", flush=True)
    time.sleep(2)

    job = next((job for job in fake_jobs if job["id"] == job_id), None)

    if not job:
        return {"message": "Job not found"}

    r.set(cache_key, json.dumps(job), ex=120)

    return {
        "source": "database_simulation",
        "cache_status": "MISS",
        "data": job
    }

@app.post("/jobs")
def create_job(job: Job):
    fake_jobs.append(job.dict())

    r.delete("jobs:list")

    return {
        "message": "Job created successfully",
        "cache_action": "jobs:list cache invalidated",
        "data": job
    }

@app.delete("/cache/clear")
def clear_cache():
    r.flushdb()
    return {"message": "Redis cache cleared successfully"}

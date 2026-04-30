"""Inter-service HTTP client.

Fetches job details, applications, resume PDFs, and member profiles
from sibling microservices using httpx with a generated service JWT.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Optional

import httpx

log = logging.getLogger(__name__)

APPLICATION_SERVICE = os.getenv("APPLICATION_SERVICE_URL", "http://application-service:5003")
JOB_SERVICE = os.getenv("JOB_SERVICE_URL", "http://job-service:3002")
PROFILE_SERVICE = os.getenv("PROFILE_SERVICE_URL", "http://profile-service:8000")


def _service_jwt() -> str:
    """Generate an HS256 JWT compatible with the Node.js services' verifyJwt."""
    secret = os.getenv("JWT_SECRET", "changeme-replace-with-32-char-random-string")
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "user_id": "ai-service",
            "role": "recruiter",
            "exp": int(time.time()) + 3600,
        }).encode()
    ).rstrip(b"=").decode()
    signing_input = f"{header}.{payload}"
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


async def fetch_job(job_id: str) -> Optional[dict]:
    """Fetch job posting from job-service (no auth required)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(f"{JOB_SERVICE}/api/v1/jobs/get", json={"job_id": job_id})
            r.raise_for_status()
            data = r.json()
            return data.get("job") or data
    except Exception as exc:
        log.warning("fetch_job failed for %s: %s", job_id, exc)
        return None


async def fetch_applications(job_id: str) -> list[dict]:
    """Fetch all applications for a job from application-service."""
    token = _service_jwt()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{APPLICATION_SERVICE}/applications/byJob",
                json={"job_id": job_id},
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            data = r.json()
            # byJob returns array directly or wrapped
            if isinstance(data, list):
                return data
            return data.get("applications", data.get("data", []))
    except Exception as exc:
        log.warning("fetch_applications failed for job %s: %s", job_id, exc)
        return []


async def fetch_resume_pdf(resume_url: str) -> Optional[bytes]:
    """Download a resume PDF from application-service static files."""
    if not resume_url:
        return None
    # Stored path: "src/uploads/resumes/file.pdf" → strip "src/"
    clean = resume_url.replace("\\", "/").replace("src/", "")
    url = f"{APPLICATION_SERVICE}/{clean}"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.content
    except Exception as exc:
        log.warning("fetch_resume_pdf failed for %s: %s", url, exc)
        return None


async def fetch_member_profile(member_id: str) -> Optional[dict]:
    """Fetch member profile from profile-service."""
    token = _service_jwt()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{PROFILE_SERVICE}/api/members/{member_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            data = r.json()
            return data.get("member") or data
    except Exception as exc:
        log.debug("fetch_member_profile failed for %s: %s", member_id, exc)
        return None

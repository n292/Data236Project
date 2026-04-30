"""Messaging service client — opens a thread and sends outreach messages."""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger(__name__)

MESSAGING_URL = os.getenv("MESSAGING_SERVICE_URL", "http://messaging-service:3004")


async def send_outreach(
    recruiter_id: str,
    candidate_id: str,
    subject: str,
    message: str,
) -> bool:
    """Open (or reuse) a thread between recruiter and candidate, then send the outreach.

    Returns True on success, False if the messaging service is unreachable or rejects the call.
    Failures are logged but never raised — approval must succeed even if messaging is down.
    """
    if not recruiter_id or not candidate_id or not message:
        log.warning("send_outreach called with missing fields — skipping")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: open or reuse existing thread
            r = await client.post(
                f"{MESSAGING_URL}/api/messaging/threads/open",
                json={"participant_ids": [recruiter_id, candidate_id]},
            )
            r.raise_for_status()
            thread_id = r.json()["thread_id"]

            # Step 2: send the outreach message
            full_text = f"Subject: {subject}\n\n{message}" if subject else message
            r = await client.post(
                f"{MESSAGING_URL}/api/messaging/messages/send",
                json={
                    "thread_id": thread_id,
                    "sender_id": recruiter_id,
                    "sender_name": "Recruiter",
                    "message_text": full_text,
                },
            )
            r.raise_for_status()
            log.info("Outreach sent to candidate %s in thread %s", candidate_id, thread_id)
            return True

    except Exception as exc:
        log.warning("Failed to send outreach to candidate %s: %s", candidate_id, exc)
        return False

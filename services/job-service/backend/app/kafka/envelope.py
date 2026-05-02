import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings

_NS = uuid.UUID(settings.kafka_idempotency_namespace)


def _uuid_v5(name: str) -> str:
    return str(uuid.uuid5(_NS, name))


def build_envelope(
    *,
    event_type: str,
    trace_id: str,
    actor_id: str,
    entity_type: str,
    entity_id: str,
    payload: dict[str, Any],
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    key = idempotency_key or _uuid_v5(f"{entity_id}:{timestamp}")
    return {
        "event_type": event_type,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor_id": actor_id,
        "entity": {"entity_type": entity_type, "entity_id": entity_id},
        "payload": payload,
        "idempotency_key": key,
    }


def build_job_created_envelope(
    *,
    job_id: str,
    title: str,
    company_id: str,
    recruiter_id: str,
    location: str,
    employment_type: str,
    trace_id: str,
) -> dict[str, Any]:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    idempotency_key = _uuid_v5(f"{job_id}:{timestamp}")
    return {
        "event_type": "job.created",
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor_id": recruiter_id,
        "entity": {"entity_type": "job", "entity_id": job_id},
        "payload": {
            "job_id": job_id,
            "title": title,
            "company_id": company_id,
            "location": location,
            "employment_type": employment_type,
        },
        "idempotency_key": idempotency_key,
    }

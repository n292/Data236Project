import json
import threading
import time
from typing import Any

from kafka import KafkaProducer

from app.core.config import settings
from app.kafka.envelope import build_envelope, build_job_created_envelope

_lock = threading.Lock()
_producer: KafkaProducer | None = None


def _brokers() -> list[str]:
    return [b.strip() for b in settings.kafka_brokers.split(",") if b.strip()]


def _ensure_producer() -> KafkaProducer | None:
    global _producer
    brokers = _brokers()
    if not brokers:
        return None
    with _lock:
        if _producer is None:
            _producer = KafkaProducer(
                bootstrap_servers=brokers,
                client_id=settings.kafka_client_id,
                acks="all",
                retries=3,
                request_timeout_ms=30000,
                api_version_auto_timeout_ms=5000,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
            )
        return _producer


def _retry(fn, attempts: int = 3):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            if i < attempts - 1:
                time.sleep(0.2 * (i + 1))
    raise last


def send_job_created(**kwargs) -> None:
    if not _brokers():
        return
    envelope = build_job_created_envelope(**kwargs)
    topic = settings.kafka_topic_job_created

    def _send():
        p = _ensure_producer()
        if not p:
            return
        p.send(topic, key=kwargs["job_id"], value=envelope)
        p.flush()

    try:
        _retry(_send)
    except Exception as e:
        print(f"job.created Kafka produce failed (job row committed): {e}")


def _send_envelope(topic: str, key: str, envelope: dict[str, Any]) -> None:
    def _send():
        p = _ensure_producer()
        if not p:
            return
        p.send(topic, key=key, value=envelope)
        p.flush()

    _retry(_send)


def send_job_closed(*, job_id: str, recruiter_id: str, company_id: str | None, trace_id: str) -> None:
    if not _brokers():
        return
    topic = settings.kafka_topic_job_closed
    envelope = build_envelope(
        event_type="job.closed",
        trace_id=trace_id,
        actor_id=recruiter_id,
        entity_type="job",
        entity_id=job_id,
        payload={
            "job_id": job_id,
            "recruiter_id": recruiter_id,
            "company_id": company_id or None,
            "status": "closed",
        },
    )
    try:
        _send_envelope(topic, job_id, envelope)
    except Exception as e:
        print(f"job.closed Kafka produce failed: {e}")


def send_job_viewed(*, job_id: str, viewer_id: str, trace_id: str) -> None:
    if not _brokers():
        return
    topic = settings.kafka_topic_job_viewed
    envelope = build_envelope(
        event_type="job.viewed",
        trace_id=trace_id,
        actor_id=viewer_id,
        entity_type="job",
        entity_id=job_id,
        payload={"job_id": job_id, "viewer_id": viewer_id},
    )
    try:
        _send_envelope(topic, job_id, envelope)
    except Exception as e:
        print(f"job.viewed Kafka produce failed: {e}")


def send_job_saved(
    *, job_id: str, user_id: str, trace_id: str, session_meta: dict | None = None
) -> None:
    if not _brokers():
        return
    from datetime import datetime, timezone

    topic = settings.kafka_topic_job_saved
    saved_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    envelope = build_envelope(
        event_type="job.saved",
        trace_id=trace_id,
        actor_id=user_id,
        entity_type="job",
        entity_id=job_id,
        payload={
            "job_id": job_id,
            "user_id": user_id,
            "member_id": user_id,
            "saved_at": saved_at,
            "session_trace_id": trace_id,
            "session_meta": session_meta or {},
        },
    )
    try:
        _send_envelope(topic, job_id, envelope)
    except Exception as e:
        print(f"job.saved Kafka produce failed: {e}")


def send_job_unsaved(*, job_id: str, user_id: str, trace_id: str) -> None:
    if not _brokers():
        return
    from datetime import datetime, timezone

    topic = settings.kafka_topic_job_saved
    unsaved_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    envelope = build_envelope(
        event_type="job.unsaved",
        trace_id=trace_id,
        actor_id=user_id,
        entity_type="job",
        entity_id=job_id,
        payload={
            "job_id": job_id,
            "user_id": user_id,
            "member_id": user_id,
            "unsaved_at": unsaved_at,
        },
    )
    try:
        _send_envelope(topic, job_id, envelope)
    except Exception:
        pass


def disconnect_producer() -> None:
    global _producer
    with _lock:
        if _producer:
            try:
                _producer.flush()
                _producer.close()
            except Exception as e:
                print(f"Kafka producer disconnect: {e}")
            _producer = None

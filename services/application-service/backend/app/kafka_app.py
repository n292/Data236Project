import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

import pymysql.err
from kafka import KafkaConsumer, KafkaProducer
from sqlalchemy import text

from app.core.config import kafka_bootstrap, settings
from app.db.session import engine

log = logging.getLogger(__name__)

_producer: KafkaProducer | None = None
_producer_lock = threading.Lock()
_consumer_stop = threading.Event()
_consumer_thread: threading.Thread | None = None


def ensure_idempotency_table() -> None:
    with engine.connect() as conn:
        conn.execute(
            text(
                """CREATE TABLE IF NOT EXISTS processed_events (
                     idempotency_key VARCHAR(255) PRIMARY KEY,
                     processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                   )"""
            )
        )
        conn.commit()


def _ensure_producer() -> KafkaProducer | None:
    global _producer
    brokers = kafka_bootstrap()
    if not brokers:
        return None
    with _producer_lock:
        if _producer is None:
            _producer = KafkaProducer(
                bootstrap_servers=brokers,
                client_id=settings.kafka_client_id,
                retries=3,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
            )
        return _producer


def publish_application_submitted(application: dict[str, Any]) -> None:
    p = _ensure_producer()
    if not p:
        return
    env = {
        "event_type": "application.submitted",
        "trace_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "actor_id": application["member_id"],
        "entity": {
            "entity_type": "application",
            "entity_id": application["application_id"],
        },
        "payload": {
            "application_id": application["application_id"],
            "job_id": application["job_id"],
            "member_id": application["member_id"],
            "resume_ref": application.get("resume_url"),
            "recruiter_id": application.get("recruiter_id"),
            "metadata": application.get("metadata") or {},
        },
        "idempotency_key": application["application_id"],
    }
    p.send("application.submitted", key=application["application_id"], value=env)
    p.flush()


def publish_status_updated(application_id: str, status: str, actor_id: str) -> None:
    p = _ensure_producer()
    if not p:
        return
    env = {
        "event_type": "application.status_updated",
        "trace_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "actor_id": actor_id,
        "idempotency_key": f"{application_id}:{status}",
        "entity": {"entity_type": "application", "entity_id": application_id},
        "payload": {"application_id": application_id, "status": status},
    }
    p.send("application.status_updated", key=application_id, value=env)
    p.flush()


def disconnect_producer() -> None:
    global _producer
    with _producer_lock:
        if _producer:
            try:
                _producer.flush()
                _producer.close()
            except Exception as e:
                log.warning("producer close: %s", e)
            _producer = None


def _upsert_application_cur(cur, payload: dict) -> None:
    application_id = payload.get("application_id")
    job_id = payload.get("job_id")
    member_id = payload.get("member_id")
    if not application_id or not job_id or not member_id:
        return
    meta = payload.get("metadata")
    meta_s = json.dumps(meta) if meta is not None else None
    resume_url = payload.get("resume_ref") or payload.get("resume_url")
    cur.execute(
        """INSERT INTO applications
           (application_id, job_id, member_id, recruiter_id, resume_url, cover_letter, metadata, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE
             resume_url = VALUES(resume_url),
             cover_letter = VALUES(cover_letter),
             metadata = VALUES(metadata),
             status = VALUES(status),
             updated_at = CURRENT_TIMESTAMP""",
        [
            application_id,
            job_id,
            member_id,
            payload.get("recruiter_id"),
            resume_url,
            payload.get("cover_letter"),
            meta_s,
            payload.get("status") or "submitted",
        ],
    )


def _consumer_loop() -> None:
    brokers = kafka_bootstrap()
    if not brokers:
        return
    consumer = KafkaConsumer(
        "application.submitted",
        bootstrap_servers=brokers,
        group_id="application-service-group",
        enable_auto_commit=True,
        auto_offset_reset="latest",
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
    )
    log.info("application-service Kafka consumer started")
    try:
        while not _consumer_stop.is_set():
            records = consumer.poll(timeout_ms=800)
            for _tp, batch in records.items():
                for record in batch:
                    if _consumer_stop.is_set():
                        break
                    try:
                        event = record.value
                        key = event.get("idempotency_key")
                        if not key:
                            continue
                        raw_conn = engine.raw_connection()
                        try:
                            cur = raw_conn.cursor()
                            cur.execute(
                                "SELECT 1 FROM processed_events WHERE idempotency_key = %s LIMIT 1",
                                (key,),
                            )
                            if cur.fetchone():
                                continue
                            try:
                                _upsert_application_cur(cur, event.get("payload") or {})
                                cur.execute(
                                    "INSERT IGNORE INTO processed_events (idempotency_key) VALUES (%s)",
                                    (key,),
                                )
                                raw_conn.commit()
                                log.info("consumer saved application %s", key)
                            except pymysql.err.IntegrityError:
                                raw_conn.rollback()
                                cur.execute(
                                    "INSERT IGNORE INTO processed_events (idempotency_key) VALUES (%s)",
                                    (key,),
                                )
                                raw_conn.commit()
                            except Exception:
                                raw_conn.rollback()
                                raise
                        finally:
                            raw_conn.close()
                    except Exception as e:
                        log.error("consumer error: %s", e)
    finally:
        consumer.close()


def start_consumer_background() -> None:
    global _consumer_thread
    if not kafka_bootstrap():
        log.warning("Kafka consumer skipped")
        return
    _consumer_stop.clear()
    _consumer_thread = threading.Thread(target=_consumer_loop, daemon=True, name="app-kafka")
    _consumer_thread.start()


def stop_consumer() -> None:
    _consumer_stop.set()
    if _consumer_thread:
        _consumer_thread.join(timeout=5)

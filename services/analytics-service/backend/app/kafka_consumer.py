import json
import logging
import threading
from datetime import datetime, timezone

from kafka import KafkaConsumer

from app.core.config import kafka_bootstrap
from app.event_bus import broadcast
from app.mongo_db import get_db

log = logging.getLogger(__name__)

TOPICS = [
    "job.created",
    "job.closed",
    "job.viewed",
    "job.saved",
    "member.created",
    "member.updated",
    "profile.viewed",
    "application.submitted",
    "application.status_updated",
    "connection.requested",
    "connection.accepted",
    "message.sent",
    "ai.requests",
    "ai.results",
]

_stop = threading.Event()
_thread: threading.Thread | None = None


def _loop():
    brokers = kafka_bootstrap()
    if not brokers:
        return
    consumer = KafkaConsumer(
        *TOPICS,
        bootstrap_servers=brokers,
        group_id="analytics-service-consumer",
        enable_auto_commit=True,
        auto_offset_reset="latest",
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
    )
    log.info("Analytics Kafka consumer started")
    db = get_db()
    try:
        while not _stop.is_set():
            batch = consumer.poll(timeout_ms=800)
            for tp, records in batch.items():
                for record in records:
                    if _stop.is_set():
                        break
                    try:
                        topic = record.topic
                        event = record.value
                        key = event.get("idempotency_key")
                        if key:
                            exists = db["events"].find_one({"idempotency_key": key})
                            if exists:
                                continue
                        db["events"].insert_one(
                            {**event, "_topic": topic, "_ingested_at": datetime.now(timezone.utc)}
                        )
                        broadcast(topic, event)
                    except Exception as e:
                        if getattr(e, "code", None) != 11000:
                            log.warning("analytics consumer: %s", e)
    finally:
        consumer.close()


def start_consumer_background() -> None:
    global _thread
    if not kafka_bootstrap():
        log.warning("Analytics Kafka skipped")
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, daemon=True, name="analytics-kafka")
    _thread.start()


def stop_consumer() -> None:
    _stop.set()
    if _thread:
        _thread.join(timeout=5)

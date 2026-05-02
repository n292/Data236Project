import json
import logging
import threading

from kafka import KafkaConsumer

from app.core.config import settings
from app.kafka.handlers import handle_application_submitted_envelope, handle_job_viewed_envelope

log = logging.getLogger(__name__)


def _brokers() -> list[str]:
    return [b.strip() for b in settings.kafka_brokers.split(",") if b.strip()]


def _loop(topic: str, group_id: str, handler, stop: threading.Event) -> None:
    brokers = _brokers()
    if not brokers:
        return
    consumer = KafkaConsumer(
        topic,
        bootstrap_servers=brokers,
        group_id=group_id,
        enable_auto_commit=True,
        auto_offset_reset="latest",
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
    )
    log.error("Kafka consumer subscribed: %s (group %s)", topic, group_id)
    try:
        while not stop.is_set():
            records = consumer.poll(timeout_ms=800)
            for _tp, batch in records.items():
                for record in batch:
                    if stop.is_set():
                        break
                    try:
                        handler(record.value)
                    except Exception as e:
                        log.error("Kafka handler error: %s", e)
    finally:
        consumer.close()


def start_background_consumers(stop: threading.Event) -> list[threading.Thread]:
    threads: list[threading.Thread] = []
    if not _brokers():
        log.error("Kafka consumers skipped: set KAFKA_BROKERS")
        return threads

    t1 = threading.Thread(
        target=_loop,
        args=(
            settings.kafka_topic_application_submitted,
            settings.kafka_group_application_submitted,
            handle_application_submitted_envelope,
            stop,
        ),
        daemon=True,
        name="kafka-application-submitted",
    )
    t2 = threading.Thread(
        target=_loop,
        args=(
            settings.kafka_topic_job_viewed,
            settings.kafka_group_job_viewed,
            handle_job_viewed_envelope,
            stop,
        ),
        daemon=True,
        name="kafka-job-viewed",
    )
    t1.start()
    t2.start()
    threads.extend([t1, t2])
    return threads

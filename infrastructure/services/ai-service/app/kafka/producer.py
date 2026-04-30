"""Publishes AI step results to the ai.results Kafka topic."""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

_producer = None


def _get_producer():
    global _producer
    if _producer is not None:
        return _producer
    brokers = os.getenv("KAFKA_BROKERS", "")
    if not brokers:
        return None
    try:
        from kafka import KafkaProducer as _KP
        _producer = _KP(
            bootstrap_servers=brokers.split(","),
            value_serializer=lambda v: json.dumps(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
            retries=3,
            acks="all",
        )
        return _producer
    except Exception as exc:
        print(f"[ai-kafka-producer] init failed: {exc}")
        return None


def publish_ai_result(
    task_id: str,
    trace_id: str,
    step: str,
    status: str,
    payload: dict,
    actor_id: Optional[str] = None,
):
    """Publish a step result to ai.results with the shared event envelope."""
    topic = os.getenv("KAFKA_TOPIC_AI_RESULTS", "ai.results")
    idempotency_key = f"{task_id}:{step}:{status}"
    envelope = {
        "event_type": "ai.result",
        "trace_id": trace_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor_id": actor_id or task_id,
        "entity": {"entity_type": "ai_task", "entity_id": task_id},
        "payload": {
            "task_id": task_id,
            "step": step,
            "status": status,
            **payload,
        },
        "idempotency_key": idempotency_key,
    }
    producer = _get_producer()
    if producer is None:
        print(f"[ai-kafka-producer] offline — result logged: {step}:{status}")
        return envelope
    try:
        producer.send(topic, key=task_id, value=envelope)
        producer.flush()
    except Exception as exc:
        print(f"[ai-kafka-producer] send failed: {exc}")
    return envelope


def close():
    global _producer
    if _producer:
        try:
            _producer.close()
        except Exception:
            pass
        _producer = None

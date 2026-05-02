import json
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from kafka import KafkaProducer

from app.core.config import kafka_bootstrap, settings

_lock = threading.Lock()
_producer: KafkaProducer | None = None
_connected = False


def connect_producer() -> None:
    global _producer, _connected
    brokers = kafka_bootstrap()
    if not brokers:
        _connected = False
        return
    with _lock:
        if _producer is None:
            try:
                _producer = KafkaProducer(
                    bootstrap_servers=brokers,
                    client_id=settings.kafka_client_id,
                    retries=3,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
                )
                _connected = True
            except Exception as e:
                print(f"Kafka producer failed: {e}")
                _connected = False


def disconnect_producer() -> None:
    global _producer, _connected
    with _lock:
        if _producer:
            try:
                _producer.flush()
                _producer.close()
            except Exception:
                pass
            _producer = None
        _connected = False


def publish_event(event_type: str, actor_id: str, entity_type: str, entity_id: str, payload: dict[str, Any]):
    event = {
        "event_type": event_type,
        "trace_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "actor_id": actor_id,
        "entity": {"entity_type": entity_type, "entity_id": entity_id},
        "payload": payload,
        "idempotency_key": str(uuid.uuid4()),
    }
    if _producer and _connected:
        for attempt in range(3):
            try:
                _producer.send(event_type, key=entity_id, value=event)
                _producer.flush()
                return event
            except Exception as e:
                print(f"kafka publish attempt {attempt + 1}: {e}")
    else:
        print(f"[Kafka offline] {event_type}")
    return event

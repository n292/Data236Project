from kafka import KafkaConsumer
from db import events_collection
import json

TOPICS = [
    "job.viewed",
    "job.saved",
    "job.created",
    "job.closed",
    "application.submitted",
    "application.statusUpdated",
    "profile.viewed",
    "message.sent",
    "connection.requested",
    "connection.accepted"
]

try:
    consumer = KafkaConsumer(
        *TOPICS,
        bootstrap_servers="localhost:9092",
        value_deserializer=lambda m: json.loads(m.decode("utf-8")) if m else None,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        group_id="analytics-service-group"
    )
except Exception as e:
    print("Kafka connection failed:", e)
    exit()

print("Kafka consumer started. Listening to topics:", TOPICS)

for message in consumer:
    try:
        event = message.value

        if not event:
            continue

        if "idempotency_key" not in event:
            print("Skipping event without idempotency_key")
            continue

        existing = events_collection.find_one({
            "idempotency_key": event["idempotency_key"]
        })

        if existing:
            print("Duplicate ignored:", event["idempotency_key"])
            continue

        events_collection.insert_one(event)
        print("Stored event:", event.get("event_type", "unknown"))

    except Exception as e:
        print("Error processing event:", e)
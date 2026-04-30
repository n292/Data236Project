"""Consumes ai.requests and runs the full hiring-assistant workflow."""
import json
import os
import threading

_thread = None


def _process_request(event: dict):
    from app.services.hiring_assistant import run_task_async
    payload = event.get("payload", {})
    task_id = payload.get("task_id")
    trace_id = event.get("trace_id", "")
    if not task_id:
        print("[ai-consumer] missing task_id in event payload")
        return
    print(f"[ai-consumer] processing task {task_id} trace={trace_id}")
    run_task_async(
        task_id=task_id,
        trace_id=trace_id,
        job_id=payload.get("job_id", ""),
        job_skills=payload.get("job_skills", []),
        job_seniority=payload.get("job_seniority"),
        resumes=payload.get("resumes", []),
        recruiter_id=event.get("actor_id"),
    )


def _consumer_loop():
    brokers = os.getenv("KAFKA_BROKERS", "")
    if not brokers:
        print("[ai-consumer] KAFKA_BROKERS not set — consumer disabled")
        return
    topic = os.getenv("KAFKA_TOPIC_AI_REQUESTS", "ai.requests")
    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=brokers.split(","),
            group_id="ai-service-consumer",
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda b: json.loads(b.decode()),
            consumer_timeout_ms=1000,
        )
        print(f"[ai-consumer] listening on {topic}")
        while True:
            for msg in consumer:
                try:
                    _process_request(msg.value)
                except Exception as exc:
                    print(f"[ai-consumer] handler error: {exc}")
    except Exception as exc:
        print(f"[ai-consumer] consumer loop exited: {exc}")


def start_consumer():
    global _thread
    if _thread and _thread.is_alive():
        return
    _thread = threading.Thread(target=_consumer_loop, daemon=True, name="ai-kafka-consumer")
    _thread.start()

import pymysql.err

from app.db.session import engine


def handle_application_submitted_envelope(envelope: dict) -> None:
    if not envelope or envelope.get("event_type") != "application.submitted":
        return
    idempotency_key = envelope.get("idempotency_key")
    trace_id = envelope.get("trace_id")
    entity = envelope.get("entity") or {}
    payload = envelope.get("payload") or {}
    job_id = payload.get("job_id")

    if not idempotency_key or not isinstance(idempotency_key, str):
        print("application.submitted: missing idempotency_key")
        return
    if not job_id or not isinstance(job_id, str):
        print("application.submitted: missing payload.job_id")
        return

    conn = engine.raw_connection()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO processed_events (idempotency_key, event_type, trace_id, entity_type, entity_id)
                   VALUES (%s, %s, %s, %s, %s)""",
                [
                    idempotency_key[:128],
                    "application.submitted",
                    (trace_id or "00000000-0000-4000-8000-000000000000")[:36],
                    str(entity.get("entity_type") or "application")[:32],
                    str(entity.get("entity_id") or job_id)[:36],
                ],
            )
        except pymysql.err.IntegrityError:
            conn.rollback()
            return
        cur.execute(
            "UPDATE job_postings SET applicants_count = applicants_count + 1 WHERE job_id = %s",
            [job_id],
        )
        conn.commit()
    finally:
        conn.close()


def handle_job_viewed_envelope(envelope: dict) -> None:
    if not envelope or envelope.get("event_type") != "job.viewed":
        return
    idempotency_key = envelope.get("idempotency_key")
    trace_id = envelope.get("trace_id")
    entity = envelope.get("entity") or {}
    payload = envelope.get("payload") or {}
    job_id = payload.get("job_id") or entity.get("entity_id")

    if not idempotency_key or not isinstance(idempotency_key, str):
        print("job.viewed: missing idempotency_key")
        return
    if not job_id or not isinstance(job_id, str):
        print("job.viewed: missing payload.job_id")
        return

    conn = engine.raw_connection()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO processed_events (idempotency_key, event_type, trace_id, entity_type, entity_id)
                   VALUES (%s, %s, %s, %s, %s)""",
                [
                    idempotency_key[:128],
                    "job.viewed",
                    (trace_id or "00000000-0000-4000-8000-000000000000")[:36],
                    str(entity.get("entity_type") or "job")[:32],
                    str(entity.get("entity_id") or job_id)[:36],
                ],
            )
        except pymysql.err.IntegrityError:
            conn.rollback()
            return
        cur.execute(
            "UPDATE job_postings SET views_count = views_count + 1 WHERE job_id = %s",
            [job_id],
        )
        conn.commit()
    finally:
        conn.close()

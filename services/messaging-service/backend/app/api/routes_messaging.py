import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from pymongo.errors import DuplicateKeyError

from app.kafka_prod import publish_event
from app.mongo_db import get_db

threads_router = APIRouter()
messages_router = APIRouter()


def _now():
    return datetime.now(timezone.utc)


def _as_utc_aware(dt: Any) -> datetime:
    """Mongo may return naive or aware datetimes; comparisons must not mix."""
    if not isinstance(dt, datetime):
        return _now()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _thread_ts(doc: dict, key: str) -> str:
    v = doc.get(key)
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def _is_unread(thread: dict, user_id: str) -> bool:
    lr = (thread.get("last_read") or {}).get(user_id)
    baseline = lr if lr is not None else thread.get("created_at")
    if baseline is None:
        baseline = thread.get("last_message_at")
    if baseline is None:
        return False
    baseline_dt = _as_utc_aware(baseline)
    last_raw = thread.get("last_message_at")
    if last_raw is None:
        return False
    last_msg = _as_utc_aware(last_raw)
    return last_msg > baseline_dt


@threads_router.post("/open")
def open_thread(body: dict = Body(default_factory=dict)):
    participant_ids = body.get("participant_ids")
    if not participant_ids or not isinstance(participant_ids, list) or len(participant_ids) < 2:
        raise HTTPException(status_code=400, detail={"success": False, "message": "participant_ids must be an array with at least 2 user IDs"})

    db = get_db()
    existing = db["threads"].find_one(
        {"participants.user_id": {"$all": participant_ids}, "participants": {"$size": len(participant_ids)}}
    )
    if existing:
        return {
            "thread_id": existing["thread_id"],
            "participants": existing["participants"],
            "created_at": _thread_ts(existing, "created_at"),
            "message": "Thread already exists",
        }

    participants = [{"user_id": pid, "name": "", "role": "recruiter" if str(pid).startswith("R") else "member"} for pid in participant_ids]
    now = _now()
    last_read = {pid: now for pid in participant_ids}
    thread_id = "T" + uuid.uuid4().hex[:6].upper()
    doc = {
        "thread_id": thread_id,
        "participants": participants,
        "created_at": now,
        "last_message_at": now,
        "message_count": 0,
        "last_read": last_read,
    }
    db["threads"].insert_one(doc)
    return {
        "thread_id": thread_id,
        "participants": participants,
        "created_at": now.isoformat(),
        "message": "Thread created successfully",
    }


@threads_router.post("/get")
def get_thread(body: dict = Body(default_factory=dict)):
    thread_id = body.get("thread_id")
    if not thread_id:
        raise HTTPException(status_code=400, detail={"success": False, "message": "thread_id is required"})
    t = get_db()["threads"].find_one({"thread_id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Thread not found"})
    return {
        "thread_id": t["thread_id"],
        "participants": t["participants"],
        "created_at": _thread_ts(t, "created_at"),
        "last_message_at": _thread_ts(t, "last_message_at"),
        "message_count": t.get("message_count", 0),
    }


@threads_router.post("/byUser")
def threads_by_user(body: dict = Body(default_factory=dict)):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail={"success": False, "message": "user_id is required"})
    threads = list(get_db()["threads"].find({"participants.user_id": user_id}).sort("last_message_at", -1))
    return {
        "user_id": user_id,
        "total_threads": len(threads),
        "threads": [
            {
                "thread_id": t["thread_id"],
                "participants": t["participants"],
                "created_at": _thread_ts(t, "created_at"),
                "last_message_at": _thread_ts(t, "last_message_at"),
                "message_count": t.get("message_count", 0),
                "unread": _is_unread(t, user_id),
            }
            for t in threads
        ],
    }


@threads_router.post("/mark-read")
def mark_read(body: dict = Body(default_factory=dict)):
    thread_id = body.get("thread_id")
    user_id = body.get("user_id")
    if not thread_id or not user_id:
        raise HTTPException(status_code=400, detail={"success": False, "message": "thread_id and user_id are required"})
    get_db()["threads"].update_one({"thread_id": thread_id}, {"$set": {f"last_read.{user_id}": _now()}})
    return {"success": True}


@threads_router.post("/unread-count")
def unread_count(body: dict = Body(default_factory=dict)):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail={"success": False, "message": "user_id is required"})
    threads = list(get_db()["threads"].find({"participants.user_id": user_id}))
    count = sum(1 for t in threads if _is_unread(t, user_id))
    return {"user_id": user_id, "unread_count": count}


def _fmt_message(m: dict) -> dict:
    return {
        "message_id": m["message_id"],
        "sender_id": m["sender_id"],
        "sender_name": m.get("sender_name", ""),
        "message_text": m["message_text"],
        "timestamp": m["timestamp"].isoformat() if hasattr(m["timestamp"], "isoformat") else str(m["timestamp"]),
        "status": m.get("status", "sent"),
    }


@messages_router.post("/send")
def send_message(body: dict = Body(default_factory=dict)):
    thread_id = body.get("thread_id")
    sender_id = body.get("sender_id")
    sender_name = body.get("sender_name") or ""
    message_text = body.get("message_text")
    idempotency_key = body.get("idempotency_key")

    if not thread_id or not sender_id or not message_text:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "message": "thread_id, sender_id, and message_text are required"},
        )

    db = get_db()
    if idempotency_key:
        existing = db["messages"].find_one({"idempotency_key": idempotency_key})
        if existing:
            return {
                **_fmt_message(existing),
                "thread_id": existing["thread_id"],
                "message": "Message already sent (idempotent)",
            }

    thread = db["threads"].find_one({"thread_id": thread_id})
    if not thread:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Thread not found"})
    if not any(p.get("user_id") == sender_id for p in thread.get("participants", [])):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Sender is not a participant in this thread"})

    message_id = "MSG" + uuid.uuid4().hex[:6].upper()
    ts = _now()
    idem = idempotency_key or str(uuid.uuid4())
    doc = {
        "message_id": message_id,
        "thread_id": thread_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "message_text": message_text,
        "timestamp": ts,
        "status": "sent",
        "idempotency_key": idem,
    }
    try:
        db["messages"].insert_one(doc)
    except DuplicateKeyError:
        existing = db["messages"].find_one({"idempotency_key": idempotency_key})
        if existing:
            return {**_fmt_message(existing), "thread_id": existing["thread_id"], "message": "Message already sent (idempotent)"}
        raise

    db["threads"].update_one(
        {"thread_id": thread_id},
        {
            "$set": {"last_message_at": ts, f"last_read.{sender_id}": ts},
            "$inc": {"message_count": 1},
        },
    )

    publish_event(
        "message.sent",
        sender_id,
        "thread",
        thread_id,
        {
            "message_id": message_id,
            "thread_id": thread_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "message_text": message_text,
            "timestamp": ts.isoformat(),
        },
    )

    return {
        "message_id": message_id,
        "thread_id": thread_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "message_text": message_text,
        "timestamp": ts.isoformat(),
        "status": "sent",
        "message": "Message sent successfully",
    }


@messages_router.post("/list")
def list_messages(body: dict = Body(default_factory=dict)):
    thread_id = body.get("thread_id")
    if not thread_id:
        raise HTTPException(status_code=400, detail={"success": False, "message": "thread_id is required"})
    db = get_db()
    if not db["threads"].find_one({"thread_id": thread_id}):
        raise HTTPException(status_code=404, detail={"success": False, "message": "Thread not found"})
    messages = list(db["messages"].find({"thread_id": thread_id}).sort("timestamp", 1))
    if not messages:
        return {"thread_id": thread_id, "total_messages": 0, "messages": [], "message": "No messages in thread"}
    return {
        "thread_id": thread_id,
        "total_messages": len(messages),
        "messages": [_fmt_message(m) for m in messages],
    }

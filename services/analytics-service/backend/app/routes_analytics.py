import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pymongo.errors import DuplicateKeyError

from app.event_bus import subscribe, unsubscribe
from app.mongo_db import get_db

router = APIRouter()


@router.post("/events/ingest")
async def ingest(event: dict = Body(default_factory=dict)):
    if not event.get("event_type"):
        return {"error": "event_type is required"}
    db = get_db()
    doc = {**event, "_topic": event.get("event_type"), "_ingested_at": datetime.now(timezone.utc)}
    try:
        await asyncio.to_thread(lambda: db["events"].insert_one(doc))
    except DuplicateKeyError:
        return JSONResponse(status_code=409, content={"success": False, "error": "Duplicate event"})
    return JSONResponse(status_code=201, content={"success": True})


@router.get("/analytics/jobs/top")
async def jobs_top(month: str | None = Query(None), limit: int = Query(10)):
    db = get_db()
    lim = min(limit, 50)
    match_stage: dict[str, Any] = {"$match": {"event_type": "application.submitted"}}
    if month:
        match_stage["$match"]["timestamp"] = {"$gte": f"{month}-01", "$lt": f"{month}-32"}
    pipeline = [
        match_stage,
        {"$group": {"_id": {"job_id": "$payload.job_id", "month": {"$substr": ["$timestamp", 0, 7]}}, "applications": {"$sum": 1}}},
        {"$sort": {"applications": -1}},
        {"$limit": lim},
        {"$project": {"job_id": "$_id.job_id", "month": "$_id.month", "applications": 1, "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"jobs": rows}


@router.get("/analytics/jobs/low-traction")
async def low_traction(limit: int = Query(5)):
    db = get_db()
    lim = min(limit, 20)
    pipeline = [
        {"$match": {"event_type": "application.submitted"}},
        {"$group": {"_id": "$payload.job_id", "count": {"$sum": 1}}},
        {"$sort": {"count": 1}},
        {"$limit": lim},
        {"$project": {"job_id": "$_id", "applications": "$count", "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"jobs": rows}


@router.get("/analytics/jobs/clicks")
async def job_clicks(job_id: str | None = Query(None)):
    db = get_db()
    match: dict[str, Any] = {"event_type": "job.viewed"}
    if job_id:
        match["payload.job_id"] = job_id
    pipeline = [
        {"$match": match},
        {"$group": {"_id": {"job_id": "$payload.job_id", "date": {"$substr": ["$timestamp", 0, 10]}}, "clicks": {"$sum": 1}}},
        {"$sort": {"_id.date": 1}},
        {"$project": {"job_id": "$_id.job_id", "date": "$_id.date", "clicks": 1, "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"clicks": rows}


@router.get("/analytics/jobs/saves")
async def job_saves(job_id: str | None = Query(None), granularity: str = Query("day")):
    db = get_db()
    match: dict[str, Any] = {"event_type": "job.saved"}
    if job_id:
        match["payload.job_id"] = job_id
    date_expr = {"$substr": ["$timestamp", 0, 7]} if granularity == "week" else {"$substr": ["$timestamp", 0, 10]}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": date_expr, "saves": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$project": {"period": "$_id", "saves": 1, "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"saves": rows, "granularity": granularity}


@router.get("/analytics/jobs/applications-by-city")
async def apps_by_city(job_id: str = Query(...)):
    db = get_db()
    pipeline = [
        {"$match": {"event_type": "application.submitted", "payload.job_id": job_id}},
        {
            "$lookup": {
                "from": "events",
                "let": {"jid": "$payload.job_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [{"$eq": ["$event_type", "job.created"]}, {"$eq": ["$payload.job_id", "$$jid"]}]}}},
                    {"$limit": 1},
                ],
                "as": "job_info",
            }
        },
        {
            "$addFields": {
                "city": {"$ifNull": [{"$arrayElemAt": ["$job_info.payload.location", 0]}, "Unknown"]},
                "month": {"$substr": ["$timestamp", 0, 7]},
            }
        },
        {"$group": {"_id": {"city": "$city", "month": "$month"}, "applications": {"$sum": 1}}},
        {"$sort": {"_id.month": 1, "applications": -1}},
        {"$project": {"city": "$_id.city", "month": "$_id.month", "applications": 1, "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"job_id": job_id, "applications_by_city": rows}


@router.get("/analytics/funnel")
async def funnel(job_id: str | None = Query(None)):
    db = get_db()
    jf: dict[str, Any] = {}
    if job_id:
        jf = {"payload.job_id": job_id}

    async def cnt(spec: dict):
        return await asyncio.to_thread(db["events"].count_documents, {**spec, **jf})

    views, saves, submits, reviewed, accepted, rejected = await asyncio.gather(
        cnt({"event_type": "job.viewed"}),
        cnt({"event_type": "job.saved"}),
        cnt({"event_type": "application.submitted"}),
        cnt({"event_type": "application.status_updated", "payload.status": "reviewed"}),
        cnt({"event_type": "application.status_updated", "payload.status": "accepted"}),
        cnt({"event_type": "application.status_updated", "payload.status": "rejected"}),
    )
    stages = [
        {"stage": "view", "count": views},
        {"stage": "save", "count": saves},
        {"stage": "submit", "count": submits},
        {"stage": "reviewed", "count": reviewed},
        {"stage": "accepted", "count": accepted},
        {"stage": "rejected", "count": rejected},
    ]
    return {"funnel": stages, "job_id": job_id}


@router.get("/analytics/geo")
async def geo():
    db = get_db()
    pipeline = [
        {"$match": {"event_type": "job.created"}},
        {"$group": {"_id": "$payload.location", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
        {"$project": {"location": "$_id", "count": 1, "_id": 0}},
    ]
    rows = await asyncio.to_thread(lambda: list(db["events"].aggregate(pipeline)))
    return {"locations": rows}


@router.get("/analytics/member/dashboard")
async def member_dashboard(member_id: str = Query(...)):
    db = get_db()
    thirty = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    def run_views():
        pipeline = [
            {"$match": {"event_type": "profile.viewed", "payload.profile_id": member_id, "timestamp": {"$gte": thirty}}},
            {"$group": {"_id": {"$substr": ["$timestamp", 0, 10]}, "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
            {"$project": {"date": "$_id", "views": "$count", "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    def run_app_status():
        pipeline = [
            {"$match": {"event_type": "application.submitted", "payload.member_id": member_id}},
            {"$group": {"_id": {"$ifNull": ["$payload.status", "submitted"]}, "count": {"$sum": 1}}},
            {"$project": {"status": "$_id", "count": 1, "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    views_raw, app_status_rows, connection_count = await asyncio.gather(
        asyncio.to_thread(run_views),
        asyncio.to_thread(run_app_status),
        asyncio.to_thread(
            lambda: db["events"].count_documents(
                {
                    "event_type": "connection.accepted",
                    "$or": [{"payload.requester_id": member_id}, {"payload.receiver_id": member_id}],
                }
            )
        ),
    )
    return {
        "profile_views": views_raw,
        "application_status": app_status_rows,
        "connection_count": connection_count,
    }


@router.get("/analytics/recruiter/dashboard")
async def recruiter_dashboard(recruiter_id: str = Query(...)):
    db = get_db()
    job_events = list(
        db["events"].find({"event_type": "job.created", "payload.recruiter_id": recruiter_id}, {"payload.job_id": 1, "_id": 0})
    )
    recruiter_job_ids = list({e["payload"]["job_id"] for e in job_events if e.get("payload", {}).get("job_id")})
    jin = {"$in": recruiter_job_ids} if recruiter_job_ids else {"$in": []}

    def run_top_jobs():
        pipeline = [
            {"$match": {"event_type": "application.submitted", "payload.job_id": jin}},
            {"$group": {"_id": {"job_id": "$payload.job_id", "month": {"$substr": ["$timestamp", 0, 7]}}, "applications": {"$sum": 1}}},
            {"$sort": {"applications": -1}},
            {"$limit": 10},
            {"$project": {"job_id": "$_id.job_id", "month": "$_id.month", "applications": 1, "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    def run_low_traction():
        pipeline = [
            {"$match": {"event_type": "application.submitted", "payload.job_id": jin}},
            {"$group": {"_id": "$payload.job_id", "count": {"$sum": 1}}},
            {"$sort": {"count": 1}},
            {"$limit": 5},
            {"$project": {"job_id": "$_id", "applications": "$count", "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    def run_job_views():
        pipeline = [
            {"$match": {"event_type": "job.viewed", "payload.job_id": jin}},
            {"$group": {"_id": {"date": {"$substr": ["$timestamp", 0, 10]}, "job_id": "$payload.job_id"}, "views": {"$sum": 1}}},
            {"$sort": {"_id.date": 1}},
            {"$project": {"date": "$_id.date", "job_id": "$_id.job_id", "views": 1, "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    def run_job_saves():
        pipeline = [
            {"$match": {"event_type": "job.saved", "payload.job_id": jin}},
            {"$group": {"_id": {"$substr": ["$timestamp", 0, 10]}, "saves": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
            {"$project": {"date": "$_id", "saves": 1, "_id": 0}},
        ]
        return list(db["events"].aggregate(pipeline))

    def run_funnel():
        flt = {"payload.job_id": jin}
        return [
            {"stage": "view", "count": db["events"].count_documents({"event_type": "job.viewed", **flt})},
            {"stage": "save", "count": db["events"].count_documents({"event_type": "job.saved", **flt})},
            {"stage": "submit", "count": db["events"].count_documents({"event_type": "application.submitted", **flt})},
            {
                "stage": "reviewed",
                "count": db["events"].count_documents(
                    {"event_type": "application.status_updated", "payload.status": "reviewed", **flt}
                ),
            },
            {
                "stage": "accepted",
                "count": db["events"].count_documents(
                    {"event_type": "application.status_updated", "payload.status": "accepted", **flt}
                ),
            },
        ]

    top_jobs_rows, low_tr_rows, jv, js, funnel_rows = await asyncio.gather(
        asyncio.to_thread(run_top_jobs),
        asyncio.to_thread(run_low_traction),
        asyncio.to_thread(run_job_views),
        asyncio.to_thread(run_job_saves),
        asyncio.to_thread(run_funnel),
    )
    return {
        "top_jobs": top_jobs_rows,
        "low_traction": low_tr_rows,
        "job_views": jv,
        "job_saves": js,
        "funnel": funnel_rows,
    }


@router.get("/recruiter/live-feed/{recruiter_id}")
async def live_feed(recruiter_id: str):
    async def gen():
        q = subscribe()
        try:
            while True:
                try:
                    line = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"event: update\ndata: {line}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            unsubscribe(q)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)


@router.get("/analytics/events")
async def list_events(event_type: str | None = Query(None), limit: int = Query(50), skip: int = Query(0)):
    db = get_db()
    lim = min(limit, 500)
    filt: dict[str, Any] = {}
    if event_type:
        filt["event_type"] = event_type

    def run():
        cur = (
            db["events"]
            .find(filt, {"_id": 0})
            .sort("_ingested_at", -1)
            .skip(skip)
            .limit(lim)
        )
        return list(cur), db["events"].count_documents(filt)

    events, total = await asyncio.to_thread(run)
    return {"events": events, "total": total, "limit": lim, "skip": skip}
from fastapi import APIRouter
from db import events_collection


router = APIRouter()



@router.post("/events/ingest")
def ingest_event(event: dict):
    required_fields = [
        "event_type",
        "trace_id",
        "timestamp",
        "actor_id",
        "entity",
        "payload",
        "idempotency_key"
    ]

    for field in required_fields:
        if field not in event:
            return {"error": f"Missing field: {field}"}

    if not event["idempotency_key"]:
        return {"error": "idempotency_key cannot be empty"}
    existing_event = events_collection.find_one({
        "idempotency_key": event["idempotency_key"]
    })

    if existing_event:
        return {"message": "Duplicate event ignored"}

    events_collection.insert_one(event)
    return {"message": "Event saved successfully"}


@router.get("/analytics/jobs/top")
def top_jobs():
    pipeline = [
        {
            "$match": {
                "event_type": "application.submitted",
                "payload.job_id": {"$exists": True, "$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$payload.job_id",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "job_id": item["_id"],
            "applications": item["count"]
        }
        for item in result
    ]


@router.get("/analytics/jobs/clicks")
def clicks_per_job():
    pipeline = [
        {
            "$match": {
                "event_type": "job.viewed",
                "payload.job_id": {"$exists": True, "$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$payload.job_id",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "job_id": item["_id"],
            "clicks": item["count"]
        }
        for item in result
    ]


@router.get("/analytics/jobs/saved-trend")
def saved_jobs_trend():
    pipeline = [
        {"$match": {"event_type": "job.saved"}},
        {
            "$group": {
                "_id": {"$substr": ["$timestamp", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "date": item["_id"],
            "saved_count": item["count"]
        }
        for item in result
    ]


@router.get("/analytics/member/profile-views")
def profile_views(member_id: str):
    pipeline = [
        {
            "$match": {
                "event_type": "profile.viewed",
                "entity.entity_id": member_id
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$timestamp", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "date": item["_id"],
            "views": item["count"]
        }
        for item in result
    ]


@router.get("/analytics/member/status-breakdown")
def application_status_breakdown():
    pipeline = [
        {"$match": {"event_type": "application.statusUpdated"}},
        {
            "$group": {
                "_id": "$payload.status",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "status": item["_id"],
            "count": item["count"]
        }
        for item in result
    ]

@router.get("/analytics/jobs/low-traction")
def low_traction_jobs():
    pipeline = [
        {
            "$match": {
                "event_type": "application.submitted",
                "payload.job_id": {"$exists": True, "$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$payload.job_id",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": 1}},
        {"$limit": 5}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "job_id": item["_id"],
            "applications": item["count"]
        }
        for item in result
    ]

@router.get("/analytics/geo")
def geo_analytics():
    pipeline = [
        {
            "$match": {
                "event_type": "application.submitted",
                "payload.city": {"$exists": True}
            }
        },
        {
            "$group": {
                "_id": "$payload.city",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]

    result = list(events_collection.aggregate(pipeline))

    return [
        {
            "city": item["_id"],
            "applications": item["count"]
        }
        for item in result
    ]

@router.get("/analytics/funnel")
def funnel_analytics():
    viewed = events_collection.count_documents({"event_type": "job.viewed"})
    saved = events_collection.count_documents({"event_type": "job.saved"})
    submitted = events_collection.count_documents({"event_type": "application.submitted"})

    return [
        {"stage": "Viewed", "count": viewed},
        {"stage": "Saved", "count": saved},
        {"stage": "Submitted", "count": submitted}
    ]
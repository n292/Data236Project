from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import ASCENDING

from app.api.routes_messaging import messages_router, threads_router
from app.kafka_prod import connect_producer, disconnect_producer
from app.mongo_db import get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    db["messages"].create_index([("thread_id", ASCENDING), ("timestamp", ASCENDING)])
    db["messages"].create_index("idempotency_key", unique=True, sparse=True)
    db["threads"].create_index([("participants.user_id", ASCENDING)])
    db["threads"].create_index([("last_message_at", ASCENDING)])
    connect_producer()
    yield
    disconnect_producer()


app = FastAPI(title="messaging-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(threads_router, prefix="/api/messaging/threads")
app.include_router(messages_router, prefix="/api/messaging/messages")


@app.get("/api/messaging/health")
def health():
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {"status": "ok", "service": "messaging-service", "timestamp": ts}

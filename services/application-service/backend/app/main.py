from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.applications import router as applications_router
from app.kafka_app import disconnect_producer, ensure_idempotency_table, start_consumer_background, stop_consumer


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_idempotency_table()
    start_consumer_background()
    yield
    stop_consumer()
    disconnect_producer()


app = FastAPI(title="application-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_uploads = Path(__file__).resolve().parent.parent / "uploads"
_uploads.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads)), name="uploads")


@app.get("/health")
def health():
    return {"message": "Application service is running"}


app.include_router(applications_router, prefix="/applications")

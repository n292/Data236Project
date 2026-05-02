import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, JSONResponse

from app.api.routes.jobs import router as jobs_router
from app.cache import redis_cache as cache
from app.core.exceptions import JobServiceError
from app.core.config import settings
from app.kafka import producer as kafka_producer
from app.kafka.consumers import start_background_consumers

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

_consumer_stop = threading.Event()
_consumer_threads: list[threading.Thread] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _consumer_threads
    _consumer_stop.clear()
    _consumer_threads = start_background_consumers(_consumer_stop)
    yield
    _consumer_stop.set()
    for t in _consumer_threads:
        t.join(timeout=5)
    kafka_producer.disconnect_producer()
    cache.disconnect_cache()


app = FastAPI(title="job-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(JobServiceError)
async def job_service_error_handler(_: Request, exc: JobServiceError):
    if exc.code == "VALIDATION":
        return JSONResponse(
            status_code=400,
            content={"error": "validation_error", "details": exc.details or [str(exc)]},
        )
    if exc.code == "NOT_FOUND":
        return JSONResponse(status_code=404, content={"error": "not_found"})
    if exc.code == "FORBIDDEN":
        return JSONResponse(status_code=403, content={"error": "forbidden"})
    if exc.code == "DUPLICATE_JOB":
        return JSONResponse(status_code=409, content={"error": "duplicate"})
    if exc.code == "ALREADY_CLOSED":
        return JSONResponse(status_code=409, content={"error": "already_closed"})
    log.exception("internal job error")
    return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.get("/health")
def health():
    return {"status": "ok", "service": "job-service"}


_docs_root = Path(__file__).resolve().parent.parent.parent / "docs"


@app.get("/api/docs/openapi.json")
def openapi_json():
    path = _docs_root / "openapi.json"
    if not path.is_file():
        return JSONResponse(status_code=404, content={"error": "openapi not found"})
    return FileResponse(path)


@app.get("/api/docs/")
async def swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/api/docs/openapi.json",
        title="Job Service API",
    )


app.include_router(jobs_router, prefix="/api/v1/jobs")

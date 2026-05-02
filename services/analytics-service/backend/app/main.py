import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.event_bus import set_main_loop
from app.kafka_consumer import start_consumer_background, stop_consumer
from app.routes_analytics import router as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_main_loop(asyncio.get_running_loop())
    start_consumer_background()
    yield
    stop_consumer()


app = FastAPI(title="analytics-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service"}


app.include_router(analytics_router)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.shortlist_routes import router as shortlist_router
from app.api.career_coach_routes import router as career_coach_router
from app.kafka.consumer import start_consumer


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_consumer()
    yield
    from app.kafka.producer import close as close_producer
    close_producer()


app = FastAPI(title="LinkedIn AI Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}


app.include_router(router)
app.include_router(shortlist_router)
app.include_router(career_coach_router)

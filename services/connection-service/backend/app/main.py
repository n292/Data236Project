from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.connections import router as connections_router
from app.db.session import ensure_connections_table
from app.kafka_prod import connect_producer, disconnect_producer


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_connections_table()
    connect_producer()
    yield
    disconnect_producer()


app = FastAPI(title="connection-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connections_router, prefix="/api/connections")

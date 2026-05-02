from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    port: int = Field(default=5003, alias="PORT")
    db_host: str = Field(default="127.0.0.1", alias="DB_HOST")
    db_port: int = Field(default=3306, alias="DB_PORT")
    db_user: str = Field(default="root", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")
    db_name: str = Field(default="application_db", alias="DB_NAME")

    jwt_secret: str = Field(default="changeme-replace-with-32-char-random-string", alias="JWT_SECRET")
    kafka_broker: str = Field(default="localhost:9092", alias="KAFKA_BROKER")
    kafka_brokers: str = Field(default="", alias="KAFKA_BROKERS")
    kafka_client_id: str = Field(default="application-service", alias="KAFKA_CLIENT_ID")

    job_service_url: str = Field(default="http://localhost:3002/api/v1", alias="JOB_SERVICE_URL")


settings = Settings()


def sqlalchemy_database_uri() -> str:
    return (
        f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    )


def kafka_bootstrap() -> list[str]:
    raw = settings.kafka_brokers.strip() or settings.kafka_broker.strip()
    return [b.strip() for b in raw.split(",") if b.strip()]

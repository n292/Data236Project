from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve service-root `.env` regardless of uvicorn cwd (was missing JWT_SECRET when cwd was `backend/`).
_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    port: int = Field(default=3002, alias="PORT")
    mysql_host: str = Field(default="127.0.0.1", alias="MYSQL_HOST")
    mysql_port: int = Field(default=3306, alias="MYSQL_PORT")
    mysql_user: str = Field(default="root", alias="MYSQL_USER")
    mysql_password: str = Field(default="", alias="MYSQL_PASSWORD")
    mysql_database: str = Field(default="data236", alias="MYSQL_DATABASE")

    jwt_secret: str = Field(default="changeme-replace-with-32-char-random-string", alias="JWT_SECRET")

    kafka_brokers: str = ""
    kafka_client_id: str = "job-service"
    kafka_auto_create_topics: bool = True
    kafka_topic_job_created: str = "job.created"
    kafka_topic_job_closed: str = "job.closed"
    kafka_topic_job_viewed: str = "job.viewed"
    kafka_topic_job_saved: str = "job.saved"
    kafka_topic_application_submitted: str = "application.submitted"
    kafka_group_application_submitted: str = "job-service-application-submitted"
    kafka_group_job_viewed: str = "job-service-job-viewed"
    kafka_idempotency_namespace: str = "a0000001-0000-5000-8000-000000000001"

    redis_url: str = ""
    redis_host: str = ""
    redis_port: int = 6379
    redis_ttl_search_seconds: int = 60
    redis_ttl_get_seconds: int = 10


settings = Settings()


def sqlalchemy_database_uri() -> str:
    return (
        f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}"
        f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_database}"
    )

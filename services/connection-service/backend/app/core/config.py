from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore")

    port: int = Field(default=3005, alias="PORT")
    mysql_host: str = Field(default="localhost", alias="MYSQL_HOST")
    mysql_port: int = Field(default=3306, alias="MYSQL_PORT")
    mysql_user: str = Field(default="root", alias="MYSQL_USER")
    mysql_password: str = Field(default="", alias="MYSQL_PASSWORD")
    mysql_database: str = Field(default="linkedin_connections", alias="MYSQL_DATABASE")

    kafka_brokers: str = Field(default="localhost:9092", alias="KAFKA_BROKERS")
    kafka_client_id: str = Field(default="connection-service", alias="KAFKA_CLIENT_ID")
    profile_service_url: str = Field(default="http://profile-service:8000", alias="PROFILE_SERVICE_URL")


settings = Settings()


def sqlalchemy_uri() -> str:
    return (
        f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}"
        f"@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_database}"
    )


def kafka_bootstrap() -> list[str]:
    return [b.strip() for b in settings.kafka_brokers.split(",") if b.strip()]

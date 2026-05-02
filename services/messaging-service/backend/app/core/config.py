from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore")

    port: int = Field(default=3004, alias="PORT")
    mongodb_uri: str = Field(default="mongodb://localhost:27017/linkedin_messaging", alias="MONGODB_URI")
    kafka_brokers: str = Field(default="localhost:9092", alias="KAFKA_BROKERS")
    kafka_client_id: str = Field(default="messaging-service", alias="KAFKA_CLIENT_ID")


settings = Settings()


def kafka_bootstrap() -> list[str]:
    return [b.strip() for b in settings.kafka_brokers.split(",") if b.strip()]

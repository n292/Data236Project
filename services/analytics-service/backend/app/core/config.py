from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore")

    port: int = Field(default=4000, alias="PORT")
    mongodb_uri: str = Field(default="mongodb://localhost:27017/linkedin_analytics", alias="MONGODB_URI")
    kafka_brokers: str = Field(default="localhost:9092", alias="KAFKA_BROKERS")


settings = Settings()


def kafka_bootstrap() -> list[str]:
    return [b.strip() for b in settings.kafka_brokers.split(",") if b.strip()]

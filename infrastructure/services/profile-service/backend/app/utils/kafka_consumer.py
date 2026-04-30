import json
import logging
import threading
from kafka import KafkaConsumer
from app.core.config import settings

logger = logging.getLogger(__name__)

_consumer_thread: threading.Thread | None = None


def _run_consumer():
    if not settings.kafka_enabled:
        return
    try:
        consumer = KafkaConsumer(
            settings.kafka_profile_viewed_topic,
            bootstrap_servers=settings.kafka_bootstrap_server_list,
            group_id="profile-service-views",
            auto_offset_reset="latest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        logger.info("Profile-views Kafka consumer started")
        for msg in consumer:
            try:
                event = msg.value
                payload = event.get("payload", {})
                member_id = payload.get("profile_id") or event.get("entity_id")
                if not member_id:
                    continue
                # Import here to avoid circular imports at module load time
                from app.db.session import SessionLocal
                from app.services.member_service import increment_profile_views_daily
                from app.utils.redis_cache import cache_delete
                db = SessionLocal()
                try:
                    increment_profile_views_daily(db, member_id)
                    cache_delete(f"members:get:{member_id}")
                finally:
                    db.close()
            except Exception as e:
                logger.error("Error processing profile.viewed event: %s", e)
    except Exception as e:
        logger.error("Kafka consumer failed to start: %s", e)


def start_kafka_consumer():
    global _consumer_thread
    if not settings.kafka_enabled:
        return
    _consumer_thread = threading.Thread(target=_run_consumer, daemon=True, name="profile-views-consumer")
    _consumer_thread.start()
    logger.info("Profile-views consumer thread started")

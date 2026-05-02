"""Lightweight idempotent fixes for existing databases (SQLAlchemy create_all does not ALTER tables)."""
import logging
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def ensure_members_banner_column(engine: Engine) -> None:
    with engine.begin() as conn:
        tbl = conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members'"
            )
        ).scalar()
        if not tbl:
            return
        col = conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'members' "
                "AND COLUMN_NAME = 'banner_image_url'"
            )
        ).scalar()
        if col:
            return
        conn.execute(text("ALTER TABLE members ADD COLUMN banner_image_url TEXT NULL"))
        logger.info("Applied migration: members.banner_image_url")

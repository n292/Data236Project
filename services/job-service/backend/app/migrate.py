"""
Run SQL migrations from ../../database (numbered *.sql). Intended for container startup.
"""

import re
import sys
from pathlib import Path

import pymysql
from pymysql.constants import CLIENT

from app.core.config import settings

SKIPPABLE_ERRNO = frozenset({1060, 1061, 1022, 1062})


def _sql_dir() -> Path:
    """Docker: /app/app/migrate.py → here.parent=/app → /app/database. Local: backend/app → job-service/database."""
    here = Path(__file__).resolve().parent
    candidates = (here.parent / "database", here.parent.parent / "database")
    for p in candidates:
        if p.is_dir() and any(p.glob("[0-9][0-9][0-9]_*.sql")):
            return p
    raise FileNotFoundError(f"No numbered migrations in database/ near {here} (tried {list(candidates)})")


def main() -> None:
    host = settings.mysql_host
    port = settings.mysql_port
    user = settings.mysql_user
    password = settings.mysql_password
    database = settings.mysql_database

    # Container: /app/app/migrate.py → SQL lives in /app/database
    sql_dir = _sql_dir()

    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{database}`")
        conn.commit()
    finally:
        conn.close()

    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
        client_flag=CLIENT.MULTI_STATEMENTS,
    )
    files = sorted(p for p in sql_dir.glob("*.sql") if re.match(r"^\d{3}_.+\.sql$", p.name, re.I))
    try:
        with conn.cursor() as cur:
            for f in files:
                sql = f.read_text(encoding="utf-8")
                try:
                    cur.execute(sql)
                    conn.commit()
                    print(f"Migration applied: {f.name}", file=sys.stderr)
                except pymysql.err.MySQLError as e:
                    errno = getattr(e, "args", [None])[0]
                    if errno in SKIPPABLE_ERRNO:
                        conn.rollback()
                        print(
                            f"Migration skipped (already applied): {f.name} — {e}",
                            file=sys.stderr,
                        )
                    else:
                        conn.rollback()
                        raise
    finally:
        conn.close()
    print(f"Migrations finished on database {database}", file=sys.stderr)


if __name__ == "__main__":
    main()

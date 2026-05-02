import sys
from pathlib import Path

import pymysql
from pymysql.constants import CLIENT

from app.core.config import settings


def _schema_path() -> Path:
    """Docker: /app/app → here.parent/database. Local: backend/app → parent.parent/database."""
    here = Path(__file__).resolve().parent
    for base in (here.parent / "database", here.parent.parent / "database"):
        p = base / "schema.sql"
        if p.is_file():
            return p
    raise FileNotFoundError(f"database/schema.sql not found near {here}")


def main() -> None:
    schema_path = _schema_path()
    sql = schema_path.read_text(encoding="utf-8")
    conn = pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        charset="utf8mb4",
        client_flag=CLIENT.MULTI_STATEMENTS,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"Schema applied from {schema_path}", file=sys.stderr)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

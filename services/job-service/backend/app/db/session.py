from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import sqlalchemy_database_uri

engine = create_engine(sqlalchemy_database_uri(), pool_pre_ping=True, pool_size=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

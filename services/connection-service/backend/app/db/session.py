from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import sqlalchemy_uri

engine = create_engine(sqlalchemy_uri(), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_connections_table() -> None:
    ddl = """
    CREATE TABLE IF NOT EXISTS connections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      connection_id VARCHAR(50) UNIQUE NOT NULL,
      requester_id VARCHAR(50) NOT NULL,
      receiver_id VARCHAR(50) NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_connection (requester_id, receiver_id),
      INDEX idx_requester (requester_id),
      INDEX idx_receiver (receiver_id),
      INDEX idx_status (status)
    )
    """
    with engine.connect() as conn:
        conn.execute(text(ddl))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

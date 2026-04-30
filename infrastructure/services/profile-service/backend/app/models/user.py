from sqlalchemy import Column, DateTime, Enum, String, func
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(128), nullable=True, unique=True, index=True)
    member_id = Column(String(64), nullable=True, index=True)
    role = Column(Enum("member", "recruiter"), nullable=False, server_default="member")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

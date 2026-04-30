import motor.motor_asyncio
import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/linkedin_ai")
_client = None
_db = None


def get_db():
    global _client, _db
    if _db is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
        _db = _client.get_default_database()
    return _db

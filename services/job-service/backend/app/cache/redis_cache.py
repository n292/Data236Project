import hashlib
import json
import threading

import redis

from app.core.config import settings

SEARCH_KEY_SET = "cache:jobs:search:keys"
_lock = threading.Lock()
_client: redis.Redis | None = None


def _redis_enabled() -> bool:
    return bool(settings.redis_url or settings.redis_host)


def _redis_url() -> str:
    if settings.redis_url:
        return settings.redis_url
    return f"redis://{settings.redis_host or '127.0.0.1'}:{settings.redis_port}"


def _get_client() -> redis.Redis | None:
    global _client
    if not _redis_enabled():
        return None
    with _lock:
        if _client is None:
            try:
                _client = redis.Redis.from_url(_redis_url(), decode_responses=True)
                _client.ping()
            except redis.RedisError:
                _client = None
        return _client


def _ttl_search() -> int:
    n = settings.redis_ttl_search_seconds
    return n if isinstance(n, int) and n > 0 else 60


def _ttl_get() -> int:
    n = settings.redis_ttl_get_seconds
    return n if isinstance(n, int) and n > 0 else 10


def _hash_payload(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def search_key(payload: dict) -> str:
    return f"cache:jobs:search:{_hash_payload(payload)}"


def get_job_key(job_id: str) -> str:
    return f"cache:jobs:get:{job_id}"


def get_search_cache(payload: dict):
    c = _get_client()
    if not c:
        return None
    try:
        raw = c.get(search_key(payload))
        return json.loads(raw) if raw else None
    except (redis.RedisError, json.JSONDecodeError, TypeError):
        return None


def set_search_cache(payload: dict, result: dict) -> bool:
    c = _get_client()
    if not c:
        return False
    key = search_key(payload)
    try:
        c.set(key, json.dumps(result, default=str), ex=_ttl_search())
        c.sadd(SEARCH_KEY_SET, key)
        return True
    except redis.RedisError:
        return False


def get_job_cache(job_id: str):
    c = _get_client()
    if not c:
        return None
    try:
        raw = c.get(get_job_key(job_id))
        return json.loads(raw) if raw else None
    except (redis.RedisError, json.JSONDecodeError, TypeError):
        return None


def set_job_cache(job_id: str, result: dict) -> bool:
    c = _get_client()
    if not c:
        return False
    try:
        c.set(get_job_key(job_id), json.dumps(result, default=str), ex=_ttl_get())
        return True
    except redis.RedisError:
        return False


def invalidate_job_cache(job_id: str) -> None:
    c = _get_client()
    if not c:
        return
    try:
        c.delete(get_job_key(job_id))
    except redis.RedisError:
        pass


def invalidate_all_search_cache() -> None:
    c = _get_client()
    if not c:
        return
    try:
        keys = list(c.smembers(SEARCH_KEY_SET))
        if keys:
            c.delete(*keys)
        c.delete(SEARCH_KEY_SET)
    except redis.RedisError:
        pass


def disconnect_cache() -> None:
    global _client
    with _lock:
        if _client:
            try:
                _client.close()
            except redis.RedisError:
                pass
            _client = None

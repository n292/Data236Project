import asyncio
import json
import threading
from datetime import datetime, timezone

_lock = threading.Lock()
_main_loop: asyncio.AbstractEventLoop | None = None
_subscribers: list[asyncio.Queue] = []


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    with _lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    with _lock:
        if q in _subscribers:
            _subscribers.remove(q)


def broadcast(topic: str, event: dict) -> None:
    loop = _main_loop
    if loop is None:
        return
    payload = json.dumps(
        {"topic": topic, "event": event, "ts": datetime.now(timezone.utc).isoformat()},
        default=str,
    )

    def _emit():
        with _lock:
            subs = list(_subscribers)
        for q in subs:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    loop.call_soon_threadsafe(_emit)

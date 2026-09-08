"""
In-process pub/sub for Library live updates.

The Chrome extension and the web app are different clients. When either
creates, updates, or deletes a document, subscribers for that user get
an SSE event so the open Library can render the change immediately.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from collections import defaultdict
from typing import Any

from app.models.tables import Document
from app.schemas.documents import DocumentResponse

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_subscribers: dict[int, list[tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = defaultdict(list)


def subscribe(user_id: int) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=32)
    loop = asyncio.get_running_loop()
    with _lock:
        _subscribers[user_id].append((loop, queue))
    logger.info("Library subscribed user_id=%s listeners=%s", user_id, len(_subscribers[user_id]))
    return queue


def unsubscribe(user_id: int, queue: asyncio.Queue) -> None:
    with _lock:
        remaining = [
            item for item in _subscribers.get(user_id, []) if item[1] is not queue
        ]
        if remaining:
            _subscribers[user_id] = remaining
        else:
            _subscribers.pop(user_id, None)


def publish_document_event(
    user_id: int,
    event_type: str,
    document: Document | None = None,
    document_id: int | None = None,
) -> None:
    payload: dict[str, Any] = {
        "type": event_type,
        "id": document.id if document is not None else document_id,
        "document": None,
    }
    if document is not None:
        payload["document"] = DocumentResponse.model_validate(document).model_dump(mode="json")

    with _lock:
        targets = list(_subscribers.get(user_id, []))

    if not targets:
        logger.info("No Library listener for user_id=%s event=%s", user_id, event_type)
        return

    logger.info(
      "Pushing %s to %s Library listener(s) user_id=%s",
      event_type,
      len(targets),
      user_id,
    )
    for loop, queue in targets:
        try:
            loop.call_soon_threadsafe(_enqueue, queue, payload)
        except RuntimeError:
            logger.debug("Document event loop is closed")


def _enqueue(queue: asyncio.Queue, payload: dict[str, Any]) -> None:
    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        logger.warning("Dropping document event; subscriber is too slow")

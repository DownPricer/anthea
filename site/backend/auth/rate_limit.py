"""Rate limiting auth (MongoDB)."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Tuple


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_rate_limit_indexes(db) -> None:
    await db.auth_rate_limits.create_index(
        [("action", 1), ("key", 1)],
        unique=True,
    )
    await db.auth_rate_limits.create_index("window_start")


async def check_rate_limit(
    db,
    *,
    action: str,
    key: str,
    limit: int,
    window_seconds: int,
) -> Tuple[bool, int]:
    """
    Retourne (allowed, retry_after_seconds).
    Incrémente le compteur si autorisé.
    """
    if not key:
        return True, 0
    now = _now()
    window = max(1, int(window_seconds))
    max_hits = max(1, int(limit))
    doc = await db.auth_rate_limits.find_one({"action": action, "key": key})
    if not doc:
        await db.auth_rate_limits.update_one(
            {"action": action, "key": key},
            {
                "$set": {
                    "action": action,
                    "key": key,
                    "count": 1,
                    "window_start": now,
                }
            },
            upsert=True,
        )
        return True, 0

    start = doc.get("window_start")
    if isinstance(start, str):
        try:
            start = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except ValueError:
            start = now
    if start is None:
        start = now
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    elapsed = (now - start).total_seconds()
    if elapsed >= window:
        await db.auth_rate_limits.update_one(
            {"_id": doc["_id"]},
            {"$set": {"count": 1, "window_start": now}},
        )
        return True, 0

    count = int(doc.get("count") or 0)
    if count >= max_hits:
        retry = max(1, int(window - elapsed))
        return False, retry

    await db.auth_rate_limits.update_one({"_id": doc["_id"]}, {"$inc": {"count": 1}})
    return True, 0


# Limites par défaut
LIMITS = {
    "register": (5, 3600),
    "login": (10, 900),
    "legacy_login": (10, 900),
    "resend_verification": (3, 900),
    "forgot_password": (5, 3600),
    "legacy_email": (5, 900),
    "public_feed_trending": (60, 60),
    "public_post_get": (120, 60),
}

# Délai minimal entre deux renvois de vérification (secondes)
RESEND_MIN_INTERVAL_SECONDS = 60

"""Tokens d'auth hashés (vérification e-mail, reset, migration)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

TOKEN_TYPES = (
    "email_verification",
    "password_reset",
    "legacy_migration",
    "legacy_email_verify",
)


def generate_raw_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def tokens_equal(raw_token: str, stored_hash: str) -> bool:
    if not raw_token or not stored_hash:
        return False
    return hmac.compare_digest(hash_token(raw_token), stored_hash)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def expires_at_from_minutes(minutes: int) -> datetime:
    return utc_now() + timedelta(minutes=max(1, int(minutes)))


async def ensure_token_indexes(db) -> None:
    await db.auth_tokens.create_index("token_hash", unique=True)
    await db.auth_tokens.create_index([("type", 1), ("user_id", 1)])
    await db.auth_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.auth_tokens.create_index([("type", 1), ("email_normalized", 1)])


async def create_token(
    db,
    *,
    token_type: str,
    user_id: str,
    ttl_minutes: int,
    email_normalized: Optional[str] = None,
    meta: Optional[dict] = None,
    invalidate_previous: bool = True,
) -> str:
    if token_type not in TOKEN_TYPES:
        raise ValueError(f"unknown token type: {token_type}")

    if invalidate_previous:
        await db.auth_tokens.update_many(
            {
                "type": token_type,
                "user_id": user_id,
                "used_at": None,
            },
            {"$set": {"used_at": utc_now().isoformat(), "invalidated": True}},
        )

    raw = generate_raw_token()
    doc: dict[str, Any] = {
        "type": token_type,
        "token_hash": hash_token(raw),
        "user_id": user_id,
        "email_normalized": email_normalized,
        "expires_at": expires_at_from_minutes(ttl_minutes),
        "used_at": None,
        "invalidated": False,
        "created_at": utc_now(),
        "meta": meta or {},
    }
    await db.auth_tokens.insert_one(doc)
    return raw


async def consume_token(
    db,
    *,
    raw_token: str,
    token_type: str,
) -> Optional[dict]:
    """Valide et consomme un token (usage unique). Retourne le document ou None."""
    if not raw_token or not str(raw_token).strip():
        return None
    token_hash = hash_token(str(raw_token).strip())
    doc = await db.auth_tokens.find_one({"token_hash": token_hash, "type": token_type})
    if not doc:
        return None
    if doc.get("used_at") or doc.get("invalidated"):
        return None
    exp = doc.get("expires_at")
    if isinstance(exp, str):
        try:
            exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except ValueError:
            return None
    if exp is None:
        return None
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < utc_now():
        return None

    result = await db.auth_tokens.update_one(
        {"_id": doc["_id"], "used_at": None, "invalidated": {"$ne": True}},
        {"$set": {"used_at": utc_now().isoformat()}},
    )
    if result.modified_count != 1:
        return None
    doc["used_at"] = utc_now().isoformat()
    return doc


async def peek_token(
    db,
    *,
    raw_token: str,
    token_type: str,
) -> Optional[dict]:
    """Lit un token sans le consommer (diagnostic)."""
    if not raw_token or not str(raw_token).strip():
        return None
    token_hash = hash_token(str(raw_token).strip())
    return await db.auth_tokens.find_one({"token_hash": token_hash, "type": token_type})


async def find_active_token_reason(
    db,
    *,
    raw_token: str,
    token_type: str,
) -> str:
    """Retourne 'ok' | 'missing' | 'used' | 'expired' | 'invalid'."""
    doc = await peek_token(db, raw_token=raw_token, token_type=token_type)
    if not doc:
        return "missing"
    if doc.get("used_at") or doc.get("invalidated"):
        return "used"
    exp = doc.get("expires_at")
    if isinstance(exp, str):
        try:
            exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except ValueError:
            return "invalid"
    if exp is None:
        return "invalid"
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < utc_now():
        return "expired"
    return "ok"

"""Logique métier auth (inscription, login, vérification, legacy, reset)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from bson import ObjectId
from fastapi import HTTPException, Request, Response

from auth.email_norm import is_valid_email, mask_email_for_logs, normalize_email
from auth.mail import (
    email_verification_ttl_minutes,
    password_reset_ttl_minutes,
    send_password_reset_email,
    send_verification_email,
)
from auth.rate_limit import LIMITS, RESEND_MIN_INTERVAL_SECONDS, check_rate_limit
from auth.tokens import create_token, consume_token, find_active_token_reason

logger = logging.getLogger(__name__)

MIN_PASSWORD_LEN = 6

GENERIC_LOGIN_ERROR = "Adresse e-mail ou mot de passe incorrect."
GENERIC_FORGOT_MSG = "Si un compte correspond à cette adresse, un e-mail a été envoyé."
GENERIC_RESEND_MSG = "Si un compte correspond, un e-mail de vérification a été envoyé."


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def account_is_active(user: dict) -> bool:
    status = user.get("account_status") or "active"
    if status == "disabled":
        return False
    if status == "pending_email":
        return False
    if user.get("email_verified_at"):
        return True
    # Legacy sans email : pas actif pour le login email
    if user.get("email_migration_required"):
        return False
    # Compte avec email non vérifié
    if user.get("email_normalized") and not user.get("email_verified_at"):
        return False
    return status == "active"


def needs_email_migration(user: dict) -> bool:
    if user.get("email_migration_required") is True:
        return True
    email_norm = user.get("email_normalized") or normalize_email(user.get("email"))
    return not bool(email_norm)


def validate_password(password: str) -> Optional[str]:
    if not password:
        return "password_required"
    if len(password) < MIN_PASSWORD_LEN:
        return "password_min"
    return None


async def enforce_rate_limit(db, request: Request, action: str, extra_key: str = "") -> None:
    limit, window = LIMITS.get(action, (10, 900))
    ip = client_ip(request)
    keys = [f"ip:{ip}"]
    if extra_key:
        keys.append(f"id:{extra_key}")
    for key in keys:
        allowed, retry = await check_rate_limit(
            db, action=action, key=key, limit=limit, window_seconds=window
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "rate_limited",
                    "message": "Trop de tentatives. Réessayez plus tard.",
                    "retry_after": retry,
                },
            )


async def ensure_auth_indexes(db) -> None:
    from auth.tokens import ensure_token_indexes
    from auth.rate_limit import ensure_rate_limit_indexes

    await db.users.create_index(
        "email_normalized",
        unique=True,
        partialFilterExpression={
            "email_normalized": {"$exists": True, "$gt": ""},
        },
        name="email_normalized_unique_partial",
    )
    await ensure_token_indexes(db)
    await ensure_rate_limit_indexes(db)


async def mark_legacy_users(db) -> int:
    """Marque les comptes sans e-mail comme nécessitant une migration."""
    result = await db.users.update_many(
        {
            "$and": [
                {
                    "$or": [
                        {"email_normalized": {"$exists": False}},
                        {"email_normalized": None},
                        {"email_normalized": ""},
                    ]
                },
                {
                    "$or": [
                        {"email_migration_required": {"$exists": False}},
                        {"email_migration_required": False},
                    ]
                },
            ]
        },
        {
            "$set": {
                "email_migration_required": True,
                "email": None,
                "email_normalized": None,
                "email_verified_at": None,
            }
        },
    )
    return int(result.modified_count or 0)


def bump_token_version(user: dict) -> int:
    return int(user.get("token_version") or 0) + 1


async def register_user(
    db,
    *,
    handle: str,
    email: str,
    password: str,
    password_confirmation: str,
    normalize_handle_fn,
    hash_password_fn,
    request: Request,
) -> dict:
    await enforce_rate_limit(db, request, "register")

    normalized_handle = normalize_handle_fn(handle)
    if not normalized_handle:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_handle",
                "message": "Pseudo invalide (3-30 caractères, lettres, chiffres et _ uniquement)",
            },
        )

    if password != password_confirmation:
        raise HTTPException(
            status_code=400,
            detail={"code": "password_mismatch", "message": "Les mots de passe ne correspondent pas"},
        )
    pwd_err = validate_password(password)
    if pwd_err:
        raise HTTPException(
            status_code=400,
            detail={"code": pwd_err, "message": "Mot de passe invalide (minimum 6 caractères)"},
        )

    if not is_valid_email(email):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_email", "message": "Adresse e-mail invalide"},
        )
    email_norm = normalize_email(email)

    existing_handle = await db.users.find_one(
        {"$or": [{"handle": normalized_handle}, {"username": normalized_handle}]}
    )
    if existing_handle:
        raise HTTPException(
            status_code=400,
            detail={"code": "handle_taken", "message": "Ce pseudo est déjà pris"},
        )

    existing_email = await db.users.find_one({"email_normalized": email_norm})
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail={"code": "email_taken", "message": "Cette adresse e-mail est déjà utilisée"},
        )

    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "username": normalized_handle,
        "handle": normalized_handle,
        "password_hash": hash_password_fn(password),
        "display_name": normalized_handle,
        "email": email_norm,
        "email_normalized": email_norm,
        "email_verified_at": None,
        "email_migration_required": False,
        "account_status": "pending_email",
        "token_version": 0,
        "theme": "default",
        "appearance": "dark",
        "tts_enabled": True,
        "timer_sound": "beep",
        "account_visibility": "private",
        "show_stats": False,
        "show_badges": True,
        "show_recent_activity": False,
        "show_sessions": False,
        "show_posts": False,
        "featured_badges": [],
        "created_at": now,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    raw_token = await create_token(
        db,
        token_type="email_verification",
        user_id=user_id,
        ttl_minutes=email_verification_ttl_minutes(),
        email_normalized=email_norm,
    )
    technical_id = f"verify-{uuid.uuid4().hex[:12]}"
    try:
        send_verification_email(
            to_email=email_norm, token=raw_token, technical_id=technical_id
        )
    except Exception:
        await db.users.delete_one({"_id": result.inserted_id})
        await db.auth_tokens.delete_many({"user_id": user_id, "type": "email_verification"})
        raise HTTPException(
            status_code=503,
            detail={
                "code": "email_send_failed",
                "message": "Impossible d'envoyer l'e-mail de confirmation. Réessayez plus tard.",
            },
        )

    logger.info(
        "auth_register user_id=%s email=%s",
        user_id,
        mask_email_for_logs(email_norm),
    )
    return {
        "ok": True,
        "message": "Un e-mail de confirmation a été envoyé.",
        "email_hint": mask_email_for_logs(email_norm),
        "requires_verification": True,
    }


async def verify_email(
    db,
    *,
    token: str,
    response: Response,
    create_access_token_fn,
    create_refresh_token_fn,
    set_auth_cookies_fn,
    serialize_user_fn,
) -> dict:
    reason = await find_active_token_reason(
        db, raw_token=token, token_type="email_verification"
    )
    if reason == "missing" or reason == "invalid":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )
    if reason == "used":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_used", "message": "Ce lien a déjà été utilisé."},
        )
    if reason == "expired":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_expired", "message": "Ce lien a expiré."},
        )

    doc = await consume_token(db, raw_token=token, token_type="email_verification")
    if not doc:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )

    user = await db.users.find_one({"_id": ObjectId(doc["user_id"])})
    if not user:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )

    now = datetime.now(timezone.utc).isoformat()
    email_norm = doc.get("email_normalized") or user.get("email_normalized")
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "email": email_norm,
                "email_normalized": email_norm,
                "email_verified_at": now,
                "email_migration_required": False,
                "account_status": "active",
            }
        },
    )
    user = await db.users.find_one({"_id": user["_id"]})

    access = create_access_token_fn(
        str(user["_id"]), user["username"], int(user.get("token_version") or 0)
    )
    refresh = create_refresh_token_fn(
        str(user["_id"]), int(user.get("token_version") or 0)
    )
    set_auth_cookies_fn(response, access, refresh)

    serialized = serialize_user_fn(user, include_email=True)
    return {
        "ok": True,
        "message": "Compte créé, adresse e-mail confirmée",
        "user": serialized,
    }


async def resend_verification(
    db,
    *,
    email: str,
    request: Request,
) -> dict:
    email_norm = normalize_email(email) if is_valid_email(email) else None
    await enforce_rate_limit(db, request, "resend_verification", email_norm or "invalid")

    # Réponse toujours générique
    if not email_norm:
        return {"ok": True, "message": GENERIC_RESEND_MSG}

    user = await db.users.find_one({"email_normalized": email_norm})
    if not user:
        return {"ok": True, "message": GENERIC_RESEND_MSG}

    if user.get("email_verified_at") and user.get("account_status") == "active":
        return {"ok": True, "message": GENERIC_RESEND_MSG}

    # Délai minimal entre envois
    last = await db.auth_tokens.find_one(
        {"type": "email_verification", "user_id": str(user["_id"])},
        sort=[("created_at", -1)],
    )
    if last and last.get("created_at"):
        created = last["created_at"]
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except ValueError:
                created = None
        if created is not None:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            delta = (datetime.now(timezone.utc) - created).total_seconds()
            if delta < RESEND_MIN_INTERVAL_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "resend_cooldown",
                        "message": "Veuillez patienter avant de renvoyer l'e-mail.",
                        "retry_after": int(RESEND_MIN_INTERVAL_SECONDS - delta),
                    },
                )

    raw_token = await create_token(
        db,
        token_type="email_verification",
        user_id=str(user["_id"]),
        ttl_minutes=email_verification_ttl_minutes(),
        email_normalized=email_norm,
    )
    technical_id = f"resend-{uuid.uuid4().hex[:12]}"
    try:
        send_verification_email(
            to_email=email_norm, token=raw_token, technical_id=technical_id
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "email_send_failed",
                "message": "Impossible d'envoyer l'e-mail. Réessayez plus tard.",
            },
        )
    return {"ok": True, "message": GENERIC_RESEND_MSG}


async def login_with_email(
    db,
    *,
    email: str,
    password: str,
    response: Response,
    request: Request,
    verify_password_fn,
    create_access_token_fn,
    create_refresh_token_fn,
    set_auth_cookies_fn,
    serialize_user_fn,
) -> dict:
    await enforce_rate_limit(db, request, "login")

    email_norm = normalize_email(email) if email else None
    if not email_norm or not is_valid_email(email_norm):
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    user = await db.users.find_one({"email_normalized": email_norm})
    if not user or not verify_password_fn(password, user.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    if user.get("account_status") == "disabled":
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    if not user.get("email_verified_at") or user.get("account_status") == "pending_email":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "email_not_verified",
                "message": "Adresse e-mail non confirmée. Vérifiez votre boîte de réception.",
                "email_hint": mask_email_for_logs(email_norm),
            },
        )

    if user.get("email_migration_required") and not user.get("email_verified_at"):
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    tv = int(user.get("token_version") or 0)
    access = create_access_token_fn(str(user["_id"]), user["username"], tv)
    refresh = create_refresh_token_fn(str(user["_id"]), tv)
    set_auth_cookies_fn(response, access, refresh)

    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen_at": now}})
    user["last_seen_at"] = now
    return serialize_user_fn(user, include_email=True)


# Cookie / JWT temporaire pour migration legacy (court)
LEGACY_MIGRATION_COOKIE = "legacy_migration_token"
LEGACY_MIGRATION_MAX_AGE = 900  # 15 min


async def legacy_login(
    db,
    *,
    handle: str,
    password: str,
    response: Response,
    request: Request,
    normalize_handle_fn,
    verify_password_fn,
    cookie_secure: bool,
) -> dict:
    await enforce_rate_limit(db, request, "legacy_login")

    normalized = normalize_handle_fn(handle) or (handle or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")

    user = await db.users.find_one(
        {"$or": [{"handle": normalized}, {"username": normalized}]}
    )
    if not user or not verify_password_fn(password, user.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")

    if not needs_email_migration(user):
        # Déjà migré / a un email — ne pas ouvrir le parcours legacy
        if user.get("email_normalized") and not user.get("email_verified_at"):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "email_not_verified",
                    "message": "Confirmez d'abord votre adresse e-mail via le lien reçu.",
                    "email_hint": mask_email_for_logs(user.get("email_normalized")),
                },
            )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "migration_not_needed",
                "message": "Ce compte utilise déjà une adresse e-mail. Connectez-vous avec e-mail et mot de passe.",
            },
        )

    raw_token = await create_token(
        db,
        token_type="legacy_migration",
        user_id=str(user["_id"]),
        ttl_minutes=15,
        email_normalized=None,
        meta={"purpose": "legacy_email_attach"},
    )
    response.set_cookie(
        key=LEGACY_MIGRATION_COOKIE,
        value=raw_token,
        max_age=LEGACY_MIGRATION_MAX_AGE,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        path="/",
    )
    return {
        "ok": True,
        "message": "Ajoutez votre adresse e-mail pour finaliser la migration.",
        "step": "email",
        "handle": user.get("handle") or user.get("username"),
    }


async def legacy_set_email(
    db,
    *,
    email: str,
    request: Request,
    response: Response,
    cookie_secure: bool,
) -> dict:
    await enforce_rate_limit(db, request, "legacy_email")

    raw = request.cookies.get(LEGACY_MIGRATION_COOKIE)
    if not raw:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "legacy_session_required",
                "message": "Reconnectez-vous avec votre ancien pseudo et mot de passe.",
            },
        )

    # Peek sans consommer — le token migration reste valide jusqu'à vérification email
    from auth.tokens import peek_token

    mig = await peek_token(db, raw_token=raw, token_type="legacy_migration")
    reason = await find_active_token_reason(
        db, raw_token=raw, token_type="legacy_migration"
    )
    if reason != "ok" or not mig:
        response.delete_cookie(
            LEGACY_MIGRATION_COOKIE,
            path="/",
            httponly=True,
            secure=cookie_secure,
            samesite="lax",
        )
        raise HTTPException(
            status_code=401,
            detail={
                "code": "legacy_session_expired",
                "message": "Session de migration expirée. Recommencez.",
            },
        )

    if not is_valid_email(email):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_email", "message": "Adresse e-mail invalide"},
        )
    email_norm = normalize_email(email)

    existing = await db.users.find_one(
        {
            "email_normalized": email_norm,
            "_id": {"$ne": ObjectId(mig["user_id"])},
        }
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail={"code": "email_taken", "message": "Cette adresse e-mail est déjà utilisée"},
        )

    user = await db.users.find_one({"_id": ObjectId(mig["user_id"])})
    if not user or not needs_email_migration(user):
        raise HTTPException(
            status_code=400,
            detail={"code": "migration_not_needed", "message": "Migration non nécessaire."},
        )

    # Stocker l'email en attente de vérif, sans activer encore
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "email": email_norm,
                "email_normalized": email_norm,
                "email_verified_at": None,
                "account_status": "pending_email",
                "email_migration_required": True,
            }
        },
    )

    raw_token = await create_token(
        db,
        token_type="legacy_email_verify",
        user_id=str(user["_id"]),
        ttl_minutes=email_verification_ttl_minutes(),
        email_normalized=email_norm,
        meta={"legacy_migration_token_hash": mig.get("token_hash")},
    )
    technical_id = f"legacy-verify-{uuid.uuid4().hex[:12]}"
    try:
        send_verification_email(
            to_email=email_norm, token=raw_token, technical_id=technical_id
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "email_send_failed",
                "message": "Impossible d'envoyer l'e-mail. Réessayez plus tard.",
            },
        )

    return {
        "ok": True,
        "message": "Un e-mail de confirmation a été envoyé.",
        "email_hint": mask_email_for_logs(email_norm),
        "requires_verification": True,
    }


async def verify_legacy_email(
    db,
    *,
    token: str,
    response: Response,
    create_access_token_fn,
    create_refresh_token_fn,
    set_auth_cookies_fn,
    serialize_user_fn,
    cookie_secure: bool,
) -> Optional[dict]:
    """Essaie de valider un token legacy_email_verify. Retourne None si type non applicable."""
    reason = await find_active_token_reason(
        db, raw_token=token, token_type="legacy_email_verify"
    )
    if reason == "missing":
        return None
    if reason == "used":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_used", "message": "Ce lien a déjà été utilisé."},
        )
    if reason == "expired":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_expired", "message": "Ce lien a expiré."},
        )
    if reason != "ok":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )

    doc = await consume_token(db, raw_token=token, token_type="legacy_email_verify")
    if not doc:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )

    user_id = doc["user_id"]
    email_norm = doc.get("email_normalized")
    now = datetime.now(timezone.utc).isoformat()

    # Invalider le token de migration
    await db.auth_tokens.update_many(
        {"type": "legacy_migration", "user_id": user_id, "used_at": None},
        {"$set": {"used_at": now, "invalidated": True}},
    )

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "email": email_norm,
                "email_normalized": email_norm,
                "email_verified_at": now,
                "email_migration_required": False,
                "account_status": "active",
            }
        },
    )
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de confirmation invalide."},
        )

    tv = int(user.get("token_version") or 0)
    access = create_access_token_fn(str(user["_id"]), user["username"], tv)
    refresh = create_refresh_token_fn(str(user["_id"]), tv)
    set_auth_cookies_fn(response, access, refresh)
    response.delete_cookie(
        LEGACY_MIGRATION_COOKIE,
        path="/",
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
    )

    return {
        "ok": True,
        "message": "Migration terminée, adresse e-mail confirmée",
        "user": serialize_user_fn(user, include_email=True),
        "user_id": str(user["_id"]),
    }


async def forgot_password(db, *, email: str, request: Request) -> dict:
    email_norm = normalize_email(email) if is_valid_email(email) else None
    await enforce_rate_limit(db, request, "forgot_password", email_norm or "invalid")

    if not email_norm:
        return {"ok": True, "message": GENERIC_FORGOT_MSG}

    user = await db.users.find_one({"email_normalized": email_norm})
    if not user or not user.get("email_verified_at"):
        return {"ok": True, "message": GENERIC_FORGOT_MSG}

    raw_token = await create_token(
        db,
        token_type="password_reset",
        user_id=str(user["_id"]),
        ttl_minutes=password_reset_ttl_minutes(),
        email_normalized=email_norm,
    )
    technical_id = f"reset-{uuid.uuid4().hex[:12]}"
    try:
        send_password_reset_email(
            to_email=email_norm, token=raw_token, technical_id=technical_id
        )
    except Exception:
        # Ne pas révéler l'échec SMTP de façon distincte (énumération)
        logger.exception("forgot_password_send_failed id=%s", technical_id)
    return {"ok": True, "message": GENERIC_FORGOT_MSG}


async def reset_password(
    db,
    *,
    token: str,
    password: str,
    password_confirmation: str,
    hash_password_fn,
) -> dict:
    if password != password_confirmation:
        raise HTTPException(
            status_code=400,
            detail={"code": "password_mismatch", "message": "Les mots de passe ne correspondent pas"},
        )
    pwd_err = validate_password(password)
    if pwd_err:
        raise HTTPException(
            status_code=400,
            detail={"code": pwd_err, "message": "Mot de passe invalide (minimum 6 caractères)"},
        )

    reason = await find_active_token_reason(
        db, raw_token=token, token_type="password_reset"
    )
    if reason == "used":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_used", "message": "Ce lien a déjà été utilisé."},
        )
    if reason == "expired":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_expired", "message": "Ce lien a expiré."},
        )
    if reason != "ok":
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de réinitialisation invalide."},
        )

    doc = await consume_token(db, raw_token=token, token_type="password_reset")
    if not doc:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de réinitialisation invalide."},
        )

    user = await db.users.find_one({"_id": ObjectId(doc["user_id"])})
    if not user:
        raise HTTPException(
            status_code=400,
            detail={"code": "token_invalid", "message": "Lien de réinitialisation invalide."},
        )

    new_version = bump_token_version(user)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password_fn(password),
                "token_version": new_version,
            }
        },
    )
    # Invalider tous les tokens reset restants
    await db.auth_tokens.update_many(
        {"type": "password_reset", "user_id": str(user["_id"]), "used_at": None},
        {"$set": {"used_at": datetime.now(timezone.utc).isoformat(), "invalidated": True}},
    )
    logger.info("auth_password_reset user_id=%s", str(user["_id"]))
    return {
        "ok": True,
        "message": "Mot de passe réinitialisé. Vous pouvez vous connecter.",
    }

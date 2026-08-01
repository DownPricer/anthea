"""Web Push — envoi VAPID (clé privée uniquement côté serveur)."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = (os.environ.get("VAPID_PUBLIC_KEY") or "").strip()
_raw_private = (os.environ.get("VAPID_PRIVATE_KEY") or "").strip()
# Support PEM stocké sur une ligne avec \n échappés
VAPID_PRIVATE_KEY = _raw_private.replace("\\n", "\n") if _raw_private else ""
VAPID_SUBJECT = (os.environ.get("VAPID_SUBJECT") or "mailto:support@fitmatch.app").strip()

PUSH_TYPE_PAYLOADS = {
    "follow_request": {
        "title": "Nouvelle demande de suivi",
        "body": "{actor} souhaite vous suivre.",
        "url": "/notifications",
        "tag": "follow_request",
    },
    "new_follower": {
        "title": "Nouveau follower",
        "body": "{actor} vous suit maintenant.",
        "url": "/notifications",
        "tag": "new_follower",
    },
    "follow_accepted": {
        "title": "Demande acceptée",
        "body": "{actor} a accepté votre demande de suivi.",
        "url": "/notifications",
        "tag": "follow_accepted",
    },
    "follow_back": {
        "title": "Nouveau follower",
        "body": "{actor} vous suit en retour.",
        "url": "/notifications",
        "tag": "follow_back",
    },
    "duo_follow_request": {
        "title": "Nouvelle demande Duo",
        "body": "Une personne souhaite suivre votre profil Duo.",
        "url": "/notifications?filter=duo",
        "tag": "duo-follow-request",
    },
    "duo_follow_accepted": {
        "title": "Demande Duo acceptée",
        "body": "Votre demande pour suivre un Duo a été acceptée.",
        "url": "/notifications?filter=duo",
        "tag": "duo-follow-accepted",
    },
    "duo_partner_request": {
        "title": "Demande de Duo reçue",
        "body": "{actor} souhaite former un Duo avec vous.",
        "url": "/settings?section=partner-duo&panel=requests",
        "tag": "duo-partner-request",
    },
    "duo_request_received": {
        "title": "Demande de Duo reçue",
        "body": "{actor} souhaite former un Duo avec vous.",
        "url": "/settings?section=partner-duo&panel=requests",
        "tag": "duo-request-received",
    },
    "duo_partner_accepted": {
        "title": "Duo accepté",
        "body": "{actor} a accepté votre demande Duo.",
        "url": "/duo",
        "tag": "duo-partner-accepted",
    },
    "duo_partner_rejected": {
        "title": "Demande Duo refusée",
        "body": "{actor} a refusé votre demande Duo.",
        "url": "/notifications?filter=duo",
        "tag": "duo-partner-rejected",
    },
    "duo_new_post": {
        "title": "Nouvelle publication Duo",
        "body": "Une nouvelle publication est disponible sur votre mur Duo.",
        "url": "/duo",
        "tag": "duo-new-post",
    },
    "session_reminder": {
        "title": "Rappel de séance",
        "body": "Votre séance planifiée approche.",
        "url": "/agenda",
        "tag": "session-reminder",
    },
    "session_soon": {
        "title": "Séance bientôt",
        "body": "Une séance planifiée commence bientôt.",
        "url": "/agenda",
        "tag": "session-soon",
    },
    "challenge_ending": {
        "title": "Défi hebdomadaire",
        "body": "Le défi de la semaine se termine bientôt.",
        "url": "/duo",
        "tag": "challenge-ending",
    },
    "challenge_completed": {
        "title": "Défi réussi",
        "body": "Un défi a été terminé avec succès.",
        "url": "/duo",
        "tag": "challenge-completed",
    },
    "badge_unlocked": {
        "title": "Badge débloqué",
        "body": "Vous avez débloqué un nouveau badge !",
        "url": "/profile?tab=badges",
        "tag": "badge-unlocked",
    },
    "duo_badge_unlocked": {
        "title": "Nouveau badge Duo",
        "body": "Votre Duo a obtenu un nouveau succès !",
        "url": "/duo?tab=stats&section=badges",
        "tag": "duo-badge-unlocked",
    },
    "partner_activity": {
        "title": "Activité du partenaire",
        "body": "{actor} s'est entraîné(e).",
        "url": "/duo",
        "tag": "partner-activity",
    },
    "partner_workout_started": {
        "title": "Séance commencée",
        "body": "{actor} vient de commencer une séance.",
        "url": "/duo",
        "tag": "partner-workout-started",
    },
    "partner_workout_completed": {
        "title": "Séance terminée",
        "body": "{actor} a terminé une séance.",
        "url": "/duo",
        "tag": "partner-workout-completed",
    },
    "like": {
        "title": "Nouveau like",
        "body": "{actor} a aimé votre publication.",
        "url": "/notifications",
        "tag": "like",
    },
    "comment": {
        "title": "Nouveau commentaire",
        "body": "{actor} a commenté votre publication.",
        "url": "/notifications",
        "tag": "comment",
    },
    "comment_like": {
        "title": "Like sur commentaire",
        "body": "{actor} a aimé votre commentaire.",
        "url": "/notifications",
        "tag": "comment-like",
    },
    "comment_like_grouped": {
        "title": "Likes sur commentaire",
        "body": "Plusieurs personnes ont aimé votre commentaire.",
        "url": "/notifications",
        "tag": "comment-like-grouped",
    },
    "followed_user_post": {
        "title": "Nouvelle publication",
        "body": "{actor} a publié quelque chose.",
        "url": "/notifications",
        "tag": "followed-user-post",
    },
    "streak_reminder": {
        "title": "Rappel de streak",
        "body": "N'oubliez pas votre série d'entraînement.",
        "url": "/agenda",
        "tag": "streak-reminder",
    },
}

# Préférences utilisateur → types de notif (clés persistées sur le profil).
DEFAULT_NOTIFICATION_PREFS: Dict[str, bool] = {
    "partner_workout_started": True,
    "partner_workout_completed": True,
    "scheduled_workout_reminder": True,
    "followed_user_post": False,
    "post_comment": True,
    "post_like": True,
    "follow_request": True,
    "follow_accepted": True,
    "duo_request": True,
    "duo_activity": True,
    "solo_badge_unlocked": True,
    "duo_badge_unlocked": True,
    "challenge_ending": True,
    "challenge_completed": True,
    "streak_reminder": False,
}

# Types critiques non désactivables (sécurité / compte).
ALWAYS_PUSH_TYPES = frozenset({
    "security_alert",
    "account_security",
    "password_changed",
})

NOTIF_TYPE_TO_PREF: Dict[str, str] = {
    "partner_workout_started": "partner_workout_started",
    "partner_workout_completed": "partner_workout_completed",
    "partner_activity": "partner_workout_completed",
    "session_reminder": "scheduled_workout_reminder",
    "session_soon": "scheduled_workout_reminder",
    "followed_user_post": "followed_user_post",
    "comment": "post_comment",
    "comment_like": "post_comment",
    "comment_like_grouped": "post_comment",
    "like": "post_like",
    "follow_request": "follow_request",
    "new_follower": "follow_accepted",
    "follow_accepted": "follow_accepted",
    "follow_back": "follow_accepted",
    "duo_partner_request": "duo_request",
    "duo_request_received": "duo_request",
    "duo_partner_accepted": "duo_activity",
    "duo_partner_rejected": "duo_activity",
    "duo_follow_request": "duo_request",
    "duo_follow_accepted": "duo_activity",
    "duo_new_post": "duo_activity",
    "badge_unlocked": "solo_badge_unlocked",
    "duo_badge_unlocked": "duo_badge_unlocked",
    "challenge_ending": "challenge_ending",
    "challenge_completed": "challenge_completed",
    "streak_reminder": "streak_reminder",
}


def default_notification_prefs() -> Dict[str, bool]:
    return dict(DEFAULT_NOTIFICATION_PREFS)


def merge_notification_prefs(raw: Optional[Dict[str, Any]]) -> Dict[str, bool]:
    merged = default_notification_prefs()
    if not isinstance(raw, dict):
        return merged
    for key in DEFAULT_NOTIFICATION_PREFS:
        if key in raw:
            merged[key] = bool(raw[key])
    return merged


def push_allowed_for_prefs(notif_type: str, prefs: Optional[Dict[str, Any]]) -> bool:
    """Retourne False si l'utilisateur a désactivé cette catégorie de push."""
    if not notif_type:
        return True
    if notif_type in ALWAYS_PUSH_TYPES or str(notif_type).startswith("security_"):
        return True
    pref_key = NOTIF_TYPE_TO_PREF.get(notif_type)
    if not pref_key:
        return True
    merged = merge_notification_prefs(prefs)
    return bool(merged.get(pref_key, True))


def is_push_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and len(VAPID_PUBLIC_KEY) > 20)


def build_push_payload(
    notif_type: str,
    *,
    locale: Optional[str] = None,
    actor_name: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
    tag: Optional[str] = None,
) -> Dict[str, Any]:
    tpl = PUSH_TYPE_PAYLOADS.get(notif_type) or {
        "url": "/notifications",
        "tag": notif_type or "generic",
    }
    actor = actor_name or _default_actor_name(locale)
    resolved_title = title
    resolved_body = body
    if resolved_title is None or resolved_body is None:
        try:
            from i18n_messages import DEFAULT_LOCALE, t
            loc = locale or DEFAULT_LOCALE
            if resolved_title is None:
                key = f"push.{notif_type}.title" if notif_type else "push.generic.title"
                resolved_title = t(loc, key)
                if resolved_title == key:
                    resolved_title = t(DEFAULT_LOCALE, "push.generic.title")
            if resolved_body is None:
                key = f"push.{notif_type}.body" if notif_type else "push.generic.body"
                resolved_body = t(loc, key, actor=actor)
                if resolved_body == key:
                    resolved_body = t(DEFAULT_LOCALE, "push.generic.body", actor=actor)
        except Exception:
            fallback = PUSH_TYPE_PAYLOADS.get(notif_type) or {}
            resolved_title = resolved_title or fallback.get("title", "FitGather")
            resolved_body = resolved_body or fallback.get("body", "Nouvelle activité")
    if "{actor}" in resolved_body:
        resolved_body = resolved_body.replace("{actor}", actor)
    return {
        "title": resolved_title,
        "body": resolved_body,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
        "url": url or tpl.get("url", "/notifications"),
        "tag": tag or tpl.get("tag", notif_type or "generic"),
    }


def _default_actor_name(locale: Optional[str] = None) -> str:
    try:
        from i18n_messages import DEFAULT_LOCALE, t
        loc = locale or DEFAULT_LOCALE
        label = t(loc, "push.generic.actor")
        if label != "push.generic.actor":
            return label
    except Exception:
        pass
    return "Quelqu'un"


async def send_web_push_to_user(db, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Envoie une notification push à tous les appareils actifs de l'utilisateur."""
    if not is_push_configured():
        return {"sent": 0, "reason": "not_configured"}

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush non installé — push ignoré")
        return {"sent": 0, "reason": "missing_dependency"}

    cursor = db.push_subscriptions.find({
        "user_id": user_id,
        "$or": [{"revoked_at": None}, {"revoked_at": {"$exists": False}}],
    })
    subs = await cursor.to_list(50)
    if not subs:
        return {"sent": 0, "reason": "no_subscriptions"}

    sent = 0
    expired = 0
    data = json.dumps(payload)
    vapid_claims = {"sub": VAPID_SUBJECT}

    for sub in subs:
        endpoint = sub.get("endpoint")
        keys = sub.get("keys") or {}
        if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
            continue
        subscription_info = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": keys["p256dh"],
                "auth": keys["auth"],
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=data,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                await db.push_subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
                )
                expired += 1
            else:
                logger.warning("Web push failed for %s: %s", user_id, exc)
        except Exception as exc:
            logger.warning("Web push error for %s: %s", user_id, exc)

    return {"sent": sent, "expired": expired}


async def _load_user_notification_prefs(db, recipient_id: str) -> Optional[Dict[str, Any]]:
    try:
        from bson import ObjectId
        user_doc = await db.users.find_one(
            {"_id": ObjectId(str(recipient_id))},
            {"notification_prefs": 1, "locale": 1},
        )
    except Exception:
        user_doc = None
    if user_doc is None:
        return None
    return user_doc.get("notification_prefs")


async def _load_recipient_locale(db, recipient_id: str) -> str:
    try:
        from i18n_messages import DEFAULT_LOCALE, load_user_locale
        return await load_user_locale(db, recipient_id)
    except Exception:
        from i18n_messages import DEFAULT_LOCALE
        return DEFAULT_LOCALE


async def notify_push(
    db,
    recipient_id: str,
    notif_type: str,
    *,
    actor_name: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
    tag: Optional[str] = None,
    skip_pref_check: bool = False,
) -> None:
    """Fire-and-forget friendly wrapper — n'échoue jamais l'appelant."""
    try:
        if not skip_pref_check:
            prefs = await _load_user_notification_prefs(db, recipient_id)
            if not push_allowed_for_prefs(notif_type, prefs):
                return

        locale = await _load_recipient_locale(db, recipient_id)
        payload = build_push_payload(
            notif_type,
            locale=locale,
            actor_name=actor_name,
            url=url,
            title=title,
            body=body,
            tag=tag,
        )
        await send_web_push_to_user(db, recipient_id, payload)
    except Exception as exc:
        logger.warning("notify_push failed: %s", exc)

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
        "title": "Demande Duo",
        "body": "{actor} souhaite devenir votre partenaire Duo.",
        "url": "/notifications?filter=duo",
        "tag": "duo-partner-request",
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
    "badge_unlocked": {
        "title": "Badge débloqué",
        "body": "Vous avez débloqué un nouveau badge !",
        "url": "/badges",
        "tag": "badge-unlocked",
    },
    "partner_activity": {
        "title": "Activité du partenaire",
        "body": "{actor} s'est entraîné(e).",
        "url": "/duo",
        "tag": "partner-activity",
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
}


def is_push_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and len(VAPID_PUBLIC_KEY) > 20)


def build_push_payload(
    notif_type: str,
    *,
    actor_name: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
    tag: Optional[str] = None,
) -> Dict[str, Any]:
    tpl = PUSH_TYPE_PAYLOADS.get(notif_type) or {
        "title": "FitMatch",
        "body": "Nouvelle activité",
        "url": "/notifications",
        "tag": notif_type or "generic",
    }
    actor = actor_name or "Quelqu'un"
    resolved_body = (body or tpl["body"]).replace("{actor}", actor)
    resolved_title = title or tpl["title"]
    return {
        "title": resolved_title,
        "body": resolved_body,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
        "url": url or tpl["url"],
        "tag": tag or tpl["tag"],
    }


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


async def notify_push(
    db,
    recipient_id: str,
    notif_type: str,
    *,
    actor_name: Optional[str] = None,
    url: Optional[str] = None,
    title: Optional[str] = None,
    body: Optional[str] = None,
) -> None:
    """Fire-and-forget friendly wrapper — n'échoue jamais l'appelant."""
    try:
        payload = build_push_payload(
            notif_type,
            actor_name=actor_name,
            url=url,
            title=title,
            body=body,
        )
        await send_web_push_to_user(db, recipient_id, payload)
    except Exception as exc:
        logger.warning("notify_push failed: %s", exc)

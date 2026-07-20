#!/usr/bin/env python3
"""Recalcul administratif idempotent des badges Solo / Duo.

Usage:
  python recalculate_badges.py --dry-run --all
  python recalculate_badges.py --user-id <id>
  python recalculate_badges.py --pair-key <a_b>
  python recalculate_badges.py --all --notify   # envoie notifs (désactivé par défaut)

Règles migration :
  - --dry-run : aucune écriture (pas d'index, pas d'insert, pas de notif)
  - par défaut : pas de Web Push ni notification de déblocage
  - --notify : active les notifications (usage exceptionnel)
  - unlocked_at historique déduit si possible, sinon maintenant
  - alias legacy déjà migrés : jamais recréés
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from badge_catalog import (  # noqa: E402
    DUO_BADGES,
    LEGACY_BADGE_ID_MAP,
    LEGACY_ORPHAN_BADGE_IDS,
    SOLO_BADGES,
    canonical_badge_id,
    get_badge_definition,
)
from badge_progress import BadgeProgressService, evaluate_badge  # noqa: E402


def _empty_summary(*, dry_run: bool, notify: bool) -> Dict[str, Any]:
    return {
        "users_checked": 0,
        "duos_checked": 0,
        "badges_added": 0,
        "badges_already_present": 0,
        "legacy_aliases_recognized": 0,
        "orphan_badges": 0,
        "errors": 0,
        "notifications_sent": 0,
        # détail rétrocompat affichage
        "new_solo_badges": 0,
        "new_duo_badges": 0,
        "unknown_ids": [],
        "orphan_ids": [],
        "error_messages": [],
        "dry_run": dry_run,
        "notify": notify,
    }


async def _scan_legacy_references(
    db,
    *,
    unlocked_solo: Dict[str, Set[str]],
    unlocked_duo: Dict[str, Set[str]],
    summary: Dict[str, Any],
) -> None:
    """Compte alias legacy reconnus et orphelins (sans écriture)."""
    orphan_ids: Set[str] = set()
    legacy_recognized = 0

    async for user in db.users.find({}, {"_id": 1, "featured_badges": 1}):
        uid = str(user["_id"])
        owned = unlocked_solo.get(uid, set())
        for bid in user.get("featured_badges") or []:
            raw = str(bid)
            if raw in LEGACY_ORPHAN_BADGE_IDS:
                orphan_ids.add(raw)
                continue
            if raw in LEGACY_BADGE_ID_MAP:
                cid = LEGACY_BADGE_ID_MAP[raw]
                legacy_recognized += 1
                # Déjà migré si le canonique est présent — ne rien recréer
                if cid in owned:
                    continue
                continue
            cid = canonical_badge_id(raw)
            if not get_badge_definition(cid):
                orphan_ids.add(raw)

    async for post in db.posts.find(
        {"badge_id": {"$exists": True, "$ne": None}},
        {"badge_id": 1, "owner_type": 1, "owner_id": 1, "author_id": 1},
    ):
        raw = str(post.get("badge_id") or "")
        if not raw:
            continue
        if raw in LEGACY_ORPHAN_BADGE_IDS:
            orphan_ids.add(raw)
            continue
        if raw in LEGACY_BADGE_ID_MAP:
            legacy_recognized += 1
            continue
        cid = canonical_badge_id(raw)
        if not get_badge_definition(cid):
            orphan_ids.add(raw)

    # Documents éventuels stockés sous un ID legacy (ne pas les dupliquer)
    async for doc in db.user_badges.find({}, {"user_id": 1, "badge_id": 1}):
        raw = str(doc.get("badge_id") or "")
        if raw in LEGACY_BADGE_ID_MAP:
            legacy_recognized += 1
            cid = LEGACY_BADGE_ID_MAP[raw]
            uid = str(doc.get("user_id") or "")
            if cid in unlocked_solo.get(uid, set()):
                # Alias déjà migré côté canonique
                pass
        elif raw in LEGACY_ORPHAN_BADGE_IDS:
            orphan_ids.add(raw)
        elif not get_badge_definition(raw):
            orphan_ids.add(raw)

    async for doc in db.duo_badges.find({}, {"pair_key": 1, "badge_id": 1}):
        raw = str(doc.get("badge_id") or "")
        if raw in LEGACY_BADGE_ID_MAP:
            legacy_recognized += 1
        elif raw in LEGACY_ORPHAN_BADGE_IDS:
            orphan_ids.add(raw)
        elif not get_badge_definition(raw):
            orphan_ids.add(raw)

    summary["legacy_aliases_recognized"] = legacy_recognized
    summary["orphan_badges"] = len(orphan_ids)
    summary["orphan_ids"] = sorted(orphan_ids)
    summary["unknown_ids"] = summary["orphan_ids"]


async def _process_solo(
    service: BadgeProgressService,
    user_id: str,
    *,
    dry_run: bool,
    notify: bool,
    summary: Dict[str, Any],
) -> None:
    try:
        metrics = await service.get_solo_metrics(user_id)
        unlocked_map = await service.get_unlocked_solo(user_id)
        # IDs canoniques déjà présents (+ alias legacy déjà stockés mappés)
        present: Set[str] = set()
        for bid in unlocked_map.keys():
            present.add(canonical_badge_id(bid))

        for definition in SOLO_BADGES:
            if not definition.get("enabled", True):
                continue
            badge_id = definition["id"]
            if badge_id in present:
                summary["badges_already_present"] += 1
                continue
            progress = evaluate_badge(definition, metrics)
            if not progress.get("eligible"):
                continue

            historical_at = BadgeProgressService.infer_unlock_at(definition, metrics)
            unlock_at = historical_at  # None → unlock utilisera now

            if dry_run:
                summary["badges_added"] += 1
                summary["new_solo_badges"] += 1
                continue

            doc = await service.unlock_badge_if_eligible(
                scope="solo",
                owner_id=user_id,
                definition=definition,
                progress=progress,
                notify=notify,
                notify_user_ids=[user_id],
                unlocked_at=unlock_at,
            )
            if doc:
                summary["badges_added"] += 1
                summary["new_solo_badges"] += 1
                summary["notifications_sent"] += int(doc.get("_notifications_sent") or 0)
                present.add(badge_id)
            else:
                # Course condition / déjà présent
                summary["badges_already_present"] += 1
    except Exception as exc:
        summary["errors"] += 1
        summary["error_messages"].append(f"solo:{user_id}: {exc}")


async def _process_duo(
    service: BadgeProgressService,
    pair_key: str,
    *,
    dry_run: bool,
    notify: bool,
    summary: Dict[str, Any],
) -> None:
    try:
        metrics = await service.get_duo_metrics(pair_key)
        unlocked_map = await service.get_unlocked_duo(pair_key)
        present: Set[str] = {canonical_badge_id(bid) for bid in unlocked_map.keys()}
        metrics["unlocked_duo_badge_ids"] = list(present)

        # Premier passage sans unlocked_duo_badges
        pending_collection = []
        for definition in DUO_BADGES:
            if not definition.get("enabled", True):
                continue
            if definition["condition_type"] == "unlocked_duo_badges":
                pending_collection.append(definition)
                continue
            badge_id = definition["id"]
            if badge_id in present:
                summary["badges_already_present"] += 1
                continue
            progress = evaluate_badge(definition, metrics)
            if not progress.get("eligible"):
                continue

            historical_at = BadgeProgressService.infer_unlock_at(definition, metrics)
            if dry_run:
                summary["badges_added"] += 1
                summary["new_duo_badges"] += 1
                present.add(badge_id)
                metrics["unlocked_duo_badge_ids"] = list(present)
                continue

            doc = await service.unlock_badge_if_eligible(
                scope="duo",
                owner_id=pair_key,
                definition=definition,
                progress=progress,
                notify=notify,
                notify_user_ids=pair_key.split("_"),
                unlocked_at=historical_at,
            )
            if doc:
                summary["badges_added"] += 1
                summary["new_duo_badges"] += 1
                summary["notifications_sent"] += int(doc.get("_notifications_sent") or 0)
                present.add(badge_id)
                metrics["unlocked_duo_badge_ids"] = list(present)
            else:
                summary["badges_already_present"] += 1

        for definition in pending_collection:
            badge_id = definition["id"]
            if badge_id in present:
                summary["badges_already_present"] += 1
                continue
            progress = evaluate_badge(definition, metrics)
            if not progress.get("eligible"):
                continue
            historical_at = BadgeProgressService.infer_unlock_at(definition, metrics)
            if dry_run:
                summary["badges_added"] += 1
                summary["new_duo_badges"] += 1
                continue
            doc = await service.unlock_badge_if_eligible(
                scope="duo",
                owner_id=pair_key,
                definition=definition,
                progress=progress,
                notify=notify,
                notify_user_ids=pair_key.split("_"),
                unlocked_at=historical_at,
            )
            if doc:
                summary["badges_added"] += 1
                summary["new_duo_badges"] += 1
                summary["notifications_sent"] += int(doc.get("_notifications_sent") or 0)
            else:
                summary["badges_already_present"] += 1
    except Exception as exc:
        summary["errors"] += 1
        summary["error_messages"].append(f"duo:{pair_key}: {exc}")


async def recalculate(
    *,
    user_id: Optional[str] = None,
    pair_key: Optional[str] = None,
    all_users: bool = False,
    dry_run: bool = False,
    notify: bool = False,
) -> Dict[str, Any]:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL et DB_NAME requis")

    # Migration globale : jamais de notif sauf --notify explicite
    if dry_run:
        notify = False

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    service = BadgeProgressService(db)
    summary = _empty_summary(dry_run=dry_run, notify=notify)

    # dry-run : aucune écriture, y compris création d'index
    if not dry_run:
        try:
            await service.ensure_indexes()
        except Exception as exc:
            summary["errors"] += 1
            summary["error_messages"].append(f"indexes: {exc}")

    # Précharge unlocked pour scan legacy
    unlocked_solo: Dict[str, Set[str]] = {}
    unlocked_duo: Dict[str, Set[str]] = {}
    async for doc in db.user_badges.find({}, {"user_id": 1, "badge_id": 1}):
        uid = str(doc.get("user_id") or "")
        unlocked_solo.setdefault(uid, set()).add(canonical_badge_id(doc.get("badge_id")))
    async for doc in db.duo_badges.find({}, {"pair_key": 1, "badge_id": 1}):
        pk = str(doc.get("pair_key") or "")
        unlocked_duo.setdefault(pk, set()).add(canonical_badge_id(doc.get("badge_id")))

    try:
        await _scan_legacy_references(
            db,
            unlocked_solo=unlocked_solo,
            unlocked_duo=unlocked_duo,
            summary=summary,
        )
    except Exception as exc:
        summary["errors"] += 1
        summary["error_messages"].append(f"legacy_scan: {exc}")

    user_ids: List[str] = []
    if user_id:
        user_ids = [user_id]
    elif all_users:
        async for u in db.users.find({}, {"_id": 1}):
            user_ids.append(str(u["_id"]))

    for uid in user_ids:
        summary["users_checked"] += 1
        BadgeProgressService.invalidate_cache(user_id=uid)
        await _process_solo(service, uid, dry_run=dry_run, notify=notify, summary=summary)

    pair_keys: List[str] = []
    if pair_key:
        pair_keys = [pair_key]
    elif all_users or user_id:
        query: Dict[str, Any] = {}
        if user_id:
            query = {"member_ids": user_id}
        async for d in db.duo_profiles.find(query, {"pair_key": 1}):
            pk = d.get("pair_key")
            if pk and pk not in pair_keys:
                pair_keys.append(pk)

    for pk in pair_keys:
        summary["duos_checked"] += 1
        BadgeProgressService.invalidate_cache(pair_key=pk)
        await _process_duo(service, pk, dry_run=dry_run, notify=notify, summary=summary)

    client.close()
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Recalcul des badges Anthea")
    parser.add_argument("--user-id", dest="user_id")
    parser.add_argument("--pair-key", dest="pair_key")
    parser.add_argument("--all", dest="all_users", action="store_true")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true")
    parser.add_argument(
        "--notify",
        dest="notify",
        action="store_true",
        help="Envoie notifications / Web Push (désactivé par défaut pour les migrations)",
    )
    args = parser.parse_args()

    if not args.user_id and not args.pair_key and not args.all_users:
        parser.error("Spécifiez --user-id, --pair-key ou --all")

    result = asyncio.run(
        recalculate(
            user_id=args.user_id,
            pair_key=args.pair_key,
            all_users=args.all_users,
            dry_run=args.dry_run,
            notify=args.notify,
        )
    )
    print(f"Users checked: {result['users_checked']}")
    print(f"Duos checked: {result['duos_checked']}")
    print(f"Badges added: {result['badges_added']}")
    print(f"Badges already present: {result['badges_already_present']}")
    print(f"Legacy aliases recognized: {result['legacy_aliases_recognized']}")
    print(f"Orphan badges: {result['orphan_badges']}")
    print(f"Errors: {result['errors']}")
    print(f"Notifications sent: {result['notifications_sent']}")
    if result.get("orphan_ids"):
        print("Orphan IDs:", ", ".join(result["orphan_ids"][:20]))
    if result.get("error_messages"):
        for msg in result["error_messages"][:10]:
            print(f"  ! {msg}")
    if result["dry_run"]:
        print("(dry-run — aucune écriture)")
    elif not result["notify"]:
        print("(notifications désactivées — passer --notify pour les activer)")


if __name__ == "__main__":
    main()

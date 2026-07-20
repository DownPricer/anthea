#!/usr/bin/env python3
"""Recalcul administratif idempotent des badges Solo / Duo.

Usage:
  python recalculate_badges.py --dry-run --all
  python recalculate_badges.py --user-id <id>
  python recalculate_badges.py --pair-key <a_b>
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

from badge_catalog import LEGACY_ORPHAN_BADGE_IDS, canonical_badge_id, get_badge_definition  # noqa: E402
from badge_progress import BadgeProgressService  # noqa: E402


async def recalculate(
    *,
    user_id: Optional[str] = None,
    pair_key: Optional[str] = None,
    all_users: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL et DB_NAME requis")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    service = BadgeProgressService(db)
    await service.ensure_indexes()

    summary = {
        "users_checked": 0,
        "duos_checked": 0,
        "new_solo_badges": 0,
        "new_duo_badges": 0,
        "duplicates_skipped": 0,
        "unknown_legacy_badges": 0,
        "unknown_ids": [],
        "dry_run": dry_run,
    }

    # Scan featured_badges for unknown legacy IDs
    unknown: Set[str] = set()
    cursor = db.users.find({}, {"featured_badges": 1})
    async for user in cursor:
        for bid in user.get("featured_badges") or []:
            cid = canonical_badge_id(bid)
            if bid in LEGACY_ORPHAN_BADGE_IDS or (
                not get_badge_definition(cid) and bid not in LEGACY_ORPHAN_BADGE_IDS
            ):
                if not get_badge_definition(cid):
                    unknown.add(str(bid))

    summary["unknown_legacy_badges"] = len(unknown)
    summary["unknown_ids"] = sorted(unknown)

    user_ids: List[str] = []
    if user_id:
        user_ids = [user_id]
    elif all_users:
        async for u in db.users.find({}, {"_id": 1}):
            user_ids.append(str(u["_id"]))

    for uid in user_ids:
        summary["users_checked"] += 1
        before = set((await service.get_unlocked_solo(uid)).keys())
        if dry_run:
            metrics = await service.get_solo_metrics(uid)
            from badge_progress import evaluate_badge
            from badge_catalog import SOLO_BADGES

            for definition in SOLO_BADGES:
                if not definition.get("enabled", True):
                    continue
                progress = evaluate_badge(definition, metrics)
                if progress.get("eligible") and definition["id"] not in before:
                    summary["new_solo_badges"] += 1
                elif definition["id"] in before:
                    summary["duplicates_skipped"] += 1
        else:
            newly = await service.evaluate_solo_badges(uid, notify=False)
            summary["new_solo_badges"] += len(newly)
            after = set((await service.get_unlocked_solo(uid)).keys())
            summary["duplicates_skipped"] += len(before & after) - len(newly)

    pair_keys: List[str] = []
    if pair_key:
        pair_keys = [pair_key]
    elif all_users or user_id:
        query = {}
        if user_id:
            query = {"member_ids": user_id}
        async for d in db.duo_profiles.find(query, {"pair_key": 1}):
            pk = d.get("pair_key")
            if pk:
                pair_keys.append(pk)

    for pk in pair_keys:
        summary["duos_checked"] += 1
        before = set((await service.get_unlocked_duo(pk)).keys())
        if dry_run:
            metrics = await service.get_duo_metrics(pk)
            from badge_progress import evaluate_badge
            from badge_catalog import DUO_BADGES

            for definition in DUO_BADGES:
                if not definition.get("enabled", True):
                    continue
                if definition["condition_type"] == "unlocked_duo_badges":
                    continue
                progress = evaluate_badge(definition, metrics)
                if progress.get("eligible") and definition["id"] not in before:
                    summary["new_duo_badges"] += 1
                elif definition["id"] in before:
                    summary["duplicates_skipped"] += 1
        else:
            newly = await service.evaluate_duo_badges(pk, notify=False)
            summary["new_duo_badges"] += len(newly)

    client.close()
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Recalcul des badges Anthea")
    parser.add_argument("--user-id", dest="user_id")
    parser.add_argument("--pair-key", dest="pair_key")
    parser.add_argument("--all", dest="all_users", action="store_true")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true")
    args = parser.parse_args()

    if not args.user_id and not args.pair_key and not args.all_users:
        parser.error("Spécifiez --user-id, --pair-key ou --all")

    result = asyncio.run(
        recalculate(
            user_id=args.user_id,
            pair_key=args.pair_key,
            all_users=args.all_users,
            dry_run=args.dry_run,
        )
    )
    print(f"Users checked: {result['users_checked']}")
    print(f"Duos checked: {result['duos_checked']}")
    print(f"New solo badges: {result['new_solo_badges']}")
    print(f"New duo badges: {result['new_duo_badges']}")
    print(f"Duplicates skipped: {result['duplicates_skipped']}")
    print(f"Unknown legacy badges: {result['unknown_legacy_badges']}")
    if result["unknown_ids"]:
        print("Unknown IDs:", ", ".join(result["unknown_ids"][:20]))
    if result["dry_run"]:
        print("(dry-run — aucune écriture)")


if __name__ == "__main__":
    main()

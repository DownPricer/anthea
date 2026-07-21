#!/usr/bin/env python3
"""Migration idempotente des featured_badge_ids profil perso (solo canonique).

Usage:
  python migrate_featured_badges.py --dry-run
  python migrate_featured_badges.py --apply
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any, Dict, List, Set

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from badge_catalog import LEGACY_BADGE_ID_MAP, canonical_badge_id, get_badge_definition  # noqa: E402
from badge_progress import BadgeProgressService  # noqa: E402
from server import normalize_featured_badge_ids  # noqa: E402


def _empty_report(*, dry_run: bool) -> Dict[str, Any]:
    return {
        "dry_run": dry_run,
        "profiles_inspected": 0,
        "legacy_converted": 0,
        "unknown_removed": 0,
        "duplicates_removed": 0,
        "profiles_modified": 0,
    }


def _analyze_raw_ids(raw_ids: List[str]) -> Dict[str, int]:
    stats = {"legacy_converted": 0, "unknown_removed": 0, "duplicates_removed": 0}
    if not isinstance(raw_ids, list):
        return stats

    seen_raw: Set[str] = set()
    seen_canonical: Set[str] = set()
    for raw in raw_ids:
        raw_s = str(raw)
        if raw_s in seen_raw:
            stats["duplicates_removed"] += 1
        seen_raw.add(raw_s)

        canonical = canonical_badge_id(raw_s)
        if raw_s != canonical and raw_s in LEGACY_BADGE_ID_MAP:
            stats["legacy_converted"] += 1

        definition = get_badge_definition(canonical)
        if not definition or definition.get("scope") != "solo":
            stats["unknown_removed"] += 1
            continue
        if definition.get("enabled", True) is False:
            stats["unknown_removed"] += 1
            continue
        if canonical.startswith("duo_"):
            stats["unknown_removed"] += 1
            continue
        if canonical in seen_canonical:
            stats["duplicates_removed"] += 1
        seen_canonical.add(canonical)

    return stats


async def migrate_featured_badges(*, apply: bool) -> Dict[str, Any]:
    dry_run = not apply
    report = _empty_report(dry_run=dry_run)

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "anthea")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    service = BadgeProgressService(db)

    try:
        async for user in db.users.find({}, {"_id": 1, "featured_badge_ids": 1, "featured_badges": 1}):
            report["profiles_inspected"] += 1
            uid = str(user["_id"])

            raw_ids = user.get("featured_badge_ids")
            if raw_ids is None:
                raw_ids = user.get("featured_badges") or []
            if not isinstance(raw_ids, list):
                raw_ids = []

            if not raw_ids:
                continue

            analysis = _analyze_raw_ids(raw_ids)
            report["legacy_converted"] += analysis["legacy_converted"]
            report["unknown_removed"] += analysis["unknown_removed"]
            report["duplicates_removed"] += analysis["duplicates_removed"]

            try:
                unlocked_map = await service.get_unlocked_solo(uid)
            except Exception:
                unlocked_map = {}

            cleaned = normalize_featured_badge_ids(raw_ids, unlocked_map)

            if cleaned == [str(b) for b in raw_ids]:
                continue

            report["profiles_modified"] += 1
            if apply:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "featured_badge_ids": cleaned,
                            "featured_badges": cleaned,
                        }
                    },
                )
    finally:
        client.close()

    return report


def _print_report(report: Dict[str, Any]) -> None:
    mode = "APPLY" if not report["dry_run"] else "DRY-RUN"
    print(f"=== migrate_featured_badges ({mode}) ===")
    print(f"profiles_inspected:   {report['profiles_inspected']}")
    print(f"legacy_converted:     {report['legacy_converted']}")
    print(f"unknown_removed:      {report['unknown_removed']}")
    print(f"duplicates_removed:   {report['duplicates_removed']}")
    print(f"profiles_modified:    {report['profiles_modified']}")


async def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate solo featured_badge_ids to canonical catalog")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Inspect only, no writes")
    group.add_argument("--apply", action="store_true", help="Apply migration to database")
    args = parser.parse_args()

    report = await migrate_featured_badges(apply=args.apply)
    _print_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

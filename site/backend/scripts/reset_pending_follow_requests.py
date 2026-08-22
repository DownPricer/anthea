#!/usr/bin/env python3
"""Supprime uniquement les demandes de suivi encore en attente (one-shot maintenance).

Usage:
  python scripts/reset_pending_follow_requests.py --dry-run
  python scripts/reset_pending_follow_requests.py --apply
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any, Dict

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))


async def reset_pending_follow_requests(*, apply: bool) -> Dict[str, Any]:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "anthea")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    pending_docs = await db.follow_requests.find({"status": "pending"}).to_list(None)
    pending_ids = [str(doc["_id"]) for doc in pending_docs]
    pending_count = len(pending_ids)

    accepted_count = await db.follow_requests.count_documents({"status": "accepted"})
    follows_count = await db.follows.count_documents({})

    obsolete_notif_count = 0
    if pending_ids:
        obsolete_notif_count = await db.notifications.count_documents({
            "type": "follow_request",
            "request_id": {"$in": pending_ids},
        })

    deleted_requests = 0
    deleted_notifications = 0
    deleted_follows = 0

    if apply and pending_count:
        req_result = await db.follow_requests.delete_many({"status": "pending"})
        deleted_requests = req_result.deleted_count

        if pending_ids:
            notif_result = await db.notifications.delete_many({
                "type": "follow_request",
                "request_id": {"$in": pending_ids},
            })
            deleted_notifications = notif_result.deleted_count

    follows_after = await db.follows.count_documents({})
    if follows_after < follows_count:
        deleted_follows = follows_count - follows_after

    client.close()

    return {
        "dry_run": not apply,
        "pending_found": pending_count,
        "pending_deleted": deleted_requests if apply else 0,
        "obsolete_notifications_found": obsolete_notif_count,
        "obsolete_notifications_deleted": deleted_notifications if apply else 0,
        "accepted_preserved": accepted_count,
        "follows_preserved": follows_after,
        "relations_deleted": deleted_follows,
    }


def _print_report(report: Dict[str, Any]) -> None:
    mode = "DRY-RUN" if report["dry_run"] else "APPLY"
    print(f"=== Reset pending follow requests ({mode}) ===")
    print(f"Pending requests trouvées     : {report['pending_found']}")
    print(f"Pending requests supprimées   : {report['pending_deleted']}")
    print(f"Notifications obsolètes trouvées : {report['obsolete_notifications_found']}")
    print(f"Notifications obsolètes supprimées : {report['obsolete_notifications_deleted']}")
    print(f"Demandes acceptées conservées : {report['accepted_preserved']}")
    print(f"Relations follows conservées  : {report['follows_preserved']}")
    print(f"Relations existantes supprimées : {report['relations_deleted']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset pending follow requests")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Simuler sans modifier la base")
    group.add_argument("--apply", action="store_true", help="Appliquer les suppressions")
    args = parser.parse_args()

    report = asyncio.run(reset_pending_follow_requests(apply=args.apply))
    _print_report(report)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import idempotent du catalogue d'exercices.

Usage:
  python import_exercises.py --dry-run
  python import_exercises.py --apply
  python import_exercises.py --apply --refresh-existing
  python import_exercises.py --report
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data" / "exercises"
COVERAGE_PATH = DATA_DIR / "coverage_report.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_report_skeleton(provider_name: str) -> Dict[str, Any]:
    return {
        "provider": provider_name,
        "generated_at": _now(),
        "pages_fetched": 0,
        "received": 0,
        "valid": 0,
        "with_gif": 0,
        "without_gif": 0,
        "new": 0,
        "updated": 0,
        "duplicates_skipped": 0,
        "errors": [],
        "by_equipment": {},
        "by_category": {},
        "by_sport": {},
        "by_body_part": {},
        "by_muscle": {},
        "machines": {},
        "dry_run": True,
    }


def coverage_from_docs(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_sport: Counter = Counter()
    by_equipment: Counter = Counter()
    by_body: Counter = Counter()
    by_muscle: Counter = Counter()
    by_category: Counter = Counter()
    machines: Counter = Counter()
    with_gif = 0
    without_gif = 0
    for doc in docs:
        media = doc.get("media") or {}
        if media.get("status") == "available" and media.get("url"):
            with_gif += 1
        else:
            without_gif += 1
        by_sport[doc.get("sport") or "other"] += 1
        by_category[doc.get("category") or "other"] += 1
        by_body[doc.get("body_part") or "other"] += 1
        for eq in doc.get("equipment") or []:
            by_equipment[eq] += 1
            if str(eq).endswith("_machine") or eq == "smith_machine":
                machines[eq] += 1
        for m in doc.get("primary_muscles") or []:
            by_muscle[m] += 1
    return {
        "total": len(docs),
        "with_gif": with_gif,
        "without_gif": without_gif,
        "by_sport": dict(by_sport),
        "by_equipment": dict(by_equipment),
        "by_body_part": dict(by_body),
        "by_muscle": dict(by_muscle),
        "by_category": dict(by_category),
        "machines": dict(machines),
    }


def collect_normalized(provider, report: Dict[str, Any]) -> List[Dict[str, Any]]:
    from exercises.taxonomy import fold_text

    docs: List[Dict[str, Any]] = []
    seen_provider_ids = set()
    seen_name_equip: set = set()
    for page in provider.fetch_pages():
        report["pages_fetched"] = getattr(provider, "pages_fetched", report["pages_fetched"] + 1)
        for raw in page:
            report["received"] += 1
            try:
                doc = provider.normalize(raw)
            except Exception as exc:  # noqa: BLE001
                report["errors"].append(str(exc))
                continue
            if not doc.get("id") or not (doc.get("name") or {}).get("en"):
                report["errors"].append("invalid normalized exercise")
                continue
            pid = (doc.get("provider"), doc.get("provider_id"))
            if pid in seen_provider_ids:
                report["duplicates_skipped"] += 1
                continue
            seen_provider_ids.add(pid)
            # Doublon évident nom+équipement
            key = (
                fold_text((doc.get("name") or {}).get("en") or ""),
                tuple(doc.get("equipment") or []),
            )
            if key in seen_name_equip:
                report["duplicates_skipped"] += 1
                continue
            seen_name_equip.add(key)
            media = doc.get("media") or {}
            if media.get("url") and media.get("status") == "available":
                report["with_gif"] += 1
            else:
                report["without_gif"] += 1
            report["valid"] += 1
            docs.append(doc)
    report["pages_fetched"] = getattr(provider, "pages_fetched", report["pages_fetched"])
    if getattr(provider, "errors", None):
        report["errors"].extend(list(provider.errors))
    return docs


def upsert_docs(db, docs: List[Dict[str, Any]], *, refresh_existing: bool, dry_run: bool) -> Tuple[int, int]:
    from exercises.catalog import CATALOG_COLLECTION, build_search_text

    col = db[CATALOG_COLLECTION]
    new_count = 0
    updated_count = 0
    for doc in docs:
        existing = col.find_one({"provider": doc["provider"], "provider_id": doc["provider_id"]})
        if existing:
            if not refresh_existing:
                # Conserve l'id stable ; ne compte pas comme update si identique
                continue
            keep_id = existing.get("id") or doc["id"]
            update = {**doc, "id": keep_id, "created_at": existing.get("created_at") or doc["created_at"]}
            update["updated_at"] = _now()
            update["search_text"] = build_search_text(update)
            if dry_run:
                updated_count += 1
                continue
            col.update_one({"_id": existing["_id"]}, {"$set": update})
            updated_count += 1
        else:
            new_count += 1
            if dry_run:
                continue
            # Upsert par id aussi
            conflict = col.find_one({"id": doc["id"]})
            if conflict:
                doc["id"] = f"{doc['id']}_{doc['provider_id']}"
            doc["search_text"] = build_search_text(doc)
            col.update_one(
                {"provider": doc["provider"], "provider_id": doc["provider_id"]},
                {"$set": doc},
                upsert=True,
            )
    return new_count, updated_count


def get_sync_db():
    from pymongo import MongoClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise RuntimeError("MONGO_URL and DB_NAME are required for --apply/--report against DB")
    client = MongoClient(mongo_url)
    return client, client[db_name]


def write_coverage(docs: List[Dict[str, Any]], report: Dict[str, Any], *, dry_run: bool) -> Dict[str, Any]:
    coverage = coverage_from_docs(docs)
    coverage["import_report"] = {
        "provider": report["provider"],
        "pages_fetched": report["pages_fetched"],
        "received": report["received"],
        "valid": report["valid"],
        "with_gif": report["with_gif"],
        "without_gif": report["without_gif"],
        "new": report["new"],
        "updated": report["updated"],
        "duplicates_skipped": report["duplicates_skipped"],
        "errors": report["errors"][:50],
        "dry_run": dry_run,
        "generated_at": _now(),
    }
    if not dry_run:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        COVERAGE_PATH.write_text(json.dumps(coverage, indent=2, ensure_ascii=False), encoding="utf-8")
    return coverage


def print_human_report(report: Dict[str, Any], coverage: Optional[Dict[str, Any]] = None) -> None:
    print("=== Exercise import report ===")
    print(f"Provider: {report.get('provider')}")
    print(f"Pages: {report.get('pages_fetched')}")
    print(f"Received: {report.get('received')}")
    print(f"Valid: {report.get('valid')}")
    print(f"With GIF: {report.get('with_gif')}")
    print(f"Without GIF: {report.get('without_gif')}")
    print(f"New: {report.get('new')}")
    print(f"Updated: {report.get('updated')}")
    print(f"Duplicates skipped: {report.get('duplicates_skipped')}")
    print(f"Errors: {len(report.get('errors') or [])}")
    if coverage:
        print(f"by_sport: {coverage.get('by_sport')}")
        print(f"by_equipment (top): {dict(list((coverage.get('by_equipment') or {}).items())[:12])}")
        print(f"machines: {coverage.get('machines')}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Import Anthea exercise catalog")
    parser.add_argument("--dry-run", action="store_true", help="No DB / disk / media writes")
    parser.add_argument("--apply", action="store_true", help="Upsert into MongoDB")
    parser.add_argument("--refresh-existing", action="store_true", help="Update existing catalog rows")
    parser.add_argument("--report", action="store_true", help="Print coverage from DB or last file")
    parser.add_argument("--provider", default=None, help="exercisedb | free_exercise_db")
    parser.add_argument("--fixture", default=None, help="Optional local JSON fixture")
    args = parser.parse_args(argv)

    if not args.dry_run and not args.apply and not args.report:
        args.dry_run = True

    # Report-only from DB/file
    if args.report and not args.apply and not args.dry_run:
        if COVERAGE_PATH.exists():
            coverage = json.loads(COVERAGE_PATH.read_text(encoding="utf-8"))
            print(json.dumps(coverage, indent=2, ensure_ascii=False))
            return 0
        client, db = get_sync_db()
        try:
            from exercises.catalog import CATALOG_COLLECTION

            docs = list(db[CATALOG_COLLECTION].find({"enabled": True}))
            coverage = coverage_from_docs(docs)
            print(json.dumps(coverage, indent=2, ensure_ascii=False))
            return 0
        finally:
            client.close()

    from exercises.providers import get_provider

    provider_kwargs = {}
    if args.fixture:
        provider_kwargs["fixture_path"] = args.fixture
    provider = get_provider(args.provider, **provider_kwargs)
    report = build_report_skeleton(provider.name)
    report["dry_run"] = bool(args.dry_run and not args.apply)

    docs = collect_normalized(provider, report)
    coverage_preview = coverage_from_docs(docs)
    report["by_equipment"] = coverage_preview["by_equipment"]
    report["by_category"] = coverage_preview["by_category"]
    report["by_sport"] = coverage_preview["by_sport"]

    if args.apply:
        client, db = get_sync_db()
        try:
            # Indexes sync via pymongo
            col = db["exercise_catalog"]
            col.create_index("id", unique=True)
            col.create_index([("provider", 1), ("provider_id", 1)], unique=True)
            col.create_index("enabled")
            col.create_index("sport")
            col.create_index("category")
            col.create_index("equipment")
            col.create_index("primary_muscles")
            col.create_index("body_part")
            col.create_index("search_text")
            new_count, updated_count = upsert_docs(
                db, docs, refresh_existing=args.refresh_existing, dry_run=False
            )
            report["new"] = new_count
            report["updated"] = updated_count
            report["dry_run"] = False
            coverage = write_coverage(docs, report, dry_run=False)
        finally:
            client.close()
    else:
        # dry-run : estimer new/updated sans écrire
        report["new"] = report["valid"]
        report["updated"] = 0
        try:
            client, db = get_sync_db()
            try:
                existing = {
                    (d.get("provider"), d.get("provider_id"))
                    for d in db["exercise_catalog"].find({}, {"provider": 1, "provider_id": 1})
                }
                report["new"] = sum(
                    1 for d in docs if (d.get("provider"), d.get("provider_id")) not in existing
                )
                report["updated"] = 0
            finally:
                client.close()
        except Exception:
            pass
        coverage = write_coverage(docs, report, dry_run=True)

    print_human_report(report, coverage_preview)
    # Toujours afficher un JSON résumé stdout
    print(json.dumps({"report": report, "coverage_total": coverage_preview.get("total")}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

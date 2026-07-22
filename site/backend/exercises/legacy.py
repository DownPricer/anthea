"""Compatibilité séances legacy + exercices personnalisés historiques."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .catalog import CATALOG_COLLECTION
from .taxonomy import fold_text


async def upsert_legacy_mapping(db, legacy_id: str, catalog_id: str) -> None:
    if not legacy_id or not catalog_id:
        return
    await db.exercise_legacy_map.update_one(
        {"legacy_id": str(legacy_id)},
        {"$set": {"legacy_id": str(legacy_id), "catalog_id": str(catalog_id)}},
        upsert=True,
    )


async def build_legacy_map_from_system_exercises(db, *, limit: int = 5000) -> Dict[str, Any]:
    """
    Crée des mappings explicites legacy_id -> catalog_id quand le nom
    correspond exactement (fold) à un exercice catalogue.

    Ne convertit JAMAIS un exercice personnalisé automatiquement.
    """
    catalog = await db[CATALOG_COLLECTION].find({"enabled": True}, {"id": 1, "name": 1, "search_text": 1}).to_list(
        limit
    )
    by_name: Dict[str, str] = {}
    for doc in catalog:
        name = ((doc.get("name") or {}).get("en") or "").strip()
        if name:
            by_name[fold_text(name)] = doc["id"]

    system_ex = await db.exercises.find({"is_system": True}).to_list(limit)
    mapped = 0
    skipped = 0
    for ex in system_ex:
        legacy_id = str(ex.get("_id"))
        name = fold_text(ex.get("name") or "")
        catalog_id = by_name.get(name)
        if not catalog_id:
            skipped += 1
            continue
        await upsert_legacy_mapping(db, legacy_id, catalog_id)
        mapped += 1
    return {"mapped": mapped, "skipped": skipped, "system_total": len(system_ex)}


def enrich_workout_exercise_snapshot(exercise: Dict[str, Any]) -> Dict[str, Any]:
    """Assure la présence des champs snapshot sans écraser l'existant."""
    out = dict(exercise or {})
    out.setdefault("exercise_name_snapshot", out.get("name"))
    out.setdefault("media_snapshot", out.get("image_url"))
    out.setdefault(
        "tracking_type_snapshot",
        out.get("tracking_type_snapshot")
        or ("duration" if out.get("exercise_type") == "duration" else "reps_weight"),
    )
    return out


def is_custom_exercise_doc(doc: Optional[Dict[str, Any]]) -> bool:
    if not doc:
        return False
    return not bool(doc.get("is_system")) and bool(doc.get("user_id"))

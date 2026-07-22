"""Résolution de références exercices (catalogue, legacy, custom, snapshot)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from bson import ObjectId
from bson.errors import InvalidId

from .catalog import CATALOG_COLLECTION, catalog_to_legacy_response, localized_text


async def resolve_exercise_reference(
    db,
    exercise_reference: Any,
    *,
    locale: str = "fr",
    snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ordre :
    1. ID canonique catalogue
    2. Correspondance legacy explicite (legacy_id_map)
    3. Exercice personnalisé / collection exercises historique
    4. Snapshot enregistré dans la séance
    5. Fallback « Exercice indisponible »
    """
    ref = exercise_reference
    ref_id = None
    if isinstance(ref, dict):
        ref_id = ref.get("exercise_id") or ref.get("id")
        snapshot = snapshot or ref
    else:
        ref_id = ref

    ref_id = str(ref_id).strip() if ref_id is not None else ""

    # 1. Catalogue canonique
    if ref_id:
        doc = await db[CATALOG_COLLECTION].find_one({"id": ref_id})
        if doc:
            item = catalog_to_legacy_response(doc, locale=locale)
            item["resolve_source"] = "catalog"
            item["enabled"] = bool(doc.get("enabled", True))
            return item

    # 2. Legacy map explicite
    if ref_id:
        mapped = await db.exercise_legacy_map.find_one({"legacy_id": ref_id})
        if mapped and mapped.get("catalog_id"):
            doc = await db[CATALOG_COLLECTION].find_one({"id": mapped["catalog_id"]})
            if doc:
                item = catalog_to_legacy_response(doc, locale=locale)
                item["resolve_source"] = "legacy_map"
                return item

    # 3. Collection exercises historique (system + custom)
    if ref_id:
        legacy = None
        try:
            legacy = await db.exercises.find_one({"_id": ObjectId(ref_id)})
        except (InvalidId, TypeError):
            legacy = await db.exercises.find_one({"id": ref_id})
        if legacy:
            is_custom = not legacy.get("is_system", False)
            name = legacy.get("name") or ("Exercice personnalisé" if is_custom else "Exercice")
            return {
                "id": str(legacy.get("_id") or legacy.get("id") or ref_id),
                "name": name,
                "description": legacy.get("description"),
                "category": legacy.get("category") or "general",
                "exercise_type": legacy.get("exercise_type") or "reps",
                "default_duration": legacy.get("default_duration"),
                "default_reps": legacy.get("default_reps"),
                "default_rest": legacy.get("default_rest") or 30,
                "image_url": legacy.get("image_url"),
                "is_system": bool(legacy.get("is_system")),
                "user_id": legacy.get("user_id"),
                "resolve_source": "custom" if is_custom else "legacy_exercises",
                "legacy_label": "Exercice personnalisé" if is_custom else None,
                "enabled": True,
            }

    # 4. Snapshot séance
    if snapshot and isinstance(snapshot, dict):
        name = (
            snapshot.get("exercise_name_snapshot")
            or snapshot.get("name")
            or localized_text(snapshot.get("name"), locale)
        )
        if name:
            return {
                "id": ref_id or snapshot.get("exercise_id") or "unknown",
                "name": name,
                "description": snapshot.get("description"),
                "category": snapshot.get("category") or "general",
                "exercise_type": snapshot.get("exercise_type")
                or (
                    "duration"
                    if (snapshot.get("tracking_type_snapshot") or "").startswith("duration")
                    else "reps"
                ),
                "default_duration": snapshot.get("duration"),
                "default_reps": snapshot.get("reps"),
                "default_rest": snapshot.get("rest_after") or 30,
                "image_url": snapshot.get("media_snapshot") or snapshot.get("image_url"),
                "is_system": False,
                "resolve_source": "snapshot",
                "enabled": False,
            }

    # 5. Fallback
    return {
        "id": ref_id or "unavailable",
        "name": "Exercice indisponible",
        "description": None,
        "category": "general",
        "exercise_type": "reps",
        "default_duration": None,
        "default_reps": 10,
        "default_rest": 30,
        "image_url": None,
        "is_system": False,
        "resolve_source": "unavailable",
        "enabled": False,
    }

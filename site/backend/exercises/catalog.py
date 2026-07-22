"""Helpers catalogue MongoDB + projection legacy API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .taxonomy import fold_text, tracking_to_exercise_type

CATALOG_COLLECTION = "exercise_catalog"


async def ensure_catalog_indexes(db) -> None:
    col = db[CATALOG_COLLECTION]
    await col.create_index("id", unique=True)
    await col.create_index([("provider", 1), ("provider_id", 1)], unique=True)
    await col.create_index("enabled")
    await col.create_index("sport")
    await col.create_index("category")
    await col.create_index("equipment")
    await col.create_index("primary_muscles")
    await col.create_index("body_part")
    await col.create_index("search_text")
    await col.create_index([("enabled", 1), ("search_text", 1)])
    await col.create_index([("enabled", 1), ("sport", 1), ("category", 1)])


def build_search_text(doc: Dict[str, Any]) -> str:
    parts: List[str] = []
    name = doc.get("name") or {}
    if isinstance(name, dict):
        parts.extend([str(v) for v in name.values() if v])
    else:
        parts.append(str(name))
    desc = doc.get("short_description") or {}
    if isinstance(desc, dict):
        parts.extend([str(v) for v in desc.values() if v])
    parts.extend(doc.get("aliases") or [])
    parts.extend(doc.get("equipment") or [])
    parts.extend(doc.get("primary_muscles") or [])
    parts.extend(doc.get("secondary_muscles") or [])
    parts.append(doc.get("category") or "")
    parts.append(doc.get("sport") or "")
    parts.append(doc.get("equipment_raw") or "")
    return fold_text(" ".join(parts))


def localized_text(value: Any, locale: str = "fr") -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return str(value)
    lang = (locale or "fr").split("-")[0].lower()
    for key in (lang, "en", "fr", "es"):
        text = value.get(key)
        if text:
            return text
    for text in value.values():
        if text:
            return str(text)
    return None


def catalog_to_legacy_response(doc: Dict[str, Any], locale: str = "fr") -> Dict[str, Any]:
    """Projection compatible CreateWorkoutPage / Player existants."""
    tracking = doc.get("tracking_type") or "reps_weight"
    exercise_type = tracking_to_exercise_type(tracking)
    media = doc.get("media") or {}
    name = localized_text(doc.get("name"), locale) or doc.get("id") or "Exercise"
    description = localized_text(doc.get("short_description"), locale)
    equipment = doc.get("equipment") or []
    muscles = doc.get("primary_muscles") or []
    secondary_bits = []
    if equipment:
        secondary_bits.append(", ".join(equipment[:2]))
    if muscles:
        secondary_bits.append(", ".join(muscles[:2]))
    return {
        "id": doc.get("id"),
        "name": name,
        "description": description,
        "category": doc.get("category") or "general",
        "exercise_type": exercise_type,
        "tracking_type": tracking,
        "default_duration": 30 if exercise_type == "duration" else None,
        "default_reps": 10 if exercise_type == "reps" else None,
        "default_rest": 30,
        "image_url": media.get("url") or media.get("thumbnail_url"),
        "thumbnail_url": media.get("thumbnail_url") or media.get("url"),
        "is_system": True,
        "user_id": None,
        "provider": doc.get("provider"),
        "sport": doc.get("sport"),
        "equipment": equipment,
        "primary_muscles": muscles,
        "body_part": doc.get("body_part"),
        "media_status": (media.get("status") or "missing"),
        "secondary_label": " · ".join(secondary_bits) if secondary_bits else None,
        "translation_status": doc.get("translation_status") or "source_only",
        "created_at": doc.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "source_kind": "catalog",
    }


def workout_snapshot_from_catalog(doc: Dict[str, Any], locale: str = "fr") -> Dict[str, Any]:
    legacy = catalog_to_legacy_response(doc, locale)
    media = doc.get("media") or {}
    return {
        "exercise_id": legacy["id"],
        "exercise_name_snapshot": legacy["name"],
        "media_snapshot": media.get("url"),
        "tracking_type_snapshot": doc.get("tracking_type") or "reps_weight",
        "name": legacy["name"],
        "description": legacy.get("description"),
        "exercise_type": legacy["exercise_type"],
        "image_url": legacy.get("image_url"),
    }

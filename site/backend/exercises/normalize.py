"""Normalisation générique + descriptions neutres."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .catalog import build_search_text
from .taxonomy import (
    fold_text,
    infer_category,
    infer_sport,
    infer_tracking_type,
    normalize_body_part,
    normalize_equipment_list,
    normalize_muscle,
    slugify,
)


def stable_catalog_id(provider: str, provider_id: str, name_en: Optional[str] = None) -> str:
    """ID stable non traduit : exdb_<provider_id> (fallback slug)."""
    import re

    pid = str(provider_id or "").strip()
    if pid:
        # Conserve la casse du provider_id (les IDs ExerciseDB sont case-sensitive)
        safe = re.sub(r"[^A-Za-z0-9_-]+", "_", pid).strip("_")
        prefix = {
            "exercisedb": "exdb",
            "wger": "wger",
            "free_exercise_db": "fedb",
        }.get(provider, slugify(provider)[:8] or "prov")
        return f"{prefix}_{safe}"
    return slugify(name_en or "exercise")


def neutral_short_description(
    *,
    name: str,
    sport: str,
    category: str,
    equipment: List[str],
    primary_muscles: List[str],
) -> str:
    """1–2 phrases neutres à partir des champs structurés (pas de conseil médical)."""
    move = {
        "strength": "strength exercise",
        "bodyweight": "bodyweight exercise",
        "cardio": "cardio exercise",
        "mobility": "mobility drill",
        "stretching": "stretching exercise",
        "yoga": "yoga pose",
        "pilates": "Pilates exercise",
        "running": "running drill",
        "cycling": "cycling drill",
        "swimming": "swimming drill",
    }.get(sport, "exercise")
    equip_txt = ", ".join(equipment[:2]) if equipment else "minimal equipment"
    muscle_txt = ", ".join(primary_muscles[:2]) if primary_muscles else category or "multiple muscle groups"
    return (
        f"A {move} typically performed with {equip_txt}, "
        f"primarily targeting the {muscle_txt}."
    )


def build_canonical_document(
    *,
    provider: str,
    provider_id: str,
    name_en: str,
    short_description_en: Optional[str] = None,
    sport: str,
    category: str,
    body_part: str,
    equipment: List[str],
    equipment_raw: str = "",
    primary_muscles: List[str],
    secondary_muscles: List[str],
    aliases: Optional[List[str]] = None,
    tracking_type: str = "reps_weight",
    media_url: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
    license_name: str = "",
    attribution: str = "",
    original_url: str = "",
    name_fr: Optional[str] = None,
    name_es: Optional[str] = None,
    description_fr: Optional[str] = None,
    description_es: Optional[str] = None,
    category_raw: Optional[str] = None,
    body_part_raw: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    catalog_id = stable_catalog_id(provider, provider_id, name_en)
    desc_en = short_description_en or neutral_short_description(
        name=name_en,
        sport=sport,
        category=category,
        equipment=equipment,
        primary_muscles=primary_muscles,
    )
    translation_status = "source_only"
    if name_fr or name_es or description_fr or description_es:
        if name_fr and name_es and description_fr and description_es:
            translation_status = "complete"
        else:
            translation_status = "partial"

    media_status = "available" if media_url else "missing"
    now = datetime.now(timezone.utc).isoformat()
    doc: Dict[str, Any] = {
        "id": catalog_id,
        "provider": provider,
        "provider_id": str(provider_id),
        "name": {"en": name_en, "fr": name_fr, "es": name_es},
        "short_description": {
            "en": desc_en,
            "fr": description_fr,
            "es": description_es,
        },
        "sport": sport,
        "category": category,
        "body_part": body_part,
        "equipment": equipment,
        "equipment_raw": equipment_raw,
        "primary_muscles": primary_muscles,
        "secondary_muscles": secondary_muscles,
        "aliases": aliases or [],
        "tracking_type": tracking_type,
        "activity_tracking_mode": "standard",
        "activity_kind": "other",
        "media": {
            "type": "gif" if media_url and str(media_url).lower().endswith(".gif") else ("image" if media_url else None),
            "url": media_url,
            "thumbnail_url": thumbnail_url or media_url,
            "status": media_status,
        },
        "source": {
            "license": license_name,
            "attribution": attribution,
            "original_url": original_url,
        },
        "category_raw": category_raw,
        "body_part_raw": body_part_raw,
        "enabled": True,
        "review_status": "imported",
        "translation_status": translation_status,
        "created_at": now,
        "updated_at": now,
    }
    if extra:
        doc.update(extra)
    doc["search_text"] = build_search_text(doc)
    return doc


def normalize_from_structured(
    *,
    provider: str,
    provider_id: str,
    name: str,
    equipment_raw_list: List[str],
    primary_muscles_raw: List[str],
    secondary_muscles_raw: List[str],
    body_parts_raw: List[str],
    media_url: Optional[str],
    thumbnail_url: Optional[str] = None,
    instructions: Optional[List[str]] = None,
    license_name: str = "",
    attribution: str = "",
    original_url: str = "",
) -> Dict[str, Any]:
    equipment, equipment_raw = normalize_equipment_list(equipment_raw_list, name=name)
    primary = [normalize_muscle(m) for m in primary_muscles_raw or []]
    primary = list(dict.fromkeys([m for m in primary if m]))
    secondary = [normalize_muscle(m) for m in secondary_muscles_raw or []]
    secondary = list(dict.fromkeys([m for m in secondary if m and m not in primary]))
    body_part = normalize_body_part((body_parts_raw or ["other"])[0])
    sport = infer_sport(name=name, equipment=equipment, body_parts_raw=body_parts_raw)
    category = infer_category(primary, body_parts_raw)
    tracking = infer_tracking_type(name=name, sport=sport, equipment=equipment)
    aliases = []
    folded = fold_text(name)
    if folded and folded != name.lower():
        aliases.append(folded)
    # Première instruction tronquée seulement si courte et neutre — sinon description structurée
    short = None
    if instructions:
        first = str(instructions[0]).strip()
        first = first.replace("Step:1 ", "").replace("Step 1:", "").strip()
        if 20 <= len(first) <= 180 and not any(
            bad in first.lower() for bad in ("heal", "cure", "diagnos", "medical", "injury")
        ):
            short = first
    return build_canonical_document(
        provider=provider,
        provider_id=provider_id,
        name_en=name.strip(),
        short_description_en=short,
        sport=sport,
        category=category,
        body_part=body_part,
        equipment=equipment,
        equipment_raw=equipment_raw,
        primary_muscles=primary,
        secondary_muscles=secondary,
        aliases=aliases,
        tracking_type=tracking,
        media_url=media_url,
        thumbnail_url=thumbnail_url,
        license_name=license_name,
        attribution=attribution,
        original_url=original_url,
        category_raw=", ".join(body_parts_raw or []),
        body_part_raw=", ".join(body_parts_raw or []),
    )

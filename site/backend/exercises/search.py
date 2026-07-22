"""Recherche paginée sur exercise_catalog (texte normalisé + filtres)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from .catalog import CATALOG_COLLECTION, catalog_to_legacy_response
from .media_proxy import resolve_media_for_client
from .taxonomy import fold_text


def _escape_regex(value: str) -> str:
    return re.escape(value)


async def search_catalog(
    db,
    *,
    q: Optional[str] = None,
    sport: Optional[str] = None,
    category: Optional[str] = None,
    body_part: Optional[str] = None,
    muscle: Optional[str] = None,
    equipment: Optional[str] = None,
    tracking_type: Optional[str] = None,
    has_media: Optional[bool] = None,
    page: int = 1,
    limit: int = 30,
    locale: str = "fr",
    include_disabled: bool = False,
) -> Dict[str, Any]:
    page = max(1, int(page or 1))
    limit = max(1, min(int(limit or 30), 40))
    query: Dict[str, Any] = {}
    if not include_disabled:
        query["enabled"] = True

    and_clauses: List[Dict[str, Any]] = []
    if q:
        token = fold_text(q)
        if token:
            # Préfixe / containment sur search_text indexé (pas de scan regex unicode lourd)
            and_clauses.append({"search_text": {"$regex": _escape_regex(token)}})
    if sport:
        and_clauses.append({"sport": sport})
    if category:
        and_clauses.append({"category": category})
    if body_part:
        and_clauses.append({"body_part": body_part})
    if muscle:
        and_clauses.append(
            {
                "$or": [
                    {"primary_muscles": muscle},
                    {"secondary_muscles": muscle},
                    {"category": muscle},
                ]
            }
        )
    if equipment:
        if equipment in ("selectorized_machine", "plate_loaded_machine", "machine"):
            and_clauses.append(
                {
                    "equipment": {
                        "$in": [
                            "selectorized_machine",
                            "plate_loaded_machine",
                            "leg_press_machine",
                            "hack_squat_machine",
                            "chest_press_machine",
                            "shoulder_press_machine",
                            "lat_pulldown_machine",
                            "seated_row_machine",
                            "leg_extension_machine",
                            "leg_curl_machine",
                            "adductor_machine",
                            "abductor_machine",
                            "calf_raise_machine",
                            "pec_deck_machine",
                            "reverse_fly_machine",
                            "assisted_dip_machine",
                            "assisted_pullup_machine",
                            "smith_machine",
                        ]
                    }
                }
            )
        else:
            and_clauses.append({"equipment": equipment})
    if tracking_type:
        and_clauses.append({"tracking_type": tracking_type})
    if has_media is True:
        and_clauses.append({"media.status": "available"})
    elif has_media is False:
        and_clauses.append({"media.status": {"$ne": "available"}})

    if and_clauses:
        query["$and"] = and_clauses

    col = db[CATALOG_COLLECTION]
    total = await col.count_documents(query)
    skip = (page - 1) * limit
    cursor = col.find(query).sort([("name.en", 1), ("id", 1)]).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)
    items = []
    for doc in docs:
        item = catalog_to_legacy_response(doc, locale=locale)
        media_url = (doc.get("media") or {}).get("url")
        resolved = resolve_media_for_client(media_url, doc.get("id"))
        if resolved:
            item["image_url"] = resolved
        items.append(item)
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": skip + len(items) < total,
    }


async def catalog_facets(db) -> Dict[str, Any]:
    col = db[CATALOG_COLLECTION]
    match = {"enabled": True}

    async def _distinct(field: str) -> List[str]:
        values = await col.distinct(field, match)
        return sorted([v for v in values if v])

    return {
        "sports": await _distinct("sport"),
        "categories": await _distinct("category"),
        "equipment": await _distinct("equipment"),
        "body_parts": await _distinct("body_part"),
        "muscles": await _distinct("primary_muscles"),
        "tracking_types": await _distinct("tracking_type"),
    }

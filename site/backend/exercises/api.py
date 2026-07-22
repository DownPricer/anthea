"""Handlers API catalogue d'exercices (branchés depuis server.py)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from .catalog import CATALOG_COLLECTION, catalog_to_legacy_response, ensure_catalog_indexes
from .media_proxy import (
    get_or_fetch_cached_media,
    is_allowed_media_url,
    media_mode,
    resolve_media_for_client,
)
from .resolve import resolve_exercise_reference
from .search import catalog_facets, search_catalog

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "exercises"
LEGACY_MAP_PATH = DATA_DIR / "legacy_id_map.json"


def custom_creation_enabled() -> bool:
    return (os.environ.get("EXERCISE_CUSTOM_CREATION_ENABLED") or "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


async def bootstrap_exercise_catalog(db) -> None:
    await ensure_catalog_indexes(db)
    await db.exercise_legacy_map.create_index("legacy_id", unique=True)
    if LEGACY_MAP_PATH.exists():
        try:
            raw = json.loads(LEGACY_MAP_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for legacy_id, catalog_id in raw.items():
                    if not legacy_id or not catalog_id:
                        continue
                    await db.exercise_legacy_map.update_one(
                        {"legacy_id": str(legacy_id)},
                        {"$set": {"legacy_id": str(legacy_id), "catalog_id": str(catalog_id)}},
                        upsert=True,
                    )
        except Exception:
            pass


def _parse_bool(value: Optional[str]) -> Optional[bool]:
    if value is None or value == "":
        return None
    return str(value).strip().lower() in ("1", "true", "yes", "on")


async def list_exercises_handler(
    db,
    user: dict,
    *,
    q: Optional[str] = None,
    sport: Optional[str] = None,
    category: Optional[str] = None,
    body_part: Optional[str] = None,
    muscle: Optional[str] = None,
    equipment: Optional[str] = None,
    tracking_type: Optional[str] = None,
    has_media: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    locale: Optional[str] = None,
):
    locale = locale or "fr"
    catalog_total = await db[CATALOG_COLLECTION].count_documents({"enabled": True})

    # Fallback : ancienne collection si catalogue vide
    if catalog_total == 0:
        exercises = await db.exercises.find(
            {"$or": [{"is_system": True}, {"user_id": user["id"]}]}
        ).to_list(1000)
        items = [{"id": str(e["_id"]), **{k: v for k, v in e.items() if k != "_id"}} for e in exercises]
        if q:
            token = q.lower()
            items = [
                e
                for e in items
                if token in (e.get("name") or "").lower() or token in (e.get("category") or "").lower()
            ]
        total = len(items)
        page = max(1, int(page or 1))
        limit = max(1, min(int(limit or 10), 40))
        start = (page - 1) * limit
        slice_items = items[start : start + limit]
        return {
            "items": slice_items,
            "page": page,
            "limit": limit,
            "total": total,
            "has_more": start + len(slice_items) < total,
            "catalog_ready": False,
            "custom_creation_enabled": custom_creation_enabled(),
        }

    result = await search_catalog(
        db,
        q=q,
        sport=sport,
        category=category,
        body_part=body_part,
        muscle=muscle,
        equipment=equipment,
        tracking_type=tracking_type,
        has_media=_parse_bool(has_media),
        page=page,
        limit=limit,
        locale=locale,
    )

    # Exercices personnalisés historiques (toujours disponibles)
    customs = await db.exercises.find({"user_id": user["id"], "is_system": False}).to_list(200)
    custom_items = []
    token = (q or "").strip().lower()
    for e in customs:
        item = {"id": str(e["_id"]), **{k: v for k, v in e.items() if k != "_id"}}
        item["source_kind"] = "custom"
        item["legacy_label"] = "Exercice personnalisé"
        if token and token not in (item.get("name") or "").lower() and token not in (item.get("category") or "").lower():
            continue
        custom_items.append(item)

    page_n = max(1, int(page or 1))
    limit_n = max(1, min(int(limit or 10), 40))
    if page_n == 1 and custom_items:
        # Préfixer sans dépasser la taille du lot demandé
        merged = custom_items + result["items"]
        result["items"] = merged[:limit_n]
        result["total"] = result["total"] + len(custom_items)
        result["has_more"] = result["has_more"] or len(merged) > limit_n
        result["limit"] = limit_n

    result["catalog_ready"] = True
    result["custom_creation_enabled"] = custom_creation_enabled()
    return result


async def get_exercise_handler(db, exercise_id: str, user: dict, locale: Optional[str] = None):
    resolved = await resolve_exercise_reference(db, exercise_id, locale=locale or "fr")
    if resolved.get("resolve_source") == "unavailable":
        raise HTTPException(status_code=404, detail="Exercise not found")
    # Désactivé : visible pour historique / détail si demandé explicitement
    return resolved


async def facets_handler(db, user: dict):
    catalog_total = await db[CATALOG_COLLECTION].count_documents({"enabled": True})
    if catalog_total == 0:
        return {
            "sports": [],
            "categories": [],
            "equipment": [],
            "body_parts": [],
            "muscles": [],
            "tracking_types": [],
            "catalog_ready": False,
        }
    facets = await catalog_facets(db)
    facets["catalog_ready"] = True
    return facets


async def media_handler(db, exercise_id: str, user: dict):
    """
    Mode remote : redirection 302 vers l'URL CDN allowlistée (pas de téléchargement).
    Modes proxy_cache/download : streaming depuis cache/fournisseur.
    """
    from fastapi.responses import RedirectResponse

    doc = await db[CATALOG_COLLECTION].find_one({"id": exercise_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Exercise not found")
    url = (doc.get("media") or {}).get("url")
    if not url or not is_allowed_media_url(url):
        raise HTTPException(status_code=404, detail="Media unavailable")

    if media_mode() == "remote":
        return RedirectResponse(url=url, status_code=302)

    try:
        data, content_type = get_or_fetch_cached_media(url)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Media not found")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Media host not allowed")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Media fetch failed: {exc}") from exc
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})


async def create_exercise_handler(db, data_dump: Dict[str, Any], user: dict):
    if not custom_creation_enabled():
        raise HTTPException(
            status_code=403,
            detail={
                "code": "CUSTOM_EXERCISE_CREATION_DISABLED",
                "message": "La création d'exercices personnalisés est désactivée. Utilisez le catalogue.",
            },
        )
    exercise_doc = {
        **data_dump,
        "user_id": user["id"],
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.exercises.insert_one(exercise_doc)
    exercise_doc["id"] = str(result.inserted_id)
    exercise_doc.pop("_id", None)
    exercise_doc["source_kind"] = "custom"
    return exercise_doc


async def update_exercise_handler(db, exercise_id: str, data_dump: Dict[str, Any], user: dict):
    try:
        oid = ObjectId(exercise_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Exercise not found")
    exercise = await db.exercises.find_one({"_id": oid, "user_id": user["id"]})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    update_data = {**data_dump, "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.exercises.update_one({"_id": oid}, {"$set": update_data})
    updated = await db.exercises.find_one({"_id": oid})
    return {"id": str(updated["_id"]), **{k: v for k, v in updated.items() if k != "_id"}}


async def delete_exercise_handler(db, exercise_id: str, user: dict):
    try:
        oid = ObjectId(exercise_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Exercise not found or is a system exercise")
    exercise = await db.exercises.find_one({"_id": oid, "user_id": user["id"], "is_system": False})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found or is a system exercise")
    await db.exercises.delete_one({"_id": oid})
    return {"message": "Exercise deleted"}


async def admin_set_enabled(db, exercise_id: str, enabled: bool, user: dict):
    if not user.get("is_admin") and user.get("role") not in ("admin", "coach_admin"):
        # Soft admin : réservé — si pas de rôle, 403
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db[CATALOG_COLLECTION].update_one(
        {"id": exercise_id},
        {"$set": {"enabled": bool(enabled), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return {"id": exercise_id, "enabled": bool(enabled)}

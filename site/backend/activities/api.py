"""Handlers HTTP activités FitMatch."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from fastapi import HTTPException

from . import service
from .serialize import serialize_activity_detail, serialize_activity_list_item
from .clock import refresh_timing_fields


def _http_from_service(exc: Exception) -> HTTPException:
    if isinstance(exc, service.ActivityNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, service.ActivityForbiddenError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, service.ActivityValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, service.ActivityConflictError):
        return HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "current_activity": serialize_activity_list_item(exc.current) if exc.current else None,
            },
        )
    return HTTPException(status_code=500, detail="Erreur activité")


async def start_handler(db, user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        doc = await service.start_activity(db, user["id"], payload)
        return serialize_activity_detail(doc, include_private_route=False, viewer_is_owner=True)
    except Exception as exc:
        if isinstance(
            exc,
            (
                service.ActivityConflictError,
                service.ActivityValidationError,
                service.ActivityForbiddenError,
            ),
        ):
            raise _http_from_service(exc) from exc
        raise


async def current_handler(db, user: dict) -> Dict[str, Any]:
    doc = await service.get_current_activity(db, user["id"])
    if not doc:
        return {"activity": None}
    refresh_timing_fields(doc)
    return {
        "activity": serialize_activity_detail(doc, include_private_route=False, viewer_is_owner=True)
    }


async def list_handler(db, user: dict, limit: int = 20, status: Optional[str] = None) -> Dict[str, Any]:
    items = await service.list_activities(db, user["id"], limit=limit, status=status)
    return {"activities": items}


async def get_handler(db, user: dict, activity_id: str, include_route: bool = False) -> Dict[str, Any]:
    try:
        doc = await service.require_owner(db, activity_id, user["id"])
    except Exception as exc:
        raise _http_from_service(exc) from exc
    refresh_timing_fields(doc)
    return serialize_activity_detail(
        doc, include_private_route=include_route, viewer_is_owner=True
    )


async def pause_handler(db, user: dict, activity_id: str) -> Dict[str, Any]:
    try:
        doc = await service.pause_activity(db, activity_id, user["id"])
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def resume_handler(db, user: dict, activity_id: str) -> Dict[str, Any]:
    try:
        doc = await service.resume_activity(db, activity_id, user["id"])
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def points_handler(db, user: dict, activity_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        doc = await service.add_points(db, activity_id, user["id"], payload)
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def laps_handler(db, user: dict, activity_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        doc = await service.add_laps(db, activity_id, user["id"], payload)
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def metrics_handler(db, user: dict, activity_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        doc = await service.patch_metrics(db, activity_id, user["id"], payload)
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def complete_handler(db, user: dict, activity_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        doc = await service.complete_activity(db, activity_id, user["id"], payload)
        return serialize_activity_detail(doc, include_private_route=True, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def delete_handler(db, user: dict, activity_id: str) -> Dict[str, Any]:
    try:
        await service.delete_activity(db, activity_id, user["id"])
        return {"ok": True}
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def discard_handler(db, user: dict, activity_id: str) -> Dict[str, Any]:
    try:
        doc = await service.discard_activity(db, activity_id, user["id"])
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def publish_handler(
    db,
    user: dict,
    activity_id: str,
    payload: Dict[str, Any],
    create_post_fn: Callable,
) -> Dict[str, Any]:
    try:
        result = await service.publish_activity(
            db, activity_id, user["id"], payload, create_post_fn=create_post_fn
        )
        return {
            "activity": serialize_activity_detail(result["activity"], viewer_is_owner=True),
            "post": result.get("post"),
            "post_id": result.get("post_id"),
            "idempotent": result.get("idempotent"),
        }
    except Exception as exc:
        raise _http_from_service(exc) from exc


async def delete_route_handler(db, user: dict, activity_id: str) -> Dict[str, Any]:
    try:
        doc = await service.delete_route(db, activity_id, user["id"])
        return serialize_activity_detail(doc, viewer_is_owner=True)
    except Exception as exc:
        raise _http_from_service(exc) from exc

"""Sérialisation API activités (sans points GPS en listes)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .geo import calculate_bounding_box, flatten_route_coordinates, simplify_route
from .privacy import build_shareable_route


LIST_SAFE_FIELDS = (
    "id",
    "user_id",
    "exercise_id",
    "exercise_name_snapshot",
    "exercise_name_i18n_snapshot",
    "activity_kind",
    "tracking_mode",
    "status",
    "started_at",
    "ended_at",
    "paused_at",
    "elapsed_seconds",
    "moving_seconds",
    "paused_seconds",
    "distance_meters",
    "laps",
    "pool_length_meters",
    "average_speed_kmh",
    "average_pace_seconds_per_km",
    "average_pace_seconds_per_100m",
    "elevation_gain_meters",
    "interval_config",
    "interval_results",
    "route_point_count",
    "route_privacy",
    "visibility",
    "published_post_id",
    "route_deleted",
    "created_at",
    "updated_at",
)


def serialize_activity_list_item(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: doc.get(k) for k in LIST_SAFE_FIELDS}
    coords = flatten_route_coordinates(doc.get("route"))
    out["bounding_box"] = calculate_bounding_box(coords)
    # Miniature simplifiée (max ~80 points) — pas la route complète
    if coords and len(coords) >= 2 and not doc.get("route_deleted"):
        mini = simplify_route(coords, tolerance_m=25.0, max_points=80)
        out["route_preview"] = {"type": "LineString", "coordinates": mini}
    else:
        out["route_preview"] = None
    # Jamais de route brute
    out.pop("route", None)
    return out


def serialize_activity_detail(
    doc: Dict[str, Any],
    *,
    include_private_route: bool = False,
    viewer_is_owner: bool = False,
) -> Dict[str, Any]:
    out = serialize_activity_list_item(doc)
    out["best_lap_seconds"] = doc.get("best_lap_seconds")
    out["last_lap_seconds"] = doc.get("last_lap_seconds")
    out["average_lap_seconds"] = doc.get("average_lap_seconds")
    out["lap_events"] = doc.get("lap_events") or []
    out["segment_markers"] = doc.get("segment_markers") or []

    if viewer_is_owner and include_private_route and not doc.get("route_deleted"):
        out["route"] = doc.get("route")
        out["private_route_available"] = True
    else:
        out["route"] = None
        out["private_route_available"] = bool(
            viewer_is_owner and not doc.get("route_deleted") and (doc.get("route_point_count") or 0) > 0
        )

    privacy_vis = (doc.get("route_privacy") or {}).get("visibility") or "summary_only"
    shareable = build_shareable_route(doc, route_visibility=privacy_vis)
    out["shareable"] = {
        "route_visibility": shareable.get("route_visibility"),
        "has_route": shareable.get("has_route"),
        "bounding_box": shareable.get("bounding_box"),
        "simplified_route": shareable.get("simplified_route") if viewer_is_owner else None,
        "share_blocked_reason": shareable.get("share_blocked_reason"),
    }
    return out


def serialize_public_activity_route(doc: Dict[str, Any], route_visibility: str) -> Dict[str, Any]:
    """Route pour tiers selon confidentialité publiée."""
    shareable = build_shareable_route(doc, route_visibility=route_visibility)
    return {
        "activity_id": doc.get("id"),
        "route_visibility": shareable.get("route_visibility"),
        "bounding_box": shareable.get("bounding_box"),
        "simplified_route": shareable.get("simplified_route"),
        "share_blocked_reason": shareable.get("share_blocked_reason"),
        "route_point_count": shareable.get("route_point_count"),
    }

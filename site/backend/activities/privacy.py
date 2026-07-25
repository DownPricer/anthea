"""Confidentialité des parcours GPS."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .constants import DEFAULT_TRIM_METERS, ROUTE_VISIBILITIES
from .geo import (
    build_line_string,
    build_multi_line_string,
    calculate_bounding_box,
    flatten_route_coordinates,
    simplify_route,
    trim_route_by_distance,
)


def default_route_privacy() -> Dict[str, Any]:
    return {
        "visibility": "summary_only",
        "trim_start_meters": DEFAULT_TRIM_METERS,
        "trim_end_meters": DEFAULT_TRIM_METERS,
    }


def build_shareable_route(
    activity: Dict[str, Any],
    *,
    route_visibility: str,
    private_route: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Produit la version partageable (sans points bruts si summary_only).
    Ne journalise jamais les coordonnées.
    """
    vis = route_visibility if route_visibility in ROUTE_VISIBILITIES else "summary_only"
    route = private_route or activity.get("route") or {"type": "LineString", "coordinates": []}
    coords = flatten_route_coordinates(route)
    bbox = calculate_bounding_box(coords)
    point_count = int(activity.get("route_point_count") or len(coords))

    base = {
        "route_visibility": vis,
        "route_point_count": point_count,
        "bounding_box": bbox,
        "has_route": len(coords) >= 2,
        "shareable_route": None,
        "simplified_route": None,
    }

    if vis in ("private", "summary_only") or not coords:
        return base

    if vis == "trimmed_route":
        privacy = activity.get("route_privacy") or default_route_privacy()
        trimmed, reason = trim_route_by_distance(
            coords,
            trim_start_meters=float(privacy.get("trim_start_meters") or DEFAULT_TRIM_METERS),
            trim_end_meters=float(privacy.get("trim_end_meters") or DEFAULT_TRIM_METERS),
        )
        if not trimmed:
            base["share_blocked_reason"] = reason
            base["route_visibility"] = "summary_only"
            return base
        simplified = simplify_route(trimmed, tolerance_m=10.0, max_points=400)
        base["shareable_route"] = build_line_string(simplified)
        base["simplified_route"] = base["shareable_route"]
        base["bounding_box"] = calculate_bounding_box(simplified)
        return base

    if vis == "full_route":
        simplified = simplify_route(coords, tolerance_m=8.0, max_points=800)
        # Conserve MultiLineString si segments
        if route.get("type") == "MultiLineString":
            segs = []
            for seg in route.get("coordinates") or []:
                segs.append(simplify_route(seg, tolerance_m=8.0, max_points=400))
            base["shareable_route"] = build_multi_line_string(segs)
        else:
            base["shareable_route"] = build_line_string(simplified)
        base["simplified_route"] = base["shareable_route"]
        return base

    return base


def activity_summary_for_post(activity: Dict[str, Any], shareable: Dict[str, Any]) -> Dict[str, Any]:
    """Snapshot léger pour le fil — jamais de points GPS bruts."""
    return {
        "activity_id": activity.get("id"),
        "activity_kind": activity.get("activity_kind"),
        "tracking_mode": activity.get("tracking_mode"),
        "exercise_name": activity.get("exercise_name_snapshot"),
        "exercise_name_i18n": activity.get("exercise_name_i18n_snapshot"),
        "elapsed_seconds": activity.get("elapsed_seconds"),
        "moving_seconds": activity.get("moving_seconds"),
        "distance_meters": activity.get("distance_meters"),
        "laps": activity.get("laps"),
        "pool_length_meters": activity.get("pool_length_meters"),
        "average_speed_kmh": activity.get("average_speed_kmh"),
        "average_pace_seconds_per_km": activity.get("average_pace_seconds_per_km"),
        "average_pace_seconds_per_100m": activity.get("average_pace_seconds_per_100m"),
        "elevation_gain_meters": activity.get("elevation_gain_meters"),
        "interval_results": activity.get("interval_results") or [],
        "route_visibility": shareable.get("route_visibility"),
        "has_route": bool(shareable.get("has_route") and shareable.get("shareable_route")),
        "bounding_box": shareable.get("bounding_box"),
        "simplified_route": shareable.get("simplified_route")
        if shareable.get("route_visibility") in ("trimmed_route", "full_route")
        else None,
        "route_point_count": shareable.get("route_point_count"),
        "started_at": activity.get("started_at"),
        "ended_at": activity.get("ended_at"),
    }


def strip_route_from_activity(activity: Dict[str, Any]) -> Dict[str, Any]:
    """Suppression irréversible des coordonnées (conserve stats)."""
    activity["route"] = {"type": "LineString", "coordinates": []}
    activity["route_point_count"] = 0
    activity["route_deleted"] = True
    activity["shareable_route"] = None
    activity["simplified_route"] = None
    privacy = activity.get("route_privacy") or default_route_privacy()
    privacy["visibility"] = "summary_only"
    activity["route_privacy"] = privacy
    return activity

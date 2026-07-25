"""Utilitaires GPS / distance / allure — coordonnées GeoJSON [lon, lat]."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .constants import GPS_MAX_ACCURACY_M, GPS_MIN_POINT_DISTANCE_M, MAX_SPEED_MPS

EARTH_RADIUS_M = 6371000.0


def _parse_ts(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, (int, float)):
        # epoch seconds or ms
        ts = float(value)
        if ts > 1e12:
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def haversine_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Distance en mètres entre deux points WGS84."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def is_valid_coordinate(longitude: float, latitude: float) -> bool:
    try:
        lon = float(longitude)
        lat = float(latitude)
    except (TypeError, ValueError):
        return False
    return -180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0


def max_speed_for_kind(activity_kind: Optional[str]) -> float:
    kind = (activity_kind or "default").lower()
    if kind in MAX_SPEED_MPS:
        return MAX_SPEED_MPS[kind]
    if kind in ("track", "shuttle", "hiit", "jump_rope"):
        return MAX_SPEED_MPS["running"]
    return MAX_SPEED_MPS["default"]


def is_valid_gps_point(
    point: Dict[str, Any],
    *,
    previous: Optional[Dict[str, Any]] = None,
    activity_kind: Optional[str] = None,
    paused: bool = False,
    max_accuracy: float = GPS_MAX_ACCURACY_M,
    min_distance_m: float = GPS_MIN_POINT_DISTANCE_M,
    now: Optional[datetime] = None,
) -> Tuple[bool, str]:
    """Valide un point GPS. Retourne (ok, reason)."""
    if paused:
        return False, "paused"
    lon = point.get("longitude", point.get("lon"))
    lat = point.get("latitude", point.get("lat"))
    if lon is None or lat is None:
        return False, "missing_coords"
    try:
        lon_f = float(lon)
        lat_f = float(lat)
    except (TypeError, ValueError):
        return False, "invalid_coords"
    if not is_valid_coordinate(lon_f, lat_f):
        return False, "out_of_bounds"

    accuracy = point.get("accuracy")
    if accuracy is not None:
        try:
            if float(accuracy) > max_accuracy:
                return False, "weak_accuracy"
        except (TypeError, ValueError):
            pass

    ts = _parse_ts(point.get("timestamp"))
    if ts is None:
        return False, "bad_timestamp"
    ref_now = now or datetime.now(timezone.utc)
    # Refuse timestamps trop éloignés (± 24h)
    delta = abs((ref_now - ts).total_seconds())
    if delta > 86400:
        return False, "timestamp_far"

    if previous:
        prev_lon = previous.get("longitude", previous.get("lon"))
        prev_lat = previous.get("latitude", previous.get("lat"))
        prev_ts = _parse_ts(previous.get("timestamp"))
        try:
            prev_lon_f = float(prev_lon)
            prev_lat_f = float(prev_lat)
        except (TypeError, ValueError):
            return True, "ok"
        if prev_ts and ts < prev_ts:
            return False, "timestamp_older"
        dist = haversine_distance(prev_lon_f, prev_lat_f, lon_f, lat_f)
        if dist < min_distance_m and prev_ts and (ts - prev_ts).total_seconds() < 2:
            return False, "duplicate_near"
        if prev_ts:
            dt = max(0.001, (ts - prev_ts).total_seconds())
            speed = dist / dt
            if speed > max_speed_for_kind(activity_kind) * 1.35:
                # Tolérance si précision mauvaise
                acc = float(accuracy) if accuracy is not None else 0.0
                if acc < 25 and dist > 80:
                    return False, "impossible_jump"
    return True, "ok"


def calculate_moving_distance(
    points: Sequence[Dict[str, Any]],
    *,
    activity_kind: Optional[str] = None,
) -> float:
    """Distance cumulée entre points valides successifs (mètres)."""
    total = 0.0
    prev: Optional[Dict[str, Any]] = None
    for raw in points:
        point = _normalize_point(raw)
        if not point:
            continue
        ok, _ = is_valid_gps_point(point, previous=prev, activity_kind=activity_kind, paused=False)
        if not ok and prev is not None:
            # Accepte quand même pour assemblage final si déjà filtré
            if prev:
                dist = haversine_distance(
                    float(prev["longitude"]),
                    float(prev["latitude"]),
                    float(point["longitude"]),
                    float(point["latitude"]),
                )
                if dist <= 0:
                    continue
                # Skip jumps évidents
                if dist > 500:
                    prev = point
                    continue
                total += dist
                prev = point
                continue
        if prev:
            total += haversine_distance(
                float(prev["longitude"]),
                float(prev["latitude"]),
                float(point["longitude"]),
                float(point["latitude"]),
            )
        prev = point
    return total


def calculate_average_speed(distance_meters: float, moving_seconds: float) -> Optional[float]:
    """Vitesse moyenne en km/h."""
    if not moving_seconds or moving_seconds <= 0 or not distance_meters or distance_meters <= 0:
        return None
    mps = distance_meters / moving_seconds
    return round(mps * 3.6, 3)


def calculate_average_pace(
    distance_meters: float,
    moving_seconds: float,
    *,
    per_meters: float = 1000.0,
) -> Optional[float]:
    """Allure en secondes par `per_meters` (ex. 1000 → sec/km, 100 → sec/100m)."""
    if not distance_meters or distance_meters <= 0 or not moving_seconds or moving_seconds <= 0:
        return None
    if per_meters <= 0:
        return None
    pace = moving_seconds * (per_meters / distance_meters)
    if not math.isfinite(pace) or pace <= 0 or pace > 86400:
        return None
    return round(pace, 2)


def simplify_route(
    coordinates: Sequence[Sequence[float]],
    *,
    tolerance_m: float = 8.0,
    max_points: int = 1500,
) -> List[List[float]]:
    """Simplification Douglas-Peucker approximée en mètres (équirectangulaire locale)."""
    coords = [[float(c[0]), float(c[1])] for c in coordinates if len(c) >= 2]
    if len(coords) <= 2:
        return coords
    simplified = _douglas_peucker(coords, tolerance_m)
    if len(simplified) > max_points:
        step = max(1, len(simplified) // max_points)
        simplified = simplified[::step]
        if simplified[-1] != coords[-1]:
            simplified.append(coords[-1])
    return simplified


def _perpendicular_distance_m(point: List[float], start: List[float], end: List[float]) -> float:
    if start == end:
        return haversine_distance(start[0], start[1], point[0], point[1])
    # Projection locale en mètres autour de start
    lat0 = math.radians(start[1])
    mx = 111320.0 * math.cos(lat0)
    my = 110540.0
    ax = (start[0]) * mx
    ay = (start[1]) * my
    bx = (end[0]) * mx
    by = (end[1]) * my
    px = (point[0]) * mx
    py = (point[1]) * my
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    proj_x = ax + t * dx
    proj_y = ay + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def _douglas_peucker(points: List[List[float]], epsilon: float) -> List[List[float]]:
    if len(points) < 3:
        return points
    max_dist = 0.0
    index = 0
    for i in range(1, len(points) - 1):
        dist = _perpendicular_distance_m(points[i], points[0], points[-1])
        if dist > max_dist:
            index = i
            max_dist = dist
    if max_dist > epsilon:
        left = _douglas_peucker(points[: index + 1], epsilon)
        right = _douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def calculate_bounding_box(coordinates: Sequence[Sequence[float]]) -> Optional[Dict[str, float]]:
    if not coordinates:
        return None
    lons = [float(c[0]) for c in coordinates if len(c) >= 2]
    lats = [float(c[1]) for c in coordinates if len(c) >= 2]
    if not lons or not lats:
        return None
    return {
        "min_lon": min(lons),
        "min_lat": min(lats),
        "max_lon": max(lons),
        "max_lat": max(lats),
    }


def calculate_elevation_gain(points: Sequence[Dict[str, Any]]) -> Optional[float]:
    prev_alt = None
    gain = 0.0
    samples = 0
    for raw in points:
        alt = raw.get("altitude")
        if alt is None:
            continue
        try:
            alt_f = float(alt)
        except (TypeError, ValueError):
            continue
        samples += 1
        if prev_alt is not None:
            delta = alt_f - prev_alt
            if 0.5 < delta < 50:
                gain += delta
        prev_alt = alt_f
    if samples < 3:
        return None
    return round(gain, 1)


def trim_route_by_distance(
    coordinates: Sequence[Sequence[float]],
    *,
    trim_start_meters: float = 200.0,
    trim_end_meters: float = 200.0,
    min_shareable_meters: float = 400.0,
) -> Tuple[Optional[List[List[float]]], str]:
    """Retire début/fin du tracé partageable. Retourne (coords|None, reason)."""
    coords = [[float(c[0]), float(c[1])] for c in coordinates if len(c) >= 2]
    if len(coords) < 2:
        return None, "no_route"
    total = 0.0
    for i in range(1, len(coords)):
        total += haversine_distance(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
    if total < min_shareable_meters:
        return None, "too_short"

    # Trim start
    start_idx = 0
    acc = 0.0
    while start_idx < len(coords) - 1 and acc < trim_start_meters:
        acc += haversine_distance(
            coords[start_idx][0],
            coords[start_idx][1],
            coords[start_idx + 1][0],
            coords[start_idx + 1][1],
        )
        start_idx += 1

    # Trim end
    end_idx = len(coords) - 1
    acc = 0.0
    while end_idx > start_idx and acc < trim_end_meters:
        acc += haversine_distance(
            coords[end_idx - 1][0],
            coords[end_idx - 1][1],
            coords[end_idx][0],
            coords[end_idx][1],
        )
        end_idx -= 1

    trimmed = coords[start_idx : end_idx + 1]
    if len(trimmed) < 2:
        return None, "too_short_after_trim"
    remain = 0.0
    for i in range(1, len(trimmed)):
        remain += haversine_distance(
            trimmed[i - 1][0], trimmed[i - 1][1], trimmed[i][0], trimmed[i][1]
        )
    if remain < min_shareable_meters * 0.4:
        return None, "too_short_after_trim"
    return trimmed, "ok"


def build_line_string(coordinates: Sequence[Sequence[float]]) -> Dict[str, Any]:
    return {"type": "LineString", "coordinates": [list(c[:2]) for c in coordinates]}


def build_multi_line_string(segments: Sequence[Sequence[Sequence[float]]]) -> Dict[str, Any]:
    cleaned = []
    for seg in segments:
        pts = [list(c[:2]) for c in seg if len(c) >= 2]
        if len(pts) >= 2:
            cleaned.append(pts)
    if not cleaned:
        return {"type": "MultiLineString", "coordinates": []}
    if len(cleaned) == 1:
        return build_line_string(cleaned[0])
    return {"type": "MultiLineString", "coordinates": cleaned}


def flatten_route_coordinates(route: Optional[Dict[str, Any]]) -> List[List[float]]:
    if not route or not isinstance(route, dict):
        return []
    rtype = route.get("type")
    coords = route.get("coordinates") or []
    if rtype == "LineString":
        return [[float(c[0]), float(c[1])] for c in coords if len(c) >= 2]
    if rtype == "MultiLineString":
        out: List[List[float]] = []
        for seg in coords:
            for c in seg:
                if len(c) >= 2:
                    out.append([float(c[0]), float(c[1])])
        return out
    return []


def _normalize_point(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    lon = raw.get("longitude", raw.get("lon"))
    lat = raw.get("latitude", raw.get("lat"))
    if lon is None or lat is None:
        # GeoJSON position
        if isinstance(raw.get("coordinates"), (list, tuple)) and len(raw["coordinates"]) >= 2:
            lon, lat = raw["coordinates"][0], raw["coordinates"][1]
        else:
            return None
    try:
        lon_f = float(lon)
        lat_f = float(lat)
    except (TypeError, ValueError):
        return None
    if not is_valid_coordinate(lon_f, lat_f):
        return None
    out = {
        "longitude": lon_f,
        "latitude": lat_f,
        "timestamp": raw.get("timestamp"),
    }
    for key in ("accuracy", "altitude", "speed", "idempotency_key", "segment"):
        if raw.get(key) is not None:
            out[key] = raw[key]
    return out


def filter_and_segment_points(
    points: Iterable[Dict[str, Any]],
    *,
    activity_kind: Optional[str] = None,
    pause_markers: Optional[Sequence[Dict[str, Any]]] = None,
) -> Tuple[List[List[List[float]]], List[Dict[str, Any]], float]:
    """
    Filtre les points, découpe en segments (pas de ligne pendant pause),
    retourne (segments_coords, accepted_points, distance_m).
    """
    segments: List[List[List[float]]] = []
    current: List[List[float]] = []
    accepted: List[Dict[str, Any]] = []
    distance = 0.0
    prev: Optional[Dict[str, Any]] = None
    pause_starts = set()
    if pause_markers:
        for m in pause_markers:
            if m.get("type") == "pause":
                pause_starts.add(str(m.get("at") or ""))

    for raw in points:
        point = _normalize_point(raw)
        if not point:
            continue
        # Nouveau segment après reprise
        if raw.get("new_segment") or (prev and raw.get("after_pause")):
            if len(current) >= 2:
                segments.append(current)
            current = []
            prev = None
        ok, reason = is_valid_gps_point(point, previous=prev, activity_kind=activity_kind)
        if not ok and reason in ("paused", "timestamp_older", "out_of_bounds", "impossible_jump", "weak_accuracy"):
            if reason == "impossible_jump":
                # Démarre un nouveau segment sans téléportation
                if len(current) >= 2:
                    segments.append(current)
                current = [[point["longitude"], point["latitude"]]]
                accepted.append(point)
                prev = point
            continue
        if prev:
            distance += haversine_distance(
                prev["longitude"], prev["latitude"], point["longitude"], point["latitude"]
            )
        current.append([point["longitude"], point["latitude"]])
        accepted.append(point)
        prev = point

    if len(current) >= 2:
        segments.append(current)
    elif current and not segments:
        # Un seul point : pas de ligne
        pass
    return segments, accepted, distance

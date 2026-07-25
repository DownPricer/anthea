"""Service métier activity_sessions + activity_route_chunks."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .clock import apply_pause, apply_resume, refresh_timing_fields, utc_now
from .constants import (
    ACTIVE_STATUSES,
    ACTIVITY_KINDS,
    ACTIVITY_TRACKING_MODES,
    MAX_LAPS_PER_BATCH,
    MAX_POINTS_PER_BATCH,
    MAX_ROUTE_POINTS,
    MIN_ACTIVITY_SECONDS_KEEP,
    ROUTE_CHUNKS_COLLECTION,
    ROUTE_VISIBILITIES,
    SESSIONS_COLLECTION,
)
from .geo import (
    build_multi_line_string,
    calculate_average_pace,
    calculate_average_speed,
    calculate_bounding_box,
    calculate_elevation_gain,
    filter_and_segment_points,
    flatten_route_coordinates,
    is_valid_coordinate,
    is_valid_gps_point,
    simplify_route,
)
from .privacy import (
    activity_summary_for_post,
    build_shareable_route,
    default_route_privacy,
    strip_route_from_activity,
)
from .serialize import serialize_activity_detail, serialize_activity_list_item


class ActivityConflictError(Exception):
    def __init__(self, message: str, current: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.current = current


class ActivityNotFoundError(Exception):
    pass


class ActivityForbiddenError(Exception):
    pass


class ActivityValidationError(Exception):
    pass


def _now_iso() -> str:
    return utc_now().isoformat()


async def ensure_activity_indexes(db) -> None:
    sessions = db[SESSIONS_COLLECTION]
    await sessions.create_index("id", unique=True)
    await sessions.create_index("user_id")
    await sessions.create_index([("user_id", 1), ("status", 1)])
    await sessions.create_index("started_at")
    await sessions.create_index("activity_kind")
    await sessions.create_index("tracking_mode")
    await sessions.create_index("published_post_id")
    chunks = db[ROUTE_CHUNKS_COLLECTION]
    await chunks.create_index([("activity_id", 1), ("sequence", 1)], unique=True)
    await chunks.create_index("activity_id")


def new_activity_document(
    *,
    user_id: str,
    tracking_mode: str,
    activity_kind: str,
    exercise_id: Optional[str] = None,
    exercise_name_snapshot: Optional[str] = None,
    exercise_name_i18n_snapshot: Optional[Dict[str, str]] = None,
    pool_length_meters: Optional[float] = None,
    interval_config: Optional[Dict[str, Any]] = None,
    visibility: str = "private",
) -> Dict[str, Any]:
    if tracking_mode not in ACTIVITY_TRACKING_MODES or tracking_mode == "standard":
        raise ActivityValidationError("tracking_mode invalide pour une activité suivie")
    if activity_kind not in ACTIVITY_KINDS:
        activity_kind = "other"
    now = _now_iso()
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "exercise_id": exercise_id,
        "exercise_name_snapshot": exercise_name_snapshot or activity_kind,
        "exercise_name_i18n_snapshot": exercise_name_i18n_snapshot or {},
        "activity_kind": activity_kind,
        "tracking_mode": tracking_mode,
        "status": "active",
        "started_at": now,
        "ended_at": None,
        "paused_at": None,
        "elapsed_seconds": 0,
        "moving_seconds": 0,
        "paused_seconds": 0,
        "distance_meters": 0.0,
        "laps": 0,
        "pool_length_meters": pool_length_meters,
        "average_speed_kmh": None,
        "average_pace_seconds_per_km": None,
        "average_pace_seconds_per_100m": None,
        "elevation_gain_meters": None,
        "interval_config": interval_config,
        "interval_results": [],
        "route": {"type": "LineString", "coordinates": []},
        "route_point_count": 0,
        "route_privacy": default_route_privacy(),
        "visibility": visibility if visibility in ("public", "friends", "private") else "private",
        "published_post_id": None,
        "lap_events": [],
        "processed_idempotency_keys": [],
        "segment_markers": [],
        "best_lap_seconds": None,
        "last_lap_seconds": None,
        "average_lap_seconds": None,
        "route_deleted": False,
        "created_at": now,
        "updated_at": now,
    }


def recompute_derived_metrics(doc: Dict[str, Any]) -> Dict[str, Any]:
    refresh_timing_fields(doc)
    moving = float(doc.get("moving_seconds") or 0)
    distance = float(doc.get("distance_meters") or 0)
    doc["average_speed_kmh"] = calculate_average_speed(distance, moving)
    doc["average_pace_seconds_per_km"] = calculate_average_pace(distance, moving, per_meters=1000.0)
    doc["average_pace_seconds_per_100m"] = calculate_average_pace(distance, moving, per_meters=100.0)
    return doc


async def get_activity(db, activity_id: str) -> Optional[Dict[str, Any]]:
    return await db[SESSIONS_COLLECTION].find_one({"id": activity_id}, {"_id": 0})


async def get_current_activity(db, user_id: str) -> Optional[Dict[str, Any]]:
    return await db[SESSIONS_COLLECTION].find_one(
        {"user_id": user_id, "status": {"$in": list(ACTIVE_STATUSES)}},
        {"_id": 0},
        sort=[("started_at", -1)],
    )


async def require_owner(db, activity_id: str, user_id: str) -> Dict[str, Any]:
    doc = await get_activity(db, activity_id)
    if not doc:
        raise ActivityNotFoundError("Activité introuvable")
    if doc.get("user_id") != user_id:
        raise ActivityForbiddenError("Cette activité ne vous appartient pas")
    return doc


async def start_activity(db, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    current = await get_current_activity(db, user_id)
    if current:
        force = bool(payload.get("force_discard_current"))
        resume = bool(payload.get("resume_existing"))
        if resume:
            return refresh_timing_fields(current)
        if not force:
            raise ActivityConflictError("Une activité est déjà en cours", current=current)
        current["status"] = "discarded"
        current["ended_at"] = _now_iso()
        current["updated_at"] = _now_iso()
        await db[SESSIONS_COLLECTION].replace_one({"id": current["id"]}, current)

    doc = new_activity_document(
        user_id=user_id,
        tracking_mode=payload.get("tracking_mode") or "timer",
        activity_kind=payload.get("activity_kind") or "other",
        exercise_id=payload.get("exercise_id"),
        exercise_name_snapshot=payload.get("exercise_name_snapshot"),
        exercise_name_i18n_snapshot=payload.get("exercise_name_i18n_snapshot"),
        pool_length_meters=payload.get("pool_length_meters"),
        interval_config=payload.get("interval_config"),
        visibility=payload.get("visibility") or "private",
    )
    if payload.get("client_activity_id"):
        # Reprise hors-ligne : conserver l'id client si libre
        existing = await get_activity(db, payload["client_activity_id"])
        if existing:
            if existing.get("user_id") != user_id:
                raise ActivityForbiddenError("Identifiant d'activité déjà utilisé")
            return refresh_timing_fields(existing)
        doc["id"] = str(payload["client_activity_id"])
    await db[SESSIONS_COLLECTION].insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def pause_activity(db, activity_id: str, user_id: str) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") == "completed":
        return refresh_timing_fields(doc)
    if doc.get("status") == "discarded":
        raise ActivityValidationError("Activité abandonnée")
    apply_pause(doc)
    refresh_timing_fields(doc)
    markers = list(doc.get("segment_markers") or [])
    markers.append({"type": "pause", "at": doc.get("paused_at")})
    doc["segment_markers"] = markers
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def resume_activity(db, activity_id: str, user_id: str) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") == "completed":
        return refresh_timing_fields(doc)
    if doc.get("status") == "discarded":
        raise ActivityValidationError("Activité abandonnée")
    apply_resume(doc)
    refresh_timing_fields(doc)
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def patch_metrics(db, activity_id: str, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") in ("completed", "discarded"):
        raise ActivityValidationError("Activité déjà terminée")
    if "distance_meters" in payload and payload["distance_meters"] is not None:
        try:
            dist = float(payload["distance_meters"])
        except (TypeError, ValueError) as exc:
            raise ActivityValidationError("distance_meters invalide") from exc
        if dist < 0 or dist > 500000:
            raise ActivityValidationError("distance_meters hors limites")
        doc["distance_meters"] = dist
    if "pool_length_meters" in payload and payload["pool_length_meters"] is not None:
        doc["pool_length_meters"] = float(payload["pool_length_meters"])
    if "interval_results" in payload and isinstance(payload["interval_results"], list):
        doc["interval_results"] = payload["interval_results"][:500]
    if "interval_config" in payload and isinstance(payload["interval_config"], dict):
        doc["interval_config"] = payload["interval_config"]
    recompute_derived_metrics(doc)
    doc["updated_at"] = _now_iso()
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def add_laps(db, activity_id: str, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") in ("completed", "discarded"):
        raise ActivityValidationError("Activité déjà terminée")
    if doc.get("status") == "paused":
        # Autoriser les laps même en pause ? Spec: actions pendant activité — on refuse silencieusement en pause
        pass

    action = payload.get("action") or "add"
    count = int(payload.get("count") or 1)
    if count < 1 or count > 10:
        raise ActivityValidationError("count invalide")
    idem = payload.get("idempotency_key")
    keys = list(doc.get("processed_idempotency_keys") or [])
    if idem and idem in keys:
        return refresh_timing_fields(doc)

    events = list(doc.get("lap_events") or [])
    now = _now_iso()
    pool = float(doc.get("pool_length_meters") or payload.get("pool_length_meters") or 25)

    if action == "undo":
        if not events:
            return refresh_timing_fields(doc)
        last = events.pop()
        doc["laps"] = max(0, int(doc.get("laps") or 0) - int(last.get("count") or 1))
    else:
        if len(events) + 1 > 5000:
            raise ActivityValidationError("Trop de longueurs")
        # Timestamp relatif pour stats
        last_ts = events[-1]["at"] if events else doc.get("started_at")
        from .clock import parse_iso

        prev = parse_iso(last_ts)
        cur = parse_iso(now)
        lap_seconds = None
        if prev and cur and count > 0:
            lap_seconds = max(0.0, (cur - prev).total_seconds() / count)
        events.append({"at": now, "count": count, "lap_seconds": lap_seconds, "idempotency_key": idem})
        doc["laps"] = int(doc.get("laps") or 0) + count
        if lap_seconds is not None:
            doc["last_lap_seconds"] = lap_seconds
            best = doc.get("best_lap_seconds")
            if best is None or lap_seconds < best:
                doc["best_lap_seconds"] = lap_seconds

    doc["lap_events"] = events
    doc["pool_length_meters"] = pool
    doc["distance_meters"] = float(doc.get("laps") or 0) * pool
    # Moyenne
    timed = [e.get("lap_seconds") for e in events if e.get("lap_seconds")]
    if timed:
        doc["average_lap_seconds"] = sum(timed) / len(timed)
    if idem:
        keys.append(idem)
        doc["processed_idempotency_keys"] = keys[-500:]
    recompute_derived_metrics(doc)
    doc["updated_at"] = now
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def add_points(db, activity_id: str, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") in ("completed", "discarded"):
        raise ActivityValidationError("Activité déjà terminée")
    points = payload.get("points") or []
    if not isinstance(points, list):
        raise ActivityValidationError("points invalide")
    if len(points) > MAX_POINTS_PER_BATCH:
        raise ActivityValidationError("Lot GPS trop volumineux")
    if doc.get("status") == "paused":
        # Ignore points pendant pause
        return refresh_timing_fields(doc)

    keys = set(doc.get("processed_idempotency_keys") or [])
    accepted: List[Dict[str, Any]] = []
    prev = None
    # Dernier point connu
    last_chunk = await db[ROUTE_CHUNKS_COLLECTION].find_one(
        {"activity_id": activity_id}, sort=[("sequence", -1)]
    )
    if last_chunk and last_chunk.get("points"):
        prev = last_chunk["points"][-1]

    after_pause = False
    markers = doc.get("segment_markers") or []
    if markers and markers[-1].get("type") == "resume":
        after_pause = True

    for raw in points:
        idem = raw.get("idempotency_key")
        if idem and idem in keys:
            continue
        lon = raw.get("longitude", raw.get("lon"))
        lat = raw.get("latitude", raw.get("lat"))
        try:
            lon_f = float(lon)
            lat_f = float(lat)
        except (TypeError, ValueError):
            continue
        if not is_valid_coordinate(lon_f, lat_f):
            continue
        point = {
            "longitude": lon_f,
            "latitude": lat_f,
            "timestamp": raw.get("timestamp") or _now_iso(),
            "accuracy": raw.get("accuracy"),
            "altitude": raw.get("altitude"),
            "speed": raw.get("speed"),
            "idempotency_key": idem,
            "after_pause": after_pause or bool(raw.get("after_pause")),
            "new_segment": bool(raw.get("new_segment") or after_pause),
        }
        after_pause = False
        ok, reason = is_valid_gps_point(
            point,
            previous=None if point.get("new_segment") else prev,
            activity_kind=doc.get("activity_kind"),
            paused=False,
        )
        if not ok and reason not in ("duplicate_near",):
            if reason == "impossible_jump":
                point["new_segment"] = True
                accepted.append(point)
                prev = point
                if idem:
                    keys.add(idem)
            continue
        if not ok:
            continue
        accepted.append(point)
        prev = point
        if idem:
            keys.add(idem)

    if not accepted:
        return refresh_timing_fields(doc)

    current_count = int(doc.get("route_point_count") or 0)
    if current_count >= MAX_ROUTE_POINTS:
        raise ActivityValidationError("Nombre maximum de points atteint")
    room = MAX_ROUTE_POINTS - current_count
    accepted = accepted[:room]

    seq = 1
    if last_chunk:
        seq = int(last_chunk.get("sequence") or 0) + 1
    await db[ROUTE_CHUNKS_COLLECTION].insert_one(
        {
            "activity_id": activity_id,
            "sequence": seq,
            "points": accepted,
            "created_at": _now_iso(),
        }
    )
    doc["route_point_count"] = current_count + len(accepted)
    doc["processed_idempotency_keys"] = list(keys)[-1000:]
    doc["updated_at"] = _now_iso()

    # Distance incrémentale approximative depuis chunks (sans logger coords)
    all_points = await _load_all_points(db, activity_id)
    segments, _accepted, distance = filter_and_segment_points(
        all_points, activity_kind=doc.get("activity_kind")
    )
    doc["distance_meters"] = distance
    doc["route"] = build_multi_line_string(segments)
    elev = calculate_elevation_gain(all_points)
    if elev is not None:
        doc["elevation_gain_meters"] = elev
    recompute_derived_metrics(doc)
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def _load_all_points(db, activity_id: str) -> List[Dict[str, Any]]:
    chunks = (
        await db[ROUTE_CHUNKS_COLLECTION]
        .find({"activity_id": activity_id}, {"_id": 0})
        .sort("sequence", 1)
        .to_list(500)
    )
    points: List[Dict[str, Any]] = []
    for ch in chunks:
        points.extend(ch.get("points") or [])
    return points


async def complete_activity(db, activity_id: str, user_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    payload = payload or {}
    # Idempotent
    if doc.get("status") == "completed":
        return refresh_timing_fields(doc)
    if doc.get("status") == "discarded":
        raise ActivityValidationError("Activité abandonnée")

    # Si en pause, clôturer la pause
    if doc.get("status") == "paused":
        apply_resume(doc)

    if "distance_meters" in payload and payload["distance_meters"] is not None:
        dist = float(payload["distance_meters"])
        if dist < 0 or dist > 500000:
            raise ActivityValidationError("distance_meters hors limites")
        # Pour GPS, on préfère la distance serveur ; pour manual on accepte
        if doc.get("tracking_mode") in ("manual_distance", "laps", "timer", "intervals"):
            doc["distance_meters"] = dist
        elif doc.get("tracking_mode") == "gps":
            # Autorise correction légère seulement si serveur ~0
            if float(doc.get("distance_meters") or 0) <= 0 and dist > 0:
                doc["distance_meters"] = dist

    if "interval_results" in payload:
        doc["interval_results"] = payload["interval_results"]

    # Assemblage final route GPS
    if doc.get("tracking_mode") == "gps" and not doc.get("route_deleted"):
        all_points = await _load_all_points(db, activity_id)
        segments, accepted, distance = filter_and_segment_points(
            all_points, activity_kind=doc.get("activity_kind")
        )
        doc["distance_meters"] = distance
        simplified_segments = [simplify_route(seg, tolerance_m=6.0, max_points=2000) for seg in segments]
        doc["route"] = build_multi_line_string(simplified_segments)
        doc["route_point_count"] = len(accepted)
        elev = calculate_elevation_gain(accepted)
        if elev is not None:
            doc["elevation_gain_meters"] = elev

    doc["status"] = "completed"
    doc["ended_at"] = _now_iso()
    doc["paused_at"] = None
    recompute_derived_metrics(doc)
    doc["updated_at"] = _now_iso()

    # Trop courte → discard option
    if int(doc.get("elapsed_seconds") or 0) < MIN_ACTIVITY_SECONDS_KEEP and payload.get("keep_short") is not True:
        # On conserve quand même completed si l'utilisateur force via keep — sinon completed ok
        pass

    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def discard_activity(db, activity_id: str, user_id: str) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") == "discarded":
        return doc
    doc["status"] = "discarded"
    doc["ended_at"] = _now_iso()
    doc["updated_at"] = _now_iso()
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    await db[ROUTE_CHUNKS_COLLECTION].delete_many({"activity_id": activity_id})
    return doc


async def delete_activity(db, activity_id: str, user_id: str) -> None:
    doc = await require_owner(db, activity_id, user_id)
    await db[SESSIONS_COLLECTION].delete_one({"id": activity_id})
    await db[ROUTE_CHUNKS_COLLECTION].delete_many({"activity_id": activity_id})
    if doc.get("published_post_id"):
        # Ne pas supprimer le post automatiquement — option future
        pass


async def delete_route(db, activity_id: str, user_id: str) -> Dict[str, Any]:
    doc = await require_owner(db, activity_id, user_id)
    strip_route_from_activity(doc)
    doc["updated_at"] = _now_iso()
    await db[ROUTE_CHUNKS_COLLECTION].delete_many({"activity_id": activity_id})
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return doc


async def list_activities(
    db,
    user_id: str,
    *,
    limit: int = 20,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {"user_id": user_id}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["completed", "active", "paused"]}
    cursor = db[SESSIONS_COLLECTION].find(query, {"_id": 0}).sort("started_at", -1).limit(min(100, max(1, limit)))
    docs = await cursor.to_list(100)
    return [serialize_activity_list_item(refresh_timing_fields(d)) for d in docs]


async def publish_activity(
    db,
    activity_id: str,
    user_id: str,
    payload: Dict[str, Any],
    *,
    create_post_fn,
) -> Dict[str, Any]:
    """Publie un résumé dans le fil via create_post_fn fourni par server.py."""
    doc = await require_owner(db, activity_id, user_id)
    if doc.get("status") != "completed":
        raise ActivityValidationError("Seule une activité terminée peut être publiée")
    if doc.get("published_post_id") and not payload.get("force_new"):
        # Idempotent
        return {"activity": doc, "post_id": doc["published_post_id"], "idempotent": True}

    route_vis = payload.get("route_visibility") or "summary_only"
    if route_vis not in ROUTE_VISIBILITIES:
        route_vis = "summary_only"
    if route_vis == "full_route" and not payload.get("confirm_full_route"):
        raise ActivityValidationError("Confirmation requise pour le tracé complet")

    visibility = payload.get("visibility") or "private"
    shareable = build_shareable_route(doc, route_visibility=route_vis)
    summary = activity_summary_for_post(doc, shareable)

    post = await create_post_fn(
        {
            "type": "activity",
            "title": payload.get("title"),
            "description": payload.get("description"),
            "visibility": visibility,
            "activity_id": activity_id,
            "activity_snapshot": summary,
        },
        user_id,
    )
    post_id = post.get("id") or str(post.get("_id"))
    doc["published_post_id"] = post_id
    doc["visibility"] = visibility
    privacy = doc.get("route_privacy") or default_route_privacy()
    privacy["visibility"] = shareable.get("route_visibility") or route_vis
    doc["route_privacy"] = privacy
    doc["updated_at"] = _now_iso()
    await db[SESSIONS_COLLECTION].replace_one({"id": activity_id}, doc)
    return {"activity": doc, "post": post, "post_id": post_id, "idempotent": False}


def activity_stats_from_docs(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Agrégats statistiques activités complétées."""
    completed = [d for d in docs if d.get("status") == "completed"]
    total_time = sum(int(d.get("moving_seconds") or 0) for d in completed)
    by_kind = {
        "running": 0.0,
        "walking": 0.0,
        "cycling": 0.0,
        "swimming": 0.0,
    }
    laps = 0
    best_pace = None
    longest = 0
    for d in completed:
        kind = d.get("activity_kind")
        dist = float(d.get("distance_meters") or 0)
        if kind in by_kind:
            by_kind[kind] += dist
        laps += int(d.get("laps") or 0)
        pace = d.get("average_pace_seconds_per_km")
        if pace and (best_pace is None or pace < best_pace):
            best_pace = pace
        longest = max(longest, int(d.get("moving_seconds") or 0))
    return {
        "activities_completed": len(completed),
        "activity_moving_seconds": total_time,
        "distance_running_meters": by_kind["running"],
        "distance_walking_meters": by_kind["walking"],
        "distance_cycling_meters": by_kind["cycling"],
        "distance_swimming_meters": by_kind["swimming"],
        "laps_total": laps,
        "best_pace_seconds_per_km": best_pace,
        "longest_activity_seconds": longest,
    }

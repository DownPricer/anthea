"""Tests suivi d'activités FitMatch."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock

import pytest

from activities.classification import classify_exercise, classify_catalog_documents, classification_fields
from activities.clock import apply_pause, apply_resume, compute_elapsed, refresh_timing_fields
from activities.constants import SESSIONS_COLLECTION, ROUTE_CHUNKS_COLLECTION
from activities.geo import (
    calculate_average_pace,
    calculate_average_speed,
    calculate_bounding_box,
    calculate_moving_distance,
    haversine_distance,
    is_valid_coordinate,
    is_valid_gps_point,
    simplify_route,
    trim_route_by_distance,
)
from activities.privacy import build_shareable_route as _build_shareable
from activities.serialize import serialize_activity_list_item
from activities import service


class FakeCollection:
    def __init__(self):
        self.docs: List[Dict[str, Any]] = []

    async def insert_one(self, doc):
        d = deepcopy(doc)
        self.docs.append(d)
        return AsyncMock(inserted_id=len(self.docs))

    async def replace_one(self, query, doc):
        for i, d in enumerate(self.docs):
            if all(d.get(k) == v for k, v in query.items()):
                self.docs[i] = deepcopy(doc)
                return AsyncMock(matched_count=1)
        return AsyncMock(matched_count=0)

    async def find_one(self, query, projection=None, sort=None):
        items = [d for d in self.docs if _match(d, query)]
        if sort:
            key, direction = sort[0]
            items.sort(key=lambda x: x.get(key) or "", reverse=direction == -1)
        if not items:
            return None
        out = deepcopy(items[0])
        if projection and projection.get("_id") == 0:
            out.pop("_id", None)
        return out

    def find(self, query, projection=None):
        items = [d for d in self.docs if _match(d, query)]
        if projection and projection.get("_id") == 0:
            items = [{k: v for k, v in d.items() if k != "_id"} for d in items]
        return FakeCursor(items)

    async def delete_many(self, query):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _match(d, query)]
        return AsyncMock(deleted_count=before - len(self.docs))

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if _match(d, query):
                del self.docs[i]
                return AsyncMock(deleted_count=1)
        return AsyncMock(deleted_count=0)

    async def create_index(self, *args, **kwargs):
        return None


class FakeCursor:
    def __init__(self, items):
        self.items = items
        self._sort = None
        self._limit = None

    def sort(self, key, direction=1):
        if isinstance(key, list):
            key, direction = key[0]
        self._sort = (key, direction)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        items = list(self.items)
        if self._sort:
            k, direction = self._sort
            items.sort(key=lambda x: x.get(k) or "", reverse=direction == -1)
        if self._limit is not None:
            items = items[: self._limit]
        return deepcopy(items)


def _match(doc, query):
    for key, val in query.items():
        if key == "$in":
            continue
        if isinstance(val, dict):
            if "$in" in val:
                if doc.get(key) not in val["$in"]:
                    return False
            elif "$gte" in val:
                if (doc.get(key) or "") < val["$gte"]:
                    return False
            else:
                return False
        elif doc.get(key) != val:
            return False
    return True


@pytest.fixture
def fake_db():
    return {
        SESSIONS_COLLECTION: FakeCollection(),
        ROUTE_CHUNKS_COLLECTION: FakeCollection(),
        "posts": FakeCollection(),
    }


def _now_iso(offset_sec=0):
    return (datetime.now(timezone.utc) - timedelta(seconds=offset_sec)).isoformat()


# ─── Classification ───────────────────────────────────────────

def test_classify_pushups_standard():
    doc = {"id": "x1", "name": {"en": "Push-ups"}, "sport": "bodyweight", "equipment": ["bodyweight"]}
    mode, kind, source, confidence, version = classify_exercise(doc)
    assert mode == "standard"
    assert kind == "other"
    assert source == "default_standard"
    assert confidence == "high"
    assert int(version) == 2


def test_classify_outdoor_run_catalog_standard():
    doc = {"id": "x2", "name": {"en": "Outdoor running"}, "sport": "running", "equipment": ["other"]}
    mode, kind, _, confidence, _ = classify_exercise(doc)
    assert mode == "standard"
    assert kind == "other"
    assert confidence == "high"


def test_classify_treadmill_manual():
    doc = {"id": "x3", "name": {"en": "Treadmill running"}, "sport": "running", "equipment": ["treadmill"]}
    mode, kind, source, confidence, _ = classify_exercise(doc)
    assert mode == "manual_distance"
    assert kind == "running"
    assert source == "strict_machine_rule"
    assert confidence == "high"


def test_classify_pool_laps_removed_from_catalog():
    doc = {"id": "x4", "name": {"en": "Pool swimming"}, "sport": "swimming", "equipment": ["pool"]}
    mode, kind, _, _, _ = classify_exercise(doc)
    assert mode == "standard"
    assert kind == "other"


def test_classify_tabata_intervals():
    doc = {"id": "x5", "name": {"en": "Tabata"}, "sport": "cardio", "equipment": ["bodyweight"]}
    mode, kind, _, confidence, _ = classify_exercise(doc)
    assert mode == "intervals"
    assert confidence == "high"


def test_classification_idempotent():
    docs = [
        {"id": "a", "name": {"en": "Squat"}, "sport": "strength", "equipment": ["barbell"]},
        {"id": "b", "name": {"en": "Outdoor running"}, "sport": "running", "equipment": []},
    ]
    r1 = classify_catalog_documents(docs)
    for d in docs:
        d.update(classification_fields(d))
    r2 = classify_catalog_documents(docs)
    assert r2["changes"] == 0


# ─── Clock ──────────────────────────────────────────────────

def test_compute_elapsed_excludes_pause():
    start = _now_iso(120)
    paused_at = _now_iso(60)
    elapsed, moving, paused = compute_elapsed(
        started_at=start,
        status="paused",
        paused_at=paused_at,
        paused_seconds=10,
        now=datetime.now(timezone.utc),
    )
    assert elapsed >= 110
    assert paused >= 70
    assert moving == elapsed - paused


def test_double_pause_idempotent():
    doc = {"status": "active", "started_at": _now_iso(30), "paused_seconds": 0}
    apply_pause(doc)
    paused_at = doc["paused_at"]
    apply_pause(doc)
    assert doc["paused_at"] == paused_at


def test_resume_adds_pause_duration():
    doc = {
        "status": "paused",
        "started_at": _now_iso(100),
        "paused_at": _now_iso(40),
        "paused_seconds": 5,
    }
    apply_resume(doc)
    assert doc["status"] == "active"
    assert doc["paused_seconds"] >= 40


# ─── Geo ────────────────────────────────────────────────────

def test_haversine_known_distance():
    # ~111 km per degree latitude
    d = haversine_distance(0, 0, 1, 0)
    assert 110000 < d < 112000


def test_invalid_coordinate_rejected():
    assert is_valid_coordinate(0, 91) is False
    assert is_valid_coordinate(181, 0) is False


def test_gps_point_weak_accuracy():
    ok, reason = is_valid_gps_point({"longitude": 4.0, "latitude": 45.0, "timestamp": _now_iso(), "accuracy": 80})
    assert ok is False
    assert reason == "weak_accuracy"


def test_gps_impossible_jump():
    prev = {"longitude": 4.0, "latitude": 45.0, "timestamp": _now_iso(10)}
    nxt = {"longitude": 5.0, "latitude": 46.0, "timestamp": _now_iso(9), "accuracy": 5}
    ok, reason = is_valid_gps_point(nxt, previous=prev, activity_kind="running")
    assert ok is False


def test_average_pace_running():
    pace = calculate_average_pace(5000, 1500, per_meters=1000)
    assert pace == pytest.approx(300, rel=0.01)


def test_average_speed_cycling():
    speed = calculate_average_speed(10000, 1200)
    assert speed == pytest.approx(30.0, rel=0.01)


def test_simplify_and_bbox():
    coords = [[4.0, 45.0], [4.001, 45.001], [4.002, 45.002]]
    simplified = simplify_route(coords, tolerance_m=1.0)
    assert len(simplified) >= 2
    bbox = calculate_bounding_box(simplified)
    assert bbox["min_lon"] <= bbox["max_lon"]


def test_trim_short_route_not_shareable():
    coords = [[4.0, 45.0], [4.0001, 45.0001]]
    trimmed, reason = trim_route_by_distance(coords, trim_start_meters=200, trim_end_meters=200)
    assert trimmed is None
    assert reason == "too_short"


def test_list_serialization_no_route_coords():
    doc = {
        "id": "act1",
        "user_id": "u1",
        "tracking_mode": "gps",
        "activity_kind": "running",
        "status": "completed",
        "route": {"type": "LineString", "coordinates": [[4.0, 45.0], [4.1, 45.1]]},
        "route_point_count": 2,
        "distance_meters": 1000,
        "started_at": _now_iso(100),
    }
    out = serialize_activity_list_item(doc)
    assert "route" not in out or out.get("route") is None
    assert out.get("route_preview") is not None


# ─── Service async ──────────────────────────────────────────

def _started_doc(result):
    if isinstance(result, dict) and "activity" in result:
        return result["activity"]
    return result


def test_start_timer_activity(fake_db):
    result = asyncio.run(
        service.start_activity(
            fake_db,
            "user1",
            {"tracking_mode": "timer", "activity_kind": "yoga", "exercise_name_snapshot": "Yoga"},
        )
    )
    doc = _started_doc(result)
    assert doc["status"] == "active"
    assert doc["tracking_mode"] == "timer"
    assert result["created"] is True
    assert result["resumed"] is False


def test_active_orphan_soft_paused_on_new_start(fake_db):
    """CAS C — démarrer une 2e activité pause automatiquement la 1re (pas de 409)."""
    first = asyncio.run(
        service.start_activity(fake_db, "user1", {"tracking_mode": "timer", "activity_kind": "yoga"})
    )
    second = asyncio.run(
        service.start_activity(fake_db, "user1", {"tracking_mode": "timer", "activity_kind": "yoga"})
    )
    assert second["created"] is True
    orphan = asyncio.run(service.get_activity(fake_db, first["activity"]["id"]))
    assert orphan["status"] == "paused"
    assert second["activity"]["id"] != first["activity"]["id"]


def test_pause_resume_complete(fake_db):
    doc = _started_doc(
        asyncio.run(
            service.start_activity(
                fake_db,
                "user1",
                {"tracking_mode": "manual_distance", "activity_kind": "running"},
            )
        )
    )
    aid = doc["id"]
    paused = asyncio.run(service.pause_activity(fake_db, aid, "user1"))
    assert paused["status"] == "paused"
    asyncio.run(service.pause_activity(fake_db, aid, "user1"))  # idempotent
    resumed = asyncio.run(service.resume_activity(fake_db, aid, "user1"))
    assert resumed["status"] == "active"
    completed = asyncio.run(
        service.complete_activity(fake_db, aid, "user1", {"distance_meters": 5000})
    )
    assert completed["status"] == "completed"
    again = asyncio.run(
        service.complete_activity(fake_db, aid, "user1", {"distance_meters": 9999})
    )
    assert again["status"] == "completed"
    assert again["distance_meters"] == completed["distance_meters"]


def test_laps_pool_25m(fake_db):
    doc = _started_doc(
        asyncio.run(
            service.start_activity(
                fake_db,
                "user1",
                {"tracking_mode": "laps", "activity_kind": "swimming", "pool_length_meters": 25},
            )
        )
    )
    aid = doc["id"]
    asyncio.run(service.add_laps(fake_db, aid, "user1", {"count": 1, "idempotency_key": "lap1"}))
    asyncio.run(service.add_laps(fake_db, aid, "user1", {"count": 2, "idempotency_key": "lap2"}))
    updated = asyncio.run(service.add_laps(fake_db, aid, "user1", {"action": "undo"}))
    assert updated["laps"] == 1
    assert updated["distance_meters"] == 25


def test_foreign_activity_forbidden(fake_db):
    doc = _started_doc(
        asyncio.run(
            service.start_activity(fake_db, "user1", {"tracking_mode": "timer", "activity_kind": "other"})
        )
    )
    with pytest.raises(service.ActivityForbiddenError):
        asyncio.run(service.require_owner(fake_db, doc["id"], "user2"))


def test_gps_points_and_distance(fake_db):
    doc = _started_doc(
        asyncio.run(
            service.start_activity(fake_db, "user1", {"tracking_mode": "gps", "activity_kind": "running"})
        )
    )
    aid = doc["id"]
    base = datetime.now(timezone.utc)
    points = []
    for i in range(5):
        ts = (base + timedelta(seconds=i * 5)).isoformat()
        points.append(
            {
                "longitude": 4.0 + i * 0.0001,
                "latitude": 45.0 + i * 0.0001,
                "timestamp": ts,
                "accuracy": 10,
                "idempotency_key": f"p{i}",
            }
        )
    updated = asyncio.run(service.add_points(fake_db, aid, "user1", {"points": points}))
    assert updated["route_point_count"] == 5
    assert updated["distance_meters"] > 0


def test_delete_route_keeps_stats(fake_db):
    doc = _started_doc(
        asyncio.run(
            service.start_activity(fake_db, "user1", {"tracking_mode": "gps", "activity_kind": "running"})
        )
    )
    aid = doc["id"]
    doc["distance_meters"] = 3000
    doc["route"] = {"type": "LineString", "coordinates": [[4.0, 45.0], [4.01, 45.01]]}
    doc["route_point_count"] = 2
    asyncio.run(fake_db[SESSIONS_COLLECTION].replace_one({"id": aid}, doc))
    stripped = asyncio.run(service.delete_route(fake_db, aid, "user1"))
    assert stripped.get("route_deleted") is True
    assert stripped["distance_meters"] == 3000
    assert stripped["route"]["coordinates"] == []


def test_shareable_route_privacy():
    activity = {
        "id": "a1",
        "activity_kind": "running",
        "tracking_mode": "gps",
        "distance_meters": 5000,
        "route": {
            "type": "LineString",
            "coordinates": [[4.0 + i * 0.001, 45.0 + i * 0.001] for i in range(200)],
        },
        "route_point_count": 200,
        "route_privacy": {"visibility": "summary_only", "trim_start_meters": 200, "trim_end_meters": 200},
    }
    summary = _build_shareable(activity, route_visibility="summary_only")
    assert summary["shareable_route"] is None
    trimmed = _build_shareable(activity, route_visibility="trimmed_route")
    assert trimmed.get("shareable_route") is not None or trimmed.get("share_blocked_reason")

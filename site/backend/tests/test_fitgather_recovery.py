"""Tests reprise auto, checkpoints idempotents, soft-pause orpheline, branding."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from activities import service
from activities.clock import apply_pause, apply_resume, compute_elapsed


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, n):
        return list(self._docs)[:n]


class FakeCollection:
    def __init__(self):
        self.docs = {}

    def _match(self, doc, query):
        if query.get("id") and doc.get("id") != query["id"]:
            return False
        if query.get("user_id") and doc.get("user_id") != query["user_id"]:
            return False
        if "status" in query:
            st = query["status"]
            if isinstance(st, dict) and "$in" in st:
                if doc.get("status") not in st["$in"]:
                    return False
            elif doc.get("status") != st:
                return False
        for key in (
            "scheduled_workout_id",
            "workout_session_id",
            "workout_exercise_index",
            "start_idempotency_key",
        ):
            if key in query and doc.get(key) != query[key]:
                return False
        return True

    async def find_one(self, query, projection=None, sort=None):
        matches = [dict(d) for d in self.docs.values() if self._match(d, query)]
        if not matches:
            return None
        if sort:
            field, direction = sort[0]
            matches.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
        return matches[0]

    async def insert_one(self, doc):
        stored = dict(doc)
        self.docs[stored["id"]] = stored
        return MagicMock(inserted_id=stored["id"])

    async def replace_one(self, query, doc):
        self.docs[doc["id"]] = dict(doc)
        return MagicMock()

    async def delete_many(self, query):
        return MagicMock(deleted_count=0)

    def find(self, query, projection=None):
        return FakeCursor([dict(d) for d in self.docs.values()])


class FakeDB:
    def __init__(self):
        self.sessions = FakeCollection()

    def __getitem__(self, name):
        return self.sessions


def test_soft_pause_orphan_preserves_metrics():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {"tracking_mode": "manual_distance", "activity_kind": "running"},
        )
    )
    aid = first["activity"]["id"]
    asyncio.run(service.patch_metrics(db, aid, "u1", {"distance_meters": 1234.5}))
    second = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w9",
                "workout_exercise_index": 0,
            },
        )
    )
    assert second["created"] is True
    orphan = asyncio.run(service.get_activity(db, aid))
    assert orphan["status"] == "paused"
    assert orphan["distance_meters"] == 1234.5
    assert second["activity"]["id"] != aid


def test_same_exercise_resume_no_second_create():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
                "idempotency_key": "workout:w1:exercise:0:preset:yoga",
            },
        )
    )
    second = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
                "idempotency_key": "workout:w1:exercise:0:preset:yoga",
            },
        )
    )
    assert second["created"] is False
    assert second["resumed"] is True
    assert second["activity"]["id"] == first["activity"]["id"]


def test_completed_activity_not_reused():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    asyncio.run(service.complete_activity(db, first["activity"]["id"], "u1", {}))
    second = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    assert second["created"] is True
    assert second["activity"]["id"] != first["activity"]["id"]


def test_metrics_checkpoint_idempotent():
    db = FakeDB()
    started = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {"tracking_mode": "manual_distance", "activity_kind": "running"},
        )
    )
    aid = started["activity"]["id"]
    key = f"activity:{aid}:event:cp-1"
    first = asyncio.run(
        service.patch_metrics(db, aid, "u1", {"distance_meters": 500, "idempotency_key": key})
    )
    second = asyncio.run(
        service.patch_metrics(db, aid, "u1", {"distance_meters": 9999, "idempotency_key": key})
    )
    assert first["distance_meters"] == 500
    assert second["distance_meters"] == 500


def test_laps_idempotent():
    db = FakeDB()
    started = asyncio.run(
        service.start_activity(
            db,
            "u1",
            {
                "tracking_mode": "laps",
                "activity_kind": "swimming",
                "pool_length_meters": 25,
            },
        )
    )
    aid = started["activity"]["id"]
    key = f"activity:{aid}:lap:client-1"
    first = asyncio.run(
        service.add_laps(db, aid, "u1", {"action": "add", "count": 1, "idempotency_key": key})
    )
    second = asyncio.run(
        service.add_laps(db, aid, "u1", {"action": "add", "count": 1, "idempotency_key": key})
    )
    assert first["laps"] == second["laps"]


def test_clock_survives_pause_using_timestamps():
    doc = {
        "started_at": "2026-01-01T10:00:00+00:00",
        "status": "active",
        "paused_at": None,
        "paused_seconds": 0,
    }
    apply_pause(
        doc,
        now=datetime(2026, 1, 1, 10, 5, 0, tzinfo=timezone.utc),
    )
    assert doc["status"] == "paused"
    apply_resume(
        doc,
        now=datetime(2026, 1, 1, 10, 7, 0, tzinfo=timezone.utc),
    )
    assert doc["status"] == "active"
    assert doc["paused_seconds"] == pytest.approx(120.0)
    elapsed, moving, paused = compute_elapsed(
        started_at=doc["started_at"],
        status="active",
        paused_at=None,
        paused_seconds=doc["paused_seconds"],
        now=datetime(2026, 1, 1, 10, 10, 0, tzinfo=timezone.utc),
    )
    assert paused == 120
    assert moving == 480
    assert elapsed == 600


def test_fitgather_api_root_message():
    text = Path(__file__).resolve().parents[1].joinpath("server.py").read_text(encoding="utf-8")
    assert "FitGather API" in text
    assert "FitMatch API" not in text

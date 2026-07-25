"""Tests démarrage idempotent d'activités liées à une séance."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from activities import service
from activities.api import _http_from_service, start_handler
from activities.constants import SESSIONS_COLLECTION


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
            # sort=[("started_at", -1)]
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
        results = []
        for doc in self.docs.values():
            if query.get("user_id") and doc.get("user_id") != query["user_id"]:
                continue
            if "status" in query:
                st = query["status"]
                if isinstance(st, dict) and "$in" in st:
                    if doc.get("status") not in st["$in"]:
                        continue
            if "$or" in query:
                linked = doc.get("scheduled_workout_id")
                if linked:
                    continue
            results.append(dict(doc))
        return FakeCursor(results)


class FakeDB:
    def __init__(self):
        self.sessions = FakeCollection()

    def __getitem__(self, name):
        return self.sessions


def _act(result):
    return result["activity"] if isinstance(result, dict) and "activity" in result else result


def test_first_start_creates_activity():
    db = FakeDB()
    result = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "gps",
                "activity_kind": "running",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
                "exercise_id": "activity:outdoor_running",
                "idempotency_key": "workout:w1:exercise:0:preset:outdoor_running",
            },
        )
    )
    assert result["created"] is True
    assert result["resumed"] is False
    assert _act(result)["scheduled_workout_id"] == "w1"
    assert _act(result)["start_idempotency_key"].endswith("outdoor_running")


def test_second_identical_start_reuses_same_activity():
    db = FakeDB()
    payload = {
        "tracking_mode": "gps",
        "activity_kind": "running",
        "scheduled_workout_id": "w1",
        "workout_exercise_index": 0,
        "idempotency_key": "workout:w1:exercise:0:preset:outdoor_running",
    }
    first = asyncio.run(service.start_activity(db, "user1", payload))
    second = asyncio.run(service.start_activity(db, "user1", payload))
    assert first["activity"]["id"] == second["activity"]["id"]
    assert second["created"] is False
    assert second["resumed"] is True
    assert len(db.sessions.docs) == 1


def test_paused_linked_activity_reused():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 2,
            },
        )
    )
    aid = first["activity"]["id"]
    asyncio.run(service.pause_activity(db, aid, "user1"))
    again = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 2,
            },
        )
    )
    assert again["activity"]["id"] == aid
    assert again["resumed"] is True


def test_completed_activity_not_reused():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    aid = first["activity"]["id"]
    asyncio.run(service.complete_activity(db, aid, "user1", {}))
    second = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    assert second["created"] is True
    assert second["activity"]["id"] != aid


def test_other_active_returns_structured_409():
    db = FakeDB()
    asyncio.run(
        service.start_activity(
            db,
            "user1",
            {"tracking_mode": "timer", "activity_kind": "yoga"},
        )
    )
    with pytest.raises(service.ActivityConflictError) as exc:
        asyncio.run(
            service.start_activity(
                db,
                "user1",
                {
                    "tracking_mode": "gps",
                    "activity_kind": "running",
                    "scheduled_workout_id": "w2",
                    "workout_exercise_index": 0,
                },
            )
        )
    assert exc.value.code == "ACTIVE_ACTIVITY_EXISTS"
    assert exc.value.linked_to_current_exercise is False
    http = _http_from_service(exc.value)
    assert http.status_code == 409
    detail = http.detail
    assert detail["code"] == "ACTIVE_ACTIVITY_EXISTS"
    assert detail["activity_id"]
    assert detail["linked_to_current_exercise"] is False
    assert "route" not in (detail.get("current_activity") or {})
    assert (detail.get("current_activity") or {}).get("bounding_box") is None


def test_discard_then_start_new():
    db = FakeDB()
    orphan = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {"tracking_mode": "timer", "activity_kind": "yoga"},
        )
    )
    asyncio.run(service.discard_activity(db, orphan["activity"]["id"], "user1"))
    result = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "gps",
                "activity_kind": "running",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    assert result["created"] is True


def test_force_discard_current_then_start():
    db = FakeDB()
    asyncio.run(
        service.start_activity(
            db,
            "user1",
            {"tracking_mode": "timer", "activity_kind": "yoga"},
        )
    )
    result = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "gps",
                "activity_kind": "running",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
                "force_discard_current": True,
            },
        )
    )
    assert result["created"] is True
    assert result["activity"]["scheduled_workout_id"] == "w1"


def test_workout_session_id_link_reused():
    db = FakeDB()
    first = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "stretching",
                "workout_session_id": "sess-1",
                "workout_exercise_index": 1,
            },
        )
    )
    second = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "stretching",
                "workout_session_id": "sess-1",
                "workout_exercise_index": 1,
            },
        )
    )
    assert first["activity"]["id"] == second["activity"]["id"]


def test_list_excludes_workout_linked():
    db = FakeDB()
    linked = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    db.sessions.docs[linked["activity"]["id"]]["status"] = "completed"
    assert asyncio.run(service.list_activities(db, "user1")) == []


def test_publish_blocked_for_workout_linked():
    db = FakeDB()
    doc = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "gps",
                "activity_kind": "running",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )
    )
    aid = doc["activity"]["id"]
    db.sessions.docs[aid]["status"] = "completed"
    with pytest.raises(service.ActivityValidationError):
        asyncio.run(
            service.publish_activity(
                db,
                aid,
                "user1",
                {"visibility": "public"},
                create_post_fn=AsyncMock(),
            )
        )


def test_start_handler_envelope():
    db = FakeDB()

    async def _run():
        return await start_handler(
            db,
            {"id": "user1"},
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "scheduled_workout_id": "w1",
                "workout_exercise_index": 0,
            },
        )

    out = asyncio.run(_run())
    assert out["created"] is True
    assert out["resumed"] is False
    assert out["activity"]["id"]
    assert out["id"] == out["activity"]["id"]

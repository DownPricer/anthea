"""Tests flux activité liée à une séance Player."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from activities import service
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

    async def find_one(self, query, projection=None, sort=None):
        for doc in self.docs.values():
            if query.get("id") and doc.get("id") != query["id"]:
                continue
            if query.get("user_id") and doc.get("user_id") != query["user_id"]:
                continue
            if "status" in query:
                st = query["status"]
                if isinstance(st, dict) and "$in" in st:
                    if doc.get("status") not in st["$in"]:
                        continue
                elif doc.get("status") != st:
                    continue
            if query.get("scheduled_workout_id") and doc.get("scheduled_workout_id") != query[
                "scheduled_workout_id"
            ]:
                continue
            if "workout_exercise_index" in query and doc.get("workout_exercise_index") != query[
                "workout_exercise_index"
            ]:
                continue
            return dict(doc)
        return None

    async def insert_one(self, doc):
        stored = dict(doc)
        self.docs[stored["id"]] = stored
        return MagicMock(inserted_id=stored["id"])

    async def replace_one(self, query, doc):
        self.docs[doc["id"]] = dict(doc)
        return MagicMock()

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
        if name == SESSIONS_COLLECTION:
            return self.sessions
        return self.sessions


def test_start_activity_links_to_workout_exercise():
    db = FakeDB()
    doc = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "gps",
                "activity_kind": "running",
                "exercise_id": "activity:outdoor_running",
                "exercise_name_snapshot": "Course",
                "scheduled_workout_id": "workout123",
                "workout_exercise_index": 0,
                "workout_session_id": None,
            },
        )
    )
    assert doc["scheduled_workout_id"] == "workout123"
    assert doc["workout_exercise_index"] == 0
    assert doc["status"] == "active"


def test_start_activity_reuses_linked_session():
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
    second = asyncio.run(
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
    assert first["id"] == second["id"]


def test_list_excludes_workout_linked_by_default():
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
    db.sessions.docs[linked["id"]]["status"] = "completed"
    items = asyncio.run(service.list_activities(db, "user1"))
    assert items == []

    standalone = asyncio.run(
        service.start_activity(
            db,
            "user1",
            {
                "tracking_mode": "timer",
                "activity_kind": "yoga",
                "force_discard_current": True,
            },
        )
    )
    db.sessions.docs[standalone["id"]]["status"] = "completed"
    items2 = asyncio.run(service.list_activities(db, "user1"))
    assert len(items2) == 1
    assert items2[0]["id"] == standalone["id"]


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
    db.sessions.docs[doc["id"]]["status"] = "completed"
    with pytest.raises(service.ActivityValidationError):
        asyncio.run(
            service.publish_activity(
                db,
                doc["id"],
                "user1",
                {"visibility": "public"},
                create_post_fn=AsyncMock(),
            )
        )

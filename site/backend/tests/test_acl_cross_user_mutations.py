"""Tests ACL — mutations cross-user refusées avec payload valide."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi import HTTPException

OWNER_ID = str(ObjectId())
ATTACKER_ID = str(ObjectId())
OUTSIDER_ID = str(ObjectId())
OUTSIDER_PARTNER_ID = str(ObjectId())


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_workout_cross_user_valid_put_forbidden():
    from server import ScheduledWorkoutCreate, update_workout

    workout_id = ObjectId()
    workout_doc = {
        "_id": workout_id,
        "creator_id": OWNER_ID,
        "title": "QA Browser Workout CRUD",
        "description": "desc",
        "scheduled_date": "2026-08-24",
        "scheduled_time": "09:00",
        "difficulty": "medium",
        "blocks": [],
        "is_draft": False,
    }
    payload = ScheduledWorkoutCreate(
        title="QA Browser Workout CRUD",
        description="desc",
        scheduled_date="2026-08-24",
        scheduled_time="09:00",
        difficulty="medium",
        blocks=[],
        is_draft=False,
    )

    mock_db = MagicMock()
    mock_db.scheduled_workouts = MagicMock()
    mock_db.scheduled_workouts.find_one = AsyncMock(return_value=workout_doc)
    mock_db.scheduled_workouts.update_one = AsyncMock()

    attacker = {"id": ATTACKER_ID, "username": "qab"}

    with patch("server.db", mock_db):
        with pytest.raises(HTTPException) as exc:
            _run(update_workout(str(workout_id), payload, attacker))

    assert exc.value.status_code == 403
    mock_db.scheduled_workouts.update_one.assert_not_called()


def test_duo_outsider_valid_mutation_forbidden():
    from server import patch_duo_roles

    target_pair_key = "qaaqab#4574"
    outsider_duo = {
        "_id": ObjectId(),
        "pair_key": "qacqad#9999",
        "member_ids": [OUTSIDER_ID, OUTSIDER_PARTNER_ID],
    }
    outsider = {
        "id": OUTSIDER_ID,
        "username": "qac",
        "partner_id": OUTSIDER_PARTNER_ID,
    }

    mock_db = MagicMock()

    with patch("server.db", mock_db), patch(
        "server._get_duo_profile_for_user", new=AsyncMock(return_value=outsider_duo)
    ), patch(
        "server.resolve_duo_pair_key", return_value=outsider_duo["pair_key"]
    ):
        with pytest.raises(HTTPException) as exc:
            _run(
                patch_duo_roles(
                    target_pair_key,
                    {"roles": {OUTSIDER_ID: "coach", OUTSIDER_PARTNER_ID: "student"}},
                    outsider,
                )
            )

    assert exc.value.status_code == 403

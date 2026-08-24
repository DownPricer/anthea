"""Tests modèles de séance — suppression indépendante des séances planifiées."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

TEMPLATE_ID = str(ObjectId())
USER_ID = "507f1f77bcf86cd799439011"
WORKOUT_ID = str(ObjectId())


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_delete_template_preserves_scheduled_workouts():
    from server import delete_template

    template = {
        "_id": ObjectId(TEMPLATE_ID),
        "user_id": USER_ID,
        "title": "Push A",
        "is_system": False,
    }
    scheduled = {
        "_id": ObjectId(WORKOUT_ID),
        "user_id": USER_ID,
        "template_id": TEMPLATE_ID,
        "title": "Push A",
        "is_draft": False,
    }

    mock_db = MagicMock()
    mock_db.workout_templates = MagicMock()
    mock_db.workout_templates.find_one = AsyncMock(return_value=template)
    mock_db.workout_templates.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    mock_db.scheduled_workouts = MagicMock()
    mock_db.scheduled_workouts.find_one = AsyncMock(return_value=scheduled)
    mock_db.scheduled_workouts.delete_one = AsyncMock()

    user = {"id": USER_ID, "username": "tester"}

    with patch("server.db", mock_db):
        result = _run(delete_template(TEMPLATE_ID, user))

    assert result == {"message": "Template deleted"}
    mock_db.workout_templates.delete_one.assert_awaited_once()
    mock_db.scheduled_workouts.delete_one.assert_not_called()
    mock_db.scheduled_workouts.find_one.assert_not_called()

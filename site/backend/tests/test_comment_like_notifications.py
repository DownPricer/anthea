"""Tests notifications groupées comment_like."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.notifications = MagicMock()
    db.notifications.find_one = AsyncMock(return_value=None)
    db.notifications.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    db.notifications.update_one = AsyncMock()
    db.notifications.delete_one = AsyncMock()
    return db


def test_comment_like_self_ignored(mock_db):
    from server import upsert_comment_like_notification

    actor = {"id": "u1", "username": "alice"}
    with patch("server.db", mock_db):
        _run(upsert_comment_like_notification("u1", actor, "p1", "c1", liked=True))
    mock_db.notifications.insert_one.assert_not_called()


def test_comment_like_first_creates_and_pushes(mock_db):
    from server import upsert_comment_like_notification

    actor = {"id": "u2", "username": "bob", "display_name": "Bob"}
    with patch("server.db", mock_db), patch(
        "server._send_comment_like_push", new=AsyncMock()
    ) as mock_push:
        _run(upsert_comment_like_notification("u1", actor, "p1", "c1", liked=True))

    mock_db.notifications.insert_one.assert_called_once()
    doc = mock_db.notifications.insert_one.call_args[0][0]
    assert doc["type"] == "comment_like"
    assert doc["actor_count"] == 1
    assert doc["group_key"].startswith("comment_like:c1:")
    mock_push.assert_called_once()
    assert mock_push.call_args.kwargs.get("aggregated") is False


def test_comment_like_second_updates_group_and_sends_aggregated_push(mock_db):
    from server import upsert_comment_like_notification

    existing_id = ObjectId()
    mock_db.notifications.find_one = AsyncMock(return_value={
        "_id": existing_id,
        "actor_ids": ["u2"],
        "actor_count": 1,
        "push_sent_level": 1,
        "group_key": "comment_like:c1:123",
    })
    actor = {"id": "u3", "username": "carol"}

    with patch("server.db", mock_db), patch(
        "server._send_comment_like_push", new=AsyncMock()
    ) as mock_push:
        _run(upsert_comment_like_notification("u1", actor, "p1", "c1", liked=True))

    mock_db.notifications.update_one.assert_called()
    mock_push.assert_called_once()
    assert mock_push.call_args.kwargs.get("aggregated") is True
    mock_db.notifications.insert_one.assert_not_called()


def test_comment_like_duplicate_actor_ignored(mock_db):
    from server import upsert_comment_like_notification

    mock_db.notifications.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "actor_ids": ["u2"],
        "actor_count": 1,
        "push_sent_level": 1,
    })
    actor = {"id": "u2", "username": "bob"}

    with patch("server.db", mock_db), patch(
        "server._send_comment_like_push", new=AsyncMock()
    ) as mock_push:
        _run(upsert_comment_like_notification("u1", actor, "p1", "c1", liked=True))

    mock_push.assert_not_called()
    mock_db.notifications.insert_one.assert_not_called()


def test_comment_unlike_decrements_and_deletes_at_zero(mock_db):
    from server import upsert_comment_like_notification

    existing_id = ObjectId()
    mock_db.notifications.find_one = AsyncMock(return_value={
        "_id": existing_id,
        "actor_ids": ["u2"],
        "actor_count": 1,
    })
    actor = {"id": "u2", "username": "bob"}

    with patch("server.db", mock_db), patch(
        "server.get_user_doc_by_id", new=AsyncMock(return_value=None)
    ), patch("server._send_comment_like_push", new=AsyncMock()) as mock_push:
        _run(upsert_comment_like_notification("u1", actor, "p1", "c1", liked=False))

    mock_db.notifications.delete_one.assert_called_once_with({"_id": existing_id})
    mock_push.assert_not_called()


def test_group_key_window_format():
    from server import _comment_like_group_key

    now = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    key = _comment_like_group_key("abc", now)
    assert key.startswith("comment_like:abc:")

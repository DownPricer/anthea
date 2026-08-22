"""Tests du script reset pending follow requests."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.follow_requests = MagicMock()
    db.follows = MagicMock()
    db.notifications = MagicMock()
    return db


def test_reset_dry_run_counts_pending(mock_db):
    from scripts.reset_pending_follow_requests import reset_pending_follow_requests

    req_a = {"_id": ObjectId(), "status": "pending"}
    req_b = {"_id": ObjectId(), "status": "pending"}
    req_c = {"_id": ObjectId(), "status": "accepted"}

    mock_db.follow_requests.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[req_a, req_b]))
    )
    mock_db.follow_requests.count_documents = AsyncMock(side_effect=lambda q: 1 if q.get("status") == "accepted" else 0)
    mock_db.follows.count_documents = AsyncMock(return_value=5)
    mock_db.notifications.count_documents = AsyncMock(return_value=2)

    with patch("scripts.reset_pending_follow_requests.AsyncIOMotorClient") as client_cls:
        client = MagicMock()
        client.__getitem__ = MagicMock(return_value=mock_db)
        client.close = MagicMock()
        client_cls.return_value = client
        report = _run(reset_pending_follow_requests(apply=False))

    assert report["dry_run"] is True
    assert report["pending_found"] == 2
    assert report["pending_deleted"] == 0
    assert report["obsolete_notifications_found"] == 2
    assert report["accepted_preserved"] == 1
    assert report["relations_deleted"] == 0


def test_reset_apply_deletes_only_pending(mock_db):
    from scripts.reset_pending_follow_requests import reset_pending_follow_requests

    pending_id = ObjectId()
    pending_doc = {"_id": pending_id, "status": "pending"}

    mock_db.follow_requests.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[pending_doc]))
    )
    mock_db.follow_requests.delete_many = AsyncMock(return_value=MagicMock(deleted_count=1))
    mock_db.follow_requests.count_documents = AsyncMock(return_value=1)
    mock_db.follows.count_documents = AsyncMock(return_value=3)
    mock_db.notifications.count_documents = AsyncMock(return_value=1)
    mock_db.notifications.delete_many = AsyncMock(return_value=MagicMock(deleted_count=1))

    with patch("scripts.reset_pending_follow_requests.AsyncIOMotorClient") as client_cls:
        client = MagicMock()
        client.__getitem__ = MagicMock(return_value=mock_db)
        client.close = MagicMock()
        client_cls.return_value = client
        report = _run(reset_pending_follow_requests(apply=True))

    assert report["pending_deleted"] == 1
    assert report["obsolete_notifications_deleted"] == 1
    assert report["relations_deleted"] == 0
    mock_db.follow_requests.delete_many.assert_called_once_with({"status": "pending"})

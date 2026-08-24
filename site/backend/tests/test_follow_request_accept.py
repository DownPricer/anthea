"""Tests acceptation demande de suivi — idempotence et codes HTTP."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi import HTTPException

REQUESTER_ID = str(ObjectId())
TARGET_ID = str(ObjectId())
OTHER_ID = str(ObjectId())


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _accepter(user_id: str) -> dict:
    return {"id": user_id, "username": "target", "handle": "target"}


def _pending_request(requester_id: str, target_id: str, req_id=None) -> dict:
    return {
        "_id": req_id or ObjectId(),
        "requester_id": requester_id,
        "target_id": target_id,
        "status": "pending",
    }


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.follows = MagicMock()
    db.follows.find_one = AsyncMock(return_value=None)
    db.follows.insert_one = AsyncMock()
    db.follow_requests = MagicMock()
    db.follow_requests.update_one = AsyncMock()
    db.users = MagicMock()
    db.users.update_one = AsyncMock()
    db.notifications = MagicMock()
    db.notifications.find_one = AsyncMock(return_value=None)
    db.notifications.insert_one = AsyncMock()
    db.notifications.delete_many = AsyncMock()
    return db


def test_accept_follow_request_uses_accepter_id_not_internal_id(mock_db):
    from server import _accept_follow_request

    request_doc = _pending_request(REQUESTER_ID, TARGET_ID)
    accepter = _accepter(TARGET_ID)

    with patch("server.db", mock_db), patch(
        "server.get_user_doc_by_id", new=AsyncMock(return_value={"_id": REQUESTER_ID})
    ), patch("server.create_notification", new=AsyncMock()) as mock_notif:
        result = _run(_accept_follow_request(request_doc, accepter))

    assert result["status"] == "accepted"
    mock_db.follows.insert_one.assert_called_once()
    mock_notif.assert_called_once()


def test_accept_follow_request_idempotent_already_accepted(mock_db):
    from server import _accept_follow_request

    req_id = ObjectId()
    request_doc = {
        **_pending_request(REQUESTER_ID, TARGET_ID, req_id),
        "status": "accepted",
    }
    accepter = _accepter(TARGET_ID)
    mock_db.follows.find_one = AsyncMock(
        return_value={"follower_id": REQUESTER_ID, "following_id": TARGET_ID}
    )

    with patch("server.db", mock_db), patch(
        "server.create_notification", new=AsyncMock()
    ) as mock_notif:
        result = _run(_accept_follow_request(request_doc, accepter))

    assert result["status"] == "already_accepted"
    mock_db.follows.insert_one.assert_not_called()
    mock_notif.assert_not_called()


def test_accept_follow_request_wrong_target(mock_db):
    from server import _accept_follow_request

    request_doc = _pending_request(REQUESTER_ID, TARGET_ID)
    accepter = _accepter(OTHER_ID)

    with patch("server.db", mock_db):
        with pytest.raises(HTTPException) as exc:
            _run(_accept_follow_request(request_doc, accepter))
    assert exc.value.status_code == 403


def test_accept_endpoint_invalid_id_returns_400():
    from server import accept_follow_request

    user = _accepter(TARGET_ID)
    with pytest.raises(HTTPException) as exc:
        _run(accept_follow_request("not-an-object-id", user))
    assert exc.value.status_code == 400


def test_accept_endpoint_not_found(mock_db):
    from server import accept_follow_request

    user = _accepter(TARGET_ID)
    mock_db.follow_requests.find_one = AsyncMock(return_value=None)

    with patch("server.db", mock_db):
        with pytest.raises(HTTPException) as exc:
            _run(accept_follow_request(str(ObjectId()), user))
    assert exc.value.status_code == 404


def test_accept_endpoint_wrong_recipient(mock_db):
    from server import accept_follow_request

    user = _accepter(TARGET_ID)
    mock_db.follow_requests.find_one = AsyncMock(
        return_value=_pending_request(REQUESTER_ID, OTHER_ID)
    )

    with patch("server.db", mock_db):
        with pytest.raises(HTTPException) as exc:
            _run(accept_follow_request(str(ObjectId()), user))
    assert exc.value.status_code == 403


def test_double_accept_does_not_duplicate_follow(mock_db):
    from server import _accept_follow_request

    request_doc = _pending_request(REQUESTER_ID, TARGET_ID)
    accepter = _accepter(TARGET_ID)

    async def run_twice():
        with patch("server.db", mock_db), patch(
            "server.get_user_doc_by_id", new=AsyncMock(return_value={"_id": REQUESTER_ID})
        ), patch("server.create_notification", new=AsyncMock()):
            first = await _accept_follow_request(request_doc, accepter)
            request_doc["status"] = "accepted"
            mock_db.follows.find_one = AsyncMock(
                return_value={"follower_id": REQUESTER_ID, "following_id": TARGET_ID}
            )
            second = await _accept_follow_request(request_doc, accepter)
        return first, second

    first, second = _run(run_twice())
    assert first["status"] == "accepted"
    assert second["status"] == "already_accepted"
    assert mock_db.follows.insert_one.call_count == 1

"""Tests follow requests listing, cancel, followers/following."""

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


def _user(uid: str, username: str = "user") -> dict:
    return {
        "_id": ObjectId(uid),
        "id": uid,
        "username": username,
        "handle": username,
        "display_name": username.title(),
        "avatar_url": None,
        "account_visibility": "private",
        "followers_count": 0,
        "following_count": 0,
    }


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.follow_requests = MagicMock()
    db.follows = MagicMock()
    db.users = MagicMock()
    db.notifications = MagicMock()
    db.notifications.delete_many = AsyncMock()
    return db


def test_list_follow_requests_incoming_outgoing(mock_db):
    from server import list_follow_requests

    inc_id = ObjectId()
    out_id = ObjectId()
    mock_db.follow_requests.find = MagicMock(side_effect=[
        MagicMock(sort=MagicMock(return_value=MagicMock(
            limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[{
                "_id": inc_id,
                "requester_id": REQUESTER_ID,
                "target_id": TARGET_ID,
                "status": "pending",
                "created_at": "2026-01-01T00:00:00+00:00",
            }])))
        ))),
        MagicMock(sort=MagicMock(return_value=MagicMock(
            limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[{
                "_id": out_id,
                "requester_id": TARGET_ID,
                "target_id": OTHER_ID,
                "status": "pending",
                "created_at": "2026-01-02T00:00:00+00:00",
            }])))
        ))),
    ])

    async def get_user(uid):
        if uid == REQUESTER_ID:
            return _user(REQUESTER_ID, "alice")
        if uid == OTHER_ID:
            return _user(OTHER_ID, "bob")
        return None

    user = {"id": TARGET_ID}
    with patch("server.db", mock_db), patch("server.get_user_doc_by_id", new=AsyncMock(side_effect=get_user)):
        result = _run(list_follow_requests(user))

    assert len(result["incoming"]) == 1
    assert result["incoming"][0]["request_id"] == str(inc_id)
    assert result["incoming"][0]["handle"] == "alice"
    assert "password" not in result["incoming"][0]
    assert len(result["outgoing"]) == 1
    assert result["outgoing"][0]["status"] == "pending"


def test_cancel_follow_request_idempotent(mock_db):
    from server import cancel_follow_request

    req_id = ObjectId()
    mock_db.follow_requests.find_one = AsyncMock(return_value={
        "_id": req_id,
        "requester_id": REQUESTER_ID,
        "target_id": TARGET_ID,
        "status": "pending",
    })
    mock_db.follow_requests.delete_one = AsyncMock()

    user = {"id": REQUESTER_ID}
    with patch("server.db", mock_db), patch("server._cleanup_follow_request_notifications", new=AsyncMock()) as cleanup:
        first = _run(cancel_follow_request(str(req_id), user))
        mock_db.follow_requests.find_one = AsyncMock(return_value=None)
        second = _run(cancel_follow_request(str(req_id), user))

    assert first["status"] == "ok"
    assert second["status"] == "ok"
    cleanup.assert_called_once()


def test_cancel_accepted_request_forbidden(mock_db):
    from server import cancel_follow_request

    req_id = ObjectId()
    mock_db.follow_requests.find_one = AsyncMock(return_value={
        "_id": req_id,
        "requester_id": REQUESTER_ID,
        "target_id": TARGET_ID,
        "status": "accepted",
    })

    user = {"id": REQUESTER_ID}
    with patch("server.db", mock_db):
        with pytest.raises(HTTPException) as exc:
            _run(cancel_follow_request(str(req_id), user))
    assert exc.value.status_code == 400


def test_list_followers_pagination(mock_db):
    from server import list_user_followers

    target = _user(TARGET_ID, "target")
    follower = _user(REQUESTER_ID, "alice")
    follow_doc = {
        "follower_id": REQUESTER_ID,
        "following_id": TARGET_ID,
        "created_at": "2026-01-01T00:00:00+00:00",
    }

    mock_db.follows.find = MagicMock(return_value=MagicMock(
        sort=MagicMock(return_value=MagicMock(
            limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[follow_doc])))
        ))
    ))

    user = {"id": OTHER_ID}
    with patch("server.db", mock_db), patch(
        "server.find_user_by_handle", new=AsyncMock(return_value=target)
    ), patch(
        "server.get_profile_access_level", new=AsyncMock(return_value="public")
    ), patch(
        "server.get_user_doc_by_id", new=AsyncMock(return_value=follower)
    ), patch(
        "server.get_follow_relation", new=AsyncMock(return_value={
            "is_following": False,
            "is_followed_by": False,
            "is_mutual": False,
            "follow_request_pending": False,
            "incoming_follow_request": False,
        })
    ):
        result = _run(list_user_followers("target", 30, None, user))

    assert len(result["items"]) == 1
    assert result["items"][0]["handle"] == "alice"
    assert "email" not in result["items"][0]

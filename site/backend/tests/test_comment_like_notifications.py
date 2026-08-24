"""Tests notifications groupées comment_like."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

AUTHOR_ID = "author-1"
USER_A = "user-a"
USER_B = "user-b"
USER_C = "user-c"
COMMENT_1 = "comment-1"
COMMENT_2 = "comment-2"
POST_ID = "post-1"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _actor(user_id: str, username: str | None = None) -> dict:
    return {"id": user_id, "username": username or user_id, "display_name": username or user_id}


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.notifications = MagicMock()
    db.notifications.find_one = AsyncMock(return_value=None)
    db.notifications.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    db.notifications.update_one = AsyncMock()
    db.notifications.delete_one = AsyncMock()
    return db


def _stored_notification(mock_db):
    return mock_db.notifications.insert_one.call_args[0][0]


def _last_update_set(mock_db):
    return mock_db.notifications.update_one.call_args[0][1]["$set"]


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
    doc = _stored_notification(mock_db)
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
        "comment_id": "c1",
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


def test_synced_like_unlike_sequence(mock_db):
    from server import upsert_comment_like_notification

    stored = {"doc": None}

    async def find_one(query, sort=None):
        doc = stored["doc"]
        if not doc:
            return None
        if (
            doc.get("user_id") == query.get("user_id")
            and doc.get("type") == query.get("type")
            and doc.get("comment_id") == query.get("comment_id")
        ):
            return doc
        return None

    async def insert_one(doc):
        stored["doc"] = {**doc, "_id": ObjectId()}
        return MagicMock(inserted_id=stored["doc"]["_id"])

    async def update_one(filter_doc, update):
        if stored["doc"] and stored["doc"]["_id"] == filter_doc["_id"]:
            stored["doc"].update(update.get("$set", {}))

    async def delete_one(filter_doc):
        if stored["doc"] and stored["doc"]["_id"] == filter_doc["_id"]:
            stored["doc"] = None

    mock_db.notifications.find_one = AsyncMock(side_effect=find_one)
    mock_db.notifications.insert_one = AsyncMock(side_effect=insert_one)
    mock_db.notifications.update_one = AsyncMock(side_effect=update_one)
    mock_db.notifications.delete_one = AsyncMock(side_effect=delete_one)

    def sync(likes, actor, liked):
        with patch("server.db", mock_db), patch(
            "server._send_comment_like_push", new=AsyncMock()
        ), patch("server.get_user_doc_by_id", new=AsyncMock(return_value=actor)):
            _run(
                upsert_comment_like_notification(
                    AUTHOR_ID,
                    actor,
                    POST_ID,
                    COMMENT_1,
                    liked=liked,
                    current_liker_ids=likes,
                )
            )

    sync([USER_A], _actor(USER_A), True)
    assert stored["doc"]["actor_count"] == 1
    assert stored["doc"]["actor_ids"] == [USER_A]

    sync([USER_A, USER_B], _actor(USER_B), True)
    assert stored["doc"]["actor_count"] == 2
    assert stored["doc"]["actor_ids"] == [USER_A, USER_B]

    sync([USER_A, USER_B, USER_C], _actor(USER_C), True)
    assert stored["doc"]["actor_count"] == 3
    assert stored["doc"]["actor_ids"] == [USER_A, USER_B, USER_C]

    sync([USER_A, USER_C], _actor(USER_B), False)
    assert stored["doc"]["actor_count"] == 2
    assert USER_B not in stored["doc"]["actor_ids"]

    sync([USER_A], _actor(USER_C), False)
    assert stored["doc"]["actor_count"] == 1
    assert stored["doc"]["actor_ids"] == [USER_A]

    sync([], _actor(USER_A), False)
    assert stored["doc"] is None

    sync([USER_A], _actor(USER_A), True)
    assert stored["doc"]["actor_count"] == 1
    assert stored["doc"]["actor_ids"] == [USER_A]


def test_unlike_resyncs_stale_group_key(mock_db):
    from server import upsert_comment_like_notification

    existing_id = ObjectId()
    mock_db.notifications.find_one = AsyncMock(return_value={
        "_id": existing_id,
        "user_id": AUTHOR_ID,
        "type": "comment_like",
        "comment_id": COMMENT_1,
        "group_key": "comment_like:comment-1:0",
        "actor_ids": [USER_A, USER_B],
        "actor_count": 2,
    })

    with patch("server.db", mock_db), patch(
        "server.get_user_doc_by_id", new=AsyncMock(return_value=_actor(USER_A))
    ), patch("server._send_comment_like_push", new=AsyncMock()) as mock_push:
        _run(
            upsert_comment_like_notification(
                AUTHOR_ID,
                _actor(USER_B),
                POST_ID,
                COMMENT_1,
                liked=False,
                current_liker_ids=[USER_A],
            )
        )

    update_set = _last_update_set(mock_db)
    assert update_set["actor_count"] == 1
    assert update_set["actor_ids"] == [USER_A]
    mock_push.assert_not_called()


def test_relike_keeps_single_actor_entry(mock_db):
    from server import upsert_comment_like_notification

    existing_id = ObjectId()
    mock_db.notifications.find_one = AsyncMock(return_value={
        "_id": existing_id,
        "actor_ids": [USER_A],
        "actor_count": 1,
        "push_sent_level": 1,
        "comment_id": COMMENT_1,
    })

    with patch("server.db", mock_db), patch(
        "server._send_comment_like_push", new=AsyncMock()
    ) as mock_push:
        _run(
            upsert_comment_like_notification(
                AUTHOR_ID,
                _actor(USER_A),
                POST_ID,
                COMMENT_1,
                liked=True,
                current_liker_ids=[USER_A],
            )
        )

    update_set = _last_update_set(mock_db)
    assert update_set["actor_count"] == 1
    assert update_set["actor_ids"] == [USER_A]
    mock_push.assert_not_called()


def test_different_comments_have_distinct_group_keys():
    from server import _comment_like_group_key

    now = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
    assert _comment_like_group_key(COMMENT_1, now) != _comment_like_group_key(COMMENT_2, now)


def test_toggle_comment_like_keeps_likes_and_notification_in_sync():
    from server import toggle_comment_like

    post_id = str(ObjectId())
    comment_id = COMMENT_1
    comments = [{
        "id": comment_id,
        "user_id": AUTHOR_ID,
        "username": "author",
        "likes": [],
    }]
    post = {"_id": ObjectId(post_id), "author_id": AUTHOR_ID, "comments": comments}
    stored_notif = {"doc": None}

    async def find_post(*args, **kwargs):
        return {**post, "comments": list(comments)}

    async def update_post(*args, **kwargs):
        post["comments"] = comments

    async def find_notif(query, sort=None):
        doc = stored_notif["doc"]
        if not doc:
            return None
        if doc.get("comment_id") == query.get("comment_id"):
            return doc
        return None

    async def insert_notif(doc):
        stored_notif["doc"] = {**doc, "_id": ObjectId()}

    async def update_notif(filter_doc, update):
        if stored_notif["doc"]:
            stored_notif["doc"].update(update.get("$set", {}))

    async def delete_notif(filter_doc):
        stored_notif["doc"] = None

    mock_db = MagicMock()
    mock_db.posts = MagicMock()
    mock_db.posts.find_one = AsyncMock(side_effect=find_post)
    mock_db.posts.update_one = AsyncMock(side_effect=update_post)
    mock_db.notifications = MagicMock()
    mock_db.notifications.find_one = AsyncMock(side_effect=find_notif)
    mock_db.notifications.insert_one = AsyncMock(side_effect=insert_notif)
    mock_db.notifications.update_one = AsyncMock(side_effect=update_notif)
    mock_db.notifications.delete_one = AsyncMock(side_effect=delete_notif)

    async def like_as(user_id):
        user = _actor(user_id)
        with patch("server.db", mock_db), patch(
            "server.can_view_post_doc", new=AsyncMock(return_value=True)
        ), patch("server._send_comment_like_push", new=AsyncMock()), patch(
            "server.get_user_doc_by_id", new=AsyncMock(return_value=user)
        ):
            return await toggle_comment_like(post_id, comment_id, user)

    async def run_flow():
        await like_as(USER_A)
        await like_as(USER_B)
        await like_as(USER_C)
        await like_as(USER_B)
        await like_as(USER_C)
        final = await like_as(USER_A)
        return final

    final = _run(run_flow())
    assert final["likes_count"] == 0
    assert stored_notif["doc"] is None

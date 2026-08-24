"""Tests réponses aux commentaires."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

POST_ID = str(ObjectId())
AUTHOR_ID = str(ObjectId())
REPLIER_ID = str(ObjectId())
ROOT_COMMENT_ID = "root-comment-1"
REPLY_COMMENT_ID = "reply-comment-1"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_serialize_comments_threaded():
    from server import _serialize_comments_threaded

    comments = [
        {
            "id": ROOT_COMMENT_ID,
            "user_id": AUTHOR_ID,
            "username": "author",
            "text": "Super séance",
            "likes": [],
            "created_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": REPLY_COMMENT_ID,
            "user_id": REPLIER_ID,
            "username": "marie",
            "text": "Bravo !",
            "parent_comment_id": ROOT_COMMENT_ID,
            "reply_to_user_id": AUTHOR_ID,
            "reply_to_handle": "author",
            "likes": [],
            "created_at": "2026-01-01T01:00:00+00:00",
        },
    ]
    threaded = _serialize_comments_threaded(comments, AUTHOR_ID)
    assert len(threaded) == 1
    assert threaded[0]["id"] == ROOT_COMMENT_ID
    assert len(threaded[0]["replies"]) == 1
    assert threaded[0]["replies"][0]["parent_comment_id"] == ROOT_COMMENT_ID


def test_count_root_comments_excludes_replies():
    from server import _count_root_comments, _preview_root_comments

    comments = [
        {
            "id": ROOT_COMMENT_ID,
            "user_id": AUTHOR_ID,
            "username": "author",
            "text": "Root",
            "likes": [],
        },
        {
            "id": REPLY_COMMENT_ID,
            "user_id": REPLIER_ID,
            "username": "marie",
            "text": "Reply",
            "parent_comment_id": ROOT_COMMENT_ID,
            "likes": [],
        },
    ]
    assert _count_root_comments(comments) == 1
    preview = _preview_root_comments(comments, AUTHOR_ID, limit=2)
    assert len(preview) == 1
    assert len(preview[0]["replies"]) == 1


def test_add_post_comment_reply_notifies_parent():
    from server import add_post_comment, PostCommentCreate

    root = {
        "id": ROOT_COMMENT_ID,
        "user_id": AUTHOR_ID,
        "username": "author",
        "handle": "author",
        "display_name": "Author",
        "text": "Root",
        "likes": [],
    }
    post = {
        "_id": ObjectId(POST_ID),
        "author_id": AUTHOR_ID,
        "created_by_user_id": AUTHOR_ID,
        "comments": [root],
    }

    mock_db = MagicMock()
    mock_db.posts = MagicMock()
    mock_db.posts.find_one = AsyncMock(side_effect=[post, {**post, "comments": [root, {
        "id": "new-reply",
        "user_id": REPLIER_ID,
        "parent_comment_id": ROOT_COMMENT_ID,
        "reply_to_user_id": AUTHOR_ID,
        "text": "@author cool",
        "likes": [],
    }]}])
    mock_db.posts.update_one = AsyncMock()

    user = {
        "id": REPLIER_ID,
        "username": "marie",
        "handle": "marie",
        "display_name": "Marie",
    }

    with patch("server.db", mock_db), patch(
        "server.can_view_post_doc", new=AsyncMock(return_value=True)
    ), patch("server.create_notification", new=AsyncMock()) as notif:
        _run(add_post_comment(POST_ID, PostCommentCreate(text="Bravo", parent_comment_id=ROOT_COMMENT_ID), user))

    notif.assert_called_once()
    args, kwargs = notif.call_args
    assert args[0] == AUTHOR_ID
    assert args[1] == "comment_reply"
    assert kwargs.get("post_id") == POST_ID
    assert kwargs.get("comment_id")


def test_add_post_comment_self_reply_no_notification():
    from server import add_post_comment, PostCommentCreate

    root = {
        "id": ROOT_COMMENT_ID,
        "user_id": AUTHOR_ID,
        "username": "author",
        "handle": "author",
        "text": "Root",
        "likes": [],
    }
    post = {"_id": ObjectId(POST_ID), "author_id": AUTHOR_ID, "comments": [root]}

    mock_db = MagicMock()
    mock_db.posts = MagicMock()
    mock_db.posts.find_one = AsyncMock(side_effect=[post, post])
    mock_db.posts.update_one = AsyncMock()

    user = {"id": AUTHOR_ID, "username": "author", "handle": "author"}

    with patch("server.db", mock_db), patch(
        "server.can_view_post_doc", new=AsyncMock(return_value=True)
    ), patch("server.create_notification", new=AsyncMock()) as notif:
        _run(add_post_comment(POST_ID, PostCommentCreate(text="Self", parent_comment_id=ROOT_COMMENT_ID), user))

    notif.assert_not_called()


def test_reply_to_reply_flattens_to_root():
    from server import add_post_comment, PostCommentCreate

    root = {"id": ROOT_COMMENT_ID, "user_id": AUTHOR_ID, "username": "a", "handle": "a", "likes": []}
    first_reply = {
        "id": REPLY_COMMENT_ID,
        "user_id": REPLIER_ID,
        "username": "marie",
        "handle": "marie",
        "parent_comment_id": ROOT_COMMENT_ID,
        "likes": [],
    }
    post = {"_id": ObjectId(POST_ID), "author_id": AUTHOR_ID, "comments": [root, first_reply]}

    captured = {}

    async def capture_update(*args, **kwargs):
        update = args[1] if len(args) > 1 else kwargs.get("update") or {}
        captured["push"] = update.get("$push", {}).get("comments")

    mock_db = MagicMock()
    mock_db.posts = MagicMock()
    mock_db.posts.find_one = AsyncMock(side_effect=[post, post])
    mock_db.posts.update_one = AsyncMock(side_effect=capture_update)

    user = {"id": "third-user", "username": "lucas", "handle": "lucas"}

    with patch("server.db", mock_db), patch(
        "server.can_view_post_doc", new=AsyncMock(return_value=True)
    ), patch("server.create_notification", new=AsyncMock()):
        _run(add_post_comment(
            POST_ID,
            PostCommentCreate(text="Oui", parent_comment_id=REPLY_COMMENT_ID),
            user,
        ))

    assert captured["push"]["parent_comment_id"] == ROOT_COMMENT_ID
    assert captured["push"]["reply_to_user_id"] == REPLIER_ID

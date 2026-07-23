"""Tests des permissions de republication et des champs can_repost."""

from unittest.mock import AsyncMock, patch
import asyncio


def test_repost_forbidden_detail_shapes():
    from server import repost_forbidden_detail

    detail = repost_forbidden_detail("private_post")
    assert detail["code"] == "REPOST_NOT_ALLOWED"
    assert detail["reason"] == "private_post"
    assert "confidentialité" in detail["message"].lower() or "confidential" in detail["message"].lower()

    own = repost_forbidden_detail("own_post")
    assert own["reason"] == "own_post"
    assert "republiée" in own["message"].lower() or "republi" in own["message"].lower()


def test_can_user_repost_public_post_allowed():
    from server import can_user_repost_post

    viewer = "viewer1"
    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {
        "author_id": "author1",
        "visibility": "public",
        "type": "workout",
        "workout_session_id": "sess1",
    }

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post", new=AsyncMock(return_value=True)):
                return await can_user_repost_post(viewer, post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is True
    assert reason is None


def test_can_user_repost_public_workout_photo_allowed():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {
        "author_id": "author1",
        "visibility": "public",
        "type": "workout_photo",
    }

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post", new=AsyncMock(return_value=True)):
                return await can_user_repost_post("viewer1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is True
    assert reason is None


def test_can_user_repost_private_post_denied():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "private", "type": "free"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post", new=AsyncMock(return_value=False)):
                return await can_user_repost_post("viewer1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "private_post"


def test_can_user_repost_friends_only_denied_for_non_friend_path():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "friends", "type": "free"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            # Même si le viewer voit le post (ami), republication publique interdite
            with patch("server.can_view_post", new=AsyncMock(return_value=True)):
                return await can_user_repost_post("friend1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "friends_only"


def test_can_user_repost_private_profile_no_leak():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "private",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "public", "type": "free"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post", new=AsyncMock(return_value=True)):
                return await can_user_repost_post("follower1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "limited_visibility"


def test_can_user_repost_own_post_denied():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "public", "type": "badge"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            return await can_user_repost_post("author1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "own_post"


def test_can_user_repost_followers_only_posts_denied():
    from server import can_user_repost_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "followers",
    }
    post = {"author_id": "author1", "visibility": "public", "type": "duo_repost"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post", new=AsyncMock(return_value=True)):
                return await can_user_repost_post("follower1", post, author)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "limited_visibility"


def test_can_user_repost_missing_author_denied():
    from server import can_user_repost_post

    post = {"author_id": "missing", "visibility": "public"}

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.get_user_doc_by_id", new=AsyncMock(return_value=None)):
                return await can_user_repost_post("viewer1", post, None)

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is False
    assert reason == "not_allowed"


def test_can_user_repost_public_duo_wall_allowed():
    from server import can_user_repost_post

    post = {
        "owner_type": "duo",
        "visibility": "public",
        "type": "duo",
        "author_id": "member1",
    }
    duo_doc = {
        "account_visibility": "public",
        "show_posts": True,
        "member_ids": ["member1", "member2"],
    }

    async def run():
        with patch("server.is_duo_wall_post", return_value=True):
            with patch("server.can_delete_post", new=AsyncMock(return_value=False)):
                with patch("server.can_view_duo_post", new=AsyncMock(return_value=True)):
                    with patch("server.apply_duo_defaults", side_effect=lambda d: d):
                        return await can_user_repost_post(
                            "viewer1", post, None, duo_doc=duo_doc
                        )

    ok, reason = asyncio.get_event_loop().run_until_complete(run())
    assert ok is True
    assert reason is None

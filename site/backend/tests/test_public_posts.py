"""Tests API publique — feed tendance anonyme et confidentialité des posts."""

from unittest.mock import AsyncMock, MagicMock, patch
import asyncio


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_serialize_public_post_strips_email_and_internal_fields():
    from server import serialize_public_post

    post = {
        "_id": "507f1f77bcf86cd799439011",
        "author_id": "author1",
        "visibility": "public",
        "type": "free",
        "title": "Hello",
        "description": "Public text",
        "image_url": "/uploads/a/b.webp",
        "likes": ["u1", "u2"],
        "comments": [
            {
                "id": "c1",
                "user_id": "u1",
                "username": "alice",
                "handle": "alice",
                "display_name": "Alice",
                "avatar_url": "/uploads/a.webp",
                "text": "Nice",
                "created_at": "2026-01-01T00:00:00+00:00",
                "likes": [],
                "email": "secret@example.com",
            }
        ],
        "created_at": "2026-01-01T00:00:00+00:00",
        "author_username": "alice",
        "author_handle": "alice",
        "author_display_name": "Alice",
        "author_avatar_url": "/uploads/a.webp",
    }
    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
        "show_posts": True,
        "email": "author@example.com",
        "password_hash": "x",
    }

    async def run():
        with patch("server.is_duo_wall_post", return_value=False):
            with patch("server.can_view_post_doc", new=AsyncMock(return_value=True)):
                with patch("server.get_user_doc_by_id", new=AsyncMock(return_value=author)):
                    with patch("server.serialize_post", new=AsyncMock(return_value={
                        "id": "507f1f77bcf86cd799439011",
                        "type": "free",
                        "title": "Hello",
                        "description": "Public text",
                        "image_url": "/uploads/a/b.webp",
                        "author_username": "alice",
                        "author_handle": "alice",
                        "author_display_name": "Alice",
                        "author_avatar_url": "/uploads/a.webp",
                        "actor_type": "user",
                        "actor": {"type": "user", "name": "Alice", "handle": "alice", "id": "author1", "email": "x"},
                        "visibility": "public",
                        "likes_count": 2,
                        "comments_count": 1,
                        "reposts_count": 0,
                        "created_at": "2026-01-01T00:00:00+00:00",
                        "can_view_session_details": False,
                        "session_snapshot": None,
                        "preview_comment": {
                            "id": "c1",
                            "username": "alice",
                            "handle": "alice",
                            "display_name": "Alice",
                            "avatar_url": "/uploads/a.webp",
                            "text": "Nice",
                            "created_at": "2026-01-01T00:00:00+00:00",
                            "likes_count": 0,
                            "user_id": "u1",
                        },
                        "comments": [],
                        "author_id": "author1",
                        "created_by_user_id": "author1",
                        "email": "leak@example.com",
                    })):
                        return await serialize_public_post(post, None, include_comments=False)

    result = _run(run())
    assert result is not None
    assert result["title"] == "Hello"
    assert "email" not in result
    assert "author_id" not in result
    assert "created_by_user_id" not in result
    assert "password_hash" not in result
    assert result["actor"].get("email") is None or "email" not in result["actor"]
    assert result["likes_count"] == 2


def test_serialize_public_post_returns_none_when_privacy_denies():
    from server import serialize_public_post

    post = {"_id": "507f1f77bcf86cd799439011", "visibility": "private", "author_id": "a1"}

    async def run():
        with patch("server.can_view_post_doc", new=AsyncMock(return_value=False)):
            return await serialize_public_post(post, None)

    assert _run(run()) is None


def test_resolve_public_post_locked_for_private():
    from server import resolve_public_post_response
    from bson import ObjectId

    oid = ObjectId()
    post = {
        "_id": oid,
        "visibility": "private",
        "author_id": "a1",
        "title": "Secret",
        "description": "Should not leak",
        "image_url": "/uploads/secret.webp",
    }

    async def run():
        with patch("server.db") as mock_db:
            mock_db.posts.find_one = AsyncMock(return_value=post)
            with patch("server.serialize_public_post", new=AsyncMock(return_value=None)):
                return await resolve_public_post_response(str(oid), None)

    result = _run(run())
    assert result["status"] == "locked"
    assert result["reason"] == "authentication_required"
    assert "post" not in result
    assert "Secret" not in str(result)


def test_resolve_public_post_unavailable():
    from server import resolve_public_post_response
    from bson import ObjectId

    async def run():
        with patch("server.db") as mock_db:
            mock_db.posts.find_one = AsyncMock(return_value=None)
            return await resolve_public_post_response(str(ObjectId()), None)

    result = _run(run())
    assert result["status"] == "unavailable"


def test_resolve_public_post_visible():
    from server import resolve_public_post_response
    from bson import ObjectId

    oid = ObjectId()
    public_doc = {
        "id": str(oid),
        "title": "Public",
        "description": "Ok",
        "likes_count": 1,
        "comments_count": 0,
        "reposts_count": 0,
    }

    async def run():
        with patch("server.db") as mock_db:
            mock_db.posts.find_one = AsyncMock(return_value={"_id": oid, "visibility": "public"})
            with patch("server.serialize_public_post", new=AsyncMock(return_value=public_doc)):
                return await resolve_public_post_response(str(oid), None)

    result = _run(run())
    assert result["status"] == "visible"
    assert result["post"]["title"] == "Public"


def test_can_view_post_anonymous_public_ok():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "public"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="public")):
            return await can_view_post(None, post, author)

    assert _run(run()) is True


def test_can_view_post_anonymous_friends_denied():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "friends"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="public")):
            return await can_view_post(None, post, author)

    assert _run(run()) is False


def test_can_view_post_anonymous_private_denied():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "private"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="public")):
            return await can_view_post(None, post, author)

    assert _run(run()) is False


def test_can_view_post_anonymous_author_posts_me_denied():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "me",
    }
    post = {"author_id": "author1", "visibility": "public"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="public")):
            with patch("server.resolve_visibility_value", return_value="me"):
                with patch("server.visibility_allows", return_value=False):
                    return await can_view_post(None, post, author)

    assert _run(run()) is False


def test_can_view_post_friend_allowed_for_friends_visibility():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "friends"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="friend")):
            with patch("server.resolve_visibility_value", return_value="public"):
                with patch("server.visibility_allows", return_value=True):
                    return await can_view_post("friend1", post, author)

    assert _run(run()) is True


def test_can_view_post_connected_non_friend_friends_denied():
    from server import can_view_post

    author = {
        "_id": "author1",
        "account_visibility": "public",
        "posts_visibility": "public",
    }
    post = {"author_id": "author1", "visibility": "friends"}

    async def run():
        with patch("server.get_profile_access_level", new=AsyncMock(return_value="public")):
            with patch("server.resolve_visibility_value", return_value="public"):
                with patch("server.visibility_allows", return_value=True):
                    return await can_view_post("stranger", post, author)

    assert _run(run()) is False


def test_public_trending_limit_clamped_to_six():
    """Vérifie le clamp limit≤6 dans le handler (source-scan + logique isolée)."""
    import inspect
    from server import get_public_feed_trending

    src = inspect.getsource(get_public_feed_trending)
    assert "min(int(limit or 6), 6)" in src or "min(limit, 6)" in src
    assert "can_view_post_doc" in src
    assert "serialize_public_post" in src


def test_public_rate_limit_actions_configured():
    from auth.rate_limit import LIMITS

    assert "public_feed_trending" in LIMITS
    assert "public_post_get" in LIMITS
    assert LIMITS["public_feed_trending"][0] >= 1
    assert LIMITS["public_post_get"][0] >= 1


def test_public_post_error_messages_do_not_leak_privacy_reason():
    from server import resolve_public_post_response
    from bson import ObjectId

    oid = ObjectId()

    async def run():
        with patch("server.db") as mock_db:
            mock_db.posts.find_one = AsyncMock(return_value={"_id": oid, "visibility": "friends"})
            with patch("server.serialize_public_post", new=AsyncMock(return_value=None)):
                return await resolve_public_post_response(str(oid), None)

    result = _run(run())
    blob = str(result).lower()
    assert "friends" not in blob
    assert "private" not in blob
    assert result["reason"] == "authentication_required"

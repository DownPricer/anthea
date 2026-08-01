"""Persistance, rotation et révocation des sessions FitGather."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from bson import ObjectId
from starlette.requests import Request
from starlette.responses import Response


def _request_with_cookies(**cookies) -> Request:
    cookie_header = "; ".join(f"{key}={value}" for key, value in cookies.items())
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/auth/refresh",
            "headers": [(b"cookie", cookie_header.encode())],
        }
    )


def _cookie_headers(response):
    return [
        value.decode()
        for key, value in response.raw_headers
        if key.lower() == b"set-cookie"
    ]


def test_auth_cookie_ttls_and_security_attributes(monkeypatch):
    import server

    monkeypatch.setattr(server, "ACCESS_TOKEN_TTL_MINUTES", 20)
    monkeypatch.setattr(server, "REFRESH_TOKEN_TTL_DAYS", 30)
    monkeypatch.setattr(server, "COOKIE_SECURE", True)
    response = Response()

    server.set_auth_cookies(response, "access", "refresh")
    headers = _cookie_headers(response)
    access = next(header for header in headers if header.startswith("access_token="))
    refresh = next(header for header in headers if header.startswith("refresh_token="))

    assert "Max-Age=1200" in access
    assert "Max-Age=2592000" in refresh
    for header in (access, refresh):
        lowered = header.lower()
        assert "expires=" in lowered
        assert "httponly" in lowered
        assert "secure" in lowered
        assert "samesite=lax" in lowered
        assert "path=/" in lowered
        assert "domain=" not in lowered


def test_jwt_expirations_match_configured_cookie_ttls(monkeypatch):
    import server

    monkeypatch.setattr(server, "ACCESS_TOKEN_TTL_MINUTES", 17)
    monkeypatch.setattr(server, "REFRESH_TOKEN_TTL_DAYS", 30)
    access = server.create_access_token("507f1f77bcf86cd799439011", "fituser")
    refresh = server.create_refresh_token("507f1f77bcf86cd799439011")
    access_payload = jwt.decode(
        access, server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM]
    )
    refresh_payload = jwt.decode(
        refresh, server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM]
    )
    now = datetime.now(timezone.utc).timestamp()

    assert 16 * 60 <= access_payload["exp"] - now <= 17 * 60 + 5
    assert 30 * 86400 - 5 <= refresh_payload["exp"] - now <= 30 * 86400 + 5


class _Users:
    def __init__(self, user):
        self.user = user
        self.update_calls = []

    async def find_one(self, query):
        return self.user

    async def update_one(self, query, update):
        self.update_calls.append((query, update))
        return SimpleNamespace(modified_count=1)


@pytest.mark.asyncio
async def test_refresh_valid_after_access_expiry_and_rotates_cookies(monkeypatch):
    import server

    user_id = ObjectId()
    users = _Users(
        {
            "_id": user_id,
            "username": "fituser",
            "token_version": 3,
            "account_status": "active",
        }
    )
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))
    refresh = server.create_refresh_token(str(user_id), 3)
    response = Response()

    result = await server.refresh_access_token(
        _request_with_cookies(refresh_token=refresh), response
    )

    assert result == {"ok": True}
    headers = _cookie_headers(response)
    assert any(header.startswith("access_token=") for header in headers)
    assert any(
        header.startswith("refresh_token=") and "Max-Age=2592000" in header
        for header in headers
    )


@pytest.mark.asyncio
async def test_expired_and_revoked_refresh_tokens_are_refused(monkeypatch):
    import server

    user_id = ObjectId()
    users = _Users(
        {
            "_id": user_id,
            "username": "fituser",
            "token_version": 4,
            "account_status": "active",
        }
    )
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))
    expired = jwt.encode(
        {
            "sub": str(user_id),
            "tv": 4,
            "type": "refresh",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        server.JWT_SECRET,
        algorithm=server.JWT_ALGORITHM,
    )
    revoked = server.create_refresh_token(str(user_id), 3)

    expired_response = await server.refresh_access_token(
        _request_with_cookies(refresh_token=expired), Response()
    )
    revoked_response = await server.refresh_access_token(
        _request_with_cookies(refresh_token=revoked), Response()
    )

    assert expired_response.status_code == 401
    assert revoked_response.status_code == 401
    assert all("Max-Age=0" in header for header in _cookie_headers(expired_response))
    assert all("Max-Age=0" in header for header in _cookie_headers(revoked_response))


@pytest.mark.asyncio
async def test_logout_revokes_token_version_and_clears_cookies(monkeypatch):
    import server

    user_id = ObjectId()
    users = _Users(None)
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))
    refresh = server.create_refresh_token(str(user_id), 2)
    response = Response()

    result = await server.logout(
        _request_with_cookies(refresh_token=refresh), response
    )

    assert result == {"message": "Logged out successfully"}
    assert users.update_calls
    assert users.update_calls[0][1] == {"$inc": {"token_version": 1}}
    headers = _cookie_headers(response)
    assert len(headers) == 2
    assert all("Max-Age=0" in header for header in headers)

"""CORS explicite et cookies auth host-only pour FitGather."""

import os

import pytest
from starlette.responses import Response


def test_parse_cors_origins_includes_fitgather():
    from server import parse_cors_origins, DEFAULT_CORS_ORIGINS

    origins = parse_cors_origins()
    assert "https://fitgather.fr" in origins
    assert "https://www.fitgather.fr" in origins
    assert "https://anthea.sitereadyshd.fr" in origins
    assert "http://localhost:3000" in origins
    assert origins == DEFAULT_CORS_ORIGINS or origins


def test_parse_cors_origins_rejects_wildcard(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "*")
    from server import parse_cors_origins, DEFAULT_CORS_ORIGINS

    assert parse_cors_origins() == DEFAULT_CORS_ORIGINS


def _cors_middleware_kwargs():
    from server import app

    for middleware in app.user_middleware:
        if middleware.cls.__name__ == "CORSMiddleware":
            return middleware.kwargs
    return None


def test_cors_fitgather_origin_accepted():
    kwargs = _cors_middleware_kwargs()
    assert kwargs is not None
    assert kwargs["allow_credentials"] is True
    assert "https://fitgather.fr" in kwargs["allow_origins"]
    assert "https://www.fitgather.fr" in kwargs["allow_origins"]


def test_cors_no_wildcard_with_credentials():
    from server import parse_cors_origins

    assert "*" not in parse_cors_origins()

    kwargs = _cors_middleware_kwargs()
    assert kwargs is not None
    assert kwargs["allow_credentials"] is True
    assert "*" not in kwargs["allow_origins"]


def test_auth_cookies_host_only_no_legacy_domain():
    from server import set_auth_cookies

    response = Response()
    set_auth_cookies(response, "access-test", "refresh-test")

    set_cookie_headers = [value.decode() for key, value in response.raw_headers if key == b"set-cookie"]
    assert len(set_cookie_headers) == 2
    for header in set_cookie_headers:
        lowered = header.lower()
        assert "domain=" not in lowered
        assert "domain=anthea.sitereadyshd.fr" not in lowered
        assert "httponly" in lowered
        assert "samesite=lax" in lowered
        assert "path=/" in lowered


def test_auth_cookies_secure_when_configured(monkeypatch):
    import server

    monkeypatch.setattr(server, "COOKIE_SECURE", True)

    response = Response()
    server.set_auth_cookies(response, "access-test", "refresh-test")
    headers = [value.decode().lower() for key, value in response.raw_headers if key == b"set-cookie"]
    assert all("secure" in header for header in headers)


def test_clear_auth_cookies_preserves_path_without_domain():
    from server import set_auth_cookies, clear_auth_cookies

    response = Response()
    set_auth_cookies(response, "access-test", "refresh-test")
    clear_auth_cookies(response)

    delete_headers = [value.decode().lower() for key, value in response.raw_headers if key == b"set-cookie"]
    assert len(delete_headers) >= 2
    for header in delete_headers:
        assert "domain=" not in header

"""Tests médias distants ExerciseDB : URLs, repair, allowlist, mode remote."""

from __future__ import annotations

from exercises.media_proxy import is_allowed_media_url, media_mode, resolve_media_for_client
from exercises.media_urls import (
    build_cdn_gif_url,
    extract_cdn_id_from_path,
    parse_existing_media_url,
    repair_media_fields,
)


def test_extract_cdn_id_from_aquariius_stem():
    assert extract_cdn_id_from_path("videos/0001-2gPfomN.gif") == "2gPfomN"
    assert extract_cdn_id_from_path("2gPfomN.gif") == "2gPfomN"
    assert extract_cdn_id_from_path("0001.gif") is None


def test_build_and_parse_cdn_url():
    url = build_cdn_gif_url("2gPfomN")
    assert url == "https://static.exercisedb.dev/media/2gPfomN.gif"
    stem, valid = parse_existing_media_url(url)
    assert stem == "2gPfomN" and valid is True
    bad_stem, bad_valid = parse_existing_media_url(
        "https://static.exercisedb.dev/media/0001.gif"
    )
    assert bad_stem == "0001" and bad_valid is False


def test_repair_numeric_media_url():
    doc = {
        "media": {
            "url": "https://static.exercisedb.dev/media/0001.gif",
            "thumbnail_url": "https://static.exercisedb.dev/media/0001.gif",
            "status": "available",
        },
        "source": {"original_url": "videos/0001-2gPfomN.gif"},
    }
    patch = repair_media_fields(doc, source_path="videos/0001-2gPfomN.gif")
    assert patch["media"]["url"] == "https://static.exercisedb.dev/media/2gPfomN.gif"
    assert patch["media"]["cdn_id"] == "2gPfomN"


def test_repair_idempotent_when_already_valid():
    doc = {
        "media": {
            "url": "https://static.exercisedb.dev/media/2gPfomN.gif",
            "thumbnail_url": "https://static.exercisedb.dev/media/2gPfomN.gif",
            "status": "available",
            "cdn_id": "2gPfomN",
        }
    }
    assert repair_media_fields(doc, cdn_id="2gPfomN") == {}


def test_allowlist_accepts_exercisedb_rejects_unknown():
    assert is_allowed_media_url("https://static.exercisedb.dev/media/x.gif")
    assert is_allowed_media_url("http://static.exercisedb.dev/media/x.webp")
    assert not is_allowed_media_url("https://evil.example/x.gif")
    assert not is_allowed_media_url("/uploads/x.gif")
    assert not is_allowed_media_url("https://anthea.sitereadyshd.fr/https://static.exercisedb.dev/x.gif")


def test_remote_mode_returns_direct_url_no_disk(tmp_path, monkeypatch):
    monkeypatch.setenv("EXERCISE_MEDIA_MODE", "remote")
    assert media_mode() == "remote"
    url = "https://static.exercisedb.dev/media/2gPfomN.gif"
    resolved = resolve_media_for_client(url, "exdb_1")
    assert resolved == url
    assert list(tmp_path.iterdir()) == []


def test_remote_rejects_arbitrary_url(monkeypatch):
    monkeypatch.setenv("EXERCISE_MEDIA_MODE", "remote")
    assert resolve_media_for_client("https://evil.example/a.gif", "exdb_1") is None


def test_missing_media_does_not_raise():
    assert resolve_media_for_client(None, "exdb_1") is None
    assert resolve_media_for_client("", "exdb_1") is None


def test_media_endpoint_redirects_in_remote_mode(monkeypatch):
    from fastapi.responses import RedirectResponse

    from exercises import api as exercises_api

    monkeypatch.setenv("EXERCISE_MEDIA_MODE", "remote")

    class FakeCol:
        async def find_one(self, query):
            return {
                "id": "exdb_1",
                "media": {"url": "https://static.exercisedb.dev/media/2gPfomN.gif"},
            }

    class FakeDb:
        def __getitem__(self, name):
            return FakeCol()

    import asyncio

    response = asyncio.get_event_loop().run_until_complete(
        exercises_api.media_handler(FakeDb(), "exdb_1", user={})
    )
    assert isinstance(response, RedirectResponse)
    assert response.status_code == 302
    assert "2gPfomN.gif" in response.headers.get("location", "")

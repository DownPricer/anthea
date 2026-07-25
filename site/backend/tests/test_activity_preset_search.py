"""Tests endpoint presets FitMatch pour la découverte / recherche."""

from __future__ import annotations

from activities.presets import (
    PRESET_SEARCH_ALIASES,
    list_activity_presets,
    list_preset_search_payloads,
    preset_search_payload,
)


def test_presets_endpoint_payload_count():
    payloads = list_preset_search_payloads()
    assert len(payloads) == 17


def test_presets_payload_excludes_exercisedb_fields():
    payload = preset_search_payload(list_activity_presets()[0])
    assert "provider" not in payload
    assert "media" not in payload
    assert "gif" not in payload
    assert "search_text" not in payload
    assert "equipment" not in payload


def test_presets_payload_i18n_names():
    payloads = list_preset_search_payloads()
    running = next(p for p in payloads if p["id"] == "outdoor_running")
    assert running["name"]["fr"] == "Course extérieure"
    assert running["name"]["en"] == "Outdoor running"
    assert running["name"]["es"] == "Carrera al aire libre"


def test_presets_payload_tracking_modes():
    payloads = {p["id"]: p for p in list_preset_search_payloads()}
    assert payloads["outdoor_running"]["activity_tracking_mode"] == "gps"
    assert payloads["pool_swimming"]["activity_tracking_mode"] == "laps"
    assert payloads["interval_running"]["activity_tracking_mode"] == "intervals"
    assert payloads["treadmill_running"]["activity_tracking_mode"] == "manual_distance"
    assert payloads["yoga_session"]["activity_tracking_mode"] == "timer"


def test_presets_payload_aliases_present():
    payloads = {p["id"]: p for p in list_preset_search_payloads()}
    assert "course" in payloads["outdoor_running"]["aliases"]["fr"]
    assert "swim" in payloads["pool_swimming"]["aliases"]["en"]
    assert "natacion" in payloads["pool_swimming"]["aliases"]["es"] or "nadar" in payloads["pool_swimming"]["aliases"]["es"]


def test_presets_stable_order():
    first = [p["id"] for p in list_preset_search_payloads()]
    second = [p["id"] for p in list_preset_search_payloads()]
    assert first == second


def test_aliases_map_covers_all_presets():
    presets = list_activity_presets()
    for preset in presets:
        assert preset["id"] in PRESET_SEARCH_ALIASES

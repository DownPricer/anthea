"""Tests classification activités v2 — faux positifs et presets."""

from __future__ import annotations

import pytest

from activities.classification import (
    CLASSIFICATION_VERSION,
    KNOWN_FALSE_POSITIVE_IDS,
    classify_catalog_documents,
    classify_exercise,
    classification_fields,
    is_reliable_catalog_activity,
    load_overrides,
)
from activities.presets import list_activity_presets, preset_classification_fields


def _doc(name_en: str, **kwargs):
    base = {
        "id": kwargs.pop("id", "test_doc"),
        "name": {"en": name_en},
        "sport": kwargs.pop("sport", "strength"),
        "equipment": kwargs.pop("equipment", []),
    }
    base.update(kwargs)
    return base


@pytest.mark.parametrize(
    "name",
    [
        "band assisted wheel rollerout",
        "barbell standing ab rollerout",
        "roller seated shoulder press",
        "barbell skier",
        "skin the cat",
        "cable thibaudeau kayak row",
        "wrist rollerer",
        "walking lunge",
        "bridge march",
        "march sit",
        "barbell row",
        "cable row",
        "plank tap shoulder",
        "side plank rear fly",
    ],
)
def test_strength_false_positives_stay_standard(name):
    mode, kind, source, confidence, version = classify_exercise(_doc(name))
    assert mode == "standard"
    assert kind == "other"
    assert confidence == "high"
    assert int(version) == CLASSIFICATION_VERSION


@pytest.mark.parametrize("eid", sorted(KNOWN_FALSE_POSITIVE_IDS))
def test_known_false_positive_ids_standard(eid):
    mode, kind, source, confidence, _ = classify_exercise({"id": eid, "name": {"en": "ignored"}})
    assert mode == "standard"
    assert kind == "other"
    assert source == "explicit_override"
    assert confidence == "high"


def test_outdoor_running_catalog_name_is_standard_not_gps():
    mode, kind, _, confidence, _ = classify_exercise(
        _doc("Outdoor running", sport="running", equipment=["other"])
    )
    assert mode == "standard"
    assert kind == "other"
    assert confidence == "high"


@pytest.mark.parametrize(
    "name,equipment,expected_kind",
    [
        ("Treadmill running", ["treadmill"], "running"),
        ("Stationary bike cardio", ["stationary_bike"], "cycling"),
        ("Elliptical trainer session", ["elliptical"], "elliptical"),
        ("Rowing machine workout", ["rowing_machine"], "rowing"),
        ("Stair climber cardio", ["stair_climber"], "stair_climber"),
    ],
)
def test_machine_cardio_manual_distance(name, equipment, expected_kind):
    mode, kind, source, confidence, _ = classify_exercise(_doc(name, equipment=equipment, sport="cardio"))
    assert mode == "manual_distance"
    assert kind == expected_kind
    assert source == "strict_machine_rule"
    assert confidence == "high"


def test_kayak_row_not_manual_distance():
    mode, _, _, _, _ = classify_exercise(_doc("cable thibaudeau kayak row", equipment=["cable"]))
    assert mode == "standard"


def test_yoga_sport_timer():
    mode, kind, source, confidence, _ = classify_exercise(_doc("Sun salutation", sport="yoga"))
    assert mode == "timer"
    assert kind == "yoga"
    assert source == "strict_timer_rule"
    assert confidence == "high"


def test_tabata_intervals():
    mode, kind, _, confidence, _ = classify_exercise(_doc("Tabata", sport="cardio"))
    assert mode == "intervals"
    assert kind == "hiit"
    assert confidence == "high"


@pytest.mark.parametrize(
    "preset_id,expected_mode,expected_kind",
    [
        ("outdoor_running", "gps", "running"),
        ("outdoor_walking", "gps", "walking"),
        ("outdoor_cycling", "gps", "cycling"),
        ("pool_swimming", "laps", "swimming"),
        ("track_laps", "laps", "track"),
        ("interval_running", "intervals", "running"),
        ("tabata", "intervals", "hiit"),
        ("treadmill_running", "manual_distance", "running"),
        ("indoor_cycling", "manual_distance", "cycling"),
        ("indoor_rowing", "manual_distance", "rowing"),
        ("elliptical", "manual_distance", "elliptical"),
        ("yoga_session", "timer", "yoga"),
        ("stretching_session", "timer", "stretching"),
    ],
)
def test_activity_presets_classification(preset_id, expected_mode, expected_kind):
    fields = preset_classification_fields(preset_id)
    assert fields["activity_tracking_mode"] == expected_mode
    assert fields["activity_kind"] == expected_kind
    assert fields["activity_classification_source"] == "activity_preset"
    assert fields["activity_classification_confidence"] == "high"


def test_gps_requires_high_confidence():
    overrides = load_overrides()
    overrides["by_id"]["gps_test"] = {
        "activity_tracking_mode": "gps",
        "activity_kind": "running",
        "activity_classification_confidence": "low",
    }
    mode, kind, source, confidence, _ = classify_exercise({"id": "gps_test", "name": {"en": "Run"}}, overrides)
    assert mode == "standard"
    assert source == "default_standard"


def test_classification_idempotent_v2():
    docs = [
        _doc("Squat", id="a", sport="strength", equipment=["barbell"]),
        _doc("Outdoor running", id="b", sport="running"),
        _doc("Tabata", id="c", sport="cardio"),
    ]
    r1 = classify_catalog_documents(docs)
    for d in docs:
        d.update(classification_fields(d))
    r2 = classify_catalog_documents(docs)
    assert r2["changes"] == 0
    assert r1["gps"] == 0


def test_sample_report_ids_in_catalog_simulation():
    docs = [{"id": eid, "name": {"en": "legacy gps false positive"}, "activity_tracking_mode": "gps"} for eid in KNOWN_FALSE_POSITIVE_IDS]
    report = classify_catalog_documents(docs)
    assert report["false_positive_fixes"] == len(KNOWN_FALSE_POSITIVE_IDS)
    assert report["gps"] == 0
    for eid in KNOWN_FALSE_POSITIVE_IDS:
        after = report["sample_before_after"][eid]["after"]
        assert after["activity_tracking_mode"] == "standard"


def test_is_reliable_catalog_excludes_gps_and_standard():
    assert not is_reliable_catalog_activity(_doc("Push-up"))
    assert not is_reliable_catalog_activity(_doc("Outdoor run name", sport="running"))
    assert is_reliable_catalog_activity(_doc("Tabata", sport="cardio"))


def test_presets_count():
    presets = list_activity_presets()
    assert len(presets) == 17
    modes = [p["activity_tracking_mode"] for p in presets]
    assert modes.count("gps") == 5
    assert modes.count("laps") == 3
    assert modes.count("intervals") == 3
    assert modes.count("manual_distance") == 4
    assert modes.count("timer") == 2

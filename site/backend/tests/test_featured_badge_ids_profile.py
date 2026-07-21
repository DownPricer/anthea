import pytest
from fastapi import HTTPException

from server import (
    clean_featured_badge_ids,
    normalize_featured_badge_ids,
    build_featured_solo_badges,
)


SOLO_UNLOCKED = {
    "solo_streak_three": {"unlocked_at": "2026-01-01T00:00:00Z"},
    "solo_five_workouts": {"unlocked_at": "2026-01-02T00:00:00Z"},
}


def test_clean_featured_badge_ids_accepts_empty():
    assert clean_featured_badge_ids([], SOLO_UNLOCKED) == []
    assert clean_featured_badge_ids(None, SOLO_UNLOCKED) == []


def test_clean_featured_badge_ids_converts_legacy():
    result = clean_featured_badge_ids(["streak_3"], SOLO_UNLOCKED)
    assert result == ["solo_streak_three"]


def test_clean_featured_badge_ids_rejects_duo():
    with pytest.raises(HTTPException) as exc:
        clean_featured_badge_ids(["duo_first_common_workout"], SOLO_UNLOCKED)
    assert exc.value.detail["code"] == "FEATURED_BADGE_INVALID_SCOPE"


def test_clean_featured_badge_ids_rejects_locked():
    with pytest.raises(HTTPException) as exc:
        clean_featured_badge_ids(["solo_ten_workouts"], SOLO_UNLOCKED)
    assert exc.value.detail["code"] == "FEATURED_BADGE_LOCKED"


def test_clean_featured_badge_ids_rejects_duplicates():
    with pytest.raises(HTTPException) as exc:
        clean_featured_badge_ids(["solo_streak_three", "solo_streak_three"], SOLO_UNLOCKED)
    assert exc.value.detail["code"] == "FEATURED_BADGE_DUPLICATE"


def test_clean_featured_badge_ids_max_three():
    unlocked = {
        "solo_streak_three": {},
        "solo_five_workouts": {},
        "solo_ten_workouts": {},
        "solo_twenty_five_workouts": {},
    }
    with pytest.raises(HTTPException) as exc:
        clean_featured_badge_ids(
            ["solo_streak_three", "solo_five_workouts", "solo_ten_workouts", "solo_twenty_five_workouts"],
            unlocked,
        )
    assert exc.value.detail["code"] == "FEATURED_BADGE_MAX"


def test_normalize_featured_badge_ids_legacy_conversion():
    assert normalize_featured_badge_ids(["streak_3"], SOLO_UNLOCKED) == ["solo_streak_three"]


def test_normalize_featured_badge_ids_drops_duo_and_locked():
    assert normalize_featured_badge_ids(
        ["duo_first_common_workout", "solo_five_workouts", "unknown_badge"],
        SOLO_UNLOCKED,
    ) == ["solo_five_workouts"]

    assert normalize_featured_badge_ids(["solo_ten_workouts"], SOLO_UNLOCKED) == []


def test_normalize_featured_badge_ids_max_three_and_dedupe():
    unlocked = {
        "solo_streak_three": {},
        "solo_five_workouts": {},
        "solo_ten_workouts": {},
        "solo_twenty_five_workouts": {},
    }
    raw = ["streak_3", "vol_5", "vol_10", "vol_25", "solo_streak_three"]
    result = normalize_featured_badge_ids(raw, unlocked, max_count=3)
    assert result == ["solo_streak_three", "solo_five_workouts", "solo_ten_workouts"]


def test_build_featured_solo_badges_from_catalog():
    ids, cards = build_featured_solo_badges(["streak_3"], SOLO_UNLOCKED)
    assert ids == ["solo_streak_three"]
    assert len(cards) == 1
    assert cards[0]["id"] == "solo_streak_three"
    assert cards[0]["unlocked"] is True

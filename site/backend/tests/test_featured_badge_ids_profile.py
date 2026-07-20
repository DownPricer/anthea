import pytest

from server import clean_featured_badge_ids


def test_clean_featured_badge_ids_accepts_empty():
    assert clean_featured_badge_ids([], {"solo_first": {}}) == []


def test_clean_featured_badge_ids_rejects_duplicates():
    with pytest.raises(Exception):
        clean_featured_badge_ids(["solo_a", "solo_a"], {"solo_a": {}})


def test_clean_featured_badge_ids_rejects_locked():
    with pytest.raises(Exception):
        clean_featured_badge_ids(["solo_a"], {})


"""Tests for duo/personal streak fields exposed on stats endpoints."""

from duo_social import _compute_streaks_from_days


def test_compute_streaks_empty():
    current, best = _compute_streaks_from_days([])
    assert current == 0
    assert best == 0


def test_compute_streaks_non_consecutive():
    days = ["2026-01-01", "2026-01-03", "2026-01-05"]
    current, best = _compute_streaks_from_days(days)
    assert best == 1
    assert current == 0  # none adjacent to today unless today matches


def test_compute_streaks_consecutive_best():
    days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-11"]
    current, best = _compute_streaks_from_days(days)
    assert best == 3
    assert current == 0


def test_compute_streaks_current_from_yesterday_or_today():
    from datetime import datetime, timezone, timedelta

    today = datetime.now(timezone.utc).date()
    y = (today - timedelta(days=1)).isoformat()
    y2 = (today - timedelta(days=2)).isoformat()
    days = [y2, y]
    current, best = _compute_streaks_from_days(days)
    assert current == 2
    assert best >= 2


def test_detailed_stats_source_includes_streak_fields():
    """Guard: get_detailed_stats return payload documents streak fields."""
    import inspect
    import server

    src = inspect.getsource(server.get_detailed_stats)
    assert "current_streak" in src
    assert "best_streak" in src
    assert "active_days" in src
    assert "last_session" in src
    assert "compute_best_streak_from_calendar" in src
    assert "calculate_streak" in src


def test_duo_stats_includes_training_days_together():
    import inspect
    import server

    src = inspect.getsource(server.get_duo_stats)
    assert "training_days_together" in src
    assert "duo_streak_best" in src
    assert "duo_streak_current" in src

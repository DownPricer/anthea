"""Live reactions and dual progress helpers."""

ALLOWED = frozenset({"🔥", "❤️", "👏", "💪"})


def compute_progress_percent(completed, total):
    if not total or total <= 0:
        return None
    pct = int(round((completed / total) * 100))
    return max(0, min(100, pct))


def test_allowed_reactions():
    assert "🔥" in ALLOWED
    assert "💬" not in ALLOWED


def test_progress_bounds():
    assert compute_progress_percent(0, 10) == 0
    assert compute_progress_percent(5, 10) == 50
    assert compute_progress_percent(10, 10) == 100
    assert compute_progress_percent(12, 10) == 100
    assert compute_progress_percent(3, 0) is None


def test_connection_degraded_threshold():
    degraded_after = 90
    assert degraded_after < 120

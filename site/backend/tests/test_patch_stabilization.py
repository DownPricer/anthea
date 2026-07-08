"""Tests unitaires pour le patch stabilisation (sans dépendances serveur)."""

LIVE_ACTIVE_PHASES = ("countdown", "exercise", "rest")


def estimate_calories(total_time_seconds, difficulty=None):
    minutes = max(0, (total_time_seconds or 0) / 60)
    if difficulty is None:
        rate = 5
    elif difficulty <= 3:
        rate = 3
    elif difficulty <= 6:
        rate = 5
    elif difficulty <= 8:
        rate = 7
    else:
        rate = 8
    return round(minutes * rate)


def normalize_accent_color(value):
    if not value or not str(value).strip():
        return None
    raw = str(value).strip()
    if raw.startswith("#"):
        raw = raw[1:]
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return None
    try:
        int(raw, 16)
    except ValueError:
        return None
    return f"#{raw.upper()}"


def is_active_live_phase(phase):
    if phase in ("finished", "preparation", "paused") or phase not in LIVE_ACTIVE_PHASES:
        return False
    return True


def test_estimate_calories_by_difficulty():
    assert estimate_calories(600, 2) == 30
    assert estimate_calories(600, 5) == 50
    assert estimate_calories(600, 7) == 70
    assert estimate_calories(600, 10) == 80
    assert estimate_calories(600, None) == 50


def test_normalize_accent_color():
    assert normalize_accent_color("#06B6D4") == "#06B6D4"
    assert normalize_accent_color("06B6D4") == "#06B6D4"
    assert normalize_accent_color("#abc") == "#AABBCC"
    assert normalize_accent_color("") is None
    assert normalize_accent_color("not-a-color") is None
    assert normalize_accent_color("#12") is None


def test_live_phase_gate():
    assert is_active_live_phase("exercise") is True
    assert is_active_live_phase("countdown") is True
    assert is_active_live_phase("rest") is True
    assert is_active_live_phase("paused") is False
    assert is_active_live_phase("finished") is False
    assert is_active_live_phase(None) is False


if __name__ == "__main__":
    test_estimate_calories_by_difficulty()
    test_normalize_accent_color()
    test_live_phase_gate()
    print("OK: all stabilization tests passed")

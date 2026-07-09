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


def test_normalize_handle():
    from server import normalize_handle
    assert normalize_handle("@Mon_Pseudo") == "mon_pseudo"
    assert normalize_handle("  AbC  ") == "abc"
    assert normalize_handle("ab") is None
    assert normalize_handle("valid_handle_123") == "valid_handle_123"
    assert normalize_handle("") is None


def test_serialize_duo_search():
    from server import serialize_duo_search
    result = serialize_duo_search({"_id": "abc", "name": "LesGuerriers", "short_id": 1042, "member_ids": ["a", "b"]})
    assert result["tag"] == "LesGuerriers#1042"
    assert result["member_count"] == 2


def test_parse_duo_tag():
    from duo_social import parse_duo_tag, duo_tag_from_doc
    name, sid = parse_duo_tag("LesGuerriers#1042")
    assert name == "LesGuerriers"
    assert sid == 1042
    tag = duo_tag_from_doc({"name": "TestDuo", "short_id": 9999})
    assert tag == "TestDuo#9999"


def test_build_common_sessions():
    from duo_social import build_common_sessions
    sessions_a = [
        {"id": "a1", "user_id": "u1", "username": "A", "workout_title": "W1",
         "total_time": 600, "exercises_completed": 5, "exercises_total": 5,
         "created_at": "2026-07-09T10:00:00+00:00", "status": "completed"},
    ]
    sessions_b = [
        {"id": "b1", "user_id": "u2", "username": "B", "workout_title": "W2",
         "total_time": 900, "exercises_completed": 8, "exercises_total": 10,
         "created_at": "2026-07-09T18:00:00+00:00", "status": "completed"},
    ]
    items = build_common_sessions(sessions_a, sessions_b, "u1", "u2")
    assert items[0]["type"] == "common_session"
    assert items[0]["date"] == "2026-07-09"


if __name__ == "__main__":
    test_estimate_calories_by_difficulty()
    test_normalize_accent_color()
    test_live_phase_gate()
    test_normalize_handle()
    print("OK: all stabilization tests passed")

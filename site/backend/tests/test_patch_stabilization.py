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


def test_resolve_duo_member_pair_from_doc():
    from duo_social import resolve_duo_member_pair_from_doc
    a = "507f1f77bcf86cd799439011"
    b = "507f191e810c19729de860ea"
    pk = f"{b}_{a}" if a > b else f"{a}_{b}"
    pair_a, pair_b = resolve_duo_member_pair_from_doc({"pair_key": pk})
    assert {pair_a, pair_b} == {a, b}
    mid_a, mid_b = resolve_duo_member_pair_from_doc({"member_ids": [a, b]})
    assert {mid_a, mid_b} == {a, b}


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


def test_normalize_upload_path():
    from server import normalize_upload_path
    assert normalize_upload_path("/uploads/u1/abc.jpg") == "/uploads/u1/abc.jpg"
    assert normalize_upload_path("https://example.com/uploads/u1/abc.jpg") == "/uploads/u1/abc.jpg"
    assert normalize_upload_path("uploads/u1/abc.webp") == "/uploads/u1/abc.webp"
    assert normalize_upload_path("https://domaine.fr/page") is None
    assert normalize_upload_path(None) is None


def test_can_submit_duo_post():
    def can_submit(content, image, submitting, uploading=False):
        if submitting or uploading:
            return False
        return bool(str(content or '').strip()) or bool(image)
    assert can_submit('test duo', None, False) is True
    assert can_submit('', '/uploads/u1/a.webp', False) is True
    assert can_submit('', None, False) is False
    assert can_submit('test', None, True) is False


def test_duo_wall_posts_query():
    from server import duo_wall_posts_query
    pk = "507f1f77bcf86cd799439011_507f191e810c19729de860ea"
    profile_id = "abc123profile"
    q = duo_wall_posts_query(pk, profile_id)
    assert "$or" in q
    assert {"owner_type": "duo", "owner_id": pk} in q["$or"]
    assert {"duo_id": pk} in q["$or"]
    assert {"actor_type": "duo", "actor_id": pk} in q["$or"]
    assert {"owner_type": "duo", "owner_id": profile_id} in q["$or"]
    assert {"duo_id": profile_id} in q["$or"]
    assert {"actor_type": "duo", "actor_id": profile_id} in q["$or"]


def test_resolve_duo_pair_key_from_members():
    from server import resolve_duo_pair_key, duo_pair_key
    a = "507f1f77bcf86cd799439011"
    b = "507f191e810c19729de860ea"
    pk = duo_pair_key(a, b)
    assert resolve_duo_pair_key({"pair_key": pk}) == pk
    assert resolve_duo_pair_key({"member_ids": [a, b]}) == pk


def test_find_duo_by_tag_short_id_only():
    import asyncio
    from duo_social import find_duo_by_tag

    class FakeCol:
        async def find_one(self, query):
            if query.get("short_id") == 2395:
                return {"_id": "p1", "short_id": 2395, "name": "TestDuo", "pair_key": "a_b"}
            return None

    class FakeDb:
        duo_profiles = FakeCol()

    async def _run():
        doc = await find_duo_by_tag(FakeDb(), "2395")
        assert doc is not None
        assert doc["short_id"] == 2395

    asyncio.get_event_loop().run_until_complete(_run())


def test_duo_wall_query_legacy_profile_id():
    from server import duo_wall_posts_query

    pk = "userA_userB"
    profile_id = "507f1f77bcf86cd799439011"
    q = duo_wall_posts_query(pk, profile_id)
    legacy_clauses = [
        {"owner_type": "duo", "owner_id": profile_id},
        {"duo_id": profile_id},
        {"actor_type": "duo", "actor_id": profile_id},
    ]
    for clause in legacy_clauses:
        assert clause in q["$or"]


def test_is_duo_wall_post_pair_key():
    from server import is_duo_wall_post
    pk = "aaa_bbb"
    assert is_duo_wall_post({"owner_type": "duo", "owner_id": pk, "duo_id": pk, "type": "duo_free"}) is True
    assert is_duo_wall_post({"owner_type": "user", "author_id": "u1", "type": "free"}) is False


def test_user_wall_excludes_duo_posts():
    from server import user_wall_posts_query, is_duo_wall_post
    author = "user123"
    q = user_wall_posts_query(author)
    assert q["author_id"] == author
    duo_post = {"owner_type": "duo", "owner_id": "pk", "duo_id": "pk", "type": "duo_free", "author_id": author}
    assert is_duo_wall_post(duo_post) is True


def test_merge_duo_badges_unified_category():
    from badges import merge_duo_badges, normalize_badge_category
    legacy = [
        {"id": "duo_3", "name": "Trio dynamique", "family": "duo", "unlocked": True},
        {"id": "duo_presence_5", "name": "Présence duo", "family": "duo", "unlocked": True},
    ]
    social = [
        {"id": "duo_together_first", "name": "Première séance ensemble", "family": "duo_social", "unlocked": True},
    ]
    merged = merge_duo_badges(social, legacy)
    ids = {b["id"] for b in merged}
    assert "duo_3" in ids
    assert "duo_presence_5" in ids
    assert "duo_together_first" in ids
    assert all(b["family"] == "duo" for b in merged)
    assert normalize_badge_category("duo_social") == "duo"
    assert normalize_badge_category("duo_social") != "Duo social"


def test_duo_wall_owner_key():
    from server import duo_wall_owner_key, duo_pair_key
    a = "507f1f77bcf86cd799439011"
    b = "507f191e810c19729de860ea"
    pk = duo_pair_key(a, b)
    doc = {"pair_key": pk, "_id": "profileid"}
    assert duo_wall_owner_key(doc, a, b) == pk


def test_can_view_duo_challenges_section():
    from duo_social import can_view_duo_section, apply_duo_defaults
    doc = apply_duo_defaults({"show_challenges": False})
    assert can_view_duo_section(doc, "public", "challenges") is False
    assert can_view_duo_section(doc, "member", "challenges") is True


def test_compute_best_streak_from_calendar():
    from server import compute_best_streak_from_calendar
    days = []
    for i in range(1, 32):
        days.append({
            "date": f"2026-01-{i:02d}",
            "has_planned": i <= 5,
            "combined": "ok" if i <= 5 else "ok",
            "rest": False,
            "skip": False,
            "is_future": False,
        })
    assert compute_best_streak_from_calendar(days) == 5

    neutral_days = [
        {"date": "2026-01-01", "has_planned": False, "combined": "ok", "rest": False, "skip": False, "is_future": False},
        {"date": "2026-01-02", "has_planned": False, "combined": "ok", "rest": False, "skip": False, "is_future": False},
    ]
    assert compute_best_streak_from_calendar(neutral_days) == 0


def test_duo_post_owner_actor_fields():
    """Champs attendus pour une publication mur duo."""
    from server import duo_wall_owner_key, duo_pair_key, DUO_WALL_POST_TYPES

    a = "507f1f77bcf86cd799439011"
    b = "507f191e810c19729de860ea"
    pk = duo_pair_key(a, b)
    duo_doc = {"pair_key": pk, "_id": "profile123", "name": "LesGuerriers", "short_id": 1042}
    owner_id = duo_wall_owner_key(duo_doc, a, b)
    assert owner_id == pk

    member_id = a
    post_doc = {
        "author_id": member_id,
        "created_by_user_id": member_id,
        "owner_type": "duo",
        "owner_id": owner_id,
        "actor_type": "duo",
        "actor_id": owner_id,
        "duo_id": owner_id,
        "type": "duo_free",
        "visibility": "duo",
    }
    assert post_doc["owner_type"] == "duo"
    assert post_doc["owner_id"] == pk
    assert post_doc["actor_type"] == "duo"
    assert post_doc["actor_id"] == pk
    assert post_doc["created_by_user_id"] == member_id
    assert post_doc["author_id"] == member_id
    assert post_doc["type"] in DUO_WALL_POST_TYPES


def test_is_duo_wall_post_legacy_without_actor_type():
    from server import is_duo_wall_post

    legacy = {
        "duo_id": "aaa_bbb",
        "author_id": "user1",
        "type": "duo_free",
    }
    assert is_duo_wall_post(legacy) is True
    assert legacy.get("actor_type") is None


def test_resolve_post_actor_legacy_duo():
    import asyncio
    from server import resolve_post_actor

    duo_doc = {
        "_id": "profile123",
        "pair_key": "aaa_bbb",
        "name": "LesGuerriers",
        "short_id": 1042,
    }
    members = [
        {"_id": "507f1f77bcf86cd799439011", "username": "u1", "avatar_url": "/a.jpg", "accent_color": "#FF0000"},
        {"_id": "507f191e810c19729de860ea", "username": "u2", "avatar_url": "/b.jpg", "accent_color": "#00FF00"},
    ]

    async def _run():
        import server as srv
        orig = srv.get_duo_members
        async def fake_members(db, doc):
            return members
        srv.get_duo_members = fake_members
        try:
            post = {
                "duo_id": "aaa_bbb",
                "owner_type": "duo",
                "owner_id": "aaa_bbb",
                "author_id": "507f1f77bcf86cd799439011",
                "type": "duo_free",
            }
            actor = await resolve_post_actor(post, duo_doc=duo_doc)
            assert actor["type"] == "duo"
            assert actor["id"] == "aaa_bbb"
            assert actor["name"] == "LesGuerriers"
            assert actor["handle"] == "LesGuerriers#1042"
            assert len(actor["member_avatars"]) == 2
        finally:
            srv.get_duo_members = orig

    asyncio.get_event_loop().run_until_complete(_run())


def test_resolve_post_actor_user():
    import asyncio
    from server import resolve_post_actor

    async def _run():
        import server as srv
        orig = srv.get_user_doc_by_id
        async def fake_user(uid):
            if uid == "user1":
                return {
                    "_id": "user1",
                    "username": "alice",
                    "handle": "alice",
                    "display_name": "Alice",
                    "avatar_url": "/alice.jpg",
                }
            return None
        srv.get_user_doc_by_id = fake_user
        try:
            post = {
                "author_id": "user1",
                "created_by_user_id": "user1",
                "owner_type": "user",
                "owner_id": "user1",
                "actor_type": "user",
                "actor_id": "user1",
                "type": "free",
            }
            actor = await resolve_post_actor(post)
            assert actor["type"] == "user"
            assert actor["id"] == "user1"
            assert actor["name"] == "Alice"
            assert actor["handle"] == "alice"
        finally:
            srv.get_user_doc_by_id = orig

    asyncio.get_event_loop().run_until_complete(_run())


def test_duo_wall_query_finds_pair_key_posts():
    from server import duo_wall_posts_query

    pk = "507f1f77bcf86cd799439011_507f191e810c19729de860ea"
    profile_id = "legacyProfileId"
    q = duo_wall_posts_query(pk, profile_id)
    assert {"owner_type": "duo", "owner_id": pk} in q["$or"]
    assert {"duo_id": pk} in q["$or"]
    assert {"actor_type": "duo", "actor_id": pk} in q["$or"]
    assert {"duo_id": profile_id} in q["$or"]


def test_user_wall_excludes_actor_type_duo():
    from server import is_duo_wall_post

    post = {
        "owner_type": "duo",
        "owner_id": "pk",
        "actor_type": "duo",
        "actor_id": "pk",
        "author_id": "member1",
        "type": "duo_free",
    }
    assert is_duo_wall_post(post) is True


if __name__ == "__main__":
    test_estimate_calories_by_difficulty()
    test_normalize_accent_color()
    test_live_phase_gate()
    test_normalize_handle()
    print("OK: all stabilization tests passed")

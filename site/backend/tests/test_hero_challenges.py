"""Tests catalogue / scoring / thèmes / idempotence Défis Héros."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi import HTTPException

from hero_challenges import (
    all_challenges,
    assert_profile_theme_allowed,
    attach_hero_metadata,
    build_hero_post_snapshot,
    build_snapshot,
    build_workout_blocks,
    can_use_profile_theme,
    evaluate_hero_result,
    get_challenge,
    is_playable,
    load_catalog,
    public_challenge,
)
from hero_exercise_media import resolve_hero_exercise_media


def test_catalog_loads_and_validates():
    data = load_catalog()
    assert data["version"] == 1
    ids = [c["id"] for c in data["challenges"]]
    assert "spider-man-tom-holland" in ids
    assert "thor-chris-hemsworth" in ids
    assert "black-adam-dwayne-johnson" in ids
    assert len(ids) == len(set(ids))


def test_public_labels_use_actor_or_generic_names():
    forbidden = (
        "Spider-Man",
        "Shang-Chi",
        "Deadpool",
        "Wolverine",
        "Batman",
        "Superman",
        "Wonder Woman",
        "Aquaman",
        "Black Adam",
        "Captain Marvel",
    )
    for challenge in all_challenges():
        visible = " ".join(
            str(value or "")
            for value in (
                challenge.get("character_name"),
                challenge.get("title"),
                (challenge.get("source") or {}).get("label"),
            )
        )
        assert not any(name in visible for name in forbidden)


def test_hero_media_is_optional_and_propagated_to_workout_blocks():
    challenge = get_challenge("spider-man-tom-holland")
    blocks = build_workout_blocks(challenge)
    images = [exercise.get("image_url") for exercise in blocks[0]["exercises"]]
    assert images[0].endswith(".gif")
    assert images[1].endswith(".gif")
    assert images[2] is None


def test_no_invented_loads():
    for challenge in all_challenges():
        for ex in (challenge.get("exercises") or []) + (challenge.get("coda_exercises") or []):
            if "load" in ex:
                assert ex["load"] is None


def test_spiderman_workout_and_benchmark():
    c = get_challenge("spider-man-tom-holland")
    assert c["challenge_type"] == "amrap"
    assert c["duration_seconds"] == 1200
    assert is_playable(c)
    reps = [ex.get("reps") for ex in c["exercises"]]
    assert reps == [5, 10, 15]
    assert all(ex.get("load") is None for ex in c["exercises"])
    assert c["benchmark"]["target"] == 27
    blocks = build_workout_blocks(c)
    assert len(blocks) == 1
    assert len(blocks[0]["exercises"]) == 3


def test_reference_programs_not_playable():
    for slug in (
        "wolverine-hugh-jackman",
        "superman-david-corenswet",
        "captain-marvel-brie-larson",
        "black-adam-dwayne-johnson",
    ):
        c = get_challenge(slug)
        assert c is not None
        assert is_playable(c) is False
        assert c["challenge_type"] in ("program_reference", "strength_reference")


def test_black_adam_source_url_null():
    c = get_challenge("black-adam-dwayne-johnson")
    assert c["source"]["url"] is None


def test_henry_cavill_is_nested_reference_not_own_workout():
    c = get_challenge("superman-david-corenswet")
    refs = c.get("related_references") or []
    assert any(r.get("id") == "superman-henry-cavill" for r in refs)
    assert get_challenge("superman-henry-cavill") is None


def test_wonder_woman_does_not_invent_supersets():
    c = get_challenge("wonder-woman-gal-gadot")
    unspecified = [ex for ex in c["exercises"] if ex.get("unspecified")]
    assert len(unspecified) == 1
    assert "non précisés" in unspecified[0]["name_i18n"]["fr"]


def test_thor_back_extension_open_series():
    c = get_challenge("thor-chris-hemsworth")
    ext = next(ex for ex in c["exercises"] if ex["exercise_id"] == "hero:back-extension")
    assert ext.get("hero_open_series") is True
    assert ext.get("reps") is None
    assert ext.get("sets") == 4


def test_snapshot_is_stable_copy():
    c = get_challenge("spider-man-tom-holland")
    snap = build_snapshot(c)
    c["benchmark"]["target"] = 99
    assert snap["benchmark"]["target"] == 27
    doc = attach_hero_metadata({"title": "x"}, get_challenge("spider-man-tom-holland"))
    assert doc["source_type"] == "hero_challenge"
    assert doc["hero_challenge_id"] == "spider-man-tom-holland"
    assert doc["hero_challenge_snapshot"]["benchmark"]["target"] == 27


def _spiderman_eval(rounds, duration=1200, status="completed"):
    snap = build_snapshot(get_challenge("spider-man-tom-holland"))
    return evaluate_hero_result(snap, {"rounds": rounds, "duration_seconds": duration}, session_status=status)


def test_spiderman_26_no_success():
    ev = _spiderman_eval(26)
    assert ev["completed"] is True
    assert ev["success"] is False
    assert ev["benchmark_reached"] is False
    assert ev["badge_id"] is None
    assert ev["rounds"] == 26
    assert ev["total_reps"] == 26 * 30


def test_spiderman_27_success():
    ev = _spiderman_eval(27)
    assert ev["success"] is True
    assert ev["benchmark_reached"] is True
    assert ev["badge_id"] == "hero_spiderman_challenge"
    assert ev["profile_theme_id"] == "spiderman"
    assert ev["total_reps"] == 810


def test_spiderman_30_success():
    ev = _spiderman_eval(30)
    assert ev["success"] is True
    assert ev["rounds"] == 30
    assert ev["total_reps"] == 900


def test_playable_structured_completion():
    snap = build_snapshot(get_challenge("thor-chris-hemsworth"))
    fail = evaluate_hero_result(snap, {"has_skips": True, "blocks_complete": False}, session_status="completed")
    assert fail["success"] is False
    ok = evaluate_hero_result(snap, {"has_skips": False, "blocks_complete": True}, session_status="completed")
    assert ok["success"] is True
    assert ok["badge_id"] == "hero_thor_challenge"


def test_deadpool_five_rounds():
    snap = build_snapshot(get_challenge("deadpool-ryan-reynolds"))
    four = evaluate_hero_result(snap, {"rounds": 4}, session_status="completed")
    assert four["success"] is False
    five = evaluate_hero_result(snap, {"rounds": 5}, session_status="completed")
    assert five["success"] is True


def test_aquaman_needs_coda():
    snap = build_snapshot(get_challenge("aquaman-jason-momoa"))
    no_coda = evaluate_hero_result(snap, {"rounds": 5, "coda_complete": False}, session_status="completed")
    assert no_coda["success"] is False
    ok = evaluate_hero_result(snap, {"rounds": 5, "coda_complete": True}, session_status="completed")
    assert ok["success"] is True


def test_theme_acl():
    assert can_use_profile_theme("default", set()) is True
    assert can_use_profile_theme("spiderman", set()) is False
    assert can_use_profile_theme("spiderman", {"hero_spiderman_challenge"}) is True
    with pytest.raises(HTTPException) as locked:
        assert_profile_theme_allowed("spiderman", set())
    assert locked.value.status_code == 403
    assert assert_profile_theme_allowed("spiderman", {"hero_spiderman_challenge"}) == "spiderman"
    assert assert_profile_theme_allowed("default", set()) == "default"
    with pytest.raises(HTTPException):
        assert_profile_theme_allowed("not-a-theme", {"hero_spiderman_challenge"})


def test_public_catalog_has_source_and_no_mutation_fields():
    pub = public_challenge(get_challenge("spider-man-tom-holland"))
    assert pub["source"]["url"]
    assert pub["is_curated"] is True
    assert "admin" not in pub


def test_hero_badges_in_solo_catalog():
    from badge_catalog import HERO_BADGES, SOLO_BADGES, get_badge_definition, get_catalog

    assert len(SOLO_BADGES) == 50
    assert len(HERO_BADGES) == 7
    solo = get_catalog("solo")
    ids = {b["id"] for b in solo}
    assert "hero_spiderman_challenge" in ids
    assert get_badge_definition("hero_spiderman_challenge")["category"] == "hero_challenge"


def test_no_user_post_create_hero_definition():
    import inspect
    import server

    source = inspect.getsource(server)
    assert '@api_router.post("/hero-challenges")' not in source
    assert '@api_router.put("/hero-challenges' not in source
    assert '@api_router.delete("/hero-challenges' not in source


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_create_session_records_attempts_and_best_score():
    from server import create_session, WorkoutSessionCreate

    workout_id = str(ObjectId())
    user_id = str(ObjectId())
    snap = build_snapshot(get_challenge("spider-man-tom-holland"))
    workout = {
        "_id": ObjectId(workout_id),
        "title": "Spider-Man — Tom Holland",
        "source_type": "hero_challenge",
        "hero_challenge_id": "spider-man-tom-holland",
        "hero_challenge_snapshot": snap,
    }
    mock_db = MagicMock()
    mock_db.scheduled_workouts.find_one = AsyncMock(return_value=workout)
    mock_db.scheduled_workouts.update_one = AsyncMock()
    inserted = []

    async def insert_session(doc):
        inserted.append(doc)
        return MagicMock(inserted_id=ObjectId())

    mock_db.workout_sessions.insert_one = AsyncMock(side_effect=insert_session)
    mock_db.hero_challenge_attempts.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

    user = {"id": user_id, "username": "qa", "partner_id": None}

    def make_payload(rounds):
        return WorkoutSessionCreate(
            workout_id=workout_id,
            total_time=1200,
            pause_time=0,
            exercises_completed=3,
            exercises_total=3,
            status="completed",
            hero_result={"rounds": rounds, "duration_seconds": 1200},
        )

    with patch("server.db", mock_db), patch("server.schedule_badge_evaluation"):
        s26 = _run(create_session(make_payload(26), user))
        s27 = _run(create_session(make_payload(27), user))
        s30 = _run(create_session(make_payload(30), user))

    assert s26["hero_result"]["success"] is False
    assert s27["hero_result"]["success"] is True
    assert s30["hero_result"]["rounds"] == 30
    assert mock_db.hero_challenge_attempts.insert_one.await_count == 3


def test_stamp_rejects_reference_program_without_blocks():
    from server import _stamp_hero_challenge

    with pytest.raises(HTTPException) as exc:
        _stamp_hero_challenge({}, "wolverine-hugh-jackman", {"locale": "fr"})
    assert exc.value.status_code == 400


def test_stamp_accepts_reference_program_with_client_blocks():
    from hero_challenges import build_reference_draft_blocks
    from server import _stamp_hero_challenge

    blocks = build_reference_draft_blocks(get_challenge("wolverine-hugh-jackman"), "fr")
    assert len(blocks[0]["exercises"]) == 4
    assert all(ex.get("load") is None for ex in blocks[0]["exercises"])
    doc = {"blocks": blocks}
    out = _stamp_hero_challenge(doc, "wolverine-hugh-jackman", {"locale": "fr"})
    assert out["hero_challenge_id"] == "wolverine-hugh-jackman"
    assert out["source_type"] == "hero_challenge"


def test_simu_liu_media_aliases_and_durations():
    challenge = get_challenge("shang-chi-simu-liu")
    bike = challenge["exercises"][0]
    assert bike["duration"] == 300
    assert bike["image_url"].endswith("H1PESYI.gif")
    trap = next(ex for ex in challenge["exercises"] if ex["exercise_id"] == "hero:trap-bar-deadlift-bands")
    assert trap["sets"] == 5 and trap["reps"] == 5
    assert resolve_hero_exercise_media("hero:lat-pulldown")["catalog_id"] == "exdb_ecpY0rH"
    sled = resolve_hero_exercise_media("hero:sled-sprint")
    assert sled.get("gif_url") is None
    assert sled.get("fallback") == "cardio"
    blocks = build_workout_blocks(challenge)
    assert blocks[0]["exercises"][0]["duration"] == 300


def test_evaluate_hero_result_includes_visual_theme():
    snap = build_snapshot(get_challenge("shang-chi-simu-liu"))
    ev = evaluate_hero_result(
        snap,
        {"duration_seconds": 1800, "blocks_complete": True},
        session_status="completed",
    )
    assert ev["visual_theme"]["id"] == "shangchi"
    assert ev["title"] == "Simu Liu Explosive Day"
    assert ev["challenge_type"] == "structured"


def test_build_hero_post_snapshot_preserves_theme_without_live_catalog():
    snap = build_snapshot(get_challenge("shang-chi-simu-liu"))
    session_result = evaluate_hero_result(
        snap,
        {"duration_seconds": 900, "blocks_complete": True},
        session_status="completed",
    )
    post = build_hero_post_snapshot(session_result, snap, {"title": "Simu Liu Explosive Day"})
    assert post["visual_theme"]["id"] == "shangchi"
    assert post["duration_seconds"] == 900
    assert post["challenge_id"] == "shang-chi-simu-liu"
    assert post["title"] == "Simu Liu Explosive Day"

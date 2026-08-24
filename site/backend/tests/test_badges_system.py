"""Couverture catalogue + moteur de progression badges."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest

from badge_catalog import (
    DUO_BADGES,
    LEGACY_BADGE_ID_MAP,
    SOLO_BADGES,
    canonical_badge_id,
    get_badge_definition,
    validate_catalog,
)
from badge_progress import (
    BadgeProgressService,
    evaluate_badge,
    evaluate_multiple_conditions,
    evaluate_threshold,
)


# ─── Catalogue ───────────────────────────────────────────────

def test_catalog_exactly_50_solo_and_duo():
    assert len(SOLO_BADGES) == 50
    assert len(DUO_BADGES) == 50


def test_catalog_rarity_distribution():
    for scope, badges in (("solo", SOLO_BADGES), ("duo", DUO_BADGES)):
        counts = {"common": 0, "rare": 0, "epic": 0, "legendary": 0}
        for b in badges:
            counts[b["rarity"]] += 1
        assert counts == {"common": 20, "rare": 15, "epic": 10, "legendary": 5}, scope


def test_catalog_no_duplicate_ids():
    ids = [b["id"] for b in SOLO_BADGES + DUO_BADGES]
    assert len(ids) == len(set(ids))


def test_catalog_required_fields():
    for b in SOLO_BADGES + DUO_BADGES:
        assert b.get("name")
        assert b.get("description")
        assert b.get("condition_type")
        assert b.get("icon_key")
        assert b.get("scope") in ("solo", "duo")


def test_validate_catalog_ok():
    result = validate_catalog()
    assert result["ok"] is True
    assert "duo_first_goal" in result["disabled"]
    assert "duo_double_individual_goal" in result["disabled"]


def test_disabled_badges_not_evaluated_as_eligible_without_metric():
    disabled = [b for b in DUO_BADGES if not b.get("enabled", True)]
    assert len(disabled) == 2
    for b in disabled:
        progress = evaluate_badge(b, {"duo_goals_created": 99, "both_members_weekly_goal_reached": 99})
        assert progress.get("eligible") is False
        assert progress.get("disabled") is True


def test_legacy_id_mapping():
    assert canonical_badge_id("vol_10") == "solo_ten_workouts"
    assert canonical_badge_id("duo_together_first") == "duo_first_common_workout"
    assert get_badge_definition("streak_3")["id"] == "solo_streak_three"


# ─── Évaluateurs ─────────────────────────────────────────────

def test_evaluate_threshold_progress():
    definition = {
        "condition_type": "completed_workouts",
        "condition_value": 10,
        "enabled": True,
        "id": "solo_ten_workouts",
    }
    result = evaluate_badge(definition, {"completed_workouts": 7})
    assert result["current"] == 7
    assert result["target"] == 10
    assert result["percentage"] == 70
    assert result["eligible"] is False


def test_percentage_clamped_0_100():
    definition = {
        "condition_type": "completed_workouts",
        "condition_value": 10,
        "enabled": True,
        "id": "x",
    }
    over = evaluate_badge(definition, {"completed_workouts": 50})
    assert over["percentage"] == 100
    assert over["eligible"] is True
    under = evaluate_badge(definition, {"completed_workouts": -5})
    assert under["percentage"] == 0


def test_multiple_conditions():
    definition = {
        "id": "duo_active_thirty_days",
        "condition_type": "duo_age_and_common_workouts",
        "condition_value": 1,
        "condition_params": {"minimum_age_days": 30, "minimum_common_workouts": 10},
        "enabled": True,
    }
    result = evaluate_multiple_conditions(
        {"duo_age_days": 40, "duo_common_workouts": 8},
        definition,
    )
    assert result["eligible"] is False
    assert result["current"]["age_days"] == 40
    assert result["target"]["common_workouts"] == 10

    ok = evaluate_multiple_conditions(
        {"duo_age_days": 40, "duo_common_workouts": 10},
        definition,
    )
    assert ok["eligible"] is True


def test_unlocked_duo_badges_excludes_self():
    definition = next(b for b in DUO_BADGES if b["id"] == "duo_ten_badges")
    ids = [f"duo_extra_{i}" for i in range(10)] + ["duo_ten_badges"]
    metrics = {"unlocked_duo_badge_ids": ids}
    progress = evaluate_badge(definition, metrics)
    assert progress["current"] == 10
    assert progress["eligible"] is True
    # With only 9 others → not eligible
    metrics2 = {"unlocked_duo_badge_ids": [f"duo_extra_{i}" for i in range(9)] + ["duo_ten_badges"]}
    progress2 = evaluate_badge(definition, metrics2)
    assert progress2["current"] == 9
    assert progress2["eligible"] is False


# ─── Fake Mongo helpers ──────────────────────────────────────

class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, n):
        return list(self._docs)[:n]


class FakeCollection:
    def __init__(self):
        self.docs: List[dict] = []
        self._id_counter = 0

    def find(self, query=None, projection=None):
        return FakeCursor(self._match(query or {}))

    async def find_one(self, query):
        matched = self._match(query)
        return matched[0] if matched else None

    async def count_documents(self, query):
        return len(self._match(query))

    async def insert_one(self, doc):
        # unique constraint simulation for badges
        if "user_id" in doc and "badge_id" in doc:
            for d in self.docs:
                if d.get("user_id") == doc["user_id"] and d.get("badge_id") == doc["badge_id"]:
                    raise Exception("duplicate key")
        if "pair_key" in doc and "badge_id" in doc:
            for d in self.docs:
                if d.get("pair_key") == doc["pair_key"] and d.get("badge_id") == doc["badge_id"]:
                    raise Exception("duplicate key")
        self._id_counter += 1
        stored = {**doc, "_id": f"oid{self._id_counter}"}
        self.docs.append(stored)
        result = MagicMock()
        result.inserted_id = stored["_id"]
        return result

    async def create_index(self, *args, **kwargs):
        return "ok"

    def _match(self, query: dict) -> List[dict]:
        out = []
        for d in self.docs:
            if self._doc_matches(d, query):
                out.append(d)
        return out

    def _doc_matches(self, doc: dict, query: dict) -> bool:
        for k, v in query.items():
            if k == "$or":
                if not any(self._doc_matches(doc, clause) for clause in v):
                    return False
                continue
            if k == "$and":
                if not all(self._doc_matches(doc, clause) for clause in v):
                    return False
                continue
            if isinstance(v, dict):
                if "$in" in v:
                    if doc.get(k) not in v["$in"]:
                        return False
                elif "$ne" in v:
                    if doc.get(k) == v["$ne"]:
                        return False
                elif "$gte" in v:
                    if (doc.get(k) or "") < v["$gte"]:
                        return False
                else:
                    return False
            else:
                if doc.get(k) != v:
                    return False
        return True


class FakeDB:
    def __init__(self):
        self.workout_sessions = FakeCollection()
        self.user_badges = FakeCollection()
        self.duo_badges = FakeCollection()
        self.scheduled_workouts = FakeCollection()
        self.workout_templates = FakeCollection()
        self.challenge_completions = FakeCollection()
        self.duo_profiles = FakeCollection()
        self.posts = FakeCollection()
        self.notifications = FakeCollection()
        self.hero_challenge_attempts = FakeCollection()


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture
def service(db):
    BadgeProgressService.invalidate_cache()
    return BadgeProgressService(db)


# ─── Solo ────────────────────────────────────────────────────

def test_new_account_zero_badges(service, db):
    catalog = _run(service.get_solo_catalog_with_progress("user_new"))
    assert catalog["summary"]["unlocked"] == 0
    assert catalog["summary"]["total"] == 57
    assert all(not b["unlocked"] for b in catalog["badges"])


def test_first_workout_unlocks_premier_pas(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u1",
        "status": "completed",
        "created_at": now,
        "total_time": 600,
        "estimated_calories": 50,
    })
    newly = _run(service.evaluate_solo_badges("u1", notify=False))
    assert "solo_first_workout" in newly
    unlocked = _run(service.get_unlocked_solo("u1"))
    assert "solo_first_workout" in unlocked


def test_third_workout_unlocks_cest_parti(service, db):
    now = datetime.now(timezone.utc)
    for i in range(3):
        db.workout_sessions.docs.append({
            "user_id": "u2",
            "status": "completed",
            "created_at": (now - timedelta(days=i)).isoformat(),
            "total_time": 600,
            "estimated_calories": 40,
        })
    newly = _run(service.evaluate_solo_badges("u2", notify=False))
    assert "solo_first_workout" in newly
    assert "solo_three_workouts" in newly


def test_other_user_sessions_not_counted(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "other",
        "status": "completed",
        "created_at": now,
        "total_time": 3600,
        "estimated_calories": 300,
    })
    metrics = _run(service.get_solo_metrics("u3"))
    assert metrics["completed_workouts"] == 0


def test_null_calories_not_fictional(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u4",
        "status": "completed",
        "created_at": now,
        "total_time": 0,
        "estimated_calories": None,
    })
    metrics = _run(service.get_solo_metrics("u4"))
    assert metrics["total_calories"] == 0


def test_badge_not_recreated(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u5",
        "status": "completed",
        "created_at": now,
        "total_time": 600,
    })
    first = _run(service.evaluate_solo_badges("u5", notify=False))
    second = _run(service.evaluate_solo_badges("u5", notify=False))
    assert "solo_first_workout" in first
    assert second == []
    assert len(db.user_badges.docs) == len({d["badge_id"] for d in db.user_badges.docs})


def test_secret_badge_masked_when_locked(service, db):
    catalog = _run(service.get_solo_catalog_with_progress("u6"))
    secret = next(b for b in catalog["badges"] if b["id"] == "solo_forty_active_weeks")
    assert secret["unlocked"] is False
    assert secret["name"] == "Succès secret"
    assert "découvrir" in (secret["description"] or "").lower() or "secret" in (secret["description"] or "").lower()


def test_streak_from_real_dates(service, db):
    base = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    for i in range(5):
        db.workout_sessions.docs.append({
            "user_id": "u7",
            "status": "completed",
            "created_at": (base - timedelta(days=i)).isoformat(),
            "total_time": 300,
        })
    metrics = _run(service.get_solo_metrics("u7"))
    assert metrics["best_streak_days"] >= 5


# ─── Duo ─────────────────────────────────────────────────────

def test_no_duo_badges_without_pair_key(service, db):
    result = _run(service.get_duo_catalog_with_progress(""))
    assert result["badges"] == []
    newly = _run(service.evaluate_duo_badges("", notify=False))
    assert newly == []


def test_single_member_session_not_common(service, db):
    pair = "aaa_bbb"
    now = datetime.now(timezone.utc).isoformat()
    db.duo_profiles.docs.append({"pair_key": pair, "created_at": now, "member_ids": ["aaa", "bbb"]})
    db.workout_sessions.docs.append({
        "user_id": "aaa",
        "status": "completed",
        "created_at": now,
        "total_time": 600,
    })
    metrics = _run(service.get_duo_metrics(pair))
    assert metrics["duo_common_workouts"] == 0
    assert metrics["duo_common_active_days"] == 0


def test_both_active_same_day_counts(service, db):
    pair = "aaa_bbb"
    day = datetime.now(timezone.utc).replace(hour=10).isoformat()
    db.duo_profiles.docs.append({"pair_key": pair, "created_at": day, "member_ids": ["aaa", "bbb"]})
    db.workout_sessions.docs.extend([
        {"user_id": "aaa", "status": "completed", "created_at": day, "total_time": 600},
        {"user_id": "bbb", "status": "completed", "created_at": day, "total_time": 900},
    ])
    metrics = _run(service.get_duo_metrics(pair))
    assert metrics["duo_common_active_days"] == 1
    assert metrics["duo_common_workouts"] == 1
    assert metrics["duo_common_minutes"] == 10  # min(10, 15)


def test_common_workout_not_double_counted(service, db):
    pair = "aaa_bbb"
    day = datetime.now(timezone.utc).replace(hour=10).isoformat()
    db.duo_profiles.docs.append({"pair_key": pair, "created_at": day})
    # Two sessions each same day → still 1 common workout
    db.workout_sessions.docs.extend([
        {"user_id": "aaa", "status": "completed", "created_at": day, "total_time": 600},
        {"user_id": "aaa", "status": "completed", "created_at": day, "total_time": 300},
        {"user_id": "bbb", "status": "completed", "created_at": day, "total_time": 600},
        {"user_id": "bbb", "status": "completed", "created_at": day, "total_time": 300},
    ])
    metrics = _run(service.get_duo_metrics(pair))
    assert metrics["duo_common_workouts"] == 1


def test_old_pair_key_not_inherited(service, db):
    old_pair = "aaa_old"
    new_pair = "aaa_ccc"
    day = datetime.now(timezone.utc).isoformat()
    db.duo_badges.docs.append({
        "pair_key": old_pair,
        "badge_id": "duo_created",
        "unlocked_at": day,
    })
    db.duo_profiles.docs.append({"pair_key": new_pair, "created_at": day})
    unlocked_new = _run(service.get_unlocked_duo(new_pair))
    assert "duo_created" not in unlocked_new


def test_both_members_see_same_duo_badges(service, db):
    pair = "aaa_bbb"
    day = datetime.now(timezone.utc).isoformat()
    db.duo_profiles.docs.append({
        "pair_key": pair,
        "created_at": day,
        "account_visibility": "private",
        "member_roles": {"aaa": "leader"},
    })
    _run(service.evaluate_duo_badges(pair, notify=False))
    catalog = _run(service.get_duo_catalog_with_progress(pair))
    unlocked_ids = {b["id"] for b in catalog["badges"] if b["unlocked"]}
    assert "duo_created" in unlocked_ids
    # Same catalog for both — pair_key based
    again = _run(service.get_duo_catalog_with_progress(pair))
    assert {b["id"] for b in again["badges"] if b["unlocked"]} == unlocked_ids


def test_roles_configured_unlocks_once(service, db):
    pair = "aaa_bbb"
    day = datetime.now(timezone.utc).isoformat()
    db.duo_profiles.docs.append({
        "pair_key": pair,
        "created_at": day,
        "member_roles": {"aaa": "coach", "bbb": "member"},
    })
    first = _run(service.evaluate_duo_badges(pair, notify=False))
    second = _run(service.evaluate_duo_badges(pair, notify=False))
    assert "duo_roles_configured" in first
    assert "duo_roles_configured" not in second


# ─── Publication helpers (logic) ─────────────────────────────

def test_locked_badge_not_publishable_logic(service, db):
    badge = _run(service.find_unlocked_badge("solo", "u9", "solo_first_workout"))
    assert badge is None


def test_publish_uses_catalog_server_data():
    definition = get_badge_definition("solo_ten_workouts")
    assert definition["name"] == "Dix sur dix"
    assert definition["rarity"] == "rare"
    # Client cannot invent — server uses definition fields


def test_recalculate_idempotent(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u10",
        "status": "completed",
        "created_at": now,
        "total_time": 1800,
        "estimated_calories": 150,
    })
    a = _run(service.evaluate_solo_badges("u10", notify=False))
    b = _run(service.evaluate_solo_badges("u10", notify=False))
    assert len(a) >= 1
    assert b == []


def test_notification_only_on_first_unlock(service, db):
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u11",
        "status": "completed",
        "created_at": now,
        "total_time": 600,
    })
    _run(service.evaluate_solo_badges("u11", notify=True))
    count1 = len(db.notifications.docs)
    _run(service.evaluate_solo_badges("u11", notify=True))
    count2 = len(db.notifications.docs)
    assert count1 >= 1
    assert count2 == count1


def test_infer_unlock_at_uses_nth_session():
    definition = get_badge_definition("solo_three_workouts")
    metrics = {
        "_timeline_completed_at": [
            "2024-01-01T10:00:00+00:00",
            "2024-01-02T10:00:00+00:00",
            "2024-01-05T10:00:00+00:00",
        ],
    }
    at = BadgeProgressService.infer_unlock_at(definition, metrics)
    assert at == "2024-01-05T10:00:00+00:00"


def test_historical_unlock_preserves_date(service, db):
    historical = "2024-06-15T08:00:00+00:00"
    definition = get_badge_definition("solo_first_workout")
    doc = _run(
        service.unlock_badge_if_eligible(
            scope="solo",
            owner_id="u_hist",
            definition=definition,
            progress={"eligible": True, "current": 1, "target": 1},
            notify=False,
            unlocked_at=historical,
        )
    )
    assert doc is not None
    assert doc["unlocked_at"] == historical
    assert len(db.notifications.docs) == 0


def test_migration_process_solo_dry_run_no_writes(service, db):
    from recalculate_badges import _empty_summary, _process_solo

    day1 = "2024-03-01T09:00:00+00:00"
    day2 = "2024-03-02T09:00:00+00:00"
    day3 = "2024-03-03T09:00:00+00:00"
    for d in (day1, day2, day3):
        db.workout_sessions.docs.append({
            "user_id": "u_mig",
            "status": "completed",
            "created_at": d,
            "total_time": 600,
            "estimated_calories": 50,
        })
    summary = _empty_summary(dry_run=True, notify=False)
    before_badges = len(db.user_badges.docs)
    before_notifs = len(db.notifications.docs)
    _run(_process_solo(service, "u_mig", dry_run=True, notify=False, summary=summary))
    assert len(db.user_badges.docs) == before_badges
    assert len(db.notifications.docs) == before_notifs
    assert summary["badges_added"] >= 2
    assert summary["notifications_sent"] == 0


def test_migration_process_solo_write_no_notify_by_default(service, db):
    from recalculate_badges import _empty_summary, _process_solo

    day1 = "2024-04-01T09:00:00+00:00"
    db.workout_sessions.docs.append({
        "user_id": "u_mig2",
        "status": "completed",
        "created_at": day1,
        "total_time": 600,
        "estimated_calories": 50,
    })
    summary = _empty_summary(dry_run=False, notify=False)
    _run(_process_solo(service, "u_mig2", dry_run=False, notify=False, summary=summary))
    assert summary["badges_added"] >= 1
    assert summary["notifications_sent"] == 0
    assert len(db.notifications.docs) == 0
    unlocked = _run(service.get_unlocked_solo("u_mig2"))
    assert "solo_first_workout" in unlocked
    assert unlocked["solo_first_workout"]["unlocked_at"] == day1


def test_migration_does_not_recreate_present_badges(service, db):
    from recalculate_badges import _empty_summary, _process_solo

    day1 = "2024-05-01T09:00:00+00:00"
    db.workout_sessions.docs.append({
        "user_id": "u_mig3",
        "status": "completed",
        "created_at": day1,
        "total_time": 600,
    })
    db.user_badges.docs.append({
        "user_id": "u_mig3",
        "badge_id": "solo_first_workout",
        "unlocked_at": day1,
    })
    summary = _empty_summary(dry_run=False, notify=False)
    _run(_process_solo(service, "u_mig3", dry_run=False, notify=False, summary=summary))
    assert summary["badges_already_present"] >= 1
    assert len([d for d in db.user_badges.docs if d["badge_id"] == "solo_first_workout"]) == 1


def test_normal_trigger_still_notifies(service, db):
    """L'usage normal (notify=True) continue d'envoyer des notifications."""
    now = datetime.now(timezone.utc).isoformat()
    db.workout_sessions.docs.append({
        "user_id": "u_live",
        "status": "completed",
        "created_at": now,
        "total_time": 600,
    })
    _run(service.evaluate_solo_badges("u_live", notify=True))
    assert len(db.notifications.docs) >= 1

"""Moteur canonique de progression et déblocage des badges.

Un seul moteur pour scope=solo et scope=duo.
Idempotent via index unique + upsert. Les erreurs n'interrompent pas les flux métier.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from badge_catalog import (
    CATALOG_VERSION,
    DUO_BADGES,
    LEGACY_ORPHAN_BADGE_IDS,
    SOLO_BADGES,
    canonical_badge_id,
    get_badge_definition,
    get_catalog,
    rarity_summary,
)
from badges import catalog_badge_to_public

logger = logging.getLogger(__name__)

# Cache mémoire simple (pas de Redis) — invalidé après événements pertinents
_METRICS_CACHE: Dict[str, Tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 45.0

CATEGORY_NORMALIZE = {
    "lower": "legs",
    "legs": "legs",
    "jambes": "legs",
    "upper": "upper_body",
    "upper_body": "upper_body",
    "haut": "upper_body",
    "cardio": "cardio",
    "cooldown": "stretching",
    "stretching": "stretching",
    "etirements": "stretching",
    "étirements": "stretching",
    "mobility": "mobility",
    "mobilite": "mobility",
    "mobilité": "mobility",
    "warmup": "mobility",
    "core": "upper_body",
    "general": "general",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        raw = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _day_key(value: Optional[str]) -> Optional[str]:
    dt = _parse_dt(value)
    if dt:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
    if value and len(str(value)) >= 10:
        return str(value)[:10]
    return None


def _week_key(day: str) -> str:
    d = datetime.strptime(day, "%Y-%m-%d").date()
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _month_key(day: str) -> str:
    return day[:7]


def _estimate_calories(total_time_seconds: int, difficulty: Optional[int] = None) -> int:
    minutes = max(0, (total_time_seconds or 0) / 60)
    if minutes <= 0:
        return 0
    factor = 5.0
    if difficulty and difficulty >= 4:
        factor = 7.0
    elif difficulty and difficulty >= 3:
        factor = 6.0
    return int(round(minutes * factor))


def _best_streak(days: List[str]) -> int:
    if not days:
        return 0
    uniq = sorted(set(days))
    best = 1
    cur = 1
    for i in range(1, len(uniq)):
        prev = datetime.strptime(uniq[i - 1], "%Y-%m-%d").date()
        day = datetime.strptime(uniq[i], "%Y-%m-%d").date()
        if (day - prev).days == 1:
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def _normalize_category(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    key = str(raw).strip().lower()
    return CATEGORY_NORMALIZE.get(key, key)


def evaluate_threshold(metrics: dict, definition: dict) -> dict:
    key = definition["condition_type"]
    target = definition.get("condition_value") or 1
    current = metrics.get(key, 0) or 0
    if not isinstance(current, (int, float)):
        current = 0
    try:
        target_n = float(target)
    except (TypeError, ValueError):
        target_n = 1
    percentage = min(100, max(0, round((current / target_n) * 100))) if target_n > 0 else 0
    return {
        "current": current if isinstance(current, int) else round(current, 1),
        "target": int(target_n) if float(target_n).is_integer() else target_n,
        "percentage": percentage,
        "eligible": current >= target_n,
    }


def evaluate_metric_key(metric_key: str):
    def _eval(metrics: dict, definition: dict) -> dict:
        target = definition.get("condition_value") or 1
        current = metrics.get(metric_key, 0) or 0
        if not isinstance(current, (int, float)):
            current = 0
        try:
            target_n = float(target)
        except (TypeError, ValueError):
            target_n = 1
        percentage = min(100, max(0, round((current / target_n) * 100))) if target_n > 0 else 0
        return {
            "current": int(current) if float(current).is_integer() else round(current, 1),
            "target": int(target_n) if float(target_n).is_integer() else target_n,
            "percentage": percentage,
            "eligible": current >= target_n,
        }

    return _eval


def evaluate_category(metrics: dict, definition: dict) -> dict:
    params = definition.get("condition_params") or {}
    cat = _normalize_category(params.get("category"))
    counts = metrics.get("category_counts") or {}
    current = int(counts.get(cat, 0) or 0) if cat else 0
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


def evaluate_category_group(metrics: dict, definition: dict) -> dict:
    params = definition.get("condition_params") or {}
    cats = [_normalize_category(c) for c in (params.get("categories") or [])]
    counts = metrics.get("category_counts") or {}
    current = sum(int(counts.get(c, 0) or 0) for c in cats if c)
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


def evaluate_before_hour(metrics: dict, definition: dict) -> dict:
    hour = (definition.get("condition_params") or {}).get("hour", 9)
    by_hour = metrics.get("workouts_before_hour") or {}
    current = int(by_hour.get(int(hour), 0) or 0)
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


def evaluate_after_hour(metrics: dict, definition: dict) -> dict:
    hour = (definition.get("condition_params") or {}).get("hour", 21)
    by_hour = metrics.get("workouts_after_hour") or {}
    current = int(by_hour.get(int(hour), 0) or 0)
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


def evaluate_multiple_conditions(metrics: dict, definition: dict) -> dict:
    params = definition.get("condition_params") or {}
    age_target = int(params.get("minimum_age_days") or 0)
    workouts_target = int(params.get("minimum_common_workouts") or 0)
    age_current = int(metrics.get("duo_age_days") or 0)
    workouts_current = int(metrics.get("duo_common_workouts") or 0)
    eligible = age_current >= age_target and workouts_current >= workouts_target
    # Pourcentage = moyenne des ratios
    ratios = []
    if age_target > 0:
        ratios.append(min(1.0, age_current / age_target))
    if workouts_target > 0:
        ratios.append(min(1.0, workouts_current / workouts_target))
    percentage = min(100, max(0, round((sum(ratios) / len(ratios)) * 100))) if ratios else 0
    return {
        "current": {"age_days": age_current, "common_workouts": workouts_current},
        "target": {"age_days": age_target, "common_workouts": workouts_target},
        "percentage": percentage,
        "eligible": eligible,
    }


def evaluate_unlocked_duo_badges(metrics: dict, definition: dict) -> dict:
    """Ne se compte pas lui-même avant déblocage."""
    target = definition.get("condition_value") or 10
    badge_id = definition["id"]
    unlocked = set(metrics.get("unlocked_duo_badge_ids") or [])
    # Exclure ce badge du compteur
    count = len(unlocked - {badge_id})
    percentage = min(100, max(0, round((count / target) * 100))) if target else 0
    return {"current": count, "target": target, "percentage": percentage, "eligible": count >= target}


BADGE_EVALUATORS: Dict[str, Callable[[dict, dict], dict]] = {
    "completed_workouts": evaluate_metric_key("completed_workouts"),
    "total_active_days": evaluate_metric_key("total_active_days"),
    "best_streak_days": evaluate_metric_key("best_streak_days"),
    "total_workout_minutes": evaluate_metric_key("total_workout_minutes"),
    "total_calories": evaluate_metric_key("total_calories"),
    "active_days_in_week": evaluate_metric_key("max_active_days_in_week"),
    "completed_workouts_in_week": evaluate_metric_key("max_workouts_in_week"),
    "completed_workouts_in_month": evaluate_metric_key("max_workouts_in_month"),
    "single_workout_duration_minutes": evaluate_metric_key("max_single_workout_minutes"),
    "completed_without_abandon": evaluate_metric_key("completed_without_abandon"),
    "completed_without_skipped_exercise": evaluate_metric_key("completed_without_skipped_exercise"),
    "distinct_workout_categories": evaluate_metric_key("distinct_workout_categories"),
    "planned_workouts": evaluate_metric_key("planned_workouts"),
    "custom_workouts_created": evaluate_metric_key("custom_workouts_created"),
    "completed_planned_workouts": evaluate_metric_key("completed_planned_workouts"),
    "completed_solo_challenges": evaluate_metric_key("completed_solo_challenges"),
    "comeback_after_inactive_days": evaluate_metric_key("comeback_after_inactive_days"),
    "active_weeks_in_month": evaluate_metric_key("max_active_weeks_in_month"),
    "total_active_weeks": evaluate_metric_key("total_active_weeks"),
    "completed_category": evaluate_category,
    "completed_category_group": evaluate_category_group,
    "workouts_before_hour": evaluate_before_hour,
    "workouts_after_hour": evaluate_after_hour,
    # Duo
    "duo_created": evaluate_metric_key("duo_created"),
    "duo_common_workouts": evaluate_metric_key("duo_common_workouts"),
    "duo_common_active_days": evaluate_metric_key("duo_common_active_days"),
    "duo_common_workouts_in_week": evaluate_metric_key("duo_max_common_workouts_in_week"),
    "duo_challenges_joined": evaluate_metric_key("duo_challenges_joined"),
    "duo_posts_created": evaluate_metric_key("duo_posts_created"),
    "partner_activity_reactions": evaluate_metric_key("partner_activity_reactions"),
    "duo_workouts_planned": evaluate_metric_key("duo_workouts_planned"),
    "same_workout_completed_by_both": evaluate_metric_key("same_workout_completed_by_both"),
    "duo_common_minutes": evaluate_metric_key("duo_common_minutes"),
    "duo_best_streak_days": evaluate_metric_key("duo_best_streak_days"),
    "duo_roles_configured": evaluate_metric_key("duo_roles_configured"),
    "duo_banner_configured": evaluate_metric_key("duo_banner_configured"),
    "duo_privacy_configured": evaluate_metric_key("duo_privacy_configured"),
    "duo_goals_created": evaluate_metric_key("duo_goals_created"),
    "duo_active_weeks": evaluate_metric_key("duo_active_weeks"),
    "duo_comeback_after_inactive_days": evaluate_metric_key("duo_comeback_after_inactive_days"),
    "completed_duo_challenges": evaluate_metric_key("completed_duo_challenges"),
    "both_members_weekly_goal_reached": evaluate_metric_key("both_members_weekly_goal_reached"),
    "completed_planned_duo_workouts": evaluate_metric_key("completed_planned_duo_workouts"),
    "duo_distinct_common_categories": evaluate_metric_key("duo_distinct_common_categories"),
    "duo_common_workouts_before_hour": evaluate_before_hour,  # uses duo maps
    "duo_common_workouts_after_hour": evaluate_after_hour,
    "duo_common_workouts_without_abandon": evaluate_metric_key("duo_common_workouts_without_abandon"),
    "duo_age_and_common_workouts": evaluate_multiple_conditions,
    "duo_active_weeks_in_month": evaluate_metric_key("duo_max_active_weeks_in_month"),
    "duo_combined_completed_workouts": evaluate_metric_key("duo_combined_completed_workouts"),
    "unlocked_duo_badges": evaluate_unlocked_duo_badges,
}


# Override hour evaluators for duo variants (same shape, different metric maps)
def _evaluate_duo_before_hour(metrics: dict, definition: dict) -> dict:
    hour = (definition.get("condition_params") or {}).get("hour", 9)
    by_hour = metrics.get("duo_common_workouts_before_hour") or {}
    current = int(by_hour.get(int(hour), 0) or 0)
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


def _evaluate_duo_after_hour(metrics: dict, definition: dict) -> dict:
    hour = (definition.get("condition_params") or {}).get("hour", 21)
    by_hour = metrics.get("duo_common_workouts_after_hour") or {}
    current = int(by_hour.get(int(hour), 0) or 0)
    target = definition.get("condition_value") or 1
    percentage = min(100, max(0, round((current / target) * 100))) if target else 0
    return {"current": current, "target": target, "percentage": percentage, "eligible": current >= target}


BADGE_EVALUATORS["duo_common_workouts_before_hour"] = _evaluate_duo_before_hour
BADGE_EVALUATORS["duo_common_workouts_after_hour"] = _evaluate_duo_after_hour


def evaluate_badge(definition: dict, metrics: dict) -> dict:
    if not definition.get("enabled", True):
        return {
            "current": 0,
            "target": definition.get("condition_value") or 1,
            "percentage": 0,
            "eligible": False,
            "disabled": True,
        }
    ctype = definition.get("condition_type")
    evaluator = BADGE_EVALUATORS.get(ctype)
    if not evaluator:
        logger.warning("No evaluator for condition_type=%s", ctype)
        return {"current": 0, "target": definition.get("condition_value") or 1, "percentage": 0, "eligible": False}
    result = evaluator(metrics, definition)
    # Clamp percentage
    pct = result.get("percentage", 0)
    if isinstance(pct, (int, float)):
        result["percentage"] = min(100, max(0, int(pct)))
    return result


class BadgeProgressService:
    def __init__(self, db):
        self.db = db

    def _cache_get(self, key: str) -> Optional[dict]:
        entry = _METRICS_CACHE.get(key)
        if not entry:
            return None
        ts, data = entry
        if (datetime.now(timezone.utc).timestamp() - ts) > _CACHE_TTL_SECONDS:
            _METRICS_CACHE.pop(key, None)
            return None
        return data

    def _cache_set(self, key: str, data: dict) -> None:
        _METRICS_CACHE[key] = (datetime.now(timezone.utc).timestamp(), data)

    @staticmethod
    def invalidate_cache(user_id: Optional[str] = None, pair_key: Optional[str] = None) -> None:
        if user_id:
            _METRICS_CACHE.pop(f"badge_metrics_solo:{user_id}", None)
        if pair_key:
            _METRICS_CACHE.pop(f"badge_metrics_duo:{pair_key}", None)
        if not user_id and not pair_key:
            _METRICS_CACHE.clear()

    async def ensure_indexes(self) -> None:
        await self.db.user_badges.create_index([("user_id", 1), ("badge_id", 1)], unique=True)
        await self.db.user_badges.create_index([("user_id", 1), ("unlocked_at", -1)])
        await self.db.duo_badges.create_index([("pair_key", 1), ("badge_id", 1)], unique=True)
        await self.db.duo_badges.create_index([("pair_key", 1), ("unlocked_at", -1)])
        try:
            await self.db.workout_sessions.create_index([("user_id", 1), ("created_at", -1)])
            await self.db.workout_sessions.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
        except Exception:
            pass

    def _session_categories(self, session: dict) -> Set[str]:
        cats: Set[str] = set()
        for key in ("category", "workout_category", "primary_category"):
            c = _normalize_category(session.get(key))
            if c:
                cats.add(c)
        for ex in session.get("exercise_log") or []:
            c = _normalize_category(ex.get("category") or ex.get("exercise_category"))
            if c:
                cats.add(c)
        title = (session.get("workout_title") or "").lower()
        if "jambe" in title or "leg" in title or "squat" in title:
            cats.add("legs")
        if "haut" in title or "upper" in title or "push" in title or "pull" in title:
            cats.add("upper_body")
        if "cardio" in title or "hiit" in title:
            cats.add("cardio")
        if "étire" in title or "etire" in title or "mobil" in title or "yoga" in title:
            cats.add("mobility")
            cats.add("stretching")
        return cats

    def _session_has_skips(self, session: dict) -> bool:
        log = session.get("exercise_log") or []
        if not log:
            return False
        for ex in log:
            st = str(ex.get("status") or "").lower()
            if st in ("skipped", "skip", "not_done"):
                return True
        return False

    async def get_solo_metrics(self, user_id: str, streak_value: Optional[int] = None) -> dict:
        cache_key = f"badge_metrics_solo:{user_id}"
        cached = self._cache_get(cache_key)
        if cached is not None and streak_value is None:
            return cached

        sessions = await self.db.workout_sessions.find(
            {"user_id": user_id},
            {
                "status": 1, "created_at": 1, "total_time": 1, "difficulty_felt": 1,
                "estimated_calories": 1, "exercise_log": 1, "category": 1,
                "workout_category": 1, "workout_title": 1, "workout_id": 1,
                "scheduled_workout_id": 1, "from_scheduled": 1,
            },
        ).to_list(5000)

        completed = [s for s in sessions if s.get("status") == "completed"]
        active_days = sorted({d for d in (_day_key(s.get("created_at")) for s in completed) if d})
        week_days: Dict[str, Set[str]] = defaultdict(set)
        week_counts: Dict[str, int] = defaultdict(int)
        month_counts: Dict[str, int] = defaultdict(int)
        for day in active_days:
            week_days[_week_key(day)].add(day)
        for s in completed:
            day = _day_key(s.get("created_at"))
            if not day:
                continue
            week_counts[_week_key(day)] += 1
            month_counts[_month_key(day)] += 1

        total_seconds = sum(int(s.get("total_time") or 0) for s in completed)
        total_minutes = int(total_seconds / 60)
        max_single = max((int(s.get("total_time") or 0) / 60 for s in completed), default=0)

        calories = 0
        for s in completed:
            c = s.get("estimated_calories")
            if c is None:
                c = _estimate_calories(int(s.get("total_time") or 0), s.get("difficulty_felt"))
            try:
                calories += max(0, int(c or 0))
            except (TypeError, ValueError):
                pass

        before_hour: Dict[int, int] = defaultdict(int)
        after_hour: Dict[int, int] = defaultdict(int)
        for s in completed:
            dt = _parse_dt(s.get("created_at"))
            if not dt:
                continue
            h = dt.astimezone(timezone.utc).hour
            for threshold in (8, 9):
                if h < threshold:
                    before_hour[threshold] += 1
            for threshold in (21,):
                if h >= threshold:
                    after_hour[threshold] += 1

        cat_counts: Dict[str, int] = defaultdict(int)
        for s in completed:
            for c in self._session_categories(s):
                cat_counts[c] += 1

        no_skip = sum(1 for s in completed if not self._session_has_skips(s))
        # Comeback: gap >= N days then a new session
        comeback = 0
        if len(active_days) >= 2:
            for i in range(1, len(active_days)):
                prev = datetime.strptime(active_days[i - 1], "%Y-%m-%d").date()
                cur = datetime.strptime(active_days[i], "%Y-%m-%d").date()
                gap = (cur - prev).days
                if gap >= 14:
                    comeback = max(comeback, gap)

        # Active weeks in a month (min 3 days/week × 4 weeks)
        month_week_days: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
        for day in active_days:
            month_week_days[_month_key(day)][_week_key(day)].add(day)
        max_active_weeks_month = 0
        for _month, weeks in month_week_days.items():
            qualifying = sum(1 for days in weeks.values() if len(days) >= 3)
            max_active_weeks_month = max(max_active_weeks_month, qualifying)

        active_weeks = sum(1 for days in week_days.values() if len(days) >= 1)

        planned = await self.db.scheduled_workouts.count_documents({"for_user_id": user_id})
        completed_planned = await self.db.scheduled_workouts.count_documents(
            {"for_user_id": user_id, "status": "completed"}
        )
        custom = await self.db.workout_templates.count_documents({
            "user_id": user_id,
            "is_system": {"$ne": True},
        })
        challenges = await self.db.challenge_completions.count_documents({
            "user_id": user_id,
            "scope": "solo",
        })

        best = _best_streak(active_days)
        if streak_value is not None:
            best = max(best, int(streak_value or 0))

        completed_sorted = sorted(
            completed,
            key=lambda s: s.get("created_at") or "",
        )
        timeline_completed_at = [
            s.get("created_at") for s in completed_sorted if s.get("created_at")
        ]

        metrics = {
            "completed_workouts": len(completed),
            "total_active_days": len(active_days),
            "best_streak_days": best,
            "total_workout_minutes": total_minutes,
            "total_calories": calories,
            "max_active_days_in_week": max((len(d) for d in week_days.values()), default=0),
            "max_workouts_in_week": max(week_counts.values(), default=0),
            "max_workouts_in_month": max(month_counts.values(), default=0),
            "max_single_workout_minutes": int(max_single),
            "completed_without_abandon": len(completed),
            "completed_without_skipped_exercise": no_skip,
            "distinct_workout_categories": len(cat_counts),
            "category_counts": dict(cat_counts),
            "planned_workouts": planned,
            "custom_workouts_created": custom,
            "completed_planned_workouts": completed_planned,
            "completed_solo_challenges": challenges,
            "comeback_after_inactive_days": comeback,
            "max_active_weeks_in_month": max_active_weeks_month,
            "total_active_weeks": active_weeks,
            "workouts_before_hour": dict(before_hour),
            "workouts_after_hour": dict(after_hour),
            # Timelines pour migration historique (non exposées à l'API)
            "_timeline_completed_at": timeline_completed_at,
            "_timeline_active_days": active_days,
            "_timeline_sessions": [
                {
                    "created_at": s.get("created_at"),
                    "total_time": int(s.get("total_time") or 0),
                    "calories": (
                        int(s["estimated_calories"])
                        if s.get("estimated_calories") is not None
                        else _estimate_calories(int(s.get("total_time") or 0), s.get("difficulty_felt"))
                    ),
                }
                for s in completed_sorted
                if s.get("created_at")
            ],
        }
        self._cache_set(cache_key, metrics)
        return metrics

    async def get_duo_metrics(self, pair_key: str) -> dict:
        cache_key = f"badge_metrics_duo:{pair_key}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        parts = (pair_key or "").split("_")
        if len(parts) != 2:
            return {"duo_created": 0}

        user_a, user_b = parts[0], parts[1]
        duo_doc = await self.db.duo_profiles.find_one({"pair_key": pair_key})

        sessions_a = await self.db.workout_sessions.find(
            {"user_id": user_a, "status": "completed"},
            {"created_at": 1, "total_time": 1, "workout_id": 1, "workout_title": 1,
             "exercise_log": 1, "category": 1, "status": 1},
        ).to_list(5000)
        sessions_b = await self.db.workout_sessions.find(
            {"user_id": user_b, "status": "completed"},
            {"created_at": 1, "total_time": 1, "workout_id": 1, "workout_title": 1,
             "exercise_log": 1, "category": 1, "status": 1},
        ).to_list(5000)

        by_day_a: Dict[str, List[dict]] = defaultdict(list)
        by_day_b: Dict[str, List[dict]] = defaultdict(list)
        for s in sessions_a:
            d = _day_key(s.get("created_at"))
            if d:
                by_day_a[d].append(s)
        for s in sessions_b:
            d = _day_key(s.get("created_at"))
            if d:
                by_day_b[d].append(s)

        common_days = sorted(set(by_day_a.keys()) & set(by_day_b.keys()))
        # Séances communes : une paire par jour (idempotent)
        common_workouts = len(common_days)
        common_minutes = 0
        common_before: Dict[int, int] = defaultdict(int)
        common_after: Dict[int, int] = defaultdict(int)
        common_no_abandon = 0
        common_cats: Set[str] = set()
        same_program = 0
        week_common: Dict[str, int] = defaultdict(int)

        for day in common_days:
            a_list = by_day_a[day]
            b_list = by_day_b[day]
            a_sess = a_list[0]
            b_sess = b_list[0]
            # minutes communes = min des deux
            a_min = int(a_sess.get("total_time") or 0) / 60
            b_min = int(b_sess.get("total_time") or 0) / 60
            common_minutes += min(a_min, b_min)
            week_common[_week_key(day)] += 1
            common_no_abandon += 1  # completed only
            for c in self._session_categories(a_sess) & self._session_categories(b_sess):
                common_cats.add(c)
            if a_sess.get("workout_id") and a_sess.get("workout_id") == b_sess.get("workout_id"):
                same_program += 1
            elif (a_sess.get("workout_title") or "").strip() and (
                (a_sess.get("workout_title") or "").strip().lower()
                == (b_sess.get("workout_title") or "").strip().lower()
            ):
                same_program += 1
            for sess in (a_sess, b_sess):
                dt = _parse_dt(sess.get("created_at"))
                if not dt:
                    continue
                h = dt.astimezone(timezone.utc).hour
                if h < 9:
                    common_before[9] += 1
                if h >= 21:
                    common_after[21] += 1
                break  # count once per common day for hour badges

        # Fix hour counting: one per common day if either session matches
        common_before = defaultdict(int)
        common_after = defaultdict(int)
        for day in common_days:
            matched_before = False
            matched_after = False
            for sess in by_day_a[day] + by_day_b[day]:
                dt = _parse_dt(sess.get("created_at"))
                if not dt:
                    continue
                h = dt.astimezone(timezone.utc).hour
                if h < 9:
                    matched_before = True
                if h >= 21:
                    matched_after = True
            if matched_before:
                common_before[9] += 1
            if matched_after:
                common_after[21] += 1

        best_streak = _best_streak(common_days)

        # Comeback duo
        comeback = 0
        if len(common_days) >= 2:
            for i in range(1, len(common_days)):
                prev = datetime.strptime(common_days[i - 1], "%Y-%m-%d").date()
                cur = datetime.strptime(common_days[i], "%Y-%m-%d").date()
                gap = (cur - prev).days
                if gap >= 14:
                    comeback = max(comeback, gap)

        # Active weeks (any common day)
        week_days: Dict[str, Set[str]] = defaultdict(set)
        for day in common_days:
            week_days[_week_key(day)].add(day)
        active_weeks = sum(1 for d in week_days.values() if len(d) >= 1)

        month_week_days: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
        for day in common_days:
            month_week_days[_month_key(day)][_week_key(day)].add(day)
        max_active_weeks_month = 0
        for weeks in month_week_days.values():
            qualifying = sum(1 for days in weeks.values() if len(days) >= 3)
            max_active_weeks_month = max(max_active_weeks_month, qualifying)

        age_days = 0
        created = None
        if duo_doc:
            created = _parse_dt(duo_doc.get("created_at"))
            if created:
                age_days = max(0, (datetime.now(timezone.utc) - created).days)

        roles_configured = 0
        banner_configured = 0
        privacy_configured = 0
        if duo_doc:
            roles = duo_doc.get("member_roles") or {}
            if roles or duo_doc.get("coach_member_id") or duo_doc.get("leader_member_id"):
                roles_configured = 1
            if duo_doc.get("banner_url"):
                banner_configured = 1
            # Privacy considered configured if any visibility field was set explicitly
            if any(
                duo_doc.get(k) is not None
                for k in (
                    "account_visibility", "stats_visibility", "wall_visibility",
                    "badges_visibility", "activity_visibility", "challenges_visibility",
                    "show_stats", "show_posts", "show_badges",
                )
            ):
                privacy_configured = 1

        posts = await self.db.posts.count_documents({
            "owner_type": "duo",
            "owner_id": pair_key,
        })
        # Also count duo_id field
        posts_alt = await self.db.posts.count_documents({"duo_id": pair_key})
        posts_created = max(posts, posts_alt)

        challenges = await self.db.challenge_completions.count_documents({"pair_key": pair_key})
        # Joined = at least one challenge completion or current participation
        challenges_joined = 1 if challenges >= 1 else 0
        # Also count if duo has any challenge progress — use challenge_completions only

        # Encouragements: reactions from either member on the other's sessions
        reactions = 0
        for s in sessions_a:
            for r in (s.get("reactions") or []):
                if r.get("user_id") == user_b:
                    reactions += 1
            for c in (s.get("comments") or []):
                if c.get("user_id") == user_b:
                    reactions += 1
        for s in sessions_b:
            for r in (s.get("reactions") or []):
                if r.get("user_id") == user_a:
                    reactions += 1
            for c in (s.get("comments") or []):
                if c.get("user_id") == user_a:
                    reactions += 1

        # Re-fetch with reactions if projection dropped them — count via separate query if 0
        if reactions == 0:
            partner_sessions = await self.db.workout_sessions.find(
                {"user_id": {"$in": [user_a, user_b]}},
                {"user_id": 1, "reactions": 1, "comments": 1},
            ).to_list(2000)
            for s in partner_sessions:
                owner = s.get("user_id")
                other = user_b if owner == user_a else user_a
                for r in s.get("reactions") or []:
                    if r.get("user_id") == other:
                        reactions += 1
                for c in s.get("comments") or []:
                    if c.get("user_id") == other:
                        reactions += 1

        planned = await self.db.scheduled_workouts.count_documents({
            "$or": [
                {"creator_id": user_a, "for_user_id": user_b},
                {"creator_id": user_b, "for_user_id": user_a},
                {"for_user_id": {"$in": [user_a, user_b]}, "duo_pair_key": pair_key},
            ]
        })
        completed_planned = await self.db.scheduled_workouts.count_documents({
            "$or": [
                {"creator_id": user_a, "for_user_id": user_b, "status": "completed"},
                {"creator_id": user_b, "for_user_id": user_a, "status": "completed"},
            ]
        })

        unlocked_docs = await self.db.duo_badges.find(
            {"pair_key": pair_key}, {"badge_id": 1}
        ).to_list(200)
        unlocked_ids = {d["badge_id"] for d in unlocked_docs}

        combined = len(sessions_a) + len(sessions_b)

        metrics = {
            "duo_created": 1 if duo_doc else 1,  # pair_key implies duo exists
            "duo_common_workouts": common_workouts,
            "duo_common_active_days": len(common_days),
            "duo_max_common_workouts_in_week": max(week_common.values(), default=0),
            "duo_challenges_joined": max(challenges_joined, 1 if challenges else 0),
            "duo_posts_created": posts_created,
            "partner_activity_reactions": reactions,
            "duo_workouts_planned": planned,
            "same_workout_completed_by_both": same_program,
            "duo_common_minutes": int(common_minutes),
            "duo_best_streak_days": best_streak,
            "duo_roles_configured": roles_configured,
            "duo_banner_configured": banner_configured,
            "duo_privacy_configured": privacy_configured,
            "duo_goals_created": 0,
            "duo_active_weeks": active_weeks,
            "duo_comeback_after_inactive_days": comeback,
            "completed_duo_challenges": challenges,
            "both_members_weekly_goal_reached": 0,
            "completed_planned_duo_workouts": completed_planned,
            "duo_distinct_common_categories": len(common_cats),
            "duo_common_workouts_before_hour": dict(common_before),
            "duo_common_workouts_after_hour": dict(common_after),
            "duo_common_workouts_without_abandon": common_no_abandon,
            "duo_age_days": age_days,
            "duo_max_active_weeks_in_month": max_active_weeks_month,
            "duo_combined_completed_workouts": combined,
            "unlocked_duo_badge_ids": list(unlocked_ids),
            "_timeline_common_days": common_days,
            "_timeline_duo_created_at": duo_doc.get("created_at") if duo_doc else None,
        }
        self._cache_set(cache_key, metrics)
        return metrics

    async def get_unlocked_solo(self, user_id: str) -> Dict[str, dict]:
        docs = await self.db.user_badges.find({"user_id": user_id}).to_list(200)
        return {d["badge_id"]: d for d in docs}

    async def get_unlocked_duo(self, pair_key: str) -> Dict[str, dict]:
        docs = await self.db.duo_badges.find({"pair_key": pair_key}).to_list(200)
        return {d["badge_id"]: d for d in docs}

    async def unlock_badge_if_eligible(
        self,
        *,
        scope: str,
        owner_id: str,
        definition: dict,
        progress: dict,
        notify: bool = True,
        notify_user_ids: Optional[List[str]] = None,
        unlocked_at: Optional[str] = None,
    ) -> Optional[dict]:
        if not progress.get("eligible") or not definition.get("enabled", True):
            return None
        badge_id = definition["id"]
        unlock_ts = unlocked_at or _now_iso()
        current = progress.get("current")
        if isinstance(current, dict):
            progress_value = current
        else:
            progress_value = current

        if scope == "solo":
            existing = await self.db.user_badges.find_one({"user_id": owner_id, "badge_id": badge_id})
            if existing:
                return None
            doc = {
                "user_id": owner_id,
                "badge_id": badge_id,
                "unlocked_at": unlock_ts,
                "progress_when_unlocked": progress_value,
                "catalog_version": CATALOG_VERSION,
            }
            try:
                await self.db.user_badges.insert_one(doc)
            except Exception:
                # Duplicate key — déjà débloqué
                return None
        else:
            existing = await self.db.duo_badges.find_one({"pair_key": owner_id, "badge_id": badge_id})
            if existing:
                return None
            doc = {
                "pair_key": owner_id,
                "badge_id": badge_id,
                "unlocked_at": unlock_ts,
                "progress_when_unlocked": progress_value,
                "catalog_version": CATALOG_VERSION,
            }
            try:
                await self.db.duo_badges.insert_one(doc)
            except Exception:
                return None

        notifications_sent = 0
        if notify:
            notifications_sent = await self._notify_unlock(
                scope, owner_id, definition, notify_user_ids=notify_user_ids
            )
        doc["_notifications_sent"] = notifications_sent
        return doc

    @staticmethod
    def infer_unlock_at(definition: dict, metrics: dict) -> Optional[str]:
        """Déduit une date historique fiable quand c'est possible, sinon None."""
        ctype = definition.get("condition_type")
        target = definition.get("condition_value") or 1
        try:
            target_n = int(target) if not isinstance(target, dict) else 1
        except (TypeError, ValueError):
            target_n = 1

        completed_at = metrics.get("_timeline_completed_at") or []
        active_days = metrics.get("_timeline_active_days") or []
        sessions = metrics.get("_timeline_sessions") or []
        common_days = metrics.get("_timeline_common_days") or []
        duo_created = metrics.get("_timeline_duo_created_at")

        def _nth_iso(items: List[str], n: int) -> Optional[str]:
            if n <= 0 or len(items) < n:
                return None
            return items[n - 1]

        def _day_to_iso(day: Optional[str]) -> Optional[str]:
            if not day:
                return None
            # Normalise en ISO date début de journée UTC
            return f"{day}T12:00:00+00:00"

        # Seuils sur nombre de séances terminées
        if ctype in (
            "completed_workouts",
            "completed_without_abandon",
            "completed_without_skipped_exercise",
        ):
            return _nth_iso(completed_at, target_n)

        if ctype == "total_active_days":
            return _day_to_iso(_nth_iso(active_days, target_n))

        if ctype in ("best_streak_days",):
            # Première fenêtre de streak atteignant la cible
            if len(active_days) < target_n:
                return None
            for i in range(target_n - 1, len(active_days)):
                window = active_days[i - target_n + 1 : i + 1]
                ok = True
                for j in range(1, len(window)):
                    prev = datetime.strptime(window[j - 1], "%Y-%m-%d").date()
                    cur = datetime.strptime(window[j], "%Y-%m-%d").date()
                    if (cur - prev).days != 1:
                        ok = False
                        break
                if ok:
                    return _day_to_iso(window[-1])
            return None

        if ctype in ("total_workout_minutes", "total_calories"):
            cum = 0
            for s in sessions:
                if ctype == "total_workout_minutes":
                    cum += int(s.get("total_time") or 0) // 60
                else:
                    cum += max(0, int(s.get("calories") or 0))
                if cum >= target_n:
                    return s.get("created_at")
            return None

        if ctype == "single_workout_duration_minutes":
            for s in sessions:
                mins = int(s.get("total_time") or 0) / 60
                if mins >= target_n:
                    return s.get("created_at")
            return None

        if ctype in (
            "duo_common_workouts",
            "duo_common_active_days",
            "duo_common_workouts_without_abandon",
        ):
            return _day_to_iso(_nth_iso(common_days, target_n))

        if ctype == "duo_best_streak_days":
            if len(common_days) < target_n:
                return None
            for i in range(target_n - 1, len(common_days)):
                window = common_days[i - target_n + 1 : i + 1]
                ok = True
                for j in range(1, len(window)):
                    prev = datetime.strptime(window[j - 1], "%Y-%m-%d").date()
                    cur = datetime.strptime(window[j], "%Y-%m-%d").date()
                    if (cur - prev).days != 1:
                        ok = False
                        break
                if ok:
                    return _day_to_iso(window[-1])
            return None

        if ctype == "duo_common_minutes":
            # Approximation : jour commun où le cumul de minutes atteint la cible
            # (métrique exacte recalculée côté get_duo_metrics — on utilise le N-ième jour
            # si minutes moyennes suffisent, sinon dernier jour commun)
            if not common_days:
                return None
            if target_n <= 60 and len(common_days) >= 1:
                return _day_to_iso(common_days[0])
            idx = min(len(common_days), max(1, target_n // 60))
            return _day_to_iso(common_days[idx - 1])

        if ctype == "duo_created":
            return duo_created

        if ctype == "duo_age_and_common_workouts":
            params = definition.get("condition_params") or {}
            min_workouts = int(params.get("minimum_common_workouts") or 0)
            workout_at = _day_to_iso(_nth_iso(common_days, min_workouts)) if min_workouts else None
            age_days = int(params.get("minimum_age_days") or 0)
            age_at = None
            if duo_created and age_days:
                dt = _parse_dt(duo_created)
                if dt:
                    age_at = (dt + timedelta(days=age_days)).isoformat()
            candidates = [c for c in (workout_at, age_at) if c]
            return max(candidates) if candidates else None

        # Fallback faible : première activité connue
        if completed_at:
            return completed_at[0]
        if common_days:
            return _day_to_iso(common_days[0])
        if duo_created:
            return duo_created
        return None

    async def _notify_unlock(
        self,
        scope: str,
        owner_id: str,
        definition: dict,
        notify_user_ids: Optional[List[str]] = None,
    ) -> int:
        try:
            from push_service import notify_push
        except Exception:
            notify_push = None

        try:
            from i18n_messages import DEFAULT_LOCALE, badge_name, badge_unlock_texts, load_user_locale
        except Exception:
            DEFAULT_LOCALE = "fr-FR"
            badge_name = lambda bid, loc=None: definition.get("name") or "un badge"  # noqa: E731
            badge_unlock_texts = None
            load_user_locale = None

        badge_id = definition["id"]
        rarity = definition.get("rarity") or "common"

        if scope == "solo":
            recipients = notify_user_ids or [owner_id]
            notif_type = "badge_unlocked"
            scope_value = "solo"
            translation_key = "notifications.badgeUnlocked"
            url = f"/badges?scope=solo&badge={badge_id}"
        else:
            parts = owner_id.split("_")
            recipients = notify_user_ids or parts
            notif_type = "duo_badge_unlocked"
            scope_value = "duo"
            translation_key = "notifications.duoBadgeUnlocked"
            url = f"/badges?scope=duo&badge={badge_id}"
        tag = f"badge-{badge_id}"

        now = _now_iso()
        sent = 0
        for rid in recipients:
            if not rid:
                continue
            locale = DEFAULT_LOCALE
            if load_user_locale:
                try:
                    locale = await load_user_locale(self.db, rid)
                except Exception:
                    pass
            if badge_unlock_texts:
                try:
                    title, body = badge_unlock_texts(scope, badge_id, rarity, locale)
                    name = badge_name(badge_id, locale)
                except Exception:
                    name = definition.get("name") or "un badge"
                    title = f"Nouveau badge !"
                    body = f"Vous avez débloqué « {name} »."
            else:
                name = definition.get("name") or "un badge"
                title = f"Nouveau badge !"
                body = f"Vous avez débloqué « {name} »."

            existing = await self.db.notifications.find_one({
                "user_id": rid,
                "type": notif_type,
                "badge_id": badge_id,
            })
            if existing:
                continue
            try:
                await self.db.notifications.insert_one({
                    "user_id": rid,
                    "type": notif_type,
                    "actor_id": rid,
                    "badge_id": badge_id,
                    "badge_name": name,
                    "scope": scope_value,
                    "translation_key": translation_key,
                    "translation_params": {"badge_id": badge_id},
                    "title": title,
                    "body": body,
                    "read": False,
                    "created_at": now,
                    "url": url,
                })
                sent += 1
            except Exception as exc:
                logger.warning("badge notif insert failed: %s", exc)

            if notify_push:
                try:
                    await notify_push(
                        self.db,
                        rid,
                        notif_type,
                        title=title,
                        body=body,
                        url=url,
                        tag=tag,
                    )
                except Exception as exc:
                    logger.warning("badge push failed: %s", exc)
        return sent

    async def evaluate_solo_badges(
        self, user_id: str, *, streak_value: Optional[int] = None, notify: bool = True
    ) -> List[dict]:
        metrics = await self.get_solo_metrics(user_id, streak_value=streak_value)
        unlocked_map = await self.get_unlocked_solo(user_id)
        newly = []
        for definition in SOLO_BADGES:
            if not definition.get("enabled", True):
                continue
            progress = evaluate_badge(definition, metrics)
            if progress.get("eligible") and definition["id"] not in unlocked_map:
                doc = await self.unlock_badge_if_eligible(
                    scope="solo",
                    owner_id=user_id,
                    definition=definition,
                    progress=progress,
                    notify=notify,
                    notify_user_ids=[user_id],
                )
                if doc:
                    newly.append(definition["id"])
                    unlocked_map[definition["id"]] = doc
        return newly

    async def evaluate_duo_badges(
        self, pair_key: str, *, notify: bool = True, notify_user_ids: Optional[List[str]] = None
    ) -> List[dict]:
        if not pair_key or "_" not in pair_key:
            return []
        metrics = await self.get_duo_metrics(pair_key)
        unlocked_map = await self.get_unlocked_duo(pair_key)
        metrics["unlocked_duo_badge_ids"] = list(unlocked_map.keys())
        newly = []
        # Two-pass for unlocked_duo_badges (collection badge)
        for definition in DUO_BADGES:
            if not definition.get("enabled", True):
                continue
            if definition["condition_type"] == "unlocked_duo_badges":
                continue
            progress = evaluate_badge(definition, metrics)
            if progress.get("eligible") and definition["id"] not in unlocked_map:
                doc = await self.unlock_badge_if_eligible(
                    scope="duo",
                    owner_id=pair_key,
                    definition=definition,
                    progress=progress,
                    notify=notify,
                    notify_user_ids=notify_user_ids or pair_key.split("_"),
                )
                if doc:
                    newly.append(definition["id"])
                    unlocked_map[definition["id"]] = doc
                    metrics["unlocked_duo_badge_ids"] = list(unlocked_map.keys())

        for definition in DUO_BADGES:
            if definition.get("condition_type") != "unlocked_duo_badges":
                continue
            if not definition.get("enabled", True):
                continue
            progress = evaluate_badge(definition, metrics)
            if progress.get("eligible") and definition["id"] not in unlocked_map:
                doc = await self.unlock_badge_if_eligible(
                    scope="duo",
                    owner_id=pair_key,
                    definition=definition,
                    progress=progress,
                    notify=notify,
                    notify_user_ids=notify_user_ids or pair_key.split("_"),
                )
                if doc:
                    newly.append(definition["id"])
        return newly

    async def get_solo_catalog_with_progress(
        self, user_id: str, *, streak_value: Optional[int] = None
    ) -> dict:
        metrics = await self.get_solo_metrics(user_id, streak_value=streak_value)
        unlocked_map = await self.get_unlocked_solo(user_id)
        badges = []
        unlocked_ids = set()
        for definition in get_catalog("solo", include_disabled=False):
            progress = evaluate_badge(definition, metrics)
            unlocked_doc = unlocked_map.get(definition["id"])
            unlocked = bool(unlocked_doc)
            if unlocked:
                unlocked_ids.add(definition["id"])
                progress = {
                    **progress,
                    "eligible": True,
                    "percentage": 100,
                    "unlocked_at": unlocked_doc.get("unlocked_at"),
                }
            badges.append(catalog_badge_to_public(definition, unlocked=unlocked, progress=progress))
        return {
            "badges": badges,
            "summary": rarity_summary(
                [b for b in get_catalog("solo", include_disabled=False)],
                unlocked_ids,
            ),
            "scope": "solo",
        }

    async def get_duo_catalog_with_progress(self, pair_key: str) -> dict:
        if not pair_key:
            return {
                "badges": [],
                "summary": rarity_summary([], set()),
                "scope": "duo",
            }
        metrics = await self.get_duo_metrics(pair_key)
        unlocked_map = await self.get_unlocked_duo(pair_key)
        metrics["unlocked_duo_badge_ids"] = list(unlocked_map.keys())
        badges = []
        unlocked_ids = set()
        for definition in get_catalog("duo", include_disabled=False):
            progress = evaluate_badge(definition, metrics)
            unlocked_doc = unlocked_map.get(definition["id"])
            unlocked = bool(unlocked_doc)
            if unlocked:
                unlocked_ids.add(definition["id"])
                progress = {
                    **progress,
                    "eligible": True,
                    "percentage": 100,
                    "unlocked_at": unlocked_doc.get("unlocked_at"),
                }
            badges.append(catalog_badge_to_public(definition, unlocked=unlocked, progress=progress))
        return {
            "badges": badges,
            "summary": rarity_summary(
                [b for b in get_catalog("duo", include_disabled=False)],
                unlocked_ids,
            ),
            "scope": "duo",
        }

    async def find_unlocked_badge(self, scope: str, owner_id: str, badge_id: str) -> Optional[dict]:
        cid = canonical_badge_id(badge_id)
        definition = get_badge_definition(cid)
        if not definition or definition.get("scope") != scope:
            return None
        if scope == "solo":
            doc = await self.db.user_badges.find_one({"user_id": owner_id, "badge_id": cid})
        else:
            doc = await self.db.duo_badges.find_one({"pair_key": owner_id, "badge_id": cid})
        if not doc:
            return None
        return catalog_badge_to_public(
            definition,
            unlocked=True,
            progress={"current": doc.get("progress_when_unlocked"), "target": definition.get("condition_value"), "percentage": 100, "unlocked_at": doc.get("unlocked_at")},
        )


def schedule_badge_evaluation(coro) -> None:
    """Lance l'évaluation en arrière-plan sans bloquer la requête."""
    try:
        loop = asyncio.get_running_loop()

        async def _safe():
            try:
                await coro
            except Exception as exc:
                logger.warning("badge evaluation failed: %s", exc)

        loop.create_task(_safe())
    except RuntimeError:
        logger.warning("no running loop for badge evaluation")


async def trigger_solo_evaluation(db, user_id: str, streak_value: Optional[int] = None) -> None:
    service = BadgeProgressService(db)
    BadgeProgressService.invalidate_cache(user_id=user_id)
    await service.evaluate_solo_badges(user_id, streak_value=streak_value, notify=True)


async def trigger_duo_evaluation(db, pair_key: str, notify_user_ids: Optional[List[str]] = None) -> None:
    service = BadgeProgressService(db)
    BadgeProgressService.invalidate_cache(pair_key=pair_key)
    await service.evaluate_duo_badges(pair_key, notify=True, notify_user_ids=notify_user_ids)

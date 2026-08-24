"""Catalogue curaté Défis Héros — source unique, lecture seule pour les utilisateurs."""
from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

CATALOG_PATH = Path(__file__).resolve().parent / "data" / "hero_challenges.json"
CHALLENGE_TYPES = {
    "amrap",
    "rounds",
    "structured",
    "program_reference",
    "strength_reference",
}
DEFAULT_PROFILE_THEME = "default"
HERO_VERSION = 1

REQUIRED_FIELDS = (
    "id",
    "slug",
    "universe",
    "character_name",
    "actor_name",
    "title",
    "challenge_type",
    "status",
    "is_curated",
)

THEME_BY_BADGE = {
    "hero_spiderman_challenge": "spiderman",
    "hero_thor_challenge": "thor",
    "hero_shangchi_challenge": "shangchi",
    "hero_deadpool_challenge": "deadpool",
    "hero_batman_challenge": "batman",
    "hero_wonderwoman_challenge": "wonderwoman",
    "hero_aquaman_challenge": "aquaman",
}

THEME_REQUIRES_BADGE = {v: k for k, v in THEME_BY_BADGE.items()}
ALLOWED_PROFILE_THEMES = {DEFAULT_PROFILE_THEME, *THEME_REQUIRES_BADGE.keys()}


class HeroCatalogError(RuntimeError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise HeroCatalogError(message)


def _validate_exercise(ex: dict, challenge_id: str) -> None:
    _require(isinstance(ex, dict), f"{challenge_id}: exercise must be object")
    _require(ex.get("exercise_id"), f"{challenge_id}: exercise_id required")
    names = ex.get("name_i18n") or {}
    _require(isinstance(names, dict) and names.get("fr"), f"{challenge_id}: name_i18n.fr required")
    if "load" in ex:
        _require(ex["load"] is None or isinstance(ex["load"], (int, float)), f"{challenge_id}: load invalid")


def validate_challenge(raw: dict) -> dict:
    _require(isinstance(raw, dict), "challenge must be object")
    for field in REQUIRED_FIELDS:
        _require(raw.get(field) not in (None, ""), f"missing {field}")
    _require(raw["challenge_type"] in CHALLENGE_TYPES, f"{raw.get('id')}: invalid type")
    _require(raw.get("is_curated") is True, f"{raw.get('id')}: must be curated")
    ctype = raw["challenge_type"]
    exercises = raw.get("exercises") or []
    _require(isinstance(exercises, list), f"{raw['id']}: exercises must be list")
    if ctype in ("amrap", "rounds", "structured"):
        _require(len(exercises) > 0, f"{raw['id']}: playable challenge needs exercises")
        _require(raw.get("playable") is True, f"{raw['id']}: playable flag")
    else:
        _require(raw.get("playable") is False, f"{raw['id']}: reference must not be playable")
    for ex in exercises:
        _validate_exercise(ex, raw["id"])
    for ex in raw.get("coda_exercises") or []:
        _validate_exercise(ex, raw["id"])
    if ctype == "amrap":
        _require(int(raw.get("duration_seconds") or 0) > 0, f"{raw['id']}: AMRAP duration")
        bench = raw.get("benchmark") or {}
        _require(bench.get("type") == "rounds", f"{raw['id']}: AMRAP benchmark type")
        _require(int(bench.get("target") or 0) > 0, f"{raw['id']}: AMRAP benchmark target")
    src = raw.get("source") or {}
    _require(isinstance(src, dict), f"{raw['id']}: source object")
    return raw


@lru_cache(maxsize=1)
def load_catalog() -> dict:
    if not CATALOG_PATH.exists():
        raise HeroCatalogError(f"missing catalog {CATALOG_PATH}")
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    _require(isinstance(data, dict) and isinstance(data.get("challenges"), list), "invalid catalog")
    seen = set()
    cleaned = []
    for raw in data["challenges"]:
        item = validate_challenge(raw)
        _require(item["id"] not in seen, f"duplicate id {item['id']}")
        seen.add(item["id"])
        cleaned.append(item)
    return {"version": int(data.get("version") or HERO_VERSION), "challenges": cleaned}


def all_challenges() -> List[dict]:
    return list(load_catalog()["challenges"])


def get_challenge(slug_or_id: str) -> Optional[dict]:
    key = str(slug_or_id or "").strip()
    if not key:
        return None
    for item in all_challenges():
        if item["id"] == key or item["slug"] == key:
            return deepcopy(item)
    return None


def get_challenge_or_404(slug_or_id: str) -> dict:
    item = get_challenge(slug_or_id)
    if not item:
        raise HTTPException(status_code=404, detail="Hero challenge introuvable")
    return item


def catalog_version() -> int:
    return int(load_catalog().get("version") or HERO_VERSION)


def is_playable(challenge: dict) -> bool:
    return bool(challenge.get("playable")) and challenge.get("challenge_type") in {
        "amrap",
        "rounds",
        "structured",
    }


def localize_name(ex: dict, locale: str = "fr") -> str:
    names = ex.get("name_i18n") or {}
    lang = (locale or "fr").split("-")[0]
    return names.get(lang) or names.get("fr") or ex.get("name") or ex.get("exercise_id")


def build_workout_blocks(challenge: dict, locale: str = "fr") -> List[dict]:
    """Blocs séance à partir du catalogue — charges jamais inventées."""
    exercises_out: List[dict] = []
    order = 0

    def add_ex(ex: dict) -> None:
        nonlocal order
        name = localize_name(ex, locale)
        item = {
            "exercise_id": ex.get("exercise_id"),
            "name": name,
            "description": ex.get("notes") or ex.get("intensity_hint") or None,
            "exercise_type": ex.get("exercise_type") or "reps",
            "duration": ex.get("duration"),
            "reps": ex.get("reps"),
            "rest_after": int(ex.get("rest_after") or 30),
            "order": order,
            "tts_enabled": True,
            "image_url": None,
            "exercise_name_snapshot": name,
            "exercise_name_i18n_snapshot": dict(ex.get("name_i18n") or {}),
            "sets": ex.get("sets"),
            "reps_scheme": ex.get("reps_scheme"),
            "notes": ex.get("notes"),
            "intensity_hint": ex.get("intensity_hint"),
            "load": ex.get("load", None),
            "per_side": ex.get("per_side"),
            "distance_yards": ex.get("distance_yards"),
            "distance_meters": ex.get("distance_meters"),
            "hero_open_series": bool(ex.get("hero_open_series")),
            "unspecified": bool(ex.get("unspecified")),
        }
        exercises_out.append(item)
        order += 1

    for ex in challenge.get("exercises") or []:
        add_ex(ex)
    for ex in challenge.get("coda_exercises") or []:
        add_ex(ex)
    if not exercises_out:
        return []
    return [{"block_type": "main", "exercises": exercises_out}]


def build_snapshot(challenge: dict) -> dict:
    """Snapshot minimal figé au moment de la planification."""
    reward = challenge.get("reward") or {}
    return {
        "id": challenge["id"],
        "slug": challenge["slug"],
        "version": catalog_version(),
        "character_name": challenge.get("character_name"),
        "actor_name": challenge.get("actor_name"),
        "title": challenge.get("title"),
        "challenge_type": challenge.get("challenge_type"),
        "duration_seconds": challenge.get("duration_seconds"),
        "rounds": challenge.get("rounds"),
        "playable": is_playable(challenge),
        "scoring": deepcopy(challenge.get("scoring")),
        "benchmark": deepcopy(challenge.get("benchmark")),
        "reward": deepcopy(reward),
        "visual_theme": deepcopy(challenge.get("visual_theme") or {}),
        "exercises": deepcopy(challenge.get("exercises") or []),
        "coda_exercises": deepcopy(challenge.get("coda_exercises") or []),
        "safety_note_key": challenge.get("safety_note_key"),
    }


def attach_hero_metadata(workout_doc: dict, challenge: dict) -> dict:
    workout_doc["source_type"] = "hero_challenge"
    workout_doc["hero_challenge_id"] = challenge["id"]
    workout_doc["hero_challenge_version"] = catalog_version()
    workout_doc["hero_challenge_snapshot"] = build_snapshot(challenge)
    return workout_doc


def snapshot_from_workout(workout: Optional[dict]) -> Optional[dict]:
    if not workout:
        return None
    snap = workout.get("hero_challenge_snapshot")
    if isinstance(snap, dict) and snap.get("id"):
        return snap
    if workout.get("source_type") == "hero_challenge" and workout.get("hero_challenge_id"):
        live = get_challenge(workout["hero_challenge_id"])
        return build_snapshot(live) if live else None
    return None


def public_challenge(challenge: dict, *, progress: Optional[dict] = None) -> dict:
    reward = challenge.get("reward") or {}
    out = {
        "id": challenge["id"],
        "slug": challenge["slug"],
        "universe": challenge.get("universe"),
        "character_name": challenge.get("character_name"),
        "actor_name": challenge.get("actor_name"),
        "rename_key": challenge.get("rename_key"),
        "title": challenge.get("title"),
        "subtitle": challenge.get("subtitle"),
        "description": challenge.get("description"),
        "challenge_type": challenge.get("challenge_type"),
        "format_label": challenge.get("format_label"),
        "duration_seconds": challenge.get("duration_seconds"),
        "rounds": challenge.get("rounds"),
        "playable": is_playable(challenge),
        "difficulty": challenge.get("difficulty"),
        "status": challenge.get("status"),
        "is_curated": True,
        "exercises": deepcopy(challenge.get("exercises") or []),
        "coda_exercises": deepcopy(challenge.get("coda_exercises") or []),
        "program": deepcopy(challenge.get("program")),
        "strength_references": deepcopy(challenge.get("strength_references") or []),
        "related_references": deepcopy(challenge.get("related_references") or []),
        "info_references": deepcopy(challenge.get("info_references") or []),
        "notes": deepcopy(challenge.get("notes") or []),
        "safety_note_key": challenge.get("safety_note_key"),
        "scoring": deepcopy(challenge.get("scoring")),
        "benchmark": deepcopy(challenge.get("benchmark")),
        "reward": deepcopy(reward),
        "visual_theme": deepcopy(challenge.get("visual_theme") or {}),
        "source": deepcopy(challenge.get("source") or {}),
        "benchmark_source": deepcopy(challenge.get("benchmark_source")),
        "version": catalog_version(),
    }
    if progress:
        out["progress"] = progress
    return out


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def evaluate_hero_result(snapshot: dict, result: Optional[dict], *, session_status: str) -> dict:
    """Évalue un résultat de Player. Ne invente pas de charges."""
    result = result or {}
    ctype = snapshot.get("challenge_type")
    duration = _int(result.get("duration_seconds"), _int(snapshot.get("duration_seconds")))
    rounds = max(0, _int(result.get("rounds")))
    coda_done = bool(result.get("coda_complete"))
    completed = session_status == "completed"
    skipped = bool(result.get("has_skips"))
    blocks_done = bool(result.get("blocks_complete"))
    if completed and not skipped and result.get("blocks_complete") is None:
        blocks_done = True

    benchmark = snapshot.get("benchmark") or {}
    reward = snapshot.get("reward") or {}
    unlock = (reward.get("unlock_condition") or {}) if isinstance(reward, dict) else {}
    unlock_type = unlock.get("type")

    success = False
    completed_challenge = False

    if ctype == "amrap":
        completed_challenge = completed
        target = _int(benchmark.get("target") or unlock.get("value"))
        within = _int(unlock.get("within_seconds") or snapshot.get("duration_seconds") or 1200)
        success = completed and rounds >= target and (duration <= within or duration == 0)
    elif ctype == "rounds":
        target = _int(
            (snapshot.get("scoring") or {}).get("target_rounds")
            or benchmark.get("target")
            or snapshot.get("rounds")
            or unlock.get("value")
            or 0
        )
        if unlock_type == "rounds_plus_coda":
            completed_challenge = completed and rounds >= target and coda_done
            success = completed_challenge
        else:
            completed_challenge = completed and rounds >= target
            success = completed_challenge
    elif ctype in ("structured",):
        completed_challenge = completed and blocks_done and not skipped
        success = completed_challenge
    else:
        completed_challenge = False
        success = False

    total_reps = None
    if ctype == "amrap":
        per_round = 0
        for ex in snapshot.get("exercises") or []:
            per_round += _int(ex.get("reps"))
        extra = _int(result.get("partial_reps"))
        total_reps = rounds * per_round + extra

    badge_id = reward.get("badge_id") if success else None
    theme_id = reward.get("profile_theme_id") if success else None

    return {
        "challenge_id": snapshot.get("id"),
        "challenge_type": ctype,
        "rounds": rounds,
        "partial_reps": _int(result.get("partial_reps")),
        "total_reps": total_reps,
        "duration_seconds": duration,
        "coda_complete": coda_done,
        "blocks_complete": blocks_done,
        "completed": completed_challenge,
        "benchmark_reached": bool(success),
        "success": bool(success),
        "badge_id": badge_id,
        "profile_theme_id": theme_id,
        "has_skips": skipped,
    }


def best_score_value(challenge_type: str, attempt: dict) -> int:
    if challenge_type == "amrap":
        return _int(attempt.get("rounds"))
    if challenge_type == "rounds":
        return _int(attempt.get("rounds"))
    return 1 if attempt.get("completed") else 0


def can_use_profile_theme(theme_id: Optional[str], unlocked_badge_ids: set) -> bool:
    theme = (theme_id or DEFAULT_PROFILE_THEME).strip() or DEFAULT_PROFILE_THEME
    if theme == DEFAULT_PROFILE_THEME:
        return True
    if theme not in ALLOWED_PROFILE_THEMES:
        return False
    required = THEME_REQUIRES_BADGE.get(theme)
    if not required:
        return False
    return required in unlocked_badge_ids


def assert_profile_theme_allowed(theme_id: Optional[str], unlocked_badge_ids: set) -> str:
    theme = (theme_id or DEFAULT_PROFILE_THEME).strip() or DEFAULT_PROFILE_THEME
    if theme not in ALLOWED_PROFILE_THEMES:
        raise HTTPException(status_code=400, detail="profile_theme_id invalide")
    if not can_use_profile_theme(theme, unlocked_badge_ids):
        raise HTTPException(status_code=403, detail="Thème de profil verrouillé")
    return theme


async def record_attempt(db, user_id: str, evaluated: dict, session_id: str) -> dict:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "challenge_id": evaluated.get("challenge_id"),
        "session_id": session_id,
        "date": now[:10],
        "score": evaluated.get("rounds"),
        "rounds": evaluated.get("rounds"),
        "partial_reps": evaluated.get("partial_reps"),
        "total_reps": evaluated.get("total_reps"),
        "duration_seconds": evaluated.get("duration_seconds"),
        "completed": bool(evaluated.get("completed")),
        "benchmark_reached": bool(evaluated.get("benchmark_reached")),
        "success": bool(evaluated.get("success")),
        "coda_complete": bool(evaluated.get("coda_complete")),
        "created_at": now,
    }
    result = await db.hero_challenge_attempts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


async def list_attempts(db, user_id: str, challenge_id: Optional[str] = None) -> List[dict]:
    query: Dict[str, Any] = {"user_id": user_id}
    if challenge_id:
        query["challenge_id"] = challenge_id
    rows = await db.hero_challenge_attempts.find(query).sort("created_at", -1).to_list(500)
    out = []
    for row in rows:
        out.append({"id": str(row["_id"]), **{k: v for k, v in row.items() if k != "_id"}})
    return out


async def best_scores_map(db, user_id: str) -> Dict[str, int]:
    rows = await db.hero_challenge_attempts.find({"user_id": user_id}).to_list(2000)
    best: Dict[str, int] = {}
    for row in rows:
        cid = row.get("challenge_id")
        if not cid:
            continue
        challenge = get_challenge(cid)
        ctype = (challenge or {}).get("challenge_type") or "amrap"
        value = best_score_value(ctype, row)
        best[cid] = max(best.get(cid, 0), value)
    return best


async def user_hero_progress(db, user_id: str) -> dict:
    attempts = await list_attempts(db, user_id)
    best = await best_scores_map(db, user_id)
    completed_ids = {a["challenge_id"] for a in attempts if a.get("completed")}
    success_ids = {a["challenge_id"] for a in attempts if a.get("benchmark_reached") or a.get("success")}
    return {
        "attempts": attempts,
        "best_scores": best,
        "completed_ids": sorted(completed_ids),
        "success_ids": sorted(success_ids),
    }


def hero_metrics_from_attempts(attempts: List[dict]) -> dict:
    completed = set()
    success = set()
    best: Dict[str, int] = {}
    for row in attempts:
        cid = row.get("challenge_id")
        if not cid:
            continue
        if row.get("completed"):
            completed.add(cid)
        if row.get("benchmark_reached") or row.get("success"):
            success.add(cid)
        challenge = get_challenge(cid)
        ctype = (challenge or {}).get("challenge_type") or "amrap"
        value = best_score_value(ctype, row)
        best[cid] = max(best.get(cid, 0), value)
    return {
        "hero_completed_ids": list(completed),
        "hero_success_ids": list(success),
        "hero_best_scores": best,
    }


def evaluate_hero_badge(metrics: dict, definition: dict) -> dict:
    params = definition.get("condition_params") or {}
    cid = params.get("hero_challenge_id")
    kind = params.get("unlock") or "complete"
    target = definition.get("condition_value") or 1
    if kind == "benchmark":
        ids = set(metrics.get("hero_success_ids") or [])
        eligible = cid in ids
        current = 1 if eligible else 0
    else:
        ids = set(metrics.get("hero_completed_ids") or [])
        eligible = cid in ids
        current = 1 if eligible else 0
    return {
        "current": current,
        "target": target,
        "percentage": 100 if eligible else 0,
        "eligible": eligible,
    }

"""Validation des exercices d'activité FitMatch dans les séances / templates."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .presets import list_activity_presets, preset_by_id

ACTIVITY_EXERCISE_PREFIX = "activity:"

DEFAULT_INTERVAL_CONFIG = {
    "work_seconds": 30,
    "rest_seconds": 30,
    "rounds": 8,
}


def activity_exercise_id(preset_id: str) -> str:
    if preset_id.startswith(ACTIVITY_EXERCISE_PREFIX):
        return preset_id
    return f"{ACTIVITY_EXERCISE_PREFIX}{preset_id}"


def parse_activity_preset_id(exercise_id: Optional[str]) -> Optional[str]:
    if not exercise_id or not isinstance(exercise_id, str):
        return None
    if not exercise_id.startswith(ACTIVITY_EXERCISE_PREFIX):
        return None
    preset_id = exercise_id[len(ACTIVITY_EXERCISE_PREFIX) :]
    return preset_id or None


def is_activity_workout_exercise(ex: Dict[str, Any]) -> bool:
    if not ex:
        return False
    if ex.get("source") == "activity_preset":
        return True
    if parse_activity_preset_id(ex.get("exercise_id")):
        return True
    mode = ex.get("activity_tracking_mode") or ex.get("tracking_type_snapshot")
    return bool(mode and mode not in ("standard", "reps", "duration", None))


def default_activity_config(tracking_mode: str) -> Dict[str, Any]:
    base = {
        "target_duration_seconds": None,
        "target_distance_meters": None,
        "pool_length_meters": None,
        "interval_config": None,
    }
    if tracking_mode == "laps":
        return {**base, "pool_length_meters": 25.0}
    if tracking_mode == "intervals":
        return {**base, "interval_config": dict(DEFAULT_INTERVAL_CONFIG)}
    return base


def canonicalize_activity_exercise(ex: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise un exercice activité et refuse les IDs arbitraires."""
    preset_id = ex.get("preset_id") or parse_activity_preset_id(ex.get("exercise_id"))
    if not preset_id:
        raise HTTPException(status_code=400, detail="Exercice activité sans preset_id valide")

    preset = preset_by_id(preset_id)
    if not preset:
        raise HTTPException(
            status_code=400,
            detail=f"Preset d'activité inconnu: {preset_id}",
        )

    mode = (
        ex.get("activity_tracking_mode")
        or preset.get("activity_tracking_mode")
        or "timer"
    )
    name_i18n = ex.get("exercise_name_i18n_snapshot") or preset.get("name") or {}
    name = (
        ex.get("name")
        or ex.get("exercise_name_snapshot")
        or (name_i18n.get("fr") if isinstance(name_i18n, dict) else None)
        or preset_id
    )
    config = ex.get("activity_config")
    if not isinstance(config, dict):
        config = default_activity_config(mode)
    else:
        defaults = default_activity_config(mode)
        merged = {**defaults, **config}
        if mode == "laps" and merged.get("pool_length_meters") is None:
            merged["pool_length_meters"] = 25.0
        if mode == "intervals" and not merged.get("interval_config"):
            merged["interval_config"] = dict(DEFAULT_INTERVAL_CONFIG)
        config = merged

    out = dict(ex)
    out.update(
        {
            "exercise_id": activity_exercise_id(preset_id),
            "source": "activity_preset",
            "preset_id": preset_id,
            "name": name,
            "exercise_name_snapshot": ex.get("exercise_name_snapshot") or name,
            "exercise_name_i18n_snapshot": name_i18n if isinstance(name_i18n, dict) else {},
            "exercise_type": ex.get("exercise_type") or "activity",
            "activity_kind": ex.get("activity_kind") or preset.get("activity_kind") or "other",
            "activity_tracking_mode": mode,
            "tracking_type_snapshot": mode,
            "activity_config": config,
            "reps": None if ex.get("reps") in (None, "", 0) else ex.get("reps"),
            "duration": None if ex.get("duration") in (None, "", 0) else ex.get("duration"),
            "rest_after": int(ex.get("rest_after") or 0),
        }
    )
    return out


def validate_workout_blocks(blocks: List[Any]) -> List[Dict[str, Any]]:
    """Valide / normalise les blocs ; presets activité hors exercise_catalog."""
    known_ids = {p["id"] for p in list_activity_presets()}
    result: List[Dict[str, Any]] = []

    for block in blocks or []:
        if hasattr(block, "model_dump"):
            block_data = block.model_dump()
        elif isinstance(block, dict):
            block_data = dict(block)
        else:
            raise HTTPException(status_code=400, detail="Bloc de séance invalide")

        exercises_out: List[Dict[str, Any]] = []
        for ex in block_data.get("exercises") or []:
            if hasattr(ex, "model_dump"):
                ex_data = ex.model_dump()
            else:
                ex_data = dict(ex)

            if is_activity_workout_exercise(ex_data):
                preset_id = ex_data.get("preset_id") or parse_activity_preset_id(
                    ex_data.get("exercise_id")
                )
                if not preset_id or preset_id not in known_ids:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Preset d'activité invalide: {preset_id or ex_data.get('exercise_id')}",
                    )
                exercises_out.append(canonicalize_activity_exercise(ex_data))
            else:
                exercises_out.append(ex_data)

        block_data["exercises"] = exercises_out
        result.append(block_data)

    return result

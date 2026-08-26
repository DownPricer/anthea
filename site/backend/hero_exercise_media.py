"""Alias hero exercise_id → médias catalogue ExerciseDB."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

ALIASES_PATH = Path(__file__).resolve().parent / "data" / "hero_exercise_aliases.json"


@lru_cache(maxsize=1)
def load_aliases() -> Dict[str, dict]:
    if not ALIASES_PATH.exists():
        return {}
    with ALIASES_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    raw = data.get("aliases") or {}
    return {str(k): dict(v) for k, v in raw.items() if isinstance(v, dict)}


def resolve_hero_exercise_media(exercise_id: str) -> dict:
    return dict(load_aliases().get(str(exercise_id or "").strip()) or {})


def enrich_hero_exercise(ex: dict) -> dict:
    """Ajoute image_url / catalog_exercise_id depuis les alias sans écraser l'existant."""
    out = dict(ex)
    alias = resolve_hero_exercise_media(ex.get("exercise_id") or "")
    if alias.get("gif_url") and not out.get("image_url"):
        out["image_url"] = alias["gif_url"]
    if alias.get("catalog_id") and not out.get("catalog_exercise_id"):
        out["catalog_exercise_id"] = alias["catalog_id"]
    if alias.get("fallback") and not out.get("media_fallback"):
        out["media_fallback"] = alias["fallback"]
    return out


def enrich_hero_exercises(exercises: list) -> list:
    return [enrich_hero_exercise(ex) for ex in (exercises or []) if isinstance(ex, dict)]

"""Presets d'activités canoniques FitMatch (distincts du catalogue ExerciseDB)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

PRESETS_PATH = Path(__file__).resolve().parent.parent / "data" / "activities" / "activity_presets.json"

PRESET_SEARCH_ALIASES: Dict[str, Dict[str, List[str]]] = {
    "outdoor_running": {
        "fr": ["course", "courir", "running", "jogging"],
        "en": ["run", "running", "jogging"],
        "es": ["correr", "carrera"],
    },
    "outdoor_walking": {
        "fr": ["marche", "marcher", "promenade"],
        "en": ["walk", "walking"],
        "es": ["caminar", "marcha"],
    },
    "hiking": {
        "fr": ["randonnee", "randonnée", "rando"],
        "en": ["hike", "hiking"],
        "es": ["senderismo"],
    },
    "outdoor_cycling": {
        "fr": ["velo", "vélo", "cyclisme", "bicyclette"],
        "en": ["bike", "cycling"],
        "es": ["bicicleta", "ciclismo"],
    },
    "outdoor_roller": {
        "fr": ["roller", "patin"],
        "en": ["skating", "inline"],
        "es": ["patinaje"],
    },
    "pool_swimming": {
        "fr": ["natation", "nage", "piscine"],
        "en": ["swim", "swimming", "pool"],
        "es": ["natacion", "natación", "nadar", "piscina"],
    },
    "track_laps": {
        "fr": ["piste", "tours de piste"],
        "en": ["track", "track laps"],
        "es": ["pista", "vueltas"],
    },
    "shuttle_run": {
        "fr": ["navette"],
        "en": ["shuttle"],
        "es": ["naveta"],
    },
    "interval_running": {
        "fr": ["fractionne", "fractionné", "intervalle", "intervalles"],
        "en": ["interval", "intervals"],
        "es": ["intervalos"],
    },
    "tabata": {"fr": ["tabata"], "en": ["tabata"], "es": ["tabata"]},
    "free_intervals": {
        "fr": ["intervalles libres"],
        "en": ["free intervals"],
        "es": ["intervalos libres"],
    },
    "treadmill_running": {
        "fr": ["tapis", "tapis de course"],
        "en": ["treadmill"],
        "es": ["cinta de correr", "cinta"],
    },
    "indoor_cycling": {
        "fr": ["velo interieur", "vélo intérieur", "home trainer"],
        "en": ["indoor bike", "stationary bike"],
        "es": ["ciclismo indoor", "bici estatica"],
    },
    "indoor_rowing": {
        "fr": ["rameur", "aviron interieur", "aviron intérieur"],
        "en": ["rowing", "rower"],
        "es": ["remo"],
    },
    "elliptical": {
        "fr": ["elliptique"],
        "en": ["elliptical"],
        "es": ["eliptica", "elíptica"],
    },
    "yoga_session": {"fr": ["yoga"], "en": ["yoga"], "es": ["yoga"]},
    "stretching_session": {
        "fr": ["etirement", "étirement", "etirements", "étirements"],
        "en": ["stretch", "stretching"],
        "es": ["estiramiento"],
    },
}


def load_activity_presets(path: Optional[Path] = None) -> Dict[str, Any]:
    p = path or PRESETS_PATH
    if not p.exists():
        return {"version": 1, "presets": []}
    return json.loads(p.read_text(encoding="utf-8"))


def list_activity_presets(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    data = load_activity_presets(path)
    return list(data.get("presets") or [])


def preset_by_id(preset_id: str, path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    for preset in list_activity_presets(path):
        if preset.get("id") == preset_id:
            return preset
    return None


def preset_classification_fields(preset_id: str, path: Optional[Path] = None) -> Dict[str, Any]:
    preset = preset_by_id(preset_id, path)
    if not preset:
        raise KeyError(preset_id)
    mode = preset.get("activity_tracking_mode") or "standard"
    confidence = "high" if mode == "gps" else "high"
    return {
        "activity_tracking_mode": mode,
        "activity_kind": preset.get("activity_kind") or "other",
        "activity_classification_version": 2,
        "activity_classification_source": "activity_preset",
        "activity_classification_confidence": confidence,
    }


def preset_search_payload(preset: Dict[str, Any]) -> Dict[str, Any]:
    """Projection légère pour découverte / recherche (sans données catalogue)."""
    preset_id = preset.get("id") or ""
    return {
        "id": preset_id,
        "name": preset.get("name") or {},
        "description": preset.get("description") or {},
        "activity_kind": preset.get("activity_kind") or "other",
        "activity_tracking_mode": preset.get("activity_tracking_mode") or "standard",
        "aliases": preset.get("aliases") or PRESET_SEARCH_ALIASES.get(preset_id, {}),
        "icon": preset.get("icon") or "",
    }


def list_preset_search_payloads(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    return [preset_search_payload(p) for p in list_activity_presets(path)]


def localized_preset(preset: Dict[str, Any], locale: str = "fr") -> Dict[str, Any]:
    lang = (locale or "fr").split("-")[0].lower()
    name_obj = preset.get("name") or {}
    desc_obj = preset.get("description") or {}
    return {
        "id": preset.get("id"),
        "activity_kind": preset.get("activity_kind"),
        "activity_tracking_mode": preset.get("activity_tracking_mode"),
        "icon": preset.get("icon"),
        "name": name_obj.get(lang) or name_obj.get("en") or preset.get("id"),
        "description": desc_obj.get(lang) or desc_obj.get("en") or "",
        "name_i18n": name_obj,
        "description_i18n": desc_obj,
        "source": "activity_preset",
    }

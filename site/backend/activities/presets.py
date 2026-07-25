"""Presets d'activités canoniques FitMatch (distincts du catalogue ExerciseDB)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

PRESETS_PATH = Path(__file__).resolve().parent.parent / "data" / "activities" / "activity_presets.json"


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

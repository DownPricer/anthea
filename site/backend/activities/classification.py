"""Classification activity_tracking_mode / activity_kind — version 2 (stricte)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from exercises.taxonomy import fold_text

from .constants import ACTIVITY_KINDS, ACTIVITY_TRACKING_MODES

CLASSIFICATION_VERSION = 2

OVERRIDES_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "exercises" / "activity_tracking_overrides.json"
)

# IDs produits en faux positifs GPS — forcés standard (confiance élevée)
KNOWN_FALSE_POSITIVE_IDS = frozenset(
    {
        "exdb_0971",
        "exdb_0103",
        "exdb_0796",
        "exdb_2203",
        "exdb_0083",
        "exdb_0084",
        "exdb_0100",
        "exdb_3304",
        "exdb_2464",
        "exdb_0859",
    }
)

SAMPLE_REPORT_IDS = list(KNOWN_FALSE_POSITIVE_IDS)

MACHINE_EQUIPMENT = frozenset(
    {"treadmill", "stationary_bike", "elliptical", "rowing_machine", "stair_climber"}
)

# Phrases machine cardio (correspondance phrase entière tokenisée)
MACHINE_NAME_PHRASES: List[Tuple[str, str, str]] = [
    ("treadmill", "manual_distance", "running"),
    ("treadmill running", "manual_distance", "running"),
    ("stationary bike", "manual_distance", "cycling"),
    ("exercise bike", "manual_distance", "cycling"),
    ("indoor cycling", "manual_distance", "cycling"),
    ("elliptical trainer", "manual_distance", "elliptical"),
    ("elliptical machine", "manual_distance", "elliptical"),
    ("rowing machine", "manual_distance", "rowing"),
    ("indoor rower", "manual_distance", "rowing"),
    ("rower machine", "manual_distance", "rowing"),
    ("stair climber", "manual_distance", "stair_climber"),
    ("stepmill", "manual_distance", "stair_climber"),
    ("ski erg", "manual_distance", "rowing"),
    ("skierg", "manual_distance", "rowing"),
]

TIMER_SPORT_MAP = {
    "yoga": "yoga",
    "stretching": "stretching",
    "mobility": "mobility",
    "pilates": "mobility",
}

INTERVAL_PHRASES = [
    "tabata",
    "hiit",
    "fartlek",
    "interval training",
    "fractionne",
    "fractionne",
]

# Maintiens isométriques / chronométrés autorisés (phrase entière)
TIMER_HOLD_PHRASES = [
    "wall sit",
    "plank hold",
    "static plank",
    "front plank",
    "side plank hold",
    "isometric hold",
    "static stretch",
    "jump rope",
    "corde a sauter",
]

# Exercices dynamiques contenant plank/stretch → standard
TIMER_DYNAMIC_EXCLUSIONS = [
    "plank tap",
    "plank rotation",
    "plank leg lift",
    "plank shoulder",
    "side plank rear fly",
    "side plank rotation",
    "stretching exercise",
    "dynamic stretch",
    "walking lunge",
    "walking high knees",
    "running man",
    "bridge march",
    "march sit",
]


def load_overrides(path: Optional[Path] = None) -> Dict[str, Any]:
    p = path or OVERRIDES_PATH
    if not p.exists():
        return {"by_id": {}, "global_exclusions": [], "rules": []}
    return json.loads(p.read_text(encoding="utf-8"))


def _name_haystack(doc: Dict[str, Any]) -> str:
    name = doc.get("name") or {}
    parts: List[str] = []
    if isinstance(name, dict):
        parts.extend(str(v) for v in name.values() if v)
    else:
        parts.append(str(name))
    aliases = doc.get("aliases") or []
    if isinstance(aliases, list):
        parts.extend(str(a) for a in aliases if a)
    parts.append(str(doc.get("provider_name") or ""))
    return fold_text(" ".join(parts))


def _tokenize(text: str) -> List[str]:
    folded = fold_text(text)
    return re.findall(r"[a-z0-9]+", folded)


def _phrase_in_haystack(hay: str, phrase: str) -> bool:
    """Correspondance phrase entière sur tokens (limites de mots)."""
    hay_tokens = _tokenize(hay)
    phrase_tokens = _tokenize(phrase)
    if not phrase_tokens:
        return False
    n = len(phrase_tokens)
    if n > len(hay_tokens):
        return False
    for i in range(len(hay_tokens) - n + 1):
        if hay_tokens[i : i + n] == phrase_tokens:
            return True
    return False


def _any_phrase(hay: str, phrases: List[str]) -> bool:
    return any(_phrase_in_haystack(hay, p) for p in phrases if p)


def _matches_global_exclusion(hay: str, exclusions: List[str]) -> bool:
    for ex in exclusions:
        fk = fold_text(ex)
        if not fk:
            continue
        if _phrase_in_haystack(hay, fk):
            return True
        # Phrases multi-mots sans tokenisation stricte pour termes composés
        if " " in fk and fk in hay:
            return True
    return False


def _is_dynamic_timer_excluded(hay: str) -> bool:
    return _any_phrase(hay, TIMER_DYNAMIC_EXCLUSIONS)


def _classify_machine(doc: Dict[str, Any], hay: str) -> Optional[Tuple[str, str, str, str]]:
    equipment = set(doc.get("equipment") or [])
    has_machine_eq = bool(equipment & MACHINE_EQUIPMENT)

    for phrase, mode, kind in MACHINE_NAME_PHRASES:
        if _phrase_in_haystack(hay, phrase):
            # Exclure les faux positifs row/kayak/march
            if any(
                _phrase_in_haystack(hay, bad)
                for bad in (
                    "barbell row",
                    "cable row",
                    "kayak row",
                    "bent over row",
                    "walking",
                    "lunge",
                    "march",
                )
            ):
                continue
            return mode, kind, "strict_machine_rule", "high"

    if has_machine_eq:
        # Équipement machine seul : exiger nom cohérent, pas un exercice de musculation
        strength_markers = (
            "barbell",
            "dumbbell",
            "cable",
            "band assisted",
            "lever",
            "smith",
            "rollout",
            "rollerout",
        )
        if any(_phrase_in_haystack(hay, m) for m in strength_markers):
            return None
        equip_map = {
            "treadmill": ("manual_distance", "running"),
            "stationary_bike": ("manual_distance", "cycling"),
            "elliptical": ("manual_distance", "elliptical"),
            "rowing_machine": ("manual_distance", "rowing"),
            "stair_climber": ("manual_distance", "stair_climber"),
        }
        for eq in sorted(equipment & MACHINE_EQUIPMENT):
            mode, kind = equip_map[eq]
            return mode, kind, "strict_machine_rule", "high"
    return None


def _classify_timer(doc: Dict[str, Any], hay: str) -> Optional[Tuple[str, str, str, str]]:
    if _is_dynamic_timer_excluded(hay):
        return None
    sport = doc.get("sport") or "other"
    if sport in TIMER_SPORT_MAP:
        return "timer", TIMER_SPORT_MAP[sport], "strict_timer_rule", "high"
    if _any_phrase(hay, TIMER_HOLD_PHRASES):
        kind = "jump_rope" if _phrase_in_haystack(hay, "jump rope") or _phrase_in_haystack(hay, "corde a sauter") else "other"
        return "timer", kind, "strict_timer_rule", "high"
    # Planche statique simple uniquement (mot complet plank/planche sans modifiers dynamiques)
    if (_phrase_in_haystack(hay, "plank") or _phrase_in_haystack(hay, "planche")) and not _is_dynamic_timer_excluded(hay):
        dynamic_mods = ("tap", "rotation", "leg lift", "shoulder", "rear fly", "twist", "reach")
        if not any(_phrase_in_haystack(hay, m) for m in dynamic_mods):
            return "timer", "other", "strict_timer_rule", "medium"
    return None


def _classify_intervals(hay: str) -> Optional[Tuple[str, str, str, str]]:
    if _any_phrase(hay, INTERVAL_PHRASES):
        kind = "hiit" if _phrase_in_haystack(hay, "tabata") or _phrase_in_haystack(hay, "hiit") else "running"
        return "intervals", kind, "strict_interval_rule", "high"
    return None


def classify_exercise(
    doc: Dict[str, Any],
    overrides: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str, str, str]:
    """
    Retourne (mode, kind, source, confidence, version).
    GPS sur catalogue ExerciseDB : uniquement via by_id explicite validé.
    """
    cfg = overrides or load_overrides()
    eid = str(doc.get("id") or "")
    hay = _name_haystack(doc)

    global_exclusions = list(cfg.get("global_exclusions") or [])
    if eid in KNOWN_FALSE_POSITIVE_IDS or _matches_global_exclusion(hay, global_exclusions):
        return _finalize("standard", "other", "explicit_override", "high")

    by_id = cfg.get("by_id") or {}
    if eid and eid in by_id:
        entry = by_id[eid]
        mode = entry.get("activity_tracking_mode") or "standard"
        kind = entry.get("activity_kind") or "other"
        conf = entry.get("activity_classification_confidence") or "high"
        source = entry.get("activity_classification_source") or "explicit_override"
        return _finalize(mode, kind, source, conf)

    # Pas de GPS ni de laps catalogue via nom — activités complètes via presets FitMatch
    machine = _classify_machine(doc, hay)
    if machine:
        return _finalize(*machine)

    timer = _classify_timer(doc, hay)
    if timer:
        return _finalize(*timer)

    intervals = _classify_intervals(hay)
    if intervals:
        return _finalize(*intervals)

    return _finalize("standard", "other", "default_standard", "high")


def _finalize(mode: str, kind: str, source: str, confidence: str) -> Tuple[str, str, str, str, str]:
    if mode not in ACTIVITY_TRACKING_MODES:
        mode = "standard"
    if kind not in ACTIVITY_KINDS:
        kind = "other"
    if mode == "gps" and confidence != "high":
        mode = "standard"
        kind = "other"
        source = "default_standard"
        confidence = "high"
    return mode, kind, source, confidence, str(CLASSIFICATION_VERSION)


def is_reliable_catalog_activity(doc: Dict[str, Any], overrides: Optional[Dict[str, Any]] = None) -> bool:
    """Exercice catalogue sûr pour démarrage activité (jamais GPS faible)."""
    fields = classification_fields(doc, overrides)
    mode = fields["activity_tracking_mode"]
    confidence = fields["activity_classification_confidence"]
    if mode in ("standard", "gps"):
        return False
    return confidence == "high"


def classification_fields(doc: Dict[str, Any], overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    mode, kind, source, confidence, version = classify_exercise(doc, overrides)
    return {
        "activity_tracking_mode": mode,
        "activity_kind": kind,
        "activity_classification_version": int(version),
        "activity_classification_source": source,
        "activity_classification_confidence": confidence,
    }


def classify_catalog_documents(
    docs: List[Dict[str, Any]],
    *,
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cfg = overrides or load_overrides()
    counts = {m: 0 for m in ACTIVITY_TRACKING_MODES}
    counts["unclassified"] = 0
    changes = 0
    false_positive_fixes = 0
    errors: List[str] = []
    updates: List[Dict[str, Any]] = []
    sample_before_after: Dict[str, Dict[str, Any]] = {}

    for doc in docs:
        try:
            fields = classification_fields(doc, cfg)
            mode = fields["activity_tracking_mode"]
            kind = fields["activity_kind"]
            source = fields["activity_classification_source"]

            if mode == "standard" and source == "default_standard":
                counts["unclassified"] += 1
            counts[mode] = counts.get(mode, 0) + 1

            prev_mode = doc.get("activity_tracking_mode")
            prev_kind = doc.get("activity_kind")
            eid = doc.get("id")

            if prev_mode == "gps" and mode == "standard":
                false_positive_fixes += 1

            changed = (
                prev_mode != mode
                or prev_kind != kind
                or doc.get("activity_classification_version") != fields["activity_classification_version"]
                or doc.get("activity_classification_source") != fields["activity_classification_source"]
                or doc.get("activity_classification_confidence") != fields["activity_classification_confidence"]
            )
            if changed:
                changes += 1
                updates.append({"id": eid, **fields, "prev_mode": prev_mode, "prev_kind": prev_kind})

            if eid in SAMPLE_REPORT_IDS:
                sample_before_after[eid] = {
                    "before": {"activity_tracking_mode": prev_mode, "activity_kind": prev_kind},
                    "after": {
                        "activity_tracking_mode": mode,
                        "activity_kind": kind,
                        "source": source,
                    },
                }
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{doc.get('id')}: {exc}")

    return {
        "examined": len(docs),
        "standard": counts.get("standard", 0),
        "timer": counts.get("timer", 0),
        "manual_distance": counts.get("manual_distance", 0),
        "laps": counts.get("laps", 0),
        "gps": counts.get("gps", 0),
        "intervals": counts.get("intervals", 0),
        "unclassified": counts.get("unclassified", 0),
        "changes": changes,
        "false_positive_fixes": false_positive_fixes,
        "errors": errors,
        "updates": updates,
        "sample_before_after": sample_before_after,
        "classification_version": CLASSIFICATION_VERSION,
    }


def apply_activity_modes(
    db,
    *,
    dry_run: bool = True,
    reclassify: bool = False,
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from exercises.catalog import CATALOG_COLLECTION

    col = db[CATALOG_COLLECTION]
    docs = list(col.find({}))
    report = classify_catalog_documents(docs, overrides=overrides)
    report["dry_run"] = dry_run
    report["reclassify"] = reclassify

    if dry_run:
        return report

    for upd in report.get("updates") or []:
        fields = {
            "activity_tracking_mode": upd["activity_tracking_mode"],
            "activity_kind": upd["activity_kind"],
            "activity_classification_version": upd["activity_classification_version"],
            "activity_classification_source": upd["activity_classification_source"],
            "activity_classification_confidence": upd["activity_classification_confidence"],
        }
        col.update_one({"id": upd["id"]}, {"$set": fields})

    docs2 = list(col.find({}))
    verify = classify_catalog_documents(docs2, overrides=overrides)
    report["verify_changes"] = verify.get("changes", 0)
    return report

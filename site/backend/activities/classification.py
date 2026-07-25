"""Classification activity_tracking_mode / activity_kind (idempotente)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from exercises.taxonomy import fold_text

from .constants import ACTIVITY_KINDS, ACTIVITY_TRACKING_MODES

OVERRIDES_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "exercises" / "activity_tracking_overrides.json"
)


def load_overrides(path: Optional[Path] = None) -> Dict[str, Any]:
    p = path or OVERRIDES_PATH
    if not p.exists():
        return {"by_id": {}, "by_name_fold": {}, "rules": []}
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


def _match_any(hay: str, needles: Optional[List[str]]) -> bool:
    if not needles:
        return True
    return any(fold_text(n) in hay for n in needles if n)


def _match_none(hay: str, needles: Optional[List[str]]) -> bool:
    if not needles:
        return True
    return not any(fold_text(n) in hay for n in needles if n)


def _kind_from_equipment(equipment: List[str], mapping: Dict[str, str]) -> Optional[str]:
    for eq in equipment or []:
        if eq in mapping:
            return mapping[eq]
    return None


def _kind_from_name(hay: str) -> Optional[str]:
    checks = [
        ("treadmill", "running"),
        ("tapis", "running"),
        ("stationary bike", "cycling"),
        ("velo", "cycling"),
        ("elliptical", "elliptical"),
        ("elliptique", "elliptical"),
        ("rower", "rowing"),
        ("rameur", "rowing"),
        ("stair", "stair_climber"),
        ("escalier", "stair_climber"),
        ("jump rope", "jump_rope"),
        ("corde a sauter", "jump_rope"),
        ("plank", "other"),
        ("planche", "other"),
        ("yoga", "yoga"),
        ("stretch", "stretching"),
        ("mobil", "mobility"),
        ("tabata", "hiit"),
        ("hiit", "hiit"),
        ("hike", "hiking"),
        ("randonn", "hiking"),
        ("roller", "roller"),
        ("ski", "skiing"),
        ("kayak", "kayaking"),
        ("swim", "swimming"),
        ("piscine", "swimming"),
        ("shuttle", "shuttle"),
        ("navette", "shuttle"),
        ("track", "track"),
        ("walk", "walking"),
        ("marche", "walking"),
        ("run", "running"),
        ("course", "running"),
        ("cycl", "cycling"),
    ]
    for needle, kind in checks:
        if needle in hay:
            return kind
    return None


def classify_exercise(
    doc: Dict[str, Any],
    overrides: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str]:
    """
    Retourne (activity_tracking_mode, activity_kind, source).
    source: override_id | override_name | rule:<id> | default_standard
    """
    cfg = overrides or load_overrides()
    eid = str(doc.get("id") or "")
    by_id = cfg.get("by_id") or {}
    if eid and eid in by_id:
        entry = by_id[eid]
        mode = entry.get("activity_tracking_mode") or "standard"
        kind = entry.get("activity_kind") or "other"
        return _sanitize(mode, kind, "override_id")

    hay = _name_haystack(doc)
    by_name = cfg.get("by_name_fold") or {}
    for key, entry in by_name.items():
        if fold_text(key) and fold_text(key) in hay:
            # Prefer exact-ish match: key appears as whole token or full fold equality
            if hay == fold_text(key) or f" {fold_text(key)} " in f" {hay} " or hay.startswith(fold_text(key)):
                mode = entry.get("activity_tracking_mode") or "standard"
                kind = entry.get("activity_kind") or "other"
                return _sanitize(mode, kind, "override_name")

    # Second pass: substring for curated names
    for key, entry in sorted(by_name.items(), key=lambda kv: -len(kv[0])):
        fk = fold_text(key)
        if fk and fk in hay:
            mode = entry.get("activity_tracking_mode") or "standard"
            kind = entry.get("activity_kind") or "other"
            return _sanitize(mode, kind, "override_name")

    sport = doc.get("sport") or "other"
    equipment = list(doc.get("equipment") or [])
    sport_map = cfg.get("sport_kind_map") or {}
    equip_map = cfg.get("equipment_kind_map") or {}

    rules = sorted(cfg.get("rules") or [], key=lambda r: int(r.get("priority") or 100))
    for rule in rules:
        if not _match_any(hay, rule.get("require_any_name")):
            continue
        if not _match_none(hay, rule.get("exclude_any_name")):
            continue
        req_sports = rule.get("require_any_sport") or []
        if req_sports and sport not in req_sports:
            continue
        req_eq = rule.get("require_any_equipment") or []
        if req_eq and not any(e in equipment for e in req_eq):
            continue
        mode = rule.get("activity_tracking_mode") or "standard"
        kind = rule.get("activity_kind")
        if rule.get("activity_kind_from_sport"):
            kind = sport_map.get(sport) or kind or "other"
            if mode == "intervals" and not kind:
                kind = "hiit"
        if rule.get("activity_kind_from_equipment"):
            kind = _kind_from_equipment(equipment, equip_map) or kind or "other"
        if rule.get("activity_kind_from_name"):
            kind = _kind_from_name(hay) or kind or "other"
        # Ne jamais forcer GPS sur équipement indoor
        if mode == "gps" and any(
            e in equipment
            for e in ("treadmill", "stationary_bike", "elliptical", "rowing_machine", "stair_climber")
        ):
            continue
        return _sanitize(mode, kind or "other", f"rule:{rule.get('id') or 'unknown'}")

    # Défaut : standard (Player classique) — ne pas classifier naïvement
    return "standard", "other", "default_standard"


def _sanitize(mode: str, kind: str, source: str) -> Tuple[str, str, str]:
    if mode not in ACTIVITY_TRACKING_MODES:
        mode = "standard"
    if kind not in ACTIVITY_KINDS:
        kind = "other"
    return mode, kind, source


def classify_catalog_documents(
    docs: List[Dict[str, Any]],
    *,
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    cfg = overrides or load_overrides()
    counts = {m: 0 for m in ACTIVITY_TRACKING_MODES}
    counts["unclassified"] = 0
    overrides_used = 0
    changes = 0
    errors: List[str] = []
    updates: List[Dict[str, Any]] = []

    for doc in docs:
        try:
            mode, kind, source = classify_exercise(doc, cfg)
            if source.startswith("override"):
                overrides_used += 1
            if mode == "standard" and source == "default_standard":
                counts["unclassified"] += 1
            counts[mode] = counts.get(mode, 0) + 1
            prev_mode = doc.get("activity_tracking_mode")
            prev_kind = doc.get("activity_kind")
            if prev_mode != mode or prev_kind != kind:
                changes += 1
                updates.append(
                    {
                        "id": doc.get("id"),
                        "activity_tracking_mode": mode,
                        "activity_kind": kind,
                        "source": source,
                    }
                )
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
        "overrides_used": overrides_used,
        "changes": changes,
        "errors": errors,
        "updates": updates,
    }


def apply_activity_modes(
    db,
    *,
    dry_run: bool = True,
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from exercises.catalog import CATALOG_COLLECTION

    col = db[CATALOG_COLLECTION]
    docs = list(col.find({}))
    report = classify_catalog_documents(docs, overrides=overrides)
    report["dry_run"] = dry_run
    if dry_run:
        return report
    for upd in report.get("updates") or []:
        col.update_one(
            {"id": upd["id"]},
            {
                "$set": {
                    "activity_tracking_mode": upd["activity_tracking_mode"],
                    "activity_kind": upd["activity_kind"],
                }
            },
        )
    # Relecture pour vérifier idempotence stats
    docs2 = list(col.find({}))
    verify = classify_catalog_documents(docs2, overrides=overrides)
    report["verify_changes"] = verify.get("changes", 0)
    return report

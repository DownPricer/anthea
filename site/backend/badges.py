"""API badges — catalogue canonique + compatibilité historique.

Le catalogue versionné vit dans `badge_catalog`.
L'évaluation / déblocage persistent est dans `badge_progress`.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from badge_catalog import (
    ALL_BADGES,
    BADGE_BY_ID,
    CATALOG_VERSION,
    DUO_BADGES,
    LEGACY_BADGE_ID_MAP,
    LEGACY_ORPHAN_BADGE_IDS,
    RARITY_LABELS,
    RARITY_POINTS,
    SOLO_BADGES,
    canonical_badge_id,
    get_badge_definition,
    get_catalog,
    rarity_summary,
    validate_catalog,
)

# Alias rétrocompatibilité
BADGE_ID_ALIASES = dict(LEGACY_BADGE_ID_MAP)
BADGE_CATEGORY_ALIASES = {
    "duo_social": "duo",
    "social_duo": "duo",
    "couple": "duo",
}


def normalize_badge_category(family: Optional[str]) -> str:
    if not family:
        return "other"
    return BADGE_CATEGORY_ALIASES.get(str(family).strip().lower(), family)


def is_duo_category_badge(badge: dict) -> bool:
    family = normalize_badge_category(badge.get("family") or badge.get("scope") or badge.get("category"))
    if family == "duo":
        return True
    bid = str(badge.get("id", ""))
    return bid.startswith("duo_") or badge.get("scope") == "duo"


def merge_duo_badges(*badge_lists: Iterable[dict]) -> List[dict]:
    """Fusionne listes de badges duo (historique + catalogue) sans doublon d'ID."""
    merged: Dict[str, dict] = {}
    for badges in badge_lists:
        for raw in badges or []:
            if not is_duo_category_badge(raw):
                continue
            cid = canonical_badge_id(raw.get("id"))
            if not cid:
                continue
            normalized = {
                **raw,
                "id": cid,
                "family": "duo",
                "category": raw.get("category") or "duo",
                "scope": "duo",
            }
            existing = merged.get(cid)
            if not existing:
                merged[cid] = normalized
                continue
            if normalized.get("unlocked") and not existing.get("unlocked"):
                merged[cid] = normalized
            elif normalized.get("unlocked") == existing.get("unlocked"):
                cur_n = normalized.get("current") or 0
                cur_e = existing.get("current") or 0
                if isinstance(cur_n, (int, float)) and isinstance(cur_e, (int, float)) and cur_n > cur_e:
                    merged[cid] = normalized
    return list(merged.values())


def badge_rarity_for(badge_id: str, target: int = 1) -> str:
    """Retourne le label FR de rareté (catalogue prioritaire)."""
    definition = get_badge_definition(badge_id)
    if definition:
        return RARITY_LABELS.get(definition.get("rarity", "common"), "Commun")
    if target >= 100:
        return "Légendaire"
    if target >= 50:
        return "Légendaire"
    if target >= 25:
        return "Épique"
    if target >= 10:
        return "Rare"
    return "Commun"


def catalog_badge_to_public(definition: dict, *, unlocked: bool = False, progress: Optional[dict] = None) -> dict:
    """Sérialise une définition catalogue vers le format API historique + v2."""
    rarity_key = definition.get("rarity") or "common"
    progress = progress or {}
    current = progress.get("current", 0)
    target = progress.get("target", definition.get("condition_value") or 1)
    if isinstance(target, dict):
        # conditions multiples — exposer tel quel
        percentage = progress.get("percentage", 0)
    else:
        try:
            t = float(target) if target else 1
            c = float(current) if isinstance(current, (int, float)) else 0
            percentage = progress.get("percentage")
            if percentage is None:
                percentage = min(100, round((c / t) * 100)) if t > 0 else (100 if unlocked else 0)
        except (TypeError, ZeroDivisionError):
            percentage = 0
    name = definition.get("name")
    description = definition.get("description")
    if definition.get("is_secret") and not unlocked:
        name = "Succès secret"
        description = "Continuez pour découvrir ce succès."
    return {
        "id": definition["id"],
        "name": name,
        "description": description,
        "icon": definition.get("icon_key") or "trophy",
        "icon_key": definition.get("icon_key") or "trophy",
        "family": definition.get("family") or definition.get("category") or definition.get("scope"),
        "scope": definition.get("scope"),
        "category": definition.get("category"),
        "rarity": RARITY_LABELS.get(rarity_key, "Commun"),
        "rarity_key": rarity_key,
        "unlocked": unlocked,
        "current": current,
        "target": target,
        "progress": percentage if not isinstance(percentage, dict) else percentage,
        "progress_detail": progress,
        "condition_type": definition.get("condition_type"),
        "condition_value": definition.get("condition_value"),
        "condition_params": definition.get("condition_params") or {},
        "reward_points": definition.get("reward_points", RARITY_POINTS.get(rarity_key, 10)),
        "is_secret": bool(definition.get("is_secret")),
        "enabled": bool(definition.get("enabled", True)),
        "sort_order": definition.get("sort_order", 0),
        "unlocked_at": progress.get("unlocked_at"),
        "version": definition.get("version", CATALOG_VERSION),
    }


# ─── Évaluateurs legacy (conservés pour ne pas casser les imports pendant la transition) ───
# Le moteur canonique est BadgeProgressService dans badge_progress.py.

from datetime import datetime, timedelta, timezone  # noqa: E402


def _badge(
    badge_id: str,
    name: str,
    description: str,
    icon: str,
    family: str,
    unlocked: bool,
    current: int = 0,
    target: int = 1,
    rarity: Optional[str] = None,
) -> dict:
    definition = get_badge_definition(badge_id)
    if definition:
        return catalog_badge_to_public(
            definition,
            unlocked=unlocked,
            progress={"current": current, "target": target},
        )
    resolved_rarity = rarity or badge_rarity_for(badge_id, target)
    return {
        "id": badge_id,
        "name": name,
        "description": description,
        "icon": icon,
        "icon_key": icon,
        "family": family,
        "scope": "duo" if family == "duo" or str(badge_id).startswith("duo_") else "solo",
        "rarity": resolved_rarity,
        "rarity_key": {
            "Commun": "common",
            "Rare": "rare",
            "Épique": "epic",
            "Super-héros": "superhero",
            "Légendaire": "legendary",
            "Diamant": "legendary",
        }.get(resolved_rarity, "common"),
        "unlocked": unlocked,
        "current": current,
        "target": target,
        "progress": min(100, round((current / target) * 100)) if target > 0 else (100 if unlocked else 0),
        "enabled": True,
        "is_secret": False,
    }


async def evaluate_all_badges(db, user_id: str, partner_id: Optional[str], streak_value: int) -> List[dict]:
    """Compatibilité : délègue au moteur de progression s'il est disponible."""
    try:
        from badge_progress import BadgeProgressService

        service = BadgeProgressService(db)
        result = await service.get_solo_catalog_with_progress(user_id, streak_value=streak_value)
        badges = result.get("badges") or []
        if partner_id:
            pair_key = "_".join(sorted([user_id, partner_id]))
            duo = await service.get_duo_catalog_with_progress(pair_key)
            # Ancien comportement : stats duo mélangeaient solo+duo
            badges = badges + (duo.get("badges") or [])
        return badges
    except Exception:
        # Fallback minimal si le moteur n'est pas encore chargé
        return [
            catalog_badge_to_public(b, unlocked=False, progress={"current": 0, "target": b.get("condition_value") or 1})
            for b in get_catalog("solo", include_disabled=False)
        ]


async def find_badge_for_user(
    db, user_id: str, partner_id: Optional[str], streak_value: int, badge_id: str
) -> Optional[dict]:
    cid = canonical_badge_id(badge_id)
    definition = get_badge_definition(cid)
    if not definition:
        return None
    badges = await evaluate_all_badges(db, user_id, partner_id, streak_value)
    for badge in badges:
        if badge.get("id") == cid or canonical_badge_id(badge.get("id")) == cid:
            return badge
    # Badge hors scope évalué — retourner définition verrouillée
    return catalog_badge_to_public(definition, unlocked=False)


DUO_SOCIAL_BADGE_DEFS = [
    ("duo_together_first", "Première séance ensemble", "Votre première séance commune", "heart", 1, "Commun"),
    ("duo_streak_7", "7 jours streak duo", "7 jours consécutifs à vous entraîner ensemble", "flame", 7, "Rare"),
    ("duo_streak_30", "30 jours streak duo", "30 jours consécutifs ensemble", "zap", 30, "Épique"),
    ("duo_challenge_week", "Défi semaine duo", "Défi hebdomadaire réussi en duo", "target", 1, "Rare"),
    ("duo_regular", "Duo régulier", "15 jours d'entraînement ensemble", "users", 15, "Épique"),
    ("duo_legendary", "Duo légendaire", "50 séances communes", "crown", 50, "Légendaire"),
]


async def evaluate_duo_social_badges(db, user_a_id: str, user_b_id: str, together_stats: dict) -> List[dict]:
    """Compatibilité : badges duo via le moteur canonique."""
    try:
        from badge_progress import BadgeProgressService

        pair_key = "_".join(sorted([user_a_id, user_b_id]))
        service = BadgeProgressService(db)
        result = await service.get_duo_catalog_with_progress(pair_key)
        return result.get("badges") or []
    except Exception:
        return [
            catalog_badge_to_public(b, unlocked=False, progress={"current": 0, "target": b.get("condition_value") or 1})
            for b in get_catalog("duo", include_disabled=False)
        ]


__all__ = [
    "ALL_BADGES",
    "BADGE_BY_ID",
    "BADGE_CATEGORY_ALIASES",
    "BADGE_ID_ALIASES",
    "CATALOG_VERSION",
    "DUO_BADGES",
    "DUO_SOCIAL_BADGE_DEFS",
    "LEGACY_BADGE_ID_MAP",
    "LEGACY_ORPHAN_BADGE_IDS",
    "RARITY_LABELS",
    "RARITY_POINTS",
    "SOLO_BADGES",
    "badge_rarity_for",
    "canonical_badge_id",
    "catalog_badge_to_public",
    "evaluate_all_badges",
    "evaluate_duo_social_badges",
    "find_badge_for_user",
    "get_badge_definition",
    "get_catalog",
    "is_duo_category_badge",
    "merge_duo_badges",
    "normalize_badge_category",
    "rarity_summary",
    "validate_catalog",
]

"""Recherche paginée sur exercise_catalog (texte normalisé + pertinence)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .catalog import CATALOG_COLLECTION, catalog_to_legacy_response, localized_text
from .media_proxy import resolve_media_for_client
from .taxonomy import fold_text

# Marqueurs typiques de variantes (pénalisent le score « mouvement simple »).
_VARIANT_MARKERS = (
    "archer",
    "diamond",
    "incline",
    "decline",
    "close",
    "wide",
    "narrow",
    "assisted",
    "weighted",
    "band",
    "elastique",
    "avec",
    "with",
    "prise",
    "grip",
    "knee",
    "genou",
    "clap",
    "explosive",
    "plyo",
    "deficit",
    "pause",
    "tempo",
    "unilateral",
    "single",
    "alternat",
    "sumo",
    "front",
    "back",
    "hack",
    "bulgarian",
    "machine",
    "cable",
    "smith",
)


def _escape_regex(value: str) -> str:
    return re.escape(value)


def query_variants(token: str) -> Set[str]:
    """Variantes singulier/pluriel naturelles (FR/EN/ES) pour un token plié."""
    t = (token or "").strip()
    if not t:
        return set()
    variants = {t}
    if t.endswith("s") and len(t) > 2:
        variants.add(t[:-1])
    else:
        variants.add(f"{t}s")
    # Pluriels FR en -x (ex. haltère → déjà couvert via aliases doc).
    if t.endswith("x") and len(t) > 2:
        variants.add(t[:-1])
    return {v for v in variants if v}


def _alias_list(doc: Dict[str, Any]) -> List[str]:
    raw = doc.get("aliases") or []
    out: List[str] = []
    if isinstance(raw, dict):
        for values in raw.values():
            if isinstance(values, list):
                out.extend([str(v) for v in values if v])
            elif values:
                out.append(str(values))
    elif isinstance(raw, list):
        out.extend([str(v) for v in raw if v])
    return out


def _name_forms(doc: Dict[str, Any], locale: str) -> Tuple[str, List[str]]:
    name_obj = doc.get("name") if isinstance(doc.get("name"), dict) else {}
    localized = fold_text(localized_text(doc.get("name"), locale) or "")
    forms: List[str] = []
    for key in (locale, "fr", "en", "es"):
        lang = (key or "fr").split("-")[0].lower()
        if isinstance(name_obj, dict) and name_obj.get(lang):
            forms.append(fold_text(str(name_obj.get(lang))))
        elif key == locale and localized:
            forms.append(localized)
    if doc.get("provider_name"):
        forms.append(fold_text(str(doc.get("provider_name"))))
    # Dédupliquer en conservant l'ordre
    seen = set()
    uniq: List[str] = []
    for n in forms:
        if n and n not in seen:
            seen.add(n)
            uniq.append(n)
    return localized, uniq


def _is_simple_canonical(name: str, variants: Set[str]) -> bool:
    if not name:
        return False
    if name in variants:
        return True
    words = name.split()
    if len(words) == 1:
        return any(name == v or name.startswith(v) or v.startswith(name) for v in variants)
    if len(words) <= 2 and any(w in variants for w in words):
        # Ex. "pompes classiques" vs "pompes archer"
        joined = " ".join(words)
        if any(m in joined for m in _VARIANT_MARKERS):
            return False
        return True
    return False


def relevance_score(doc: Dict[str, Any], token: str, locale: str = "fr") -> int:
    """
    Score de pertinence générique (plus haut = mieux) :
    1) nom localisé exact
    2) alias exact
    3) nom commence par la recherche
    4) mouvement canonique simple
    5) nom contient
    6) matériel / muscle contient
    7) autres (search_text)
    """
    variants = query_variants(fold_text(token))
    if not variants:
        return 0

    localized, all_names = _name_forms(doc, locale)
    aliases = [fold_text(a) for a in _alias_list(doc)]
    equip = [fold_text(str(e)) for e in (doc.get("equipment") or [])]
    muscles = [
        fold_text(str(m))
        for m in (list(doc.get("primary_muscles") or []) + list(doc.get("secondary_muscles") or []))
    ]
    search_text = fold_text(doc.get("search_text") or "")

    # 1) nom localisé exact
    if localized and localized in variants:
        return 1000
    # exact autre langue (recherche EN/ES)
    if any(n in variants for n in all_names):
        return 980

    # 2) alias exact
    if any(a in variants for a in aliases):
        return 900

    # 3) nom commence par
    if any(any(n.startswith(v) for v in variants) for n in all_names if n):
        # 4) bonus mouvement simple si le nom reste court / canonique
        if localized and _is_simple_canonical(localized, variants):
            return 860
        return 800

    # 4) mouvement canonique simple (égalité approximative)
    if localized and _is_simple_canonical(localized, variants):
        return 750

    # 5) nom contient
    if any(any(v in n for v in variants) for n in all_names if n):
        # Pénalité légère pour variantes longues
        penalty = 0
        if localized and any(m in localized for m in _VARIANT_MARKERS):
            penalty = 40
        # Noms plus courts = plus « simples »
        length_bonus = max(0, 30 - len((localized or "").split()) * 8)
        return 600 + length_bonus - penalty

    # 6) matériel / muscle
    if any(any(v in field for v in variants) for field in equip + muscles if field):
        return 400

    # 7) search_text / autres
    if any(v in search_text for v in variants):
        return 200

    return 0


def _sort_key(doc: Dict[str, Any], token: Optional[str], locale: str) -> Tuple:
    name = fold_text(localized_text(doc.get("name"), locale) or doc.get("provider_name") or "")
    if token:
        return (-relevance_score(doc, token, locale), len(name), name, doc.get("id") or "")
    return (name, doc.get("id") or "")


async def search_catalog(
    db,
    *,
    q: Optional[str] = None,
    sport: Optional[str] = None,
    category: Optional[str] = None,
    body_part: Optional[str] = None,
    muscle: Optional[str] = None,
    equipment: Optional[str] = None,
    tracking_type: Optional[str] = None,
    has_media: Optional[bool] = None,
    page: int = 1,
    limit: int = 10,
    locale: str = "fr",
    include_disabled: bool = False,
) -> Dict[str, Any]:
    page = max(1, int(page or 1))
    limit = max(1, min(int(limit or 10), 40))
    query: Dict[str, Any] = {}
    if not include_disabled:
        query["enabled"] = True

    and_clauses: List[Dict[str, Any]] = []
    token = fold_text(q) if q else ""
    variants = query_variants(token) if token else set()
    if variants:
        and_clauses.append(
            {
                "$or": [
                    {"search_text": {"$regex": _escape_regex(v)}} for v in sorted(variants)
                ]
            }
        )
    if sport:
        and_clauses.append({"sport": sport})
    if category:
        and_clauses.append({"category": category})
    if body_part:
        and_clauses.append({"body_part": body_part})
    if muscle:
        and_clauses.append(
            {
                "$or": [
                    {"primary_muscles": muscle},
                    {"secondary_muscles": muscle},
                    {"category": muscle},
                ]
            }
        )
    if equipment:
        if equipment in ("selectorized_machine", "plate_loaded_machine", "machine"):
            and_clauses.append(
                {
                    "equipment": {
                        "$in": [
                            "selectorized_machine",
                            "plate_loaded_machine",
                            "leg_press_machine",
                            "hack_squat_machine",
                            "chest_press_machine",
                            "shoulder_press_machine",
                            "lat_pulldown_machine",
                            "seated_row_machine",
                            "leg_extension_machine",
                            "leg_curl_machine",
                            "adductor_machine",
                            "abductor_machine",
                            "calf_raise_machine",
                            "pec_deck_machine",
                            "reverse_fly_machine",
                            "assisted_dip_machine",
                            "assisted_pullup_machine",
                            "smith_machine",
                        ]
                    }
                }
            )
        else:
            and_clauses.append({"equipment": equipment})
    if tracking_type:
        and_clauses.append({"tracking_type": tracking_type})
    if has_media is True:
        and_clauses.append({"media.status": "available"})
    elif has_media is False:
        and_clauses.append({"media.status": {"$ne": "available"}})

    if and_clauses:
        query["$and"] = and_clauses

    col = db[CATALOG_COLLECTION]
    total = await col.count_documents(query)
    skip = (page - 1) * limit

    if token:
        # Récupérer les correspondances (plafond) puis trier par pertinence.
        fetch_cap = min(max(total, 0), 500)
        cursor = col.find(query).limit(fetch_cap)
        docs = await cursor.to_list(fetch_cap)
        docs.sort(key=lambda d: _sort_key(d, token, locale))
        page_docs = docs[skip : skip + limit]
    else:
        cursor = col.find(query).sort([("name.en", 1), ("id", 1)]).skip(skip).limit(limit)
        page_docs = await cursor.to_list(limit)

    items = []
    for doc in page_docs:
        item = catalog_to_legacy_response(doc, locale=locale)
        media_url = (doc.get("media") or {}).get("url")
        resolved = resolve_media_for_client(media_url, doc.get("id"))
        if resolved:
            item["image_url"] = resolved
        items.append(item)
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": skip + len(items) < total,
    }


async def catalog_facets(db) -> Dict[str, Any]:
    col = db[CATALOG_COLLECTION]
    match = {"enabled": True}

    async def _distinct(field: str) -> List[str]:
        values = await col.distinct(field, match)
        return sorted([v for v in values if v])

    return {
        "sports": await _distinct("sport"),
        "categories": await _distinct("category"),
        "equipment": await _distinct("equipment"),
        "body_parts": await _distinct("body_part"),
        "muscles": await _distinct("primary_muscles"),
        "tracking_types": await _distinct("tracking_type"),
    }

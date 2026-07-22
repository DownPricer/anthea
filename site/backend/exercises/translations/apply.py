"""Application des traductions sur le catalogue existant."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..catalog import CATALOG_COLLECTION, build_search_text
from ..taxonomy import fold_text
from .engine import (
    build_aliases,
    build_short_description,
    translate_label,
    translate_name,
)

QA_SAMPLES = [
    "push-up",
    "pull-up",
    "bench press",
    "incline dumbbell press",
    "barbell squat",
    "romanian deadlift",
    "leg press",
    "leg extension",
    "lat pulldown",
    "seated row",
    "cable lateral raise",
    "dumbbell biceps curl",
    "triceps pushdown",
    "hip thrust",
    "glute bridge",
    "plank",
    "crunch",
    "calf raise",
    "hamstring stretch",
    "smith machine squat",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def localize_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Retourne une copie localisée (IDs / media inchangés)."""
    out = dict(doc)
    name_obj = doc.get("name") if isinstance(doc.get("name"), dict) else {}
    provider_name = (
        doc.get("provider_name")
        or name_obj.get("en")
        or (doc.get("name") if isinstance(doc.get("name"), str) else None)
        or ""
    )
    provider_name = str(provider_name).strip()
    en_name = translate_name(provider_name, "en") or provider_name
    fr_name = translate_name(provider_name, "fr") or en_name
    es_name = translate_name(provider_name, "es") or en_name

    sport = doc.get("sport") or "strength"
    equipment = list(doc.get("equipment") or [])
    muscles = list(doc.get("primary_muscles") or [])

    desc_en = build_short_description(sport=sport, equipment=equipment, primary_muscles=muscles, lang="en")
    desc_fr = build_short_description(sport=sport, equipment=equipment, primary_muscles=muscles, lang="fr")
    desc_es = build_short_description(sport=sport, equipment=equipment, primary_muscles=muscles, lang="es")

    aliases = build_aliases(en_name, fr_name, es_name)
    # Enrichir aliases avec libellés matériel/muscles
    for lang in ("en", "fr", "es"):
        for eq in equipment:
            aliases[lang].append(translate_label("equipment", eq, lang))
        for m in muscles:
            aliases[lang].append(translate_label("muscles", m, lang))
        aliases[lang] = sorted({fold_text(a) for a in aliases[lang] if a})

    out["provider_name"] = provider_name
    out["name"] = {"en": en_name, "fr": fr_name, "es": es_name}
    out["short_description"] = {"en": desc_en, "fr": desc_fr, "es": desc_es}
    out["aliases"] = aliases
    out["translation_status"] = {
        "en": "complete" if en_name else "missing",
        "fr": "complete" if fr_name else "missing",
        "es": "complete" if es_name else "missing",
    }
    source = dict(out.get("source") or {})
    source["raw_name"] = provider_name
    out["source"] = source
    out["search_text"] = build_search_text(out)
    out["updated_at"] = _now()
    return out


def build_translation_coverage(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    names = {"en": 0, "fr": 0, "es": 0}
    descriptions = {"en": 0, "fr": 0, "es": 0}
    search_ok = 0
    missing: List[str] = []
    partial = 0
    qa = []

    folded_index = {}
    for doc in docs:
        name = doc.get("name") or {}
        desc = doc.get("short_description") or {}
        for lang in ("en", "fr", "es"):
            if isinstance(name, dict) and name.get(lang):
                names[lang] += 1
            if isinstance(desc, dict) and desc.get(lang):
                descriptions[lang] += 1
        if doc.get("search_text"):
            search_ok += 1
        status = doc.get("translation_status") or {}
        if isinstance(status, dict):
            vals = [status.get("en"), status.get("fr"), status.get("es")]
            if any(v != "complete" for v in vals):
                partial += 1
                missing.append(doc.get("id") or "?")
        en = (name.get("en") if isinstance(name, dict) else "") or ""
        folded_index[fold_text(en)] = doc
        provider = fold_text(doc.get("provider_name") or "")
        if provider:
            folded_index.setdefault(provider, doc)

    preferred_prefix = (
        "barbell ",
        "dumbbell ",
        "cable ",
        "smith ",
        "lever ",
        "band ",
        "resistance band ",
    )

    # Alias QA → noms réels du catalogue ExerciseDB
    qa_aliases = {
        "incline dumbbell press": [
            "dumbbell incline bench press",
            "dumbbell incline press",
            "incline dumbbell bench press",
            "dumbbell incline fly",
        ],
        "smith machine squat": ["smith squat", "smith machine squat"],
        "bench press": ["barbell bench press", "dumbbell bench press", "bench press"],
        "crunch": ["crunch floor", "reverse crunch", "crunch"],
        "plank": ["front plank with twist", "weighted front plank", "power point plank", "plank"],
        "calf raise": ["lever seated calf raise", "barbell floor calf raise", "calf raise"],
        "hip thrust": ["resistance band hip thrusts on knees", "hip thrust"],
        "glute bridge": ["barbell glute bridge", "glute bridge march", "glute bridge"],
        "leg press": ["lever alternate leg press", "smith leg press", "leg press"],
    }

    def _pick_qa_doc(sample: str):
        key = fold_text(sample)
        for alias in qa_aliases.get(sample, [sample]):
            exact = folded_index.get(fold_text(alias))
            if exact:
                return exact
        exact = folded_index.get(key)
        if exact:
            return exact
        for d in docs:
            n = d.get("name") or {}
            for lang in ("fr", "es", "en"):
                if fold_text(n.get(lang) or "") == key:
                    return d
        candidates = []
        for d in docs:
            en = fold_text(((d.get("name") or {}).get("en") or ""))
            provider = fold_text(d.get("provider_name") or "")
            hay = f"{en} {provider}"
            if key not in hay and not any(fold_text(a) in hay for a in qa_aliases.get(sample, [])):
                continue
            score = len(en)
            if en == key:
                score -= 1000
            elif en.startswith(key) or en.endswith(key):
                score -= 400
            elif f" {key} " in f" {en} ":
                score -= 300
            for i, pref in enumerate(preferred_prefix):
                pref_f = fold_text(pref)
                if en.startswith(pref_f) and key in en:
                    score -= 80 - i * 5
            # Pénaliser préfixes « band/cable » pour recherches génériques type bench press
            if sample in ("bench press", "squat", "deadlift") and (
                en.startswith("band ") or en.startswith("cable ")
            ):
                score += 120
            candidates.append((score, len(en), d))
        if not candidates:
            return None
        candidates.sort(key=lambda x: (x[0], x[1]))
        return candidates[0][2]

    for sample in QA_SAMPLES:
        doc = _pick_qa_doc(sample)
        if not doc:
            qa.append({"query": sample, "found": False})
            continue
        n = doc.get("name") or {}
        d = doc.get("short_description") or {}
        qa.append(
            {
                "query": sample,
                "found": True,
                "id": doc.get("id"),
                "en": n.get("en"),
                "fr": n.get("fr"),
                "es": n.get("es"),
                "description_en": d.get("en"),
                "description_fr": d.get("fr"),
                "description_es": d.get("es"),
            }
        )

    return {
        "total": len(docs),
        "names": names,
        "descriptions": descriptions,
        "search_text": search_ok,
        "partial_translations": partial,
        "missing_translations": missing[:50],
        "qa_samples": qa,
        "generated_at": _now(),
    }


def apply_translations_to_catalog(
    db,
    *,
    dry_run: bool = True,
    report_path: Optional[Path] = None,
) -> Dict[str, Any]:
    col = db[CATALOG_COLLECTION]
    examined = 0
    updated = 0
    unchanged = 0
    localized_docs: List[Dict[str, Any]] = []
    stats = {
        "names_en": 0,
        "names_fr": 0,
        "names_es": 0,
        "desc_en": 0,
        "desc_fr": 0,
        "desc_es": 0,
        "search_text_rebuilt": 0,
    }

    for doc in col.find({}):
        examined += 1
        localized = localize_document(doc)
        localized_docs.append(localized)
        for lang in ("en", "fr", "es"):
            if (localized.get("name") or {}).get(lang):
                stats[f"names_{lang}"] += 1
            if (localized.get("short_description") or {}).get(lang):
                stats[f"desc_{lang}"] += 1
        stats["search_text_rebuilt"] += 1

        changed = (
            doc.get("name") != localized.get("name")
            or doc.get("short_description") != localized.get("short_description")
            or doc.get("aliases") != localized.get("aliases")
            or doc.get("search_text") != localized.get("search_text")
            or doc.get("translation_status") != localized.get("translation_status")
        )
        if not changed:
            unchanged += 1
            continue
        updated += 1
        if not dry_run:
            col.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "provider_name": localized.get("provider_name"),
                        "name": localized.get("name"),
                        "short_description": localized.get("short_description"),
                        "aliases": localized.get("aliases"),
                        "translation_status": localized.get("translation_status"),
                        "search_text": localized.get("search_text"),
                        "source": localized.get("source"),
                        "updated_at": localized.get("updated_at"),
                    }
                },
            )

    coverage = build_translation_coverage(localized_docs)
    report = {
        "examined": examined,
        "updated": updated,
        "unchanged": unchanged,
        "dry_run": dry_run,
        "stats": stats,
        "coverage": coverage,
        "new": 0,
        "errors": 0,
    }
    if report_path is not None and not dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(coverage, indent=2, ensure_ascii=False), encoding="utf-8")
    elif report_path is not None and dry_run:
        # Écrire aussi en dry-run pour inspection locale (pas de médias)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(coverage, indent=2, ensure_ascii=False), encoding="utf-8")
    return report

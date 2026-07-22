"""Pipeline de traduction déterministe des noms d'exercices."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..taxonomy import fold_text

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "exercises" / "translations"

_EQUIPMENT_LEAD = [
    "resistance band",
    "ez barbell",
    "ez-barbell",
    "ez bar",
    "medicine ball",
    "stability ball",
    "swiss ball",
    "exercise ball",
    "smith machine",
    "leverage machine",
    "body weight",
    "bodyweight",
    "dumbbell",
    "barbell",
    "kettlebell",
    "cable",
    "band",
    "lever",
    "sled",
    "smith",
    "machine",
    "rope",
    "plate",
]

_EQUIP_PREP = {
    "fr": {
        "haltères": "avec haltères",
        "barre": "à la barre",
        "barre EZ": "à la barre EZ",
        "poulie": "à la poulie",
        "élastique": "à l'élastique",
        "kettlebell": "avec kettlebell",
        "machine": "à la machine",
        "smith": "smith",
        "smith machine": "smith machine",
        "traîneau": "au traîneau",
        "corde": "à la corde",
        "disque": "avec disque",
        "poids du corps": "au poids du corps",
        "medecine ball": "avec medecine ball",
        "swiss ball": "avec swiss ball",
        "Bosu": "avec Bosu",
    },
    "es": {
        "mancuernas": "con mancuernas",
        "barra": "con barra",
        "barra EZ": "con barra EZ",
        "polea": "en polea",
        "banda": "con banda",
        "banda elástica": "con banda elástica",
        "pesa rusa": "con pesa rusa",
        "máquina": "en máquina",
        "smith": "en smith",
        "máquina smith": "en smith",
        "trineo": "con trineo",
        "cuerda": "con cuerda",
        "disco": "con disco",
        "peso corporal": "con peso corporal",
        "balón medicinal": "con balón medicinal",
        "pelota de estabilidad": "con pelota de estabilidad",
        "Bosu": "con Bosu",
    },
}

_MUSCLE_PHRASE = {
    "fr": {
        "abdominals": "les abdominaux",
        "quadriceps": "les quadriceps",
        "back": "le dos",
        "calves": "les mollets",
        "chest": "les pectoraux",
        "glutes": "les fessiers",
        "hamstrings": "les ischio-jambiers",
        "adductors": "les adducteurs",
        "triceps": "les triceps",
        "full_body": "le corps entier",
        "lower_back": "le bas du dos",
        "biceps": "les biceps",
        "shoulders": "les épaules",
        "forearms": "les avant-bras",
        "traps": "les trapèzes",
        "abductors": "les abducteurs",
        "neck": "le cou",
    },
    "es": {
        "abdominals": "los abdominales",
        "quadriceps": "los cuádriceps",
        "back": "la espalda",
        "calves": "los gemelos",
        "chest": "el pecho",
        "glutes": "los glúteos",
        "hamstrings": "los isquiotibiales",
        "adductors": "los aductores",
        "triceps": "los tríceps",
        "full_body": "el cuerpo completo",
        "lower_back": "la zona lumbar",
        "biceps": "los bíceps",
        "shoulders": "los hombros",
        "forearms": "los antebrazos",
        "traps": "los trapecios",
        "abductors": "los abductores",
        "neck": "el cuello",
    },
    "en": {
        "abdominals": "the abdominals",
        "quadriceps": "the quadriceps",
        "back": "the back",
        "calves": "the calves",
        "chest": "the chest",
        "glutes": "the glutes",
        "hamstrings": "the hamstrings",
        "adductors": "the adductors",
        "triceps": "the triceps",
        "full_body": "the full body",
        "lower_back": "the lower back",
        "biceps": "the biceps",
        "shoulders": "the shoulders",
        "forearms": "the forearms",
        "traps": "the traps",
        "abductors": "the abductors",
        "neck": "the neck",
    },
}


@lru_cache(maxsize=1)
def _load_json(name: str) -> Dict[str, Any]:
    path = DATA_DIR / name
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_terms() -> Dict[str, Dict[str, str]]:
    return _load_json("exercise_terms.json")


def load_overrides() -> Dict[str, Dict[str, str]]:
    return _load_json("exercise_name_overrides.json")


def load_taxonomy_labels() -> Dict[str, Any]:
    return _load_json("taxonomy_labels.json")


def strip_useless_suffixes(name: str) -> str:
    cleaned = re.sub(r"\s*\((male|female)\)\s*", " ", name, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


def _title_case_locale(text: str, lang: str) -> str:
    if not text:
        return text
    return text[:1].upper() + text[1:]


def translate_label(kind: str, key: str, lang: str) -> str:
    labels = load_taxonomy_labels().get(kind) or {}
    entry = labels.get(key) or {}
    if isinstance(entry, dict):
        return entry.get(lang) or entry.get("en") or key.replace("_", " ")
    return str(key).replace("_", " ")


def _extract_leading_equipment(english: str) -> Tuple[Optional[str], str]:
    lowered = english.lower().strip()
    for eq in sorted(_EQUIPMENT_LEAD, key=len, reverse=True):
        if lowered == eq:
            return eq, ""
        if lowered.startswith(eq + " "):
            return eq, english[len(eq) :].strip()
    return None, english


def _apply_terms(text: str, lang: str) -> str:
    terms = load_terms()
    ordered = sorted(terms.items(), key=lambda kv: len(kv[0]), reverse=True)
    working = text
    for phrase, langs in ordered:
        if not isinstance(langs, dict) or not langs.get(lang):
            continue
        # Limites de mot : éviter que « press » mange « presse »
        pattern = re.compile(
            rf"(?<![A-Za-zÀ-ÿ0-9]){re.escape(phrase)}(?![A-Za-zÀ-ÿ0-9])",
            re.IGNORECASE,
        )
        if pattern.search(working):
            working = pattern.sub(langs[lang], working)
    return re.sub(r"\s+", " ", working).strip(" -")


def _append_equipment(movement: str, equipment_en: str, lang: str) -> str:
    if not equipment_en:
        return movement
    eq_label = _apply_terms(equipment_en, lang) or equipment_en
    prep_map = _EQUIP_PREP.get(lang) or {}
    for key, prep in sorted(prep_map.items(), key=lambda kv: len(kv[0]), reverse=True):
        if fold_text(eq_label) == fold_text(key) or fold_text(eq_label).startswith(fold_text(key)):
            if fold_text(prep) in fold_text(movement):
                return movement
            return f"{movement} {prep}".strip()
    if lang == "fr":
        return f"{movement} avec {eq_label}".strip()
    if lang == "es":
        return f"{movement} con {eq_label}".strip()
    return f"{equipment_en} {movement}".strip()


def translate_name(english_name: str, lang: str) -> str:
    """Traduit un nom EN → fr|es de façon déterministe (expressions longues d'abord)."""
    if lang == "en":
        return strip_useless_suffixes(english_name).strip()

    base = strip_useless_suffixes(english_name or "").strip()
    if not base:
        return base

    overrides = load_overrides()
    folded = fold_text(base)
    for key, langs in overrides.items():
        if fold_text(key) == folded and isinstance(langs, dict) and langs.get(lang):
            return _title_case_locale(langs[lang], lang)

    equipment_en, remainder = _extract_leading_equipment(base)
    if equipment_en and remainder:
        translated_core = _apply_terms(remainder, lang)
        working = _append_equipment(translated_core, equipment_en, lang)
    else:
        working = _apply_terms(base, lang)

    working = re.sub(r"\s+", " ", working).strip(" -")
    if not working:
        working = base
    return _title_case_locale(working, lang)


def build_aliases(english_name: str, fr_name: str, es_name: str) -> Dict[str, List[str]]:
    aliases: Dict[str, List[str]] = {"en": [], "fr": [], "es": []}
    en = strip_useless_suffixes(english_name)
    for lang, value in (("en", en), ("fr", fr_name), ("es", es_name)):
        folded = fold_text(value)
        extras = {value, folded, value.replace("-", " "), value.replace(" ", "-")}
        if value and fold_text(value) != fold_text(en):
            extras.add(value)
        aliases[lang] = sorted({a.strip() for a in extras if a})
    return aliases


def _muscle_phrase(key: str, lang: str) -> str:
    bag = _MUSCLE_PHRASE.get(lang) or {}
    if key in bag:
        return bag[key]
    return translate_label("muscles", key, lang)


def build_short_description(
    *,
    sport: str,
    equipment: List[str],
    primary_muscles: List[str],
    lang: str,
) -> str:
    sport_label = translate_label("sports", sport or "strength", lang)
    muscle_keys = primary_muscles[:2] or ["full_body"]
    muscle_txt = ", ".join(_muscle_phrase(m, lang) for m in muscle_keys)
    equip_keys = equipment[:2] or ["bodyweight"]
    equip_txt = ", ".join(translate_label("equipment", e, lang) for e in equip_keys)
    is_bodyweight = sport == "bodyweight" or (
        len(equipment) == 1 and equipment[0] == "bodyweight"
    ) or equipment == ["bodyweight"]

    if lang == "fr":
        if sport in ("stretching", "mobility"):
            return f"Étirement ciblant principalement {muscle_txt}."
        if is_bodyweight:
            return f"Exercice au poids du corps ciblant principalement {muscle_txt}."
        return (
            f"Exercice de {sport_label} réalisé avec {equip_txt}, "
            f"ciblant principalement {muscle_txt}."
        )
    if lang == "es":
        if sport in ("stretching", "mobility"):
            return f"Estiramiento dirigido principalmente a {muscle_txt}."
        if is_bodyweight:
            return f"Ejercicio con el peso corporal que trabaja principalmente {muscle_txt}."
        return (
            f"Ejercicio de {sport_label} realizado con {equip_txt}, "
            f"que trabaja principalmente {muscle_txt}."
        )
    if sport in ("stretching", "mobility"):
        return f"A stretching exercise primarily targeting {muscle_txt}."
    if is_bodyweight:
        return f"A bodyweight exercise primarily targeting {muscle_txt}."
    return (
        f"A {sport_label} exercise performed with {equip_txt}, "
        f"primarily targeting {muscle_txt}."
    )

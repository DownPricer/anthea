"""
Exercices + modèles de séance « volume » (lun–ven).
Seed idempotent : n’ajoute que ce qui manque (nom d’exercice / slug de modèle).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Chaque dict = un exercice système (sans is_system ni created_at)
PROGRAM_EXERCISES: list[dict[str, Any]] = [
    {
        "name": "Développé couché haltères",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 8,
        "default_rest": 90,
        "description": "4 × 6–10. Pecs + triceps long.",
        "image_url": None,
    },
    {
        "name": "Développé incliné haltères",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 75,
        "description": "3 × 8–12. Haut des pecs.",
        "image_url": None,
    },
    {
        "name": "Développé serré haltères",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 75,
        "description": "3 × 8–12. Pecs serrées / triceps.",
        "image_url": None,
    },
    {
        "name": "Extension triceps au-dessus de la tête",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 12,
        "default_rest": 60,
        "description": "3 × 10–15. Triceps long.",
        "image_url": None,
    },
    {
        "name": "Pompes diamant lestées",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 12,
        "default_rest": 60,
        "description": "2 × max propre. Triceps + pecs serrées.",
        "image_url": None,
    },
    {
        "name": "Élévations latérales",
        "category": "shoulders",
        "exercise_type": "reps",
        "default_reps": 20,
        "default_rest": 45,
        "description": "3 × 15–25. Deltoïdes latéraux.",
        "image_url": None,
    },
    {
        "name": "Tractions pronation lestées",
        "category": "back",
        "exercise_type": "reps",
        "default_reps": 8,
        "default_rest": 90,
        "description": "4 × 6–10. Dos large pronation.",
        "image_url": None,
    },
    {
        "name": "Tractions supination lestées",
        "category": "back",
        "exercise_type": "reps",
        "default_reps": 8,
        "default_rest": 75,
        "description": "3 × 6–10. Biceps + dos.",
        "image_url": None,
    },
    {
        "name": "Rowing haltères poitrine appuyée",
        "category": "back",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 75,
        "description": "3 × 8–12. Épaisseur du dos.",
        "image_url": None,
    },
    {
        "name": "Curl incliné",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 60,
        "description": "4 × 8–12. Bras long.",
        "image_url": None,
    },
    {
        "name": "Curl concentration bras gauche priorité",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 12,
        "default_rest": 60,
        "description": "3 × 10–15. Commence bras gauche.",
        "image_url": None,
    },
    {
        "name": "Reverse curl",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 15,
        "default_rest": 45,
        "description": "3 × 12–20. Avant-bras / extenseurs.",
        "image_url": None,
    },
    {
        "name": "Dead hang",
        "category": "back",
        "exercise_type": "duration",
        "default_duration": 40,
        "default_rest": 60,
        "description": "2 × 30–45 s. Suspension passive.",
        "image_url": None,
    },
    {
        "name": "Curl incliné léger contrôlé",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 14,
        "default_rest": 50,
        "description": "3 × 12–15. Temps sous tension.",
        "image_url": None,
    },
    {
        "name": "Curl spider",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 14,
        "default_rest": 50,
        "description": "3 × 12–15. Buste appuyé sur banc.",
        "image_url": None,
    },
    {
        "name": "Curl concentration lourd",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 60,
        "description": "3 × 8–12. Charge plus lourde.",
        "image_url": None,
    },
    {
        "name": "Pompes serrées",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 15,
        "default_rest": 60,
        "description": "2 × proche de l’échec. Triceps.",
        "image_url": None,
    },
    {
        "name": "Farmer walk",
        "category": "full",
        "exercise_type": "duration",
        "default_duration": 40,
        "default_rest": 90,
        "description": "3 × 40 s. Prise ferme, aller droit.",
        "image_url": None,
    },
    {
        "name": "Bulgarian split squat",
        "category": "lower",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 90,
        "description": "4 × 8–12. Par jambe ou alterné.",
        "image_url": None,
    },
    {
        "name": "RDL haltères",
        "category": "lower",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 90,
        "description": "4 × 8–12. Ischio-jambiers, dos neutre.",
        "image_url": None,
    },
    {
        "name": "Mollets debout",
        "category": "lower",
        "exercise_type": "reps",
        "default_reps": 20,
        "default_rest": 45,
        "description": "5 × 15–25. Amplitude complète.",
        "image_url": None,
    },
    {
        "name": "Abdos trois séries",
        "category": "core",
        "exercise_type": "reps",
        "default_reps": 20,
        "default_rest": 45,
        "description": "3 séries au choix (crunch, relevé, etc.).",
        "image_url": None,
    },
    {
        "name": "Tractions larges",
        "category": "back",
        "exercise_type": "reps",
        "default_reps": 8,
        "default_rest": 90,
        "description": "4 × 6–10. Prise large.",
        "image_url": None,
    },
    {
        "name": "Pull-over haltère",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 14,
        "default_rest": 60,
        "description": "3 × 12–15. Grand dorsal + serratus.",
        "image_url": None,
    },
    {
        "name": "Rowing haltère unilatéral",
        "category": "back",
        "exercise_type": "reps",
        "default_reps": 12,
        "default_rest": 70,
        "description": "3 × 10–15. Dos / biceps.",
        "image_url": None,
    },
    {
        "name": "Développé couché modéré",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 10,
        "default_rest": 75,
        "description": "3 × 8–12. Charge modérée, maintien pecs.",
        "image_url": None,
    },
    {
        "name": "Curl concentration fin de séance",
        "category": "arms",
        "exercise_type": "reps",
        "default_reps": 15,
        "default_rest": 45,
        "description": "Superset : 2 × 15.",
        "image_url": None,
    },
    {
        "name": "Pompes diamant fin de séance",
        "category": "chest",
        "exercise_type": "reps",
        "default_reps": 15,
        "default_rest": 45,
        "description": "Superset : 2 × max propre.",
        "image_url": None,
    },
]


WEEK_TEMPLATES: list[dict[str, Any]] = [
    {
        "program_order": 0,
        "slug": "volume-lundi",
        "title": "Lundi — Pecs + Triceps",
        "description": "Volume haut du corps (pecs + triceps). Viser 60–75 min.",
        "difficulty": "hard",
        "exercise_names": [
            "Développé couché haltères",
            "Développé incliné haltères",
            "Développé serré haltères",
            "Extension triceps au-dessus de la tête",
            "Pompes diamant lestées",
            "Élévations latérales",
        ],
    },
    {
        "program_order": 1,
        "slug": "volume-mardi",
        "title": "Mardi — Dos largeur + Biceps + Avant-bras",
        "description": "Largeur de dos, bras, avant-bras. Viser 70–80 min.",
        "difficulty": "hard",
        "exercise_names": [
            "Tractions pronation lestées",
            "Tractions supination lestées",
            "Rowing haltères poitrine appuyée",
            "Curl incliné",
            "Curl concentration bras gauche priorité",
            "Reverse curl",
            "Dead hang",
        ],
    },
    {
        "program_order": 2,
        "slug": "volume-mercredi",
        "title": "Mercredi — Spécial bras",
        "description": "Gonflette / volume bras. Viser 60–70 min.",
        "difficulty": "medium",
        "exercise_names": [
            "Curl incliné léger contrôlé",
            "Curl spider",
            "Curl concentration lourd",
            "Extension triceps au-dessus de la tête",
            "Pompes serrées",
            "Farmer walk",
        ],
    },
    {
        "program_order": 3,
        "slug": "volume-jeudi",
        "title": "Jeudi — Jambes",
        "description": "Jambes complètes + mollets + abdos. Viser 50–60 min.",
        "difficulty": "hard",
        "exercise_names": [
            "Bulgarian split squat",
            "RDL haltères",
            "Mollets debout",
            "Abdos trois séries",
        ],
    },
    {
        "program_order": 4,
        "slug": "volume-vendredi",
        "title": "Vendredi — Dos + rappel pecs / bras",
        "description": "Dos largeur, pull-over, rowing, pec maintien, superset fin. Viser 60–75 min.",
        "difficulty": "hard",
        "exercise_names": [
            "Tractions larges",
            "Pull-over haltère",
            "Rowing haltère unilatéral",
            "Développé couché modéré",
            "Curl concentration fin de séance",
            "Pompes diamant fin de séance",
        ],
    },
]


def _workout_exercise_from_doc(doc: dict, order: int) -> dict[str, Any]:
    et = doc.get("exercise_type") or "reps"
    we: dict[str, Any] = {
        "exercise_id": str(doc["_id"]),
        "name": doc["name"],
        "description": doc.get("description"),
        "exercise_type": et,
        "rest_after": doc.get("default_rest") or 60,
        "order": order,
        "tts_enabled": True,
        "image_url": doc.get("image_url"),
    }
    if et == "duration":
        we["duration"] = doc.get("default_duration") or 30
        we["reps"] = None
    else:
        we["reps"] = doc.get("default_reps") or 10
        we["duration"] = None
    return we


async def ensure_program_volume_exercises(db) -> None:
    now = _now()
    for doc in PROGRAM_EXERCISES:
        exists = await db.exercises.find_one({"is_system": True, "name": doc["name"]})
        if exists:
            continue
        row = {**doc, "is_system": True, "created_at": now}
        if row.get("exercise_type") == "reps":
            row.pop("default_duration", None)
        else:
            row.pop("default_reps", None)
        await db.exercises.insert_one(row)


async def ensure_program_volume_templates(db, logger) -> None:
    await ensure_program_volume_exercises(db)

    for spec in WEEK_TEMPLATES:
        slug = spec["slug"]
        if await db.workout_templates.find_one({"is_system": True, "slug": slug}):
            continue

        exercises_out: list[dict[str, Any]] = []
        missing: list[str] = []
        for order, name in enumerate(spec["exercise_names"]):
            ex = await db.exercises.find_one({"is_system": True, "name": name})
            if not ex:
                missing.append(name)
                continue
            exercises_out.append(_workout_exercise_from_doc(ex, len(exercises_out)))

        if missing:
            logger.warning("Modèle %s ignoré — exercices manquants: %s", slug, ", ".join(missing))
            continue
        if not exercises_out:
            continue

        now = _now()
        await db.workout_templates.insert_one(
            {
                "title": spec["title"],
                "description": spec["description"],
                "difficulty": spec.get("difficulty", "hard"),
                "blocks": [{"block_type": "main", "exercises": exercises_out}],
                "user_id": None,
                "is_system": True,
                "slug": slug,
                "program_order": spec["program_order"],
                "created_at": now,
                "updated_at": now,
            }
        )
        logger.info("Modèle système créé: %s", spec["title"])

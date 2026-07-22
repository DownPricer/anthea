"""Taxonomies normalisées (matériel, sports, muscles, tracking)."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

CANONICAL_EQUIPMENT = [
    "bodyweight",
    "dumbbell",
    "barbell",
    "ez_bar",
    "kettlebell",
    "weight_plate",
    "resistance_band",
    "cable",
    "rope_attachment",
    "straight_bar_attachment",
    "v_bar_attachment",
    "bench",
    "incline_bench",
    "decline_bench",
    "rack",
    "smith_machine",
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
    "treadmill",
    "stationary_bike",
    "elliptical",
    "rowing_machine",
    "stair_climber",
    "medicine_ball",
    "swiss_ball",
    "foam_roller",
    "suspension_trainer",
    "pullup_bar",
    "parallel_bars",
    "step",
    "box",
    "sled",
    "battle_rope",
    "pool",
    "swimming_board",
    "fins",
    "other",
]

SPORTS = [
    "strength",
    "bodyweight",
    "cardio",
    "mobility",
    "stretching",
    "yoga",
    "pilates",
    "running",
    "cycling",
    "swimming",
    "combat",
    "functional",
    "plyometrics",
    "rehabilitation",
    "other",
]

MUSCLE_CATEGORIES = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "adductors",
    "abductors",
    "abdominals",
    "obliques",
    "lower_back",
    "traps",
    "neck",
    "full_body",
]

BODY_PARTS = [
    "upper_body",
    "lower_body",
    "core",
    "full_body",
    "cardio",
    "other",
]

EQUIPMENT_ALIASES: Dict[str, str] = {
    "body weight": "bodyweight",
    "bodyweight": "bodyweight",
    "assisted": "bodyweight",
    "dumbbell": "dumbbell",
    "dumbbells": "dumbbell",
    "barbell": "barbell",
    "barbells": "barbell",
    "ez barbell": "ez_bar",
    "ez-bar": "ez_bar",
    "e-z curl bar": "ez_bar",
    "kettlebell": "kettlebell",
    "kettlebells": "kettlebell",
    "weighted": "weight_plate",
    "weight plate": "weight_plate",
    "plate": "weight_plate",
    "band": "resistance_band",
    "bands": "resistance_band",
    "resistance band": "resistance_band",
    "cable": "cable",
    "cables": "cable",
    "rope": "rope_attachment",
    "rope attachment": "rope_attachment",
    "straight bar": "straight_bar_attachment",
    "v-bar": "v_bar_attachment",
    "v bar": "v_bar_attachment",
    "bench": "bench",
    "incline bench": "incline_bench",
    "decline bench": "decline_bench",
    "rack": "rack",
    "smith": "smith_machine",
    "smith machine": "smith_machine",
    "leverage machine": "plate_loaded_machine",
    "lever machine": "plate_loaded_machine",
    "machine": "selectorized_machine",
    "selectorized": "selectorized_machine",
    "sled machine": "sled",
    "olympic barbell": "barbell",
    "trap bar": "barbell",
    "bosu ball": "swiss_ball",
    "stability ball": "swiss_ball",
    "swiss ball": "swiss_ball",
    "medicine ball": "medicine_ball",
    "foam roll": "foam_roller",
    "foam roller": "foam_roller",
    "suspension": "suspension_trainer",
    "trx": "suspension_trainer",
    "pull-up bar": "pullup_bar",
    "pullup bar": "pullup_bar",
    "parallel bars": "parallel_bars",
    "step": "step",
    "box": "box",
    "sled": "sled",
    "battle rope": "battle_rope",
    "battle ropes": "battle_rope",
    "stationary bike": "stationary_bike",
    "bike": "stationary_bike",
    "elliptical machine": "elliptical",
    "elliptical": "elliptical",
    "rower": "rowing_machine",
    "rowing machine": "rowing_machine",
    "treadmill": "treadmill",
    "stair climber": "stair_climber",
    "skierg machine": "other",
    "wheel roller": "other",
    "roller": "foam_roller",
    "hammer": "other",
}

MUSCLE_ALIASES: Dict[str, str] = {
    "pectorals": "chest",
    "chest": "chest",
    "lats": "back",
    "upper back": "back",
    "back": "back",
    "spine": "lower_back",
    "lower back": "lower_back",
    "delts": "shoulders",
    "shoulders": "shoulders",
    "anterior deltoid": "shoulders",
    "posterior deltoid": "shoulders",
    "lateral deltoid": "shoulders",
    "biceps": "biceps",
    "triceps": "triceps",
    "forearms": "forearms",
    "quads": "quadriceps",
    "quadriceps": "quadriceps",
    "hamstrings": "hamstrings",
    "glutes": "glutes",
    "calves": "calves",
    "adductors": "adductors",
    "abductors": "abductors",
    "abs": "abdominals",
    "abdominals": "abdominals",
    "obliques": "obliques",
    "traps": "traps",
    "trapezius": "traps",
    "neck": "neck",
    "cardiovascular system": "full_body",
    "serratus anterior": "chest",
    "levator scapulae": "neck",
}

BODY_PART_ALIASES: Dict[str, str] = {
    "chest": "upper_body",
    "back": "upper_body",
    "shoulders": "upper_body",
    "upper arms": "upper_body",
    "lower arms": "upper_body",
    "neck": "upper_body",
    "waist": "core",
    "abs": "core",
    "core": "core",
    "upper legs": "lower_body",
    "lower legs": "lower_body",
    "cardio": "cardio",
    "full body": "full_body",
}

MACHINE_KEYWORDS: Dict[str, str] = {
    "leg press": "leg_press_machine",
    "hack squat": "hack_squat_machine",
    "chest press": "chest_press_machine",
    "shoulder press": "shoulder_press_machine",
    "lat pulldown": "lat_pulldown_machine",
    "lat pull-down": "lat_pulldown_machine",
    "seated row": "seated_row_machine",
    "leg extension": "leg_extension_machine",
    "leg curl": "leg_curl_machine",
    "lying leg curl": "leg_curl_machine",
    "seated leg curl": "leg_curl_machine",
    "adductor": "adductor_machine",
    "abductor": "abductor_machine",
    "calf raise": "calf_raise_machine",
    "pec deck": "pec_deck_machine",
    "pec-deck": "pec_deck_machine",
    "butterfly": "pec_deck_machine",
    "reverse fly": "reverse_fly_machine",
    "rear delt": "reverse_fly_machine",
    "assisted dip": "assisted_dip_machine",
    "assisted pull-up": "assisted_pullup_machine",
    "assisted pullup": "assisted_pullup_machine",
    "smith": "smith_machine",
}


def fold_text(value: str) -> str:
    """Minuscules + suppression des accents pour recherche."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    ascii_only = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_only).strip().lower()


def slugify(value: str) -> str:
    text = fold_text(value)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_") or "exercise"


def normalize_equipment_token(raw: str) -> Tuple[str, str]:
    raw_s = (raw or "").strip()
    key = fold_text(raw_s)
    if key in EQUIPMENT_ALIASES:
        return EQUIPMENT_ALIASES[key], raw_s
    for alias, canon in EQUIPMENT_ALIASES.items():
        if alias in key:
            return canon, raw_s
    return "other", raw_s


def detect_machine_equipment(name: str, equipment_raw: str) -> Optional[str]:
    hay = fold_text(f"{name} {equipment_raw}")
    for keyword, canon in MACHINE_KEYWORDS.items():
        if keyword in hay:
            return canon
    return None


def normalize_equipment_list(
    raw_items: List[str],
    *,
    name: str = "",
) -> Tuple[List[str], str]:
    equipment: List[str] = []
    raw_joined = ", ".join([str(x) for x in raw_items if x])
    for item in raw_items or []:
        canon, _ = normalize_equipment_token(str(item))
        if canon not in equipment:
            equipment.append(canon)
    machine = detect_machine_equipment(name, raw_joined)
    if machine and machine not in equipment:
        # Remplace un vague « machine » si on a un type précis
        equipment = [e for e in equipment if e not in ("selectorized_machine", "plate_loaded_machine", "other")]
        equipment.insert(0, machine)
    if not equipment:
        equipment = ["other"]
    return equipment, raw_joined


def normalize_muscle(raw: str) -> str:
    key = fold_text(raw)
    if key in MUSCLE_ALIASES:
        return MUSCLE_ALIASES[key]
    for alias, canon in MUSCLE_ALIASES.items():
        if alias in key:
            return canon
    return slugify(raw) or "other"


def normalize_body_part(raw: str) -> str:
    key = fold_text(raw)
    if key in BODY_PART_ALIASES:
        return BODY_PART_ALIASES[key]
    if key in BODY_PARTS:
        return key
    return "other"


def infer_sport(
    *,
    name: str,
    equipment: List[str],
    body_parts_raw: List[str],
    category_raw: Optional[str] = None,
) -> str:
    hay = fold_text(f"{name} {category_raw or ''} {' '.join(body_parts_raw)}")
    if any(k in hay for k in ("yoga", "downward dog", "upward facing", "warrior pose", "namaste")):
        return "yoga"
    if "pilates" in hay:
        return "pilates"
    if any(k in hay for k in ("stretch", "mobility", "foam roll")):
        return "stretching" if "stretch" in hay else "mobility"
    if any(k in hay for k in ("run", "sprint", "jog")):
        return "running"
    if any(k in hay for k in ("cycle", "bike", "cycling")):
        return "cycling"
    if any(k in hay for k in ("swim", "pool", "freestyle", "backstroke", "breaststroke")):
        return "swimming"
    if any(k in hay for k in ("jump rope", "burpee", "cardio", "mountain climber", "jumping jack")):
        return "cardio"
    if "bodyweight" in equipment and not any(
        e in equipment for e in ("dumbbell", "barbell", "cable", "kettlebell", "smith_machine")
    ):
        if any(k in hay for k in ("plank", "hold", "isometric")):
            return "bodyweight"
        return "bodyweight"
    if any(e.endswith("_machine") or e in ("cable", "barbell", "dumbbell", "smith_machine") for e in equipment):
        return "strength"
    if "cardio" in (body_parts_raw or []) or "cardio" in hay:
        return "cardio"
    return "strength"


def infer_category(primary_muscles: List[str], body_parts_raw: List[str]) -> str:
    if primary_muscles:
        first = primary_muscles[0]
        if first in MUSCLE_CATEGORIES:
            return first
        mapped = normalize_muscle(first)
        if mapped in MUSCLE_CATEGORIES:
            return mapped
    for bp in body_parts_raw or []:
        mapped = normalize_muscle(bp)
        if mapped in MUSCLE_CATEGORIES:
            return mapped
    return "full_body"


def infer_tracking_type(*, name: str, sport: str, equipment: List[str]) -> str:
    hay = fold_text(name)
    if sport in ("running", "cycling"):
        return "distance_duration"
    if sport == "swimming":
        return "laps_distance"
    if sport in ("stretching", "mobility", "yoga", "pilates"):
        return "duration"
    if any(k in hay for k in ("plank", "hold", "wall sit", "hang", "isometric", "stretch")):
        return "duration"
    if sport == "cardio" and any(k in hay for k in ("run", "bike", "row", "elliptical")):
        return "distance_duration"
    if "bodyweight" in equipment and not any(
        e in equipment for e in ("dumbbell", "barbell", "cable", "kettlebell", "weight_plate")
    ):
        return "reps"
    return "reps_weight"


def tracking_to_exercise_type(tracking_type: str) -> str:
    """Mappe vers le contrat Player existant (reps | duration)."""
    if tracking_type in ("duration", "distance_duration", "laps_distance"):
        return "duration"
    return "reps"

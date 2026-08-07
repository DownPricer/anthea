"""Tests : presets d'activité comme exercices de séance."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from activities.workout_exercises import (
    activity_exercise_id,
    canonicalize_activity_exercise,
    is_activity_workout_exercise,
    parse_activity_preset_id,
    validate_workout_blocks,
)


def test_activity_exercise_id_namespace():
    assert activity_exercise_id("outdoor_running") == "activity:outdoor_running"
    assert activity_exercise_id("activity:outdoor_running") == "activity:outdoor_running"
    assert parse_activity_preset_id("activity:pool_swimming") == "pool_swimming"
    assert parse_activity_preset_id("pushups") is None


def test_canonicalize_outdoor_running():
    ex = canonicalize_activity_exercise(
        {
            "exercise_id": "activity:outdoor_running",
            "source": "activity_preset",
            "preset_id": "outdoor_running",
            "name": "Course",
        }
    )
    assert ex["exercise_id"] == "activity:outdoor_running"
    assert ex["activity_tracking_mode"] == "gps"
    assert ex["reps"] is None
    assert ex["rest_after"] == 0
    assert ex["activity_config"]["target_distance_meters"] is None


def test_invalid_preset_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_workout_blocks(
            [
                {
                    "block_type": "main",
                    "exercises": [
                        {
                            "exercise_id": "activity:not_a_real_preset",
                            "source": "activity_preset",
                            "name": "Fake",
                        }
                    ],
                }
            ]
        )
    assert exc.value.status_code == 400


def test_mixed_workout_blocks_validated():
    blocks = validate_workout_blocks(
        [
            {
                "block_type": "main",
                "exercises": [
                    {
                        "exercise_id": "activity:outdoor_running",
                        "source": "activity_preset",
                        "preset_id": "outdoor_running",
                        "name": "Course à pied",
                        "activity_tracking_mode": "gps",
                    },
                    {
                        "exercise_id": "pushups-1",
                        "name": "Pompes",
                        "exercise_type": "reps",
                        "reps": 12,
                        "rest_after": 30,
                    },
                    {
                        "exercise_id": "activity:stretching_session",
                        "source": "activity_preset",
                        "preset_id": "stretching_session",
                        "name": "Étirements",
                    },
                ],
            }
        ]
    )
    exercises = blocks[0]["exercises"]
    assert len(exercises) == 3
    assert is_activity_workout_exercise(exercises[0])
    assert not is_activity_workout_exercise(exercises[1])
    assert exercises[2]["activity_tracking_mode"] == "timer"
    assert exercises[0]["exercise_name_i18n_snapshot"]


def test_swimming_default_pool_length():
    ex = canonicalize_activity_exercise(
        {
            "exercise_id": "activity:pool_swimming",
            "preset_id": "pool_swimming",
            "name": "Natation",
        }
    )
    assert ex["activity_config"]["pool_length_meters"] == 25.0


def test_classic_exercise_untouched():
    blocks = validate_workout_blocks(
        [
            {
                "block_type": "main",
                "exercises": [
                    {
                        "exercise_id": "squat-1",
                        "name": "Squat",
                        "exercise_type": "reps",
                        "reps": 10,
                        "rest_after": 45,
                    }
                ],
            }
        ]
    )
    assert blocks[0]["exercises"][0]["reps"] == 10
    assert blocks[0]["exercises"][0].get("source") is None


def test_catalog_exdb_exercise_accepted():
    blocks = validate_workout_blocks(
        [
            {
                "block_type": "main",
                "exercises": [
                    {
                        "exercise_id": "exdb_1760",
                        "name": "Squat goblet avec haltères",
                        "exercise_type": "reps",
                        "reps": 10,
                        "tracking_type_snapshot": "reps_weight",
                    }
                ],
            }
        ]
    )
    ex = blocks[0]["exercises"][0]
    assert not is_activity_workout_exercise(ex)
    assert ex["exercise_id"] == "exdb_1760"


def test_multiple_exdb_exercises_accepted():
    blocks = validate_workout_blocks(
        [
            {
                "block_type": "main",
                "exercises": [
                    {
                        "exercise_id": "exdb_1760",
                        "name": "Squat goblet",
                        "exercise_type": "reps",
                        "reps": 10,
                        "tracking_type_snapshot": "reps_weight",
                    },
                    {
                        "exercise_id": "exdb_42",
                        "name": "Bench press",
                        "exercise_type": "reps",
                        "reps": 8,
                        "tracking_type_snapshot": "reps_weight",
                    },
                ],
            }
        ]
    )
    assert len(blocks[0]["exercises"]) == 2
    assert all(not is_activity_workout_exercise(ex) for ex in blocks[0]["exercises"])


def test_mixed_exdb_and_activity_preset():
    blocks = validate_workout_blocks(
        [
            {
                "block_type": "main",
                "exercises": [
                    {
                        "exercise_id": "exdb_1760",
                        "name": "Squat goblet",
                        "exercise_type": "reps",
                        "reps": 10,
                        "tracking_type_snapshot": "reps_weight",
                    },
                    {
                        "exercise_id": "activity:outdoor_running",
                        "source": "activity_preset",
                        "preset_id": "outdoor_running",
                        "name": "Course extérieure",
                    },
                ],
            }
        ]
    )
    exercises = blocks[0]["exercises"]
    assert exercises[0]["exercise_id"] == "exdb_1760"
    assert exercises[1]["activity_tracking_mode"] == "gps"


def test_invalid_preset_still_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_workout_blocks(
            [
                {
                    "block_type": "main",
                    "exercises": [
                        {
                            "exercise_id": "activity:fake_preset_xyz",
                            "source": "activity_preset",
                            "name": "Fake",
                        }
                    ],
                }
            ]
        )
    assert exc.value.status_code == 400
    assert "Preset d'activité invalide" in exc.value.detail

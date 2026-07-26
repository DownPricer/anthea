"""Tests snapshot d'exercices / activités dans les publications de séance."""

from __future__ import annotations

import server


def test_build_exercise_summary_from_running_log():
    entry = {
        "name": "Course extérieure",
        "preset_id": "outdoor_running",
        "source": "activity_preset",
        "activity_tracking_mode": "gps",
        "status": "completed",
        "activity_summary": {
            "activity_id": "act-1",
            "activity_kind": "running",
            "tracking_mode": "gps",
            "distance_meters": 5240,
            "moving_seconds": 1880,
            "elapsed_seconds": 1961,
            "average_pace_seconds_per_km": 359,
            "route": {"type": "LineString", "coordinates": [[2.0, 48.0], [2.1, 48.1]]},
            "simplified_route": {"type": "LineString", "coordinates": [[2.0, 48.0]]},
        },
    }
    summary = server.build_exercise_summary_from_log_entry(entry)
    assert summary["distance_meters"] == 5240
    assert summary["moving_seconds"] == 1880
    assert summary["average_pace_seconds_per_km"] == 359
    assert summary["preset_id"] == "outdoor_running"
    assert "route" not in summary
    assert "simplified_route" not in summary
    assert "coordinates" not in summary


def test_build_exercise_summary_null_distance_no_nan():
    entry = {
        "name": "Marche",
        "preset_id": "outdoor_walking",
        "activity_tracking_mode": "gps",
        "status": "completed",
        "activity_summary": {
            "distance_meters": 0,
            "moving_seconds": 120,
            "average_pace_seconds_per_km": float("nan"),
        },
    }
    summary = server.build_exercise_summary_from_log_entry(entry)
    assert summary["average_pace_seconds_per_km"] is None
    assert summary["moving_seconds"] == 120


def test_swimming_and_timer_snapshots():
    swim = server.build_exercise_summary_from_log_entry(
        {
            "name": "Natation",
            "preset_id": "pool_swimming",
            "activity_tracking_mode": "laps",
            "status": "completed",
            "activity_summary": {
                "distance_meters": 1000,
                "laps": 40,
                "moving_seconds": 1692,
                "pool_length_meters": 25,
            },
        }
    )
    assert swim["laps"] == 40
    assert swim["distance_meters"] == 1000

    timer = server.build_exercise_summary_from_log_entry(
        {
            "name": "Yoga",
            "preset_id": "yoga_session",
            "activity_tracking_mode": "timer",
            "status": "completed",
            "activity_summary": {"elapsed_seconds": 480},
        }
    )
    assert timer["elapsed_seconds"] == 480


def test_session_snapshot_includes_exercise_summaries_without_coords():
    session = {
        "workout_title": "Mixte",
        "total_time": 3600,
        "exercises_completed": 2,
        "exercises_total": 2,
        "exercise_log": [
            {
                "name": "Course extérieure",
                "preset_id": "outdoor_running",
                "activity_tracking_mode": "gps",
                "status": "completed",
                "activity_summary": {
                    "distance_meters": 4800,
                    "moving_seconds": 1862,
                    "coordinates": [[1, 2]],
                },
            },
            {
                "name": "Pompes",
                "exercise_type": "reps",
                "reps": 48,
                "sets": 4,
                "status": "completed",
            },
        ],
    }
    snap = server.build_session_snapshot(session)
    assert len(snap["exercise_summaries"]) == 2
    joined = str(snap)
    assert "coordinates" not in joined
    assert snap["exercise_summaries"][0]["distance_meters"] == 4800
    assert snap["exercise_summaries"][1]["reps"] == 48


def test_invalid_pace_stripped():
    summary = server.build_exercise_summary_from_log_entry(
        {
            "name": "Course",
            "status": "completed",
            "activity_tracking_mode": "gps",
            "activity_summary": {
                "distance_meters": 1000,
                "moving_seconds": 300,
                "average_pace_seconds_per_km": 0,
            },
        }
    )
    assert summary["average_pace_seconds_per_km"] is None

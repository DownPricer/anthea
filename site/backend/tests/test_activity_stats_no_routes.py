"""Guards: stats agrégées sans routes GPS."""

from __future__ import annotations

import inspect

import server
from activities.service import activity_stats_from_docs


def test_activity_stats_aggregation():
    docs = [
        {
            "status": "completed",
            "activity_kind": "running",
            "moving_seconds": 100,
            "distance_meters": 1000,
            "laps": 0,
            "average_pace_seconds_per_km": 300,
        },
        {
            "status": "completed",
            "activity_kind": "swimming",
            "moving_seconds": 200,
            "distance_meters": 500,
            "laps": 20,
        },
        {"status": "discarded", "activity_kind": "running", "distance_meters": 9999},
    ]
    stats = activity_stats_from_docs(docs)
    assert stats["activities_completed"] == 2
    assert stats["distance_running_meters"] == 1000
    assert stats["distance_swimming_meters"] == 500
    assert stats["laps_total"] == 20
    assert "route" not in stats


def test_profile_stats_activity_query_excludes_routes():
    src = inspect.getsource(server.get_user_profile_stats)
    assert "ACTIVITY_SESSIONS_COLLECTION" in src
    assert "distance_meters" in src
    assert "route_chunks" not in src
    assert '"route"' not in src or "route" not in src.split("activity_stats")[1][:400]


def test_detailed_stats_includes_activity_stats_projection():
    src = inspect.getsource(server.get_detailed_stats)
    assert "activity_stats" in src
    assert "ACTIVITY_SESSIONS_COLLECTION" in src
    assert "route_chunks" not in src

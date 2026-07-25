"""Constantes du suivi d'activités FitMatch."""

from __future__ import annotations

ACTIVITY_TRACKING_MODES = (
    "standard",
    "timer",
    "manual_distance",
    "laps",
    "gps",
    "intervals",
)

ACTIVITY_KINDS = (
    "running",
    "walking",
    "hiking",
    "cycling",
    "swimming",
    "rowing",
    "elliptical",
    "stair_climber",
    "jump_rope",
    "yoga",
    "stretching",
    "mobility",
    "hiit",
    "track",
    "shuttle",
    "roller",
    "skiing",
    "kayaking",
    "other",
)

ACTIVITY_STATUSES = (
    "draft",
    "active",
    "paused",
    "completed",
    "discarded",
)

ACTIVE_STATUSES = ("active", "paused")

ROUTE_VISIBILITIES = (
    "private",
    "summary_only",
    "trimmed_route",
    "full_route",
)

POST_VISIBILITIES = ("public", "friends", "private")

# Limites de sécurité / performance
MAX_POINTS_PER_BATCH = 100
MAX_ROUTE_POINTS = 5000
MAX_LAPS_PER_BATCH = 50
MAX_INTERVAL_REPS = 200
MIN_ACTIVITY_SECONDS_KEEP = 5
DEFAULT_TRIM_METERS = 200
GPS_MAX_ACCURACY_M = 50.0
GPS_MIN_POINT_DISTANCE_M = 4.0

# Vitesses max plausibles (m/s) par famille de sport
MAX_SPEED_MPS = {
    "running": 12.0,  # ~43 km/h sprint
    "walking": 4.5,
    "hiking": 4.0,
    "cycling": 25.0,
    "roller": 20.0,
    "skiing": 40.0,
    "kayaking": 8.0,
    "swimming": 3.0,
    "default": 15.0,
}

SESSIONS_COLLECTION = "activity_sessions"
ROUTE_CHUNKS_COLLECTION = "activity_route_chunks"

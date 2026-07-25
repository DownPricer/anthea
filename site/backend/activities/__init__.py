"""Suivi d'activités chronométrées et sportives FitMatch."""

from .classification import apply_activity_modes, classify_exercise, classify_catalog_documents
from .constants import ACTIVITY_KINDS, ACTIVITY_TRACKING_MODES, SESSIONS_COLLECTION
from .service import ensure_activity_indexes

__all__ = [
    "ACTIVITY_KINDS",
    "ACTIVITY_TRACKING_MODES",
    "SESSIONS_COLLECTION",
    "apply_activity_modes",
    "classify_exercise",
    "classify_catalog_documents",
    "ensure_activity_indexes",
]

"""Catalogue d'exercices canonique Anthea / FitMatch."""

from .catalog import (
    CATALOG_COLLECTION,
    catalog_to_legacy_response,
    ensure_catalog_indexes,
)
from .resolve import resolve_exercise_reference
from .search import search_catalog

__all__ = [
    "CATALOG_COLLECTION",
    "catalog_to_legacy_response",
    "ensure_catalog_indexes",
    "resolve_exercise_reference",
    "search_catalog",
]

"""Traduction / localisation du catalogue d'exercices."""

from .apply import apply_translations_to_catalog, build_translation_coverage, localize_document
from .engine import translate_name, build_short_description, translate_label

__all__ = [
    "apply_translations_to_catalog",
    "build_translation_coverage",
    "localize_document",
    "translate_name",
    "build_short_description",
    "translate_label",
]

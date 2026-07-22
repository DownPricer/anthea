"""Registre des fournisseurs d'exercices."""

from __future__ import annotations

import os
from typing import Optional

from .base import ExerciseProvider
from .exercisedb import ExerciseDbProvider
from .free_exercise_db import FreeExerciseDbProvider
from .wger import WgerProvider


def get_provider(name: Optional[str] = None, **kwargs) -> ExerciseProvider:
    provider_name = (name or os.environ.get("EXERCISE_PROVIDER") or "exercisedb").strip().lower()
    if provider_name in ("exercisedb", "exdb", "ascend"):
        return ExerciseDbProvider(**kwargs)
    if provider_name in ("free_exercise_db", "freeexercisedb", "fedb"):
        return FreeExerciseDbProvider(**kwargs)
    if provider_name == "wger":
        return WgerProvider()
    raise ValueError(f"Unknown exercise provider: {provider_name}")


__all__ = [
    "ExerciseProvider",
    "ExerciseDbProvider",
    "FreeExerciseDbProvider",
    "WgerProvider",
    "get_provider",
]

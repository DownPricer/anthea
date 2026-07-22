"""Stub Wger — prêt pour un futur fournisseur metadata."""

from __future__ import annotations

from typing import Any, Dict, Iterable

from .base import ExerciseProvider


class WgerProvider(ExerciseProvider):
    name = "wger"

    def fetch_all(self) -> Iterable[Dict[str, Any]]:
        # Non branché dans cette vague : architecture seulement.
        return iter(())

    def normalize(self, raw_exercise: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("WgerProvider n'est pas activé dans cette version")

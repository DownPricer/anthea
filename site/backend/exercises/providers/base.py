"""Interface commune des fournisseurs d'exercices."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, Iterator, List, Optional


class ExerciseProvider(ABC):
    """Contrat minimal pour importer un catalogue externe."""

    name: str = "base"

    @abstractmethod
    def fetch_all(self) -> Iterable[Dict[str, Any]]:
        """Yield tous les exercices bruts du fournisseur (pagination inclusive)."""

    @abstractmethod
    def normalize(self, raw_exercise: Dict[str, Any]) -> Dict[str, Any]:
        """Retourne un document catalogue canonique (sans timestamps Mongo)."""

    def get_media_url(self, raw_exercise: Dict[str, Any]) -> Optional[str]:
        """URL média principale (GIF/image) si disponible."""
        return (
            raw_exercise.get("gifUrl")
            or raw_exercise.get("gif_url")
            or raw_exercise.get("imageUrl")
            or raw_exercise.get("image_url")
        )

    def fetch_pages(self) -> Iterator[List[Dict[str, Any]]]:
        """Par défaut : un seul « page » contenant tout fetch_all."""
        yield list(self.fetch_all())

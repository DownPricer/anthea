"""Free Exercise DB (public domain) — fallback metadata / images statiques."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.request import Request, urlopen

from ..normalize import normalize_from_structured
from .base import ExerciseProvider

DEFAULT_JSON_URL = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
)
IMAGE_PREFIX = (
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
)

LICENSE = "Unlicense / public domain (yuhonas/free-exercise-db)"
ATTRIBUTION = "Free Exercise DB — https://github.com/yuhonas/free-exercise-db"


class FreeExerciseDbProvider(ExerciseProvider):
    name = "free_exercise_db"

    def __init__(self, source_url: Optional[str] = None, fixture_path: Optional[str] = None):
        self.source_url = source_url or DEFAULT_JSON_URL
        self.fixture_path = fixture_path
        self.pages_fetched = 0
        self.errors: List[str] = []

    def fetch_all(self) -> Iterable[Dict[str, Any]]:
        if self.fixture_path:
            data = json.loads(Path(self.fixture_path).read_text(encoding="utf-8"))
        else:
            req = Request(self.source_url, headers={"User-Agent": "AntheaFitMatchExerciseImport/1.0"})
            with urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        self.pages_fetched = 1
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    yield item

    def get_media_url(self, raw_exercise: Dict[str, Any]) -> Optional[str]:
        images = raw_exercise.get("images") or []
        if not images:
            return None
        path = images[0]
        if str(path).startswith("http"):
            return str(path)
        return IMAGE_PREFIX + str(path).lstrip("/")

    def normalize(self, raw_exercise: Dict[str, Any]) -> Dict[str, Any]:
        name = str(raw_exercise.get("name") or "").strip()
        provider_id = str(raw_exercise.get("id") or name)
        equipment = raw_exercise.get("equipment")
        equip_list = [equipment] if isinstance(equipment, str) else list(equipment or [])
        primary = list(raw_exercise.get("primaryMuscles") or [])
        secondary = list(raw_exercise.get("secondaryMuscles") or [])
        category = raw_exercise.get("category")
        body_parts = [category] if category else []
        media = self.get_media_url(raw_exercise)
        doc = normalize_from_structured(
            provider=self.name,
            provider_id=provider_id,
            name=name,
            equipment_raw_list=[str(x) for x in equip_list if x],
            primary_muscles_raw=[str(x) for x in primary],
            secondary_muscles_raw=[str(x) for x in secondary],
            body_parts_raw=[str(x) for x in body_parts],
            media_url=media,
            thumbnail_url=media,
            instructions=list(raw_exercise.get("instructions") or []),
            license_name=LICENSE,
            attribution=ATTRIBUTION,
            original_url=self.source_url,
        )
        # Images statiques, pas GIF
        if media and doc.get("media"):
            doc["media"]["type"] = "image"
        return doc

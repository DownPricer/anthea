"""Fournisseur ExerciseDB (AscendAPI / RapidAPI / OSS)."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from ..normalize import normalize_from_structured
from .base import ExerciseProvider

DEFAULT_BASE_URL = "https://oss.exercisedb.dev/api/v1"
ALLOWED_MEDIA_HOSTS = (
    "static.exercisedb.dev",
    "v2.exercisedb.dev",
    "exercisedb.p.rapidapi.com",
    "cdn.exercisedb.dev",
)

LICENSE = "ExerciseDB / AscendAPI limited API license — metadata for app use; media display-only"
ATTRIBUTION = "Exercise data and GIFs © ExerciseDB / AscendAPI — https://exercisedb.dev"


class ExerciseDbProvider(ExerciseProvider):
    name = "exercisedb"

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        page_size: int = 100,
        timeout: int = 45,
        max_retries: int = 3,
        fixture_path: Optional[str] = None,
    ):
        self.base_url = (base_url or os.environ.get("EXERCISE_PROVIDER_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else os.environ.get("EXERCISE_PROVIDER_API_KEY")
        self.page_size = max(1, min(int(page_size), 100))
        self.timeout = timeout
        self.max_retries = max_retries
        self.fixture_path = fixture_path
        self.pages_fetched = 0
        self.errors: List[str] = []

    def _headers(self) -> Dict[str, str]:
        headers = {
            "User-Agent": "AntheaFitMatchExerciseImport/1.0",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["X-RapidAPI-Key"] = self.api_key
            # Host RapidAPI classique ou AscendAPI selon l'URL
            if "rapidapi.com" in self.base_url:
                if "edb-with" in self.base_url:
                    headers["X-RapidAPI-Host"] = "edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com"
                else:
                    headers["X-RapidAPI-Host"] = "exercisedb.p.rapidapi.com"
        return headers

    def _request_json(self, url: str) -> Any:
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                req = Request(url, headers=self._headers())
                with urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read().decode("utf-8")
                    return json.loads(raw)
            except HTTPError as exc:
                last_err = exc
                if exc.code in (429, 500, 502, 503, 504) and attempt + 1 < self.max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                self.errors.append(f"HTTP {exc.code} for {url}")
                raise
            except (URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_err = exc
                if attempt + 1 < self.max_retries:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                self.errors.append(str(exc))
                raise
        raise RuntimeError(str(last_err))

    def _extract_items(self, payload: Any) -> List[Dict[str, Any]]:
        if isinstance(payload, list):
            return [x for x in payload if isinstance(x, dict)]
        if not isinstance(payload, dict):
            return []
        for key in ("data", "results", "exercises", "items"):
            val = payload.get(key)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
        return []

    def _next_cursor(self, payload: Any, items: List[Dict[str, Any]]) -> Optional[str]:
        if not isinstance(payload, dict):
            return None
        meta = payload.get("meta") or {}
        if meta.get("hasNextPage") is False:
            return None
        cursor = meta.get("nextCursor") or payload.get("nextCursor") or payload.get("next")
        if cursor:
            return str(cursor)
        # Fallback offset-style
        return None

    def fetch_pages(self) -> Iterator[List[Dict[str, Any]]]:
        if self.fixture_path:
            path = Path(self.fixture_path)
            data = json.loads(path.read_text(encoding="utf-8"))
            items = data if isinstance(data, list) else self._extract_items(data)
            self.pages_fetched = 1
            yield items
            return

        seen_ids = set()

        # Dataset metadata Ascend-compatible en premier (API OSS : ~25 items, pagination HS).
        for fallback_url in (
            "https://raw.githubusercontent.com/Aquariius/exercises-dataset/main/data/exercises.json",
        ):
            try:
                payload = self._request_json(fallback_url)
                items = payload if isinstance(payload, list) else self._extract_items(payload)
                mapped = [self._coerce_dataset_item(x) for x in items]
                mapped = [x for x in mapped if x]
                for item in mapped:
                    eid = str(item.get("exerciseId") or "")
                    if eid:
                        seen_ids.add(eid)
                if mapped:
                    self.pages_fetched += 1
                    yield mapped
                break
            except Exception as exc:
                self.errors.append(f"bulk dataset failed: {exc}")

        # Complément éventuel via API live
        try:
            url = f"{self.base_url}/exercises?{urlencode({'limit': 1500})}"
            payload = self._request_json(url)
            items = self._extract_items(payload)
            self.pages_fetched += 1
            fresh = []
            for item in items:
                coerced = self._coerce_dataset_item(item) or item
                eid = str(coerced.get("exerciseId") or coerced.get("id") or "")
                if eid and eid in seen_ids:
                    continue
                if eid:
                    seen_ids.add(eid)
                fresh.append(coerced)
            if fresh:
                yield fresh
        except Exception as exc:
            self.errors.append(f"live API supplement failed: {exc}")

    def _coerce_dataset_item(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Mappe Aquariius / dumps Ascend vers le shape ExerciseDB v1."""
        if not isinstance(raw, dict):
            return None

        from ..media_urls import build_cdn_gif_url, extract_cdn_id_from_path

        def _as_list(value: Any) -> List[str]:
            if value is None:
                return []
            if isinstance(value, list):
                return [str(x) for x in value if x is not None]
            if isinstance(value, str):
                return [value] if value.strip() else []
            return [str(value)]

        aquarius_id = raw.get("id")
        eid = raw.get("exerciseId") or raw.get("exercise_id")
        name = raw.get("name")
        image = str(raw.get("image") or raw.get("gif_url") or raw.get("gifUrl") or "")
        gif_raw = raw.get("gifUrl") or raw.get("gif_url") or ""
        cdn_id = (
            extract_cdn_id_from_path(str(gif_raw))
            or extract_cdn_id_from_path(image)
            or extract_cdn_id_from_path(str(eid or ""))
        )
        # Conserver l'id Aquariius numérique pour stabilité des documents déjà importés
        if aquarius_id is not None and str(aquarius_id).strip():
            provider_key = str(aquarius_id).strip()
        elif eid and not str(eid).isdigit():
            provider_key = str(eid)
        else:
            provider_key = cdn_id or (str(eid) if eid else None)

        if not provider_key or not name:
            return None

        if gif_raw and str(gif_raw).startswith("http") and cdn_id is None:
            gif = str(gif_raw)
        elif cdn_id:
            gif = build_cdn_gif_url(cdn_id)
        elif gif_raw and str(gif_raw).startswith("http"):
            gif = str(gif_raw)
        else:
            # Dernier recours (peut être invalide) — éviter les ids numériques seuls
            gif = None if str(provider_key).isdigit() else build_cdn_gif_url(str(provider_key))

        body = raw.get("bodyParts") or raw.get("body_parts") or raw.get("bodyPart") or raw.get("body_part")
        equip = raw.get("equipments") or raw.get("equipment")
        targets = (
            raw.get("targetMuscles")
            or raw.get("target_muscles")
            or raw.get("primaryMuscles")
            or raw.get("primary_muscles")
            or raw.get("target")
            or raw.get("muscle_group")
        )
        secondary = raw.get("secondaryMuscles") or raw.get("secondary_muscles") or []
        instructions = raw.get("instructions") or raw.get("instruction_steps") or []
        return {
            "exerciseId": provider_key,
            "cdnId": cdn_id,
            "name": name,
            "gifUrl": gif,
            "bodyParts": _as_list(body),
            "equipments": _as_list(equip),
            "targetMuscles": _as_list(targets),
            "secondaryMuscles": _as_list(secondary),
            "instructions": list(instructions) if isinstance(instructions, list) else [],
            "_source_gif_path": str(gif_raw) if gif_raw else image,
        }

    def fetch_all(self) -> Iterable[Dict[str, Any]]:
        for page in self.fetch_pages():
            for item in page:
                yield item

    def get_media_url(self, raw_exercise: Dict[str, Any]) -> Optional[str]:
        return raw_exercise.get("gifUrl") or raw_exercise.get("gif_url")

    def normalize(self, raw_exercise: Dict[str, Any]) -> Dict[str, Any]:
        coerced = self._coerce_dataset_item(raw_exercise) or raw_exercise
        provider_id = str(coerced.get("exerciseId") or coerced.get("id") or "")
        name = str(coerced.get("name") or "").strip()
        equipments = coerced.get("equipments") or coerced.get("equipment") or []
        if isinstance(equipments, str):
            equipments = [equipments]
        targets = coerced.get("targetMuscles") or coerced.get("target") or []
        if isinstance(targets, str):
            targets = [targets]
        secondary = coerced.get("secondaryMuscles") or []
        if isinstance(secondary, str):
            secondary = [secondary]
        body_parts = coerced.get("bodyParts") or []
        if isinstance(body_parts, str):
            body_parts = [body_parts]
        media = self.get_media_url(coerced)
        doc = normalize_from_structured(
            provider=self.name,
            provider_id=provider_id,
            name=name,
            equipment_raw_list=[str(x) for x in equipments],
            primary_muscles_raw=[str(x) for x in targets],
            secondary_muscles_raw=[str(x) for x in secondary],
            body_parts_raw=[str(x) for x in body_parts],
            media_url=media,
            thumbnail_url=media,
            instructions=list(coerced.get("instructions") or []),
            license_name=LICENSE,
            attribution=ATTRIBUTION,
            original_url=f"https://oss.exercisedb.dev/api/v1/exercises/{provider_id}",
        )
        if coerced.get("cdnId") and isinstance(doc.get("media"), dict):
            doc["media"]["cdn_id"] = coerced["cdnId"]
        if coerced.get("_source_gif_path"):
            doc.setdefault("source", {})["gif_path"] = coerced["_source_gif_path"]
        doc["provider_name"] = name
        return doc

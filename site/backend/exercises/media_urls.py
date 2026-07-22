"""Extraction / réparation des URLs média ExerciseDB."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

CDN_HOST = "static.exercisedb.dev"
CDN_MEDIA_PREFIX = f"https://{CDN_HOST}/media/"

# Aquariius / dumps : videos/0001-2gPfomN.gif → CDN id 2gPfomN
_AQUARIUS_STEM = re.compile(r"^(\d+)-([A-Za-z0-9]+)$")


def extract_cdn_id_from_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    base = str(path).split("/")[-1].strip()
    if not base:
        return None
    stem = base.rsplit(".", 1)[0]
    m = _AQUARIUS_STEM.match(stem)
    if m:
        return m.group(2)
    # Déjà un id CDN (pas seulement numérique)
    if re.fullmatch(r"[A-Za-z0-9]{5,}", stem) and not stem.isdigit():
        return stem
    return None


def build_cdn_gif_url(cdn_id: str) -> str:
    return f"{CDN_MEDIA_PREFIX}{cdn_id}.gif"


def parse_existing_media_url(url: Optional[str]) -> Tuple[Optional[str], bool]:
    """Retourne (stem_or_cdn_id, looks_valid)."""
    if not url or not isinstance(url, str):
        return None, False
    try:
        parsed = urlparse(url)
    except Exception:
        return None, False
    host = (parsed.hostname or "").lower()
    if host != CDN_HOST:
        return None, False
    path = parsed.path or ""
    if "/media/" not in path:
        return None, False
    name = path.rsplit("/", 1)[-1]
    stem = name.rsplit(".", 1)[0]
    if stem.isdigit():
        return stem, False
    if re.fullmatch(r"[A-Za-z0-9]{5,}", stem):
        return stem, True
    return stem or None, False


def repair_media_fields(
    doc: Dict[str, Any],
    *,
    cdn_id: Optional[str] = None,
    source_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Retourne un dict patch {media: {...}} si une réparation est nécessaire."""
    media = dict(doc.get("media") or {})
    current_url = media.get("url")
    existing_id, valid = parse_existing_media_url(current_url)
    resolved = (
        cdn_id
        or extract_cdn_id_from_path(source_path)
        or (existing_id if valid else None)
        or extract_cdn_id_from_path((doc.get("source") or {}).get("original_url"))
    )
    if not resolved:
        return {}
    new_url = build_cdn_gif_url(resolved)
    if (
        current_url == new_url
        and media.get("thumbnail_url") == new_url
        and media.get("status") == "available"
        and media.get("cdn_id") == resolved
    ):
        return {}
    return {
        "media": {
            **media,
            "type": media.get("type") or "gif",
            "url": new_url,
            "thumbnail_url": new_url,
            "status": "available",
            "cdn_id": resolved,
        }
    }

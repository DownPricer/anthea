"""Proxy / validation média exercices (mode remote | proxy_cache | download)."""

from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from typing import Dict, Optional, Set, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DEFAULT_ALLOWED_HOSTS = {
    "static.exercisedb.dev",
    "cdn.exercisedb.dev",
    "v2.exercisedb.dev",
    "raw.githubusercontent.com",
}

# Cache négatif en mémoire process
_NEGATIVE_CACHE: Dict[str, float] = {}
_NEGATIVE_TTL_SEC = 300


def media_mode() -> str:
    return (os.environ.get("EXERCISE_MEDIA_MODE") or "remote").strip().lower()


def allowed_media_hosts() -> Set[str]:
    extra = os.environ.get("EXERCISE_MEDIA_ALLOWED_HOSTS") or ""
    hosts = set(DEFAULT_ALLOWED_HOSTS)
    for part in extra.split(","):
        part = part.strip().lower()
        if part:
            hosts.add(part)
    return hosts


def is_allowed_media_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    return host in allowed_media_hosts()


def cache_dir() -> Path:
    root = Path(__file__).resolve().parent.parent
    path = Path(os.environ.get("EXERCISE_MEDIA_CACHE_DIR") or (root / "exercise-cache"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def _negative_hit(url: str) -> bool:
    ts = _NEGATIVE_CACHE.get(url)
    if ts is None:
        return False
    if time.time() - ts > _NEGATIVE_TTL_SEC:
        _NEGATIVE_CACHE.pop(url, None)
        return False
    return True


def _mark_negative(url: str) -> None:
    _NEGATIVE_CACHE[url] = time.time()


def fetch_media_bytes(
    url: str,
    *,
    timeout: int = 20,
    max_bytes: int = 5_000_000,
    retries: int = 2,
) -> Tuple[bytes, str]:
    """Télécharge un média depuis un domaine autorisé uniquement."""
    if not is_allowed_media_url(url):
        raise PermissionError("Media URL host not allowed")
    if _negative_hit(url):
        raise FileNotFoundError("Cached negative media result")

    last_err: Optional[Exception] = None
    for attempt in range(max(1, retries)):
        try:
            req = Request(url, headers={"User-Agent": "AntheaFitMatchMediaProxy/1.0"})
            with urlopen(req, timeout=timeout) as resp:
                content_type = (resp.headers.get("Content-Type") or "application/octet-stream").split(";")[0].strip()
                chunks = []
                total = 0
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValueError("Media exceeds size limit")
                    chunks.append(chunk)
                data = b"".join(chunks)
                if content_type not in (
                    "image/gif",
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "application/octet-stream",
                ):
                    # Accepter octet-stream si extension gif
                    if not url.lower().endswith((".gif", ".jpg", ".jpeg", ".png", ".webp")):
                        raise ValueError(f"Unsupported media type: {content_type}")
                if not data:
                    raise ValueError("Empty media body")
                return data, content_type if content_type != "application/octet-stream" else "image/gif"
        except HTTPError as exc:
            last_err = exc
            if exc.code == 404:
                _mark_negative(url)
                raise FileNotFoundError("Media not found") from exc
            if attempt + 1 < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise
        except (URLError, TimeoutError, ValueError) as exc:
            last_err = exc
            if attempt + 1 < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            raise
    raise RuntimeError(str(last_err))


def resolve_media_for_client(media_url: Optional[str], exercise_id: str) -> Optional[str]:
    """URL exposée au frontend selon EXERCISE_MEDIA_MODE."""
    if not media_url:
        return None
    mode = media_mode()
    if mode == "remote":
        return media_url if is_allowed_media_url(media_url) else None
    if mode in ("proxy_cache", "download"):
        return f"/api/exercises/{exercise_id}/media"
    return media_url


def cache_key_for_url(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:40]


def get_or_fetch_cached_media(url: str) -> Tuple[bytes, str]:
    key = cache_key_for_url(url)
    path = cache_dir() / f"{key}.bin"
    meta = cache_dir() / f"{key}.mime"
    if path.exists() and meta.exists():
        return path.read_bytes(), meta.read_text(encoding="utf-8").strip() or "image/gif"
    data, content_type = fetch_media_bytes(url)
    if media_mode() in ("proxy_cache", "download"):
        path.write_bytes(data)
        meta.write_text(content_type, encoding="utf-8")
    return data, content_type

"""Calcul de durée d'activité basé sur timestamps (source de vérité)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple


def parse_iso(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def compute_elapsed(
    *,
    started_at: Any,
    status: str,
    paused_at: Any = None,
    paused_seconds: float = 0,
    ended_at: Any = None,
    now: Optional[datetime] = None,
) -> Tuple[int, int, int]:
    """
    Retourne (elapsed_seconds, moving_seconds, paused_seconds_total).

    - elapsed = temps depuis started_at jusqu'à now/ended_at
    - moving = elapsed - pauses accumulées (et pause courante si status=paused)
    """
    start = parse_iso(started_at)
    if not start:
        return 0, 0, int(paused_seconds or 0)
    end = parse_iso(ended_at) if ended_at else (now or utc_now())
    if end < start:
        end = start
    elapsed = max(0, int((end - start).total_seconds()))
    paused_total = max(0, float(paused_seconds or 0))
    if status == "paused":
        pause_start = parse_iso(paused_at)
        if pause_start:
            paused_total += max(0.0, (end - pause_start).total_seconds())
    paused_int = int(round(paused_total))
    moving = max(0, elapsed - paused_int)
    return elapsed, moving, paused_int


def apply_pause(
    doc: Dict[str, Any],
    *,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Idempotent : si déjà paused, no-op."""
    if doc.get("status") == "paused":
        return doc
    if doc.get("status") not in ("active",):
        return doc
    stamp = (now or utc_now()).isoformat()
    doc["status"] = "paused"
    doc["paused_at"] = stamp
    doc["updated_at"] = stamp
    return doc


def apply_resume(
    doc: Dict[str, Any],
    *,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Idempotent : si déjà active, no-op."""
    if doc.get("status") == "active":
        return doc
    if doc.get("status") != "paused":
        return doc
    current = now or utc_now()
    pause_start = parse_iso(doc.get("paused_at"))
    extra = 0.0
    if pause_start:
        extra = max(0.0, (current - pause_start).total_seconds())
    doc["paused_seconds"] = float(doc.get("paused_seconds") or 0) + extra
    doc["paused_at"] = None
    doc["status"] = "active"
    doc["updated_at"] = current.isoformat()
    # Marqueur pour le GPS : nouveau segment
    markers = list(doc.get("segment_markers") or [])
    markers.append({"type": "resume", "at": current.isoformat()})
    doc["segment_markers"] = markers
    return doc


def refresh_timing_fields(doc: Dict[str, Any], *, now: Optional[datetime] = None) -> Dict[str, Any]:
    elapsed, moving, paused = compute_elapsed(
        started_at=doc.get("started_at"),
        status=doc.get("status") or "active",
        paused_at=doc.get("paused_at"),
        paused_seconds=doc.get("paused_seconds") or 0,
        ended_at=doc.get("ended_at"),
        now=now,
    )
    doc["elapsed_seconds"] = elapsed
    doc["moving_seconds"] = moving
    doc["paused_seconds"] = paused
    return doc

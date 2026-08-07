"""Dates calendaires YYYY-MM-DD — évite le décalage jour UTC vs locale."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Optional

_CALENDAR_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_calendar_date(value: str) -> date:
    if not value or not _CALENDAR_DATE_RE.match(value):
        raise ValueError(f"Invalid calendar date: {value}")
    return datetime.strptime(value, "%Y-%m-%d").date()


def resolve_calendar_today(local_date: Optional[str] = None) -> date:
    """Référence « aujourd'hui » : date locale client si valide, sinon UTC."""
    if local_date:
        try:
            return parse_calendar_date(local_date)
        except ValueError:
            pass
    return datetime.now(timezone.utc).date()

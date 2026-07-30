"""Normalisation et validation d'adresses e-mail."""

from __future__ import annotations

import re
from typing import Optional

# Validation pragmatique (pas de dépendance lourde côté chemins critiques)
_EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)


def normalize_email(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip().lower()
    return raw or None


def is_valid_email(value: Optional[str]) -> bool:
    normalized = normalize_email(value)
    if not normalized or len(normalized) > 254:
        return False
    return bool(_EMAIL_RE.match(normalized))


def mask_email_for_logs(value: Optional[str]) -> str:
    """Masque une adresse pour les logs (jamais d'adresse complète)."""
    normalized = normalize_email(value)
    if not normalized or "@" not in normalized:
        return "***"
    local, _, domain = normalized.partition("@")
    if not local:
        return f"***@{domain}"
    return f"{local[0]}***@{domain}"

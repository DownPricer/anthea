"""Bypass contrôlé de vérification e-mail pour comptes QA (inscription uniquement)."""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Optional, Tuple

from auth.email_norm import is_valid_email, normalize_email

QA_EMAIL_PREFIX = "///***"

_GMAIL_DOMAINS = frozenset({"gmail.com", "googlemail.com"})


def strip_qa_prefix(raw_email: str) -> Tuple[bool, str]:
    """Retourne (has_prefix, email_sans_prefixe)."""
    if not raw_email:
        return False, raw_email
    if raw_email.startswith(QA_EMAIL_PREFIX):
        return True, raw_email[len(QA_EMAIL_PREFIX) :]
    return False, raw_email


def _parse_allowlist() -> frozenset[str]:
    raw = os.environ.get("QA_EMAIL_BYPASS_ALLOWLIST", "").strip()
    if not raw:
        return frozenset()
    entries = []
    for part in re.split(r"[,;\s]+", raw):
        part = part.strip()
        if not part:
            continue
        normalized = normalize_email(part)
        if normalized and is_valid_email(normalized):
            entries.append(normalized)
    return frozenset(entries)


def _qa_bypass_flag_enabled() -> bool:
    return os.environ.get("QA_EMAIL_BYPASS_ENABLED", "false").strip().lower() == "true"


def _qa_bypass_not_expired() -> bool:
    until_raw = os.environ.get("QA_EMAIL_BYPASS_UNTIL", "").strip()
    if not until_raw:
        return True
    try:
        until = datetime.fromisoformat(until_raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) < until


def gmail_base_address(email_norm: str) -> Optional[str]:
    """Dérive l'adresse Gmail de base (sans alias +tag)."""
    if not email_norm or "@" not in email_norm:
        return None
    local, _, domain = email_norm.partition("@")
    if domain not in _GMAIL_DOMAINS:
        return email_norm
    local_base = local.split("+", 1)[0]
    if not local_base:
        return None
    return f"{local_base}@{domain}"


def is_email_in_qa_allowlist(email_norm: str) -> bool:
    """Vérifie strictement que l'identité QA est autorisée."""
    if not email_norm:
        return False
    allowlist = _parse_allowlist()
    if not allowlist:
        return False
    base = gmail_base_address(email_norm)
    if not base:
        return False
    return base in allowlist


def is_qa_bypass_authorized(raw_email: str) -> Tuple[bool, Optional[str]]:
    """
    Évalue si le bypass QA est autorisé pour cette adresse brute (register).

    Retourne (authorized, real_email_normalisée).
    """
    has_prefix, stripped = strip_qa_prefix(raw_email)
    if not has_prefix:
        return False, None

    real_email = normalize_email(stripped)
    if not real_email or not is_valid_email(real_email):
        return False, real_email

    if not _qa_bypass_flag_enabled():
        return False, real_email
    if not _qa_bypass_not_expired():
        return False, real_email
    if not is_email_in_qa_allowlist(real_email):
        return False, real_email

    return True, real_email


def hash_email_for_audit(email_norm: str) -> str:
    """Hash tronqué pour logs d'audit (jamais l'adresse complète)."""
    digest = hashlib.sha256(email_norm.encode("utf-8")).hexdigest()
    return digest[:16]

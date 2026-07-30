"""Service d'envoi d'e-mails (mock en dev / SMTP en production)."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from auth.email_norm import mask_email_for_logs

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def public_app_url() -> str:
    return (os.environ.get("PUBLIC_APP_URL") or "https://fitgather.fr").rstrip("/")


def email_verification_ttl_minutes() -> int:
    try:
        return max(1, int(os.environ.get("EMAIL_VERIFICATION_TTL_MINUTES", "60")))
    except ValueError:
        return 60


def password_reset_ttl_minutes() -> int:
    try:
        return max(1, int(os.environ.get("PASSWORD_RESET_TTL_MINUTES", "30")))
    except ValueError:
        return 30


def smtp_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST", "").strip()
        and os.environ.get("SMTP_USERNAME", "").strip()
        and os.environ.get("SMTP_PASSWORD", "").strip()
        and os.environ.get("SMTP_FROM_EMAIL", "").strip()
    )


def should_mock_smtp() -> bool:
    """Mock si SMTP non configuré, ou si SMTP_MOCK=true, ou hors production."""
    if _env_bool("SMTP_MOCK", False):
        return True
    if not smtp_configured():
        return True
    env = (os.environ.get("APP_ENV") or os.environ.get("ENV") or "").strip().lower()
    if env in ("development", "dev", "test", "testing"):
        return True
    return False


def _verification_html(verify_url: str, ttl_minutes: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Confirmez votre adresse e-mail FitGather</title></head>
<body style="font-family:Arial,sans-serif;background:#0b0b0f;color:#f5f5f5;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#16161d;border-radius:12px;padding:28px;">
    <h1 style="font-size:20px;margin:0 0 16px;">Confirmez votre adresse e-mail FitGather</h1>
    <p>Bonjour,</p>
    <p>Merci de vous être inscrit sur FitGather.</p>
    <p>Confirmez votre adresse e-mail en cliquant sur le bouton :</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{verify_url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
        Confirmer mon adresse e-mail
      </a>
    </p>
    <p style="font-size:13px;color:#a1a1aa;">Ce lien expire dans {ttl_minutes} minutes.</p>
    <p style="font-size:13px;color:#a1a1aa;">Si le bouton ne fonctionne pas, copiez ce lien :<br>{verify_url}</p>
    <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>
    <p>L’équipe FitGather</p>
  </div>
</body>
</html>"""


def _verification_text(verify_url: str, ttl_minutes: int) -> str:
    return (
        "Bonjour,\n\n"
        "Merci de vous être inscrit sur FitGather.\n\n"
        "Confirmez votre adresse e-mail en ouvrant ce lien :\n"
        f"{verify_url}\n\n"
        f"Ce lien expire dans {ttl_minutes} minutes.\n\n"
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n\n"
        "L’équipe FitGather\n"
    )


def _reset_html(reset_url: str, ttl_minutes: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Réinitialisation de votre mot de passe FitGather</title></head>
<body style="font-family:Arial,sans-serif;background:#0b0b0f;color:#f5f5f5;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#16161d;border-radius:12px;padding:28px;">
    <h1 style="font-size:20px;margin:0 0 16px;">Réinitialisation de votre mot de passe FitGather</h1>
    <p>Bonjour,</p>
    <p>Une demande de réinitialisation de mot de passe a été faite pour votre compte FitGather.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{reset_url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">
        Réinitialiser mon mot de passe
      </a>
    </p>
    <p style="font-size:13px;color:#a1a1aa;">Ce lien expire dans {ttl_minutes} minutes.</p>
    <p style="font-size:13px;color:#a1a1aa;">Si le bouton ne fonctionne pas, copiez ce lien :<br>{reset_url}</p>
    <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>
    <p>L’équipe FitGather</p>
  </div>
</body>
</html>"""


def _reset_text(reset_url: str, ttl_minutes: int) -> str:
    return (
        "Bonjour,\n\n"
        "Une demande de réinitialisation de mot de passe a été faite pour votre compte FitGather.\n\n"
        "Ouvrez ce lien pour choisir un nouveau mot de passe :\n"
        f"{reset_url}\n\n"
        f"Ce lien expire dans {ttl_minutes} minutes.\n\n"
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n\n"
        "L’équipe FitGather\n"
    )


def _send_smtp(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    host = os.environ["SMTP_HOST"].strip()
    port = int(os.environ.get("SMTP_PORT", "587") or "587")
    username = os.environ["SMTP_USERNAME"].strip()
    password = os.environ["SMTP_PASSWORD"]
    from_email = os.environ["SMTP_FROM_EMAIL"].strip()
    from_name = (os.environ.get("SMTP_FROM_NAME") or "FitGather").strip()
    use_ssl = _env_bool("SMTP_USE_SSL", False)
    starttls = _env_bool("SMTP_STARTTLS", True)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as server:
            server.login(username, password)
            server.sendmail(from_email, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            if starttls:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
            server.login(username, password)
            server.sendmail(from_email, [to_email], msg.as_string())


def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    technical_id: str,
) -> None:
    """Envoie un e-mail ou mocke l'envoi. Ne log jamais le mot de passe SMTP ni l'adresse complète."""
    masked = mask_email_for_logs(to_email)
    if should_mock_smtp():
        logger.info("smtp_mock send id=%s to=%s subject=%s", technical_id, masked, subject)
        return
    try:
        _send_smtp(to_email, subject, text_body, html_body)
        logger.info("smtp_sent id=%s to=%s", technical_id, masked)
    except Exception:
        logger.exception("smtp_failed id=%s to=%s", technical_id, masked)
        raise


def send_verification_email(*, to_email: str, token: str, technical_id: str) -> None:
    ttl = email_verification_ttl_minutes()
    url = f"{public_app_url()}/verify-email?token={token}"
    send_email(
        to_email=to_email,
        subject="Confirmez votre adresse e-mail FitGather",
        text_body=_verification_text(url, ttl),
        html_body=_verification_html(url, ttl),
        technical_id=technical_id,
    )


def send_password_reset_email(*, to_email: str, token: str, technical_id: str) -> None:
    ttl = password_reset_ttl_minutes()
    url = f"{public_app_url()}/reset-password?token={token}"
    send_email(
        to_email=to_email,
        subject="Réinitialisation de votre mot de passe FitGather",
        text_body=_reset_text(url, ttl),
        html_body=_reset_html(url, ttl),
        technical_id=technical_id,
    )

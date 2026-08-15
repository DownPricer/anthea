"""Tests bypass vérification e-mail QA (inscription uniquement)."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from starlette.responses import Response

from tests.test_email_auth import (
    FakeDB,
    _hash_pw,
    _normalize_handle,
    _request,
    _verify_pw,
    serialize_user,
)

QA_ALLOW = "qaowner@gmail.com"
QA_ALIAS = f"///***{QA_ALLOW.replace('@', '+fitgatherqa1@')}"
QA_REAL = "qaowner+fitgatherqa1@gmail.com"


@pytest.fixture
def qa_env(monkeypatch):
    monkeypatch.setenv("QA_EMAIL_BYPASS_ENABLED", "true")
    monkeypatch.setenv("QA_EMAIL_BYPASS_ALLOWLIST", QA_ALLOW)
    monkeypatch.delenv("QA_EMAIL_BYPASS_UNTIL", raising=False)


@pytest.fixture
def db():
    return FakeDB()


def _register_kwargs(db, **overrides):
    base = {
        "db": db,
        "handle": "qatestuser",
        "email": QA_ALIAS,
        "password": "secret1",
        "password_confirmation": "secret1",
        "normalize_handle_fn": _normalize_handle,
        "hash_password_fn": _hash_pw,
        "request": _request(),
    }
    base.update(overrides)
    return base


def _auth_callbacks(response=None):
    response = response or Response()
    cookies = []

    def set_cookies(resp, access, refresh):
        cookies.append((access, refresh))

    return {
        "response": response,
        "create_access_token_fn": lambda uid, u, tv=0: f"access-{uid}",
        "create_refresh_token_fn": lambda uid, tv=0: f"refresh-{uid}",
        "set_auth_cookies_fn": set_cookies,
        "serialize_user_fn": serialize_user,
        "_cookies": cookies,
    }


class TestQaBypassConfig:
    def test_gmail_base_strips_plus_alias(self):
        from auth.qa_bypass import gmail_base_address

        assert gmail_base_address("qaowner+fitgatherqa1@gmail.com") == "qaowner@gmail.com"
        assert gmail_base_address("attacker+tshopcpm@gmail.com") == "attacker@gmail.com"

    def test_non_gmail_base_is_full_address(self):
        from auth.qa_bypass import gmail_base_address

        assert gmail_base_address("user@example.com") == "user@example.com"

    def test_allowlist_rejects_similar_attack(self, qa_env):
        from auth.qa_bypass import is_email_in_qa_allowlist

        assert is_email_in_qa_allowlist("qaowner+fitgatherqa1@gmail.com") is True
        assert is_email_in_qa_allowlist("attacker+tshopcpm@gmail.com") is False

    def test_strip_prefix(self):
        from auth.qa_bypass import strip_qa_prefix

        has, stripped = strip_qa_prefix(QA_ALIAS)
        assert has is True
        assert stripped == QA_REAL


class TestQaRegisterBypass:
    @pytest.mark.asyncio
    async def test_disabled_rejects_prefix(self, db, monkeypatch):
        from auth.service import register_user

        monkeypatch.setenv("QA_EMAIL_BYPASS_ENABLED", "false")
        with pytest.raises(HTTPException) as exc:
            await register_user(**_register_kwargs(db))
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "qa_bypass_unavailable"
        assert len(db.users.docs) == 0

    @pytest.mark.asyncio
    async def test_enabled_creates_active_account(self, db, qa_env):
        from auth.service import register_user

        auth = _auth_callbacks()
        with patch("auth.service.send_verification_email") as send:
            result = await register_user(**_register_kwargs(db, **auth))
        assert result["requires_verification"] is False
        assert result["status"] == "active"
        assert result["email_verification_required"] is False
        assert result["user"]["email"] == QA_REAL
        send.assert_not_called()

        user = await db.users.find_one({"email_normalized": QA_REAL})
        assert user["email"] == QA_REAL
        assert "///***" not in user["email"]
        assert user["email_verified_at"] is not None
        assert user["account_status"] == "active"
        assert user["qa_account"] is True
        assert len(db.auth_tokens.docs) == 0
        assert auth["_cookies"]

    @pytest.mark.asyncio
    async def test_no_verify_email_token(self, db, qa_env):
        from auth.service import register_user

        with patch("auth.service.send_verification_email") as send:
            await register_user(**_register_kwargs(db, handle="qatestb"))
        send.assert_not_called()
        assert len(db.auth_tokens.docs) == 0

    @pytest.mark.asyncio
    async def test_login_with_real_email_works(self, db, qa_env):
        from auth.service import register_user, login_with_email

        with patch("auth.service.send_verification_email"):
            await register_user(**_register_kwargs(db, handle="qalogin"))

        logged = await login_with_email(
            db,
            email=QA_REAL,
            password="secret1",
            response=Response(),
            request=_request("10.0.0.50"),
            verify_password_fn=_verify_pw,
            create_access_token_fn=lambda *a, **k: "a",
            create_refresh_token_fn=lambda *a, **k: "r",
            set_auth_cookies_fn=lambda *a, **k: None,
            serialize_user_fn=serialize_user,
        )
        assert logged["email"] == QA_REAL

    @pytest.mark.asyncio
    async def test_login_with_prefix_not_special(self, db, qa_env):
        from auth.service import register_user, login_with_email, GENERIC_LOGIN_ERROR

        with patch("auth.service.send_verification_email"):
            await register_user(**_register_kwargs(db, handle="qalogin2"))

        with pytest.raises(HTTPException) as exc:
            await login_with_email(
                db,
                email=QA_ALIAS,
                password="secret1",
                response=Response(),
                request=_request("10.0.0.51"),
                verify_password_fn=_verify_pw,
                create_access_token_fn=lambda *a, **k: "a",
                create_refresh_token_fn=lambda *a, **k: "r",
                set_auth_cookies_fn=lambda *a, **k: None,
                serialize_user_fn=serialize_user,
            )
        assert exc.value.status_code == 401
        assert exc.value.detail == GENERIC_LOGIN_ERROR

    @pytest.mark.asyncio
    async def test_outside_allowlist_rejected(self, db, qa_env):
        from auth.service import register_user

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(db, email="///***nimportequoi@example.com", handle="qadenied")
            )
        assert exc.value.detail["code"] == "qa_bypass_unavailable"

    @pytest.mark.asyncio
    async def test_similar_address_rejected(self, db, qa_env):
        from auth.service import register_user

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(
                    db,
                    email="///***attacker+tshopcpm@gmail.com",
                    handle="qaattack",
                )
            )
        assert exc.value.detail["code"] == "qa_bypass_unavailable"

    @pytest.mark.asyncio
    async def test_expired_until_rejected(self, db, monkeypatch):
        from auth.service import register_user

        monkeypatch.setenv("QA_EMAIL_BYPASS_ENABLED", "true")
        monkeypatch.setenv("QA_EMAIL_BYPASS_ALLOWLIST", QA_ALLOW)
        past = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        monkeypatch.setenv("QA_EMAIL_BYPASS_UNTIL", past)

        with pytest.raises(HTTPException) as exc:
            await register_user(**_register_kwargs(db, handle="qaexpired"))
        assert exc.value.detail["code"] == "qa_bypass_unavailable"

    @pytest.mark.asyncio
    async def test_existing_email_not_modified(self, db, qa_env):
        from auth.service import register_user

        await db.users.insert_one(
            {
                "username": "existing",
                "handle": "existing",
                "password_hash": _hash_pw("otherpass1"),
                "email": QA_ALLOW,
                "email_normalized": QA_ALLOW,
                "email_verified_at": None,
                "account_status": "pending_email",
            }
        )

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(db, email=f"///***{QA_ALLOW}", handle="qadupe")
            )
        assert exc.value.detail["code"] == "email_taken"
        user = await db.users.find_one({"email_normalized": QA_ALLOW})
        assert user["email_verified_at"] is None
        assert user["account_status"] == "pending_email"
        assert len(db.auth_tokens.docs) == 0

    @pytest.mark.asyncio
    async def test_handle_uniqueness_still_enforced(self, db, qa_env):
        from auth.service import register_user

        with patch("auth.service.send_verification_email"):
            await register_user(**_register_kwargs(db, handle="qahandle"))

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(
                    db,
                    handle="qahandle",
                    email="///***qaowner+fitgatherqa2@gmail.com",
                )
            )
        assert exc.value.detail["code"] == "handle_taken"

    @pytest.mark.asyncio
    async def test_password_validation_still_active(self, db, qa_env):
        from auth.service import register_user

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(
                    db,
                    password="short",
                    password_confirmation="short",
                    handle="qapwd",
                )
            )
        assert exc.value.detail["code"] == "password_min"

    @pytest.mark.asyncio
    async def test_rate_limit_still_active(self, db, qa_env, monkeypatch):
        from auth.service import register_user
        from auth.rate_limit import LIMITS

        limit, _window = LIMITS["register"]
        same_ip = _request("192.168.99.1")
        with patch("auth.service.send_verification_email"):
            for i in range(limit):
                await register_user(
                    **_register_kwargs(
                        db,
                        handle=f"qarate{i}",
                        email=f"///***qaowner+rate{i}@gmail.com",
                        request=same_ip,
                    )
                )

        with pytest.raises(HTTPException) as exc:
            await register_user(
                **_register_kwargs(
                    db,
                    handle="qarateover",
                    email="///***qaowner+rateover@gmail.com",
                    request=same_ip,
                )
            )
        assert exc.value.status_code == 429
        assert exc.value.detail["code"] == "rate_limited"

    @pytest.mark.asyncio
    async def test_normal_register_unchanged(self, db, qa_env):
        from auth.service import register_user

        with patch("auth.service.send_verification_email") as send:
            result = await register_user(
                **_register_kwargs(
                    db,
                    email="nouvelutilisateur@example.com",
                    handle="normaluser",
                )
            )
        assert result["requires_verification"] is True
        send.assert_called_once()
        user = await db.users.find_one({"email_normalized": "nouvelutilisateur@example.com"})
        assert user["account_status"] == "pending_email"
        assert user.get("qa_account") is None
        assert len(db.auth_tokens.docs) == 1

    @pytest.mark.asyncio
    async def test_audit_log_no_full_email(self, db, qa_env, caplog):
        from auth.service import register_user

        with patch("auth.service.send_verification_email"):
            with caplog.at_level("INFO"):
                await register_user(**_register_kwargs(db, handle="qalog"))
        joined = " ".join(r.message for r in caplog.records)
        assert "QA email verification bypass used" in joined
        assert QA_REAL not in joined
        assert "email_hash=" in joined

    @pytest.mark.asyncio
    async def test_qa_accounts_b_c_d(self, db, qa_env):
        from auth.service import register_user, login_with_email

        handles = ["fitgatherqab", "fitgatherqac", "fitgatherqad"]
        emails = [
            "///***qaowner+fitgatherqab@gmail.com",
            "///***qaowner+fitgatherqac@gmail.com",
            "///***qaowner+fitgatherqad@gmail.com",
        ]
        reals = [
            "qaowner+fitgatherqab@gmail.com",
            "qaowner+fitgatherqac@gmail.com",
            "qaowner+fitgatherqad@gmail.com",
        ]

        with patch("auth.service.send_verification_email") as send:
            for handle, email in zip(handles, emails):
                result = await register_user(**_register_kwargs(db, handle=handle, email=email))
                assert result["status"] == "active"
        send.assert_not_called()

        for real in reals:
            logged = await login_with_email(
                db,
                email=real,
                password="secret1",
                response=Response(),
                request=_request("10.0.1.0"),
                verify_password_fn=_verify_pw,
                create_access_token_fn=lambda *a, **k: "a",
                create_refresh_token_fn=lambda *a, **k: "r",
                set_auth_cookies_fn=lambda *a, **k: None,
                serialize_user_fn=serialize_user,
            )
            assert logged["email"] == real

"""Tests auth e-mail : inscription, login, vérification, legacy, reset."""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import bcrypt
import pytest
from bson import ObjectId
from fastapi import HTTPException
from starlette.responses import Response

# Env avant imports auth
os.environ.setdefault("SMTP_MOCK", "true")
os.environ.setdefault("APP_ENV", "test")


def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _normalize_handle(value):
    import re

    if not value:
        return None
    raw = str(value).strip().lower().lstrip("@")
    raw = re.sub(r"[^a-z0-9_]", "", raw.replace(" ", ""))
    if not raw or not re.match(r"^[a-z0-9_]{3,30}$", raw):
        return None
    return raw


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, n=None):
        if n is None:
            return list(self._docs)
        return list(self._docs)[:n]


class FakeCollection:
    def __init__(self):
        self.docs = []
        self.indexes = []

    async def create_index(self, *args, **kwargs):
        self.indexes.append((args, kwargs))

    async def find_one(self, query, sort=None):
        matches = [d for d in self.docs if self._match(d, query)]
        if sort:
            # sort = [("created_at", -1)]
            key, direction = sort[0]
            matches.sort(key=lambda d: d.get(key) or datetime.min.replace(tzinfo=timezone.utc), reverse=direction < 0)
        return matches[0] if matches else None

    def find(self, query=None):
        query = query or {}
        return FakeCursor([d for d in self.docs if self._match(d, query)])

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)
        return SimpleNamespace(inserted_id=d["_id"])

    async def insert_many(self, docs):
        for doc in docs:
            await self.insert_one(doc)

    async def update_one(self, query, update, upsert=False):
        doc = await self.find_one(query)
        if not doc:
            if upsert:
                new_doc = {"_id": ObjectId()}
                self._apply(new_doc, update)
                # merge filter equality fields
                if isinstance(query, dict):
                    for k, v in query.items():
                        if not str(k).startswith("$"):
                            new_doc[k] = v
                self.docs.append(new_doc)
                return SimpleNamespace(modified_count=1, matched_count=0, upserted_id=new_doc["_id"])
            return SimpleNamespace(modified_count=0, matched_count=0)
        before = dict(doc)
        self._apply(doc, update)
        changed = doc != before
        return SimpleNamespace(modified_count=1 if changed else 0, matched_count=1)

    async def update_many(self, query, update):
        count = 0
        for doc in self.docs:
            if self._match(doc, query):
                self._apply(doc, update)
                count += 1
        return SimpleNamespace(modified_count=count)

    async def delete_one(self, query):
        for i, doc in enumerate(self.docs):
            if self._match(doc, query):
                self.docs.pop(i)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, query):
        keep = []
        deleted = 0
        for doc in self.docs:
            if self._match(doc, query):
                deleted += 1
            else:
                keep.append(doc)
        self.docs = keep
        return SimpleNamespace(deleted_count=deleted)

    async def count_documents(self, query):
        return len([d for d in self.docs if self._match(d, query)])

    def _apply(self, doc, update):
        if "$set" in update:
            doc.update(update["$set"])
        if "$unset" in update:
            for k in update["$unset"]:
                doc.pop(k, None)
        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = int(doc.get(k) or 0) + int(v)

    def _match(self, doc, query):
        if not query:
            return True
        if "$and" in query:
            return all(self._match(doc, q) for q in query["$and"])
        if "$or" in query:
            return any(self._match(doc, q) for q in query["$or"])
        for key, expected in query.items():
            if key in ("$and", "$or"):
                continue
            actual = doc.get(key)
            if isinstance(expected, dict):
                if "$ne" in expected and actual == expected["$ne"]:
                    return False
                if "$exists" in expected:
                    exists = key in doc and doc[key] is not None
                    if bool(expected["$exists"]) != exists and not (
                        expected["$exists"] is False and (key not in doc or doc[key] is None)
                    ):
                        # loose exists check
                        if expected["$exists"] and key not in doc:
                            return False
                        if not expected["$exists"] and key in doc and doc[key] not in (None, ""):
                            return False
                if "$gt" in expected:
                    if actual is None or not (actual > expected["$gt"]):
                        return False
                if "$type" in expected:
                    pass
                if "$ne" not in expected and "$exists" not in expected and "$gt" not in expected and "$type" not in expected:
                    return False
            else:
                if actual != expected:
                    return False
        return True


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.auth_tokens = FakeCollection()
        self.auth_rate_limits = FakeCollection()


def _request(ip="127.0.0.1", cookies=None):
    req = MagicMock()
    req.client = SimpleNamespace(host=ip)
    req.headers = {}
    req.cookies = cookies or {}
    return req


def serialize_user(user, include_email=False):
    out = {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "handle": user.get("handle") or user.get("username"),
        "account_status": user.get("account_status"),
    }
    if include_email:
        out["email"] = user.get("email")
        out["email_verified"] = bool(user.get("email_verified_at"))
    return out


@pytest.fixture
def db():
    return FakeDB()


@pytest.fixture(autouse=True)
def mock_smtp(monkeypatch):
    monkeypatch.setenv("SMTP_MOCK", "true")
    monkeypatch.setenv("APP_ENV", "test")


class TestEmailNorm:
    def test_normalize_lower_trim(self):
        from auth.email_norm import normalize_email

        assert normalize_email("  Foo@Example.COM ") == "foo@example.com"

    def test_valid_email(self):
        from auth.email_norm import is_valid_email

        assert is_valid_email("a@b.co")
        assert not is_valid_email("not-an-email")

    def test_mask_email(self):
        from auth.email_norm import mask_email_for_logs

        masked = mask_email_for_logs("alice@fitgather.fr")
        assert "alice@" not in masked
        assert masked.endswith("@fitgather.fr")
        assert "a***@" in masked


class TestTokens:
    def test_hash_not_plaintext(self):
        from auth.tokens import generate_raw_token, hash_token, tokens_equal

        raw = generate_raw_token()
        h = hash_token(raw)
        assert raw not in h
        assert tokens_equal(raw, h)
        assert not tokens_equal(raw + "x", h)

    @pytest.mark.asyncio
    async def test_token_single_use_and_expiry(self, db):
        from auth.tokens import create_token, consume_token, find_active_token_reason

        raw = await create_token(
            db,
            token_type="email_verification",
            user_id=str(ObjectId()),
            ttl_minutes=60,
            email_normalized="a@b.co",
        )
        assert await find_active_token_reason(db, raw_token=raw, token_type="email_verification") == "ok"
        doc = await consume_token(db, raw_token=raw, token_type="email_verification")
        assert doc is not None
        assert await consume_token(db, raw_token=raw, token_type="email_verification") is None
        assert await find_active_token_reason(db, raw_token=raw, token_type="email_verification") == "used"

        raw2 = await create_token(
            db,
            token_type="email_verification",
            user_id=str(ObjectId()),
            ttl_minutes=60,
            email_normalized="c@d.co",
        )
        # Force expiry
        tok = await db.auth_tokens.find_one({"token_hash": hashlib.sha256(raw2.encode()).hexdigest()})
        tok["expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
        assert await find_active_token_reason(db, raw_token=raw2, token_type="email_verification") == "expired"
        assert await consume_token(db, raw_token=raw2, token_type="email_verification") is None


class TestRegisterLoginVerify:
    @pytest.mark.asyncio
    async def test_register_valid_pending(self, db):
        from auth.service import register_user

        with patch("auth.service.send_verification_email") as send:
            result = await register_user(
                db,
                handle="FitUser",
                email="User@Example.com",
                password="secret1",
                password_confirmation="secret1",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )
        assert result["requires_verification"] is True
        send.assert_called_once()
        user = await db.users.find_one({"username": "fituser"})
        assert user["email_normalized"] == "user@example.com"
        assert user["account_status"] == "pending_email"
        assert user["email_verified_at"] is None
        assert len(db.auth_tokens.docs) == 1
        assert "token_hash" in db.auth_tokens.docs[0]
        # token never stored plaintext
        assert send.call_args.kwargs["token"] not in str(db.auth_tokens.docs[0])

    @pytest.mark.asyncio
    async def test_register_email_case_insensitive_duplicate(self, db):
        from auth.service import register_user

        with patch("auth.service.send_verification_email"):
            await register_user(
                db,
                handle="userone",
                email="dup@example.com",
                password="secret1",
                password_confirmation="secret1",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )
        with patch("auth.service.send_verification_email"):
            with pytest.raises(HTTPException) as exc:
                await register_user(
                    db,
                    handle="usertwo",
                    email="DUP@Example.com",
                    password="secret1",
                    password_confirmation="secret1",
                    normalize_handle_fn=_normalize_handle,
                    hash_password_fn=_hash_pw,
                    request=_request("10.0.0.2"),
                )
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "email_taken"

    @pytest.mark.asyncio
    async def test_register_handle_duplicate(self, db):
        from auth.service import register_user

        with patch("auth.service.send_verification_email"):
            await register_user(
                db,
                handle="samehandle",
                email="a@example.com",
                password="secret1",
                password_confirmation="secret1",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )
        with patch("auth.service.send_verification_email"):
            with pytest.raises(HTTPException) as exc:
                await register_user(
                    db,
                    handle="samehandle",
                    email="b@example.com",
                    password="secret1",
                    password_confirmation="secret1",
                    normalize_handle_fn=_normalize_handle,
                    hash_password_fn=_hash_pw,
                    request=_request("10.0.0.3"),
                )
        assert exc.value.detail["code"] == "handle_taken"

    @pytest.mark.asyncio
    async def test_register_password_mismatch(self, db):
        from auth.service import register_user

        with pytest.raises(HTTPException) as exc:
            await register_user(
                db,
                handle="okhandle",
                email="c@example.com",
                password="secret1",
                password_confirmation="other",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )
        assert exc.value.detail["code"] == "password_mismatch"

    @pytest.mark.asyncio
    async def test_verify_then_login(self, db):
        from auth.service import register_user, verify_email, login_with_email
        from auth.tokens import create_token

        captured = {}

        def capture_send(*, to_email, token, technical_id):
            captured["token"] = token

        with patch("auth.service.send_verification_email", side_effect=capture_send):
            await register_user(
                db,
                handle="verified1",
                email="v1@example.com",
                password="secret1",
                password_confirmation="secret1",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )

        response = Response()
        tokens_created = []

        def mk_access(uid, username, tv=0):
            tokens_created.append(("access", uid, tv))
            return f"access-{uid}-{tv}"

        def mk_refresh(uid, tv=0):
            tokens_created.append(("refresh", uid, tv))
            return f"refresh-{uid}-{tv}"

        cookies = []

        def set_cookies(resp, access, refresh):
            cookies.append((access, refresh))

        result = await verify_email(
            db,
            token=captured["token"],
            response=response,
            create_access_token_fn=mk_access,
            create_refresh_token_fn=mk_refresh,
            set_auth_cookies_fn=set_cookies,
            serialize_user_fn=serialize_user,
        )
        assert result["ok"] is True
        user = await db.users.find_one({"email_normalized": "v1@example.com"})
        assert user["account_status"] == "active"
        assert user["email_verified_at"]
        assert cookies

        # double use fails
        with pytest.raises(HTTPException) as exc:
            await verify_email(
                db,
                token=captured["token"],
                response=Response(),
                create_access_token_fn=mk_access,
                create_refresh_token_fn=mk_refresh,
                set_auth_cookies_fn=set_cookies,
                serialize_user_fn=serialize_user,
            )
        assert exc.value.detail["code"] == "token_used"

        login_resp = Response()
        logged = await login_with_email(
            db,
            email="V1@Example.com",
            password="secret1",
            response=login_resp,
            request=_request("10.0.0.8"),
            verify_password_fn=_verify_pw,
            create_access_token_fn=mk_access,
            create_refresh_token_fn=mk_refresh,
            set_auth_cookies_fn=set_cookies,
            serialize_user_fn=serialize_user,
        )
        assert logged["email"] == "v1@example.com"

    @pytest.mark.asyncio
    async def test_login_rejects_unverified_and_bad_password(self, db):
        from auth.service import register_user, login_with_email, GENERIC_LOGIN_ERROR

        with patch("auth.service.send_verification_email"):
            await register_user(
                db,
                handle="pending1",
                email="p1@example.com",
                password="secret1",
                password_confirmation="secret1",
                normalize_handle_fn=_normalize_handle,
                hash_password_fn=_hash_pw,
                request=_request(),
            )

        with pytest.raises(HTTPException) as exc:
            await login_with_email(
                db,
                email="p1@example.com",
                password="secret1",
                response=Response(),
                request=_request("10.0.0.9"),
                verify_password_fn=_verify_pw,
                create_access_token_fn=lambda *a, **k: "a",
                create_refresh_token_fn=lambda *a, **k: "r",
                set_auth_cookies_fn=lambda *a, **k: None,
                serialize_user_fn=serialize_user,
            )
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "email_not_verified"

        with pytest.raises(HTTPException) as exc2:
            await login_with_email(
                db,
                email="p1@example.com",
                password="wrong",
                response=Response(),
                request=_request("10.0.0.10"),
                verify_password_fn=_verify_pw,
                create_access_token_fn=lambda *a, **k: "a",
                create_refresh_token_fn=lambda *a, **k: "r",
                set_auth_cookies_fn=lambda *a, **k: None,
                serialize_user_fn=serialize_user,
            )
        assert exc2.value.status_code == 401
        assert exc2.value.detail == GENERIC_LOGIN_ERROR

        with pytest.raises(HTTPException) as exc3:
            await login_with_email(
                db,
                email="nobody@example.com",
                password="secret1",
                response=Response(),
                request=_request("10.0.0.11"),
                verify_password_fn=_verify_pw,
                create_access_token_fn=lambda *a, **k: "a",
                create_refresh_token_fn=lambda *a, **k: "r",
                set_auth_cookies_fn=lambda *a, **k: None,
                serialize_user_fn=serialize_user,
            )
        assert exc3.value.detail == GENERIC_LOGIN_ERROR


class TestLegacyMigration:
    @pytest.mark.asyncio
    async def test_legacy_migration_preserves_user_id(self, db):
        from auth.service import legacy_login, legacy_set_email, verify_legacy_email

        uid = ObjectId()
        await db.users.insert_one(
            {
                "_id": uid,
                "username": "olduser",
                "handle": "olduser",
                "password_hash": _hash_pw("oldpass1"),
                "email_migration_required": True,
                "email": None,
                "email_normalized": None,
                "account_status": "active",
                "token_version": 0,
            }
        )

        resp = Response()
        step1 = await legacy_login(
            db,
            handle="olduser",
            password="oldpass1",
            response=resp,
            request=_request(),
            normalize_handle_fn=_normalize_handle,
            verify_password_fn=_verify_pw,
            cookie_secure=False,
        )
        assert step1["step"] == "email"
        mig_cookie = None
        for k, v in resp.raw_headers:
            if k == b"set-cookie" and b"legacy_migration_token=" in v:
                mig_cookie = v.decode().split("legacy_migration_token=")[1].split(";")[0]
                break
        assert mig_cookie

        captured = {}

        def capture_send(*, to_email, token, technical_id):
            captured["token"] = token

        with patch("auth.service.send_verification_email", side_effect=capture_send):
            await legacy_set_email(
                db,
                email="new@example.com",
                request=_request(cookies={"legacy_migration_token": mig_cookie}),
                response=Response(),
                cookie_secure=False,
            )

        out = await verify_legacy_email(
            db,
            token=captured["token"],
            response=Response(),
            create_access_token_fn=lambda uid, u, tv=0: f"a-{uid}",
            create_refresh_token_fn=lambda uid, tv=0: f"r-{uid}",
            set_auth_cookies_fn=lambda *a, **k: None,
            serialize_user_fn=serialize_user,
            cookie_secure=False,
        )
        assert out["user_id"] == str(uid)
        user = await db.users.find_one({"_id": uid})
        assert user["email_normalized"] == "new@example.com"
        assert user["email_migration_required"] is False
        assert user["handle"] == "olduser"

    @pytest.mark.asyncio
    async def test_legacy_bad_password_and_cannot_steal(self, db):
        from auth.service import legacy_login, legacy_set_email

        await db.users.insert_one(
            {
                "username": "victim",
                "handle": "victim",
                "password_hash": _hash_pw("realpass"),
                "email_migration_required": True,
                "account_status": "active",
            }
        )
        await db.users.insert_one(
            {
                "username": "other",
                "handle": "other",
                "password_hash": _hash_pw("otherpass"),
                "email": "taken@example.com",
                "email_normalized": "taken@example.com",
                "email_verified_at": datetime.now(timezone.utc).isoformat(),
                "email_migration_required": False,
                "account_status": "active",
            }
        )

        with pytest.raises(HTTPException):
            await legacy_login(
                db,
                handle="victim",
                password="wrong",
                response=Response(),
                request=_request(),
                normalize_handle_fn=_normalize_handle,
                verify_password_fn=_verify_pw,
                cookie_secure=False,
            )

        # Sans cookie migration, impossible d'attacher un email
        with pytest.raises(HTTPException) as exc:
            await legacy_set_email(
                db,
                email="stolen@example.com",
                request=_request(cookies={}),
                response=Response(),
                cookie_secure=False,
            )
        assert exc.value.status_code == 401

        resp = Response()
        await legacy_login(
            db,
            handle="victim",
            password="realpass",
            response=resp,
            request=_request("10.0.1.1"),
            normalize_handle_fn=_normalize_handle,
            verify_password_fn=_verify_pw,
            cookie_secure=False,
        )
        mig = None
        for k, v in resp.raw_headers:
            if k == b"set-cookie" and b"legacy_migration_token=" in v:
                mig = v.decode().split("legacy_migration_token=")[1].split(";")[0]
        with pytest.raises(HTTPException) as exc2:
            await legacy_set_email(
                db,
                email="taken@example.com",
                request=_request(cookies={"legacy_migration_token": mig}),
                response=Response(),
                cookie_secure=False,
            )
        assert exc2.value.detail["code"] == "email_taken"


class TestPasswordReset:
    @pytest.mark.asyncio
    async def test_reset_invalidates_sessions(self, db):
        from auth.service import forgot_password, reset_password
        from auth.tokens import create_token

        uid = ObjectId()
        await db.users.insert_one(
            {
                "_id": uid,
                "username": "resetme",
                "handle": "resetme",
                "password_hash": _hash_pw("oldpass1"),
                "email": "reset@example.com",
                "email_normalized": "reset@example.com",
                "email_verified_at": datetime.now(timezone.utc).isoformat(),
                "account_status": "active",
                "token_version": 0,
            }
        )
        captured = {}

        def capture(*, to_email, token, technical_id):
            captured["token"] = token

        with patch("auth.service.send_password_reset_email", side_effect=capture):
            msg = await forgot_password(db, email="reset@example.com", request=_request())
        assert "Si un compte" in msg["message"] or "envoyé" in msg["message"]

        # Generic for unknown
        with patch("auth.service.send_password_reset_email") as send:
            msg2 = await forgot_password(db, email="unknown@example.com", request=_request("10.0.2.2"))
        assert msg2["message"] == msg["message"]
        send.assert_not_called()

        result = await reset_password(
            db,
            token=captured["token"],
            password="newpass1",
            password_confirmation="newpass1",
            hash_password_fn=_hash_pw,
        )
        assert result["ok"] is True
        user = await db.users.find_one({"_id": uid})
        assert user["token_version"] == 1
        assert _verify_pw("newpass1", user["password_hash"])
        assert not _verify_pw("oldpass1", user["password_hash"])

        # reuse token fails
        with pytest.raises(HTTPException) as exc:
            await reset_password(
                db,
                token=captured["token"],
                password="another1",
                password_confirmation="another1",
                hash_password_fn=_hash_pw,
            )
        assert exc.value.detail["code"] == "token_used"


class TestMailMock:
    def test_should_mock_without_smtp(self, monkeypatch):
        from auth import mail

        monkeypatch.delenv("SMTP_HOST", raising=False)
        monkeypatch.delenv("SMTP_USERNAME", raising=False)
        monkeypatch.delenv("SMTP_PASSWORD", raising=False)
        monkeypatch.delenv("SMTP_FROM_EMAIL", raising=False)
        monkeypatch.setenv("SMTP_MOCK", "true")
        assert mail.should_mock_smtp() is True

    def test_send_verification_mocked_no_crash(self, monkeypatch):
        from auth.mail import send_verification_email

        monkeypatch.setenv("SMTP_MOCK", "true")
        send_verification_email(
            to_email="x@y.com", token="abc", technical_id="t-1"
        )


class TestCookiesSecure:
    def test_auth_cookies_flags(self):
        # Réutilise les helpers server si importables
        os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
        os.environ.setdefault("DB_NAME", "anthea_test_auth")
        from server import set_auth_cookies
        import server

        server.COOKIE_SECURE = True
        response = Response()
        set_auth_cookies(response, "access-test", "refresh-test")
        headers = [v.decode().lower() for k, v in response.raw_headers if k == b"set-cookie"]
        assert len(headers) == 2
        for h in headers:
            assert "httponly" in h
            assert "samesite=lax" in h
            assert "path=/" in h
            assert "secure" in h
            assert "domain=" not in h


class TestSerializeNoEmailLeak:
    def test_serialize_user_hides_email_by_default(self):
        os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
        os.environ.setdefault("DB_NAME", "anthea_test_auth")
        from server import serialize_user

        user = {
            "_id": ObjectId(),
            "username": "pub",
            "handle": "pub",
            "email": "secret@example.com",
            "email_normalized": "secret@example.com",
            "email_verified_at": datetime.now(timezone.utc).isoformat(),
        }
        public = serialize_user(user)
        assert "email" not in public
        assert "email_normalized" not in public
        assert "email_verified_at" not in public
        private = serialize_user(user, include_email=True)
        assert private["email"] == "secret@example.com"
        assert private["email_verified"] is True

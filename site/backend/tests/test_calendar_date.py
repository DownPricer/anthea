"""Tests calendar_date helpers."""

from datetime import date

import pytest

from calendar_date import parse_calendar_date, resolve_calendar_today


def test_parse_calendar_date_valid():
    assert parse_calendar_date("2026-08-08") == date(2026, 8, 8)


def test_parse_calendar_date_invalid():
    with pytest.raises(ValueError):
        parse_calendar_date("08-08-2026")
    with pytest.raises(ValueError):
        parse_calendar_date("")


def test_resolve_calendar_today_uses_local_date():
    assert resolve_calendar_today("2026-08-08") == date(2026, 8, 8)


def test_resolve_calendar_today_fallback_on_invalid():
    resolved = resolve_calendar_today("not-a-date")
    assert isinstance(resolved, date)

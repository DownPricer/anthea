"""Tests unitaires pour i18n_messages."""

from push_service import build_push_payload


def test_normalize_locale_defaults():
    from i18n_messages import DEFAULT_LOCALE, normalize_locale

    assert normalize_locale(None) == DEFAULT_LOCALE
    assert normalize_locale("") == DEFAULT_LOCALE
    assert normalize_locale("fr") == "fr-FR"
    assert normalize_locale("en-US") == "en-US"
    assert normalize_locale("es") == "es-ES"
    assert normalize_locale("de-DE") == DEFAULT_LOCALE


def test_t_fallback_to_french():
    from i18n_messages import t

    assert "follow" in t("en-US", "push.new_follower.body", actor="Alice").lower()
    assert t("en-US", "challenges.solo_weekly_3_sessions.title") == "3 workouts this week"
    assert t("es-ES", "challenges.solo_weekly_3_sessions.title") == "3 sesiones esta semana"
    assert t("en-US", "missing.key.that.does.not.exist") == "missing.key.that.does.not.exist"
    assert "séances" in t("fr-FR", "challenges.solo_weekly_3_sessions.title")


def test_badge_name_localized():
    from i18n_messages import badge_name

    assert badge_name("solo_first_workout", "fr-FR") == "Premier pas"
    assert badge_name("solo_first_workout", "en-US") == "First step"
    assert badge_name("solo_first_workout", "es-ES") == "Primer paso"


def test_build_push_payload_per_locale():
    fr = build_push_payload("new_follower", locale="fr-FR", actor_name="Marie")
    en = build_push_payload("new_follower", locale="en-US", actor_name="Marie")
    es = build_push_payload("new_follower", locale="es-ES", actor_name="Marie")

    assert fr["title"] == "Nouveau follower"
    assert "Marie" in fr["body"]
    assert en["title"] == "New follower"
    assert "Marie" in en["body"]
    assert es["title"] == "Nuevo seguidor"
    assert "Marie" in es["body"]
    assert fr["tag"] == "new_follower"
    assert fr["url"] == "/notifications"


def test_localize_challenge():
    from challenges import pick_weekly_challenge

    solo = pick_weekly_challenge("solo", locale="en-US")
    assert solo.get("title")
    assert solo.get("description")
    assert solo["id"].startswith("solo_")


def test_localize_challenge_keeps_custom_text():
    from i18n_messages import localize_challenge

    custom = {
        "id": "user_custom_xyz",
        "title": "Mon défi perso",
        "description": "Texte libre utilisateur",
        "target": 3,
    }
    out = localize_challenge(custom, "en-US")
    assert out["title"] == "Mon défi perso"
    assert out["description"] == "Texte libre utilisateur"


def test_two_recipients_different_push_languages():
    fr = build_push_payload("follow_request", locale="fr-FR", actor_name="Alex")
    en = build_push_payload("follow_request", locale="en-US", actor_name="Alex")
    assert fr["title"] != en["title"]
    assert "Alex" in fr["body"]
    assert "Alex" in en["body"]


def test_historical_notification_key_fallback():
    from i18n_messages import t

    # Clé inconnue : ne doit pas lever, reste lisible (clé ou fallback)
    missing = t("fr-FR", "notifications.legacy_unknown_type.body")
    assert isinstance(missing, str) and len(missing) > 0


def test_badge_unlock_texts():
    from i18n_messages import badge_unlock_texts

    title, body = badge_unlock_texts("solo", "solo_first_workout", "common", "en-US")
    assert "badge" in title.lower() or "Badge" in title
    assert "First step" in body

"""Traductions backend — défis, notifications push et badges."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

SUPPORTED_LOCALES = ("fr-FR", "en-US", "es-ES")
DEFAULT_LOCALE = "fr-FR"

_LOCALE_ALIASES = {
    "fr": "fr-FR",
    "fr-fr": "fr-FR",
    "fr_fr": "fr-FR",
    "en": "en-US",
    "en-us": "en-US",
    "en_us": "en-US",
    "en-gb": "en-US",
    "es": "es-ES",
    "es-es": "es-ES",
    "es_es": "es-ES",
}


def normalize_locale(raw: Optional[str]) -> str:
    if not raw or not str(raw).strip():
        return DEFAULT_LOCALE
    key = str(raw).strip().replace("_", "-").lower()
    if key in _LOCALE_ALIASES:
        return _LOCALE_ALIASES[key]
    for loc in SUPPORTED_LOCALES:
        if key == loc.lower():
            return loc
    prefix = key.split("-")[0]
    for loc in SUPPORTED_LOCALES:
        if loc.lower().startswith(prefix):
            return loc
    return DEFAULT_LOCALE


def _deep_get(data: Dict[str, Any], key: str) -> Optional[str]:
    cur: Any = data
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return str(cur) if cur is not None else None


def t(locale: Optional[str], key: str, **params: Any) -> str:
    """Traduit une clé pointée (ex. push.follow_request.title). Retombe sur fr-FR."""
    loc = normalize_locale(locale)
    text = _deep_get(_MESSAGES.get(loc, {}), key)
    if text is None and loc != DEFAULT_LOCALE:
        text = _deep_get(_MESSAGES.get(DEFAULT_LOCALE, {}), key)
    if text is None:
        text = key
    if params:
        try:
            return text.format(**params)
        except (KeyError, ValueError, IndexError):
            logger.debug("i18n format failed for key=%s locale=%s", key, loc)
            return text
    return text


def badge_name(badge_id: str, locale: Optional[str] = None) -> str:
    loc = normalize_locale(locale)
    key = f"badges.{badge_id}"
    translated = _deep_get(_MESSAGES.get(loc, {}), key)
    if translated:
        return translated
    if loc != DEFAULT_LOCALE:
        translated = _deep_get(_MESSAGES.get(DEFAULT_LOCALE, {}), key)
        if translated:
            return translated
    try:
        from badge_catalog import BADGE_BY_ID
        return BADGE_BY_ID.get(badge_id, {}).get("name", badge_id)
    except Exception:
        return badge_id or ""


def rarity_label(rarity: str, locale: Optional[str] = None) -> str:
    loc = normalize_locale(locale)
    key = f"rarity.{rarity or 'common'}"
    label = _deep_get(_MESSAGES.get(loc, {}), key)
    if label:
        return label
    if loc != DEFAULT_LOCALE:
        label = _deep_get(_MESSAGES.get(DEFAULT_LOCALE, {}), key)
        if label:
            return label
    return rarity or "common"


def localize_challenge(challenge: dict, locale: Optional[str] = None) -> dict:
    """Ajoute title/description localisés à partir de challenge['id'].

    Ne remplace jamais un défi personnalisé (titre utilisateur) :
    si aucune traduction système n'existe, conserve title/description d'origine.
    """
    if not challenge:
        return challenge
    loc = normalize_locale(locale)
    cid = str(challenge.get("id") or "")
    out = dict(challenge)
    if not cid:
        return out

    title_key = f"challenges.{cid}.title"
    desc_key = f"challenges.{cid}.description"
    title = _deep_get(_MESSAGES.get(loc, {}), title_key)
    if title is None and loc != DEFAULT_LOCALE:
        title = _deep_get(_MESSAGES.get(DEFAULT_LOCALE, {}), title_key)
    desc = _deep_get(_MESSAGES.get(loc, {}), desc_key)
    if desc is None and loc != DEFAULT_LOCALE:
        desc = _deep_get(_MESSAGES.get(DEFAULT_LOCALE, {}), desc_key)

    if title:
        out["title"] = title
    if desc:
        out["description"] = desc
    return out


def badge_unlock_texts(
    scope: str,
    badge_id: str,
    rarity: str,
    locale: Optional[str] = None,
) -> tuple[str, str]:
    loc = normalize_locale(locale)
    name = badge_name(badge_id, loc)
    rarity_l = rarity_label(rarity, loc)
    if scope == "duo":
        title = t(loc, "notifications.duo_badge_unlocked.title")
        body = t(loc, "notifications.duo_badge_unlocked.body", badge=name)
    else:
        title = t(loc, "notifications.badge_unlocked.title", rarity=rarity_l)
        body = t(loc, "notifications.badge_unlocked.body", badge=name)
    return title, body


def _challenge_block(
    fr_title: str, fr_desc: str,
    en_title: str, en_desc: str,
    es_title: str, es_desc: str,
) -> Dict[str, Dict[str, str]]:
    return {
        "title": fr_title,
        "description": fr_desc,
        "_en_title": en_title,
        "_en_desc": en_desc,
        "_es_title": es_title,
        "_es_desc": es_desc,
    }


def _build_challenge_messages() -> Dict[str, Dict[str, Dict[str, str]]]:
    """Construit challenges.{id}.title/description pour chaque locale."""
    raw = {
        "solo_weekly_3_sessions": _challenge_block(
            "3 séances cette semaine", "Terminer 3 séances cette semaine",
            "3 workouts this week", "Complete 3 workouts this week",
            "3 sesiones esta semana", "Completa 3 sesiones esta semana",
        ),
        "solo_weekly_90_min": _challenge_block(
            "90 minutes cumulées", "Cumuler 90 minutes d'entraînement cette semaine",
            "90 minutes total", "Accumulate 90 minutes of training this week",
            "90 minutos acumulados", "Acumula 90 minutos de entrenamiento esta semana",
        ),
        "solo_weekly_3_days": _challenge_block(
            "3 jours actifs", "S'entraîner sur 3 jours différents cette semaine",
            "3 active days", "Train on 3 different days this week",
            "3 días activos", "Entrena en 3 días diferentes esta semana",
        ),
        "solo_weekly_all_planned": _challenge_block(
            "Semaine parfaite", "Terminer toutes les séances planifiées de la semaine",
            "Perfect week", "Complete all planned workouts for the week",
            "Semana perfecta", "Completa todas las sesiones planificadas de la semana",
        ),
        "solo_weekly_no_miss": _challenge_block(
            "Zéro oubli", "Ne manquer aucune séance planifiée passée",
            "Zero missed", "Don't miss any past planned workout",
            "Cero olvidos", "No faltes a ninguna sesión planificada pasada",
        ),
        "solo_weekly_2_streak": _challenge_block(
            "2 jours d'affilée", "Faire une séance 2 jours consécutifs",
            "2 days in a row", "Work out 2 consecutive days",
            "2 días seguidos", "Entrena 2 días consecutivos",
        ),
        "solo_weekly_streak_5": _challenge_block(
            "Streak de 5", "Atteindre une streak de 5 jours",
            "5-day streak", "Reach a 5-day streak",
            "Racha de 5", "Alcanza una racha de 5 días",
        ),
        "duo_weekly_3_each": _challenge_block(
            "3 séances chacun cette semaine", "Toi et ton partenaire : 3 séances terminées chacun",
            "3 workouts each this week", "You and your partner: 3 completed workouts each",
            "3 sesiones cada uno esta semana", "Tú y tu pareja: 3 sesiones completadas cada uno",
        ),
        "duo_weekly_5_combined": _challenge_block(
            "5 séances combinées", "Au total 5 séances terminées à deux",
            "5 combined workouts", "5 completed workouts together in total",
            "5 sesiones combinadas", "5 sesiones completadas juntos en total",
        ),
        "duo_weekly_120_min": _challenge_block(
            "120 minutes à deux", "Cumulez 120 min de sport cette semaine",
            "120 minutes together", "Accumulate 120 min of exercise this week",
            "120 minutos juntos", "Acumulad 120 min de deporte esta semana",
        ),
        "duo_weekly_all_planned": _challenge_block(
            "Semaine parfaite", "Terminer toutes les séances planifiées de la semaine",
            "Perfect week", "Complete all planned workouts for the week",
            "Semana perfecta", "Completad todas las sesiones planificadas de la semana",
        ),
        "duo_weekly_no_miss": _challenge_block(
            "Zéro oubli", "Ne manquer aucune séance planifiée passée",
            "Zero missed", "Don't miss any past planned workout",
            "Cero olvidos", "No falten a ninguna sesión planificada pasada",
        ),
        "duo_weekly_2_streak": _challenge_block(
            "2 jours d'affilée", "Faire une séance 2 jours consécutifs",
            "2 days in a row", "Work out 2 consecutive days",
            "2 días seguidos", "Entrenad 2 días consecutivos",
        ),
        "duo_weekly_same_day": _challenge_block(
            "Même jour ensemble", "Séance le même jour que ton partenaire",
            "Same day together", "Work out on the same day as your partner",
            "Mismo día juntos", "Entrena el mismo día que tu pareja",
        ),
        "duo_weekly_streak_5": _challenge_block(
            "Streak de 5", "Atteindre une streak de 5 jours",
            "5-day streak", "Reach a 5-day streak",
            "Racha de 5", "Alcanzad una racha de 5 días",
        ),
        "duo_weekly_3_encourage": _challenge_block(
            "3 encouragements", "Envoyer 3 encouragements cette semaine",
            "3 encouragements", "Send 3 encouragements this week",
            "3 ánimos", "Envía 3 ánimos esta semana",
        ),
    }
    fr: Dict[str, Dict[str, str]] = {}
    en: Dict[str, Dict[str, str]] = {}
    es: Dict[str, Dict[str, str]] = {}
    for cid, block in raw.items():
        fr[cid] = {"title": block["title"], "description": block["description"]}
        en[cid] = {"title": block["_en_title"], "description": block["_en_desc"]}
        es[cid] = {"title": block["_es_title"], "description": block["_es_desc"]}
    return {"fr-FR": fr, "en-US": en, "es-ES": es}


def _push_entry(fr_t, fr_b, en_t, en_b, es_t, es_b):
    return {
        "fr": (fr_t, fr_b),
        "en": (en_t, en_b),
        "es": (es_t, es_b),
    }


_PUSH_RAW = {
    "follow_request": _push_entry(
        "Nouvelle demande de suivi", "{actor} souhaite vous suivre.",
        "New follow request", "{actor} wants to follow you.",
        "Nueva solicitud de seguimiento", "{actor} quiere seguirte.",
    ),
    "new_follower": _push_entry(
        "Nouveau follower", "{actor} vous suit maintenant.",
        "New follower", "{actor} is now following you.",
        "Nuevo seguidor", "{actor} te sigue ahora.",
    ),
    "follow_accepted": _push_entry(
        "Demande acceptée", "{actor} a accepté votre demande de suivi.",
        "Request accepted", "{actor} accepted your follow request.",
        "Solicitud aceptada", "{actor} aceptó tu solicitud de seguimiento.",
    ),
    "follow_back": _push_entry(
        "Nouveau follower", "{actor} vous suit en retour.",
        "New follower", "{actor} followed you back.",
        "Nuevo seguidor", "{actor} te sigue de vuelta.",
    ),
    "duo_follow_request": _push_entry(
        "Nouvelle demande Duo", "Une personne souhaite suivre votre profil Duo.",
        "New Duo request", "Someone wants to follow your Duo profile.",
        "Nueva solicitud Duo", "Alguien quiere seguir vuestro perfil Duo.",
    ),
    "duo_follow_accepted": _push_entry(
        "Demande Duo acceptée", "Votre demande pour suivre un Duo a été acceptée.",
        "Duo request accepted", "Your request to follow a Duo was accepted.",
        "Solicitud Duo aceptada", "Vuestra solicitud para seguir un Duo fue aceptada.",
    ),
    "duo_partner_request": _push_entry(
        "Demande de Duo reçue", "{actor} souhaite former un Duo avec vous.",
        "Duo request received", "{actor} wants to form a Duo with you.",
        "Solicitud de Dúo recibida", "{actor} quiere formar un Dúo contigo.",
    ),
    "duo_request_received": _push_entry(
        "Demande de Duo reçue", "{actor} souhaite former un Duo avec vous.",
        "Duo request received", "{actor} wants to form a Duo with you.",
        "Solicitud de Dúo recibida", "{actor} quiere formar un Dúo contigo.",
    ),
    "duo_partner_accepted": _push_entry(
        "Duo accepté", "{actor} a accepté votre demande Duo.",
        "Duo accepted", "{actor} accepted your Duo request.",
        "Duo aceptado", "{actor} aceptó tu solicitud Duo.",
    ),
    "duo_partner_rejected": _push_entry(
        "Demande Duo refusée", "{actor} a refusé votre demande Duo.",
        "Duo request declined", "{actor} declined your Duo request.",
        "Solicitud Duo rechazada", "{actor} rechazó tu solicitud Duo.",
    ),
    "duo_new_post": _push_entry(
        "Nouvelle publication Duo", "Une nouvelle publication est disponible sur votre mur Duo.",
        "New Duo post", "A new post is available on your Duo wall.",
        "Nueva publicación Duo", "Hay una nueva publicación en vuestro muro Duo.",
    ),
    "session_reminder": _push_entry(
        "Rappel de séance", "Votre séance planifiée approche.",
        "Workout reminder", "Your scheduled workout is coming up.",
        "Recordatorio de sesión", "Tu sesión planificada se acerca.",
    ),
    "session_soon": _push_entry(
        "Séance bientôt", "Une séance planifiée commence bientôt.",
        "Workout starting soon", "A scheduled workout starts soon.",
        "Sesión pronto", "Una sesión planificada empieza pronto.",
    ),
    "challenge_ending": _push_entry(
        "Défi hebdomadaire", "Le défi de la semaine se termine bientôt.",
        "Weekly challenge", "This week's challenge is ending soon.",
        "Desafío semanal", "El desafío de la semana termina pronto.",
    ),
    "challenge_completed": _push_entry(
        "Défi réussi", "Un défi a été terminé avec succès.",
        "Challenge completed", "A challenge was completed successfully.",
        "Desafío completado", "Un desafío se completó con éxito.",
    ),
    "badge_unlocked": _push_entry(
        "Badge débloqué", "Vous avez débloqué un nouveau badge !",
        "Badge unlocked", "You unlocked a new badge!",
        "Insignia desbloqueada", "¡Has desbloqueado una nueva insignia!",
    ),
    "duo_badge_unlocked": _push_entry(
        "Nouveau badge Duo", "Votre Duo a obtenu un nouveau succès !",
        "New Duo badge", "Your Duo earned a new achievement!",
        "Nueva insignia Duo", "¡Vuestro Duo obtuvo un nuevo logro!",
    ),
    "partner_activity": _push_entry(
        "Activité du partenaire", "{actor} s'est entraîné(e).",
        "Partner activity", "{actor} worked out.",
        "Actividad de la pareja", "{actor} entrenó.",
    ),
    "partner_workout_started": _push_entry(
        "Séance commencée", "{actor} vient de commencer une séance.",
        "Workout started", "{actor} has just started a workout.",
        "Sesión iniciada", "{actor} acaba de comenzar una sesión.",
    ),
    "partner_workout_completed": _push_entry(
        "Séance terminée", "{actor} a terminé une séance.",
        "Workout completed", "{actor} finished a workout.",
        "Sesión terminada", "{actor} terminó una sesión.",
    ),
    "like": _push_entry(
        "Nouveau like", "{actor} a aimé votre publication.",
        "New like", "{actor} liked your post.",
        "Nuevo me gusta", "{actor} le gustó tu publicación.",
    ),
    "comment": _push_entry(
        "Nouveau commentaire", "{actor} a commenté votre publication.",
        "New comment", "{actor} commented on your post.",
        "Nuevo comentario", "{actor} comentó tu publicación.",
    ),
    "comment_reply": _push_entry(
        "Réponse à votre commentaire", "{actor} a répondu à votre commentaire.",
        "Reply to your comment", "{actor} replied to your comment.",
        "Respuesta a tu comentario", "{actor} respondió a tu comentario.",
    ),
    "comment_like": _push_entry(
        "Like sur commentaire", "{actor} a aimé votre commentaire.",
        "Comment liked", "{actor} liked your comment.",
        "Me gusta en comentario", "{actor} le gustó tu comentario.",
    ),
    "comment_like_grouped": _push_entry(
        "Likes sur commentaire", "Plusieurs personnes ont aimé votre commentaire.",
        "Comment likes", "Several people liked your comment.",
        "Me gusta en comentario", "Varias personas le dieron me gusta a tu comentario.",
    ),
    "followed_user_post": _push_entry(
        "Nouvelle publication", "{actor} a publié quelque chose.",
        "New post", "{actor} posted something.",
        "Nueva publicación", "{actor} publicó algo.",
    ),
    "streak_reminder": _push_entry(
        "Rappel de streak", "N'oubliez pas votre série d'entraînement.",
        "Streak reminder", "Don't forget your workout streak.",
        "Recordatorio de racha", "No olvides tu racha de entrenamiento.",
    ),
}


def _build_push_messages() -> Dict[str, Dict[str, str]]:
    fr: Dict[str, str] = {"generic.title": "FitGather", "generic.body": "Nouvelle activité"}
    en: Dict[str, str] = {"generic.title": "FitGather", "generic.body": "New activity"}
    es: Dict[str, str] = {"generic.title": "FitGather", "generic.body": "Nueva actividad"}
    for ntype, entry in _PUSH_RAW.items():
        fr[f"push.{ntype}.title"] = entry["fr"][0]
        fr[f"push.{ntype}.body"] = entry["fr"][1]
        en[f"push.{ntype}.title"] = entry["en"][0]
        en[f"push.{ntype}.body"] = entry["en"][1]
        es[f"push.{ntype}.title"] = entry["es"][0]
        es[f"push.{ntype}.body"] = entry["es"][1]
    return {"fr-FR": fr, "en-US": en, "es-ES": es}


def _build_badge_name_messages() -> Dict[str, Dict[str, str]]:
    try:
        from badge_catalog import BADGE_BY_ID
    except Exception:
        return {"fr-FR": {}, "en-US": {}, "es-ES": {}}

    fr: Dict[str, str] = {}
    en: Dict[str, str] = {}
    es: Dict[str, str] = {}

    # Traductions EN/ES — clés absentes retombent sur le nom FR du catalogue.
    _EN: Dict[str, str] = {
        "solo_first_workout": "First step",
        "solo_three_workouts": "Let's go",
        "solo_five_workouts": "New habit",
        "solo_three_days_week": "Active week",
        "solo_early_workout": "Morning muscles",
        "solo_night_workout": "Night owl",
        "solo_thirty_minutes": "Thirty minutes",
        "solo_sixty_minutes": "An hour for yourself",
        "solo_hundred_minutes": "First hundred",
        "solo_five_hundred_calories": "First flames",
        "solo_streak_three": "Three days in",
        "solo_streak_five": "Five solid days",
        "solo_first_no_abandon": "All the way",
        "solo_three_categories": "Explorer",
        "solo_legs_workout": "Legs on fire",
        "solo_upper_body_workout": "Upper body",
        "solo_cardio_workout": "Heart in action",
        "solo_mobility_workout": "Flexibility restored",
        "solo_first_planned_workout": "Organized",
        "solo_first_custom_workout": "Creator",
        "solo_ten_workouts": "Ten out of ten",
        "solo_twenty_five_workouts": "Real rhythm",
        "solo_ten_active_days": "Ten active days",
        "solo_fifteen_hours": "Fifteen hours",
        "solo_five_thousand_calories": "Furnace",
        "solo_streak_seven": "Perfect week",
        "solo_streak_ten": "Ten days straight",
        "solo_four_workouts_week": "Busy week",
        "solo_five_categories": "Versatile",
        "solo_ten_planned_completed": "Plan honored",
        "solo_three_early_workouts": "Early bird",
        "solo_three_night_workouts": "After dark",
        "solo_five_no_skips": "No exercise left behind",
        "solo_comeback": "The comeback",
        "solo_first_weekly_challenge": "Challenge accepted",
        "solo_fifty_workouts": "Fifty workouts",
        "solo_fifty_active_days": "Fifty active days",
        "solo_fifty_hours": "Fifty hours",
        "solo_twenty_five_thousand_calories": "Personal blaze",
        "solo_streak_twenty_one": "Three solid weeks",
        "solo_ten_challenges": "Challenge hunter",
        "solo_twelve_workouts_month": "Intense month",
        "solo_twenty_five_planned": "Always on time",
        "solo_regular_month": "Regular month",
        "solo_ten_no_skips": "Zero shortcuts",
        "solo_one_hundred_workouts": "Centurion",
        "solo_one_hundred_hours": "Time master",
        "solo_one_hundred_active_days": "One hundred active days",
        "solo_forty_active_weeks": "Sport year",
        "solo_two_hundred_fifty_workouts": "Titan",
        "duo_created": "The adventure begins",
        "duo_first_common_workout": "First workout together",
        "duo_three_common_workouts": "Workout trio",
        "duo_five_common_workouts": "Five together",
        "duo_same_active_day": "Same day",
        "duo_three_workouts_week": "Shared week",
        "duo_first_challenge_participation": "First Duo challenge",
        "duo_first_post": "First post",
        "duo_first_encouragement": "First encouragement",
        "duo_first_planned_workout": "Scheduled meetup",
        "duo_same_program": "Same program",
        "duo_sixty_common_minutes": "One hour together",
        "duo_three_active_days": "Three Duo days",
        "duo_streak_three": "Small shared streak",
        "duo_roles_configured": "Organized team",
        "duo_banner_configured": "Our identity",
        "duo_privacy_configured": "Profile configured",
        "duo_first_goal": "Shared goal",
        "duo_first_active_week": "First week done",
        "duo_comeback": "Back stronger",
        "duo_ten_common_workouts": "Ten workouts together",
        "duo_twenty_five_common_workouts": "Twenty-five together",
        "duo_ten_active_days": "Ten shared days",
        "duo_ten_common_hours": "Ten hours together",
        "duo_streak_seven": "Tight week",
        "duo_four_common_workouts_week": "Intensive week",
        "duo_three_challenges": "Challenge streak",
        "duo_double_individual_goal": "Double goal",
        "duo_ten_planned_completed": "Duo plan honored",
        "duo_ten_encouragements": "Mutual support",
        "duo_five_categories": "Versatile Duo",
        "duo_three_early_workouts": "Morning Duo",
        "duo_three_night_workouts": "Night Duo",
        "duo_five_without_abandon": "Nobody quits",
        "duo_active_thirty_days": "One month together",
        "duo_fifty_common_workouts": "Fifty together",
        "duo_fifty_active_days": "Fifty shared days",
        "duo_fifty_common_hours": "Fifty hours together",
        "duo_streak_twenty_one": "Three inseparable weeks",
        "duo_ten_challenges": "Challenge masters",
        "duo_twenty_planned_completed": "Always there",
        "duo_regular_month": "Perfectly regular month",
        "duo_fifteen_without_abandon": "No quitting",
        "duo_one_hundred_combined_activities": "One hundred combined activities",
        "duo_ten_badges": "Collectors",
        "duo_one_hundred_common_workouts": "One hundred workouts together",
        "duo_one_hundred_common_hours": "One hundred hours together",
        "duo_one_hundred_active_days": "One hundred bonded days",
        "duo_forty_challenges": "A year of challenges",
        "duo_legendary": "Legendary Duo",
    }
    _ES: Dict[str, str] = {
        "solo_first_workout": "Primer paso",
        "solo_three_workouts": "Vamos",
        "solo_five_workouts": "Nuevo hábito",
        "solo_three_days_week": "Semana activa",
        "solo_early_workout": "Despertar muscular",
        "solo_night_workout": "Noctámbulo",
        "solo_thirty_minutes": "Treinta minutos",
        "solo_sixty_minutes": "Una hora para ti",
        "solo_hundred_minutes": "Primera centena",
        "solo_five_hundred_calories": "Primeras llamas",
        "solo_streak_three": "Tres días seguidos",
        "solo_streak_five": "Cinco días sólidos",
        "solo_first_no_abandon": "Hasta el final",
        "solo_three_categories": "Explorador",
        "solo_legs_workout": "Piernas en llamas",
        "solo_upper_body_workout": "Parte superior",
        "solo_cardio_workout": "Corazón en acción",
        "solo_mobility_workout": "Flexibilidad recuperada",
        "solo_first_planned_workout": "Organizado",
        "solo_first_custom_workout": "Creador",
        "solo_ten_workouts": "Diez de diez",
        "solo_twenty_five_workouts": "Buen ritmo",
        "solo_ten_active_days": "Diez días activos",
        "solo_fifteen_hours": "Quince horas",
        "solo_five_thousand_calories": "Horno",
        "solo_streak_seven": "Semana perfecta",
        "solo_streak_ten": "Diez días seguidos",
        "solo_four_workouts_week": "Semana cargada",
        "solo_five_categories": "Polivalente",
        "solo_ten_planned_completed": "Plan cumplido",
        "solo_three_early_workouts": "Madrugador",
        "solo_three_night_workouts": "Tras el anochecer",
        "solo_five_no_skips": "Ningún ejercicio olvidado",
        "solo_comeback": "El regreso",
        "solo_first_weekly_challenge": "Desafío aceptado",
        "solo_fifty_workouts": "Cincuenta sesiones",
        "solo_fifty_active_days": "Cincuenta días activos",
        "solo_fifty_hours": "Cincuenta horas",
        "solo_twenty_five_thousand_calories": "Brasero personal",
        "solo_streak_twenty_one": "Tres semanas sólidas",
        "solo_ten_challenges": "Cazador de desafíos",
        "solo_twelve_workouts_month": "Mes intenso",
        "solo_twenty_five_planned": "Siempre puntual",
        "solo_regular_month": "Mes regular",
        "solo_ten_no_skips": "Cero atajos",
        "solo_one_hundred_workouts": "Centurión",
        "solo_one_hundred_hours": "Maestro del tiempo",
        "solo_one_hundred_active_days": "Cien días activos",
        "solo_forty_active_weeks": "Año deportivo",
        "solo_two_hundred_fifty_workouts": "Titán",
        "duo_created": "La aventura comienza",
        "duo_first_common_workout": "Primera sesión juntos",
        "duo_three_common_workouts": "Trío de sesiones",
        "duo_five_common_workouts": "Cinco juntos",
        "duo_same_active_day": "Mismo día",
        "duo_three_workouts_week": "Semana compartida",
        "duo_first_challenge_participation": "Primer desafío Duo",
        "duo_first_post": "Primera publicación",
        "duo_first_encouragement": "Primer ánimo",
        "duo_first_planned_workout": "Cita programada",
        "duo_same_program": "Mismo programa",
        "duo_sixty_common_minutes": "Una hora juntos",
        "duo_three_active_days": "Tres días Duo",
        "duo_streak_three": "Pequeña racha compartida",
        "duo_roles_configured": "Equipo organizado",
        "duo_banner_configured": "Nuestra identidad",
        "duo_privacy_configured": "Perfil configurado",
        "duo_first_goal": "Objetivo común",
        "duo_first_active_week": "Primera semana completada",
        "duo_comeback": "Volvemos más fuertes",
        "duo_ten_common_workouts": "Diez sesiones juntos",
        "duo_twenty_five_common_workouts": "Veinticinco juntos",
        "duo_ten_active_days": "Diez días compartidos",
        "duo_ten_common_hours": "Diez horas juntos",
        "duo_streak_seven": "Semana unida",
        "duo_four_common_workouts_week": "Semana intensiva",
        "duo_three_challenges": "Desafíos en serie",
        "duo_double_individual_goal": "Doble objetivo",
        "duo_ten_planned_completed": "Plan Duo cumplido",
        "duo_ten_encouragements": "Apoyo mutuo",
        "duo_five_categories": "Duo polivalente",
        "duo_three_early_workouts": "Duo matutino",
        "duo_three_night_workouts": "Duo nocturno",
        "duo_five_without_abandon": "Nadie se rinde",
        "duo_active_thirty_days": "Un mes juntos",
        "duo_fifty_common_workouts": "Cincuenta juntos",
        "duo_fifty_active_days": "Cincuenta días compartidos",
        "duo_fifty_common_hours": "Cincuenta horas juntos",
        "duo_streak_twenty_one": "Tres semanas inseparables",
        "duo_ten_challenges": "Maestros del desafío",
        "duo_twenty_planned_completed": "Siempre presentes",
        "duo_regular_month": "Mes perfectamente regular",
        "duo_fifteen_without_abandon": "Sin abandonos",
        "duo_one_hundred_combined_activities": "Cien actividades combinadas",
        "duo_ten_badges": "Coleccionistas",
        "duo_one_hundred_common_workouts": "Cien sesiones juntos",
        "duo_one_hundred_common_hours": "Cien horas juntos",
        "duo_one_hundred_active_days": "Cien días unidos",
        "duo_forty_challenges": "Un año de desafíos",
        "duo_legendary": "Duo legendario",
    }

    for bid, badge in BADGE_BY_ID.items():
        name_fr = badge.get("name", bid)
        fr[f"badges.{bid}"] = name_fr
        en[f"badges.{bid}"] = _EN.get(bid, name_fr)
        es[f"badges.{bid}"] = _ES.get(bid, name_fr)

    return {"fr-FR": fr, "en-US": en, "es-ES": es}


def _merge_locale_trees(*trees: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {loc: {} for loc in SUPPORTED_LOCALES}
    for tree in trees:
        for loc, flat in tree.items():
            bucket = out.setdefault(loc, {})
            for key, value in flat.items():
                parts = key.split(".")
                cur = bucket
                for part in parts[:-1]:
                    if part not in cur or not isinstance(cur[part], dict):
                        cur[part] = {}
                    cur = cur[part]
                cur[parts[-1]] = value
    return out


_challenge_trees = _build_challenge_messages()
_push_trees = _build_push_messages()
_badge_trees = _build_badge_name_messages()

_STATIC = {
    "fr-FR": {
        "rarity.common": "commun",
        "rarity.rare": "rare",
        "rarity.epic": "épique",
        "rarity.legendary": "légendaire",
        "notifications.badge_unlocked.title": "Nouveau badge {rarity} !",
        "notifications.badge_unlocked.body": "Vous avez débloqué « {badge} ».",
        "notifications.duo_badge_unlocked.title": "Nouveau badge Duo",
        "notifications.duo_badge_unlocked.body": "Votre Duo a obtenu « {badge} ».",
        "push.generic.title": "FitGather",
        "push.generic.body": "Nouvelle activité",
        "push.generic.actor": "Quelqu'un",
    },
    "en-US": {
        "rarity.common": "common",
        "rarity.rare": "rare",
        "rarity.epic": "epic",
        "rarity.legendary": "legendary",
        "notifications.badge_unlocked.title": "New {rarity} badge!",
        "notifications.badge_unlocked.body": "You unlocked “{badge}”.",
        "notifications.duo_badge_unlocked.title": "New Duo badge",
        "notifications.duo_badge_unlocked.body": "Your Duo earned “{badge}”.",
        "push.generic.title": "FitGather",
        "push.generic.body": "New activity",
        "push.generic.actor": "Someone",
    },
    "es-ES": {
        "rarity.common": "común",
        "rarity.rare": "raro",
        "rarity.epic": "épico",
        "rarity.legendary": "legendario",
        "notifications.badge_unlocked.title": "¡Nueva insignia {rarity}!",
        "notifications.badge_unlocked.body": "Has desbloqueado « {badge} ».",
        "notifications.duo_badge_unlocked.title": "Nueva insignia Duo",
        "notifications.duo_badge_unlocked.body": "Vuestro Duo obtuvo « {badge} ».",
        "push.generic.title": "FitGather",
        "push.generic.body": "Nueva actividad",
        "push.generic.actor": "Alguien",
    },
}

# Flatten challenge trees into dotted keys
def _flatten_challenges(tree: Dict[str, Dict[str, Dict[str, str]]]) -> Dict[str, Dict[str, str]]:
    flat: Dict[str, Dict[str, str]] = {loc: {} for loc in SUPPORTED_LOCALES}
    for loc, challenges in tree.items():
        for cid, fields in challenges.items():
            flat[loc][f"challenges.{cid}.title"] = fields["title"]
            flat[loc][f"challenges.{cid}.description"] = fields["description"]
    return flat


_MESSAGES: Dict[str, Dict[str, Any]] = _merge_locale_trees(
    _STATIC,
    _flatten_challenges(_challenge_trees),
    _push_trees,
    _badge_trees,
)


async def load_user_locale(db, user_id: str) -> str:
    """Charge la locale d'un utilisateur depuis MongoDB."""
    try:
        from bson import ObjectId
        doc = await db.users.find_one(
            {"_id": ObjectId(str(user_id))},
            {"locale": 1},
        )
        return normalize_locale(doc.get("locale") if doc else None)
    except Exception:
        return DEFAULT_LOCALE

"""Catalogue fixe et versionné des badges Solo / Duo (v1).

Les identifiants sont stables et ne doivent jamais dépendre du nom affiché.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

CATALOG_VERSION = 1

RARITY_POINTS = {
    "common": 10,
    "rare": 25,
    "epic": 60,
    "legendary": 150,
}

RARITY_LABELS = {
    "common": "Commun",
    "rare": "Rare",
    "epic": "Épique",
    "legendary": "Légendaire",
}

# Anciens IDs → IDs canoniques (préserve featured_badges / posts historiques).
LEGACY_BADGE_ID_MAP: Dict[str, str] = {
    "streak_3": "solo_streak_three",
    "streak_7": "solo_streak_seven",
    "streak_3_weeks": "solo_streak_twenty_one",
    "vol_5": "solo_five_workouts",
    "vol_10": "solo_ten_workouts",
    "vol_25": "solo_twenty_five_workouts",
    "vol_50": "solo_fifty_workouts",
    "vol_100": "solo_one_hundred_workouts",
    "challenge_1": "solo_first_weekly_challenge",
    "challenge_10": "solo_ten_challenges",
    "duo_first": "duo_first_common_workout",
    "duo_3": "duo_three_common_workouts",
    "duo_together_first": "duo_first_common_workout",
    "duo_streak_7": "duo_streak_seven",
    "duo_encourage_10": "duo_ten_encouragements",
    "duo_presence_5": "duo_three_active_days",
    "duo_challenge_week": "duo_first_challenge_participation",
    "duo_regular": "duo_ten_common_workouts",
    # Ancien « Duo légendaire » = 50 séances communes → équivalent épique actuel
    "duo_legendary_legacy": "duo_fifty_common_workouts",
}

# IDs historiques sans équivalent 1:1 — signalés au recalcul, jamais supprimés.
LEGACY_ORPHAN_BADGE_IDS = frozenset({
    "streak_14",
    "streak_30",
    "month_active",
    "duo_7",
    "duo_week_active",
    "duo_month",
    "duo_likes_10",
    "coach_first",
    "coach_10",
    "coach_25",
    "coach_diligent",
    "coach_month",
    "challenge_3",
    "duo_streak_30",
    "vol_first",  # éventuel fantôme
})


def _b(
    badge_id: str,
    *,
    scope: str,
    name: str,
    description: str,
    rarity: str,
    category: str,
    condition_type: str,
    condition_value: Any = 1,
    icon_key: str = "trophy",
    sort_order: int = 0,
    params: Optional[Dict[str, Any]] = None,
    is_secret: bool = False,
    enabled: bool = True,
) -> dict:
    return {
        "id": badge_id,
        "scope": scope,
        "name": name,
        "description": description,
        "rarity": rarity,
        "category": category,
        "condition_type": condition_type,
        "condition_value": condition_value,
        "condition_params": params or {},
        "icon_key": icon_key,
        "sort_order": sort_order,
        "reward_points": RARITY_POINTS.get(rarity, 10),
        "is_secret": is_secret,
        "enabled": enabled,
        "family": category if category == "hero_challenge" else scope,
        "version": CATALOG_VERSION,
    }


def _build_solo_catalog() -> List[dict]:
    s = "solo"
    badges: List[dict] = [
        # —— Communs (20) ——
        _b("solo_first_workout", scope=s, name="Premier pas",
           description="Terminez votre première séance.", rarity="common",
           category="workouts", condition_type="completed_workouts", condition_value=1,
           icon_key="first_step", sort_order=1),
        _b("solo_three_workouts", scope=s, name="C’est parti",
           description="Terminez 3 séances.", rarity="common",
           category="workouts", condition_type="completed_workouts", condition_value=3,
           icon_key="launch", sort_order=2),
        _b("solo_five_workouts", scope=s, name="Nouvelle habitude",
           description="Terminez 5 séances.", rarity="common",
           category="workouts", condition_type="completed_workouts", condition_value=5,
           icon_key="habit", sort_order=3),
        _b("solo_three_days_week", scope=s, name="Semaine active",
           description="Soyez actif 3 jours dans une même semaine.", rarity="common",
           category="regularity", condition_type="active_days_in_week", condition_value=3,
           icon_key="calendar", sort_order=4),
        _b("solo_early_workout", scope=s, name="Réveil musculaire",
           description="Terminez 1 séance avant 9 h.", rarity="common",
           category="timing", condition_type="workouts_before_hour", condition_value=1,
           params={"hour": 9}, icon_key="sunrise", sort_order=5),
        _b("solo_night_workout", scope=s, name="Oiseau de nuit",
           description="Terminez 1 séance après 21 h.", rarity="common",
           category="timing", condition_type="workouts_after_hour", condition_value=1,
           params={"hour": 21}, icon_key="moon", sort_order=6),
        _b("solo_thirty_minutes", scope=s, name="Trente minutes",
           description="Terminez une séance d’au moins 30 minutes.", rarity="common",
           category="duration", condition_type="single_workout_duration_minutes", condition_value=30,
           icon_key="timer", sort_order=7),
        _b("solo_sixty_minutes", scope=s, name="Une heure pour soi",
           description="Terminez une séance d’au moins 60 minutes.", rarity="common",
           category="duration", condition_type="single_workout_duration_minutes", condition_value=60,
           icon_key="hourglass", sort_order=8),
        _b("solo_hundred_minutes", scope=s, name="Première centaine",
           description="Cumulez 100 minutes d’entraînement.", rarity="common",
           category="duration", condition_type="total_workout_minutes", condition_value=100,
           icon_key="clock", sort_order=9),
        _b("solo_five_hundred_calories", scope=s, name="Premières flammes",
           description="Dépensez 500 calories au total.", rarity="common",
           category="calories", condition_type="total_calories", condition_value=500,
           icon_key="flame", sort_order=10),
        _b("solo_streak_three", scope=s, name="Trois jours lancés",
           description="Atteignez un streak de 3 jours.", rarity="common",
           category="streak", condition_type="best_streak_days", condition_value=3,
           icon_key="streak", sort_order=11),
        _b("solo_streak_five", scope=s, name="Cinq jours solides",
           description="Atteignez un streak de 5 jours.", rarity="common",
           category="streak", condition_type="best_streak_days", condition_value=5,
           icon_key="streak", sort_order=12),
        _b("solo_first_no_abandon", scope=s, name="Jusqu’au bout",
           description="Terminez 1 séance sans abandon.", rarity="common",
           category="quality", condition_type="completed_without_abandon", condition_value=1,
           icon_key="finish", sort_order=13),
        _b("solo_three_categories", scope=s, name="Explorateur",
           description="Pratiquez 3 catégories différentes.", rarity="common",
           category="variety", condition_type="distinct_workout_categories", condition_value=3,
           icon_key="compass", sort_order=14),
        _b("solo_legs_workout", scope=s, name="Jambes en feu",
           description="Terminez une séance jambes.", rarity="common",
           category="category", condition_type="completed_category", condition_value=1,
           params={"category": "legs"}, icon_key="legs", sort_order=15),
        _b("solo_upper_body_workout", scope=s, name="Haut du corps",
           description="Terminez une séance haut du corps.", rarity="common",
           category="category", condition_type="completed_category", condition_value=1,
           params={"category": "upper_body"}, icon_key="strength", sort_order=16),
        _b("solo_cardio_workout", scope=s, name="Cœur en action",
           description="Terminez une séance cardio.", rarity="common",
           category="category", condition_type="completed_category", condition_value=1,
           params={"category": "cardio"}, icon_key="heart", sort_order=17),
        _b("solo_mobility_workout", scope=s, name="Souplesse retrouvée",
           description="Terminez une séance mobilité ou étirements.", rarity="common",
           category="category", condition_type="completed_category_group", condition_value=1,
           params={"categories": ["mobility", "stretching"]}, icon_key="mobility", sort_order=18),
        _b("solo_first_planned_workout", scope=s, name="Organisé",
           description="Planifiez votre première séance.", rarity="common",
           category="planning", condition_type="planned_workouts", condition_value=1,
           icon_key="planner", sort_order=19),
        _b("solo_first_custom_workout", scope=s, name="Créateur",
           description="Créez votre première séance personnalisée.", rarity="common",
           category="creation", condition_type="custom_workouts_created", condition_value=1,
           icon_key="create", sort_order=20),
        # —— Rares (15) ——
        _b("solo_ten_workouts", scope=s, name="Dix sur dix",
           description="Terminez 10 séances.", rarity="rare",
           category="workouts", condition_type="completed_workouts", condition_value=10,
           icon_key="trophy", sort_order=21),
        _b("solo_twenty_five_workouts", scope=s, name="Un vrai rythme",
           description="Terminez 25 séances.", rarity="rare",
           category="workouts", condition_type="completed_workouts", condition_value=25,
           icon_key="trophy", sort_order=22),
        _b("solo_ten_active_days", scope=s, name="Dix jours actifs",
           description="Soyez actif 10 jours au total.", rarity="rare",
           category="regularity", condition_type="total_active_days", condition_value=10,
           icon_key="calendar", sort_order=23),
        _b("solo_fifteen_hours", scope=s, name="Quinze heures",
           description="Cumulez 15 heures d’entraînement.", rarity="rare",
           category="duration", condition_type="total_workout_minutes", condition_value=900,
           icon_key="clock", sort_order=24),
        _b("solo_five_thousand_calories", scope=s, name="Fournaise",
           description="Dépensez 5000 calories au total.", rarity="rare",
           category="calories", condition_type="total_calories", condition_value=5000,
           icon_key="flame", sort_order=25),
        _b("solo_streak_seven", scope=s, name="Semaine parfaite",
           description="Atteignez un streak de 7 jours.", rarity="rare",
           category="streak", condition_type="best_streak_days", condition_value=7,
           icon_key="streak", sort_order=26),
        _b("solo_streak_ten", scope=s, name="Dix jours de suite",
           description="Atteignez un streak de 10 jours.", rarity="rare",
           category="streak", condition_type="best_streak_days", condition_value=10,
           icon_key="streak", sort_order=27),
        _b("solo_four_workouts_week", scope=s, name="Semaine chargée",
           description="Terminez 4 séances dans une même semaine.", rarity="rare",
           category="workouts", condition_type="completed_workouts_in_week", condition_value=4,
           icon_key="calendar", sort_order=28),
        _b("solo_five_categories", scope=s, name="Polyvalent",
           description="Pratiquez 5 catégories différentes.", rarity="rare",
           category="variety", condition_type="distinct_workout_categories", condition_value=5,
           icon_key="compass", sort_order=29),
        _b("solo_ten_planned_completed", scope=s, name="Plan respecté",
           description="Terminez 10 séances planifiées.", rarity="rare",
           category="planning", condition_type="completed_planned_workouts", condition_value=10,
           icon_key="planner", sort_order=30),
        _b("solo_three_early_workouts", scope=s, name="Lève-tôt",
           description="Terminez 3 séances avant 8 h.", rarity="rare",
           category="timing", condition_type="workouts_before_hour", condition_value=3,
           params={"hour": 8}, icon_key="sunrise", sort_order=31),
        _b("solo_three_night_workouts", scope=s, name="Après la tombée de la nuit",
           description="Terminez 3 séances après 21 h.", rarity="rare",
           category="timing", condition_type="workouts_after_hour", condition_value=3,
           params={"hour": 21}, icon_key="moon", sort_order=32),
        _b("solo_five_no_skips", scope=s, name="Aucun exercice laissé derrière",
           description="Terminez 5 séances sans exercice sauté.", rarity="rare",
           category="quality", condition_type="completed_without_skipped_exercise", condition_value=5,
           icon_key="finish", sort_order=33),
        _b("solo_comeback", scope=s, name="Le retour",
           description="Revenez après 14 jours d’inactivité.", rarity="rare",
           category="regularity", condition_type="comeback_after_inactive_days", condition_value=14,
           icon_key="launch", sort_order=34),
        _b("solo_first_weekly_challenge", scope=s, name="Défi relevé",
           description="Réussissez votre premier défi hebdomadaire solo.", rarity="rare",
           category="challenges", condition_type="completed_solo_challenges", condition_value=1,
           icon_key="target", sort_order=35),
        # —— Épiques (10) ——
        _b("solo_fifty_workouts", scope=s, name="Cinquante séances",
           description="Terminez 50 séances.", rarity="epic",
           category="workouts", condition_type="completed_workouts", condition_value=50,
           icon_key="trophy", sort_order=36),
        _b("solo_fifty_active_days", scope=s, name="Cinquante jours actifs",
           description="Soyez actif 50 jours au total.", rarity="epic",
           category="regularity", condition_type="total_active_days", condition_value=50,
           icon_key="calendar", sort_order=37),
        _b("solo_fifty_hours", scope=s, name="Cinquante heures",
           description="Cumulez 50 heures d’entraînement.", rarity="epic",
           category="duration", condition_type="total_workout_minutes", condition_value=3000,
           icon_key="clock", sort_order=38),
        _b("solo_twenty_five_thousand_calories", scope=s, name="Brasier personnel",
           description="Dépensez 25 000 calories au total.", rarity="epic",
           category="calories", condition_type="total_calories", condition_value=25000,
           icon_key="flame", sort_order=39),
        _b("solo_streak_twenty_one", scope=s, name="Trois semaines solides",
           description="Atteignez un streak de 21 jours.", rarity="epic",
           category="streak", condition_type="best_streak_days", condition_value=21,
           icon_key="streak", sort_order=40),
        _b("solo_ten_challenges", scope=s, name="Chasseur de défis",
           description="Réussissez 10 défis hebdomadaires solo.", rarity="epic",
           category="challenges", condition_type="completed_solo_challenges", condition_value=10,
           icon_key="target", sort_order=41),
        _b("solo_twelve_workouts_month", scope=s, name="Mois intense",
           description="Terminez 12 séances dans un même mois.", rarity="epic",
           category="workouts", condition_type="completed_workouts_in_month", condition_value=12,
           icon_key="calendar", sort_order=42),
        _b("solo_twenty_five_planned", scope=s, name="Toujours au rendez-vous",
           description="Terminez 25 séances planifiées.", rarity="epic",
           category="planning", condition_type="completed_planned_workouts", condition_value=25,
           icon_key="planner", sort_order=43),
        _b("solo_regular_month", scope=s, name="Mois régulier",
           description="Soyez actif au moins 3 jours dans chacune des 4 semaines d’un mois.",
           rarity="epic", category="regularity", condition_type="active_weeks_in_month",
           condition_value=4, params={"minimum_days_per_week": 3},
           icon_key="calendar", sort_order=44),
        _b("solo_ten_no_skips", scope=s, name="Zéro raccourci",
           description="Terminez 10 séances sans exercice sauté.", rarity="epic",
           category="quality", condition_type="completed_without_skipped_exercise", condition_value=10,
           icon_key="finish", sort_order=45),
        # —— Légendaires (5) ——
        _b("solo_one_hundred_workouts", scope=s, name="Centurion",
           description="Terminez 100 séances.", rarity="legendary",
           category="workouts", condition_type="completed_workouts", condition_value=100,
           icon_key="crown", sort_order=46),
        _b("solo_one_hundred_hours", scope=s, name="Maître du temps",
           description="Cumulez 100 heures d’entraînement.", rarity="legendary",
           category="duration", condition_type="total_workout_minutes", condition_value=6000,
           icon_key="hourglass", sort_order=47),
        _b("solo_one_hundred_active_days", scope=s, name="Cent jours actifs",
           description="Soyez actif 100 jours au total.", rarity="legendary",
           category="regularity", condition_type="total_active_days", condition_value=100,
           icon_key="calendar", sort_order=48),
        _b("solo_forty_active_weeks", scope=s, name="Année sportive",
           description="Cumulez 40 semaines actives.", rarity="legendary",
           category="regularity", condition_type="total_active_weeks", condition_value=40,
           icon_key="crown", sort_order=49, is_secret=True),
        _b("solo_two_hundred_fifty_workouts", scope=s, name="Titan",
           description="Terminez 250 séances.", rarity="legendary",
           category="workouts", condition_type="completed_workouts", condition_value=250,
           icon_key="crown", sort_order=50, is_secret=True),
    ]
    return badges


def _build_duo_catalog() -> List[dict]:
    s = "duo"
    badges: List[dict] = [
        # —— Communs (20) ——
        _b("duo_created", scope=s, name="L’aventure commence",
           description="Créez ou rejoignez un Duo.", rarity="common",
           category="setup", condition_type="duo_created", condition_value=1,
           icon_key="link", sort_order=1),
        _b("duo_first_common_workout", scope=s, name="Première séance à deux",
           description="Terminez votre première séance commune.", rarity="common",
           category="workouts", condition_type="duo_common_workouts", condition_value=1,
           icon_key="duo", sort_order=2),
        _b("duo_three_common_workouts", scope=s, name="Trio de séances",
           description="Terminez 3 séances communes.", rarity="common",
           category="workouts", condition_type="duo_common_workouts", condition_value=3,
           icon_key="duo", sort_order=3),
        _b("duo_five_common_workouts", scope=s, name="Cinq ensemble",
           description="Terminez 5 séances communes.", rarity="common",
           category="workouts", condition_type="duo_common_workouts", condition_value=5,
           icon_key="duo", sort_order=4),
        _b("duo_same_active_day", scope=s, name="Même journée",
           description="Soyez tous les deux actifs le même jour.", rarity="common",
           category="regularity", condition_type="duo_common_active_days", condition_value=1,
           icon_key="calendar", sort_order=5),
        _b("duo_three_workouts_week", scope=s, name="Semaine partagée",
           description="Terminez 3 séances communes dans une même semaine.", rarity="common",
           category="workouts", condition_type="duo_common_workouts_in_week", condition_value=3,
           icon_key="calendar", sort_order=6),
        _b("duo_first_challenge_participation", scope=s, name="Premier défi Duo",
           description="Participez à votre premier défi Duo.", rarity="common",
           category="challenges", condition_type="duo_challenges_joined", condition_value=1,
           icon_key="target", sort_order=7),
        _b("duo_first_post", scope=s, name="Première publication",
           description="Publiez votre premier post Duo.", rarity="common",
           category="social", condition_type="duo_posts_created", condition_value=1,
           icon_key="create", sort_order=8),
        _b("duo_first_encouragement", scope=s, name="Premier encouragement",
           description="Réagissez une fois à l’activité de votre partenaire.", rarity="common",
           category="social", condition_type="partner_activity_reactions", condition_value=1,
           icon_key="heart", sort_order=9),
        _b("duo_first_planned_workout", scope=s, name="Rendez-vous programmé",
           description="Planifiez votre première séance Duo.", rarity="common",
           category="planning", condition_type="duo_workouts_planned", condition_value=1,
           icon_key="planner", sort_order=10),
        _b("duo_same_program", scope=s, name="Même programme",
           description="Terminez le même programme tous les deux.", rarity="common",
           category="workouts", condition_type="same_workout_completed_by_both", condition_value=1,
           icon_key="duo", sort_order=11),
        _b("duo_sixty_common_minutes", scope=s, name="Une heure ensemble",
           description="Cumulez 60 minutes communes.", rarity="common",
           category="duration", condition_type="duo_common_minutes", condition_value=60,
           icon_key="timer", sort_order=12),
        _b("duo_three_active_days", scope=s, name="Trois jours Duo",
           description="Partagez 3 jours actifs communs.", rarity="common",
           category="regularity", condition_type="duo_common_active_days", condition_value=3,
           icon_key="calendar", sort_order=13),
        _b("duo_streak_three", scope=s, name="Petit streak partagé",
           description="Atteignez un streak Duo de 3 jours.", rarity="common",
           category="streak", condition_type="duo_best_streak_days", condition_value=3,
           icon_key="streak", sort_order=14),
        _b("duo_roles_configured", scope=s, name="Équipe organisée",
           description="Configurez les rôles de votre Duo.", rarity="common",
           category="setup", condition_type="duo_roles_configured", condition_value=1,
           icon_key="users", sort_order=15),
        _b("duo_banner_configured", scope=s, name="Notre identité",
           description="Ajoutez une bannière à votre Duo.", rarity="common",
           category="setup", condition_type="duo_banner_configured", condition_value=1,
           icon_key="create", sort_order=16),
        _b("duo_privacy_configured", scope=s, name="Profil configuré",
           description="Configurez la confidentialité de votre Duo.", rarity="common",
           category="setup", condition_type="duo_privacy_configured", condition_value=1,
           icon_key="lock", sort_order=17),
        _b("duo_first_goal", scope=s, name="Objectif commun",
           description="Créez un objectif Duo commun.", rarity="common",
           category="goals", condition_type="duo_goals_created", condition_value=1,
           icon_key="target", sort_order=18, enabled=False),
        _b("duo_first_active_week", scope=s, name="Première semaine terminée",
           description="Complétez une semaine active Duo.", rarity="common",
           category="regularity", condition_type="duo_active_weeks", condition_value=1,
           icon_key="calendar", sort_order=19),
        _b("duo_comeback", scope=s, name="On revient plus forts",
           description="Revenez ensemble après 14 jours d’inactivité Duo.", rarity="common",
           category="regularity", condition_type="duo_comeback_after_inactive_days", condition_value=14,
           icon_key="launch", sort_order=20),
        # —— Rares (15) ——
        _b("duo_ten_common_workouts", scope=s, name="Dix séances à deux",
           description="Terminez 10 séances communes.", rarity="rare",
           category="workouts", condition_type="duo_common_workouts", condition_value=10,
           icon_key="duo", sort_order=21),
        _b("duo_twenty_five_common_workouts", scope=s, name="Vingt-cinq ensemble",
           description="Terminez 25 séances communes.", rarity="rare",
           category="workouts", condition_type="duo_common_workouts", condition_value=25,
           icon_key="duo", sort_order=22),
        _b("duo_ten_active_days", scope=s, name="Dix jours partagés",
           description="Partagez 10 jours actifs communs.", rarity="rare",
           category="regularity", condition_type="duo_common_active_days", condition_value=10,
           icon_key="calendar", sort_order=23),
        _b("duo_ten_common_hours", scope=s, name="Dix heures ensemble",
           description="Cumulez 10 heures communes.", rarity="rare",
           category="duration", condition_type="duo_common_minutes", condition_value=600,
           icon_key="clock", sort_order=24),
        _b("duo_streak_seven", scope=s, name="Semaine soudée",
           description="Atteignez un streak Duo de 7 jours.", rarity="rare",
           category="streak", condition_type="duo_best_streak_days", condition_value=7,
           icon_key="streak", sort_order=25),
        _b("duo_four_common_workouts_week", scope=s, name="Semaine intensive",
           description="Terminez 4 séances communes dans une même semaine.", rarity="rare",
           category="workouts", condition_type="duo_common_workouts_in_week", condition_value=4,
           icon_key="calendar", sort_order=26),
        _b("duo_three_challenges", scope=s, name="Défis en série",
           description="Réussissez 3 défis Duo.", rarity="rare",
           category="challenges", condition_type="completed_duo_challenges", condition_value=3,
           icon_key="target", sort_order=27),
        _b("duo_double_individual_goal", scope=s, name="Double objectif",
           description="Les deux membres atteignent leur objectif individuel la même semaine.",
           rarity="rare", category="goals",
           condition_type="both_members_weekly_goal_reached", condition_value=1,
           icon_key="target", sort_order=28, enabled=False),
        _b("duo_ten_planned_completed", scope=s, name="Plan Duo respecté",
           description="Terminez 10 séances Duo planifiées.", rarity="rare",
           category="planning", condition_type="completed_planned_duo_workouts", condition_value=10,
           icon_key="planner", sort_order=29),
        _b("duo_ten_encouragements", scope=s, name="Soutien mutuel",
           description="Échangez 10 encouragements.", rarity="rare",
           category="social", condition_type="partner_activity_reactions", condition_value=10,
           icon_key="heart", sort_order=30),
        _b("duo_five_categories", scope=s, name="Duo polyvalent",
           description="Partagez 5 catégories communes différentes.", rarity="rare",
           category="variety", condition_type="duo_distinct_common_categories", condition_value=5,
           icon_key="compass", sort_order=31),
        _b("duo_three_early_workouts", scope=s, name="Duo matinal",
           description="Terminez 3 séances communes avant 9 h.", rarity="rare",
           category="timing", condition_type="duo_common_workouts_before_hour", condition_value=3,
           params={"hour": 9}, icon_key="sunrise", sort_order=32),
        _b("duo_three_night_workouts", scope=s, name="Duo nocturne",
           description="Terminez 3 séances communes après 21 h.", rarity="rare",
           category="timing", condition_type="duo_common_workouts_after_hour", condition_value=3,
           params={"hour": 21}, icon_key="moon", sort_order=33),
        _b("duo_five_without_abandon", scope=s, name="Personne ne lâche",
           description="Terminez 5 séances communes sans abandon.", rarity="rare",
           category="quality", condition_type="duo_common_workouts_without_abandon", condition_value=5,
           icon_key="finish", sort_order=34),
        _b("duo_active_thirty_days", scope=s, name="Un mois ensemble",
           description="Duo âgé de 30 jours avec 10 séances communes.", rarity="rare",
           category="milestone", condition_type="duo_age_and_common_workouts", condition_value=1,
           params={"minimum_age_days": 30, "minimum_common_workouts": 10},
           icon_key="calendar", sort_order=35),
        # —— Épiques (10) ——
        _b("duo_fifty_common_workouts", scope=s, name="Cinquante à deux",
           description="Terminez 50 séances communes.", rarity="epic",
           category="workouts", condition_type="duo_common_workouts", condition_value=50,
           icon_key="duo", sort_order=36),
        _b("duo_fifty_active_days", scope=s, name="Cinquante jours partagés",
           description="Partagez 50 jours actifs communs.", rarity="epic",
           category="regularity", condition_type="duo_common_active_days", condition_value=50,
           icon_key="calendar", sort_order=37),
        _b("duo_fifty_common_hours", scope=s, name="Cinquante heures ensemble",
           description="Cumulez 50 heures communes.", rarity="epic",
           category="duration", condition_type="duo_common_minutes", condition_value=3000,
           icon_key="clock", sort_order=38),
        _b("duo_streak_twenty_one", scope=s, name="Trois semaines inséparables",
           description="Atteignez un streak Duo de 21 jours.", rarity="epic",
           category="streak", condition_type="duo_best_streak_days", condition_value=21,
           icon_key="streak", sort_order=39),
        _b("duo_ten_challenges", scope=s, name="Maîtres des défis",
           description="Réussissez 10 défis Duo.", rarity="epic",
           category="challenges", condition_type="completed_duo_challenges", condition_value=10,
           icon_key="target", sort_order=40),
        _b("duo_twenty_planned_completed", scope=s, name="Toujours présents",
           description="Terminez 20 séances Duo planifiées.", rarity="epic",
           category="planning", condition_type="completed_planned_duo_workouts", condition_value=20,
           icon_key="planner", sort_order=41),
        _b("duo_regular_month", scope=s, name="Mois parfaitement régulier",
           description="3 jours communs minimum durant chacune des 4 semaines d’un mois.",
           rarity="epic", category="regularity", condition_type="duo_active_weeks_in_month",
           condition_value=4, params={"minimum_common_days_per_week": 3},
           icon_key="calendar", sort_order=42),
        _b("duo_fifteen_without_abandon", scope=s, name="Aucun abandon",
           description="Terminez 15 séances communes sans abandon.", rarity="epic",
           category="quality", condition_type="duo_common_workouts_without_abandon", condition_value=15,
           icon_key="finish", sort_order=43),
        _b("duo_one_hundred_combined_activities", scope=s, name="Cent activités combinées",
           description="Cumulez 100 séances terminées à deux pendant l’existence du Duo.",
           rarity="epic", category="workouts",
           condition_type="duo_combined_completed_workouts", condition_value=100,
           icon_key="trophy", sort_order=44),
        _b("duo_ten_badges", scope=s, name="Collectionneurs",
           description="Débloquez 10 badges Duo.", rarity="epic",
           category="collection", condition_type="unlocked_duo_badges", condition_value=10,
           icon_key="crown", sort_order=45),
        # —— Légendaires (5) ——
        _b("duo_one_hundred_common_workouts", scope=s, name="Cent séances ensemble",
           description="Terminez 100 séances communes.", rarity="legendary",
           category="workouts", condition_type="duo_common_workouts", condition_value=100,
           icon_key="crown", sort_order=46),
        _b("duo_one_hundred_common_hours", scope=s, name="Cent heures à deux",
           description="Cumulez 100 heures communes.", rarity="legendary",
           category="duration", condition_type="duo_common_minutes", condition_value=6000,
           icon_key="hourglass", sort_order=47),
        _b("duo_one_hundred_active_days", scope=s, name="Cent jours soudés",
           description="Partagez 100 jours actifs communs.", rarity="legendary",
           category="regularity", condition_type="duo_common_active_days", condition_value=100,
           icon_key="calendar", sort_order=48),
        _b("duo_forty_challenges", scope=s, name="Une année de défis",
           description="Réussissez 40 défis Duo.", rarity="legendary",
           category="challenges", condition_type="completed_duo_challenges", condition_value=40,
           icon_key="target", sort_order=49, is_secret=True),
        _b("duo_legendary", scope=s, name="Duo légendaire",
           description="Duo âgé d’au moins 365 jours avec 100 séances communes.",
           rarity="legendary", category="milestone",
           condition_type="duo_age_and_common_workouts", condition_value=1,
           params={"minimum_age_days": 365, "minimum_common_workouts": 100},
           icon_key="crown", sort_order=50, is_secret=True),
    ]
    return badges


def _build_hero_catalog() -> List[dict]:
    s = "solo"
    cat = "hero_challenge"
    return [
        _b("hero_spiderman_challenge", scope=s, name="Spider-Man Challenge",
           description="Atteignez 27 tours en 20 minutes.", rarity="legendary",
           category=cat, condition_type="hero_challenge_benchmark", condition_value=1,
           params={"hero_challenge_id": "spider-man-tom-holland", "unlock": "benchmark"},
           icon_key="hero_web", sort_order=201),
        _b("hero_thor_challenge", scope=s, name="Thor Challenge",
           description="Terminez tous les blocs prescrits du défi Thor.", rarity="epic",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "thor-chris-hemsworth", "unlock": "complete"},
           icon_key="hero_storm", sort_order=202),
        _b("hero_shangchi_challenge", scope=s, name="Shang-Chi Challenge",
           description="Terminez tous les blocs prescrits du défi Shang-Chi.", rarity="epic",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "shang-chi-simu-liu", "unlock": "complete"},
           icon_key="hero_rings", sort_order=203),
        _b("hero_deadpool_challenge", scope=s, name="Deadpool Challenge",
           description="Terminez 5 tours du défi Deadpool.", rarity="rare",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "deadpool-ryan-reynolds", "unlock": "complete"},
           icon_key="hero_slash", sort_order=204),
        _b("hero_batman_challenge", scope=s, name="Batman Challenge",
           description="Terminez la séance Batman.", rarity="epic",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "batman-ben-affleck", "unlock": "complete"},
           icon_key="hero_shadow", sort_order=205),
        _b("hero_wonderwoman_challenge", scope=s, name="Wonder Woman Challenge",
           description="Terminez les blocs documentés du défi Wonder Woman.", rarity="epic",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "wonder-woman-gal-gadot", "unlock": "complete"},
           icon_key="hero_star", sort_order=206),
        _b("hero_aquaman_challenge", scope=s, name="Aquaman Challenge",
           description="Terminez 5 tours et les drop sets du défi Aquaman.", rarity="epic",
           category=cat, condition_type="hero_challenge_complete", condition_value=1,
           params={"hero_challenge_id": "aquaman-jason-momoa", "unlock": "complete"},
           icon_key="hero_wave", sort_order=207),
    ]


SOLO_BADGES: List[dict] = _build_solo_catalog()
DUO_BADGES: List[dict] = _build_duo_catalog()
HERO_BADGES: List[dict] = _build_hero_catalog()
ALL_BADGES: List[dict] = SOLO_BADGES + DUO_BADGES + HERO_BADGES
BADGE_BY_ID: Dict[str, dict] = {b["id"]: b for b in ALL_BADGES}

# Alias historique : l'ancien duo_legendary (50 séances) pointe vers l'épique actuel.
# Le nouvel ID duo_legendary (légendaire 365j/100) reste distinct.
LEGACY_BADGE_ID_MAP["duo_legendary"] = "duo_fifty_common_workouts"


def canonical_badge_id(badge_id: Optional[str]) -> str:
    if not badge_id:
        return ""
    bid = str(badge_id)
    return LEGACY_BADGE_ID_MAP.get(bid, bid)


def get_badge_definition(badge_id: Optional[str]) -> Optional[dict]:
    cid = canonical_badge_id(badge_id)
    return BADGE_BY_ID.get(cid)


def get_catalog(scope: Optional[str] = None, *, include_disabled: bool = True) -> List[dict]:
    if scope == "solo":
        source = SOLO_BADGES + HERO_BADGES
    elif scope == "duo":
        source = DUO_BADGES
    elif scope == "hero":
        source = HERO_BADGES
    else:
        source = ALL_BADGES
    if include_disabled:
        return list(source)
    return [b for b in source if b.get("enabled", True)]


def rarity_summary(badges: List[dict], unlocked_ids: Optional[set] = None) -> dict:
    unlocked_ids = unlocked_ids or set()
    rarities = ("common", "rare", "epic", "legendary")
    summary = {
        "unlocked": 0,
        "total": 0,
        "common": {"unlocked": 0, "total": 0},
        "rare": {"unlocked": 0, "total": 0},
        "epic": {"unlocked": 0, "total": 0},
        "legendary": {"unlocked": 0, "total": 0},
    }
    for b in badges:
        if not b.get("enabled", True):
            continue
        rarity = b.get("rarity") or "common"
        if rarity not in rarities:
            rarity = "common"
        summary["total"] += 1
        summary[rarity]["total"] += 1
        if b["id"] in unlocked_ids:
            summary["unlocked"] += 1
            summary[rarity]["unlocked"] += 1
    return summary


def validate_catalog() -> Dict[str, Any]:
    """Assertions de cohérence du catalogue (utilisé par les tests)."""
    errors: List[str] = []
    if len(SOLO_BADGES) != 50:
        errors.append(f"Solo count={len(SOLO_BADGES)} expected 50")
    if len(DUO_BADGES) != 50:
        errors.append(f"Duo count={len(DUO_BADGES)} expected 50")
    ids = [b["id"] for b in ALL_BADGES]
    if len(ids) != len(set(ids)):
        errors.append("Duplicate badge ids")
    for scope, badges in (("solo", SOLO_BADGES), ("duo", DUO_BADGES)):
        counts = {"common": 0, "rare": 0, "epic": 0, "legendary": 0}
        for b in badges:
            counts[b["rarity"]] = counts.get(b["rarity"], 0) + 1
            for field in ("name", "description", "condition_type", "icon_key"):
                if not b.get(field):
                    errors.append(f"{b.get('id')}: missing {field}")
            if b.get("scope") != scope:
                errors.append(f"{b.get('id')}: wrong scope")
        expected = {"common": 20, "rare": 15, "epic": 10, "legendary": 5}
        if counts != expected:
            errors.append(f"{scope} rarity={counts} expected {expected}")
    return {"ok": not errors, "errors": errors, "disabled": [b["id"] for b in ALL_BADGES if not b.get("enabled", True)]}

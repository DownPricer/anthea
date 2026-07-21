#!/usr/bin/env python3
"""Génère badges.json fr/en/es depuis badge_catalog + traductions."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from badge_catalog import ALL_BADGES  # noqa: E402

UI_FR = {
    "title": "Mes badges",
    "duoTitle": "Badges du Duo",
    "unlockedOf": "{{unlocked}}/{{total}} débloqués",
    "scope": {"solo": "Solo", "duo": "Duo"},
    "backToDuo": "Retour au Duo",
    "backToProfile": "Retour au profil",
    "filters": {
        "all": "Tous",
        "common": "Commun",
        "rare": "Rare",
        "epic": "Épique",
        "legendary": "Légendaire",
        "unlocked": "Débloqués",
        "locked": "À obtenir",
    },
    "rarity": {
        "common": "Commun",
        "rare": "Rare",
        "epic": "Épique",
        "legendary": "Légendaire",
    },
    "emptyFilter": "Aucun badge dans ce filtre.",
    "secret": "Succès secret",
    "secretHint": "Continuez pour découvrir ce succès.",
    "unlocked": "Succès débloqué",
    "keepGoing": "Continuez pour le débloquer",
    "obtainedOn": "Obtenu le {{date}}",
    "publish": "Publier",
    "publishDuo": "Publier sur le mur Duo",
    "published": "Badge publié",
    "locked": "Verrouillé",
    "progress": "Progression",
}

UI_EN = {
    "title": "My badges",
    "duoTitle": "Duo badges",
    "unlockedOf": "{{unlocked}}/{{total}} unlocked",
    "scope": {"solo": "Solo", "duo": "Duo"},
    "backToDuo": "Back to Duo",
    "backToProfile": "Back to profile",
    "filters": {
        "all": "All",
        "common": "Common",
        "rare": "Rare",
        "epic": "Epic",
        "legendary": "Legendary",
        "unlocked": "Unlocked",
        "locked": "To unlock",
    },
    "rarity": {
        "common": "Common",
        "rare": "Rare",
        "epic": "Epic",
        "legendary": "Legendary",
    },
    "emptyFilter": "No badges in this filter.",
    "secret": "Secret achievement",
    "secretHint": "Keep going to discover this achievement.",
    "unlocked": "Achievement unlocked",
    "keepGoing": "Keep going to unlock it",
    "obtainedOn": "Earned on {{date}}",
    "publish": "Publish",
    "publishDuo": "Publish on Duo wall",
    "published": "Badge published",
    "locked": "Locked",
    "progress": "Progress",
}

UI_ES = {
    "title": "Mis insignias",
    "duoTitle": "Insignias del Dúo",
    "unlockedOf": "{{unlocked}}/{{total}} desbloqueadas",
    "scope": {"solo": "Solo", "duo": "Dúo"},
    "backToDuo": "Volver al Dúo",
    "backToProfile": "Volver al perfil",
    "filters": {
        "all": "Todas",
        "common": "Común",
        "rare": "Rara",
        "epic": "Épica",
        "legendary": "Legendaria",
        "unlocked": "Desbloqueadas",
        "locked": "Por obtener",
    },
    "rarity": {
        "common": "Común",
        "rare": "Rara",
        "epic": "Épica",
        "legendary": "Legendaria",
    },
    "emptyFilter": "Ninguna insignia en este filtro.",
    "secret": "Logro secreto",
    "secretHint": "Sigue para descubrir este logro.",
    "unlocked": "Logro desbloqueado",
    "keepGoing": "Sigue para desbloquearlo",
    "obtainedOn": "Obtenido el {{date}}",
    "publish": "Publicar",
    "publishDuo": "Publicar en el muro Dúo",
    "published": "Insignia publicada",
    "locked": "Bloqueada",
    "progress": "Progreso",
}

# Traductions EN/ES par badge_id
EN: dict[str, dict[str, str]] = {
    "solo_first_workout": {"name": "First step", "description": "Complete your first workout."},
    "solo_three_workouts": {"name": "Let's go", "description": "Complete 3 workouts."},
    "solo_five_workouts": {"name": "New habit", "description": "Complete 5 workouts."},
    "solo_three_days_week": {"name": "Active week", "description": "Be active 3 days in the same week."},
    "solo_early_workout": {"name": "Morning muscles", "description": "Complete 1 workout before 9 a.m."},
    "solo_night_workout": {"name": "Night owl", "description": "Complete 1 workout after 9 p.m."},
    "solo_thirty_minutes": {"name": "Thirty minutes", "description": "Complete a workout of at least 30 minutes."},
    "solo_sixty_minutes": {"name": "An hour for yourself", "description": "Complete a workout of at least 60 minutes."},
    "solo_hundred_minutes": {"name": "First hundred", "description": "Accumulate 100 minutes of training."},
    "solo_five_hundred_calories": {"name": "First flames", "description": "Burn 500 calories in total."},
    "solo_streak_three": {"name": "Three days rolling", "description": "Reach a 3-day streak."},
    "solo_streak_five": {"name": "Five solid days", "description": "Reach a 5-day streak."},
    "solo_first_no_abandon": {"name": "All the way", "description": "Complete 1 workout without quitting."},
    "solo_three_categories": {"name": "Explorer", "description": "Try 3 different categories."},
    "solo_legs_workout": {"name": "Legs on fire", "description": "Complete a leg workout."},
    "solo_upper_body_workout": {"name": "Upper body", "description": "Complete an upper body workout."},
    "solo_cardio_workout": {"name": "Heart in action", "description": "Complete a cardio workout."},
    "solo_mobility_workout": {"name": "Flexibility restored", "description": "Complete a mobility or stretching workout."},
    "solo_first_planned_workout": {"name": "Organized", "description": "Schedule your first workout."},
    "solo_first_custom_workout": {"name": "Creator", "description": "Create your first custom workout."},
    "solo_ten_workouts": {"name": "Ten out of ten", "description": "Complete 10 workouts."},
    "solo_twenty_five_workouts": {"name": "Real rhythm", "description": "Complete 25 workouts."},
    "solo_ten_active_days": {"name": "Ten active days", "description": "Be active 10 days in total."},
    "solo_fifteen_hours": {"name": "Fifteen hours", "description": "Accumulate 15 hours of training."},
    "solo_five_thousand_calories": {"name": "Furnace", "description": "Burn 5,000 calories in total."},
    "solo_streak_seven": {"name": "Perfect week", "description": "Reach a 7-day streak."},
    "solo_streak_ten": {"name": "Ten days in a row", "description": "Reach a 10-day streak."},
    "solo_four_workouts_week": {"name": "Busy week", "description": "Complete 4 workouts in the same week."},
    "solo_five_categories": {"name": "Versatile", "description": "Try 5 different categories."},
    "solo_ten_planned_completed": {"name": "Plan honored", "description": "Complete 10 scheduled workouts."},
    "solo_three_early_workouts": {"name": "Early bird", "description": "Complete 3 workouts before 8 a.m."},
    "solo_three_night_workouts": {"name": "After dark", "description": "Complete 3 workouts after 9 p.m."},
    "solo_five_no_skips": {"name": "No exercise left behind", "description": "Complete 5 workouts without skipping an exercise."},
    "solo_comeback": {"name": "The comeback", "description": "Return after 14 days of inactivity."},
    "solo_first_weekly_challenge": {"name": "Challenge accepted", "description": "Complete your first solo weekly challenge."},
    "solo_fifty_workouts": {"name": "Fifty workouts", "description": "Complete 50 workouts."},
    "solo_fifty_active_days": {"name": "Fifty active days", "description": "Be active 50 days in total."},
    "solo_fifty_hours": {"name": "Fifty hours", "description": "Accumulate 50 hours of training."},
    "solo_twenty_five_thousand_calories": {"name": "Personal blaze", "description": "Burn 25,000 calories in total."},
    "solo_streak_twenty_one": {"name": "Three solid weeks", "description": "Reach a 21-day streak."},
    "solo_ten_challenges": {"name": "Challenge hunter", "description": "Complete 10 solo weekly challenges."},
    "solo_twelve_workouts_month": {"name": "Intense month", "description": "Complete 12 workouts in the same month."},
    "solo_twenty_five_planned": {"name": "Always on time", "description": "Complete 25 scheduled workouts."},
    "solo_regular_month": {"name": "Regular month", "description": "Be active at least 3 days in each of 4 weeks in a month."},
    "solo_ten_no_skips": {"name": "Zero shortcuts", "description": "Complete 10 workouts without skipping an exercise."},
    "solo_one_hundred_workouts": {"name": "Centurion", "description": "Complete 100 workouts."},
    "solo_one_hundred_hours": {"name": "Master of time", "description": "Accumulate 100 hours of training."},
    "solo_one_hundred_active_days": {"name": "One hundred active days", "description": "Be active 100 days in total."},
    "solo_forty_active_weeks": {"name": "Sporty year", "description": "Accumulate 40 active weeks."},
    "solo_two_hundred_fifty_workouts": {"name": "Titan", "description": "Complete 250 workouts."},
    "duo_created": {"name": "The adventure begins", "description": "Create or join a Duo."},
    "duo_first_common_workout": {"name": "First workout together", "description": "Complete your first shared workout."},
    "duo_three_common_workouts": {"name": "Workout trio", "description": "Complete 3 shared workouts."},
    "duo_five_common_workouts": {"name": "Five together", "description": "Complete 5 shared workouts."},
    "duo_same_active_day": {"name": "Same day", "description": "Both be active on the same day."},
    "duo_three_workouts_week": {"name": "Shared week", "description": "Complete 3 shared workouts in the same week."},
    "duo_first_challenge_participation": {"name": "First Duo challenge", "description": "Join your first Duo challenge."},
    "duo_first_post": {"name": "First post", "description": "Publish your first Duo post."},
    "duo_first_encouragement": {"name": "First encouragement", "description": "React once to your partner's activity."},
    "duo_first_planned_workout": {"name": "Scheduled meetup", "description": "Schedule your first Duo workout."},
    "duo_same_program": {"name": "Same program", "description": "Both complete the same program."},
    "duo_sixty_common_minutes": {"name": "An hour together", "description": "Accumulate 60 shared minutes."},
    "duo_three_active_days": {"name": "Three Duo days", "description": "Share 3 active days together."},
    "duo_streak_three": {"name": "Small shared streak", "description": "Reach a 3-day Duo streak."},
    "duo_roles_configured": {"name": "Organized team", "description": "Configure your Duo roles."},
    "duo_banner_configured": {"name": "Our identity", "description": "Add a banner to your Duo."},
    "duo_privacy_configured": {"name": "Profile configured", "description": "Configure your Duo privacy."},
    "duo_first_goal": {"name": "Shared goal", "description": "Create a shared Duo goal."},
    "duo_first_active_week": {"name": "First week completed", "description": "Complete one active Duo week."},
    "duo_comeback": {"name": "Back stronger", "description": "Return together after 14 days of Duo inactivity."},
    "duo_ten_common_workouts": {"name": "Ten workouts together", "description": "Complete 10 shared workouts."},
    "duo_twenty_five_common_workouts": {"name": "Twenty-five together", "description": "Complete 25 shared workouts."},
    "duo_ten_active_days": {"name": "Ten shared days", "description": "Share 10 active days together."},
    "duo_ten_common_hours": {"name": "Ten hours together", "description": "Accumulate 10 shared hours."},
    "duo_streak_seven": {"name": "Tight-knit week", "description": "Reach a 7-day Duo streak."},
    "duo_four_common_workouts_week": {"name": "Intensive week", "description": "Complete 4 shared workouts in the same week."},
    "duo_three_challenges": {"name": "Challenge streak", "description": "Complete 3 Duo challenges."},
    "duo_double_individual_goal": {"name": "Double goal", "description": "Both members reach their individual goal the same week."},
    "duo_ten_planned_completed": {"name": "Duo plan honored", "description": "Complete 10 scheduled Duo workouts."},
    "duo_ten_encouragements": {"name": "Mutual support", "description": "Exchange 10 encouragements."},
    "duo_five_categories": {"name": "Versatile Duo", "description": "Share 5 different common categories."},
    "duo_three_early_workouts": {"name": "Morning Duo", "description": "Complete 3 shared workouts before 9 a.m."},
    "duo_three_night_workouts": {"name": "Night Duo", "description": "Complete 3 shared workouts after 9 p.m."},
    "duo_five_without_abandon": {"name": "No one gives up", "description": "Complete 5 shared workouts without quitting."},
    "duo_active_thirty_days": {"name": "A month together", "description": "Duo aged 30 days with 10 shared workouts."},
    "duo_fifty_common_workouts": {"name": "Fifty together", "description": "Complete 50 shared workouts."},
    "duo_fifty_active_days": {"name": "Fifty shared days", "description": "Share 50 active days together."},
    "duo_fifty_common_hours": {"name": "Fifty hours together", "description": "Accumulate 50 shared hours."},
    "duo_streak_twenty_one": {"name": "Three inseparable weeks", "description": "Reach a 21-day Duo streak."},
    "duo_ten_challenges": {"name": "Challenge masters", "description": "Complete 10 Duo challenges."},
    "duo_twenty_planned_completed": {"name": "Always there", "description": "Complete 20 scheduled Duo workouts."},
    "duo_regular_month": {"name": "Perfectly regular month", "description": "At least 3 shared days in each of 4 weeks in a month."},
    "duo_fifteen_without_abandon": {"name": "No quitting", "description": "Complete 15 shared workouts without quitting."},
    "duo_one_hundred_combined_activities": {"name": "One hundred combined activities", "description": "Accumulate 100 workouts completed together during the Duo's lifetime."},
    "duo_ten_badges": {"name": "Collectors", "description": "Unlock 10 Duo badges."},
    "duo_one_hundred_common_workouts": {"name": "One hundred workouts together", "description": "Complete 100 shared workouts."},
    "duo_one_hundred_common_hours": {"name": "One hundred hours together", "description": "Accumulate 100 shared hours."},
    "duo_one_hundred_active_days": {"name": "One hundred bonded days", "description": "Share 100 active days together."},
    "duo_forty_challenges": {"name": "A year of challenges", "description": "Complete 40 Duo challenges."},
    "duo_legendary": {"name": "Legendary Duo", "description": "Duo aged at least 365 days with 100 shared workouts."},
}

ES: dict[str, dict[str, str]] = {
    "solo_first_workout": {"name": "Primer paso", "description": "Completa tu primera sesión."},
    "solo_three_workouts": {"name": "Vamos", "description": "Completa 3 sesiones."},
    "solo_five_workouts": {"name": "Nuevo hábito", "description": "Completa 5 sesiones."},
    "solo_three_days_week": {"name": "Semana activa", "description": "Sé activo 3 días en la misma semana."},
    "solo_early_workout": {"name": "Despertar muscular", "description": "Completa 1 sesión antes de las 9 h."},
    "solo_night_workout": {"name": "Noctámbulo", "description": "Completa 1 sesión después de las 21 h."},
    "solo_thirty_minutes": {"name": "Treinta minutos", "description": "Completa una sesión de al menos 30 minutos."},
    "solo_sixty_minutes": {"name": "Una hora para ti", "description": "Completa una sesión de al menos 60 minutos."},
    "solo_hundred_minutes": {"name": "Primer centenar", "description": "Acumula 100 minutos de entrenamiento."},
    "solo_five_hundred_calories": {"name": "Primeras llamas", "description": "Gasta 500 calorías en total."},
    "solo_streak_three": {"name": "Tres días en marcha", "description": "Alcanza una racha de 3 días."},
    "solo_streak_five": {"name": "Cinco días sólidos", "description": "Alcanza una racha de 5 días."},
    "solo_first_no_abandon": {"name": "Hasta el final", "description": "Completa 1 sesión sin abandonar."},
    "solo_three_categories": {"name": "Explorador", "description": "Practica 3 categorías diferentes."},
    "solo_legs_workout": {"name": "Piernas en llamas", "description": "Completa una sesión de piernas."},
    "solo_upper_body_workout": {"name": "Parte superior", "description": "Completa una sesión de tren superior."},
    "solo_cardio_workout": {"name": "Corazón en acción", "description": "Completa una sesión de cardio."},
    "solo_mobility_workout": {"name": "Flexibilidad recuperada", "description": "Completa una sesión de movilidad o estiramientos."},
    "solo_first_planned_workout": {"name": "Organizado", "description": "Planifica tu primera sesión."},
    "solo_first_custom_workout": {"name": "Creador", "description": "Crea tu primera sesión personalizada."},
    "solo_ten_workouts": {"name": "Diez de diez", "description": "Completa 10 sesiones."},
    "solo_twenty_five_workouts": {"name": "Buen ritmo", "description": "Completa 25 sesiones."},
    "solo_ten_active_days": {"name": "Diez días activos", "description": "Sé activo 10 días en total."},
    "solo_fifteen_hours": {"name": "Quince horas", "description": "Acumula 15 horas de entrenamiento."},
    "solo_five_thousand_calories": {"name": "Horno", "description": "Gasta 5000 calorías en total."},
    "solo_streak_seven": {"name": "Semana perfecta", "description": "Alcanza una racha de 7 días."},
    "solo_streak_ten": {"name": "Diez días seguidos", "description": "Alcanza una racha de 10 días."},
    "solo_four_workouts_week": {"name": "Semana cargada", "description": "Completa 4 sesiones en la misma semana."},
    "solo_five_categories": {"name": "Polivalente", "description": "Practica 5 categorías diferentes."},
    "solo_ten_planned_completed": {"name": "Plan cumplido", "description": "Completa 10 sesiones planificadas."},
    "solo_three_early_workouts": {"name": "Madrugador", "description": "Completa 3 sesiones antes de las 8 h."},
    "solo_three_night_workouts": {"name": "Tras el anochecer", "description": "Completa 3 sesiones después de las 21 h."},
    "solo_five_no_skips": {"name": "Ningún ejercicio olvidado", "description": "Completa 5 sesiones sin saltar ejercicios."},
    "solo_comeback": {"name": "El regreso", "description": "Vuelve tras 14 días de inactividad."},
    "solo_first_weekly_challenge": {"name": "Desafío superado", "description": "Supera tu primer desafío semanal en solitario."},
    "solo_fifty_workouts": {"name": "Cincuenta sesiones", "description": "Completa 50 sesiones."},
    "solo_fifty_active_days": {"name": "Cincuenta días activos", "description": "Sé activo 50 días en total."},
    "solo_fifty_hours": {"name": "Cincuenta horas", "description": "Acumula 50 horas de entrenamiento."},
    "solo_twenty_five_thousand_calories": {"name": "Brasero personal", "description": "Gasta 25 000 calorías en total."},
    "solo_streak_twenty_one": {"name": "Tres semanas sólidas", "description": "Alcanza una racha de 21 días."},
    "solo_ten_challenges": {"name": "Cazador de desafíos", "description": "Supera 10 desafíos semanales en solitario."},
    "solo_twelve_workouts_month": {"name": "Mes intenso", "description": "Completa 12 sesiones en el mismo mes."},
    "solo_twenty_five_planned": {"name": "Siempre puntual", "description": "Completa 25 sesiones planificadas."},
    "solo_regular_month": {"name": "Mes regular", "description": "Sé activo al menos 3 días en cada una de las 4 semanas de un mes."},
    "solo_ten_no_skips": {"name": "Cero atajos", "description": "Completa 10 sesiones sin saltar ejercicios."},
    "solo_one_hundred_workouts": {"name": "Centurión", "description": "Completa 100 sesiones."},
    "solo_one_hundred_hours": {"name": "Maestro del tiempo", "description": "Acumula 100 horas de entrenamiento."},
    "solo_one_hundred_active_days": {"name": "Cien días activos", "description": "Sé activo 100 días en total."},
    "solo_forty_active_weeks": {"name": "Año deportivo", "description": "Acumula 40 semanas activas."},
    "solo_two_hundred_fifty_workouts": {"name": "Titán", "description": "Completa 250 sesiones."},
    "duo_created": {"name": "La aventura comienza", "description": "Crea o únete a un Dúo."},
    "duo_first_common_workout": {"name": "Primera sesión en pareja", "description": "Completa tu primera sesión en común."},
    "duo_three_common_workouts": {"name": "Trío de sesiones", "description": "Completa 3 sesiones en común."},
    "duo_five_common_workouts": {"name": "Cinco juntos", "description": "Completa 5 sesiones en común."},
    "duo_same_active_day": {"name": "Mismo día", "description": "Estén ambos activos el mismo día."},
    "duo_three_workouts_week": {"name": "Semana compartida", "description": "Completa 3 sesiones en común en la misma semana."},
    "duo_first_challenge_participation": {"name": "Primer desafío Dúo", "description": "Participa en tu primer desafío Dúo."},
    "duo_first_post": {"name": "Primera publicación", "description": "Publica tu primer post Dúo."},
    "duo_first_encouragement": {"name": "Primer ánimo", "description": "Reacciona una vez a la actividad de tu pareja."},
    "duo_first_planned_workout": {"name": "Cita programada", "description": "Planifica tu primera sesión Dúo."},
    "duo_same_program": {"name": "Mismo programa", "description": "Completen el mismo programa ambos."},
    "duo_sixty_common_minutes": {"name": "Una hora juntos", "description": "Acumula 60 minutos en común."},
    "duo_three_active_days": {"name": "Tres días Dúo", "description": "Comparte 3 días activos en común."},
    "duo_streak_three": {"name": "Pequeña racha compartida", "description": "Alcanza una racha Dúo de 3 días."},
    "duo_roles_configured": {"name": "Equipo organizado", "description": "Configura los roles de tu Dúo."},
    "duo_banner_configured": {"name": "Nuestra identidad", "description": "Añade un banner a tu Dúo."},
    "duo_privacy_configured": {"name": "Perfil configurado", "description": "Configura la privacidad de tu Dúo."},
    "duo_first_goal": {"name": "Objetivo común", "description": "Crea un objetivo Dúo común."},
    "duo_first_active_week": {"name": "Primera semana completada", "description": "Completa una semana activa Dúo."},
    "duo_comeback": {"name": "Volvemos más fuertes", "description": "Volved juntos tras 14 días de inactividad Dúo."},
    "duo_ten_common_workouts": {"name": "Diez sesiones en pareja", "description": "Completa 10 sesiones en común."},
    "duo_twenty_five_common_workouts": {"name": "Veinticinco juntos", "description": "Completa 25 sesiones en común."},
    "duo_ten_active_days": {"name": "Diez días compartidos", "description": "Comparte 10 días activos en común."},
    "duo_ten_common_hours": {"name": "Diez horas juntos", "description": "Acumula 10 horas en común."},
    "duo_streak_seven": {"name": "Semana unida", "description": "Alcanza una racha Dúo de 7 días."},
    "duo_four_common_workouts_week": {"name": "Semana intensiva", "description": "Completa 4 sesiones en común en la misma semana."},
    "duo_three_challenges": {"name": "Desafíos en serie", "description": "Supera 3 desafíos Dúo."},
    "duo_double_individual_goal": {"name": "Doble objetivo", "description": "Ambos miembros alcanzan su objetivo individual la misma semana."},
    "duo_ten_planned_completed": {"name": "Plan Dúo cumplido", "description": "Completa 10 sesiones Dúo planificadas."},
    "duo_ten_encouragements": {"name": "Apoyo mutuo", "description": "Intercambiad 10 ánimos."},
    "duo_five_categories": {"name": "Dúo polivalente", "description": "Comparte 5 categorías comunes diferentes."},
    "duo_three_early_workouts": {"name": "Dúo matutino", "description": "Completa 3 sesiones en común antes de las 9 h."},
    "duo_three_night_workouts": {"name": "Dúo nocturno", "description": "Completa 3 sesiones en común después de las 21 h."},
    "duo_five_without_abandon": {"name": "Nadie se rinde", "description": "Completa 5 sesiones en común sin abandonar."},
    "duo_active_thirty_days": {"name": "Un mes juntos", "description": "Dúo de 30 días con 10 sesiones en común."},
    "duo_fifty_common_workouts": {"name": "Cincuenta en pareja", "description": "Completa 50 sesiones en común."},
    "duo_fifty_active_days": {"name": "Cincuenta días compartidos", "description": "Comparte 50 días activos en común."},
    "duo_fifty_common_hours": {"name": "Cincuenta horas juntos", "description": "Acumula 50 horas en común."},
    "duo_streak_twenty_one": {"name": "Tres semanas inseparables", "description": "Alcanza una racha Dúo de 21 días."},
    "duo_ten_challenges": {"name": "Maestros de desafíos", "description": "Supera 10 desafíos Dúo."},
    "duo_twenty_planned_completed": {"name": "Siempre presentes", "description": "Completa 20 sesiones Dúo planificadas."},
    "duo_regular_month": {"name": "Mes perfectamente regular", "description": "Mínimo 3 días en común en cada una de las 4 semanas de un mes."},
    "duo_fifteen_without_abandon": {"name": "Sin abandonos", "description": "Completa 15 sesiones en común sin abandonar."},
    "duo_one_hundred_combined_activities": {"name": "Cien actividades combinadas", "description": "Acumula 100 sesiones completadas juntos durante la existencia del Dúo."},
    "duo_ten_badges": {"name": "Coleccionistas", "description": "Desbloquea 10 insignias Dúo."},
    "duo_one_hundred_common_workouts": {"name": "Cien sesiones juntos", "description": "Completa 100 sesiones en común."},
    "duo_one_hundred_common_hours": {"name": "Cien horas en pareja", "description": "Acumula 100 horas en común."},
    "duo_one_hundred_active_days": {"name": "Cien días unidos", "description": "Comparte 100 días activos en común."},
    "duo_forty_challenges": {"name": "Un año de desafíos", "description": "Supera 40 desafíos Dúo."},
    "duo_legendary": {"name": "Dúo legendario", "description": "Dúo de al menos 365 días con 100 sesiones en común."},
}


def build_locale(ui: dict, catalog_map: dict[str, dict[str, str]]) -> dict:
    out = dict(ui)
    for badge in ALL_BADGES:
        bid = badge["id"]
        entry = catalog_map.get(bid)
        if entry:
            out[bid] = {"name": entry["name"], "description": entry["description"]}
        else:
            out[bid] = {"name": badge["name"], "description": badge["description"]}
    return out


def main() -> None:
    frontend = ROOT.parent / "frontend" / "src" / "i18n" / "locales"
    fr_map = {b["id"]: {"name": b["name"], "description": b["description"]} for b in ALL_BADGES}
    locales = [
        ("fr", UI_FR, fr_map),
        ("en", UI_EN, EN),
        ("es", UI_ES, ES),
    ]
    backend_payload = {
        "fr-FR": fr_map,
        "en-US": EN,
        "es-ES": ES,
        "templates": {
            "fr-FR": {
                "solo_title": "Nouveau badge {rarity} !",
                "solo_body": "Vous avez débloqué « {name} ».",
                "duo_title": "Nouveau badge Duo",
                "duo_body": "Votre Duo a obtenu « {name} ».",
                "rarity": {
                    "common": "commun",
                    "rare": "rare",
                    "epic": "épique",
                    "legendary": "légendaire",
                },
            },
            "en-US": {
                "solo_title": "New {rarity} badge!",
                "solo_body": "You unlocked « {name} ».",
                "duo_title": "New Duo badge",
                "duo_body": "Your Duo earned « {name} ».",
                "rarity": {
                    "common": "common",
                    "rare": "rare",
                    "epic": "epic",
                    "legendary": "legendary",
                },
            },
            "es-ES": {
                "solo_title": "¡Nueva insignia {rarity}!",
                "solo_body": "Has desbloqueado « {name} ».",
                "duo_title": "Nueva insignia Dúo",
                "duo_body": "Vuestro Dúo ha obtenido « {name} ».",
                "rarity": {
                    "common": "común",
                    "rare": "rara",
                    "epic": "épica",
                    "legendary": "legendaria",
                },
            },
        },
    }
    backend_path = ROOT / "i18n" / "badge_locales.json"
    backend_path.parent.mkdir(parents=True, exist_ok=True)
    backend_path.write_text(json.dumps(backend_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {backend_path}")

    for lang, ui, catalog in locales:
        data = build_locale(ui, catalog)
        path = frontend / lang / "badges.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path} ({len(ALL_BADGES)} badges + UI keys)")

    missing_en = [b["id"] for b in ALL_BADGES if b["id"] not in EN]
    missing_es = [b["id"] for b in ALL_BADGES if b["id"] not in ES]
    if missing_en or missing_es:
        raise SystemExit(f"Missing translations EN={missing_en} ES={missing_es}")


if __name__ == "__main__":
    main()

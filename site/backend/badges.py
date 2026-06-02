"""Catalogue et évaluation des badges Anthea."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


def _badge(
    badge_id: str,
    name: str,
    description: str,
    icon: str,
    family: str,
    unlocked: bool,
    current: int = 0,
    target: int = 1,
) -> dict:
    return {
        "id": badge_id,
        "name": name,
        "description": description,
        "icon": icon,
        "family": family,
        "unlocked": unlocked,
        "current": current,
        "target": target,
        "progress": min(100, round((current / target) * 100)) if target > 0 else (100 if unlocked else 0),
    }


async def evaluate_all_badges(db, user_id: str, partner_id: Optional[str], streak_value: int) -> List[dict]:
    """Retourne tous les badges (débloqués et verrouillés) avec progression."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    user_completed = await db.workout_sessions.count_documents(
        {"user_id": user_id, "status": "completed"}
    )
    duo_completed = 0
    partner_completed = 0
    encouragements_sent = 0
    likes_received = 0
    coach_sessions_created = 0
    coach_sessions_scheduled = 0

    if partner_id:
        duo_completed = await db.workout_sessions.count_documents(
            {
                "user_id": {"$in": [user_id, partner_id]},
                "status": "completed",
            }
        )
        partner_completed = await db.workout_sessions.count_documents(
            {"user_id": partner_id, "status": "completed"}
        )
        # Encouragements = réactions + commentaires de l'utilisateur sur les séances du partenaire
        partner_sessions = await db.workout_sessions.find(
            {"user_id": partner_id}, {"reactions": 1, "comments": 1}
        ).to_list(500)
        for s in partner_sessions:
            for r in s.get("reactions", []):
                if r.get("user_id") == user_id:
                    encouragements_sent += 1
            for c in s.get("comments", []):
                if c.get("user_id") == user_id:
                    encouragements_sent += 1
        my_sessions = await db.workout_sessions.find(
            {"user_id": user_id}, {"likes": 1}
        ).to_list(500)
        for s in my_sessions:
            likes_received += len(s.get("likes", []))

        coach_sessions_created = await db.scheduled_workouts.count_documents(
            {"creator_id": user_id, "for_user_id": partner_id}
        )
        coach_sessions_scheduled = coach_sessions_created

    badges: List[dict] = []

    # A — Régularité (streak)
    streak_targets = [
        ("streak_3", "Échauffé", "3 jours de streak", 3),
        ("streak_7", "Semaine de feu", "7 jours de streak", 7),
        ("streak_14", "Régulier", "14 jours de streak", 14),
        ("streak_30", "Inarrêtable", "30 jours de streak", 30),
    ]
    for bid, name, desc, target in streak_targets:
        badges.append(
            _badge(bid, name, desc, "flame", "regularity", streak_value >= target, streak_value, target)
        )
    badges.append(
        _badge(
            "streak_3_weeks",
            "Trois semaines solides",
            "21 jours de streak sans casser",
            "zap",
            "regularity",
            streak_value >= 21,
            streak_value,
            21,
        )
    )
    month_active = await db.workout_sessions.count_documents(
        {"user_id": user_id, "status": "completed", "created_at": {"$gte": month_start}}
    )
    badges.append(
        _badge(
            "month_active",
            "Mois actif",
            "Au moins une séance terminée ce mois-ci",
            "calendar",
            "regularity",
            month_active >= 1,
            min(month_active, 1),
            1,
        )
    )

    # B — Volume
    for count, bid, name, desc in [
        (5, "vol_5", "Premiers pas+", "5 séances terminées"),
        (10, "vol_10", "En forme", "10 séances terminées"),
        (25, "vol_25", "Assidu", "25 séances terminées"),
        (50, "vol_50", "Athlète", "50 séances terminées"),
        (100, "vol_100", "Légende", "100 séances terminées"),
    ]:
        badges.append(
            _badge(bid, name, desc, "trophy", "volume", user_completed >= count, user_completed, count)
        )

    if partner_id:
        # C — Duo
        duo_pairs = await _count_duo_same_days(db, user_id, partner_id)
        badges.extend(
            [
                _badge(
                    "duo_first",
                    "Première fois à deux",
                    "Première séance duo terminée",
                    "heart",
                    "duo",
                    duo_completed >= 1,
                    min(duo_completed, 1),
                    1,
                ),
                _badge(
                    "duo_3",
                    "Trio dynamique",
                    "3 séances ensemble (duo)",
                    "users",
                    "duo",
                    duo_completed >= 3,
                    duo_completed,
                    3,
                ),
                _badge(
                    "duo_7",
                    "Semaine duo",
                    "7 séances duo au total",
                    "flame",
                    "duo",
                    duo_completed >= 7,
                    duo_completed,
                    7,
                ),
                _badge(
                    "duo_week_active",
                    "Semaine active en duo",
                    "Les deux actifs cette semaine",
                    "sparkles",
                    "duo",
                    await _duo_week_both_active(db, user_id, partner_id),
                    1,
                    1,
                ),
                _badge(
                    "duo_month",
                    "Mois duo",
                    "Mois actif pour le duo",
                    "crown",
                    "duo",
                    duo_completed >= 4,
                    duo_completed,
                    4,
                ),
                _badge(
                    "duo_encourage_10",
                    "Supporter",
                    "10 encouragements envoyés",
                    "message",
                    "duo",
                    encouragements_sent >= 10,
                    encouragements_sent,
                    10,
                ),
                _badge(
                    "duo_likes_10",
                    "Apprécié",
                    "10 likes reçus sur tes séances",
                    "star",
                    "duo",
                    likes_received >= 10,
                    likes_received,
                    10,
                ),
                _badge(
                    "duo_presence_5",
                    "Présence duo",
                    "5 jours où vous vous êtes entraînés tous les deux",
                    "check",
                    "duo",
                    duo_pairs >= 5,
                    duo_pairs,
                    5,
                ),
            ]
        )

        # D — Coach
        badges.extend(
            [
                _badge(
                    "coach_first",
                    "Premier coaching",
                    "Première séance créée pour ton élève",
                    "clipboard",
                    "coach",
                    coach_sessions_created >= 1,
                    min(coach_sessions_created, 1),
                    1,
                ),
                _badge(
                    "coach_10",
                    "Planificateur",
                    "10 séances programmées pour l'élève",
                    "calendar",
                    "coach",
                    coach_sessions_scheduled >= 10,
                    coach_sessions_scheduled,
                    10,
                ),
                _badge(
                    "coach_25",
                    "Coach pro",
                    "25 séances programmées",
                    "award",
                    "coach",
                    coach_sessions_scheduled >= 25,
                    coach_sessions_scheduled,
                    25,
                ),
                _badge(
                    "coach_diligent",
                    "Élève assidu",
                    "Ton partenaire a terminé 10 séances",
                    "graduation",
                    "coach",
                    partner_completed >= 10,
                    partner_completed,
                    10,
                ),
                _badge(
                    "coach_month",
                    "Coaching actif",
                    "1 mois de séances programmées",
                    "medal",
                    "coach",
                    coach_sessions_scheduled >= 4,
                    coach_sessions_scheduled,
                    4,
                ),
            ]
        )

    # E — Défis
    try:
        challenges_won = await db.challenge_completions.count_documents({"user_id": user_id})
    except Exception:
        challenges_won = 0

    badges.extend(
        [
            _badge(
                "challenge_1",
                "Défi relevé",
                "Premier défi hebdo réussi",
                "target",
                "challenge",
                challenges_won >= 1,
                challenges_won,
                1,
            ),
            _badge(
                "challenge_3",
                "Série de défis",
                "3 défis hebdo réussis",
                "target",
                "challenge",
                challenges_won >= 3,
                challenges_won,
                3,
            ),
            _badge(
                "challenge_10",
                "Chasseur de défis",
                "10 défis réussis",
                "target",
                "challenge",
                challenges_won >= 10,
                challenges_won,
                10,
            ),
        ]
    )

    return badges


async def _count_duo_same_days(db, user_id: str, partner_id: str) -> int:
    """Jours où les deux ont au moins une séance terminée."""
    mine = await db.workout_sessions.find(
        {"user_id": user_id, "status": "completed"},
        {"created_at": 1},
    ).to_list(2000)
    partner = await db.workout_sessions.find(
        {"user_id": partner_id, "status": "completed"},
        {"created_at": 1},
    ).to_list(2000)
    my_days = {s.get("created_at", "")[:10] for s in mine if s.get("created_at")}
    partner_days = {s.get("created_at", "")[:10] for s in partner if s.get("created_at")}
    return len(my_days & partner_days)


async def _duo_week_both_active(db, user_id: str, partner_id: str) -> bool:
    today = datetime.now(timezone.utc)
    week_start = (today - timedelta(days=today.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    u = await db.workout_sessions.count_documents(
        {"user_id": user_id, "status": "completed", "created_at": {"$gte": week_start}}
    )
    p = await db.workout_sessions.count_documents(
        {"user_id": partner_id, "status": "completed", "created_at": {"$gte": week_start}}
    )
    return u >= 1 and p >= 1

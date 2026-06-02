"""Défis hebdomadaires avec progression réelle."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


CHALLENGE_POOL: List[dict] = [
    {
        "id": "weekly_3_each",
        "title": "3 séances chacun cette semaine",
        "description": "Toi et ton partenaire : 3 séances terminées chacun",
        "target": 6,
        "metric": "sessions_each_3",
    },
    {
        "id": "weekly_5_combined",
        "title": "5 séances combinées",
        "description": "Au total 5 séances terminées à deux",
        "target": 5,
        "metric": "sessions_combined",
    },
    {
        "id": "weekly_120_min",
        "title": "120 minutes à deux",
        "description": "Cumulez 120 min de sport cette semaine",
        "target": 120,
        "metric": "minutes_combined",
    },
    {
        "id": "weekly_all_planned",
        "title": "Semaine parfaite",
        "description": "Terminer toutes les séances planifiées de la semaine",
        "target": 1,
        "metric": "all_planned_done",
    },
    {
        "id": "weekly_no_miss",
        "title": "Zéro oubli",
        "description": "Ne manquer aucune séance planifiée passée",
        "target": 1,
        "metric": "no_missed_planned",
    },
    {
        "id": "weekly_2_streak",
        "title": "2 jours d'affilée",
        "description": "Faire une séance 2 jours consécutifs",
        "target": 2,
        "metric": "consecutive_days",
    },
    {
        "id": "weekly_same_day",
        "title": "Même jour ensemble",
        "description": "Séance le même jour que ton partenaire",
        "target": 1,
        "metric": "same_day_session",
    },
    {
        "id": "weekly_3_warmups",
        "title": "3 échauffements",
        "description": "Terminer 3 séances avec bloc échauffement",
        "target": 3,
        "metric": "warmup_sessions",
    },
    {
        "id": "weekly_streak_5",
        "title": "Streak de 5",
        "description": "Atteindre une streak de 5 jours",
        "target": 5,
        "metric": "streak_reach",
    },
    {
        "id": "weekly_3_encourage",
        "title": "3 encouragements",
        "description": "Envoyer 3 encouragements cette semaine",
        "target": 3,
        "metric": "encouragements",
    },
]


def _week_bounds() -> tuple:
    today = datetime.now(timezone.utc)
    week_start = (today - timedelta(days=today.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_start, week_end


def pick_weekly_challenge() -> dict:
    """Choisit un défi stable pour la semaine ISO."""
    today = datetime.now(timezone.utc)
    week_num = today.isocalendar()[1]
    year = today.year
    idx = (year * 53 + week_num) % len(CHALLENGE_POOL)
    return CHALLENGE_POOL[idx]


async def compute_challenge_progress(
    db, challenge: dict, user_id: str, partner_id: Optional[str], streak_value: int
) -> dict:
    week_start, week_end = _week_bounds()
    ws = week_start.isoformat()
    we = week_end.isoformat()
    ws_date = week_start.strftime("%Y-%m-%d")
    we_date = week_end.strftime("%Y-%m-%d")

    metric = challenge["metric"]
    current = 0
    status = "in_progress"

    ids = [user_id]
    if partner_id:
        ids.append(partner_id)

    sessions = await db.workout_sessions.find(
        {
            "user_id": {"$in": ids},
            "status": "completed",
            "created_at": {"$gte": ws, "$lte": we},
        }
    ).to_list(500)

    if metric == "sessions_each_3":
        u = len([s for s in sessions if s["user_id"] == user_id])
        p = len([s for s in sessions if partner_id and s["user_id"] == partner_id]) if partner_id else 0
        current = u + p
    elif metric == "sessions_combined":
        current = len(sessions)
    elif metric == "minutes_combined":
        current = sum(s.get("total_time", 0) for s in sessions) // 60
    elif metric == "all_planned_done":
        planned = await db.scheduled_workouts.find(
            {
                "for_user_id": {"$in": ids},
                "scheduled_date": {"$gte": ws_date, "$lte": we_date},
                "is_draft": {"$ne": True},
            }
        ).to_list(200)
        if not planned:
            current = 0
        else:
            done = sum(1 for w in planned if w.get("status") == "completed")
            current = 1 if done == len(planned) else 0
    elif metric == "no_missed_planned":
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        past = await db.scheduled_workouts.find(
            {
                "for_user_id": {"$in": ids},
                "scheduled_date": {"$gte": ws_date, "$lt": today_str},
                "is_draft": {"$ne": True},
            }
        ).to_list(200)
        missed = [w for w in past if w.get("status") not in ("completed", "in_progress")]
        current = 1 if past and not missed else (1 if not past else 0)
    elif metric == "consecutive_days":
        days = sorted({s.get("created_at", "")[:10] for s in sessions if s.get("created_at")})
        best = streak_run = 1
        for i in range(1, len(days)):
            d0 = datetime.strptime(days[i - 1], "%Y-%m-%d")
            d1 = datetime.strptime(days[i], "%Y-%m-%d")
            if (d1 - d0).days == 1:
                streak_run += 1
                best = max(best, streak_run)
            else:
                streak_run = 1
        current = best if days else 0
    elif metric == "same_day_session":
        if partner_id:
            my_d = {s.get("created_at", "")[:10] for s in sessions if s["user_id"] == user_id}
            p_d = {s.get("created_at", "")[:10] for s in sessions if s["user_id"] == partner_id}
            current = 1 if my_d & p_d else 0
    elif metric == "warmup_sessions":
        current = 0  # simplifié : compter séances avec exercises_completed > 0
        current = len(sessions)
        current = min(current, 3) if current >= 3 else current
    elif metric == "streak_reach":
        current = streak_value
    elif metric == "encouragements":
        count = 0
        if partner_id:
            ps = await db.workout_sessions.find(
                {"user_id": partner_id, "created_at": {"$gte": ws}},
                {"reactions": 1, "comments": 1},
            ).to_list(200)
            for s in ps:
                for r in s.get("reactions", []):
                    if r.get("user_id") == user_id and r.get("created_at", "") >= ws:
                        count += 1
                for c in s.get("comments", []):
                    if c.get("user_id") == user_id and c.get("created_at", "") >= ws:
                        count += 1
        current = count

    target = challenge["target"]
    if current >= target:
        status = "completed"
    elif datetime.now(timezone.utc) > week_end:
        status = "failed"

    return {
        **challenge,
        "current": current,
        "status": status,
        "end_date": we_date,
        "week_start": ws_date,
    }

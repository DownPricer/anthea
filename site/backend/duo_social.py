"""Profil duo social : stats communes, confidentialité, activités."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

DUO_RELATION_TYPES = {
    "couple",
    "friends",
    "partners",
    "coach_student",
    "student_coach",
    "other",
    # rétrocompatibilité
    "partner",
    "coach",
    "trainer",
    "coach_partner",
    "student",
}

RELATION_LABELS = {
    "couple": "Couple",
    "friends": "Amis",
    "partners": "Partenaires",
    "coach_student": "Coach / élève",
    "student_coach": "Élève / coach",
    "other": "Autre",
    "partner": "Partenaires",
    "coach": "Coach / élève",
    "trainer": "Coach / élève",
    "coach_partner": "Coach + Partenaire",
    "student": "Élève / coach",
}

DEFAULT_DUO_PRIVACY = {
    "account_visibility": "private",
    "show_stats": False,
    "show_badges": True,
    "show_recent_activity": False,
    "show_posts": False,
}


def normalize_duo_relation(value: Optional[str]) -> str:
    if not value:
        return "partners"
    raw = str(value).strip().lower()
    mapping = {
        "partner": "partners",
        "coach": "coach_student",
        "trainer": "coach_student",
        "coach_partner": "coach_student",
        "student": "student_coach",
        "trainee": "student_coach",
    }
    normalized = mapping.get(raw, raw)
    if normalized not in DUO_RELATION_TYPES:
        return "other"
    return normalized


def duo_tag_from_doc(duo_doc: dict) -> str:
    name = duo_doc.get("name") or "Duo"
    short_id = int(duo_doc.get("short_id") or 0)
    return f"{name}#{short_id}"


def parse_duo_tag(tag: str) -> Tuple[Optional[str], Optional[int]]:
    raw = (tag or "").strip()
    if not raw:
        return None, None
    if "#" not in raw:
        return raw, None
    name_part, id_part = raw.split("#", 1)
    name_part = name_part.strip()
    try:
        short_id = int(id_part.strip())
    except ValueError:
        short_id = None
    return name_part or None, short_id


def apply_duo_defaults(duo_doc: dict) -> dict:
    out = dict(duo_doc)
    for key, default in DEFAULT_DUO_PRIVACY.items():
        if out.get(key) is None:
            out[key] = default
    if not out.get("relation_type"):
        out["relation_type"] = "partners"
    return out


def resolve_coach_roles(relation_type: str, member_a: dict, member_b: dict) -> Tuple[Optional[str], Optional[str]]:
    """Retourne (coach_id, student_id) selon le type de relation."""
    a_id = str(member_a.get("_id") or member_a.get("id"))
    b_id = str(member_b.get("_id") or member_b.get("id"))
    rel = normalize_duo_relation(relation_type)
    a_rel = normalize_duo_relation(member_a.get("relation_type"))
    b_rel = normalize_duo_relation(member_b.get("relation_type"))

    if rel in ("coach_student", "coach", "trainer", "coach_partner"):
        if a_rel == "student_coach" or member_a.get("relation_type") in ("student", "trainee"):
            return b_id, a_id
        return a_id, b_id
    if rel == "student_coach":
        if a_rel in ("coach_student", "coach", "trainer"):
            return a_id, b_id
        return b_id, a_id
    return None, None


async def find_duo_by_tag(db, tag: str) -> Optional[dict]:
    name_part, short_id = parse_duo_tag(tag)
    query: Dict[str, Any] = {}
    if short_id is not None:
        query["short_id"] = short_id
    if name_part:
        query["name"] = {"$regex": f"^{name_part}$", "$options": "i"}
    if not query:
        return None
    return await db.duo_profiles.find_one(query)


async def get_duo_members(db, duo_doc: dict) -> List[dict]:
    member_ids = duo_doc.get("member_ids") or []
    members = []
    for mid in member_ids:
        try:
            from bson import ObjectId
            doc = await db.users.find_one({"_id": ObjectId(mid)})
        except Exception:
            doc = None
        if doc:
            members.append(doc)
    return members


async def get_duo_access_level(db, viewer_id: str, duo_doc: dict, members: List[dict]) -> str:
    member_ids = {str(m["_id"]) for m in members}
    if viewer_id in member_ids:
        return "member"
    if duo_doc.get("account_visibility") != "public":
        return "limited"
    # public : ami d'au moins un membre
    for member in members:
        mid = str(member["_id"])
        if await _is_mutual(db, viewer_id, mid):
            return "friend"
    return "public"


async def _is_mutual(db, user_a: str, user_b: str) -> bool:
    if not user_a or not user_b or user_a == user_b:
        return False
    a = await db.follows.find_one({"follower_id": user_a, "following_id": user_b})
    b = await db.follows.find_one({"follower_id": user_b, "following_id": user_a})
    return bool(a and b)


def can_view_duo_section(duo_doc: dict, access: str, section: str) -> bool:
    if access == "limited":
        return False
    if access == "member":
        return True
    flag_map = {
        "stats": "show_stats",
        "badges": "show_badges",
        "activity": "show_recent_activity",
        "posts": "show_posts",
    }
    flag = flag_map.get(section)
    if not flag:
        return access in ("member", "friend", "public")
    return bool(duo_doc.get(flag))


def _session_day(session: dict) -> str:
    return (session.get("created_at") or "")[:10]


async def _completed_sessions_by_user(db, user_id: str, limit: int = 2000) -> List[dict]:
    return await db.workout_sessions.find(
        {"user_id": user_id, "status": "completed"},
        {
            "user_id": 1,
            "username": 1,
            "workout_title": 1,
            "total_time": 1,
            "exercises_completed": 1,
            "exercises_total": 1,
            "difficulty_felt": 1,
            "created_at": 1,
            "likes": 1,
            "comments": 1,
            "reactions": 1,
        },
    ).sort("created_at", -1).limit(limit).to_list(limit)


def _compute_streaks_from_days(days: List[str]) -> Tuple[int, int]:
    if not days:
        return 0, 0
    sorted_days = sorted(set(days))
    best = current = 1
    for i in range(1, len(sorted_days)):
        d0 = datetime.strptime(sorted_days[i - 1], "%Y-%m-%d").date()
        d1 = datetime.strptime(sorted_days[i], "%Y-%m-%d").date()
        if (d1 - d0).days == 1:
            current += 1
            best = max(best, current)
        else:
            current = 1
    # streak actuel depuis aujourd'hui
    today = datetime.now(timezone.utc).date()
    day_set = set(sorted_days)
    current_streak = 0
    cursor = today
    while cursor.isoformat() in day_set:
        current_streak += 1
        cursor -= timedelta(days=1)
    if current_streak == 0 and today.isoformat() in day_set:
        current_streak = 1
    elif current_streak == 0 and (today - timedelta(days=1)).isoformat() in day_set:
        cursor = today - timedelta(days=1)
        while cursor.isoformat() in day_set:
            current_streak += 1
            cursor -= timedelta(days=1)
    return current_streak, best


async def compute_together_stats(db, user_a_id: str, user_b_id: str) -> dict:
    """Stats basées uniquement sur l'activité commune (même jour)."""
    sessions_a = await _completed_sessions_by_user(db, user_a_id)
    sessions_b = await _completed_sessions_by_user(db, user_b_id)

    days_a = {_session_day(s) for s in sessions_a if _session_day(s)}
    days_b = {_session_day(s) for s in sessions_b if _session_day(s)}
    common_days = sorted(days_a & days_b)

    sessions_together = len(common_days)
    current_streak, best_streak = _compute_streaks_from_days(common_days)

    total_time = 0
    for day in common_days:
        day_a = [s for s in sessions_a if _session_day(s) == day]
        day_b = [s for s in sessions_b if _session_day(s) == day]
        total_time += sum(s.get("total_time", 0) for s in day_a)
        total_time += sum(s.get("total_time", 0) for s in day_b)

    pair_key = "_".join(sorted([user_a_id, user_b_id]))
    try:
        challenges_won = await db.challenge_completions.count_documents({"pair_key": pair_key})
    except Exception:
        challenges_won = 0

    week_start = (
        datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())
    ).strftime("%Y-%m-%d")
    week_challenges = await db.challenge_completions.count_documents({
        "pair_key": pair_key,
        "week_start": {"$gte": week_start},
    })

    return {
        "sessions_together": sessions_together,
        "duo_streak_current": current_streak,
        "duo_streak_best": best_streak,
        "training_days_together": sessions_together,
        "challenges_completed": challenges_won,
        "challenges_week_completed": week_challenges,
        "total_training_time": total_time,
        "common_days": common_days,
    }


def build_common_sessions(
    sessions_a: List[dict],
    sessions_b: List[dict],
    user_a_id: str,
    user_b_id: str,
) -> List[dict]:
    """Regroupe les séances du même jour en cartes « séance commune »."""
    days_a: Dict[str, List[dict]] = {}
    days_b: Dict[str, List[dict]] = {}
    for s in sessions_a:
        d = _session_day(s)
        if d:
            days_a.setdefault(d, []).append(s)
    for s in sessions_b:
        d = _session_day(s)
        if d:
            days_b.setdefault(d, []).append(s)

    common_days = sorted(set(days_a.keys()) & set(days_b.keys()), reverse=True)
    items: List[dict] = []
    used_ids = set()

    for day in common_days:
        a_list = sorted(days_a[day], key=lambda x: x.get("created_at", ""), reverse=True)
        b_list = sorted(days_b[day], key=lambda x: x.get("created_at", ""), reverse=True)
        a_sess = a_list[0]
        b_sess = b_list[0]
        used_ids.add(str(a_sess.get("_id", a_sess.get("id"))))
        used_ids.add(str(b_sess.get("_id", b_sess.get("id"))))
        items.append({
            "type": "common_session",
            "date": day,
            "created_at": max(a_sess.get("created_at", ""), b_sess.get("created_at", "")),
            "session_a": _serialize_session_ref(a_sess, user_a_id),
            "session_b": _serialize_session_ref(b_sess, user_b_id),
        })

    all_sessions = []
    for s in sessions_a + sessions_b:
        sid = str(s.get("_id", s.get("id", "")))
        if sid and sid not in used_ids:
            all_sessions.append({**_serialize_session_ref(s, s.get("user_id")), "type": "session"})

    all_sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items.extend(all_sessions)
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


def _serialize_session_ref(session: dict, user_id: str) -> dict:
    sid = session.get("id") or str(session.get("_id", ""))
    return {
        "id": sid,
        "user_id": user_id or session.get("user_id"),
        "username": session.get("username"),
        "workout_title": session.get("workout_title"),
        "total_time": session.get("total_time", 0),
        "exercises_completed": session.get("exercises_completed", 0),
        "exercises_total": session.get("exercises_total", 0),
        "difficulty_felt": session.get("difficulty_felt"),
        "created_at": session.get("created_at"),
        "likes": session.get("likes") or [],
        "comments": session.get("comments") or [],
        "reactions": session.get("reactions") or [],
    }


async def build_duo_activity(
    db,
    duo_doc: dict,
    members: List[dict],
    viewer_id: str,
    limit: int = 15,
) -> List[dict]:
    if len(members) < 2:
        return []
    a, b = members[0], members[1]
    a_id, b_id = str(a["_id"]), str(b["_id"])

    sessions_a = await _completed_sessions_by_user(db, a_id, limit=100)
    sessions_b = await _completed_sessions_by_user(db, b_id, limit=100)
    common = build_common_sessions(sessions_a, sessions_b, a_id, b_id)

    activity = []
    for item in common[:limit]:
        if item.get("type") == "common_session":
            activity.append({
                "type": "common_session",
                "date": item["date"],
                "created_at": item["created_at"],
                "session_a": _filter_session_for_viewer(item["session_a"], a, viewer_id),
                "session_b": _filter_session_for_viewer(item["session_b"], b, viewer_id),
            })
        else:
            owner = a if item.get("user_id") == a_id else b
            if _member_allows_activity(owner, viewer_id, a_id, b_id):
                activity.append({
                    "type": "session",
                    "session": _filter_session_for_viewer(item, owner, viewer_id),
                })
    return activity


def _member_allows_activity(member: dict, viewer_id: str, a_id: str, b_id: str) -> bool:
    mid = str(member["_id"])
    if viewer_id == mid:
        return True
    if member.get("account_visibility") == "private" and viewer_id not in (a_id, b_id):
        if not member.get("show_recent_activity") and not member.get("show_sessions"):
            return False
    return bool(member.get("show_recent_activity") or member.get("show_sessions"))


def _filter_session_for_viewer(session: dict, owner: dict, viewer_id: str) -> dict:
    out = dict(session)
    if str(owner["_id"]) != viewer_id and not owner.get("show_sessions", False):
        out.pop("likes", None)
        out.pop("comments", None)
        out.pop("reactions", None)
    return out

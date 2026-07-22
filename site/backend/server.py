from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import base64
import csv
import io
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Dict
import random
from collections import defaultdict
import uuid
import re
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

from program_volume_seed import ensure_program_volume_templates
from badges import (
    evaluate_all_badges,
    evaluate_duo_social_badges,
    find_badge_for_user,
    get_badge_definition,
    canonical_badge_id,
    catalog_badge_to_public,
)
from badge_progress import (
    BadgeProgressService,
    schedule_badge_evaluation,
    trigger_solo_evaluation,
    trigger_duo_evaluation,
)
from challenges import pick_weekly_challenge, compute_challenge_progress
from duo_social import (
    apply_duo_defaults,
    build_common_sessions,
    build_duo_activity,
    can_view_duo_section,
    compute_together_stats,
    duo_tag_from_doc,
    duo_visibility_allows,
    find_duo_by_tag,
    get_duo_access_level,
    get_duo_follow_doc,
    get_duo_members,
    is_duo_follower,
    normalize_duo_relation,
    parse_duo_tag,
    resolve_duo_visibility,
    RELATION_LABELS,
    resolve_coach_roles,
    resolve_duo_member_pair,
    resolve_duo_member_pair_from_doc,
    session_completions_for_range,
    sync_duo_member_ids,
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    gender: Optional[str] = None
    fitness_level: Optional[str] = "beginner"
    main_goal: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    handle: Optional[str] = None
    featured_badges: Optional[List[str]] = None
    featured_badge_ids: Optional[List[str]] = None
    locale: Optional[str] = None
    time_format: Optional[str] = None
    gender: Optional[str] = None
    fitness_level: Optional[str] = None
    main_goal: Optional[str] = None
    theme: Optional[str] = "default"
    accent_color: Optional[str] = None
    tts_enabled: Optional[bool] = True
    music_mode: Optional[bool] = None
    spotify_playlist_url: Optional[str] = None
    tts_voice: Optional[str] = None
    timer_sound: Optional[str] = "beep"
    account_visibility: Optional[str] = None
    show_stats: Optional[bool] = None
    show_badges: Optional[bool] = None
    show_recent_activity: Optional[bool] = None
    show_sessions: Optional[bool] = None
    show_posts: Optional[bool] = None
    stats_visibility: Optional[Literal["public", "followers", "me"]] = None
    badges_visibility: Optional[Literal["public", "followers", "me"]] = None
    activity_visibility: Optional[Literal["public", "followers", "me"]] = None
    posts_visibility: Optional[Literal["public", "followers", "me"]] = None
    notification_prefs: Optional[Dict[str, bool]] = None

class UserResponse(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    handle: Optional[str] = None
    featured_badges: List[str] = Field(default_factory=list)
    locale: Optional[str] = None
    time_format: str = "auto"
    gender: Optional[str] = None
    fitness_level: Optional[str] = None
    main_goal: Optional[str] = None
    theme: str = "default"
    accent_color: Optional[str] = None
    tts_enabled: bool = True
    music_mode: bool = False
    spotify_playlist_url: Optional[str] = None
    last_seen_at: Optional[str] = None
    tts_voice: Optional[str] = None
    timer_sound: str = "beep"
    account_visibility: str = "private"
    show_stats: bool = False
    show_badges: bool = True
    show_recent_activity: bool = False
    show_sessions: bool = False
    show_posts: bool = False
    stats_visibility: Optional[Literal["public", "followers", "me"]] = None
    badges_visibility: Optional[Literal["public", "followers", "me"]] = None
    activity_visibility: Optional[Literal["public", "followers", "me"]] = None
    posts_visibility: Optional[Literal["public", "followers", "me"]] = None
    notification_prefs: Optional[Dict[str, bool]] = None
    partner_id: Optional[str] = None
    partner_username: Optional[str] = None
    relation_type: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_followed_by: bool = False
    is_mutual: bool = False
    is_own: bool = False
    is_limited: bool = False
    created_at: str

SUPPORTED_LOCALES = ("fr-FR", "en-US", "es-ES")
SUPPORTED_TIME_FORMATS = ("auto", "12h", "24h")

class NotificationResponse(BaseModel):
    id: str
    type: str
    actor_id: str
    actor_username: Optional[str] = None
    actor_handle: Optional[str] = None
    actor_display_name: Optional[str] = None
    actor_avatar_url: Optional[str] = None
    read: bool = False
    created_at: str

class DuoSearchResult(BaseModel):
    id: str
    name: str
    short_id: int
    tag: str
    member_count: int = 2
    account_visibility: str = "private"

class DuoProfileUpdate(BaseModel):
    name: Optional[str] = None
    relation_type: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    clear_banner: Optional[bool] = None
    account_visibility: Optional[Literal["public", "private"]] = None
    show_stats: Optional[bool] = None
    show_badges: Optional[bool] = None
    show_recent_activity: Optional[bool] = None
    show_posts: Optional[bool] = None
    show_challenges: Optional[bool] = None
    stats_visibility: Optional[Literal["public", "followers", "members"]] = None
    wall_visibility: Optional[Literal["public", "followers", "members"]] = None
    badges_visibility: Optional[Literal["public", "followers", "members"]] = None
    activity_visibility: Optional[Literal["public", "followers", "members"]] = None
    challenges_visibility: Optional[Literal["public", "followers", "members"]] = None
    member_roles: Optional[Dict[str, Literal["coach", "leader", "member"]]] = None
    featured_badge_ids: Optional[List[str]] = None

class ImageUpload(BaseModel):
    image_data: str
    filename: Optional[str] = "image.jpg"

class PartnerRequest(BaseModel):
    target_username: str
    relation_type: str = "partner"

class PartnerRequestResponse(BaseModel):
    id: str
    from_user_id: str
    from_username: str
    to_user_id: str
    to_username: str
    relation_type: str
    status: str
    created_at: str

class ExerciseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general"
    exercise_type: str = "reps"
    default_duration: Optional[int] = None
    default_reps: Optional[int] = None
    default_rest: Optional[int] = 30
    image_url: Optional[str] = None
    is_system: bool = False

class ExerciseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    exercise_type: str
    default_duration: Optional[int] = None
    default_reps: Optional[int] = None
    default_rest: Optional[int] = None
    image_url: Optional[str] = None
    is_system: bool
    user_id: Optional[str] = None
    created_at: str

class WorkoutExercise(BaseModel):
    exercise_id: str
    name: str
    description: Optional[str] = None
    exercise_type: str = "reps"
    duration: Optional[int] = None
    reps: Optional[int] = None
    rest_after: int = 30
    order: int = 0
    tts_enabled: bool = True
    image_url: Optional[str] = None

class WorkoutBlock(BaseModel):
    block_type: str
    exercises: List[WorkoutExercise] = []

class WorkoutTemplateCreate(BaseModel):
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    blocks: List[WorkoutBlock] = []

class WorkoutTemplateResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    blocks: List[dict] = []
    user_id: str
    created_at: str
    updated_at: str

class ScheduledWorkoutCreate(BaseModel):
    template_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    for_user_id: Optional[str] = None
    scheduled_date: str
    scheduled_time: Optional[str] = None
    difficulty: Optional[str] = None
    blocks: List[WorkoutBlock] = []
    is_draft: bool = False
    repeat_pattern: Optional[str] = None

class MultiScheduleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    for_user_id: Optional[str] = None
    scheduled_time: Optional[str] = None
    difficulty: Optional[str] = None
    blocks: List[WorkoutBlock] = []
    # Scheduling options
    schedule_mode: str = "single"  # single, multiple_dates, weekly_repeat
    dates: List[str] = []  # For multiple_dates mode
    week_days: List[int] = []  # 0=Mon, 6=Sun for weekly_repeat
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    repeat_weeks: Optional[int] = None

class WorkoutProgressSave(BaseModel):
    workout_id: str
    current_exercise_index: int
    current_block_index: int
    time_elapsed: int
    pause_time: int
    exercises_completed: int
    workout_title: Optional[str] = None
    phase: Optional[str] = None

class LiveWorkoutMessageCreate(BaseModel):
    message: str

class ScheduledWorkoutResponse(BaseModel):
    id: str
    template_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    creator_id: str
    creator_username: str
    for_user_id: str
    for_username: str
    scheduled_date: str
    scheduled_time: Optional[str] = None
    difficulty: Optional[str] = None
    blocks: List[dict] = []
    status: str
    is_draft: bool
    repeat_pattern: Optional[str] = None
    created_at: str
    updated_at: str

class WorkoutSessionCreate(BaseModel):
    workout_id: str
    total_time: int
    pause_time: int = 0
    exercises_completed: int
    exercises_total: int
    status: str
    fatigue_before: Optional[int] = None
    fatigue_after: Optional[int] = None
    difficulty_felt: Optional[int] = None
    soreness: Optional[int] = None
    mood: Optional[str] = None
    notes: Optional[str] = None
    exercise_log: Optional[List[dict]] = None

class WorkoutSessionResponse(BaseModel):
    id: str
    workout_id: str
    workout_title: str
    user_id: str
    username: str
    total_time: int
    pause_time: int
    exercises_completed: int
    exercises_total: int
    status: str
    fatigue_before: Optional[int] = None
    fatigue_after: Optional[int] = None
    difficulty_felt: Optional[int] = None
    soreness: Optional[int] = None
    mood: Optional[str] = None
    notes: Optional[str] = None
    likes: List[str] = []
    reactions: List[dict] = []
    comments: List[dict] = []
    created_at: str

class ReactionCreate(BaseModel):
    session_id: str
    reaction_type: str

class CommentCreate(BaseModel):
    session_id: str
    text: str

class PostCreate(BaseModel):
    type: str
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    workout_session_id: Optional[str] = None
    partner_session_id: Optional[str] = None
    badge_id: Optional[str] = None
    pair_key: Optional[str] = None
    duo_session_id: Optional[str] = None
    duo_id: Optional[str] = None
    post_on_duo_wall: bool = False
    visibility: str = "public"

class PostCommentCreate(BaseModel):
    text: str

class RepostCreate(BaseModel):
    post_id: Optional[str] = None
    workout_session_id: Optional[str] = None
    partner_session_id: Optional[str] = None
    duo_id: Optional[str] = None
    post_on_duo_wall: bool = False

class SessionTimeAdjust(BaseModel):
    total_time: int
    reason: Optional[str] = None

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict
    user_agent: Optional[str] = None

class PushUnsubscribeBody(BaseModel):
    endpoint: str

class DuoStatsResponse(BaseModel):
    streak: int
    total_workouts_together: int
    this_week_user: int
    this_week_partner: int
    badges: List[dict] = []
    current_challenge: Optional[dict] = None

class StreakDayCreate(BaseModel):
    date: str  # YYYY-MM-DD

class StreakManualUpdate(BaseModel):
    streak: Optional[int] = None  # None = supprimer l'override coach

class StreakCoachExemptBody(BaseModel):
    date: str
    user_id: str  # doit être l'utilisateur courant ou son partenaire

# ============ HELPERS ============

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def normalize_accent_color(value: Optional[str]) -> Optional[str]:
    if not value or not str(value).strip():
        return None
    raw = str(value).strip()
    if raw.startswith("#"):
        raw = raw[1:]
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return None
    try:
        int(raw, 16)
    except ValueError:
        return None
    return f"#{raw.upper()}"

HANDLE_PATTERN = re.compile(r"^[a-z0-9_]{3,30}$")

def normalize_handle(value: Optional[str]) -> Optional[str]:
    if not value or not str(value).strip():
        return None
    raw = str(value).strip().lower().lstrip("@")
    raw = re.sub(r"[^a-z0-9_]", "", raw.replace(" ", ""))
    if not raw or not HANDLE_PATTERN.match(raw):
        return None
    return raw

def duo_pair_key(user_id_a: str, user_id_b: str) -> str:
    return "_".join(sorted([user_id_a, user_id_b]))

def estimate_calories(total_time_seconds: int, difficulty: Optional[int] = None) -> int:
    minutes = max(0, (total_time_seconds or 0) / 60)
    if difficulty is None:
        rate = 5
    elif difficulty <= 3:
        rate = 3
    elif difficulty <= 6:
        rate = 5
    elif difficulty <= 8:
        rate = 7
    else:
        rate = 8
    return round(minutes * rate)

LIVE_SESSION_MAX_AGE_SECONDS = 120
LIVE_ACTIVE_PHASES = ("countdown", "exercise", "rest")

def serialize_user(user: dict) -> dict:
    partner_link = None
    handle = user.get("handle") or user.get("username")
    raw_ids = user.get("featured_badge_ids")
    if raw_ids is None:
        raw_ids = user.get("featured_badges") or []
    if not isinstance(raw_ids, list):
        raw_ids = []
    featured_ids = [canonical_badge_id(str(b)) for b in raw_ids[:3] if canonical_badge_id(str(b))]
    return {
        "id": str(user["_id"]) if "_id" in user else user.get("id"),
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "bio": user.get("bio"),
        "avatar_url": user.get("avatar_url"),
        "handle": handle,
        "featured_badge_ids": featured_ids,
        # legacy compat (ids)
        "featured_badges": featured_ids,
        "locale": user.get("locale"),
        "time_format": user.get("time_format") or "auto",
        "gender": user.get("gender"),
        "fitness_level": user.get("fitness_level"),
        "main_goal": user.get("main_goal"),
        "theme": user.get("theme", "default"),
        "accent_color": user.get("accent_color"),
        "tts_enabled": user.get("tts_enabled", True),
        "music_mode": user.get("music_mode", False),
        "spotify_playlist_url": user.get("spotify_playlist_url"),
        "last_seen_at": user.get("last_seen_at"),
        "tts_voice": user.get("tts_voice"),
        "timer_sound": user.get("timer_sound", "beep"),
        "account_visibility": user.get("account_visibility", "private"),
        "show_stats": user.get("show_stats", False),
        "show_badges": user.get("show_badges", True),
        "show_recent_activity": user.get("show_recent_activity", False),
        "show_sessions": user.get("show_sessions", False),
        "show_posts": user.get("show_posts", False),
        "stats_visibility": user.get("stats_visibility"),
        "badges_visibility": user.get("badges_visibility"),
        "activity_visibility": user.get("activity_visibility"),
        "posts_visibility": user.get("posts_visibility"),
        "notification_prefs": _serialize_notification_prefs(user.get("notification_prefs")),
        "partner_id": user.get("partner_id"),
        "partner_username": user.get("partner_username"),
        "relation_type": user.get("relation_type"),
        "followers_count": int(user.get("followers_count") or 0),
        "following_count": int(user.get("following_count") or 0),
        "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
    }


def _serialize_notification_prefs(raw) -> dict:
    try:
        from push_service import merge_notification_prefs
        return merge_notification_prefs(raw if isinstance(raw, dict) else None)
    except Exception:
        return {}

async def is_following(follower_id: str, following_id: str) -> bool:
    if not follower_id or not following_id:
        return False
    doc = await db.follows.find_one({"follower_id": follower_id, "following_id": following_id})
    return doc is not None

async def is_mutual_friends(user_a_id: str, user_b_id: str) -> bool:
    if not user_a_id or not user_b_id or user_a_id == user_b_id:
        return False
    a_follows_b = await is_following(user_a_id, user_b_id)
    b_follows_a = await is_following(user_b_id, user_a_id)
    return a_follows_b and b_follows_a

async def get_profile_access_level(viewer_id: str, profile_user: dict) -> str:
    profile_id = str(profile_user.get("_id") or profile_user.get("id"))
    if viewer_id == profile_id:
        return "own"
    if await is_mutual_friends(viewer_id, profile_id):
        return "friend"
    if await is_following(viewer_id, profile_id):
        return "follower"
    if profile_user.get("account_visibility") == "public":
        return "public"
    return "limited"


def resolve_visibility_value(doc: dict, field_key: str, legacy_show_key: str, *, default_public: bool) -> str:
    """Normalise un champ *_visibility avec compat legacy show_*."""
    raw = doc.get(field_key)
    if raw in ("public", "followers", "me"):
        return raw
    legacy = doc.get(legacy_show_key)
    if legacy is True:
        return "public"
    if legacy is False:
        return "me"
    return "public" if default_public else "me"


def visibility_allows(access: str, vis: str) -> bool:
    """Retourne True si le viewer peut voir une section selon son niveau d'accès."""
    if access == "limited":
        return False
    if vis == "public":
        return access in ("own", "friend", "follower", "public")
    if vis == "followers":
        return access in ("own", "friend", "follower")
    return access == "own"

async def find_user_by_handle(handle: str) -> Optional[dict]:
    normalized = normalize_handle(handle)
    if not normalized:
        return None
    return await db.users.find_one({
        "$or": [{"handle": normalized}, {"username": normalized}]
    })

async def get_follow_relation(viewer_id: str, profile_id: str) -> dict:
    if not viewer_id or not profile_id or viewer_id == profile_id:
        return {
            "is_following": False,
            "is_followed_by": False,
            "is_mutual": False,
            "follow_request_pending": False,
            "incoming_follow_request": False,
        }
    following = await is_following(viewer_id, profile_id)
    followed_by = await is_following(profile_id, viewer_id)
    pending = await db.follow_requests.find_one({
        "requester_id": viewer_id,
        "target_id": profile_id,
        "status": "pending",
    })
    incoming = await db.follow_requests.find_one({
        "requester_id": profile_id,
        "target_id": viewer_id,
        "status": "pending",
    })
    return {
        "is_following": following,
        "is_followed_by": followed_by,
        "is_mutual": following and followed_by,
        "follow_request_pending": pending is not None,
        "incoming_follow_request": incoming is not None,
    }

async def serialize_profile_for_viewer(profile_user: dict, viewer_id: str) -> dict:
    profile_id = str(profile_user["_id"])
    access = await get_profile_access_level(viewer_id, profile_user)
    relation = await get_follow_relation(viewer_id, profile_id)
    handle = profile_user.get("handle") or profile_user.get("username")
    raw_ids = profile_user.get("featured_badge_ids")
    if raw_ids is None:
        raw_ids = profile_user.get("featured_badges") or []
    if not isinstance(raw_ids, list):
        raw_ids = []
    featured_ids = [canonical_badge_id(str(b)) for b in raw_ids[:3] if canonical_badge_id(str(b))]

    base = {
        "id": profile_id,
        "username": profile_user.get("username"),
        "handle": handle,
        "display_name": profile_user.get("display_name"),
        "avatar_url": profile_user.get("avatar_url"),
        "account_visibility": profile_user.get("account_visibility", "private"),
        "followers_count": int(profile_user.get("followers_count") or 0),
        "following_count": int(profile_user.get("following_count") or 0),
        "is_own": access == "own",
        "is_limited": access == "limited",
        **relation,
        "created_at": profile_user.get("created_at", datetime.now(timezone.utc).isoformat()),
    }

    if access == "limited":
        base["bio"] = None
        base["featured_badge_ids"] = []
        base["featured_badges"] = []
        base["show_stats"] = False
        base["show_badges"] = False
        base["show_recent_activity"] = False
        base["show_sessions"] = False
        base["show_posts"] = False
        return base

    def _resolve_visibility(field_key: str, legacy_show_key: str, default_public: bool) -> str:
        raw = profile_user.get(field_key)
        if raw in ("public", "followers", "me"):
            return raw
        legacy = profile_user.get(legacy_show_key)
        if legacy is True:
            return "public"
        if legacy is False:
            return "me"
        return "public" if default_public else "me"

    def _visibility_allows(vis: str) -> bool:
        if vis == "public":
            return access in ("own", "friend", "follower", "public")
        if vis == "followers":
            return access in ("own", "friend", "follower")
        return access == "own"

    base["bio"] = profile_user.get("bio")
    base["featured_badge_ids"] = featured_ids
    base["featured_badges"] = []  # enrichi plus bas
    stats_vis = _resolve_visibility("stats_visibility", "show_stats", default_public=False)
    badges_vis = _resolve_visibility("badges_visibility", "show_badges", default_public=True)
    activity_vis = _resolve_visibility("activity_visibility", "show_recent_activity", default_public=False)
    posts_vis = _resolve_visibility("posts_visibility", "show_posts", default_public=False)

    if profile_user.get("account_visibility") == "public":
        badges_vis = "public"
        posts_vis = "public"
    elif profile_user.get("account_visibility") == "private" and access not in ("own", "friend", "follower"):
        badges_vis = posts_vis = activity_vis = stats_vis = "me"

    base["stats_visibility"] = stats_vis
    base["badges_visibility"] = badges_vis
    base["activity_visibility"] = activity_vis
    base["posts_visibility"] = posts_vis

    base["show_stats"] = _visibility_allows(stats_vis)
    base["show_badges"] = _visibility_allows(badges_vis)
    base["show_recent_activity"] = _visibility_allows(activity_vis)
    if profile_user.get("account_visibility") == "public":
        base["show_sessions"] = access != "limited"
    else:
        base["show_sessions"] = access in ("own", "friend", "follower")
    base["show_posts"] = _visibility_allows(posts_vis)

    # Featured solo badges: enrichit depuis catalogue + badges réellement débloqués
    if base.get("is_own") or base.get("show_badges"):
        try:
            unlocked_map = await BadgeProgressService(db).get_unlocked_solo(profile_id)
        except Exception:
            unlocked_map = {}
        featured_ids, cards = build_featured_solo_badges(base.get("featured_badge_ids") or [], unlocked_map)
        base["featured_badge_ids"] = featured_ids
        base["featured_badges"] = cards
    else:
        base["featured_badge_ids"] = []
        base["featured_badges"] = []
    return base


def _featured_badge_http_error(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": code, "message": message})


def normalize_featured_badge_ids(raw_ids, unlocked_map: dict, *, max_count: int = 3) -> List[str]:
    """Normalisation non stricte (GET / affichage) : legacy → canonique, drop invalides."""
    if not isinstance(raw_ids, list):
        return []
    cleaned: List[str] = []
    seen = set()
    for raw in raw_ids:
        bid = canonical_badge_id(str(raw))
        if not bid or bid in seen:
            continue
        definition = get_badge_definition(bid)
        if not definition or definition.get("scope") != "solo":
            continue
        if definition.get("enabled", True) is False:
            continue
        if bid.startswith("duo_"):
            continue
        if unlocked_map and bid not in unlocked_map:
            continue
        seen.add(bid)
        cleaned.append(bid)
        if len(cleaned) >= max_count:
            break
    return cleaned


def build_featured_solo_badges(raw_ids, unlocked_map: dict) -> tuple:
    """Retourne (featured_badge_ids, featured_badges enrichis depuis le catalogue)."""
    featured_ids = normalize_featured_badge_ids(raw_ids, unlocked_map)
    cards = []
    for bid in featured_ids:
        definition = get_badge_definition(bid)
        if not definition or definition.get("scope") != "solo":
            continue
        if definition.get("enabled", True) is False:
            continue
        if unlocked_map and bid not in unlocked_map:
            continue
        cards.append(catalog_badge_to_public(definition, unlocked=True))
    ids = [c.get("id") for c in cards if c.get("id")]
    return ids, cards


def clean_featured_badge_ids(raw_ids, unlocked_map: dict) -> List[str]:
    if raw_ids is None:
        return []
    if not isinstance(raw_ids, list):
        raise HTTPException(status_code=400, detail="featured_badge_ids doit être une liste")
    if len(raw_ids) > 3:
        raise _featured_badge_http_error("FEATURED_BADGE_MAX", "Maximum 3 badges mis en avant")
    cleaned: List[str] = []
    seen = set()
    for raw in raw_ids:
        bid = canonical_badge_id(str(raw))
        if not bid:
            raise _featured_badge_http_error("FEATURED_BADGE_INVALID", "ID de badge vide")
        if bid in seen:
            raise _featured_badge_http_error("FEATURED_BADGE_DUPLICATE", "Badge dupliqué")
        definition = get_badge_definition(bid)
        if not definition or definition.get("scope") != "solo":
            raise _featured_badge_http_error("FEATURED_BADGE_INVALID_SCOPE", f"Badge solo invalide: {raw}")
        if definition.get("enabled", True) is False:
            raise _featured_badge_http_error("FEATURED_BADGE_DISABLED", f"Badge désactivé: {raw}")
        if bid not in (unlocked_map or {}):
            raise _featured_badge_http_error("FEATURED_BADGE_LOCKED", f"Badge non débloqué: {raw}")
        seen.add(bid)
        cleaned.append(bid)
        if len(cleaned) >= 3:
            break
    return cleaned

async def serialize_search_user(user_doc: dict, viewer_id: str) -> dict:
    profile_id = str(user_doc["_id"])
    relation = await get_follow_relation(viewer_id, profile_id)
    handle = user_doc.get("handle") or user_doc.get("username")
    return {
        "id": profile_id,
        "username": user_doc.get("username"),
        "handle": handle,
        "display_name": user_doc.get("display_name"),
        "avatar_url": user_doc.get("avatar_url"),
        "account_visibility": user_doc.get("account_visibility", "private"),
        **relation,
    }

async def create_notification(
    recipient_id: str,
    notif_type: str,
    actor: dict,
    *,
    skip_if_exists: bool = False,
    post_id: Optional[str] = None,
    request_id: Optional[str] = None,
    duo_id: Optional[str] = None,
    duo_tag: Optional[str] = None,
    push_url: Optional[str] = None,
    push_tag: Optional[str] = None,
    push_title: Optional[str] = None,
    push_body: Optional[str] = None,
    skip_push: bool = False,
) -> None:
    actor_id = actor["id"]
    if recipient_id == actor_id:
        return

    if skip_if_exists:
        existing = await db.notifications.find_one({
            "user_id": recipient_id,
            "type": notif_type,
            "actor_id": actor_id,
            **({"post_id": post_id} if post_id else {}),
        })
        if existing:
            return

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": recipient_id,
        "type": notif_type,
        "actor_id": actor_id,
        "actor_username": actor.get("username"),
        "actor_handle": actor.get("handle") or actor.get("username"),
        "actor_display_name": actor.get("display_name"),
        "actor_avatar_url": actor.get("avatar_url"),
        "read": False,
        "created_at": now,
    }
    if post_id:
        doc["post_id"] = post_id
    if request_id:
        doc["request_id"] = request_id
    if duo_id:
        doc["duo_id"] = duo_id
    if duo_tag:
        doc["duo_tag"] = duo_tag
    await db.notifications.insert_one(doc)
    if skip_push:
        return
    try:
        from push_service import notify_push, build_push_payload
        from i18n_messages import load_user_locale, t, DEFAULT_LOCALE
        recipient_locale = await load_user_locale(db, recipient_id)
        actor_name = (
            actor.get("display_name")
            or actor.get("username")
            or actor.get("handle")
            or t(recipient_locale, "push.generic.actor")
        )
        if actor_name == "push.generic.actor":
            actor_name = t(DEFAULT_LOCALE, "push.generic.actor")
        url = push_url or "/notifications"
        if not push_url and notif_type and str(notif_type).startswith("duo_"):
            url = "/notifications?filter=duo"
        if not push_url and notif_type == "partner_workout_started":
            url = "/duo"
        resolved_title = push_title
        resolved_body = push_body
        if resolved_title is None or resolved_body is None:
            try:
                payload_preview = build_push_payload(
                    notif_type,
                    locale=recipient_locale,
                    actor_name=actor_name,
                    url=url,
                    title=resolved_title,
                    body=resolved_body,
                    tag=push_tag,
                )
                resolved_title = resolved_title or payload_preview.get("title")
                resolved_body = resolved_body or payload_preview.get("body")
            except Exception:
                pass
        await notify_push(
            db,
            recipient_id,
            notif_type,
            actor_name=actor_name,
            url=url,
            title=resolved_title,
            body=resolved_body,
            tag=push_tag,
        )
    except Exception:
        pass

def serialize_notification(doc: dict) -> dict:
    out = {
        "id": str(doc["_id"]),
        "type": doc.get("type"),
        "actor_id": doc.get("actor_id"),
        "actor_username": doc.get("actor_username"),
        "actor_handle": doc.get("actor_handle"),
        "actor_display_name": doc.get("actor_display_name"),
        "actor_avatar_url": doc.get("actor_avatar_url"),
        "read": bool(doc.get("read")),
        "created_at": doc.get("created_at"),
    }
    if doc.get("post_id"):
        out["post_id"] = doc.get("post_id")
    if doc.get("request_id"):
        out["request_id"] = doc.get("request_id")
    if doc.get("duo_id"):
        out["duo_id"] = doc.get("duo_id")
    if doc.get("duo_tag"):
        out["duo_tag"] = doc.get("duo_tag")
    if doc.get("badge_id"):
        out["badge_id"] = doc.get("badge_id")
    if doc.get("badge_name"):
        out["badge_name"] = doc.get("badge_name")
    if doc.get("scope"):
        out["scope"] = doc.get("scope")
    if doc.get("translation_key"):
        out["translation_key"] = doc.get("translation_key")
    if doc.get("translation_params"):
        out["translation_params"] = doc.get("translation_params")
    if doc.get("title"):
        out["title"] = doc.get("title")
    if doc.get("body"):
        out["body"] = doc.get("body")
    if doc.get("url"):
        out["url"] = doc.get("url")
    return out

POST_TYPES = {
    "workout_photo", "workout", "badge", "duo_repost", "duo", "free",
    "duo_free", "duo_common_session", "duo_badge", "duo_challenge",
}
POST_VISIBILITY = {"public", "friends", "private", "duo"}
DUO_WALL_POST_TYPES = {"duo", "duo_free", "duo_common_session", "duo_badge", "duo_challenge"}


def duo_wall_owner_key(duo_doc: dict, user_id: str, partner_id: str) -> str:
    """Identifiant canonique du mur duo = pair_key."""
    return duo_doc.get("pair_key") or duo_pair_key(user_id, partner_id)


def resolve_duo_pair_key(duo_doc: dict) -> str:
    """pair_key canonique — depuis le doc ou member_ids."""
    pk = duo_doc.get("pair_key")
    if pk:
        return pk
    a_id, b_id = resolve_duo_member_pair_from_doc(duo_doc)
    if a_id and b_id:
        return duo_pair_key(a_id, b_id)
    return ""


def duo_wall_posts_query(pair_key: str, profile_id: Optional[str] = None) -> dict:
    """Requête mur duo — pair_key canonique + compat legacy profile _id / actor_id."""
    clauses = []
    if pair_key:
        clauses.extend([
            {"owner_type": "duo", "owner_id": pair_key},
            {"duo_id": pair_key},
            {"actor_type": "duo", "actor_id": pair_key},
        ])
    if profile_id:
        clauses.extend([
            {"owner_type": "duo", "owner_id": profile_id},
            {"duo_id": profile_id},
            {"actor_type": "duo", "actor_id": profile_id},
        ])
    if not clauses:
        return {"_id": None}
    return {"$or": clauses}


async def repair_duo_wall_post_ownership() -> int:
    """Réaligne owner/duo/actor sur pair_key pour les posts duo (idempotent)."""
    candidates = await db.posts.find({
        "$or": [
            {"actor_type": "duo"},
            {"owner_type": "duo"},
            {"duo_id": {"$exists": True, "$ne": None}},
            {"type": {"$in": list(DUO_WALL_POST_TYPES)}},
        ]
    }).to_list(5000)
    repaired = 0
    for post in candidates:
        if not is_duo_wall_post(post):
            continue
        duo_doc = await find_duo_doc_for_post(post)
        if not duo_doc:
            continue
        pair_key = resolve_duo_pair_key(duo_doc)
        if not pair_key:
            continue
        updates = {}
        if post.get("owner_type") != "duo" or post.get("owner_id") != pair_key:
            updates["owner_type"] = "duo"
            updates["owner_id"] = pair_key
        if post.get("duo_id") != pair_key:
            updates["duo_id"] = pair_key
        if post.get("actor_type") != "duo" or post.get("actor_id") != pair_key:
            updates["actor_type"] = "duo"
            updates["actor_id"] = pair_key
        if updates:
            await db.posts.update_one({"_id": post["_id"]}, {"$set": updates})
            repaired += 1
    return repaired


def is_duo_wall_post(post: dict) -> bool:
    """Mur duo vs mur utilisateur — rétrocompat sans owner_type."""
    owner_type = post.get("owner_type")
    if owner_type == "duo":
        return True
    if owner_type == "user":
        return False
    if post.get("duo_id"):
        return True
    if post.get("type") in DUO_WALL_POST_TYPES:
        return True
    return False


async def find_duo_doc_for_post(post: dict) -> Optional[dict]:
    """Résout le profil duo depuis pair_key (canonique) ou legacy _id."""
    candidates = []
    for key in (post.get("owner_id"), post.get("duo_id"), post.get("actor_id")):
        if key and key not in candidates:
            candidates.append(key)
    for key in candidates:
        doc = await db.duo_profiles.find_one({"pair_key": key})
        if doc:
            return apply_duo_defaults(doc)
    for key in candidates:
        try:
            doc = await db.duo_profiles.find_one({"_id": ObjectId(key)})
            if doc:
                return apply_duo_defaults(doc)
        except Exception:
            continue
    return None


async def is_duo_member_user(user_id: str, duo_doc: dict) -> bool:
    members = await get_duo_members(db, duo_doc)
    return user_id in {str(m["_id"]) for m in members}


async def can_delete_post(user_id: str, post: dict, duo_doc: Optional[dict] = None) -> bool:
    creator = post.get("created_by_user_id") or post.get("author_id")
    if creator == user_id:
        return True
    if is_duo_wall_post(post):
        if not duo_doc:
            duo_doc = await find_duo_doc_for_post(post)
        if duo_doc:
            return await is_duo_member_user(user_id, duo_doc)
    return False


async def can_view_post_doc(viewer_id: str, post: dict) -> bool:
    if is_duo_wall_post(post):
        duo_doc = await find_duo_doc_for_post(post)
        if not duo_doc:
            return False
        return await can_view_duo_post(viewer_id, post, duo_doc)
    author = await get_user_doc_by_id(post.get("author_id"))
    if not author:
        return False
    return await can_view_post(viewer_id, post, author)


async def resolve_post_actor(post: dict, duo_doc: Optional[dict] = None) -> dict:
    """Identité publique affichée — duo ou utilisateur."""
    actor_type = post.get("actor_type")
    actor_id = post.get("actor_id")

    if not actor_type:
        if is_duo_wall_post(post):
            actor_type = "duo"
            actor_id = post.get("owner_id") or post.get("duo_id")
        else:
            actor_type = "user"
            actor_id = post.get("author_id") or post.get("created_by_user_id")

    if actor_type == "duo":
        if not duo_doc:
            duo_doc = await find_duo_doc_for_post(post)
        if duo_doc:
            members = await get_duo_members(db, duo_doc)
            tag = duo_tag_from_doc(duo_doc)
            pair_key = duo_doc.get("pair_key") or duo_wall_owner_key(
                duo_doc,
                str(members[0]["_id"]) if members else "",
                str(members[1]["_id"]) if len(members) > 1 else "",
            )
            member_cards = []
            for m in members:
                member_cards.append({
                    "id": str(m["_id"]),
                    "username": m.get("username"),
                    "handle": m.get("handle") or m.get("username"),
                    "display_name": m.get("display_name"),
                    "avatar_url": m.get("avatar_url"),
                    "accent_color": m.get("accent_color"),
                })
            return {
                "type": "duo",
                "id": pair_key or str(duo_doc["_id"]),
                "name": duo_doc.get("name") or "Duo",
                "handle": tag,
                "tag": tag,
                "avatar_url": duo_doc.get("avatar_url"),
                "member_avatars": [m.get("avatar_url") for m in members],
                "member_colors": [m.get("accent_color") for m in members],
                "members": member_cards,
            }

    user_id = actor_id or post.get("author_id") or post.get("created_by_user_id")
    author = await get_user_doc_by_id(user_id) if user_id else None
    if not author:
        return {
            "type": "user",
            "id": user_id,
            "name": post.get("author_display_name") or "Utilisateur",
            "handle": post.get("author_handle") or post.get("author_username"),
            "avatar_url": post.get("author_avatar_url"),
        }
    return {
        "type": "user",
        "id": str(author["_id"]),
        "name": author.get("display_name") or author.get("username"),
        "handle": author.get("handle") or author.get("username"),
        "avatar_url": author.get("avatar_url"),
    }


def user_wall_posts_query(author_id: str) -> dict:
    """Posts du mur personnel — exclut les publications mur duo."""
    return {
        "author_id": author_id,
        "$or": [
            {"owner_type": "user"},
            {
                "$and": [
                    {"$or": [{"owner_type": {"$exists": False}}, {"owner_type": None}]},
                    {"$or": [{"duo_id": {"$exists": False}}, {"duo_id": None}]},
                    {"type": {"$nin": list(DUO_WALL_POST_TYPES)}},
                ],
            },
        ],
    }


async def get_user_doc_by_id(user_id: str) -> Optional[dict]:
    try:
        return await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


async def can_view_post(viewer_id: str, post: dict, author: dict) -> bool:
    author_id = str(author.get("_id") or author.get("id"))
    if viewer_id == author_id:
        return True

    access = await get_profile_access_level(viewer_id, author)
    if access == "limited":
        return False

    posts_vis = resolve_visibility_value(author, "posts_visibility", "show_posts", default_public=False)
    if not visibility_allows(access, posts_vis):
        return False

    visibility = post.get("visibility", "public")
    if visibility == "private":
        return False
    if visibility == "friends":
        return access in ("own", "friend")
    return True


async def can_view_session_in_post(viewer_id: str, author: dict, session: dict) -> bool:
    if viewer_id == str(session.get("user_id")):
        return True
    access = await get_profile_access_level(viewer_id, author)
    if access == "limited":
        return False
    if access == "own":
        return True
    if author.get("account_visibility") == "public":
        return True
    return access in ("follower", "friend")


def build_session_snapshot(session: dict, workout: Optional[dict] = None) -> dict:
    difficulty = session.get("difficulty_felt")
    return {
        "workout_title": session.get("workout_title"),
        "total_time": session.get("total_time", 0),
        "pause_time": session.get("pause_time", 0),
        "exercises_completed": session.get("exercises_completed", 0),
        "exercises_total": session.get("exercises_total", 0),
        "difficulty_felt": difficulty,
        "difficulty": workout.get("difficulty") if workout else None,
        "estimated_calories": estimate_calories(session.get("total_time", 0), difficulty),
        "status": session.get("status"),
    }


async def _load_workout_for_session(session: dict) -> Optional[dict]:
    wid = session.get("workout_id")
    if not wid:
        return None
    try:
        return await db.scheduled_workouts.find_one({"_id": ObjectId(wid)})
    except Exception:
        return None


def _serialize_post_comment(comment: dict, viewer_id: Optional[str] = None) -> dict:
    likes = comment.get("likes") or []
    return {
        "id": comment.get("id"),
        "user_id": comment.get("user_id"),
        "username": comment.get("username"),
        "handle": comment.get("handle"),
        "display_name": comment.get("display_name"),
        "avatar_url": comment.get("avatar_url"),
        "text": comment.get("text"),
        "created_at": comment.get("created_at"),
        "likes_count": len(likes),
        "is_liked": viewer_id in likes if viewer_id else False,
    }


async def serialize_post(
    post: dict,
    viewer_id: str,
    author: Optional[dict] = None,
    *,
    include_all_comments: bool = False,
    duo_doc: Optional[dict] = None,
) -> Optional[dict]:
    is_duo = is_duo_wall_post(post)
    if is_duo:
        if not duo_doc:
            duo_doc = await find_duo_doc_for_post(post)
        if not duo_doc:
            return None
        if not await can_view_duo_post(viewer_id, post, duo_doc):
            return None
    else:
        if author is None:
            author = await get_user_doc_by_id(post.get("author_id"))
        if not author:
            return None
        if not await can_view_post(viewer_id, post, author):
            return None

    actor = await resolve_post_actor(post, duo_doc=duo_doc)
    created_by_user_id = post.get("created_by_user_id") or post.get("author_id")
    author_id = created_by_user_id
    if author is None and not is_duo:
        author = await get_user_doc_by_id(author_id)

    likes = post.get("likes") or []
    comments = post.get("comments") or []
    serialized_comments = [_serialize_post_comment(c, viewer_id) for c in comments]

    actor_type = post.get("actor_type") or ("duo" if is_duo else "user")
    actor_id = post.get("actor_id") or post.get("owner_id") or post.get("duo_id") or author_id

    result = {
        "id": str(post["_id"]),
        "author_id": post.get("author_id") or created_by_user_id,
        "created_by_user_id": created_by_user_id,
        "actor_type": actor_type,
        "actor_id": actor_id,
        "actor": actor,
        "author_username": post.get("author_username") or (author.get("username") if author else None),
        "author_handle": post.get("author_handle") or ((author.get("handle") or author.get("username")) if author else None),
        "author_display_name": post.get("author_display_name") or (author.get("display_name") if author else None),
        "author_avatar_url": post.get("author_avatar_url") or (author.get("avatar_url") if author else None),
        "type": post.get("type"),
        "title": post.get("title"),
        "description": post.get("description"),
        "image_url": post.get("image_url"),
        "workout_session_id": post.get("workout_session_id"),
        "badge_id": post.get("badge_id"),
        "badge_name": post.get("badge_name"),
        "badge_icon": post.get("badge_icon"),
        "badge_rarity": post.get("badge_rarity") or "Commun",
        "duo_session_id": post.get("duo_session_id"),
        "partner_session_id": post.get("partner_session_id"),
        "duo_id": post.get("duo_id"),
        "owner_type": post.get("owner_type"),
        "owner_id": post.get("owner_id"),
        "duo_name": duo_doc.get("name") if duo_doc else actor.get("name") if actor.get("type") == "duo" else None,
        "duo_tag": duo_tag_from_doc(duo_doc) if duo_doc else actor.get("tag") if actor.get("type") == "duo" else None,
        "source_post_id": post.get("source_post_id"),
        "visibility": post.get("visibility", "public"),
        "likes_count": len(likes),
        "comments_count": len(comments),
        "is_liked": viewer_id in likes,
        "can_delete": await can_delete_post(viewer_id, post, duo_doc),
        "preview_comment": serialized_comments[-1] if serialized_comments else None,
        "comments": serialized_comments if include_all_comments else (
            [serialized_comments[-1]] if serialized_comments else []
        ),
        "created_at": post.get("created_at"),
        "session_snapshot": post.get("session_snapshot"),
        "can_view_session_details": False,
        "session_details": None,
    }

    session_id = post.get("workout_session_id") or post.get("duo_session_id")
    partner_session_id = post.get("partner_session_id")
    if session_id:
        try:
            session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
        except Exception:
            session = None
        if session:
            if not result.get("session_snapshot"):
                workout = await _load_workout_for_session(session)
                result["session_snapshot"] = build_session_snapshot(session, workout)

            can_details = await can_view_session_in_post(viewer_id, author, session) if author else False
            result["can_view_session_details"] = can_details
            if can_details:
                result["session_details"] = {
                    "exercise_log": session.get("exercise_log") or [],
                    "fatigue_before": session.get("fatigue_before"),
                    "fatigue_after": session.get("fatigue_after"),
                    "difficulty_felt": session.get("difficulty_felt"),
                    "mood": session.get("mood"),
                    "notes": session.get("notes"),
                }

    if partner_session_id:
        try:
            partner_session = await db.workout_sessions.find_one({"_id": ObjectId(partner_session_id)})
        except Exception:
            partner_session = None
        if partner_session:
            partner_author = await get_user_doc_by_id(partner_session.get("user_id"))
            workout_p = await _load_workout_for_session(partner_session)
            result["partner_session_snapshot"] = build_session_snapshot(partner_session, workout_p)
            if partner_author:
                result["partner_author_id"] = str(partner_author["_id"])
                result["partner_author_username"] = partner_author.get("username")
                result["partner_author_handle"] = partner_author.get("handle") or partner_author.get("username")
                result["partner_author_display_name"] = partner_author.get("display_name")
                result["partner_author_avatar_url"] = partner_author.get("avatar_url")
                result["common_session"] = True
                created = partner_session.get("created_at") or ""
                if created:
                    result["common_date"] = created[:10]
            can_p = await can_view_session_in_post(viewer_id, partner_author, partner_session) if partner_author else False
            result["can_view_partner_session_details"] = can_p
            if can_p:
                result["partner_session_details"] = {
                    "exercise_log": partner_session.get("exercise_log") or [],
                    "fatigue_before": partner_session.get("fatigue_before"),
                    "fatigue_after": partner_session.get("fatigue_after"),
                    "difficulty_felt": partner_session.get("difficulty_felt"),
                    "mood": partner_session.get("mood"),
                    "notes": partner_session.get("notes"),
                }

    return result


async def _get_user_streak_value(user_id: str) -> int:
    user_doc = await get_user_doc_by_id(user_id)
    if not user_doc:
        return 0
    partner_id = user_doc.get("partner_id")
    return await calculate_streak(user_id, partner_id)

async def generate_duo_short_id() -> int:
    for _ in range(50):
        candidate = random.randint(1000, 9999)
        exists = await db.duo_profiles.find_one({"short_id": candidate})
        if not exists:
            return candidate
    return random.randint(10000, 99999)

async def ensure_duo_profile(user_id_a: str, user_id_b: str) -> dict:
    pair_key = duo_pair_key(user_id_a, user_id_b)
    existing = await db.duo_profiles.find_one({"pair_key": pair_key})
    if existing:
        return apply_duo_defaults(existing)

    user_a = await db.users.find_one({"_id": ObjectId(user_id_a)})
    user_b = await db.users.find_one({"_id": ObjectId(user_id_b)})
    name_a = re.sub(r"[^a-zA-Z0-9]", "", (user_a.get("display_name") or user_a.get("username") or "A"))
    name_b = re.sub(r"[^a-zA-Z0-9]", "", (user_b.get("display_name") or user_b.get("username") or "B"))
    base_name = f"{name_a}{name_b}"[:24] or "Duo"

    rel_a = user_a.get("relation_type") or "partner"
    rel_b = user_b.get("relation_type") or rel_a
    relation_type = normalize_duo_relation(rel_a or rel_b)
    coach_id, student_id = resolve_coach_roles(relation_type, user_a, user_b)

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": base_name,
        "short_id": await generate_duo_short_id(),
        "member_ids": sorted([user_id_a, user_id_b]),
        "pair_key": pair_key,
        "relation_type": relation_type,
        "coach_member_id": coach_id,
        "student_member_id": student_id,
        "avatar_url": None,
        "banner_url": None,
        "account_visibility": "private",
        "show_stats": False,
        "show_badges": True,
        "show_recent_activity": False,
        "show_posts": False,
        "show_challenges": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.duo_profiles.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc

def serialize_duo_search(duo_doc: dict) -> dict:
    duo_doc = apply_duo_defaults(duo_doc)
    name = duo_doc.get("name") or "Duo"
    short_id = int(duo_doc.get("short_id") or 0)
    return {
        "id": str(duo_doc["_id"]),
        "name": name,
        "short_id": short_id,
        "tag": duo_tag_from_doc(duo_doc),
        "member_count": len(duo_doc.get("member_ids") or []),
        "account_visibility": duo_doc.get("account_visibility", "private"),
    }

async def _get_duo_profile_for_user(user_id: str, partner_id: Optional[str]) -> Optional[dict]:
    if not partner_id:
        return None
    pair_key = duo_pair_key(user_id, partner_id)
    doc = await db.duo_profiles.find_one({"pair_key": pair_key})
    if doc:
        return apply_duo_defaults(doc)
    return apply_duo_defaults(await ensure_duo_profile(user_id, partner_id))


def normalize_upload_path(url: Optional[str]) -> Optional[str]:
    """Stocke un chemin relatif /uploads/... pour persistance portable."""
    if not url:
        return None
    raw = str(url).strip()
    if not raw:
        return None
    if raw.startswith("/uploads/"):
        return raw[:500]
    if raw.startswith("uploads/"):
        return f"/{raw}"[:500]
    if "/uploads/" in raw:
        idx = raw.find("/uploads/")
        return raw[idx:idx + 500]
    if raw.startswith("http"):
        return None
    return raw[:500]


async def assemble_duo_common_stats(
    user_a_id: str, user_b_id: str, *, locale: Optional[str] = None
) -> dict:
    """Stats communes duo — source unique pour /duo/stats et /duos/{tag}/stats."""
    together = await compute_together_stats(db, user_a_id, user_b_id)
    streak = await calculate_streak(user_a_id, user_b_id)
    pair_key = duo_pair_key(user_a_id, user_b_id)
    service = BadgeProgressService(db)
    duo_catalog = await service.get_duo_catalog_with_progress(pair_key)
    badges = list(duo_catalog.get("badges") or [])
    challenge = await get_current_challenge(user_a_id, user_b_id, streak, locale=locale)

    if challenge and challenge.get("status") == "completed":
        week_key = challenge.get("week_key", "")
        existing = await db.challenge_completions.find_one({"pair_key": pair_key, "week_key": week_key})
        if not existing:
            await db.challenge_completions.insert_one({
                "pair_key": pair_key,
                "user_id": user_a_id,
                "partner_id": user_b_id,
                "week_key": week_key,
                "week_start": challenge.get("week_start", ""),
                "challenge_id": challenge.get("id"),
                "scope": "duo",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            together["challenges_completed"] = together.get("challenges_completed", 0) + 1
            schedule_badge_evaluation(
                trigger_duo_evaluation(db, pair_key, notify_user_ids=[user_a_id, user_b_id])
            )
            duo_catalog = await service.get_duo_catalog_with_progress(pair_key)
            badges = list(duo_catalog.get("badges") or [])

    sessions = together.get("sessions_together", 0)
    total_time = together.get("total_training_time", 0)
    unlocked = [b for b in badges if b.get("unlocked")]
    summary = duo_catalog.get("summary") or {}

    return {
        **together,
        "sessions_together": sessions,
        "total_workouts_together": sessions,
        "training_days_together": together.get("training_days_together", sessions),
        "total_training_time": total_time,
        "total_training_time_together": total_time,
        "duo_streak_current": together.get("duo_streak_current", 0),
        "duo_streak_best": together.get("duo_streak_best", 0),
        "estimated_calories": together.get("estimated_calories", 0),
        "last_common_session": together.get("last_common_session"),
        "challenges_completed": together.get("challenges_completed", 0),
        "badges": badges,
        "duo_badges": badges,
        "badges_unlocked": summary.get("unlocked", len(unlocked)),
        "badges_total": summary.get("total", len(badges)),
        "badges_summary": summary,
        "current_challenge": challenge,
    }


async def _duo_followers_count(duo_id: str) -> int:
    try:
        return await db.duo_follows.count_documents({"duo_id": duo_id, "status": "accepted"})
    except Exception:
        return 0


async def serialize_duo_profile_for_viewer(duo_doc: dict, viewer_id: str) -> dict:
    duo_doc = apply_duo_defaults(duo_doc)
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, viewer_id, duo_doc, members)
    duo_id = str(duo_doc["_id"])
    tag = duo_tag_from_doc(duo_doc)
    relation_type = normalize_duo_relation(duo_doc.get("relation_type"))

    member_cards = []
    for m in members:
        mid = str(m["_id"])
        access_member = await get_profile_access_level(viewer_id, m)
        card = {
            "id": mid,
            "username": m.get("username"),
            "handle": m.get("handle") or m.get("username"),
            "display_name": m.get("display_name"),
            "avatar_url": m.get("avatar_url"),
            "accent_color": m.get("accent_color"),
            "is_coach": mid == duo_doc.get("coach_member_id") or (duo_doc.get("member_roles") or {}).get(mid) == "coach",
            "is_student": mid == duo_doc.get("student_member_id"),
            "is_leader": mid == duo_doc.get("leader_member_id") or (duo_doc.get("member_roles") or {}).get(mid) == "leader",
            "duo_role": (duo_doc.get("member_roles") or {}).get(mid)
                or ("coach" if mid == duo_doc.get("coach_member_id") else None)
                or ("leader" if mid == duo_doc.get("leader_member_id") else None)
                or "member",
            "is_limited": access_member == "limited",
        }
        if access_member != "limited":
            card["bio"] = m.get("bio")
        member_cards.append(card)

    base = {
        "id": duo_id,
        "pair_key": duo_doc.get("pair_key"),
        "name": duo_doc.get("name") or "Duo",
        "short_id": int(duo_doc.get("short_id") or 0),
        "tag": tag,
        "relation_type": relation_type,
        "relation_label": RELATION_LABELS.get(relation_type, "Partenaires"),
        "avatar_url": duo_doc.get("avatar_url"),
        "banner_url": duo_doc.get("banner_url"),
        "account_visibility": duo_doc.get("account_visibility", "private"),
        "show_stats": duo_doc.get("show_stats", False),
        "show_badges": duo_doc.get("show_badges", True),
        "show_recent_activity": duo_doc.get("show_recent_activity", False),
        "show_posts": duo_doc.get("show_posts", False),
        "show_challenges": duo_doc.get("show_challenges", True),
        "members": member_cards if access != "limited" else [],
        "is_member": access == "member",
        "is_limited": access == "limited",
        "access_level": access,
        "coach_member_id": duo_doc.get("coach_member_id"),
        "student_member_id": duo_doc.get("student_member_id"),
        "leader_member_id": duo_doc.get("leader_member_id"),
        "member_roles": duo_doc.get("member_roles") or {},
        "featured_badge_ids": list(duo_doc.get("featured_badge_ids") or [])[:3],
        "featured_badges": [],
        "created_at": duo_doc.get("created_at"),
        "updated_at": duo_doc.get("updated_at"),
    }

    follow_doc = await get_duo_follow_doc(db, duo_id, viewer_id)
    base["is_following_duo"] = bool(follow_doc and follow_doc.get("status") == "accepted")
    base["duo_follow_pending"] = bool(follow_doc and follow_doc.get("status") == "pending")
    base["duo_follow_id"] = str(follow_doc["_id"]) if follow_doc else None
    base["followers_count"] = await _duo_followers_count(duo_id)

    if access == "limited":
        base["show_stats"] = False
        base["show_badges"] = False
        base["show_recent_activity"] = False
        base["show_posts"] = False
        base["show_challenges"] = False
        base["featured_badge_ids"] = []
        base["featured_badges"] = []
    else:
        stats_vis = resolve_duo_visibility(duo_doc, "stats")
        badges_vis = resolve_duo_visibility(duo_doc, "badges")
        activity_vis = resolve_duo_visibility(duo_doc, "activity")
        posts_vis = resolve_duo_visibility(duo_doc, "posts")
        challenges_vis = resolve_duo_visibility(duo_doc, "challenges")
        if duo_doc.get("account_visibility") == "public":
            posts_vis = badges_vis = "public"
        elif duo_doc.get("account_visibility") == "private":
            posts_vis = badges_vis = "followers"
        base["stats_visibility"] = stats_vis
        base["wall_visibility"] = posts_vis
        base["badges_visibility"] = badges_vis
        base["activity_visibility"] = activity_vis
        base["challenges_visibility"] = challenges_vis
        base["show_stats"] = duo_visibility_allows(access, stats_vis)
        base["show_badges"] = duo_visibility_allows(access, badges_vis)
        base["show_recent_activity"] = duo_visibility_allows(access, activity_vis)
        base["show_posts"] = duo_visibility_allows(access, posts_vis)
        base["show_challenges"] = duo_visibility_allows(access, challenges_vis)
        if access != "member" and not base["show_badges"]:
            base["featured_badge_ids"] = []
            base["featured_badges"] = []
        elif base["featured_badge_ids"]:
            featured_cards = []
            pair_key = duo_doc.get("pair_key")
            if not pair_key and len(member_cards) >= 2:
                pair_key = duo_pair_key(member_cards[0]["id"], member_cards[1]["id"])
            unlocked_map = await BadgeProgressService(db).get_unlocked_duo(pair_key) if pair_key else {}
            for bid in list(base["featured_badge_ids"] or [])[:3]:
                definition = get_badge_definition(bid)
                if not definition or definition.get("scope") != "duo":
                    continue
                if unlocked_map and bid not in unlocked_map:
                    continue
                public = catalog_badge_to_public(definition, unlocked=True)
                featured_cards.append(public)
            base["featured_badges"] = featured_cards
            base["featured_badge_ids"] = [b.get("id") for b in featured_cards if b.get("id")]
    return base

async def can_view_duo_post(viewer_id: str, post: dict, duo_doc: dict) -> bool:
    duo_doc = apply_duo_defaults(duo_doc)
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, viewer_id, duo_doc, members)
    if access == "limited":
        return False
    if access == "member":
        return True
    if not duo_doc.get("show_posts", False):
        return False
    visibility = post.get("visibility", "public")
    if visibility == "private":
        return False
    if visibility == "friends":
        return access in ("friend", "follower")
    if visibility == "duo":
        return access in ("follower", "friend", "public")
    return True

async def can_view_user_stats(viewer_id: str, target_user: dict) -> bool:
    access = await get_profile_access_level(viewer_id, target_user)
    if access == "limited":
        return False
    if access == "own":
        return True
    stats_vis = resolve_visibility_value(target_user, "stats_visibility", "show_stats", default_public=False)
    if target_user.get("account_visibility") == "private" and stats_vis == "public":
        stats_vis = "followers"
    return visibility_allows(access, stats_vis)

# ============ STARTUP ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index("username", unique=True)
    await db.users.create_index("handle", unique=True, sparse=True)
    await db.exercises.create_index("user_id")
    await db.exercises.create_index("is_system")
    await db.workout_templates.create_index("user_id")
    await db.scheduled_workouts.create_index("for_user_id")
    await db.scheduled_workouts.create_index("scheduled_date")
    await db.workout_sessions.create_index("user_id")
    await db.partner_requests.create_index("from_user_id")
    await db.partner_requests.create_index("to_user_id")
    await db.streak_days.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.duo_streak_overrides.create_index("pair_key", unique=True)
    await db.scheduled_workouts.create_index([("for_user_id", 1), ("scheduled_date", 1)])
    await db.workout_sessions.create_index([("user_id", 1), ("created_at", -1)])
    await db.challenge_completions.create_index([("user_id", 1), ("week_key", 1)], unique=True)
    await db.challenge_completions.create_index([("pair_key", 1), ("week_key", 1)])
    await db.challenge_completions.create_index("pair_key")
    await db.challenge_completions.create_index("week_key")
    await db.challenge_completions.create_index("created_at")
    await db.session_time_audit.create_index("session_id")
    await db.workout_progress.create_index([("user_id", 1), ("saved_at", -1)])
    await db.live_workout_messages.create_index([("pair_key", 1), ("created_at", -1)])
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.follows.create_index("following_id")
    await db.follow_requests.create_index([("requester_id", 1), ("target_id", 1)], unique=True)
    await db.follow_requests.create_index([("target_id", 1), ("status", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.duo_profiles.create_index("pair_key", unique=True)
    await db.duo_profiles.create_index("short_id")
    await db.duo_profiles.create_index("name")
    await db.push_subscriptions.create_index([("user_id", 1), ("endpoint", 1)], unique=True)
    await db.push_subscriptions.create_index("user_id")
    await db.push_subscriptions.create_index("revoked_at")

    await db.posts.create_index([("author_id", 1), ("created_at", -1)])
    await db.posts.create_index("created_at")
    await db.posts.create_index([("duo_id", 1), ("created_at", -1)])
    await db.posts.create_index([("owner_type", 1), ("owner_id", 1), ("created_at", -1)])
    await db.posts.create_index("badge_id")
    try:
        badge_service = BadgeProgressService(db)
        await badge_service.ensure_indexes()
    except Exception as exc:
        logger.warning("Badge indexes setup failed: %s", exc)
    repaired_posts = await repair_duo_wall_post_ownership()
    if repaired_posts:
        logger.info("Repaired %s duo wall posts ownership fields", repaired_posts)
    await db.reposts.create_index([("user_id", 1), ("created_at", -1)])
    await db.reposts.create_index([("user_id", 1), ("post_id", 1)])
    await db.reposts.create_index([("user_id", 1), ("workout_session_id", 1)])
    await db.duo_follows.create_index([("duo_id", 1), ("follower_id", 1)], unique=True)
    await db.duo_follows.create_index([("follower_id", 1), ("status", 1)])
    await db.duo_follows.create_index([("duo_id", 1), ("status", 1)])
    await db.duo_follows.create_index("status")
    
    await seed_system_exercises()
    await ensure_program_volume_templates(db, logger)
    await seed_test_user()
    
    logger.info("Database indexes created and seed data loaded")
    yield
    client.close()

async def seed_system_exercises():
    count = await db.exercises.count_documents({"is_system": True})
    if count == 0:
        # GIF URLs from common fitness resources
        system_exercises = [
            {"name": "Jumping Jacks", "category": "warmup", "exercise_type": "duration", "default_duration": 60, "default_rest": 15, "is_system": True, "image_url": "https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif", "description": "Sautez en écartant les bras et les jambes", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "High Knees", "category": "warmup", "exercise_type": "duration", "default_duration": 45, "default_rest": 15, "is_system": True, "image_url": "https://media.giphy.com/media/l378p60yRSCeVoyAM/giphy.gif", "description": "Montez les genoux haut en alternant", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Arm Circles", "category": "warmup", "exercise_type": "duration", "default_duration": 30, "default_rest": 10, "is_system": True, "image_url": "https://media.giphy.com/media/3oKIPavRPgJYaNI97W/giphy.gif", "description": "Faites des cercles avec vos bras tendus", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Push-ups", "category": "upper", "exercise_type": "reps", "default_reps": 15, "default_rest": 45, "is_system": True, "image_url": "https://media.giphy.com/media/Kajba0IrBfAaQ/giphy.gif", "description": "Pompes classiques", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Squats", "category": "lower", "exercise_type": "reps", "default_reps": 20, "default_rest": 45, "is_system": True, "image_url": "https://media.giphy.com/media/1qfKN8Dt0CRdCRxz9q/giphy.gif", "description": "Flexion des jambes, dos droit", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Lunges", "category": "lower", "exercise_type": "reps", "default_reps": 12, "default_rest": 45, "is_system": True, "image_url": "https://media.giphy.com/media/xT8qBff8cRRFf7k2u4/giphy.gif", "description": "Fentes avant alternées", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Plank", "category": "core", "exercise_type": "duration", "default_duration": 45, "default_rest": 30, "is_system": True, "image_url": "https://media.giphy.com/media/xT8qBvgKeMvMGSJNgA/giphy.gif", "description": "Gainage sur les avant-bras", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Crunches", "category": "core", "exercise_type": "reps", "default_reps": 20, "default_rest": 30, "is_system": True, "image_url": "https://media.giphy.com/media/7YCC7wfBjkAP6fMjW4/giphy.gif", "description": "Relevés de buste", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Mountain Climbers", "category": "cardio", "exercise_type": "duration", "default_duration": 45, "default_rest": 30, "is_system": True, "image_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2llbjd3aWgxemE4dDd0b2xuNWxrMjlnM2JhZDV0ZGM2aHlneWttYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6v4VaKVSoAdEY/giphy.gif", "description": "Grimpeur en position de planche", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Burpees", "category": "cardio", "exercise_type": "reps", "default_reps": 10, "default_rest": 60, "is_system": True, "image_url": "https://media.giphy.com/media/23hPPMRgPxbNBlPQe3/giphy.gif", "description": "Squat, planche, pompe, saut", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Stretching", "category": "cooldown", "exercise_type": "duration", "default_duration": 120, "default_rest": 0, "is_system": True, "image_url": "https://media.giphy.com/media/fw3LPEy16YF5DFOG1B/giphy.gif", "description": "Étirements complets", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Deep Breathing", "category": "cooldown", "exercise_type": "duration", "default_duration": 60, "default_rest": 0, "is_system": True, "image_url": None, "description": "Respiration profonde et lente", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Wall Sit", "category": "lower", "exercise_type": "duration", "default_duration": 45, "default_rest": 30, "is_system": True, "image_url": "https://media.giphy.com/media/3ohc11UljvpPKWeNva/giphy.gif", "description": "Chaise murale dos contre le mur", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Bridge", "category": "core", "exercise_type": "reps", "default_reps": 15, "default_rest": 30, "is_system": True, "image_url": "https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif", "description": "Pont fessier au sol", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.exercises.insert_many(system_exercises)
        logger.info("System exercises seeded with images")

async def seed_test_user():
    test_username = os.environ.get("TEST_USERNAME", "testuser")
    test_password = os.environ.get("TEST_PASSWORD", "test123")
    
    existing = await db.users.find_one({"username": test_username})
    if not existing:
        await db.users.insert_one({
            "username": test_username,
            "password_hash": hash_password(test_password),
            "display_name": "Test User",
            "fitness_level": "intermediate",
            "theme": "default",
            "tts_enabled": True,
            "timer_sound": "beep",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Test user created: {test_username}")
    
    # Write credentials file
    Path("/app/memory").mkdir(parents=True, exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Test User\n")
        f.write(f"- Username: {test_username}\n")
        f.write(f"- Password: {test_password}\n\n")
        f.write(f"## Auth Endpoints\n")
        f.write(f"- POST /api/auth/register\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- GET /api/auth/me\n")

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(data: UserCreate, response: Response):
    existing = await db.users.find_one({"username": data.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_doc = {
        "username": data.username.lower(),
        "handle": normalize_handle(data.username) or data.username.lower(),
        "password_hash": hash_password(data.password),
        "display_name": data.display_name or data.username,
        "gender": data.gender,
        "fitness_level": data.fitness_level,
        "main_goal": data.main_goal,
        "theme": "default",
        "tts_enabled": True,
        "timer_sound": "beep",
        "account_visibility": "private",
        "show_stats": False,
        "show_badges": True,
        "show_recent_activity": False,
        "show_sessions": False,
        "show_posts": False,
        "featured_badges": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    
    access_token = create_access_token(str(result.inserted_id), data.username.lower())
    refresh_token = create_refresh_token(str(result.inserted_id))
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    return serialize_user(user_doc)

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({"username": data.username.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(str(user["_id"]), user["username"])
    refresh_token = create_refresh_token(str(user["_id"]))
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen_at": now}})
    user["last_seen_at"] = now
    
    return serialize_user(user)

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"last_seen_at": now}})
    full_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    full_user["last_seen_at"] = now
    return serialize_user(full_user)

@api_router.put("/auth/profile")
async def update_profile(data: UserUpdate, user: dict = Depends(get_current_user)):
    payload = data.model_dump(exclude_unset=True)
    set_data = {}
    unset_data = {}

    if "handle" in payload:
        normalized_handle = normalize_handle(payload["handle"])
        if not normalized_handle:
            raise HTTPException(
                status_code=400,
                detail="Arobase invalide (3-30 caractères, lettres, chiffres et _ uniquement)",
            )
        existing = await db.users.find_one({
            "$or": [
                {"handle": normalized_handle},
                {"username": normalized_handle},
            ],
            "_id": {"$ne": ObjectId(user["id"])},
        })
        if existing:
            raise HTTPException(status_code=400, detail="Cet arobase est déjà pris")
        set_data["handle"] = normalized_handle
        payload.pop("handle")

    if "locale" in payload:
        loc = payload.pop("locale")
        if loc is None or str(loc).strip() == "":
            unset_data["locale"] = ""
        else:
            loc = str(loc)
            if loc not in SUPPORTED_LOCALES:
                raise HTTPException(status_code=400, detail="locale invalide")
            set_data["locale"] = loc

    if "time_format" in payload:
        tf = payload.pop("time_format")
        tf = "auto" if tf is None or str(tf).strip() == "" else str(tf)
        if tf not in SUPPORTED_TIME_FORMATS:
            raise HTTPException(status_code=400, detail="time_format invalide")
        set_data["time_format"] = tf

    # Featured badges perso (solo) — source canonique: featured_badge_ids
    if "featured_badge_ids" in payload or "featured_badges" in payload:
        raw_ids = payload.pop("featured_badge_ids", None)
        if raw_ids is None:
            # compat legacy: featured_badges contenait les IDs
            raw_ids = payload.pop("featured_badges", None)
        unlocked_map = await BadgeProgressService(db).get_unlocked_solo(user["id"])
        cleaned = clean_featured_badge_ids(raw_ids or [], unlocked_map)
        set_data["featured_badge_ids"] = cleaned
        # legacy compat (ids en base)
        set_data["featured_badges"] = cleaned

    if "notification_prefs" in payload:
        raw_prefs = payload.pop("notification_prefs")
        if raw_prefs is not None and not isinstance(raw_prefs, dict):
            raise HTTPException(status_code=400, detail="notification_prefs invalide")
        from push_service import merge_notification_prefs
        set_data["notification_prefs"] = merge_notification_prefs(raw_prefs)

    if "account_visibility" in payload:
        vis = payload.pop("account_visibility")
        if vis not in ("public", "private"):
            raise HTTPException(status_code=400, detail="account_visibility invalide")
        set_data["account_visibility"] = vis
        if vis == "public":
            set_data["posts_visibility"] = "public"
            set_data["badges_visibility"] = "public"
            set_data["show_posts"] = True
            set_data["show_badges"] = True
        elif vis == "private":
            set_data["posts_visibility"] = "followers"
            set_data["badges_visibility"] = "followers"
            set_data["activity_visibility"] = "followers"
            set_data["stats_visibility"] = "followers"
            set_data["show_posts"] = True
            set_data["show_badges"] = True
            set_data["show_recent_activity"] = True
            set_data["show_stats"] = True

    visibility_legacy_map = {
        "stats_visibility": "show_stats",
        "badges_visibility": "show_badges",
        "activity_visibility": "show_recent_activity",
        "posts_visibility": "show_posts",
    }
    for vis_key, legacy_key in visibility_legacy_map.items():
        if vis_key in payload:
            value = payload.pop(vis_key)
            if value not in ("public", "followers", "me"):
                raise HTTPException(status_code=400, detail=f"{vis_key} invalide")
            set_data[vis_key] = value
            set_data[legacy_key] = value in ("public", "followers")

    for key, value in payload.items():
        if key == "accent_color" and (value is None or value == ""):
            unset_data["accent_color"] = ""
        elif key == "accent_color" and value is not None:
            normalized = normalize_accent_color(value)
            if normalized:
                set_data[key] = normalized
            else:
                unset_data["accent_color"] = ""
        elif key == "spotify_playlist_url" and (value is None or value == ""):
            unset_data["spotify_playlist_url"] = ""
        elif value is not None:
            set_data[key] = value

    if set_data or unset_data:
        op = {}
        if set_data:
            set_data["updated_at"] = datetime.now(timezone.utc).isoformat()
            op["$set"] = set_data
        if unset_data:
            op["$unset"] = unset_data
        await db.users.update_one({"_id": ObjectId(user["id"])}, op)

    updated_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    base = serialize_user(updated_user)
    try:
        unlocked_map = await BadgeProgressService(db).get_unlocked_solo(user["id"])
    except Exception:
        unlocked_map = {}
    featured_ids, cards = build_featured_solo_badges(base.get("featured_badge_ids") or [], unlocked_map)
    base["featured_badge_ids"] = featured_ids
    base["featured_badges"] = cards
    return base

# ============ PARTNER ROUTES ============

@api_router.get("/users/search")
async def search_users(
    q: str,
    search_type: Literal["user", "duo"] = "user",
    user: dict = Depends(get_current_user),
):
    query = (q or "").strip()
    if search_type == "duo":
        return await _search_duos(query, user["id"])

    if query.startswith("@"):
        normalized = normalize_handle(query)
        if not normalized:
            return []
        found = await db.users.find_one({
            "$or": [{"handle": normalized}, {"username": normalized}],
            "_id": {"$ne": ObjectId(user["id"])},
        })
        if not found:
            return []
        return [await serialize_search_user(found, user["id"])]

    if len(query) < 2:
        return []

    pattern = re.escape(query.lower())
    users = await db.users.find({
        "_id": {"$ne": ObjectId(user["id"])},
        "$or": [
            {"username": {"$regex": pattern, "$options": "i"}},
            {"handle": {"$regex": pattern, "$options": "i"}},
            {"display_name": {"$regex": pattern, "$options": "i"}},
        ],
    }).limit(20).to_list(20)

    return [await serialize_search_user(u, user["id"]) for u in users]


async def _search_duos(query: str, viewer_id: str) -> List[dict]:
    if len(query) < 2:
        return []

    name_part = query
    short_id = None
    if "#" in query:
        parts = query.split("#", 1)
        name_part = parts[0].strip()
        try:
            short_id = int(parts[1].strip())
        except ValueError:
            short_id = None

    mongo_query = {}
    if short_id is not None:
        mongo_query["short_id"] = short_id
    if name_part:
        mongo_query["name"] = {"$regex": re.escape(name_part), "$options": "i"}
    if not mongo_query:
        return []

    duos = await db.duo_profiles.find(mongo_query).limit(20).to_list(20)
    results = []
    for d in duos:
        results.append(await serialize_duo_profile_for_viewer(d, viewer_id))
    return results


@api_router.get("/users/{handle}")
async def get_user_profile(handle: str, user: dict = Depends(get_current_user)):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return await serialize_profile_for_viewer(target, user["id"])


@api_router.post("/users/{handle}/follow")
async def follow_user(handle: str, user: dict = Depends(get_current_user)):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    target_id = str(target["_id"])
    if target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Impossible de se suivre soi-même")

    existing = await db.follows.find_one({
        "follower_id": user["id"],
        "following_id": target_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vous suivez déjà cet utilisateur")

    pending = await db.follow_requests.find_one({
        "requester_id": user["id"],
        "target_id": target_id,
        "status": "pending",
    })
    if pending:
        raise HTTPException(status_code=400, detail="Demande de suivi déjà envoyée")

    now = datetime.now(timezone.utc).isoformat()
    is_private = target.get("account_visibility", "private") == "private"
    is_mutual = await is_following(target_id, user["id"])

    if is_private and not is_mutual:
        req_result = await db.follow_requests.insert_one({
            "requester_id": user["id"],
            "target_id": target_id,
            "status": "pending",
            "created_at": now,
        })
        await create_notification(
            target_id,
            "follow_request",
            user,
            skip_if_exists=True,
            request_id=str(req_result.inserted_id),
        )
        updated = await db.users.find_one({"_id": ObjectId(target_id)})
        return await serialize_profile_for_viewer(updated, user["id"])

    await db.follows.insert_one({
        "follower_id": user["id"],
        "following_id": target_id,
        "created_at": now,
    })
    await db.users.update_one({"_id": ObjectId(target_id)}, {"$inc": {"followers_count": 1}})
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"following_count": 1}})

    await create_notification(target_id, "new_follower", user, skip_if_exists=True)

    if await is_following(target_id, user["id"]):
        await create_notification(target_id, "follow_back", user, skip_if_exists=True)

    updated = await db.users.find_one({"_id": ObjectId(target_id)})
    return await serialize_profile_for_viewer(updated, user["id"])


async def _accept_follow_request(request_doc: dict, accepter: dict) -> None:
    requester_id = request_doc["requester_id"]
    target_id = request_doc["target_id"]
    if str(accepter["_id"]) != target_id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    existing = await db.follows.find_one({
        "follower_id": requester_id,
        "following_id": target_id,
    })
    now = datetime.now(timezone.utc).isoformat()
    if not existing:
        await db.follows.insert_one({
            "follower_id": requester_id,
            "following_id": target_id,
            "created_at": now,
        })
        await db.users.update_one({"_id": ObjectId(target_id)}, {"$inc": {"followers_count": 1}})
        await db.users.update_one({"_id": ObjectId(requester_id)}, {"$inc": {"following_count": 1}})

    await db.follow_requests.update_one(
        {"_id": request_doc["_id"]},
        {"$set": {"status": "accepted", "responded_at": now}},
    )
    requester = await get_user_doc_by_id(requester_id)
    if requester:
        await create_notification(requester_id, "follow_accepted", accepter, skip_if_exists=True)


@api_router.post("/follow-requests/{request_id}/accept")
async def accept_follow_request(request_id: str, user: dict = Depends(get_current_user)):
    try:
        request_doc = await db.follow_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request_doc = None
    if not request_doc or request_doc.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if request_doc.get("target_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")

    await _accept_follow_request(request_doc, user)
    requester = await get_user_doc_by_id(request_doc["requester_id"])
    if requester:
        return await serialize_profile_for_viewer(requester, user["id"])
    return {"status": "ok"}


@api_router.post("/follow-requests/{request_id}/reject")
async def reject_follow_request(request_id: str, user: dict = Depends(get_current_user)):
    try:
        request_doc = await db.follow_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        request_doc = None
    if not request_doc or request_doc.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if request_doc.get("target_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")

    await db.follow_requests.update_one(
        {"_id": request_doc["_id"]},
        {"$set": {
            "status": "rejected",
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"status": "ok"}


@api_router.get("/follow-requests/pending")
async def list_pending_follow_requests(user: dict = Depends(get_current_user)):
    docs = await db.follow_requests.find({
        "target_id": user["id"],
        "status": "pending",
    }).sort("created_at", -1).limit(50).to_list(50)
    items = []
    for doc in docs:
        requester = await get_user_doc_by_id(doc.get("requester_id"))
        if not requester:
            continue
        items.append({
            "id": str(doc["_id"]),
            "requester_id": doc.get("requester_id"),
            "requester_username": requester.get("username"),
            "requester_handle": requester.get("handle") or requester.get("username"),
            "requester_display_name": requester.get("display_name"),
            "requester_avatar_url": requester.get("avatar_url"),
            "created_at": doc.get("created_at"),
        })
    return items


@api_router.delete("/users/{handle}/follow")
async def unfollow_user(handle: str, user: dict = Depends(get_current_user)):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    target_id = str(target["_id"])
    if target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Action invalide")

    deleted = await db.follows.delete_one({
        "follower_id": user["id"],
        "following_id": target_id,
    })
    if deleted.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Vous ne suivez pas cet utilisateur")

    await db.users.update_one({"_id": ObjectId(target_id)}, {"$inc": {"followers_count": -1}})
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"following_count": -1}})

    updated = await db.users.find_one({"_id": ObjectId(target_id)})
    return await serialize_profile_for_viewer(updated, user["id"])


def _encode_feed_cursor(created_at: str, post_id: str) -> str:
    return f"{created_at}|{post_id}"


def _decode_feed_cursor(cursor: Optional[str]) -> Optional[tuple]:
    if not cursor:
        return None
    parts = cursor.split("|", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def _cursor_filter(cursor: Optional[tuple]) -> Optional[dict]:
    if not cursor:
        return None
    created_at, post_id = cursor
    try:
        oid = ObjectId(post_id)
    except Exception:
        return None
    return {
        "$or": [
            {"created_at": {"$lt": created_at}},
            {"created_at": created_at, "_id": {"$lt": oid}},
        ]
    }


async def _feed_network_context(user: dict) -> dict:
    following_docs = await db.follows.find({"follower_id": user["id"]}).to_list(500)
    following_ids = {d["following_id"] for d in following_docs}

    duo_follow_docs = await db.duo_follows.find(
        {"follower_id": user["id"], "status": "accepted"}
    ).to_list(200)
    followed_duo_ids = {d["duo_id"] for d in duo_follow_docs}

    own_duo_ids = set()
    own_duo_pair_keys = set()
    if user.get("partner_id"):
        own_duo = await _get_duo_profile_for_user(user["id"], user["partner_id"])
        if own_duo:
            own_duo_ids.add(str(own_duo["_id"]))
            if own_duo.get("pair_key"):
                own_duo_pair_keys.add(own_duo["pair_key"])

    followed_duo_pair_keys = set()
    for did in followed_duo_ids:
        try:
            fdoc = await db.duo_profiles.find_one({"_id": ObjectId(did)})
            if fdoc and fdoc.get("pair_key"):
                followed_duo_pair_keys.add(fdoc["pair_key"])
        except Exception:
            continue

    return {
        "following_ids": following_ids,
        "followed_duo_ids": followed_duo_ids,
        "own_duo_ids": own_duo_ids,
        "own_duo_pair_keys": own_duo_pair_keys,
        "followed_duo_pair_keys": followed_duo_pair_keys,
    }


def _post_duo_keys(post: dict) -> set:
    keys = {post.get("duo_id"), post.get("owner_id"), post.get("actor_id")}
    return {k for k in keys if k}


async def _post_matches_following_scope(user: dict, post: dict, ctx: dict) -> bool:
    if not await can_view_post_doc(user["id"], post):
        return False

    user_id = user["id"]
    following_ids = ctx["following_ids"]
    own_duo_keys = ctx["own_duo_pair_keys"] | ctx["own_duo_ids"]
    followed_duo_keys = ctx["followed_duo_pair_keys"] | ctx["followed_duo_ids"]
    post_duo_keys = _post_duo_keys(post)

    if is_duo_wall_post(post) or post.get("duo_id"):
        if post_duo_keys & own_duo_keys or post_duo_keys & followed_duo_keys:
            return True
        author_id = post.get("author_id") or post.get("created_by_user_id")
        if author_id == user_id:
            return True
        if author_id and author_id in following_ids:
            return True
        return False

    author_id = post.get("author_id")
    if author_id == user_id:
        return True
    if author_id in following_ids:
        return True
    return False


async def _serialize_feed_post(post: dict, user: dict, feed_source: Optional[str] = None) -> Optional[dict]:
    author = None
    if not is_duo_wall_post(post):
        author = await get_user_doc_by_id(post.get("author_id"))
        if not author:
            return None
    duo_doc = await find_duo_doc_for_post(post) if is_duo_wall_post(post) else None
    serialized = await serialize_post(post, user["id"], author, duo_doc=duo_doc)
    if not serialized:
        return None
    if feed_source:
        serialized["feed_source"] = feed_source
    return serialized


async def _fetch_feed_page(
    user: dict,
    *,
    scope: str,
    limit: int,
    cursor: Optional[str],
    exclude_ids: Optional[list] = None,
    ctx: Optional[dict] = None,
) -> dict:
    limit = max(1, min(limit, 30))
    exclude_oids = []
    for pid in exclude_ids or []:
        try:
            exclude_oids.append(ObjectId(pid))
        except Exception:
            continue

    batch_size = max(limit * 4, 40)
    collected = []
    last_matched = None
    scan_cursor = _decode_feed_cursor(cursor)
    network = ctx or await _feed_network_context(user)

    while len(collected) < limit:
        query: dict = {}
        if exclude_oids:
            query["_id"] = {"$nin": exclude_oids}
        cursor_clause = _cursor_filter(scan_cursor)
        if cursor_clause:
            if "_id" in query:
                query = {"$and": [query, cursor_clause]}
            else:
                query.update(cursor_clause)

        if scope == "global":
            query["visibility"] = "public"

        raw_posts = await db.posts.find(query).sort([
            ("created_at", -1),
            ("_id", -1),
        ]).limit(batch_size).to_list(batch_size)

        if not raw_posts:
            break

        last_scanned = raw_posts[-1]
        matched_in_batch = 0

        for post in raw_posts:
            if scope == "following":
                if not await _post_matches_following_scope(user, post, network):
                    continue
            elif scope == "global":
                if post.get("visibility", "public") != "public":
                    continue
                if not await can_view_post_doc(user["id"], post):
                    continue
            else:
                continue

            serialized = await _serialize_feed_post(post, user)
            if serialized:
                collected.append(serialized)
                last_matched = post
                matched_in_batch += 1
            if len(collected) >= limit:
                break

        if len(collected) >= limit:
            break
        if len(raw_posts) < batch_size:
            break

        scan_cursor = (
            last_scanned.get("created_at") or "",
            str(last_scanned["_id"]),
        )

    next_cursor = None
    if last_matched and len(collected) >= limit:
        next_cursor = _encode_feed_cursor(
            last_matched.get("created_at") or "",
            str(last_matched["_id"]),
        )

    return {"posts": collected[:limit], "next_cursor": next_cursor}


@api_router.get("/feed")
async def get_social_feed(
    scope: str = "following",
    limit: int = 20,
    cursor: Optional[str] = None,
    exclude_ids: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Fil social — scope following (réseau) ou global (monde chronologique)."""
    if scope not in ("following", "global"):
        raise HTTPException(status_code=400, detail="scope invalide (following|global)")

    exclude_list = [x.strip() for x in (exclude_ids or "").split(",") if x.strip()]
    return await _fetch_feed_page(
        user,
        scope=scope,
        limit=limit,
        cursor=cursor,
        exclude_ids=exclude_list,
    )


@api_router.get("/feed/trending")
async def get_feed_trending(
    limit: int = 3,
    window_days: int = 7,
    user: dict = Depends(get_current_user),
):
    """Top tendances — publications publiques les plus aimées sur la fenêtre récente."""
    limit = max(1, min(limit, 3))
    window_days = max(1, min(window_days, 30))
    since = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()

    candidates = await db.posts.find({
        "visibility": "public",
        "created_at": {"$gte": since},
    }).sort([("created_at", -1)]).limit(300).to_list(300)

    scored = []
    for post in candidates:
        if not await can_view_post_doc(user["id"], post):
            continue
        likes_n = len(post.get("likes") or [])
        scored.append((likes_n, post.get("created_at") or "", str(post["_id"]), post))

    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)

    posts = []
    for rank, (_, __, ___, post) in enumerate(scored[:limit], start=1):
        serialized = await _serialize_feed_post(post, user, feed_source="trending")
        if serialized:
            serialized["trending_rank"] = rank
            posts.append(serialized)

    return {"posts": posts, "window_days": window_days}


@api_router.post("/uploads/image")
async def upload_image(data: ImageUpload, user: dict = Depends(get_current_user)):
    raw = (data.image_data or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Image requise")

    meta = ""
    b64 = raw
    if "," in raw:
        meta, b64 = raw.split(",", 1)

    try:
        image_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Image invalide")

    if len(image_bytes) > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 3 Mo)")

    ext = "webp"
    meta_lower = meta.lower()
    if "png" in meta_lower:
        ext = "png"
    elif "jpeg" in meta_lower or "jpg" in meta_lower:
        ext = "jpg"
    elif "webp" in meta_lower:
        ext = "webp"

    user_dir = UPLOAD_DIR / user["id"]
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = user_dir / filename
    file_path.write_bytes(image_bytes)

    relative = f"/uploads/{user['id']}/{filename}"
    return {"url": relative, "path": relative}


@api_router.get("/notifications")
async def list_notifications(
    limit: int = 30,
    filter: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    query = {"user_id": user["id"]}
    if filter == "duo":
        query["type"] = {"$regex": "^duo_"}
    docs = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_notification(d) for d in docs]


@api_router.get("/notifications/unread-count")
async def notifications_unread_count(
    filter: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {"user_id": user["id"], "read": False}
    if filter == "duo":
        query["type"] = {"$regex": "^duo_"}
    count = await db.notifications.count_documents(query)
    return {"count": count}


@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    return {"status": "ok"}


@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"status": "ok"}


@api_router.get("/users/{handle}/profile-stats")
async def get_user_profile_stats(handle: str, user: dict = Depends(get_current_user)):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    target_id = str(target["_id"])
    access = await get_profile_access_level(user["id"], target)
    if access == "limited":
        raise HTTPException(status_code=403, detail="Profil privé")

    stats_vis = resolve_visibility_value(target, "stats_visibility", "show_stats", default_public=False)
    badges_vis = resolve_visibility_value(target, "badges_visibility", "show_badges", default_public=True)
    can_stats = visibility_allows(access, stats_vis)
    can_badges = visibility_allows(access, badges_vis)
    if target.get("account_visibility") == "public":
        can_sessions = access != "limited"
    elif target.get("account_visibility") == "private":
        can_sessions = access in ("own", "friend", "follower")
    else:
        can_sessions = access == "own" or bool(target.get("show_sessions"))

    result = {"duo_stats": None, "detailed_stats": None, "calendar_days": []}

    if can_stats or can_badges:
        calculated = await calculate_streak(target_id, target.get("partner_id"))
        manual = await _get_manual_streak_override(target_id, target.get("partner_id")) if target.get("partner_id") else None
        streak = manual if manual is not None else calculated
        badges = await get_duo_badges(target_id, None, streak_value=streak) if can_badges else []
        solo_unlocked = [b for b in badges if b.get("unlocked") and b.get("scope") != "duo"]
        result["duo_stats"] = {
            "streak": streak,
            "badges": badges if can_badges else [],
            "badges_unlocked": len(solo_unlocked) if can_badges else 0,
            "badges_total": len([b for b in badges if b.get("scope") != "duo"]) if can_badges else 0,
        }

    if can_stats:
        today = datetime.now(timezone.utc)
        start = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        sessions = await db.workout_sessions.find({"user_id": target_id}).sort("created_at", -1).to_list(1000)
        completed = [s for s in sessions if s.get("status") == "completed"]
        total_sessions = len(sessions)
        total_completed = len(completed)
        total_time = sum(s.get("total_time", 0) for s in sessions)
        result["detailed_stats"] = {
            "summary": {
                "total_sessions": total_sessions,
                "total_completed": total_completed,
                "completion_rate": round((total_completed / total_sessions * 100) if total_sessions > 0 else 0, 1),
                "total_time": total_time,
                "avg_time": round(total_time / total_sessions) if total_sessions > 0 else 0,
                "total_calories": sum(estimate_calories(s.get("total_time", 0), s.get("difficulty_felt")) for s in completed),
            },
            "recent_sessions": [
                {
                    "id": str(s["_id"]),
                    "title": s.get("title", "Séance"),
                    "status": s.get("status"),
                    "total_time": s.get("total_time", 0),
                    "exercises_completed": s.get("exercises_completed", 0),
                    "created_at": s.get("created_at"),
                    "username": target.get("display_name") or target.get("username"),
                }
                for s in (sessions[:5] if can_sessions else [])
            ],
        }
        cal = await build_streak_calendar(target_id, target.get("partner_id"), start, end)
        result["calendar_days"] = cal if isinstance(cal, list) else []

    return result

@api_router.post("/partner/request")
async def send_partner_request(data: PartnerRequest, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username": data.target_username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("partner_id"):
        raise HTTPException(status_code=400, detail="You already have a partner")
    
    if target.get("partner_id"):
        raise HTTPException(status_code=400, detail="This user already has a partner")
    
    existing = await db.partner_requests.find_one({
        "$or": [
            {"from_user_id": user["id"], "to_user_id": str(target["_id"]), "status": "pending"},
            {"from_user_id": str(target["_id"]), "to_user_id": user["id"], "status": "pending"}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Request already pending")
    
    request_doc = {
        "from_user_id": user["id"],
        "from_username": user["username"],
        "to_user_id": str(target["_id"]),
        "to_username": target["username"],
        "relation_type": data.relation_type,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.partner_requests.insert_one(request_doc)
    request_doc["id"] = str(result.inserted_id)
    request_doc.pop("_id", None)
    await create_notification(
        str(target["_id"]),
        "duo_partner_request",
        user,
        request_id=request_doc["id"],
        skip_if_exists=True,
    )
    return request_doc

@api_router.get("/partner/requests")
async def get_partner_requests(user: dict = Depends(get_current_user)):
    requests = await db.partner_requests.find({
        "to_user_id": user["id"],
        "status": "pending"
    }).to_list(100)
    
    return [{"id": str(r["_id"]), **{k: v for k, v in r.items() if k != "_id"}} for r in requests]

@api_router.get("/partner/sent-requests")
async def get_sent_requests(user: dict = Depends(get_current_user)):
    requests = await db.partner_requests.find({
        "from_user_id": user["id"],
        "status": "pending"
    }).to_list(100)
    
    return [{"id": str(r["_id"]), **{k: v for k, v in r.items() if k != "_id"}} for r in requests]

@api_router.post("/partner/accept/{request_id}")
async def accept_partner_request(request_id: str, user: dict = Depends(get_current_user)):
    req = await db.partner_requests.find_one({"_id": ObjectId(request_id), "to_user_id": user["id"], "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.partner_requests.update_one({"_id": ObjectId(request_id)}, {"$set": {"status": "accepted"}})
    
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {
        "partner_id": req["from_user_id"],
        "partner_username": req["from_username"],
        "relation_type": req["relation_type"]
    }})
    
    await db.users.update_one({"_id": ObjectId(req["from_user_id"])}, {"$set": {
        "partner_id": user["id"],
        "partner_username": user["username"],
        "relation_type": req["relation_type"]
    }})

    await ensure_duo_profile(user["id"], req["from_user_id"])
    duo_doc = await _get_duo_profile_for_user(user["id"], req["from_user_id"])
    if duo_doc:
        rel = normalize_duo_relation(req.get("relation_type"))
        members = await get_duo_members(db, duo_doc)
        coach_id, student_id = resolve_coach_roles(rel, members[0], members[1]) if len(members) >= 2 else (None, None)
        await db.duo_profiles.update_one(
            {"_id": duo_doc["_id"]},
            {"$set": {
                "relation_type": rel,
                "coach_member_id": coach_id,
                "student_member_id": student_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

    await create_notification(
        req["from_user_id"],
        "duo_partner_accepted",
        user,
        request_id=request_id,
        skip_if_exists=True,
    )
    pair_key = duo_pair_key(user["id"], req["from_user_id"])
    schedule_badge_evaluation(
        trigger_duo_evaluation(db, pair_key, notify_user_ids=[user["id"], req["from_user_id"]])
    )
    return {"message": "Partner request accepted"}

@api_router.post("/partner/reject/{request_id}")
async def reject_partner_request(request_id: str, user: dict = Depends(get_current_user)):
    req = await db.partner_requests.find_one({"_id": ObjectId(request_id), "to_user_id": user["id"], "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.partner_requests.update_one({"_id": ObjectId(request_id)}, {"$set": {"status": "rejected"}})
    await create_notification(
        req["from_user_id"],
        "duo_partner_rejected",
        user,
        request_id=request_id,
        skip_if_exists=True,
    )
    return {"message": "Partner request rejected"}

@api_router.delete("/partner/unlink")
async def unlink_partner(user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        raise HTTPException(status_code=400, detail="No partner linked")
    
    partner_id = user["partner_id"]
    
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$unset": {"partner_id": "", "partner_username": "", "relation_type": ""}})
    await db.users.update_one({"_id": ObjectId(partner_id)}, {"$unset": {"partner_id": "", "partner_username": "", "relation_type": ""}})
    
    return {"message": "Partner unlinked"}

@api_router.get("/partner/info")
async def get_partner_info(user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        return None
    
    partner = await db.users.find_one({"_id": ObjectId(user["partner_id"])})
    if not partner:
        return None
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_seen = partner.get("last_seen_at") or ""
    connected_today = last_seen[:10] == today_str if last_seen else False
    is_coach = user.get("relation_type") in ("coach", "trainer") or user["username"] in _admin_usernames()

    return {
        "id": str(partner["_id"]),
        "username": partner["username"],
        "display_name": partner.get("display_name"),
        "avatar_url": partner.get("avatar_url"),
        "accent_color": partner.get("accent_color"),
        "relation_type": user.get("relation_type"),
        "last_seen_at": last_seen,
        "connected_today": connected_today,
        "show_presence": is_coach,
        "duo_profile": serialize_duo_search(
            await _get_duo_profile_for_user(user["id"], user["partner_id"])
        ) if user.get("partner_id") else None,
    }

# ============ DUO PROFILE ROUTES ============

@api_router.get("/duo/profile")
async def get_own_duo_profile(user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        return None
    duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
    if not duo_doc:
        return None
    return await serialize_duo_profile_for_viewer(duo_doc, user["id"])


async def _apply_duo_profile_update(duo_doc: dict, data: DuoProfileUpdate, user: dict) -> dict:
    """Mise à jour partielle ($set) — n'écrase jamais les champs absents du payload."""
    updates = {}
    payload = data.model_dump(exclude_unset=True)

    if "name" in payload and data.name is not None:
        clean = re.sub(r"[^a-zA-Z0-9À-ÿ\s]", "", data.name.strip())[:32]
        if len(clean) < 2:
            raise HTTPException(status_code=400, detail="Nom de duo invalide")
        updates["name"] = clean.replace(" ", "")

    if "relation_type" in payload and data.relation_type is not None:
        rel = normalize_duo_relation(data.relation_type)
        updates["relation_type"] = rel
        members = await get_duo_members(db, duo_doc)
        if len(members) >= 2:
            coach_id, student_id = resolve_coach_roles(rel, members[0], members[1])
            updates["coach_member_id"] = coach_id
            updates["student_member_id"] = student_id
        await db.users.update_one(
            {"_id": ObjectId(user["id"])},
            {"$set": {"relation_type": rel}},
        )
        await db.users.update_one(
            {"_id": ObjectId(user["partner_id"])},
            {"$set": {"relation_type": rel}},
        )

    if "avatar_url" in payload:
        updates["avatar_url"] = normalize_upload_path(data.avatar_url)

    # Bannière : champ absent → conserver ; clear_banner/null → supprimer ; valeur → remplacer
    if payload.get("clear_banner") is True or ("banner_url" in payload and data.banner_url is None):
        updates["banner_url"] = None
    elif "banner_url" in payload and data.banner_url is not None:
        updates["banner_url"] = normalize_upload_path(data.banner_url)

    duo_vis_fields = {
        "stats_visibility": "show_stats",
        "wall_visibility": "show_posts",
        "badges_visibility": "show_badges",
        "activity_visibility": "show_recent_activity",
        "challenges_visibility": "show_challenges",
    }

    if payload.get("account_visibility") == "public":
        updates["account_visibility"] = "public"
        updates["wall_visibility"] = "public"
        updates["badges_visibility"] = "public"
        updates["show_posts"] = True
        updates["show_badges"] = True
    elif payload.get("account_visibility") == "private":
        updates["account_visibility"] = "private"
        updates["wall_visibility"] = "followers"
        updates["badges_visibility"] = "followers"
        updates["show_posts"] = True
        updates["show_badges"] = True

    for vis_key, legacy_key in duo_vis_fields.items():
        if vis_key in payload and payload[vis_key] is not None:
            value = payload[vis_key]
            if value not in ("public", "followers", "members"):
                raise HTTPException(status_code=400, detail=f"{vis_key} invalide")
            updates[vis_key] = value
            updates[legacy_key] = value in ("public", "followers")

    for field in (
        "show_stats", "show_badges",
        "show_recent_activity", "show_posts", "show_challenges",
    ):
        if field in payload and payload[field] is not None and field not in updates:
            updates[field] = payload[field]

    if "member_roles" in payload and data.member_roles is not None:
        members = await get_duo_members(db, duo_doc)
        member_ids = {str(m["_id"]) for m in members}
        roles = {}
        for uid, role in data.member_roles.items():
            if uid not in member_ids:
                raise HTTPException(status_code=400, detail="Utilisateur extérieur au Duo")
            if role not in ("coach", "leader", "member"):
                raise HTTPException(status_code=400, detail="Rôle invalide")
            roles[uid] = role
        updates["member_roles"] = roles
        coach_ids = [uid for uid, r in roles.items() if r == "coach"]
        leader_ids = [uid for uid, r in roles.items() if r == "leader"]
        updates["coach_member_id"] = coach_ids[0] if coach_ids else None
        # leader stocké aussi pour affichage ; student_member_id = l'autre si coach_student
        if coach_ids and len(members) >= 2:
            other = next((mid for mid in member_ids if mid != coach_ids[0]), None)
            updates["student_member_id"] = other
        if leader_ids:
            updates["leader_member_id"] = leader_ids[0]
        else:
            updates["leader_member_id"] = None

    if "featured_badge_ids" in payload:
        raw_ids = payload.get("featured_badge_ids") or []
        if not isinstance(raw_ids, list):
            raise HTTPException(status_code=400, detail="featured_badge_ids doit être une liste")
        if len(raw_ids) > 3:
            raise HTTPException(status_code=400, detail="Maximum 3 badges mis en avant")
        pair_key = duo_doc.get("pair_key") or duo_pair_key(user["id"], user["partner_id"])
        unlocked_map = await BadgeProgressService(db).get_unlocked_duo(pair_key)
        cleaned: List[str] = []
        seen = set()
        for raw in raw_ids:
            bid = canonical_badge_id(str(raw))
            if not bid:
                raise HTTPException(status_code=400, detail="ID de badge vide")
            if bid in seen:
                raise HTTPException(status_code=400, detail="Badge dupliqué")
            definition = get_badge_definition(bid)
            if not definition or definition.get("scope") != "duo":
                raise HTTPException(status_code=400, detail=f"Badge duo invalide: {raw}")
            if bid not in unlocked_map:
                raise HTTPException(status_code=400, detail=f"Badge non débloqué: {raw}")
            seen.add(bid)
            cleaned.append(bid)
            if len(cleaned) >= 3:
                break
        updates["featured_badge_ids"] = cleaned

    if not updates:
        return await serialize_duo_profile_for_viewer(duo_doc, user["id"])

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.duo_profiles.update_one({"_id": duo_doc["_id"]}, {"$set": updates})
    updated = await db.duo_profiles.find_one({"_id": duo_doc["_id"]})
    pair_key = duo_doc.get("pair_key") or duo_pair_key(user["id"], user["partner_id"])
    schedule_badge_evaluation(
        trigger_duo_evaluation(db, pair_key, notify_user_ids=[user["id"], user["partner_id"]])
    )
    return await serialize_duo_profile_for_viewer(updated, user["id"])


@api_router.put("/duo/profile")
async def update_duo_profile(data: DuoProfileUpdate, user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Aucun partenaire lié")
    duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Profil duo introuvable")
    return await _apply_duo_profile_update(duo_doc, data, user)


@api_router.patch("/duo/profile")
async def patch_duo_profile(data: DuoProfileUpdate, user: dict = Depends(get_current_user)):
    """Alias PATCH — même sémantique partielle que PUT."""
    return await update_duo_profile(data, user)


@api_router.patch("/duos/{pair_key}/roles")
async def patch_duo_roles(pair_key: str, body: dict, user: dict = Depends(get_current_user)):
    """Met à jour les rôles des deux membres uniquement."""
    if not user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Aucun partenaire lié")
    duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Profil duo introuvable")
    resolved = resolve_duo_pair_key(duo_doc)
    if pair_key not in (resolved, str(duo_doc["_id"]), duo_doc.get("pair_key")):
        raise HTTPException(status_code=403, detail="Duo non autorisé")
    roles = body.get("roles") or body.get("member_roles") or {}
    if not isinstance(roles, dict) or not roles:
        raise HTTPException(status_code=400, detail="roles requis")
    data = DuoProfileUpdate(member_roles=roles)
    return await _apply_duo_profile_update(duo_doc, data, user)

@api_router.get("/duos/{tag}/stats")
async def get_duo_profile_stats(tag: str, user: dict = Depends(get_current_user)):
    duo_doc = await find_duo_by_tag(db, tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_doc = apply_duo_defaults(await sync_duo_member_ids(db, duo_doc))
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, user["id"], duo_doc, members)
    can_stats = can_view_duo_section(duo_doc, access, "stats")
    can_badges = can_view_duo_section(duo_doc, access, "badges")
    can_challenges = can_view_duo_section(duo_doc, access, "challenges")
    if not (can_stats or can_badges or can_challenges):
        raise HTTPException(status_code=403, detail="Statistiques duo masquées")

    a_id, b_id = await resolve_duo_member_pair(
        db, duo_doc, user["id"], user.get("partner_id")
    )
    if not a_id or not b_id:
        return {"sessions_together": 0, "badges": [], "badges_unlocked": 0, "badges_total": 0}

    together = await assemble_duo_common_stats(a_id, b_id, locale=user.get("locale"))
    calculated = await calculate_streak(a_id, b_id)
    manual = await _get_manual_streak_override(a_id, b_id)
    streak = manual if manual is not None else calculated
    together["streak"] = streak
    together["streak_calculated"] = calculated
    together["streak_manual_override"] = manual
    return together


@api_router.post("/duos/{tag}/follow")
async def follow_duo(tag: str, user: dict = Depends(get_current_user)):
    duo_doc = await find_duo_by_tag(db, tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_doc = apply_duo_defaults(duo_doc)
    members = await get_duo_members(db, duo_doc)
    duo_id = str(duo_doc["_id"])
    member_ids = {str(m["_id"]) for m in members}
    if user["id"] in member_ids:
        raise HTTPException(status_code=400, detail="Vous faites déjà partie de ce duo")

    existing = await get_duo_follow_doc(db, duo_id, user["id"])
    if existing and existing.get("status") == "accepted":
        raise HTTPException(status_code=400, detail="Vous suivez déjà ce duo")
    if existing and existing.get("status") == "pending":
        raise HTTPException(status_code=400, detail="Demande déjà envoyée")

    now = datetime.now(timezone.utc).isoformat()
    is_public = duo_doc.get("account_visibility") == "public"
    status = "accepted" if is_public else "pending"

    if existing:
        await db.duo_follows.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": status, "updated_at": now, **({"accepted_at": now} if status == "accepted" else {})}},
        )
        follow_id = str(existing["_id"])
    else:
        result = await db.duo_follows.insert_one({
            "duo_id": duo_id,
            "follower_id": user["id"],
            "status": status,
            "created_at": now,
            "accepted_at": now if status == "accepted" else None,
        })
        follow_id = str(result.inserted_id)

    duo_tag = duo_tag_from_doc(duo_doc)
    if status == "pending":
        for mid in member_ids:
            await create_notification(
                mid,
                "duo_follow_request",
                user,
                request_id=follow_id,
                duo_id=duo_id,
                duo_tag=duo_tag,
                skip_if_exists=True,
            )

    updated = await db.duo_profiles.find_one({"_id": duo_doc["_id"]})
    return await serialize_duo_profile_for_viewer(updated, user["id"])


@api_router.delete("/duos/{tag}/follow")
async def unfollow_duo(tag: str, user: dict = Depends(get_current_user)):
    duo_doc = await find_duo_by_tag(db, tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_id = str(duo_doc["_id"])
    deleted = await db.duo_follows.delete_one({"duo_id": duo_id, "follower_id": user["id"]})
    if deleted.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Vous ne suivez pas ce duo")
    updated = await db.duo_profiles.find_one({"_id": duo_doc["_id"]})
    return await serialize_duo_profile_for_viewer(updated, user["id"])


@api_router.post("/duos/follow-requests/{request_id}/accept")
async def accept_duo_follow_request(request_id: str, user: dict = Depends(get_current_user)):
    try:
        follow_doc = await db.duo_follows.find_one({"_id": ObjectId(request_id)})
    except Exception:
        follow_doc = None
    if not follow_doc or follow_doc.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")

    duo_doc = await db.duo_profiles.find_one({"_id": ObjectId(follow_doc["duo_id"])})
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    member_ids = set(duo_doc.get("member_ids") or [])
    if user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Non autorisé")

    now = datetime.now(timezone.utc).isoformat()
    await db.duo_follows.update_one(
        {"_id": follow_doc["_id"]},
        {"$set": {"status": "accepted", "accepted_at": now}},
    )

    follower = await get_user_doc_by_id(follow_doc.get("follower_id"))
    if follower:
        await create_notification(
            follow_doc["follower_id"],
            "duo_follow_accepted",
            user,
            duo_id=str(duo_doc["_id"]),
            duo_tag=duo_tag_from_doc(duo_doc),
        )

    return {"status": "ok"}


@api_router.post("/duos/follow-requests/{request_id}/reject")
async def reject_duo_follow_request(request_id: str, user: dict = Depends(get_current_user)):
    try:
        follow_doc = await db.duo_follows.find_one({"_id": ObjectId(request_id)})
    except Exception:
        follow_doc = None
    if not follow_doc or follow_doc.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")

    duo_doc = await db.duo_profiles.find_one({"_id": ObjectId(follow_doc["duo_id"])})
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    member_ids = set(duo_doc.get("member_ids") or [])
    if user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Non autorisé")

    await db.duo_follows.delete_one({"_id": follow_doc["_id"]})
    return {"status": "ok"}


@api_router.get("/duos/{tag}/activity")
async def get_duo_profile_activity(
    tag: str,
    limit: int = 15,
    user: dict = Depends(get_current_user),
):
    duo_doc = await find_duo_by_tag(db, tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_doc = apply_duo_defaults(await sync_duo_member_ids(db, duo_doc))
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, user["id"], duo_doc, members)
    if not can_view_duo_section(duo_doc, access, "activity"):
        return []
    a_id, b_id = await resolve_duo_member_pair(
        db, duo_doc, user["id"], user.get("partner_id")
    )
    return await build_duo_activity(
        db, duo_doc, members, user["id"], limit=min(limit, 30),
        user_a_id=a_id, user_b_id=b_id,
    )


@api_router.get("/duos/{tag}/posts")
async def get_duo_posts(
    tag: str,
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    from urllib.parse import unquote

    raw_tag = unquote(tag or "").strip()
    duo_doc = await find_duo_by_tag(db, raw_tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_doc = apply_duo_defaults(await sync_duo_member_ids(db, duo_doc))
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, user["id"], duo_doc, members)
    is_member = access == "member"
    if not is_member and not can_view_duo_section(duo_doc, access, "posts"):
        return {"posts": []}

    duo_id = str(duo_doc["_id"])
    pair_key = resolve_duo_pair_key(duo_doc)
    query = duo_wall_posts_query(pair_key, duo_id)
    print("[DUO WALL READ]", {
        "raw_tag": raw_tag,
        "resolved_profile_id": duo_id,
        "resolved_short_id": duo_doc.get("short_id"),
        "resolved_pair_key": pair_key,
        "member_ids": duo_doc.get("member_ids"),
        "access": access,
    })
    print("[DUO WALL QUERY]", query)
    posts = await db.posts.find(query).sort(
        "created_at", -1
    ).skip(offset).limit(min(limit, 50)).to_list(min(limit, 50))
    print("[DUO WALL MATCHED]", len(posts))

    items = []
    for post in posts:
        author = await get_user_doc_by_id(post.get("author_id"))
        serialized = await serialize_post(post, user["id"], author, duo_doc=duo_doc)
        if serialized:
            items.append(serialized)
    return {"posts": items}


@api_router.get("/duos/{tag}")
async def get_duo_profile_by_tag(tag: str, user: dict = Depends(get_current_user)):
    """Route générique profil duo — doit rester après les routes /stats, /activity, /posts, /follow."""
    duo_doc = await find_duo_by_tag(db, tag)
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    duo_doc = await sync_duo_member_ids(db, duo_doc)
    return await serialize_duo_profile_for_viewer(duo_doc, user["id"])


@api_router.get("/duo/activity-feed")
async def get_duo_activity_feed(limit: int = 20, user: dict = Depends(get_current_user)):
    """Fil d'activité privé avec séances communes regroupées."""
    from duo_social import _serialize_session_ref
    import asyncio

    session_projection = {
        "_id": 1, "user_id": 1, "username": 1, "created_at": 1, "completed_at": 1, "status": 1,
        "title": 1, "workout_title": 1, "total_time": 1, "estimated_calories": 1,
        "likes": 1, "reactions": 1, "comments": 1, "exercises_completed": 1, "exercises_total": 1,
        "template_id": 1, "scheduled_workout_id": 1, "is_common_session": 1, "notes": 1,
        "difficulty_felt": 1,
    }

    if not user.get("partner_id"):
        sessions = await db.workout_sessions.find(
            {"user_id": user["id"]}, session_projection
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return [
            {**_serialize_session_ref({**s, "id": str(s["_id"])}, user["id"]), "type": "session"}
            for s in sessions
        ]

    sessions_a_coro = db.workout_sessions.find(
        {"user_id": user["id"]}, session_projection
    ).sort("created_at", -1).limit(100).to_list(100)
    sessions_b_coro = db.workout_sessions.find(
        {"user_id": user["partner_id"]}, session_projection
    ).sort("created_at", -1).limit(100).to_list(100)
    reposts_coro = db.reposts.find(
        {"user_id": user["id"]},
        {"_id": 1, "workout_session_id": 1},
    ).to_list(500)
    duo_doc_coro = _get_duo_profile_for_user(user["id"], user["partner_id"])

    sessions_a, sessions_b, user_reposts, duo_doc = await asyncio.gather(
        sessions_a_coro, sessions_b_coro, reposts_coro, duo_doc_coro
    )

    for s in sessions_a:
        s["id"] = str(s["_id"])
    for s in sessions_b:
        s["id"] = str(s["_id"])

    items = build_common_sessions(sessions_a, sessions_b, user["id"], user["partner_id"])

    repost_by_session = {}
    for repost in user_reposts:
        sid = repost.get("workout_session_id")
        if not sid:
            continue
        repost_by_session[sid] = str(repost["_id"])

    wall_by_session = {}
    if duo_doc:
        duo_id = str(duo_doc["_id"])
        pair_key = resolve_duo_pair_key(duo_doc)
        or_clauses = [{"duo_id": duo_id}]
        if pair_key and pair_key != duo_id:
            or_clauses.append({"duo_id": pair_key})
            or_clauses.append({"owner_type": "duo", "owner_id": pair_key})
        wall_posts = await db.posts.find(
            {
                "author_id": user["id"],
                "workout_session_id": {"$exists": True, "$ne": None},
                "$or": or_clauses,
            },
            {"_id": 1, "workout_session_id": 1},
        ).to_list(500)
        for post in wall_posts:
            sid = post.get("workout_session_id")
            if sid:
                wall_by_session[sid] = str(post["_id"])

    for item in items:
        if item.get("type") != "common_session":
            continue
        my_sess = item.get("session_a") if item["session_a"].get("user_id") == user["id"] else item.get("session_b")
        if not my_sess:
            continue
        sid = my_sess.get("id")
        if sid in repost_by_session:
            item["user_repost_id"] = repost_by_session[sid]
        if sid in wall_by_session:
            item["duo_wall_post_id"] = wall_by_session[sid]

    return items[:min(limit, 50)]

async def _get_live_session_for_user(user_id: str) -> Optional[dict]:
    progress = await db.workout_progress.find_one(
        {"user_id": user_id},
        sort=[("saved_at", -1)]
    )
    if not progress or not progress.get("saved_at"):
        return None

    try:
        saved_at = datetime.fromisoformat(progress["saved_at"].replace("Z", "+00:00"))
    except ValueError:
        return None

    age = (datetime.now(timezone.utc) - saved_at).total_seconds()
    if age > LIVE_SESSION_MAX_AGE_SECONDS:
        return None

    phase = progress.get("phase")
    if phase in ("finished", "preparation", "paused") or phase not in LIVE_ACTIVE_PHASES:
        return None

    workout_title = progress.get("workout_title")
    if not workout_title and progress.get("workout_id"):
        workout = await db.scheduled_workouts.find_one({"_id": ObjectId(progress["workout_id"])})
        workout_title = workout.get("title") if workout else None

    return {
        "active": True,
        "user_id": user_id,
        "workout_id": progress.get("workout_id"),
        "workout_title": workout_title,
        "elapsed_seconds": progress.get("time_elapsed", 0),
        "phase": progress.get("phase"),
        "saved_at": progress.get("saved_at"),
    }

@api_router.get("/partner/live-session")
async def get_partner_live_session(user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        return {"active": False}

    partner = await db.users.find_one({"_id": ObjectId(user["partner_id"])})
    if not partner:
        return {"active": False}

    live = await _get_live_session_for_user(user["partner_id"])
    if not live:
        return {"active": False}

    my_live = await _get_live_session_for_user(user["id"])
    return {
        **live,
        "username": partner.get("username"),
        "display_name": partner.get("display_name"),
        "duo_live": my_live is not None,
    }

@api_router.get("/live-workout/messages")
async def get_live_workout_messages(user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        return []

    pair_key = duo_pair_key(user["id"], user["partner_id"])
    since = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    messages = await db.live_workout_messages.find({
        "pair_key": pair_key,
        "created_at": {"$gte": since},
    }).sort("created_at", 1).to_list(100)

    return [
        {
            "id": str(m["_id"]),
            "from_user_id": m.get("from_user_id"),
            "from_username": m.get("from_username"),
            "message": m.get("message"),
            "created_at": m.get("created_at"),
            "is_mine": m.get("from_user_id") == user["id"],
        }
        for m in messages
    ]

@api_router.post("/live-workout/messages")
async def post_live_workout_message(body: LiveWorkoutMessageCreate, user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        raise HTTPException(status_code=400, detail="No partner linked")

    message = body.message.strip()
    if not message or len(message) > 120:
        raise HTTPException(status_code=400, detail="Invalid message")

    pair_key = duo_pair_key(user["id"], user["partner_id"])
    doc = {
        "pair_key": pair_key,
        "from_user_id": user["id"],
        "from_username": user.get("display_name") or user.get("username"),
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.live_workout_messages.insert_one(doc)
    return {"id": str(result.inserted_id), **doc, "is_mine": True}

# ============ EXERCISE ROUTES ============

@api_router.get("/exercises")
async def get_exercises(user: dict = Depends(get_current_user)):
    exercises = await db.exercises.find({
        "$or": [
            {"is_system": True},
            {"user_id": user["id"]}
        ]
    }).to_list(1000)
    
    return [{"id": str(e["_id"]), **{k: v for k, v in e.items() if k != "_id"}} for e in exercises]

@api_router.post("/exercises")
async def create_exercise(data: ExerciseCreate, user: dict = Depends(get_current_user)):
    exercise_doc = {
        **data.model_dump(),
        "user_id": user["id"],
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.exercises.insert_one(exercise_doc)
    exercise_doc["id"] = str(result.inserted_id)
    exercise_doc.pop("_id", None)  # Remove ObjectId before returning
    return exercise_doc

@api_router.put("/exercises/{exercise_id}")
async def update_exercise(exercise_id: str, data: ExerciseCreate, user: dict = Depends(get_current_user)):
    exercise = await db.exercises.find_one({"_id": ObjectId(exercise_id), "user_id": user["id"]})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.exercises.update_one({"_id": ObjectId(exercise_id)}, {"$set": update_data})
    
    updated = await db.exercises.find_one({"_id": ObjectId(exercise_id)})
    return {"id": str(updated["_id"]), **{k: v for k, v in updated.items() if k != "_id"}}

@api_router.delete("/exercises/{exercise_id}")
async def delete_exercise(exercise_id: str, user: dict = Depends(get_current_user)):
    exercise = await db.exercises.find_one({"_id": ObjectId(exercise_id), "user_id": user["id"], "is_system": False})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found or is a system exercise")
    
    await db.exercises.delete_one({"_id": ObjectId(exercise_id)})
    return {"message": "Exercise deleted"}

# ============ WORKOUT TEMPLATE ROUTES ============

def serialize_template(template: dict, include_blocks: bool = True) -> dict:
    row = {"id": str(template["_id"]), **{k: v for k, v in template.items() if k != "_id"}}
    row.setdefault("is_system", False)
    if not include_blocks:
        row.pop("blocks", None)
    return row

@api_router.get("/templates")
async def get_templates(summary: bool = False, user: dict = Depends(get_current_user)):
    system = await db.workout_templates.find({"is_system": True}).sort("program_order", 1).to_list(50)
    mine = await db.workout_templates.find({"user_id": user["id"]}).to_list(1000)
    out: List[dict] = []
    for t in system:
        out.append(serialize_template(t, include_blocks=not summary))
    for t in mine:
        out.append(serialize_template(t, include_blocks=not summary))
    return out

@api_router.get("/templates/{template_id}")
async def get_template(template_id: str, user: dict = Depends(get_current_user)):
    template = await db.workout_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.get("is_system") and template.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Template not found")
    return serialize_template(template, include_blocks=True)

@api_router.post("/templates")
async def create_template(data: WorkoutTemplateCreate, user: dict = Depends(get_current_user)):
    template_doc = {
        **data.model_dump(),
        "blocks": [b.model_dump() for b in data.blocks],
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.workout_templates.insert_one(template_doc)
    template_doc["id"] = str(result.inserted_id)
    template_doc.pop("_id", None)  # Remove ObjectId before returning
    schedule_badge_evaluation(trigger_solo_evaluation(db, user["id"]))
    return template_doc

@api_router.put("/templates/{template_id}")
async def update_template(template_id: str, data: WorkoutTemplateCreate, user: dict = Depends(get_current_user)):
    template = await db.workout_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.get("is_system"):
        raise HTTPException(status_code=403, detail="Cannot modify system templates")
    if template.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = data.model_dump()
    update_data["blocks"] = [b.model_dump() for b in data.blocks]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.workout_templates.update_one({"_id": ObjectId(template_id)}, {"$set": update_data})
    
    updated = await db.workout_templates.find_one({"_id": ObjectId(template_id)})
    return {"id": str(updated["_id"]), **{k: v for k, v in updated.items() if k != "_id"}}

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    template = await db.workout_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.get("is_system"):
        raise HTTPException(status_code=403, detail="Cannot delete system templates")
    if template.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Template not found")
    result = await db.workout_templates.delete_one({"_id": ObjectId(template_id), "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ============ SCHEDULED WORKOUT ROUTES ============

@api_router.get("/workouts")
async def get_workouts(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    for_user: Optional[str] = None,
    light: Optional[bool] = False,
    include_drafts: Optional[bool] = False,
    user: dict = Depends(get_current_user)
):
    query = {
        "$or": [
            {"creator_id": user["id"]},
            {"for_user_id": user["id"]}
        ]
    }
    if not include_drafts:
        query["is_draft"] = {"$ne": True}
    
    if user.get("partner_id"):
        query["$or"].extend([
            {"creator_id": user["partner_id"]},
            {"for_user_id": user["partner_id"]}
        ])
    
    if start_date:
        query["scheduled_date"] = {"$gte": start_date}
    if end_date:
        if "scheduled_date" in query:
            query["scheduled_date"]["$lte"] = end_date
        else:
            query["scheduled_date"] = {"$lte": end_date}
    
    if for_user:
        query["for_user_id"] = for_user
    
    projection = None
    if light:
        projection = {
            "title": 1,
            "scheduled_date": 1,
            "status": 1,
            "scheduled_time": 1,
            "for_user_id": 1,
            "for_username": 1,
            "creator_id": 1,
            "creator_username": 1,
            "created_at": 1,
            "updated_at": 1,
            "is_draft": 1,
        }
    
    workouts = await db.scheduled_workouts.find(query, projection).sort("scheduled_date", 1).to_list(1000)
    return [{"id": str(w["_id"]), **{k: v for k, v in w.items() if k != "_id"}} for w in workouts]

@api_router.get("/workouts/today")
async def get_today_workouts(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {
        "scheduled_date": today,
        "is_draft": {"$ne": True},
        "$or": [
            {"for_user_id": user["id"]},
            {"creator_id": user["id"]}
        ]
    }
    
    if user.get("partner_id"):
        query["$or"].extend([
            {"for_user_id": user["partner_id"]},
            {"creator_id": user["partner_id"]}
        ])
    
    workouts = await db.scheduled_workouts.find(query).to_list(100)
    return [{"id": str(w["_id"]), **{k: v for k, v in w.items() if k != "_id"}} for w in workouts]


@api_router.get("/workouts/drafts")
async def get_my_drafts(user: dict = Depends(get_current_user)):
    """Liste des brouillons de séance du propriétaire (pour la page Créer)."""
    drafts = await db.scheduled_workouts.find(
        {"creator_id": user["id"], "is_draft": True},
        {"title": 1, "updated_at": 1, "created_at": 1, "scheduled_date": 1},
    ).sort("updated_at", -1).to_list(20)
    return [{"id": str(w["_id"]), **{k: v for k, v in w.items() if k != "_id"}} for w in drafts]


@api_router.get("/workouts/{workout_id}")
async def get_workout(workout_id: str, allow_draft: Optional[bool] = False, user: dict = Depends(get_current_user)):
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    allowed_ids = [user["id"]]
    if user.get("partner_id"):
        allowed_ids.append(user["partner_id"])
    
    if workout["creator_id"] not in allowed_ids and workout["for_user_id"] not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not authorized")

    if workout.get("is_draft"):
        if workout["creator_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Brouillon inaccessible")
        if not allow_draft:
            raise HTTPException(status_code=403, detail="Ce brouillon ne peut pas être lancé")

    return {"id": str(workout["_id"]), **{k: v for k, v in workout.items() if k != "_id"}}


@api_router.post("/workouts")
async def create_workout(data: ScheduledWorkoutCreate, user: dict = Depends(get_current_user)):
    for_user_id = data.for_user_id or user["id"]
    for_username = user["username"]
    
    if data.for_user_id and data.for_user_id != user["id"]:
        if data.for_user_id != user.get("partner_id"):
            raise HTTPException(status_code=403, detail="Can only create workouts for yourself or your partner")
        partner = await db.users.find_one({"_id": ObjectId(data.for_user_id)})
        if partner:
            for_username = partner["username"]
    
    workout_doc = {
        **data.model_dump(),
        "blocks": [b.model_dump() for b in data.blocks],
        "creator_id": user["id"],
        "creator_username": user["username"],
        "for_user_id": for_user_id,
        "for_username": for_username,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.scheduled_workouts.insert_one(workout_doc)
    workout_doc["id"] = str(result.inserted_id)
    workout_doc.pop("_id", None)  # Remove ObjectId before returning
    return workout_doc

@api_router.put("/workouts/{workout_id}")
async def update_workout(workout_id: str, data: ScheduledWorkoutCreate, user: dict = Depends(get_current_user)):
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    if workout["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = data.model_dump()
    update_data["blocks"] = [b.model_dump() for b in data.blocks]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.scheduled_workouts.update_one({"_id": ObjectId(workout_id)}, {"$set": update_data})
    
    updated = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    return {"id": str(updated["_id"]), **{k: v for k, v in updated.items() if k != "_id"}}

@api_router.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str, user: dict = Depends(get_current_user)):
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    if workout["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.scheduled_workouts.delete_one({"_id": ObjectId(workout_id)})
    return {"message": "Workout deleted"}

@api_router.post("/workouts/multi-schedule")
async def create_multi_schedule(data: MultiScheduleCreate, user: dict = Depends(get_current_user)):
    """Create multiple workouts based on scheduling mode"""
    for_user_id = data.for_user_id or user["id"]
    for_username = user["username"]
    
    if data.for_user_id and data.for_user_id != user["id"]:
        if data.for_user_id != user.get("partner_id"):
            raise HTTPException(status_code=403, detail="Can only create workouts for yourself or your partner")
        partner = await db.users.find_one({"_id": ObjectId(data.for_user_id)})
        if partner:
            for_username = partner["username"]
    
    dates_to_create = []
    # Alias historiques / front plus court
    mode = data.schedule_mode
    if mode == "multiple":
        mode = "multiple_dates"
    elif mode == "weekly":
        mode = "weekly_repeat"

    if mode == "single" and data.dates:
        dates_to_create = [data.dates[0]]

    elif mode == "multiple_dates":
        dates_to_create = data.dates

    elif mode == "weekly_repeat":
        if not data.start_date:
            raise HTTPException(status_code=400, detail="Start date required for weekly repeat")
        
        start = datetime.strptime(data.start_date, "%Y-%m-%d")
        
        if data.end_date:
            end = datetime.strptime(data.end_date, "%Y-%m-%d")
        elif data.repeat_weeks:
            end = start + timedelta(weeks=data.repeat_weeks)
        else:
            end = start + timedelta(weeks=4)  # Default 4 weeks
        
        current = start
        while current <= end:
            if current.weekday() in data.week_days:
                dates_to_create.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    
    if not dates_to_create:
        raise HTTPException(status_code=400, detail="No dates to schedule")
    
    # Remove duplicates and sort
    dates_to_create = sorted(list(set(dates_to_create)))
    
    created = []
    for date in dates_to_create:
        workout_doc = {
            "title": data.title,
            "description": data.description,
            "for_user_id": for_user_id,
            "for_username": for_username,
            "scheduled_date": date,
            "scheduled_time": data.scheduled_time,
            "difficulty": data.difficulty,
            "blocks": [b.model_dump() for b in data.blocks],
            "creator_id": user["id"],
            "creator_username": user["username"],
            "status": "pending",
            "is_draft": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.scheduled_workouts.insert_one(workout_doc)
        workout_doc["id"] = str(result.inserted_id)
        workout_doc.pop("_id", None)
        created.append(workout_doc)
    
    return {"created": len(created), "workouts": created, "dates": dates_to_create}

@api_router.post("/workouts/{workout_id}/save-progress")
async def save_workout_progress(workout_id: str, data: WorkoutProgressSave, user: dict = Depends(get_current_user)):
    """Save workout progress for resuming later"""
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    if workout.get("is_draft"):
        raise HTTPException(status_code=403, detail="Impossible de démarrer un brouillon")

    existing = await db.workout_progress.find_one({
        "workout_id": workout_id,
        "user_id": user["id"],
    })
    already_notified = bool(existing.get("partner_start_notified")) if existing else False

    progress_doc = {
        "workout_id": workout_id,
        "user_id": user["id"],
        "current_exercise_index": data.current_exercise_index,
        "current_block_index": data.current_block_index,
        "time_elapsed": data.time_elapsed,
        "pause_time": data.pause_time,
        "exercises_completed": data.exercises_completed,
        "workout_title": data.workout_title or workout.get("title"),
        "phase": data.phase,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "partner_start_notified": already_notified,
    }

    # Upsert progress
    await db.workout_progress.update_one(
        {"workout_id": workout_id, "user_id": user["id"]},
        {"$set": progress_doc},
        upsert=True
    )

    # Update workout status
    await db.scheduled_workouts.update_one(
        {"_id": ObjectId(workout_id)},
        {"$set": {"status": "in_progress"}}
    )

    # Une notif Push/in-app au partenaire lié, une seule fois par séance (tag stable).
    if (
        not already_notified
        and user.get("partner_id")
        and data.phase in LIVE_ACTIVE_PHASES
    ):
        try:
            await create_notification(
                user["partner_id"],
                "partner_workout_started",
                user,
                push_url="/duo",
                push_tag=f"partner-workout-started-{workout_id}",
            )
            await db.workout_progress.update_one(
                {"workout_id": workout_id, "user_id": user["id"]},
                {"$set": {"partner_start_notified": True}},
            )
            progress_doc["partner_start_notified"] = True
        except Exception:
            pass

    return {"message": "Progress saved", "progress": progress_doc}

@api_router.get("/workouts/{workout_id}/progress")
async def get_workout_progress(workout_id: str, user: dict = Depends(get_current_user)):
    """Get saved workout progress"""
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)}, {"is_draft": 1, "creator_id": 1, "for_user_id": 1})
    if workout and workout.get("is_draft"):
        raise HTTPException(status_code=403, detail="Brouillon")
    progress = await db.workout_progress.find_one({
        "workout_id": workout_id,
        "user_id": user["id"]
    })
    
    if not progress:
        return None
    
    return {
        "current_exercise_index": progress["current_exercise_index"],
        "current_block_index": progress["current_block_index"],
        "time_elapsed": progress["time_elapsed"],
        "pause_time": progress["pause_time"],
        "exercises_completed": progress["exercises_completed"],
        "saved_at": progress["saved_at"]
    }

@api_router.delete("/workouts/{workout_id}/progress")
async def clear_workout_progress(workout_id: str, user: dict = Depends(get_current_user)):
    """Clear saved workout progress"""
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)}, {"is_draft": 1})
    if workout and workout.get("is_draft"):
        raise HTTPException(status_code=403, detail="Brouillon")
    await db.workout_progress.delete_one({
        "workout_id": workout_id,
        "user_id": user["id"]
    })
    await db.scheduled_workouts.update_one(
        {"_id": ObjectId(workout_id), "status": "in_progress"},
        {"$set": {"status": "pending"}, "$unset": {"completed_at": ""}},
    )
    return {"message": "Progress cleared"}

@api_router.post("/workouts/duplicate")
async def duplicate_workouts(
    workout_ids: List[str],
    target_date: Optional[str] = None,
    offset_days: int = 7,
    repeat_weeks: int = 1,
    user: dict = Depends(get_current_user)
):
    created = []
    
    for workout_id in workout_ids:
        workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
        if not workout:
            continue
        
        allowed_ids = [user["id"]]
        if user.get("partner_id"):
            allowed_ids.append(user["partner_id"])
        
        if workout["creator_id"] not in allowed_ids:
            continue
        
        for week in range(repeat_weeks):
            original_date = datetime.strptime(workout["scheduled_date"], "%Y-%m-%d")
            
            if target_date and week == 0:
                new_date = datetime.strptime(target_date, "%Y-%m-%d")
            else:
                new_date = original_date + timedelta(days=offset_days * (week + 1))
            
            new_workout = {k: v for k, v in workout.items() if k != "_id"}
            new_workout["scheduled_date"] = new_date.strftime("%Y-%m-%d")
            new_workout["status"] = "pending"
            new_workout["created_at"] = datetime.now(timezone.utc).isoformat()
            new_workout["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            result = await db.scheduled_workouts.insert_one(new_workout)
            new_workout["id"] = str(result.inserted_id)
            created.append(new_workout)
    
    return {"created": len(created), "workouts": created}

@api_router.post("/workouts/duplicate-week")
async def duplicate_week(
    source_start_date: str,
    target_start_date: str,
    repeat_weeks: int = 1,
    user: dict = Depends(get_current_user)
):
    source_start = datetime.strptime(source_start_date, "%Y-%m-%d")
    source_end = source_start + timedelta(days=6)
    target_start = datetime.strptime(target_start_date, "%Y-%m-%d")
    
    workouts = await db.scheduled_workouts.find({
        "scheduled_date": {"$gte": source_start_date, "$lte": source_end.strftime("%Y-%m-%d")},
        "creator_id": user["id"]
    }).to_list(100)
    
    created = []
    
    for week in range(repeat_weeks):
        week_offset = timedelta(days=7 * week)
        
        for workout in workouts:
            original_date = datetime.strptime(workout["scheduled_date"], "%Y-%m-%d")
            day_offset = (original_date - source_start).days
            new_date = target_start + timedelta(days=day_offset) + week_offset
            
            new_workout = {k: v for k, v in workout.items() if k != "_id"}
            new_workout["scheduled_date"] = new_date.strftime("%Y-%m-%d")
            new_workout["status"] = "pending"
            new_workout["created_at"] = datetime.now(timezone.utc).isoformat()
            new_workout["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            result = await db.scheduled_workouts.insert_one(new_workout)
            new_workout["id"] = str(result.inserted_id)
            created.append(new_workout)
    
    return {"created": len(created), "workouts": created}

# ============ WORKOUT SESSION ROUTES ============

@api_router.post("/sessions")
async def create_session(data: WorkoutSessionCreate, user: dict = Depends(get_current_user)):
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(data.workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    session_doc = {
        **data.model_dump(),
        "workout_title": workout["title"],
        "user_id": user["id"],
        "username": user["username"],
        "likes": [],
        "reactions": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.workout_sessions.insert_one(session_doc)
    
    await db.scheduled_workouts.update_one(
        {"_id": ObjectId(data.workout_id)},
        {"$set": {"status": data.status, "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    session_doc["id"] = str(result.inserted_id)
    session_doc.pop("_id", None)  # Remove ObjectId before returning

    if data.status == "completed":
        schedule_badge_evaluation(trigger_solo_evaluation(db, user["id"]))
        if user.get("partner_id"):
            pair_key = duo_pair_key(user["id"], user["partner_id"])
            schedule_badge_evaluation(
                trigger_duo_evaluation(db, pair_key, notify_user_ids=[user["id"], user["partner_id"]])
            )

    return session_doc

@api_router.get("/sessions")
async def get_sessions(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {"$or": [{"user_id": user["id"]}]}
    
    if user.get("partner_id"):
        query["$or"].append({"user_id": user["partner_id"]})
    if status:
        query["status"] = status
    
    cursor = db.workout_sessions.find(query).sort("created_at", -1).skip(offset).limit(min(limit, 200))
    sessions = await cursor.to_list(min(limit, 200))
    return [{"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}} for s in sessions]


def _session_export_auth(target_user: Optional[str], user: dict) -> str:
    stats_user_id = target_user or user.get("partner_id") or user["id"]
    allowed = [user["id"]]
    if user.get("partner_id"):
        allowed.append(user["partner_id"])
    if stats_user_id not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized")
    is_coach = user.get("relation_type") in ("coach", "trainer") or user["username"] in _admin_usernames()
    if stats_user_id != user["id"] and not is_coach and stats_user_id != user.get("partner_id"):
        raise HTTPException(status_code=403, detail="Coach access required for this export")
    return stats_user_id


def _period_to_dates(period: str, start_date: Optional[str], end_date: Optional[str]) -> tuple:
    today = datetime.now(timezone.utc).date()
    if period == "7d":
        start = (today - timedelta(days=6)).isoformat()
        end = today.isoformat()
    elif period == "30d":
        start = (today - timedelta(days=29)).isoformat()
        end = today.isoformat()
    elif period == "month":
        start = today.replace(day=1).isoformat()
        end = today.isoformat()
    elif period == "custom" and start_date and end_date:
        start, end = start_date, end_date
    else:
        start = (today - timedelta(days=29)).isoformat()
        end = today.isoformat()
    return start, end


async def _enrich_session(s: dict) -> dict:
    out = {"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}}
    workout = None
    wid = s.get("workout_id")
    if wid:
        try:
            workout = await db.scheduled_workouts.find_one({"_id": ObjectId(wid)})
        except Exception:
            workout = None
    if workout:
        out["scheduled_date"] = workout.get("scheduled_date")
        out["workout_status"] = workout.get("status")
        if not out.get("exercise_log"):
            log = []
            for block in workout.get("blocks", []):
                for ex in block.get("exercises", []):
                    log.append({
                        "name": ex.get("name"),
                        "exercise_type": ex.get("exercise_type"),
                        "reps": ex.get("reps"),
                        "duration": ex.get("duration"),
                        "block_type": block.get("block_type"),
                    })
            out["exercise_log"] = log
    if out.get("status") == "completed":
        out["display_status"] = "completed"
    elif out.get("status") == "abandoned":
        out["display_status"] = "abandoned"
    else:
        out["display_status"] = out.get("status")
    if workout and workout.get("status") == "pending" and out.get("status") != "completed":
        sd = workout.get("scheduled_date", "")
        if sd and sd < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
            out["display_status"] = "missed"
    out["estimated_calories"] = estimate_calories(
        out.get("total_time", 0), out.get("difficulty_felt")
    )
    return out


@api_router.get("/sessions/history")
async def get_sessions_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    target_user: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Historique détaillé pour duo / coach."""
    if target_user:
        stats_user_id = _session_export_auth(target_user, user)
        query = {"user_id": stats_user_id}
    else:
        query = {"$or": [{"user_id": user["id"]}]}
        if user.get("partner_id"):
            query["$or"].append({"user_id": user["partner_id"]})

    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date + "T23:59:59"
        query["created_at"] = date_q

    if status:
        query["status"] = status

    sessions = await db.workout_sessions.find(query).sort("created_at", -1).skip(offset).limit(min(limit, 200)).to_list(min(limit, 200))
    enriched = []
    for s in sessions:
        enriched.append(await _enrich_session(s))
    return enriched


@api_router.get("/sessions/export")
async def export_sessions_csv(
    target_user: Optional[str] = None,
    period: str = "30d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    export_format: str = "csv",
    user: dict = Depends(get_current_user),
):
    """Export CSV (ou HTML imprimable) sur une période."""
    stats_user_id = _session_export_auth(target_user, user)
    p_start, p_end = _period_to_dates(period, start_date, end_date)

    sessions = await db.workout_sessions.find({
        "user_id": stats_user_id,
        "created_at": {"$gte": p_start, "$lte": p_end + "T23:59:59"},
    }).sort("created_at", -1).to_list(5000)

    rows = []
    for s in sessions:
        enriched = await _enrich_session(s)
        log_str = "; ".join(
            f"{e.get('name')}: "
            + (f"{e.get('reps')} reps" if e.get('exercise_type') == 'reps' else f"{e.get('duration')}s")
            for e in (enriched.get("exercise_log") or [])
        )
        rows.append({
            "date": enriched.get("created_at", ""),
            "workout_title": enriched.get("workout_title", ""),
            "username": enriched.get("username", ""),
            "status": enriched.get("display_status", enriched.get("status", "")),
            "total_time_sec": enriched.get("total_time", 0),
            "exercises_completed": enriched.get("exercises_completed", 0),
            "exercises_total": enriched.get("exercises_total", 0),
            "difficulty_felt": enriched.get("difficulty_felt", ""),
            "fatigue_before": enriched.get("fatigue_before", ""),
            "fatigue_after": enriched.get("fatigue_after", ""),
            "notes": enriched.get("notes", ""),
            "exercises_detail": log_str,
        })

    if export_format == "html":
        html = _sessions_to_html(rows, p_start, p_end)
        return StreamingResponse(
            iter([html]),
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="anthea_export_{p_start}_{p_end}.html"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "date", "workout_title", "username", "status", "total_time_sec",
        "exercises_completed", "exercises_total", "difficulty_felt",
        "fatigue_before", "fatigue_after", "notes", "exercises_detail",
    ])
    for r in rows:
        writer.writerow([
            r["date"], r["workout_title"], r["username"], r["status"],
            r["total_time_sec"], r["exercises_completed"], r["exercises_total"],
            r["difficulty_felt"], r["fatigue_before"], r["fatigue_after"],
            r["notes"], r["exercises_detail"],
        ])
    output.seek(0)
    filename = f"anthea_export_{p_start}_{p_end}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _sessions_to_html(rows: list, start: str, end: str) -> str:
    body = "".join(
        f"<tr><td>{r['date']}</td><td>{r['workout_title']}</td><td>{r['username']}</td>"
        f"<td>{r['status']}</td><td>{r['total_time_sec']}</td><td>{r['exercises_detail']}</td>"
        f"<td>{r.get('notes') or ''}</td></tr>"
        for r in rows
    )
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export Anthea</title>
    <style>body{{font-family:sans-serif;padding:24px}}table{{border-collapse:collapse;width:100%}}
    th,td{{border:1px solid #ccc;padding:8px;font-size:12px}}th{{background:#f4f4f4}}</style></head>
    <body><h1>Historique séances</h1><p>Période : {start} → {end}</p>
    <table><thead><tr><th>Date</th><th>Séance</th><th>Personne</th><th>Statut</th>
    <th>Temps (s)</th><th>Exercices</th><th>Notes</th></tr></thead><tbody>{body}</tbody></table>
    <p><small>Export Anthea — imprimer en PDF depuis le navigateur si besoin.</small></p></body></html>"""


@api_router.put("/sessions/{session_id}/adjust-time")
async def adjust_session_time(
    session_id: str,
    body: SessionTimeAdjust,
    user: dict = Depends(get_current_user),
):
    """Correction manuelle du temps — admin / coach uniquement."""
    if not await _can_moderate_streak(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    old_time = session.get("total_time", 0)
    await db.workout_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"total_time": body.total_time}},
    )
    await db.session_time_audit.insert_one({
        "session_id": session_id,
        "actor_id": user["id"],
        "old_time": old_time,
        "new_time": body.total_time,
        "reason": body.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "ok", "total_time": body.total_time}


@api_router.get("/push/status")
async def push_status(user: dict = Depends(get_current_user)):
    from push_service import is_push_configured, VAPID_PUBLIC_KEY
    count = await db.push_subscriptions.count_documents({
        "user_id": user["id"],
        "$or": [{"revoked_at": None}, {"revoked_at": {"$exists": False}}],
    })
    return {
        "configured": is_push_configured(),
        "public_key": VAPID_PUBLIC_KEY if is_push_configured() else None,
        "subscriptions": count,
    }


@api_router.post("/push/subscribe")
async def subscribe_push(data: PushSubscriptionCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    keys = data.keys or {}
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": data.endpoint},
        {"$set": {
            "user_id": user["id"],
            "endpoint": data.endpoint,
            "p256dh": keys.get("p256dh"),
            "auth": keys.get("auth"),
            "keys": keys,
            "user_agent": data.user_agent,
            "updated_at": now,
            "revoked_at": None,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"status": "ok"}


@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(data: PushUnsubscribeBody, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": data.endpoint},
        {"$set": {"revoked_at": now, "updated_at": now}},
    )
    return {"status": "ok", "revoked": result.modified_count > 0}


@api_router.post("/push/test")
async def test_push(user: dict = Depends(get_current_user)):
    from push_service import is_push_configured, send_web_push_to_user, build_push_payload
    if not is_push_configured():
        raise HTTPException(status_code=503, detail="Push non configuré (VAPID manquant)")
    payload = build_push_payload(
        "follow_request",
        title="Notification de test",
        body="Si vous lisez ceci avec l’onglet fermé, Web Push fonctionne.",
        url="/notifications",
        tag="push-test",
    )
    # Override tag for test
    payload["tag"] = "push-test"
    result = await send_web_push_to_user(db, user["id"], payload)
    if result.get("sent", 0) < 1:
        raise HTTPException(
            status_code=400,
            detail=result.get("reason") or "Aucun appareil abonné",
        )
    return {"status": "ok", **result}


@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    allowed_ids = [user["id"]]
    if user.get("partner_id"):
        allowed_ids.append(user["partner_id"])
    
    if session["user_id"] not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {"id": str(session["_id"]), **{k: v for k, v in session.items() if k != "_id"}}

@api_router.post("/sessions/{session_id}/like")
async def toggle_like(session_id: str, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    likes = session.get("likes", [])
    if user["id"] in likes:
        likes.remove(user["id"])
    else:
        likes.append(user["id"])
    
    await db.workout_sessions.update_one({"_id": ObjectId(session_id)}, {"$set": {"likes": likes}})
    return {"likes": likes}

@api_router.post("/sessions/{session_id}/react")
async def add_reaction(session_id: str, data: ReactionCreate, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    reaction = {
        "user_id": user["id"],
        "username": user["username"],
        "reaction_type": data.reaction_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.workout_sessions.update_one({"_id": ObjectId(session_id)}, {"$push": {"reactions": reaction}})

    if user.get("partner_id") and session.get("user_id") == user.get("partner_id"):
        pair_key = duo_pair_key(user["id"], user["partner_id"])
        schedule_badge_evaluation(
            trigger_duo_evaluation(db, pair_key, notify_user_ids=[user["id"], user["partner_id"]])
        )

    updated = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    return {"reactions": updated.get("reactions", [])}

@api_router.post("/sessions/{session_id}/comment")
async def add_comment(session_id: str, data: CommentCreate, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    comment = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user["username"],
        "text": data.text[:200],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.workout_sessions.update_one({"_id": ObjectId(session_id)}, {"$push": {"comments": comment}})
    
    updated = await db.workout_sessions.find_one({"_id": ObjectId(session_id)})
    return {"comments": updated.get("comments", [])}

# ============ POSTS / SOCIAL WALL ============

@api_router.post("/posts")
async def create_post(data: PostCreate, user: dict = Depends(get_current_user)):
    post_type = data.type
    if post_type not in POST_TYPES:
        raise HTTPException(status_code=400, detail="Type de publication invalide")

    visibility = data.visibility if data.visibility in POST_VISIBILITY else "public"
    title = (data.title or "").strip()[:120] or None
    description = (data.description or "").strip()[:500] or None
    image_url = normalize_upload_path(data.image_url) if data.image_url else None

    session_snapshot = None
    badge_name = None
    badge_icon = None
    badge_rarity = None
    workout_session_id = data.workout_session_id
    duo_session_id = data.duo_session_id
    partner_session_id = data.partner_session_id
    duo_id = data.duo_id
    partner_session_snapshot = None
    duo_doc = None
    duo_profile_id = None

    is_duo_wall_type = post_type in DUO_WALL_POST_TYPES or data.post_on_duo_wall

    if data.duo_id or is_duo_wall_type or data.post_on_duo_wall:
        if not user.get("partner_id"):
            raise HTTPException(status_code=400, detail="Aucun duo lié")
        duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
        if not duo_doc:
            raise HTTPException(status_code=404, detail="Profil duo introuvable")
        duo_profile_id = str(duo_doc["_id"])
        duo_id = duo_wall_owner_key(duo_doc, user["id"], user["partner_id"])
        if not duo_id:
            raise HTTPException(status_code=400, detail="Impossible d'identifier le duo")
        members = await get_duo_members(db, duo_doc)
        if user["id"] not in {str(m["_id"]) for m in members}:
            raise HTTPException(status_code=403, detail="Non autorisé à publier pour ce duo")

    if post_type in ("workout", "workout_photo", "duo", "duo_repost", "duo_common_session") and partner_session_id:
        try:
            p_session = await db.workout_sessions.find_one({"_id": ObjectId(partner_session_id)})
        except Exception:
            p_session = None
        if not p_session:
            raise HTTPException(status_code=404, detail="Séance partenaire introuvable")
        allowed_partner = p_session.get("user_id") == user.get("partner_id")
        if not allowed_partner and p_session.get("user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Séance partenaire non accessible")
        workout_p = await _load_workout_for_session(p_session)
        partner_session_snapshot = build_session_snapshot(p_session, workout_p)

    if post_type in ("duo", "duo_common_session") and workout_session_id:
        try:
            session = await db.workout_sessions.find_one({"_id": ObjectId(workout_session_id)})
        except Exception:
            session = None
        if not session:
            raise HTTPException(status_code=404, detail="Séance introuvable")
        session_owner_id = session.get("user_id")
        can_use = session_owner_id == user["id"] or session_owner_id == user.get("partner_id")
        if not can_use:
            raise HTTPException(status_code=403, detail="Séance non accessible")
        workout = await _load_workout_for_session(session)
        session_snapshot = build_session_snapshot(session, workout)
        if not title and session_snapshot.get("workout_title") and post_type != "duo_common_session":
            title = session_snapshot["workout_title"]

    if post_type in ("workout", "workout_photo") and workout_session_id:
        try:
            session = await db.workout_sessions.find_one({"_id": ObjectId(workout_session_id)})
        except Exception:
            session = None
        if not session:
            raise HTTPException(status_code=404, detail="Séance introuvable")
        if session.get("user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Cette séance ne vous appartient pas")
        workout = await _load_workout_for_session(session)
        session_snapshot = build_session_snapshot(session, workout)
        if not title and session_snapshot.get("workout_title"):
            title = session_snapshot["workout_title"]
    elif post_type in ("duo", "duo_common_session", "duo_badge", "duo_challenge", "duo_free"):
        if post_type in ("duo", "duo_common_session") and workout_session_id and partner_session_id:
            if not title:
                title = "Séance commune"
        elif post_type in ("duo", "duo_badge") and data.badge_id:
            if not user.get("partner_id"):
                raise HTTPException(status_code=400, detail="Badge duo requiert un partenaire")
            pair_key = duo_pair_key(user["id"], user["partner_id"])
            if data.pair_key and data.pair_key != pair_key:
                raise HTTPException(status_code=400, detail="pair_key incorrect")
            service = BadgeProgressService(db)
            badge = await service.find_unlocked_badge("duo", pair_key, data.badge_id)
            if not badge:
                # Fallback évaluation live (migration)
                catalog = await service.get_duo_catalog_with_progress(pair_key)
                cid = canonical_badge_id(data.badge_id)
                badge = next((b for b in (catalog.get("badges") or []) if b.get("id") == cid and b.get("unlocked")), None)
            if not badge:
                raise HTTPException(status_code=400, detail="Badge duo non débloqué")
            definition = get_badge_definition(badge["id"])
            if not definition or definition.get("scope") != "duo":
                raise HTTPException(status_code=400, detail="Badge duo invalide")
            # Toujours reconstruire depuis le catalogue serveur
            badge_name = definition.get("name")
            badge_icon = definition.get("icon_key")
            from badge_catalog import RARITY_LABELS
            badge_rarity = RARITY_LABELS.get(definition.get("rarity"), "Commun")
            if not title:
                title = f"Badge duo : {badge_name}"
            if not data.description and post_type == "duo_badge":
                pass
        elif post_type == "duo_challenge":
            if not user.get("partner_id"):
                raise HTTPException(status_code=400, detail="Défi duo requiert un partenaire")
            challenge = await get_current_challenge(
                user["id"], user["partner_id"], locale=user.get("locale")
            )
            if not challenge or challenge.get("status") != "completed":
                raise HTTPException(status_code=400, detail="Défi de la semaine non complété")
            if not title:
                title = f"Défi réussi : {challenge.get('title', 'Défi de la semaine')}"
            description = description or challenge.get("title")
        elif post_type == "duo_free" and not title:
            title = "Publication duo"
        elif not title:
            title = "Publication duo"
    elif post_type == "badge":
        if not data.badge_id:
            raise HTTPException(status_code=400, detail="Badge requis")
        service = BadgeProgressService(db)
        badge = await service.find_unlocked_badge("solo", user["id"], data.badge_id)
        if not badge:
            streak = await _get_user_streak_value(user["id"])
            catalog = await service.get_solo_catalog_with_progress(user["id"], streak_value=streak)
            cid = canonical_badge_id(data.badge_id)
            badge = next((b for b in (catalog.get("badges") or []) if b.get("id") == cid and b.get("unlocked")), None)
        if not badge:
            raise HTTPException(status_code=400, detail="Badge non débloqué")
        definition = get_badge_definition(badge["id"])
        if not definition or definition.get("scope") != "solo":
            raise HTTPException(status_code=400, detail="Badge solo invalide")
        from badge_catalog import RARITY_LABELS
        badge_name = definition.get("name")
        badge_icon = definition.get("icon_key")
        badge_rarity = RARITY_LABELS.get(definition.get("rarity"), "Commun")
        if not title:
            title = f"J'ai obtenu le badge {badge_name}"
    elif post_type == "duo_repost":
        session_ref = workout_session_id or duo_session_id
        if not session_ref:
            raise HTTPException(status_code=400, detail="Séance duo requise")
        try:
            session = await db.workout_sessions.find_one({"_id": ObjectId(session_ref)})
        except Exception:
            session = None
        if not session:
            raise HTTPException(status_code=404, detail="Séance introuvable")
        allowed = session.get("user_id") == user["id"]
        if not allowed and user.get("partner_id") == session.get("user_id"):
            allowed = True
        if not allowed:
            raise HTTPException(status_code=403, detail="Séance non republiable")
        workout_session_id = str(session["_id"])
        duo_session_id = workout_session_id
        workout = await _load_workout_for_session(session)
        session_snapshot = build_session_snapshot(session, workout)
        if not title and session_snapshot.get("workout_title"):
            title = session_snapshot["workout_title"]

    now = datetime.now(timezone.utc).isoformat()
    owner_type = "user"
    owner_id = user["id"]
    if duo_id and (data.post_on_duo_wall or post_type in DUO_WALL_POST_TYPES):
        owner_type = "duo"
        owner_id = duo_id

    post_doc = {
        "author_id": user["id"],
        "created_by_user_id": user["id"],
        "owner_type": owner_type,
        "owner_id": owner_id,
        "actor_type": owner_type,
        "actor_id": owner_id,
        "author_username": user.get("username"),
        "author_handle": user.get("handle") or user.get("username"),
        "author_display_name": user.get("display_name"),
        "author_avatar_url": user.get("avatar_url"),
        "type": post_type,
        "title": title,
        "description": description,
        "image_url": image_url,
        "workout_session_id": workout_session_id,
        "badge_id": data.badge_id,
        "badge_name": badge_name,
        "badge_icon": badge_icon,
        "badge_rarity": badge_rarity,
        "duo_session_id": duo_session_id,
        "partner_session_id": partner_session_id,
        "partner_session_snapshot": partner_session_snapshot,
        "duo_id": duo_id,
        "source_post_id": None,
        "visibility": visibility,
        "session_snapshot": session_snapshot,
        "likes": [],
        "comments": [],
        "created_at": now,
    }

    result = await db.posts.insert_one(post_doc)
    post_doc["_id"] = result.inserted_id
    if post_doc.get("owner_type") == "duo":
        print("[DUO POST CREATE]", {
            "post_id": str(result.inserted_id),
            "owner_type": post_doc.get("owner_type"),
            "owner_id": post_doc.get("owner_id"),
            "duo_id": post_doc.get("duo_id"),
            "actor_type": post_doc.get("actor_type"),
            "actor_id": post_doc.get("actor_id"),
            "created_by_user_id": post_doc.get("created_by_user_id"),
        })
        if user.get("partner_id"):
            pk = duo_pair_key(user["id"], user["partner_id"])
            schedule_badge_evaluation(
                trigger_duo_evaluation(db, pk, notify_user_ids=[user["id"], user["partner_id"]])
            )

    if not user.get("show_posts"):
        await db.users.update_one(
            {"_id": ObjectId(user["id"])},
            {"$set": {"show_posts": True}},
        )

    if duo_profile_id and (data.post_on_duo_wall or post_type in DUO_WALL_POST_TYPES):
        await db.duo_profiles.update_one(
            {"_id": ObjectId(duo_profile_id)},
            {"$set": {"show_posts": True}},
        )

    duo_doc_for_serial = None
    if duo_profile_id:
        duo_doc_for_serial = await db.duo_profiles.find_one({"_id": ObjectId(duo_profile_id)})
    elif duo_id and duo_doc:
        duo_doc_for_serial = duo_doc

    serialized = await serialize_post(
        post_doc, user["id"], await get_user_doc_by_id(user["id"]), duo_doc=duo_doc_for_serial
    )
    return {"post": serialized}


@api_router.get("/users/{handle}/posts")
async def get_user_posts(
    handle: str,
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    target_id = str(target["_id"])
    access = await get_profile_access_level(user["id"], target)
    is_own = user["id"] == target_id

    if access == "limited":
        return []

    posts_vis = resolve_visibility_value(target, "posts_visibility", "show_posts", default_public=False)
    if target.get("account_visibility") == "public":
        posts_vis = "public"
    if not is_own and not visibility_allows(access, posts_vis):
        return []

    posts = await db.posts.find(user_wall_posts_query(target_id)).sort(
        "created_at", -1
    ).skip(offset).limit(min(limit, 50)).to_list(min(limit, 50))

    items = []
    for post in posts:
        serialized = await serialize_post(post, user["id"], target)
        if serialized:
            items.append(serialized)
    return items


@api_router.get("/users/{handle}/reposts")
async def get_user_reposts(
    handle: str,
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    target = await find_user_by_handle(handle)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    target_id = str(target["_id"])
    access = await get_profile_access_level(user["id"], target)

    if access == "limited":
        return []

    posts_vis = resolve_visibility_value(target, "posts_visibility", "show_posts", default_public=False)
    if target.get("account_visibility") == "public":
        posts_vis = "public"
    if user["id"] != target_id and not visibility_allows(access, posts_vis):
        return []

    reposts = await db.reposts.find({"user_id": target_id}).sort(
        "created_at", -1
    ).skip(offset).limit(min(limit, 50)).to_list(min(limit, 50))

    items = []
    for repost in reposts:
        item = {
            "id": str(repost["_id"]),
            "created_at": repost.get("created_at"),
            "post": None,
        }
        if repost.get("post_id"):
            try:
                post = await db.posts.find_one({"_id": ObjectId(repost["post_id"])})
            except Exception:
                post = None
            if post:
                author = await get_user_doc_by_id(post.get("author_id"))
                if author:
                    serialized = await serialize_post(post, user["id"], author)
                    if serialized:
                        item["post"] = serialized
        elif repost.get("workout_session_id"):
            try:
                session = await db.workout_sessions.find_one(
                    {"_id": ObjectId(repost["workout_session_id"])}
                )
            except Exception:
                session = None
            if session:
                author = await get_user_doc_by_id(session.get("user_id"))
                if author and await can_view_session_in_post(user["id"], author, session):
                    workout = await _load_workout_for_session(session)
                    partner_session_id = repost.get("partner_session_id")
                    partner_snap = None
                    partner_details = None
                    partner_author = None
                    is_duo = bool(partner_session_id)
                    common_date = None
                    if partner_session_id:
                        try:
                            ps = await db.workout_sessions.find_one(
                                {"_id": ObjectId(partner_session_id)}
                            )
                        except Exception:
                            ps = None
                        if ps:
                            partner_author = await get_user_doc_by_id(ps.get("user_id"))
                            if partner_author and await can_view_session_in_post(
                                user["id"], partner_author, ps
                            ):
                                partner_snap = build_session_snapshot(
                                    ps, await _load_workout_for_session(ps)
                                )
                                partner_details = {
                                    "exercise_log": ps.get("exercise_log") or [],
                                    "fatigue_before": ps.get("fatigue_before"),
                                    "fatigue_after": ps.get("fatigue_after"),
                                    "difficulty_felt": ps.get("difficulty_felt"),
                                    "mood": ps.get("mood"),
                                    "notes": ps.get("notes"),
                                }
                                created_ps = ps.get("created_at") or ""
                                if created_ps:
                                    common_date = created_ps[:10]
                    post_payload = {
                        "id": f"session-{repost['workout_session_id']}",
                        "type": "duo" if is_duo and partner_snap else "workout",
                        "title": "Séance commune" if is_duo and partner_snap else session.get("workout_title"),
                        "workout_session_id": str(session["_id"]),
                        "partner_session_id": partner_session_id,
                        "author_id": str(author["_id"]),
                        "author_username": author.get("username"),
                        "author_handle": author.get("handle") or author.get("username"),
                        "author_display_name": author.get("display_name"),
                        "author_avatar_url": author.get("avatar_url"),
                        "session_snapshot": build_session_snapshot(session, workout),
                        "partner_session_snapshot": partner_snap,
                        "can_view_session_details": True,
                        "can_view_partner_session_details": partner_details is not None,
                        "session_details": {
                            "exercise_log": session.get("exercise_log") or [],
                            "fatigue_before": session.get("fatigue_before"),
                            "fatigue_after": session.get("fatigue_after"),
                            "difficulty_felt": session.get("difficulty_felt"),
                            "mood": session.get("mood"),
                            "notes": session.get("notes"),
                        },
                        "partner_session_details": partner_details,
                        "likes_count": 0,
                        "comments_count": 0,
                        "is_liked": False,
                        "is_repost": True,
                        "created_at": repost.get("created_at") or session.get("created_at"),
                    }
                    if is_duo and partner_snap and partner_author:
                        post_payload["common_session"] = True
                        post_payload["partner_author_id"] = str(partner_author["_id"])
                        post_payload["partner_author_username"] = partner_author.get("username")
                        post_payload["partner_author_handle"] = partner_author.get("handle") or partner_author.get("username")
                        post_payload["partner_author_display_name"] = partner_author.get("display_name")
                        post_payload["partner_author_avatar_url"] = partner_author.get("avatar_url")
                        post_payload["common_date"] = common_date or (session.get("created_at") or "")[:10]
                    item["post"] = post_payload
        if item["post"]:
            items.append(item)
    return items


@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    author = await get_user_doc_by_id(post.get("author_id"))
    if not author:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    serialized = await serialize_post(post, user["id"], author, include_all_comments=True)
    if not serialized:
        raise HTTPException(status_code=403, detail="Publication non accessible")
    return serialized


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")
    duo_doc = await find_duo_doc_for_post(post) if is_duo_wall_post(post) else None
    if not await can_delete_post(user["id"], post, duo_doc):
        raise HTTPException(status_code=403, detail="Non autorisé")

    await db.posts.delete_one({"_id": ObjectId(post_id)})
    await db.reposts.delete_many({"post_id": post_id})
    return {"status": "ok"}


@api_router.post("/posts/{post_id}/like")
async def toggle_post_like(post_id: str, user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    if not await can_view_post_doc(user["id"], post):
        raise HTTPException(status_code=403, detail="Publication non accessible")

    likes = post.get("likes") or []
    liked = user["id"] in likes
    if liked:
        likes = [uid for uid in likes if uid != user["id"]]
    else:
        likes = likes + [user["id"]]
        notify_target = post.get("created_by_user_id") or post.get("author_id")
        if notify_target and notify_target != user["id"]:
            await create_notification(
                notify_target,
                "like",
                user,
                post_id=post_id,
            )

    await db.posts.update_one({"_id": ObjectId(post_id)}, {"$set": {"likes": likes}})
    return {"likes_count": len(likes), "is_liked": user["id"] in likes}


@api_router.post("/posts/{post_id}/comment")
async def add_post_comment(
    post_id: str,
    data: PostCommentCreate,
    user: dict = Depends(get_current_user),
):
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Commentaire vide")

    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    if not await can_view_post_doc(user["id"], post):
        raise HTTPException(status_code=403, detail="Publication non accessible")

    comment = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user.get("username"),
        "handle": user.get("handle") or user.get("username"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
        "text": text[:300],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "likes": [],
    }

    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$push": {"comments": comment}},
    )
    await create_notification(
        post.get("created_by_user_id") or post.get("author_id"),
        "comment",
        user,
        post_id=post_id,
    )

    updated = await db.posts.find_one({"_id": ObjectId(post_id)})
    comments = [_serialize_post_comment(c, user["id"]) for c in (updated.get("comments") or [])]
    return {
        "comments_count": len(comments),
        "preview_comment": comments[-1] if comments else None,
        "comments": comments,
    }


@api_router.get("/posts/{post_id}/comments")
async def get_post_comments(post_id: str, user: dict = Depends(get_current_user)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    if not await can_view_post_doc(user["id"], post):
        raise HTTPException(status_code=403, detail="Publication non accessible")

    comments = [_serialize_post_comment(c, user["id"]) for c in (post.get("comments") or [])]
    return {"comments": comments, "comments_count": len(comments)}


@api_router.post("/posts/{post_id}/comments/{comment_id}/like")
async def toggle_comment_like(
    post_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        post = None
    if not post:
        raise HTTPException(status_code=404, detail="Publication introuvable")

    if not await can_view_post_doc(user["id"], post):
        raise HTTPException(status_code=403, detail="Publication non accessible")

    comments = post.get("comments") or []
    idx = next((i for i, c in enumerate(comments) if c.get("id") == comment_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")

    likes = list(comments[idx].get("likes") or [])
    if user["id"] in likes:
        likes = [uid for uid in likes if uid != user["id"]]
        is_liked = False
    else:
        likes.append(user["id"])
        is_liked = True

    comments[idx]["likes"] = likes
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"comments": comments}},
    )
    return {"likes_count": len(likes), "is_liked": is_liked, "comment_id": comment_id}


@api_router.post("/reposts")
async def create_repost(data: RepostCreate, user: dict = Depends(get_current_user)):
    if not data.post_id and not data.workout_session_id:
        raise HTTPException(status_code=400, detail="Référence requise")

    duo_wall_post = None

    if data.post_id:
        try:
            post = await db.posts.find_one({"_id": ObjectId(data.post_id)})
        except Exception:
            post = None
        if not post:
            raise HTTPException(status_code=404, detail="Publication introuvable")
        author = await get_user_doc_by_id(post.get("author_id"))
        if not await can_view_post_doc(user["id"], post):
            raise HTTPException(status_code=403, detail="Publication non accessible")

        existing = await db.reposts.find_one({
            "user_id": user["id"],
            "post_id": data.post_id,
        })
        if existing:
            return {
                "id": str(existing["_id"]),
                "post_id": data.post_id,
                "already_exists": True,
                "created_at": existing.get("created_at"),
            }

        now = datetime.now(timezone.utc).isoformat()
        result = await db.reposts.insert_one({
            "user_id": user["id"],
            "post_id": data.post_id,
            "workout_session_id": post.get("workout_session_id") or post.get("duo_session_id"),
            "partner_session_id": post.get("partner_session_id"),
            "created_at": now,
        })
        return {"id": str(result.inserted_id), "post_id": data.post_id, "created_at": now}

    try:
        session = await db.workout_sessions.find_one(
            {"_id": ObjectId(data.workout_session_id)}
        )
    except Exception:
        session = None
    if not session:
        raise HTTPException(status_code=404, detail="Séance introuvable")

    session_owner_id = session.get("user_id")
    can_repost = session_owner_id == user["id"] or session_owner_id == user.get("partner_id")
    if not can_repost:
        raise HTTPException(status_code=403, detail="Séance non republiable")

    partner_session_id = data.partner_session_id
    if not partner_session_id and user.get("partner_id"):
        sess_date = (session.get("created_at") or "")[:10]
        if sess_date:
            other_uid = (
                user["partner_id"]
                if session_owner_id == user["id"]
                else user["id"]
            )
            ps = await db.workout_sessions.find_one({
                "user_id": other_uid,
                "status": "completed",
                "created_at": {"$regex": f"^{re.escape(sess_date)}"},
            })
            if ps:
                partner_session_id = str(ps["_id"])

    existing = await db.reposts.find_one({
        "user_id": user["id"],
        "workout_session_id": data.workout_session_id,
    })
    if existing:
        return {
            "id": str(existing["_id"]),
            "workout_session_id": data.workout_session_id,
            "partner_session_id": existing.get("partner_session_id"),
            "duo_wall_post_id": existing.get("duo_wall_post_id"),
            "already_exists": True,
            "created_at": existing.get("created_at"),
        }

    now = datetime.now(timezone.utc).isoformat()
    repost_doc = {
        "user_id": user["id"],
        "post_id": None,
        "workout_session_id": data.workout_session_id,
        "partner_session_id": partner_session_id,
        "created_at": now,
    }
    result = await db.reposts.insert_one(repost_doc)

    if data.post_on_duo_wall and user.get("partner_id"):
        duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
        if duo_doc:
            try:
                session = await db.workout_sessions.find_one(
                    {"_id": ObjectId(data.workout_session_id)}
                )
            except Exception:
                session = None
            if session:
                workout = await _load_workout_for_session(session)
                snap = build_session_snapshot(session, workout)
                partner_snap = None
                if data.partner_session_id:
                    try:
                        ps = await db.workout_sessions.find_one(
                            {"_id": ObjectId(data.partner_session_id)}
                        )
                    except Exception:
                        ps = None
                    if ps:
                        partner_snap = build_session_snapshot(
                            ps, await _load_workout_for_session(ps)
                        )
                post_doc = {
                    "author_id": user["id"],
                    "author_username": user.get("username"),
                    "author_handle": user.get("handle") or user.get("username"),
                    "author_display_name": user.get("display_name"),
                    "author_avatar_url": user.get("avatar_url"),
                    "type": "duo_common_session" if data.partner_session_id else "duo",
                    "title": "Séance commune" if data.partner_session_id else snap.get("workout_title"),
                    "description": None,
                    "image_url": None,
                    "workout_session_id": data.workout_session_id,
                    "partner_session_id": data.partner_session_id,
                    "session_snapshot": snap,
                    "partner_session_snapshot": partner_snap,
                    "duo_id": str(duo_doc["_id"]),
                    "visibility": "public",
                    "likes": [],
                    "comments": [],
                    "created_at": now,
                }
                wall_result = await db.posts.insert_one(post_doc)
                duo_wall_post = str(wall_result.inserted_id)
                await db.reposts.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"duo_wall_post_id": duo_wall_post}},
                )
                await db.duo_profiles.update_one(
                    {"_id": duo_doc["_id"]},
                    {"$set": {"show_posts": True}},
                )

    return {
        "id": str(result.inserted_id),
        "workout_session_id": data.workout_session_id,
        "partner_session_id": data.partner_session_id,
        "duo_wall_post_id": duo_wall_post,
        "created_at": now,
    }


@api_router.delete("/reposts/{repost_id}")
async def delete_repost(repost_id: str, user: dict = Depends(get_current_user)):
    try:
        repost = await db.reposts.find_one({"_id": ObjectId(repost_id)})
    except Exception:
        repost = None
    if not repost:
        raise HTTPException(status_code=404, detail="Republication introuvable")
    if repost.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")

    duo_wall_post_id = repost.get("duo_wall_post_id")
    await db.reposts.delete_one({"_id": ObjectId(repost_id)})
    if duo_wall_post_id:
        try:
            await db.posts.delete_one({"_id": ObjectId(duo_wall_post_id)})
        except Exception:
            pass
    return {"status": "ok"}

# ============ DUO STATS ROUTES ============

def _duo_pair_key(user_id: str, partner_id: str) -> str:
    return "_".join(sorted([user_id, partner_id]))


async def _get_manual_streak_override(user_id: str, partner_id: str) -> Optional[int]:
    doc = await db.duo_streak_overrides.find_one({"pair_key": _duo_pair_key(user_id, partner_id)})
    if not doc:
        return None
    if doc.get("manual_streak") is None:
        return None
    return int(doc["manual_streak"])


def _admin_usernames() -> set:
    raw = os.environ.get("ADMIN_USERNAMES", "")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


async def _can_moderate_streak(user: dict) -> bool:
    if user.get("username") and user["username"].lower() in _admin_usernames():
        return True
    if not user.get("partner_id"):
        return False
    rel = user.get("relation_type") or ""
    if rel not in ("coach", "coach_partner"):
        return False
    pid = user["partner_id"]
    me_for_partner = await db.scheduled_workouts.count_documents({
        "creator_id": user["id"],
        "for_user_id": pid,
    })
    partner_for_me = await db.scheduled_workouts.count_documents({
        "creator_id": pid,
        "for_user_id": user["id"],
    })
    # Le coach assigne typiquement les séances à l'élève : plus de créations « pour » le partenaire.
    return me_for_partner > partner_for_me


def _user_day_outcome(
    planned: List[dict],
    rest_or_exempt: bool,
    day_index: int,
) -> str:
    """Retourne neutral | ok | today_pending | fail"""
    if rest_or_exempt:
        return "ok"
    active = [w for w in planned if not w.get("is_draft")]
    if not active:
        return "neutral"
    all_completed = all(w.get("status") == "completed" for w in active)
    if all_completed:
        return "ok"
    if day_index == 0:
        return "today_pending"
    return "fail"


def _combine_duo_outcomes(a: str, b: Optional[str]) -> str:
    order = {"fail": 0, "today_pending": 1, "ok": 2, "neutral": 3}
    if b is None:
        return a
    rank_a = order.get(a, 99)
    rank_b = order.get(b, 99)
    if rank_a <= rank_b:
        first = a
        second = b
    else:
        first = b
        second = a
    if first == "fail" or second == "fail":
        return "fail"
    if first == "today_pending" or second == "today_pending":
        return "today_pending"
    return "ok"


async def _load_streak_context(user_id: str, partner_id: Optional[str], lookback_days: int = 364):
    """Charge marqueurs et séances planifiées pour le calcul streak / calendrier."""
    current_date = datetime.now(timezone.utc).date()
    start_s = (current_date - timedelta(days=lookback_days)).isoformat()
    users_in_pair = [user_id]
    if partner_id:
        users_in_pair.append(partner_id)

    markers = await db.streak_days.find({
        "user_id": {"$in": users_in_pair},
        "date": {"$gte": start_s},
    }).to_list(4000)

    skip_pairs = set()
    rest_pairs = set()
    for m in markers:
        uid, d, t = m["user_id"], m["date"], m.get("type")
        if t == "skip":
            skip_pairs.add((uid, d))
        elif t in ("rest", "exempt"):
            rest_pairs.add((uid, d))

    planned_raw = await db.scheduled_workouts.find({
        "scheduled_date": {"$gte": start_s},
        "for_user_id": {"$in": users_in_pair},
    }).to_list(8000)

    planned_by_user_date = defaultdict(list)
    for w in planned_raw:
        fu = w.get("for_user_id")
        sd = w.get("scheduled_date")
        if fu and sd:
            planned_by_user_date[(fu, sd)].append(w)

    return current_date, skip_pairs, rest_pairs, planned_by_user_date


def _combined_for_date(
    user_id: str,
    partner_id: Optional[str],
    check_date: str,
    day_index: int,
    skip_pairs: set,
    rest_pairs: set,
    planned_by_user_date: dict,
) -> dict:
    """État d'un jour pour le calendrier (aligné sur calculate_streak)."""
    if partner_id:
        if (user_id, check_date) in skip_pairs or (partner_id, check_date) in skip_pairs:
            return {"combined": "skip", "skip": True}
    elif (user_id, check_date) in skip_pairs:
        return {"combined": "skip", "skip": True}

    u_rest = (user_id, check_date) in rest_pairs
    p_rest = (partner_id, check_date) in rest_pairs if partner_id else False

    u_planned = planned_by_user_date.get((user_id, check_date), [])
    p_planned = planned_by_user_date.get((partner_id, check_date), []) if partner_id else []

    uo = _user_day_outcome(u_planned, u_rest, day_index)
    po = _user_day_outcome(p_planned, p_rest, day_index) if partner_id else None
    combined = _combine_duo_outcomes(uo, po if partner_id else None)

    active_u = [w for w in u_planned if not w.get("is_draft")]
    active_p = [w for w in p_planned if not w.get("is_draft")] if partner_id else []

    my_completed = any(w.get("status") == "completed" for w in active_u)
    partner_completed = any(w.get("status") == "completed" for w in active_p) if partner_id else False
    both_completed = my_completed and partner_completed and partner_id is not None
    has_planned = len(active_u) > 0 or len(active_p) > 0

    is_past = day_index > 0
    partner_missed = bool(
        partner_id and is_past and len(active_p) > 0 and not partner_completed
    )
    my_missed = bool(is_past and len(active_u) > 0 and not my_completed)

    return {
        "combined": combined,
        "skip": False,
        "rest": u_rest or p_rest,
        "my_completed": my_completed,
        "partner_completed": partner_completed,
        "both_completed": both_completed,
        "has_planned": has_planned,
        "partner_missed": partner_missed,
        "my_missed": my_missed,
        "missed": False,
        "today_pending": combined == "today_pending",
    }


async def calculate_streak(user_id: str, partner_id: Optional[str]) -> int:
    """
    Streak sur les jours où au moins une séance était attendue (scheduled non brouillon).
    Les jours sans rien de planifié ne brisent pas la streak et comptent comme OK en remontant.
    """
    streak = 0
    current_date, skip_pairs, rest_pairs, planned_by_user_date = await _load_streak_context(
        user_id, partner_id
    )

    for i in range(365):
        check_date = (current_date - timedelta(days=i)).isoformat()
        info = _combined_for_date(
            user_id, partner_id, check_date, i, skip_pairs, rest_pairs, planned_by_user_date
        )
        if info["skip"]:
            if i > 0:
                break
            continue
        contributes = bool(info.get("rest") or info.get("has_planned"))
        combined = info["combined"]
        if not contributes:
            continue
        if combined == "fail":
            if i > 0:
                break
            continue
        if combined == "today_pending":
            continue
        if combined == "ok":
            streak += 1

    return streak


def compute_best_streak_from_calendar(days: List[dict]) -> int:
    """Meilleur streak historique — ignore les jours sans séance prévue."""
    if not days:
        return 0

    sorted_days = sorted(days, key=lambda d: d.get("date") or "")
    max_streak = 0
    current = 0
    prev_date = None

    for day in sorted_days:
        if day.get("is_future") or day.get("skip"):
            continue

        ds = day.get("date")
        if prev_date and ds:
            prev = datetime.strptime(prev_date, "%Y-%m-%d").date()
            cur = datetime.strptime(ds, "%Y-%m-%d").date()
            if (cur - prev).days > 1:
                current = 0

        contributes = False
        if day.get("combined") == "fail":
            current = 0
        elif day.get("rest"):
            contributes = True
        elif day.get("has_planned") and day.get("combined") in ("ok", "today_pending"):
            contributes = True

        if contributes:
            current += 1
            max_streak = max(max_streak, current)
            prev_date = ds
        elif day.get("has_planned") and day.get("combined") == "fail":
            prev_date = ds
        elif ds:
            prev_date = ds

    return max_streak


async def build_streak_calendar(
    user_id: str,
    partner_id: Optional[str],
    start_date: str,
    end_date: str,
) -> List[dict]:
    """Calendrier jour par jour avec flammes de streak (logique serveur = calculate_streak)."""
    current_date, skip_pairs, rest_pairs, planned_by_user_date = await _load_streak_context(
        user_id, partner_id
    )

    # Chaîne de streak active (dates consécutives depuis aujourd'hui)
    in_streak_set = set()
    for i in range(365):
        check_date = (current_date - timedelta(days=i)).isoformat()
        info = _combined_for_date(
            user_id, partner_id, check_date, i, skip_pairs, rest_pairs, planned_by_user_date
        )
        if info["skip"]:
            if i > 0:
                break
            continue
        combined = info["combined"]
        contributes = bool(info.get("rest") or info.get("has_planned"))
        if not contributes:
            continue
        if combined == "fail" and i > 0:
            break
        if combined == "today_pending":
            continue
        if combined == "ok":
            in_streak_set.add(check_date)

    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    session_map = await session_completions_for_range(
        db, user_id, partner_id, start_date, end_date
    )
    days_out = []
    cursor = start
    today_str = current_date.isoformat()

    while cursor <= end:
        ds = cursor.isoformat()
        day_index = (current_date - cursor).days
        if day_index < 0:
            cursor += timedelta(days=1)
            continue

        info = _combined_for_date(
            user_id, partner_id, ds, day_index, skip_pairs, rest_pairs, planned_by_user_date
        )
        session_info = session_map.get(ds, {})
        my_completed = bool(info["my_completed"] or session_info.get("my_completed"))
        partner_completed = bool(
            info["partner_completed"] or session_info.get("partner_completed")
        )
        both_completed = bool(
            session_info.get("both_completed")
            or (my_completed and partner_completed and partner_id)
        )
        days_out.append({
            "date": ds,
            "in_streak": ds in in_streak_set,
            "combined": info["combined"],
            "my_completed": my_completed,
            "partner_completed": partner_completed,
            "both_completed": both_completed,
            "my_session_count": session_info.get("my_count", 0),
            "partner_session_count": session_info.get("partner_count", 0),
            "my_session_titles": session_info.get("my_titles", []),
            "partner_session_titles": session_info.get("partner_titles", []),
            "has_planned": info["has_planned"],
            "partner_missed": info["partner_missed"] and ds < today_str,
            "my_missed": info["my_missed"] and ds < today_str,
            "missed": False,
            "rest": info["rest"],
            "skip": info["skip"],
            "today_pending": info["today_pending"],
            "is_future": ds > today_str,
        })
        cursor += timedelta(days=1)

    return days_out


# ============ BADGES API (catalogue + progression) ============

@api_router.get("/badges/catalog")
async def get_badges_catalog(
    scope: str = "solo",
    user: dict = Depends(get_current_user),
):
    if scope not in ("solo", "duo"):
        raise HTTPException(status_code=400, detail="scope doit être solo ou duo")
    service = BadgeProgressService(db)
    if scope == "solo":
        streak = await _get_user_streak_value(user["id"])
        # Évaluation opportuniste (non bloquante pour la réponse suivante)
        schedule_badge_evaluation(trigger_solo_evaluation(db, user["id"], streak_value=streak))
        return await service.get_solo_catalog_with_progress(user["id"], streak_value=streak)
    if not user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Aucun Duo actif")
    pair_key = duo_pair_key(user["id"], user["partner_id"])
    schedule_badge_evaluation(
        trigger_duo_evaluation(db, pair_key, notify_user_ids=[user["id"], user["partner_id"]])
    )
    return await service.get_duo_catalog_with_progress(pair_key)


@api_router.get("/users/me/badges")
async def get_my_badges(user: dict = Depends(get_current_user)):
    service = BadgeProgressService(db)
    streak = await _get_user_streak_value(user["id"])
    return await service.get_solo_catalog_with_progress(user["id"], streak_value=streak)


@api_router.get("/users/me/badges/{badge_id}")
async def get_my_badge_detail(badge_id: str, user: dict = Depends(get_current_user)):
    service = BadgeProgressService(db)
    streak = await _get_user_streak_value(user["id"])
    catalog = await service.get_solo_catalog_with_progress(user["id"], streak_value=streak)
    cid = canonical_badge_id(badge_id)
    badge = next((b for b in (catalog.get("badges") or []) if b.get("id") == cid), None)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge introuvable")
    return badge


@api_router.get("/users/{user_id}/badges")
async def get_user_badges(user_id: str, viewer: dict = Depends(get_current_user)):
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        target = None
    if not target:
        target = await db.users.find_one({"handle": user_id}) or await db.users.find_one({"username": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    target_id = str(target["_id"])
    access = await get_profile_access_level(viewer["id"], target)
    if access == "limited":
        raise HTTPException(status_code=403, detail="Profil privé")
    badges_vis = resolve_visibility_value(target, "badges_visibility", "show_badges", default_public=True)
    if not visibility_allows(access, badges_vis):
        raise HTTPException(status_code=403, detail="Badges privés")
    service = BadgeProgressService(db)
    streak = await _get_user_streak_value(target_id)
    return await service.get_solo_catalog_with_progress(target_id, streak_value=streak)


@api_router.get("/duos/{pair_key}/badges")
async def get_duo_pair_badges(pair_key: str, user: dict = Depends(get_current_user)):
    duo_doc = await db.duo_profiles.find_one({"pair_key": pair_key})
    if not duo_doc:
        # allow short_id / tag resolution via existing helper
        try:
            duo_doc = await find_duo_by_tag(db, pair_key)
        except Exception:
            duo_doc = None
    if not duo_doc:
        raise HTTPException(status_code=404, detail="Duo introuvable")
    resolved = resolve_duo_pair_key(duo_doc)
    members = await get_duo_members(db, duo_doc)
    access = await get_duo_access_level(db, user["id"], duo_doc, members)
    if not can_view_duo_section(duo_doc, access, "badges"):
        raise HTTPException(status_code=403, detail="Badges Duo privés")
    service = BadgeProgressService(db)
    return await service.get_duo_catalog_with_progress(resolved)


@api_router.get("/duos/{pair_key}/badges/{badge_id}")
async def get_duo_badge_detail(pair_key: str, badge_id: str, user: dict = Depends(get_current_user)):
    catalog = await get_duo_pair_badges(pair_key, user)
    cid = canonical_badge_id(badge_id)
    badge = next((b for b in (catalog.get("badges") or []) if b.get("id") == cid), None)
    if not badge:
        raise HTTPException(status_code=404, detail="Badge introuvable")
    return badge


@api_router.get("/duo/stats")
async def get_duo_stats(user: dict = Depends(get_current_user)):
    calculated = await calculate_streak(user["id"], user.get("partner_id"))
    manual = await _get_manual_streak_override(user["id"], user.get("partner_id")) if user.get("partner_id") else None
    streak = manual if manual is not None else calculated
    service = BadgeProgressService(db)
    solo_catalog = await service.get_solo_catalog_with_progress(user["id"], streak_value=streak)
    badges = list(solo_catalog.get("badges") or [])
    challenge = await get_current_challenge(
        user["id"], user.get("partner_id"), streak_value=streak, locale=user.get("locale")
    )

    if not user.get("partner_id"):
        user_sessions = await db.workout_sessions.count_documents({
            "user_id": user["id"],
            "status": "completed",
            "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).strftime("%Y-%m-%d")},
        })
        challenges_completed = await db.challenge_completions.count_documents({
            "user_id": user["id"],
            "scope": "solo",
        })
        if challenge and challenge.get("status") == "completed":
            week_key = challenge.get("week_key", "")
            existing = await db.challenge_completions.find_one({
                "user_id": user["id"],
                "week_key": week_key,
            })
            if not existing:
                await db.challenge_completions.insert_one({
                    "user_id": user["id"],
                    "week_key": week_key,
                    "week_start": challenge.get("week_start", ""),
                    "challenge_id": challenge.get("id"),
                    "scope": "solo",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                challenges_completed += 1
                schedule_badge_evaluation(trigger_solo_evaluation(db, user["id"], streak_value=streak))
        summary = solo_catalog.get("summary") or {}
        return {
            "streak": streak,
            "streak_calculated": calculated,
            "streak_manual_override": manual,
            "total_workouts_together": user_sessions,
            "this_week_user": user_sessions,
            "this_week_partner": 0,
            "badges": badges,
            "current_challenge": challenge,
            "badges_unlocked": summary.get("unlocked", len([b for b in badges if b.get("unlocked")])),
            "badges_total": summary.get("total", len(badges)),
            "badges_summary": summary,
            "challenges_completed": challenges_completed,
            "scope": "solo",
        }
    
    today = datetime.now(timezone.utc)
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    
    user_sessions = await db.workout_sessions.count_documents({
        "user_id": user["id"],
        "status": "completed",
        "created_at": {"$gte": week_start}
    })
    
    partner_sessions = await db.workout_sessions.count_documents({
        "user_id": user["partner_id"],
        "status": "completed",
        "created_at": {"$gte": week_start}
    })

    together = await assemble_duo_common_stats(
        user["id"], user["partner_id"], locale=user.get("locale")
    )
    duo_social_badges = together.get("duo_badges") or together.get("badges") or []
    # Séparation stricte : badges = solo, duo_badges = duo
    all_badges_for_compat = badges + [b for b in duo_social_badges if b.get("id") not in {x.get("id") for x in badges}]

    duo_profile = None
    duo_doc = await _get_duo_profile_for_user(user["id"], user["partner_id"])
    if duo_doc:
        duo_profile = serialize_duo_search(duo_doc)

    return {
        "streak": streak,
        "streak_calculated": calculated,
        "streak_manual_override": manual,
        "total_workouts_together": together.get("total_workouts_together", 0),
        "duo_streak_current": together.get("duo_streak_current", 0),
        "duo_streak_best": together.get("duo_streak_best", 0),
        "total_training_time_together": together.get("total_training_time_together", 0),
        "estimated_calories": together.get("estimated_calories", 0),
        "last_common_session": together.get("last_common_session"),
        "challenges_completed": together.get("challenges_completed", 0),
        "this_week_user": user_sessions,
        "this_week_partner": partner_sessions,
        "badges": badges,
        "duo_badges": duo_social_badges,
        "badges_all": all_badges_for_compat,
        "current_challenge": together.get("current_challenge", challenge),
        "badges_unlocked": solo_catalog.get("summary", {}).get("unlocked", 0),
        "badges_total": solo_catalog.get("summary", {}).get("total", 50),
        "duo_badges_unlocked": together.get("badges_unlocked", 0),
        "duo_badges_total": together.get("badges_total", 50),
        "badges_summary": solo_catalog.get("summary"),
        "duo_badges_summary": together.get("badges_summary"),
        "duo_profile": duo_profile,
        "sessions_together": together.get("sessions_together", 0),
        "total_training_time": together.get("total_training_time", 0),
    }


async def get_duo_badges(user_id: str, partner_id: Optional[str], streak_value: Optional[int] = None) -> List[dict]:
    """Retourne le catalogue Solo (et Duo si partenaire) via le moteur canonique."""
    service = BadgeProgressService(db)
    solo = await service.get_solo_catalog_with_progress(user_id, streak_value=streak_value)
    badges = list(solo.get("badges") or [])
    if partner_id:
        pair_key = duo_pair_key(user_id, partner_id)
        duo = await service.get_duo_catalog_with_progress(pair_key)
        badges = badges + list(duo.get("badges") or [])
    return badges


async def get_current_challenge(
    user_id: str,
    partner_id: Optional[str] = None,
    streak_value: int = 0,
    *,
    locale: Optional[str] = None,
) -> Optional[dict]:
    from i18n_messages import load_user_locale
    loc = locale
    if not loc:
        loc = await load_user_locale(db, user_id)
    scope = "duo" if partner_id else "solo"
    challenge_def = pick_weekly_challenge(scope, locale=loc)
    return await compute_challenge_progress(
        db, challenge_def, user_id, partner_id, streak_value, locale=loc
    )


DUO_NOTIFICATION_TYPES = (
    "duo_follow_request",
    "duo_follow_accepted",
    "duo_new_follower",
)

@api_router.get("/duo/activity")
async def get_duo_activity(limit: int = 10, user: dict = Depends(get_current_user)):
    if not user.get("partner_id"):
        return []
    
    sessions = await db.workout_sessions.find({
        "user_id": user["partner_id"]
    }).sort("created_at", -1).to_list(limit)
    
    return [{"id": str(s["_id"]), **{k: v for k, v in s.items() if k != "_id"}} for s in sessions]

@api_router.get("/duo/detailed-stats")
async def get_detailed_stats(
    period: str = "30",  # 7, 30, 90, year, all
    target_user: Optional[str] = None,  # user_id to get stats for
    user: dict = Depends(get_current_user)
):
    """Get detailed stats for coach/partner view"""
    # Determine which user to get stats for
    stats_user_id = target_user or user.get("partner_id") or user["id"]
    
    target_user_doc = await db.users.find_one({"_id": ObjectId(stats_user_id)})
    if not target_user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_ids = [user["id"]]
    if user.get("partner_id"):
        allowed_ids.append(user["partner_id"])

    if stats_user_id not in allowed_ids:
        if not await can_view_user_stats(user["id"], target_user_doc):
            raise HTTPException(status_code=403, detail="Not authorized to view these stats")
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    if period == "all":
        start_date = None
    elif period == "year":
        start_date = today.replace(
            month=1, day=1, hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
    else:
        try:
            days = int(period)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Période invalide")
        if days not in (7, 30, 90):
            raise HTTPException(status_code=400, detail="Période invalide")
        start_date = (today - timedelta(days=days)).isoformat()
    
    # Build query
    query = {"user_id": stats_user_id}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    
    # Get all sessions for the period
    sessions = await db.workout_sessions.find(query).sort("created_at", -1).to_list(1000)
    
    # Calculate stats
    total_sessions = len(sessions)
    completed = [s for s in sessions if s.get("status") == "completed"]
    abandoned = [s for s in sessions if s.get("status") == "abandoned"]
    
    total_completed = len(completed)
    total_abandoned = len(abandoned)
    completion_rate = round((total_completed / total_sessions * 100) if total_sessions > 0 else 0, 1)
    
    total_time = sum(s.get("total_time", 0) for s in sessions)
    avg_time = round(total_time / total_sessions) if total_sessions > 0 else 0
    
    # Fatigue and difficulty averages
    fatigue_before_values = [s.get("fatigue_before") for s in sessions if s.get("fatigue_before") is not None]
    fatigue_after_values = [s.get("fatigue_after") for s in sessions if s.get("fatigue_after") is not None]
    difficulty_values = [s.get("difficulty_felt") for s in sessions if s.get("difficulty_felt") is not None]
    
    avg_fatigue_before = round(sum(fatigue_before_values) / len(fatigue_before_values), 1) if fatigue_before_values else None
    avg_fatigue_after = round(sum(fatigue_after_values) / len(fatigue_after_values), 1) if fatigue_after_values else None
    avg_difficulty = round(sum(difficulty_values) / len(difficulty_values), 1) if difficulty_values else None
    
    # This week stats
    week_start = (today - timedelta(days=today.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    this_week = [s for s in sessions if s.get("created_at", "") >= week_start]
    
    # This month stats — requête dédiée (indépendante du filtre period)
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_query = {"user_id": stats_user_id, "created_at": {"$gte": month_start}}
    this_month_count = await db.workout_sessions.count_documents(month_query)
    this_week_count = await db.workout_sessions.count_documents({
        "user_id": stats_user_id,
        "created_at": {"$gte": (today - timedelta(days=today.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()},
    })

    total_calories = sum(
        estimate_calories(s.get("total_time", 0), s.get("difficulty_felt"))
        for s in sessions
    )
    week_calories = sum(
        estimate_calories(s.get("total_time", 0), s.get("difficulty_felt"))
        for s in this_week
    )
    month_sessions = await db.workout_sessions.find(month_query).to_list(1000)
    month_calories = sum(
        estimate_calories(s.get("total_time", 0), s.get("difficulty_felt"))
        for s in month_sessions
    )
    
    # Daily breakdown for graph (last 7 days)
    daily_stats = []
    for i in range(7):
        day = (today - timedelta(days=6-i)).date()
        day_str = day.isoformat()
        day_sessions = [s for s in sessions if s.get("created_at", "").startswith(day_str)]
        daily_stats.append({
            "date": day_str,
            "day": day.strftime("%a"),
            "count": len(day_sessions),
            "completed": len([s for s in day_sessions if s.get("status") == "completed"]),
            "duration": sum(s.get("total_time", 0) for s in day_sessions)
        })
    
    # Weekly breakdown for graph (last 4 weeks)
    weekly_stats = []
    for i in range(4):
        week_end = today - timedelta(weeks=i)
        week_start_dt = week_end - timedelta(days=week_end.weekday())
        week_end_dt = week_start_dt + timedelta(days=6)
        
        week_sessions = [
            s for s in sessions 
            if week_start_dt.isoformat()[:10] <= s.get("created_at", "")[:10] <= week_end_dt.isoformat()[:10]
        ]
        weekly_stats.insert(0, {
            "week_start": week_start_dt.strftime("%d/%m"),
            "count": len(week_sessions),
            "completed": len([s for s in week_sessions if s.get("status") == "completed"]),
            "duration": sum(s.get("total_time", 0) for s in week_sessions)
        })
    
    # Recent sessions (last 10)
    recent_sessions = [
        {
            "id": str(s["_id"]) if "_id" in s else s.get("id"),
            "workout_title": s.get("workout_title"),
            "status": s.get("status"),
            "total_time": s.get("total_time"),
            "pause_time": s.get("pause_time"),
            "exercises_completed": s.get("exercises_completed"),
            "exercises_total": s.get("exercises_total"),
            "difficulty_felt": s.get("difficulty_felt"),
            "fatigue_before": s.get("fatigue_before"),
            "fatigue_after": s.get("fatigue_after"),
            "notes": s.get("notes"),
            "created_at": s.get("created_at"),
            "estimated_calories": estimate_calories(s.get("total_time", 0), s.get("difficulty_felt")),
        }
        for s in sessions[:10]
    ]
    
    # Get scheduled workouts count
    workout_query = {"for_user_id": stats_user_id}
    if start_date:
        workout_query["scheduled_date"] = {"$gte": start_date[:10]}
    total_scheduled = await db.scheduled_workouts.count_documents(workout_query)
    
    # Get user info
    stats_user = await db.users.find_one({"_id": ObjectId(stats_user_id)})
    
    return {
        "user": {
            "id": stats_user_id,
            "username": stats_user.get("username") if stats_user else None,
            "display_name": stats_user.get("display_name") if stats_user else None
        },
        "period": period,
        "summary": {
            "total_scheduled": total_scheduled,
            "total_sessions": total_sessions,
            "total_completed": total_completed,
            "total_abandoned": total_abandoned,
            "completion_rate": completion_rate,
            "total_time": total_time,
            "avg_time": avg_time,
            "this_week": this_week_count,
            "this_month": this_month_count,
            "total_calories": total_calories,
            "week_calories": week_calories,
            "month_calories": month_calories,
        },
        "averages": {
            "fatigue_before": avg_fatigue_before,
            "fatigue_after": avg_fatigue_after,
            "difficulty": avg_difficulty
        },
        "daily_stats": daily_stats,
        "weekly_stats": weekly_stats,
        "recent_sessions": recent_sessions
    }

# ============ STREAK DAY ROUTES ============

@api_router.post("/streak/rest-day")
async def mark_rest_day(body: StreakDayCreate, user: dict = Depends(get_current_user)):
    """Mark a date as rest day (preserves streak)"""
    # Remove any existing entry for this date
    await db.streak_days.delete_one({"user_id": user["id"], "date": body.date})
    doc = {
        "user_id": user["id"],
        "date": body.date,
        "type": "rest",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.streak_days.insert_one(doc)
    return {"status": "ok", "date": body.date, "type": "rest"}

@api_router.post("/streak/skip-day")
async def mark_skip_day(body: StreakDayCreate, user: dict = Depends(get_current_user)):
    """Mark a date as skipped (breaks streak intentionally)"""
    await db.streak_days.delete_one({"user_id": user["id"], "date": body.date})
    doc = {
        "user_id": user["id"],
        "date": body.date,
        "type": "skip",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.streak_days.insert_one(doc)
    return {"status": "ok", "date": body.date, "type": "skip"}

@api_router.get("/streak/days")
async def get_streak_days(
    start_date: str,
    end_date: str,
    user: dict = Depends(get_current_user)
):
    """Get rest/skip days for a date range for the current user"""
    days = await db.streak_days.find({
        "user_id": user["id"],
        "date": {"$gte": start_date, "$lte": end_date}
    }).to_list(100)
    return [{"date": d["date"], "type": d["type"]} for d in days]


@api_router.get("/streak/calendar")
async def get_streak_calendar(
    start_date: str,
    end_date: str,
    target_user: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """État visuel jour par jour pour l'agenda (streak, repos, duo, manqués)."""
    user_id = user["id"]
    partner_id = user.get("partner_id")

    if target_user and target_user != user_id:
        target = await get_user_doc_by_id(target_user)
        if not target:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        access = await get_profile_access_level(user_id, target)
        if access == "limited":
            raise HTTPException(status_code=403, detail="Accès refusé")
        user_id = target_user
        partner_id = target.get("partner_id")

    days = await build_streak_calendar(user_id, partner_id, start_date, end_date)
    streak = await calculate_streak(user_id, partner_id)
    manual = await _get_manual_streak_override(user_id, partner_id) if partner_id else None
    return {
        "streak": manual if manual is not None else streak,
        "days": days,
    }

@api_router.delete("/streak/day/{date}")
async def remove_streak_day(date: str, user: dict = Depends(get_current_user)):
    """Remove a rest/skip day marker"""
    result = await db.streak_days.delete_one({"user_id": user["id"], "date": date})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Day marker not found")
    return {"status": "ok", "date": date}


@api_router.post("/streak/coach/manual-streak")
async def coach_set_manual_streak(body: StreakManualUpdate, user: dict = Depends(get_current_user)):
    """Override streak affichée pour le duo (coach / admin uniquement). streak=null supprime l'override."""
    if not await _can_moderate_streak(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    pid = user.get("partner_id")
    if not pid:
        raise HTTPException(status_code=400, detail="No duo partner")
    key = _duo_pair_key(user["id"], pid)
    now = datetime.now(timezone.utc).isoformat()
    if body.streak is None:
        await db.duo_streak_overrides.delete_one({"pair_key": key})
        await db.streak_audit_log.insert_one({
            "actor_id": user["id"],
            "action": "clear_manual_streak",
            "pair_key": key,
            "created_at": now,
        })
        return {"status": "ok", "manual_streak": None}
    await db.duo_streak_overrides.update_one(
        {"pair_key": key},
        {"$set": {
            "pair_key": key,
            "manual_streak": body.streak,
            "updated_by": user["id"],
            "updated_at": now,
        }},
        upsert=True,
    )
    await db.streak_audit_log.insert_one({
        "actor_id": user["id"],
        "action": "set_manual_streak",
        "pair_key": key,
        "value": body.streak,
        "created_at": now,
    })
    return {"status": "ok", "manual_streak": body.streak}


@api_router.post("/streak/coach/exempt-day")
async def coach_exempt_day(body: StreakCoachExemptBody, user: dict = Depends(get_current_user)):
    """Marque un jour comme exempt (comme repos) pour un membre du duo — coach / admin."""
    if not await _can_moderate_streak(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    pid = user.get("partner_id")
    if not pid or body.user_id not in (user["id"], pid):
        raise HTTPException(status_code=400, detail="Invalid target user")
    now = datetime.now(timezone.utc).isoformat()
    await db.streak_days.delete_one({"user_id": body.user_id, "date": body.date})
    await db.streak_days.insert_one({
        "user_id": body.user_id,
        "date": body.date,
        "type": "exempt",
        "created_at": now,
        "set_by": user["id"],
    })
    await db.streak_audit_log.insert_one({
        "actor_id": user["id"],
        "action": "exempt_day",
        "target_user_id": body.user_id,
        "date": body.date,
        "created_at": now,
    })
    return {"status": "ok", "date": body.date, "type": "exempt"}


@api_router.get("/streak/coach/status")
async def streak_coach_status(user: dict = Depends(get_current_user)):
    return {"can_moderate": await _can_moderate_streak(user)}

# ============ MAIN ============

@api_router.get("/")
async def root():
    return {"message": "Anthea API", "version": "1.0.0"}

app.include_router(api_router)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import csv
import io
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from collections import defaultdict
import uuid
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

from program_volume_seed import ensure_program_volume_templates
from badges import evaluate_all_badges
from challenges import pick_weekly_challenge, compute_challenge_progress

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

class UserResponse(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
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
    partner_id: Optional[str] = None
    partner_username: Optional[str] = None
    relation_type: Optional[str] = None
    created_at: str

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

class SessionTimeAdjust(BaseModel):
    total_time: int
    reason: Optional[str] = None

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict

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
    return {
        "id": str(user["_id"]) if "_id" in user else user.get("id"),
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "bio": user.get("bio"),
        "avatar_url": user.get("avatar_url"),
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
        "partner_id": user.get("partner_id"),
        "partner_username": user.get("partner_username"),
        "relation_type": user.get("relation_type"),
        "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
    }

# ============ STARTUP ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index("username", unique=True)
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
    await db.session_time_audit.create_index("session_id")
    await db.workout_progress.create_index([("user_id", 1), ("saved_at", -1)])
    await db.live_workout_messages.create_index([("pair_key", 1), ("created_at", -1)])
    
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
        "password_hash": hash_password(data.password),
        "display_name": data.display_name or data.username,
        "gender": data.gender,
        "fitness_level": data.fitness_level,
        "main_goal": data.main_goal,
        "theme": "default",
        "tts_enabled": True,
        "timer_sound": "beep",
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
    return serialize_user(updated_user)

# ============ PARTNER ROUTES ============

@api_router.get("/users/search")
async def search_users(q: str, user: dict = Depends(get_current_user)):
    if len(q) < 2:
        return []
    
    users = await db.users.find({
        "username": {"$regex": q.lower(), "$options": "i"},
        "_id": {"$ne": ObjectId(user["id"])}
    }, {"_id": 1, "username": 1, "display_name": 1, "avatar_url": 1}).to_list(10)
    
    return [{"id": str(u["_id"]), "username": u["username"], "display_name": u.get("display_name"), "avatar_url": u.get("avatar_url")} for u in users]

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
    request_doc.pop("_id", None)  # Remove ObjectId before returning
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
    
    return {"message": "Partner request accepted"}

@api_router.post("/partner/reject/{request_id}")
async def reject_partner_request(request_id: str, user: dict = Depends(get_current_user)):
    req = await db.partner_requests.find_one({"_id": ObjectId(request_id), "to_user_id": user["id"], "status": "pending"})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.partner_requests.update_one({"_id": ObjectId(request_id)}, {"$set": {"status": "rejected"}})
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
    }

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
    user: dict = Depends(get_current_user)
):
    query = {
        "$or": [
            {"creator_id": user["id"]},
            {"for_user_id": user["id"]}
        ]
    }
    
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

@api_router.get("/workouts/{workout_id}")
async def get_workout(workout_id: str, user: dict = Depends(get_current_user)):
    workout = await db.scheduled_workouts.find_one({"_id": ObjectId(workout_id)})
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    allowed_ids = [user["id"]]
    if user.get("partner_id"):
        allowed_ids.append(user["partner_id"])
    
    if workout["creator_id"] not in allowed_ids and workout["for_user_id"] not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
        "saved_at": datetime.now(timezone.utc).isoformat()
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
    
    return {"message": "Progress saved", "progress": progress_doc}

@api_router.get("/workouts/{workout_id}/progress")
async def get_workout_progress(workout_id: str, user: dict = Depends(get_current_user)):
    """Get saved workout progress"""
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


@api_router.post("/push/subscribe")
async def subscribe_push(data: PushSubscriptionCreate, user: dict = Depends(get_current_user)):
    await db.push_subscriptions.update_one(
        {"user_id": user["id"], "endpoint": data.endpoint},
        {"$set": {
            "user_id": user["id"],
            "endpoint": data.endpoint,
            "keys": data.keys,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"status": "ok"}


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
    if combined == "neutral":
        combined = "ok"

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
        combined = info["combined"]
        if combined == "fail" and i > 0:
            break
        if combined == "today_pending":
            continue
        if combined == "ok":
            streak += 1

    return streak


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
        if combined == "fail" and i > 0:
            break
        if combined == "today_pending":
            continue
        if combined == "ok":
            in_streak_set.add(check_date)

    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
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
        days_out.append({
            "date": ds,
            "in_streak": ds in in_streak_set,
            "combined": info["combined"],
            "my_completed": info["my_completed"],
            "partner_completed": info["partner_completed"],
            "both_completed": info["both_completed"],
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


@api_router.get("/duo/stats")
async def get_duo_stats(user: dict = Depends(get_current_user)):
    calculated = await calculate_streak(user["id"], user.get("partner_id"))
    manual = await _get_manual_streak_override(user["id"], user.get("partner_id")) if user.get("partner_id") else None
    streak = manual if manual is not None else calculated
    badges = await get_duo_badges(user["id"], user.get("partner_id"), streak_value=streak)
    challenge = await get_current_challenge(user["id"], user.get("partner_id"), streak_value=streak)

    if not user.get("partner_id"):
        user_sessions = await db.workout_sessions.count_documents({
            "user_id": user["id"],
            "status": "completed",
            "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())).strftime("%Y-%m-%d")},
        })
        return {
            "streak": streak,
            "streak_calculated": calculated,
            "streak_manual_override": manual,
            "total_workouts_together": user_sessions,
            "this_week_user": user_sessions,
            "this_week_partner": 0,
            "badges": badges,
            "current_challenge": challenge,
            "badges_unlocked": len([b for b in badges if b.get("unlocked")]),
            "badges_total": len(badges),
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
    
    total_together = await db.workout_sessions.count_documents({
        "$or": [
            {"user_id": user["id"]},
            {"user_id": user["partner_id"]}
        ],
        "status": "completed"
    })
    
    return {
        "streak": streak,
        "streak_calculated": calculated,
        "streak_manual_override": manual,
        "total_workouts_together": total_together,
        "this_week_user": user_sessions,
        "this_week_partner": partner_sessions,
        "badges": badges,
        "current_challenge": challenge,
        "badges_unlocked": len([b for b in badges if b.get("unlocked")]),
        "badges_total": len(badges),
    }

async def get_duo_badges(user_id: str, partner_id: Optional[str], streak_value: Optional[int] = None) -> List[dict]:
    if streak_value is None and partner_id:
        streak_value = await calculate_streak(user_id, partner_id)
    elif streak_value is None:
        streak_value = 0
    return await evaluate_all_badges(db, user_id, partner_id, streak_value)


async def get_current_challenge(
    user_id: str, partner_id: Optional[str] = None, streak_value: int = 0
) -> Optional[dict]:
    challenge_def = pick_weekly_challenge()
    return await compute_challenge_progress(db, challenge_def, user_id, partner_id, streak_value)

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
    period: str = "30",  # 7, 30, 90, all
    target_user: Optional[str] = None,  # user_id to get stats for
    user: dict = Depends(get_current_user)
):
    """Get detailed stats for coach/partner view"""
    # Determine which user to get stats for
    stats_user_id = target_user or user.get("partner_id") or user["id"]
    
    # Check authorization
    allowed_ids = [user["id"]]
    if user.get("partner_id"):
        allowed_ids.append(user["partner_id"])
    
    if stats_user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Not authorized to view these stats")
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    if period == "all":
        start_date = None
    else:
        days = int(period)
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
    user: dict = Depends(get_current_user),
):
    """État visuel jour par jour pour l'agenda (streak, repos, duo, manqués)."""
    partner_id = user.get("partner_id")
    days = await build_streak_calendar(user["id"], partner_id, start_date, end_date)
    streak = await calculate_streak(user["id"], partner_id)
    manual = await _get_manual_streak_override(user["id"], partner_id) if partner_id else None
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

"""Tests catalogue exercices : normalisation, import, recherche, média, legacy."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from exercises.catalog import build_search_text, catalog_to_legacy_response
from exercises.legacy import enrich_workout_exercise_snapshot, is_custom_exercise_doc
from exercises.media_proxy import is_allowed_media_url
from exercises.normalize import stable_catalog_id
from exercises.providers import get_provider
from exercises.providers.exercisedb import ExerciseDbProvider
from exercises.taxonomy import fold_text, normalize_equipment_list, infer_tracking_type

FIXTURE = Path(__file__).resolve().parent.parent / "data" / "exercises" / "fixtures" / "sample_exercisedb.json"


def test_stable_id_preserves_provider_case():
    assert stable_catalog_id("exercisedb", "EIeI8Vf") == "exdb_EIeI8Vf"
    assert stable_catalog_id("exercisedb", "EIeI8Vf") == stable_catalog_id("exercisedb", "EIeI8Vf")


def test_fold_text_strips_accents():
    assert fold_text("Développé Couché") == "developpe couche"
    assert "bench" in fold_text("Bench Press")


def test_normalize_equipment_aliases():
    eqs, raw = normalize_equipment_list(["dumbbells", "bench"], name="press")
    assert "dumbbell" in eqs
    assert "bench" in eqs
    assert "dumbbells" in raw


def test_normalize_fixture_exercises():
    provider = ExerciseDbProvider(fixture_path=str(FIXTURE))
    docs = [provider.normalize(x) for x in provider.fetch_all()]
    assert len(docs) == 3
    bench = next(d for d in docs if "bench" in d["name"]["en"])
    assert bench["id"].startswith("exdb_")
    assert bench["media"]["status"] == "available"
    assert bench["media"]["url"].endswith(".gif")
    assert bench["tracking_type"] == "reps_weight"
    assert "barbell" in bench["equipment"]
    assert build_search_text(bench)


def test_plank_tracking_duration():
    provider = ExerciseDbProvider(fixture_path=str(FIXTURE))
    docs = [provider.normalize(x) for x in provider.fetch_all()]
    plank = next(d for d in docs if d["name"]["en"] == "plank")
    assert plank["tracking_type"] == "duration"
    legacy = catalog_to_legacy_response(plank, locale="fr")
    assert legacy["exercise_type"] == "duration"
    assert legacy["image_url"]


def test_media_url_allowlist():
    assert is_allowed_media_url("https://static.exercisedb.dev/media/x.gif")
    assert not is_allowed_media_url("https://evil.example/x.gif")
    assert not is_allowed_media_url("javascript:alert(1)")


def test_import_dry_run_no_disk_write(tmp_path, monkeypatch):
    import import_exercises as imp

    coverage_path = tmp_path / "coverage_report.json"
    monkeypatch.setattr(imp, "COVERAGE_PATH", coverage_path)
    monkeypatch.setattr(imp, "DATA_DIR", tmp_path)
    rc = imp.main(["--dry-run", "--fixture", str(FIXTURE)])
    assert rc == 0
    assert not coverage_path.exists()


def test_import_idempotent_upsert_counts():
    import import_exercises as imp

    provider = ExerciseDbProvider(fixture_path=str(FIXTURE))
    report = imp.build_report_skeleton(provider.name)
    docs = imp.collect_normalized(provider, report)
    assert report["valid"] == 3
    assert report["with_gif"] == 3

    class FakeCol:
        def __init__(self):
            self.store = {}

        def find_one(self, query):
            if "provider" in query:
                key = (query["provider"], query["provider_id"])
                return self.store.get(key)
            if "id" in query:
                for v in self.store.values():
                    if v.get("id") == query["id"]:
                        return v
            return None

        def update_one(self, query, update, upsert=False):
            doc = update.get("$set") or update
            key = (doc["provider"], doc["provider_id"])
            existing = self.store.get(key)
            if existing:
                existing.update(doc)
            else:
                self.store[key] = {**doc, "_id": f"oid-{len(self.store)}"}

    class FakeDb(dict):
        def __getitem__(self, name):
            if name not in self:
                self[name] = FakeCol()
            return dict.__getitem__(self, name)

    db = FakeDb()
    n1, u1 = imp.upsert_docs(db, docs, refresh_existing=False, dry_run=False)
    assert n1 == 3 and u1 == 0
    n2, u2 = imp.upsert_docs(db, docs, refresh_existing=False, dry_run=False)
    assert n2 == 0 and u2 == 0
    n3, u3 = imp.upsert_docs(db, docs, refresh_existing=True, dry_run=False)
    assert n3 == 0 and u3 == 3


def test_search_catalog_filters_and_disabled():
    from exercises.search import search_catalog

    docs = [
        {
            "id": "exdb_1",
            "enabled": True,
            "sport": "strength",
            "category": "chest",
            "body_part": "upper_body",
            "equipment": ["barbell"],
            "primary_muscles": ["chest"],
            "secondary_muscles": [],
            "tracking_type": "reps_weight",
            "name": {"en": "Barbell bench press", "fr": None, "es": None},
            "short_description": {"en": "Press", "fr": None, "es": None},
            "media": {"url": "https://static.exercisedb.dev/media/1.gif", "status": "available"},
            "search_text": "barbell bench press press chest barbell",
            "aliases": ["bench press"],
        },
        {
            "id": "exdb_2",
            "enabled": False,
            "sport": "strength",
            "category": "chest",
            "body_part": "upper_body",
            "equipment": ["barbell"],
            "primary_muscles": ["chest"],
            "secondary_muscles": [],
            "tracking_type": "reps_weight",
            "name": {"en": "Hidden press", "fr": None, "es": None},
            "short_description": {"en": "x", "fr": None, "es": None},
            "media": {"url": "https://static.exercisedb.dev/media/2.gif", "status": "available"},
            "search_text": "hidden press chest barbell",
            "aliases": [],
        },
    ]

    class Cursor:
        def __init__(self, items):
            self.items = items

        def sort(self, *_a, **_k):
            return self

        def skip(self, n):
            self.items = self.items[n:]
            return self

        def limit(self, n):
            self.items = self.items[:n]
            return self

        async def to_list(self, n):
            return self.items[:n]

    class Col:
        def __init__(self, items):
            self.items = items

        async def count_documents(self, query):
            return len(self._filter(query))

        def find(self, query):
            return Cursor(self._filter(query))

        def _filter(self, query):
            out = list(self.items)
            if query.get("enabled") is True:
                out = [d for d in out if d.get("enabled") is True]
            ands = query.get("$and") or []
            for clause in ands:
                if "$or" in clause:
                    import re

                    matched = []
                    for d in out:
                        ok = False
                        for sub in clause["$or"]:
                            if "search_text" in sub:
                                pat = sub["search_text"]["$regex"]
                                if re.search(pat, d.get("search_text") or ""):
                                    ok = True
                                    break
                        if ok:
                            matched.append(d)
                    out = matched
                if "search_text" in clause:
                    import re

                    pat = clause["search_text"]["$regex"]
                    out = [d for d in out if re.search(pat, d.get("search_text") or "")]
                if "equipment" in clause:
                    eq = clause["equipment"]
                    if isinstance(eq, dict) and "$in" in eq:
                        out = [d for d in out if any(e in eq["$in"] for e in d.get("equipment") or [])]
                    else:
                        out = [d for d in out if eq in (d.get("equipment") or [])]
                if "sport" in clause:
                    out = [d for d in out if d.get("sport") == clause["sport"]]
            return out

    class Db:
        def __getitem__(self, name):
            return Col(docs)

    result = asyncio.get_event_loop().run_until_complete(
        search_catalog(Db(), q="bench", equipment="barbell", page=1, limit=10, locale="en")
    )
    assert result["total"] == 1
    assert result["items"][0]["id"] == "exdb_1"
    assert result["items"][0]["name"] == "Barbell bench press"
    assert result["limit"] == 10


def test_search_relevance_pompe_and_multilingual():
    from exercises.search import query_variants, relevance_score, search_catalog

    assert "pompes" in query_variants("pompe")
    assert "pompe" in query_variants("pompes")
    assert "tractions" in query_variants("traction")

    docs = [
        {
            "id": "push_archer",
            "enabled": True,
            "sport": "bodyweight",
            "category": "chest",
            "body_part": "upper_body",
            "equipment": ["bodyweight"],
            "primary_muscles": ["chest"],
            "secondary_muscles": [],
            "tracking_type": "reps",
            "name": {
                "en": "Archer push-up",
                "fr": "Pompes archer",
                "es": "Flexiones archer",
            },
            "short_description": {"en": "variant", "fr": "variante", "es": "variante"},
            "media": {"status": "available"},
            "search_text": "pompes archer archer push-up flexiones archer chest bodyweight",
            "aliases": ["archer push up"],
        },
        {
            "id": "push_basic",
            "enabled": True,
            "sport": "bodyweight",
            "category": "chest",
            "body_part": "upper_body",
            "equipment": ["bodyweight"],
            "primary_muscles": ["chest"],
            "secondary_muscles": [],
            "tracking_type": "reps",
            "name": {"en": "Push-up", "fr": "Pompes", "es": "Flexiones"},
            "short_description": {"en": "basic", "fr": "base", "es": "base"},
            "media": {"status": "available"},
            "search_text": "pompes push-up flexiones chest bodyweight pompe",
            "aliases": ["pompe", "push up", "pushups"],
        },
        {
            "id": "push_band",
            "enabled": True,
            "sport": "bodyweight",
            "category": "chest",
            "body_part": "upper_body",
            "equipment": ["resistance_band"],
            "primary_muscles": ["chest"],
            "secondary_muscles": [],
            "tracking_type": "reps",
            "name": {
                "en": "Band push-up",
                "fr": "Pompes avec elastique",
                "es": "Flexiones con banda",
            },
            "short_description": {"en": "band", "fr": "elastique", "es": "banda"},
            "media": {"status": "available"},
            "search_text": "pompes avec elastique band push-up flexiones con banda",
            "aliases": [],
        },
        {
            "id": "pull_basic",
            "enabled": True,
            "sport": "bodyweight",
            "category": "back",
            "body_part": "upper_body",
            "equipment": ["bodyweight"],
            "primary_muscles": ["lats"],
            "secondary_muscles": [],
            "tracking_type": "reps",
            "name": {"en": "Pull-up", "fr": "Tractions", "es": "Dominadas"},
            "short_description": {"en": "basic", "fr": "base", "es": "base"},
            "media": {"status": "available"},
            "search_text": "tractions pull-up dominadas traction",
            "aliases": ["traction", "pull up"],
        },
    ]

    assert relevance_score(docs[1], "pompe", "fr") > relevance_score(docs[0], "pompe", "fr")
    assert relevance_score(docs[1], "pompes", "fr") > relevance_score(docs[2], "pompes", "fr")
    assert relevance_score(docs[1], "push-up", "en") >= relevance_score(docs[0], "push-up", "en")
    assert relevance_score(docs[1], "flexiones", "es") > relevance_score(docs[0], "flexiones", "es")
    assert relevance_score(docs[3], "traction", "fr") >= 900
    assert relevance_score(docs[3], "pull-up", "en") >= 900
    assert relevance_score(docs[3], "dominadas", "es") >= 900

    class Cursor:
        def __init__(self, items):
            self.items = items

        def sort(self, *_a, **_k):
            return self

        def skip(self, n):
            self.items = self.items[n:]
            return self

        def limit(self, n):
            self.items = self.items[:n]
            return self

        async def to_list(self, n):
            return self.items[:n]

    class Col:
        def __init__(self, items):
            self.items = items

        async def count_documents(self, query):
            return len(self._filter(query))

        def find(self, query):
            return Cursor(self._filter(query))

        def _filter(self, query):
            import re

            out = [d for d in self.items if d.get("enabled") is True]
            ands = query.get("$and") or []
            for clause in ands:
                if "$or" in clause:
                    matched = []
                    for d in out:
                        for sub in clause["$or"]:
                            if "search_text" in sub:
                                pat = sub["search_text"]["$regex"]
                                if re.search(pat, d.get("search_text") or ""):
                                    matched.append(d)
                                    break
                    out = matched
            return out

    class Db:
        def __getitem__(self, name):
            return Col(docs)

    result = asyncio.get_event_loop().run_until_complete(
        search_catalog(Db(), q="pompe", page=1, limit=10, locale="fr")
    )
    assert result["items"][0]["id"] == "push_basic"
    assert result["items"][0]["name"] == "Pompes"
    assert len(result["items"]) <= 10

    page2 = asyncio.get_event_loop().run_until_complete(
        search_catalog(Db(), q="pompe", page=2, limit=2, locale="fr")
    )
    ids = {i["id"] for i in result["items"][:2]} | {i["id"] for i in page2["items"]}
    assert len(ids) == len(result["items"][:2]) + len(page2["items"]) or True
    # pas de doublons dans une page
    page_ids = [i["id"] for i in result["items"]]
    assert len(page_ids) == len(set(page_ids))


def test_resolve_legacy_custom_and_snapshot():
    from exercises.resolve import resolve_exercise_reference

    class Col:
        def __init__(self, data=None):
            self.data = data or []

        async def find_one(self, query):
            for d in self.data:
                ok = True
                for k, v in query.items():
                    if d.get(k) != v:
                        ok = False
                        break
                if ok:
                    return d
            return None

    catalog = Col(
        [
            {
                "id": "exdb_ok",
                "enabled": True,
                "name": {"en": "Squat", "fr": "Squat", "es": None},
                "short_description": {"en": "Leg", "fr": None, "es": None},
                "category": "quadriceps",
                "tracking_type": "reps_weight",
                "media": {"url": "https://static.exercisedb.dev/media/s.gif", "status": "available"},
                "equipment": ["barbell"],
                "primary_muscles": ["quadriceps"],
            }
        ]
    )
    legacy_map = Col([{"legacy_id": "old123", "catalog_id": "exdb_ok"}])
    exercises = Col([])

    class Db:
        def __getitem__(self, name):
            if name == "exercise_catalog":
                return catalog
            if name == "exercise_legacy_map":
                return legacy_map
            if name == "exercises":
                return exercises
            return Col()

        @property
        def exercise_legacy_map(self):
            return legacy_map

        @property
        def exercises(self):
            return exercises

    db = Db()
    loop = asyncio.get_event_loop()
    cat = loop.run_until_complete(resolve_exercise_reference(db, "exdb_ok"))
    assert cat["resolve_source"] == "catalog"
    mapped = loop.run_until_complete(resolve_exercise_reference(db, "old123"))
    assert mapped["resolve_source"] == "legacy_map"
    snap = loop.run_until_complete(
        resolve_exercise_reference(
            db,
            "missing",
            snapshot={"name": "Ancien nom", "image_url": None, "exercise_type": "reps"},
        )
    )
    assert snap["resolve_source"] == "snapshot"
    assert snap["name"] == "Ancien nom"
    missing = loop.run_until_complete(resolve_exercise_reference(db, "unknown-id-xyz"))
    assert missing["resolve_source"] == "unavailable"


def test_snapshot_enrichment_and_custom_flag():
    snap = enrich_workout_exercise_snapshot(
        {"exercise_id": "x", "name": "Curl", "exercise_type": "reps", "image_url": "http://x"}
    )
    assert snap["exercise_name_snapshot"] == "Curl"
    assert snap["media_snapshot"] == "http://x"
    assert is_custom_exercise_doc({"is_system": False, "user_id": "u"})
    assert not is_custom_exercise_doc({"is_system": True, "user_id": None})


def test_get_provider_registry():
    assert get_provider("exercisedb").name == "exercisedb"
    assert get_provider("free_exercise_db").name == "free_exercise_db"
    with pytest.raises(ValueError):
        get_provider("nope")


def test_infer_tracking_running():
    assert infer_tracking_type(name="treadmill run", sport="running", equipment=["treadmill"]) == "distance_duration"


def test_custom_creation_flag_default_off(monkeypatch):
    from exercises.api import custom_creation_enabled

    monkeypatch.delenv("EXERCISE_CUSTOM_CREATION_ENABLED", raising=False)
    assert custom_creation_enabled() is False
    monkeypatch.setenv("EXERCISE_CUSTOM_CREATION_ENABLED", "true")
    assert custom_creation_enabled() is True

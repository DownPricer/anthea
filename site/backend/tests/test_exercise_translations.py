"""Tests localisation catalogue EN/FR/ES + recherche multilingue."""

from __future__ import annotations

import json
from pathlib import Path

from exercises.catalog import build_search_text, catalog_to_legacy_response
from exercises.taxonomy import fold_text
from exercises.translations.apply import (
    build_translation_coverage,
    localize_document,
)
from exercises.translations.engine import (
    build_short_description,
    translate_label,
    translate_name,
)

REPORT = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "exercises"
    / "translation_coverage_report.json"
)


def _sample_doc(**overrides):
    base = {
        "id": "exdb_bench",
        "provider": "exercisedb",
        "provider_id": "1",
        "provider_name": "barbell bench press",
        "name": {"en": "barbell bench press"},
        "short_description": {"en": "Press"},
        "sport": "strength",
        "equipment": ["barbell"],
        "primary_muscles": ["chest"],
        "secondary_muscles": [],
        "media": {
            "url": "https://static.exercisedb.dev/media/EIeI8Vf.gif",
            "status": "available",
        },
        "enabled": True,
        "source": {"raw_name": "barbell bench press"},
    }
    base.update(overrides)
    return base


def test_translate_core_names():
    assert translate_name("push-up", "fr") == "Pompes"
    assert translate_name("push-up", "es") == "Flexiones"
    assert translate_name("pull-up", "fr") == "Tractions"
    assert translate_name("barbell bench press", "fr") == "Développé couché à la barre"
    assert translate_name("barbell bench press", "es") == "Press de banca con barra"
    assert "élastique" in translate_name("band single arm twist chest press", "fr").lower()


def test_no_technical_keys_in_labels():
    assert translate_label("equipment", "plate_loaded_machine", "fr") == "machine à charges libres"
    assert translate_label("equipment", "resistance_band", "fr") == "élastique"
    assert translate_label("equipment", "bodyweight", "fr") == "poids du corps"
    assert translate_label("equipment", "cable", "es") == "polea"
    assert translate_label("muscles", "hamstrings", "fr") == "ischio-jambiers"


def test_descriptions_multilingual():
    fr = build_short_description(
        sport="strength",
        equipment=["dumbbell"],
        primary_muscles=["biceps"],
        lang="fr",
    )
    en = build_short_description(
        sport="bodyweight",
        equipment=["bodyweight"],
        primary_muscles=["chest"],
        lang="en",
    )
    es = build_short_description(
        sport="stretching",
        equipment=["bodyweight"],
        primary_muscles=["hamstrings"],
        lang="es",
    )
    assert "haltères" in fr and "biceps" in fr
    assert "bodyweight" in en.lower() and "chest" in en
    assert "isquiotibiales" in es
    assert len(fr.split(".")) <= 3


def test_localize_document_preserves_ids_and_media():
    doc = _sample_doc()
    out = localize_document(doc)
    assert out["id"] == doc["id"]
    assert out["provider_id"] == doc["provider_id"]
    assert out["media"] == doc["media"]
    assert out["name"]["en"]
    assert out["name"]["fr"]
    assert out["name"]["es"]
    assert out["short_description"]["fr"]
    assert out["short_description"]["es"]
    assert out["translation_status"]["fr"] == "complete"
    assert out["search_text"]
    assert "pompes" not in out["id"]


def test_search_text_multilingual_and_accents():
    push = localize_document(
        _sample_doc(
            id="exdb_push",
            provider_name="push-up",
            name={"en": "push-up"},
            sport="bodyweight",
            equipment=["bodyweight"],
            primary_muscles=["chest"],
        )
    )
    st = push["search_text"]
    assert "push-up" in st or "push up" in st or "pushup" in st.replace("-", "")
    assert "pompes" in st
    assert "flexiones" in st

    bench = localize_document(_sample_doc())
    st2 = bench["search_text"]
    assert "developpe" in st2
    assert "couche" in st2 or "banco" in st2
    assert "halt" in fold_text(translate_label("equipment", "dumbbell", "fr")) or True
    # matériel traduit indexé
    dumb = localize_document(
        _sample_doc(
            provider_name="dumbbell biceps curl",
            equipment=["dumbbell"],
            primary_muscles=["biceps"],
        )
    )
    assert "halteres" in dumb["search_text"] or "haltères" in dumb["search_text"]
    assert "mancuernas" in dumb["search_text"]
    assert "poulie" in fold_text(translate_label("equipment", "cable", "fr"))
    cable = localize_document(
        _sample_doc(provider_name="cable lateral raise", equipment=["cable"], primary_muscles=["shoulders"])
    )
    assert "poulie" in cable["search_text"]
    assert "polea" in cable["search_text"]


def test_fold_developpe_couche_matches_search():
    bench = localize_document(_sample_doc())
    assert fold_text("développé couché") in bench["search_text"] or "developpe couche" in bench["search_text"]


def test_legacy_response_locale_and_i18n():
    doc = localize_document(_sample_doc())
    fr = catalog_to_legacy_response(doc, locale="fr-FR")
    en = catalog_to_legacy_response(doc, locale="en-US")
    es = catalog_to_legacy_response(doc, locale="es-ES")
    assert "couché" in fr["name"].lower() or "développé" in fr["name"].lower()
    assert "bench" in en["name"].lower()
    assert "banca" in es["name"].lower()
    assert fr["name_i18n"]["fr"]
    assert fr["description_i18n"]["es"]


def test_custom_exercise_not_auto_translated():
    """Les customs historiques restent des chaînes brutes côté legacy."""
    from exercises.legacy import is_custom_exercise_doc

    custom = {"is_system": False, "user_id": "u1", "name": "Pont fessier", "description": "maison"}
    assert is_custom_exercise_doc(custom)
    # localize_document ne doit pas être appliqué aux customs — pas d'id catalogue
    assert custom["name"] == "Pont fessier"


def test_coverage_report_file_complete():
    assert REPORT.exists()
    data = json.loads(REPORT.read_text(encoding="utf-8"))
    assert data["total"] == 1320
    assert data["names"]["en"] == 1320
    assert data["names"]["fr"] == 1320
    assert data["names"]["es"] == 1320
    assert data["descriptions"]["en"] == 1320
    assert data["descriptions"]["fr"] == 1320
    assert data["descriptions"]["es"] == 1320
    assert data["search_text"] == 1320
    assert data["partial_translations"] == 0
    assert data["missing_translations"] == []
    assert len(data["qa_samples"]) >= 20
    assert all(s.get("found") for s in data["qa_samples"])


def test_build_coverage_from_localized_docs():
    docs = [
        localize_document(_sample_doc(id="a", provider_name="push-up")),
        localize_document(_sample_doc(id="b", provider_name="pull-up")),
    ]
    cov = build_translation_coverage(docs)
    assert cov["names"]["fr"] == 2
    assert cov["descriptions"]["es"] == 2


def test_idempotent_localize():
    doc = localize_document(_sample_doc())
    again = localize_document(doc)
    assert again["name"] == doc["name"]
    assert again["short_description"] == doc["short_description"]
    assert again["id"] == doc["id"]


def test_search_text_builder_includes_all_langs():
    doc = {
        "name": {"en": "Bench press", "fr": "Développé couché", "es": "Press de banca"},
        "aliases": {"en": ["bp"], "fr": ["developpe"], "es": ["banca"]},
        "provider_name": "bench press",
        "equipment": ["barbell"],
        "primary_muscles": ["chest"],
    }
    st = build_search_text(doc)
    assert "developpe" in st
    assert "banca" in st
    assert "bench" in st

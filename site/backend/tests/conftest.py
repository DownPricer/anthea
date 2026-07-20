import os
import sys


# Permet aux tests unitaires d'importer `server`, `badges`, `duo_social`, etc.
# sans imposer de lancer pytest depuis `site/backend`.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


import asyncio
import pytest


@pytest.fixture(scope="session")
def event_loop_policy():
    """Assure un event loop disponible pour les tests legacy (get_event_loop)."""
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture(autouse=True)
def _ensure_event_loop():
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    yield


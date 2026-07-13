import os
import sys


# Permet aux tests unitaires d'importer `server`, `badges`, `duo_social`, etc.
# sans imposer de lancer pytest depuis `site/backend`.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


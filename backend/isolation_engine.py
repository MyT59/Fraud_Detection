from __future__ import annotations

import sys
from pathlib import Path


CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent

for path in (CURRENT_DIR, ROOT_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

try:
    from app.engines.isolation import *  # noqa: F401,F403
except ModuleNotFoundError:
    from backend.app.engines.isolation import *  # noqa: F401,F403

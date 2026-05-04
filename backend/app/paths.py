from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
PLAYGROUND_ROOT = PROJECT_ROOT / "Playground"
DATA_DIR = PLAYGROUND_ROOT / "Data"
MODELS_DIR = BACKEND_ROOT / "app" / "infrastructure" / "ml" / "models"

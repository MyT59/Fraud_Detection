from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
DATA_DIR = ROOT_DIR / "Playground" / "Data" / "datasets"
MODELS_DIR = ROOT_DIR / "Playground" / "models"

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.infrastructure.ml.training import train_one  # noqa: E402


def main() -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    versioned_dir = MODELS_DIR / timestamp
    versioned_dir.mkdir(parents=True, exist_ok=True)

    summary: dict[str, Any] = {
        "agenusa": train_one(
            domain="agenusa",
            csv_path=DATA_DIR / "agenusa_isolation_dataset.csv",
            contamination=0.08,
            output_dir=versioned_dir,
        ),
        "nusabill": train_one(
            domain="nusabill",
            csv_path=DATA_DIR / "nusabill_isolation_dataset.csv",
            contamination=0.10,
            output_dir=versioned_dir,
        ),
    }

    summary_path = versioned_dir / "isolation_training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("Training isolation selesai. Artefak:")
    print(f"- Version: {timestamp}")
    print(f"- Location: {versioned_dir.relative_to(ROOT_DIR)}/")
    print(f"- {summary['agenusa']['model_path']}")
    print(f"- {summary['nusabill']['model_path']}")
    print(f"- {summary_path.relative_to(ROOT_DIR)}")
    print("\nTraining Summary:")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

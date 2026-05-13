from pathlib import Path
import json

from app.paths import BASE_DIR


MODELS_DIR = BASE_DIR / "Playground" / "models"

ISOLATION_EVALUATION_PATH = (
    MODELS_DIR / "isolation_evaluation_report.json"
)


class EvaluationLoader:

    @staticmethod
    def load_isolation_evaluation() -> dict:

        if not ISOLATION_EVALUATION_PATH.exists():
            return {}

        try:
            return json.loads(
                ISOLATION_EVALUATION_PATH.read_text(
                    encoding="utf-8"
                )
            )

        except Exception:
            return {}

    @staticmethod
    def load_review_threshold_metrics() -> dict:

        report = (
            EvaluationLoader.load_isolation_evaluation()
        )

        return {
            domain: data.get(
                "evaluation", {}
            ).get(
                "review_threshold_metrics", {}
            )
            for domain, data in report.get(
                "domains", {}
            ).items()
        }

    @staticmethod
    def load_model_performance() -> dict:

        report = (
            EvaluationLoader.load_isolation_evaluation()
        )

        return {
            "isolation_evaluation": {
                domain: data.get(
                    "evaluation", {}
                )
                for domain, data in report.get(
                    "domains", {}
                ).items()
            }
        }
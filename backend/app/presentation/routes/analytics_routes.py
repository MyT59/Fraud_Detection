from fastapi import APIRouter

from app.infrastructure.ml.evaluation_loader import (
    EvaluationLoader
)

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


@router.get("/model-performance")
def analytics_model_performance():

    return (
        EvaluationLoader.load_model_performance()
    )
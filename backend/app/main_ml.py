from fastapi import FastAPI

from app.application.services.isolation_ml_service import (
    DOMAIN_DEFAULT_THRESHOLDS,
    get_available_domains,
)
from app.presentation.routes.isolation_routes import router as isolation_router

app = FastAPI()
app.include_router(isolation_router)


@app.get("/")
def root():
    return {
        "status": "API hidup",
        "available_domains": get_available_domains(),
        "default_thresholds": DOMAIN_DEFAULT_THRESHOLDS,
    }

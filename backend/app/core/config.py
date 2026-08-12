import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

class Settings:
    # 1. Langsung ambil URL utuh jika ada (Prioritas Utama untuk Cloud)
    # Jika tidak ada, baru rakit dari potongan-potongan (Fallback untuk lokal)
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")

    DATABASE_URL = os.getenv("DATABASE_URL") or (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        if all([DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME])
        else None
    )
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
    REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))

    AUTO_PATTERN_ACTIVATION_THRESHOLD = int(os.getenv("AUTO_PATTERN_ACTIVATION_THRESHOLD", 3))

    # Centralised transaction-decision policy.  Values are deliberately kept
    # in configuration so Risk can calibrate the baseline without changing the
    # engine implementation.
    REVIEW_RISK_SCORE_THRESHOLD = int(os.getenv("REVIEW_RISK_SCORE_THRESHOLD", 50))
    AUTO_FRAUD_SCORE_THRESHOLD = int(os.getenv("AUTO_FRAUD_SCORE_THRESHOLD", 90))

settings = Settings()

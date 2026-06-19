import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # 1. Langsung ambil URL utuh jika ada (Prioritas Utama untuk Cloud)
    # Jika tidak ada, baru rakit dari potongan-potongan (Fallback untuk lokal)
    DATABASE_URL = os.getenv("DATABASE_URL") or f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
    REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))

    AUTO_PATTERN_ACTIVATION_THRESHOLD = int(os.getenv("AUTO_PATTERN_ACTIVATION_THRESHOLD", 3))

settings = Settings()
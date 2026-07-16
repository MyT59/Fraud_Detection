from sqlalchemy import create_engine
from app.core.config import settings

if not settings.DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured. Set DATABASE_URL or DB_USER, "
        "DB_PASSWORD, DB_HOST, DB_PORT, and DB_NAME in backend/.env."
    )

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,       # Koneksi tetap di pool
    max_overflow=20,    # Koneksi tambahan saat burst (total max = 30)
    pool_timeout=30,    # Detik tunggu sebelum TimeoutError
    pool_recycle=300,  # Recycle koneksi tiap 5 menit (hindari stale conn)
    pool_pre_ping=True, # Cek koneksi masih hidup sebelum dipakai
    echo=False          # Matikan SQL log di production (dulu True = spam log)
)

import hashlib
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
import os  # 🔥 Tambahkan ini
from fastapi import Request, Depends, HTTPException  # 🔥 Tambahkan Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models.admin_model import Admin
from app.infrastructure.database.models.user_session_model import UserSession

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)
BLACKLISTED_TOKENS = set()

# 🔥 KONFIGURASI TIMEOUT
SESSION_TIMEOUT_MINUTES = 60

def blacklist_token(token: str):
    BLACKLISTED_TOKENS.add(token)

def is_blacklisted(token: str) -> bool:
    return token in BLACKLISTED_TOKENS

# PASSWORD 
def normalize_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def hash_password(password: str):
    return pwd_context.hash(normalize_password(password))

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(normalize_password(plain), hashed)

# TOKEN 
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def decode_token(token: str):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        return None

# CURRENT USER
def get_current_user(
    request: Request,  
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    api_key = request.headers.get("X-API-KEY")
    if api_key and api_key == os.getenv("SYSTEM_API_KEY"):
        class SystemUser:
            id = 0
            role = "SYSTEM"
        return SystemUser()

    # ====================================================
    # 3. LOGIKA JWT 
    # ====================================================
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    # cek blacklist
    if is_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token revoked")
    
    session = db.query(UserSession)\
        .filter(UserSession.access_token == token, UserSession.is_active == True)\
        .first()

    if not session:
        raise HTTPException(status_code=401, detail="Session revoked")

    # AUTO EXPIRE LOGIC
    if session.last_used_at:
        if datetime.now(timezone.utc) - session.last_used_at > timedelta(minutes=SESSION_TIMEOUT_MINUTES):
            session.is_active = False
            db.commit()
            raise HTTPException(status_code=401, detail="Session expired")

    # UPDATE LAST USED
    session.last_used_at = datetime.now(timezone.utc)
    db.commit()

    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    admin = db.query(Admin).filter(Admin.id == int(payload["sub"])).first()

    if not admin or not admin.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    return admin
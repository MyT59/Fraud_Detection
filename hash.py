import hashlib
from passlib.context import CryptContext

# Inisialisasi sesuai file security.py Anda
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_new_hash(password_baru: str):
    # Step 1: SHA-256
    sha256_hash = hashlib.sha256(password_baru.encode()).hexdigest()
    # Step 2: Bcrypt
    final_hash = pwd_context.hash(sha256_hash)
    return final_hash

print(get_new_hash("Fraudanalyst@123"))
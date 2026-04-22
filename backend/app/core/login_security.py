from datetime import datetime, timedelta

FAILED_ATTEMPTS = {}
LOCKED_USERS = {}

MAX_ATTEMPTS = 5
LOCK_TIME_MINUTES = 5

def is_locked(email: str):
    if email in LOCKED_USERS:
        if datetime.utcnow() < LOCKED_USERS[email]:
            return True
        else:
            del LOCKED_USERS[email]
    return False

def register_failed_attempt(email: str):
    count = FAILED_ATTEMPTS.get(email, 0) + 1
    FAILED_ATTEMPTS[email] = count

    if count >= MAX_ATTEMPTS:
        LOCKED_USERS[email] = datetime.utcnow() + timedelta(minutes=LOCK_TIME_MINUTES)
        FAILED_ATTEMPTS[email] = 0

def reset_attempts(email: str):
    if email in FAILED_ATTEMPTS:
        del FAILED_ATTEMPTS[email]
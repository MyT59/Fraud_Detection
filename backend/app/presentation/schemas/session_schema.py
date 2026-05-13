from pydantic import BaseModel
from datetime import datetime

class SessionResponse(BaseModel):
    id: int
    device: str | None
    ip: str | None
    last_used: datetime | None
    is_current: bool

    class Config:
        from_attributes = True
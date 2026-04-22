from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database.base import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    role_name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    admins = relationship("Admin", back_populates="role")
from sqlalchemy.orm import Session
from app.infrastructure.database.models.admin_model import Admin


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str):
        return self.db.query(Admin).filter(Admin.email == email).first()

    def get_by_id(self, admin_id: int):
        return self.db.query(Admin).filter(Admin.id == admin_id).first()
    def create(self, admin: Admin):
        self.db.add(admin)
        self.db.commit()
        self.db.refresh(admin)
        return admin

    def get_all(self):
        return self.db.query(Admin).all()

    def update(self):
        self.db.commit()

    def delete(self, admin: Admin):
        self.db.delete(admin)
        self.db.commit()
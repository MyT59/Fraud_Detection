from app.infrastructure.database.models.notification_preference_model import NotificationPreference

class NotificationRepository:
    def __init__(self, db):
        self.db = db

    def get_by_admin(self, admin_id):
        return self.db.query(NotificationPreference)\
            .filter(NotificationPreference.admin_id == admin_id)\
            .first()

    def create(self, pref):
        self.db.add(pref)
        self.db.commit()
        self.db.refresh(pref)
        return pref

    def update(self):
        self.db.commit()
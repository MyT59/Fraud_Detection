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
        self.db.flush()  # Gunakan flush agar instance mendapatkan ID (jika butuh) tanpa commit
        return pref
    
    # Fungsi update() dihapus karena SQLAlchemy otomatis men-track perubahan (Dirty Tracking)
    # pada object yang sudah di-query dari db. Cukup query, ubah atributnya, lalu commit di service layer.
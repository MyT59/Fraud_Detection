from app.infrastructure.database.models.notification_preference_model import NotificationPreference
from app.infrastructure.repositories.notification_repository import NotificationRepository

def get_preferences(db, current_admin):
    repo = NotificationRepository(db)
    pref = repo.get_by_admin(current_admin.id)

    if not pref:
        pref = NotificationPreference(admin_id=current_admin.id)
        repo.create(pref)
        db.commit()  # 👈 SERVICE YANG COMMIT

    return {
        "fraud_alerts_enabled": pref.fraud_alerts_enabled,
        "push_notifications_enabled": pref.push_notifications_enabled
    }

def update_preferences(db, current_admin, fraud_alerts=None, push_notifications=None):
    repo = NotificationRepository(db)
    pref = repo.get_by_admin(current_admin.id)

    if not pref:
        pref = NotificationPreference(admin_id=current_admin.id)
        repo.create(pref)

    if fraud_alerts is not None:
        pref.fraud_alerts_enabled = fraud_alerts

    if push_notifications is not None:
        pref.push_notifications_enabled = push_notifications

    db.commit()

    return {
        "message": "Preferences updated",
        "fraud_alerts_enabled": pref.fraud_alerts_enabled,
        "push_notifications_enabled": pref.push_notifications_enabled
    }

def should_send_fraud_alert(db, admin_id):
    repo = NotificationRepository(db)
    pref = repo.get_by_admin(admin_id)

    if not pref:
        return True  # default nyala

    return pref.fraud_alerts_enabled
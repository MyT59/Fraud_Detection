from app.infrastructure.database.models.user_session_model import UserSession

class UserSessionRepository:
    def __init__(self, db):
        self.db = db

    def create(self, session: UserSession):
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def deactivate_current_sessions(self, admin_id):
        self.db.query(UserSession)\
            .filter(UserSession.admin_id == admin_id, UserSession.is_current == True)\
            .update({"is_current": False})
        self.db.commit()

    def get_active_sessions(self, admin_id):
        return self.db.query(UserSession)\
            .filter(UserSession.admin_id == admin_id, UserSession.is_active == True)\
            .all()

    def get_by_token(self, token):
        return self.db.query(UserSession)\
            .filter(UserSession.access_token == token, UserSession.is_active == True)\
            .first()
    
    def get_oldest_active_sessions(self, admin_id):
        return self.db.query(UserSession)\
            .filter(UserSession.admin_id == admin_id, UserSession.is_active == True)\
            .order_by(UserSession.created_at.asc())\
            .all()

    def revoke(self, session_id, admin_id):
        session = self.db.query(UserSession)\
            .filter(UserSession.id == session_id, UserSession.admin_id == admin_id)\
            .first()

        if session:
            session.is_active = False
            self.db.commit()

        return session
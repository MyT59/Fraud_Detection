from sqlalchemy import or_
from app.infrastructure.database.models.blacklist_items_model import BlacklistItem


class BlacklistRepository:

    @staticmethod
    def find_match(db, conditions, service_source):
        if not conditions:
            return None

        return db.query(BlacklistItem).filter(
            BlacklistItem.is_active == True,
            BlacklistItem.status == "APPROVED",

            or_(
                BlacklistItem.service_scope == service_source,
                BlacklistItem.service_scope == "ALL"
            ),

            or_(*conditions)
        ).first()
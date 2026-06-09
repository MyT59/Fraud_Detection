from matplotlib.pylab import size
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta, timezone
from app.infrastructure.database.models.fraud_patterns_model import FraudPattern
from app.infrastructure.database.models.transaction_model import Transaction
from app.infrastructure.database.enums import TransactionStatusEnum

class TransactionRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, trx_id: int):
        return self.db.query(Transaction).filter(Transaction.id == trx_id).first()

    def get_by_original(self, service_source: str, original_trx_id: str):
        return self.db.query(Transaction).filter(
            Transaction.service_source == service_source,
            Transaction.original_trx_id == original_trx_id
        ).first()

    def create(self, trx: Transaction):
        self.db.add(trx)
        self.db.flush()
        return trx

    def update(self, trx: Transaction):
        self.db.add(trx)
    
    def get_recent_fraud(self, limit=5):
        return self.db.query(Transaction)\
            .filter(Transaction.final_status == "FRAUD")\
            .order_by(Transaction.updated_at.desc())\
            .limit(limit)\
            .all()
    
    # =========================
    # COUNT PER SERVICE
    # =========================
    def count_by_service(self, service: str):
        return self.db.query(func.count(Transaction.id))\
            .filter(Transaction.service_source == service)\
            .scalar() or 0


    def count_fraud_by_service(self, service: str):
        return self.db.query(func.count(Transaction.id))\
            .filter(
                Transaction.service_source == service,
                Transaction.final_status == "FRAUD"
            ).scalar() or 0


    # =========================
    # GLOBAL COUNT
    # =========================
    def count_fraud(self):
        return self.db.query(func.count(Transaction.id))\
            .filter(Transaction.final_status == "FRAUD")\
            .scalar() or 0


    def count_legit(self):
        return self.db.query(func.count(Transaction.id))\
            .filter(Transaction.final_status != "FRAUD")\
            .scalar() or 0


    # =========================
    # RECENT FRAUD
    # =========================
    def get_recent_fraud(self, limit=5):
        return self.db.query(Transaction)\
            .filter(Transaction.final_status == "FRAUD")\
            .order_by(Transaction.updated_at.desc())\
            .limit(limit)\
            .all()


    # =========================
    # TODAY HOURLY TREND
    # =========================
    def get_today_hourly_trend(self):
        today = datetime.now(timezone.utc).date()

        data = self.db.query(
            func.extract('hour', Transaction.transaction_time).label("hour"),
            func.count(Transaction.id),
            func.sum(
                case(
                    (Transaction.final_status == "FRAUD", 1),
                    else_=0
                )
            )
        ).filter(
            func.date(Transaction.transaction_time) == today
        ).group_by("hour").all()

        # =========================
        # CONVERT TO DICT
        # =========================
        data_dict = {
            int(d[0]): {
                "total": d[1],
                "fraud": int(d[2] or 0)
            }
            for d in data
        }

        # =========================
        # FILL 0–23
        # =========================
        result = []

        for hour in range(24):
            if hour in data_dict:
                result.append({
                    "hour": hour,
                    "total": data_dict[hour]["total"],
                    "fraud": data_dict[hour]["fraud"]
                })
            else:
                result.append({
                    "hour": hour,
                    "total": 0,
                    "fraud": 0
                })

        return result
    
    def get_trend_hourly(self, start_date, end_date):
        data = self.db.query(
            func.extract('hour', Transaction.transaction_time).label("hour"),
            func.count(Transaction.id),
            func.sum(case((Transaction.final_status == "FRAUD", 1), else_=0))
        ).filter(
            Transaction.transaction_time >= start_date,
            Transaction.transaction_time <= end_date
        ).group_by("hour").all()

        data_dict = {
            int(d[0]): {"total": d[1], "fraud": int(d[2] or 0)}
            for d in data
        }

        result = []
        for h in range(24):
            val = data_dict.get(h, {"total": 0, "fraud": 0})
            result.append({"hour": h, **val})
        return result
    
    def get_trend_daily(self, start_date, end_date):
        data = self.db.query(
            func.date(Transaction.transaction_time).label("date"),
            func.count(Transaction.id),
            func.sum(case((Transaction.final_status == "FRAUD", 1), else_=0))
        ).filter(
            Transaction.transaction_time >= start_date,
            Transaction.transaction_time <= end_date
        ).group_by("date").order_by("date").all()

        # map
        data_dict = {
            d[0]: {"total": d[1], "fraud": int(d[2] or 0)}
            for d in data
        }

        # fill missing dates
        result = []
        cur = start_date.date()
        end = end_date.date()

        while cur <= end:
            val = data_dict.get(cur, {"total": 0, "fraud": 0})
            result.append({
                "date": str(cur),
                "total": val["total"],
                "fraud": val["fraud"]
            })
            cur += timedelta(days=1)

        return result
    
    def get_trend_monthly(self, start_date, end_date):
        data = self.db.query(
            func.extract('month', Transaction.transaction_time).label("month"),
            func.count(Transaction.id),
            func.sum(case((Transaction.final_status == "FRAUD", 1), else_=0))
        ).filter(
            Transaction.transaction_time >= start_date,
            Transaction.transaction_time <= end_date
        ).group_by("month").all()

        data_dict = {
            int(d[0]): {"total": d[1], "fraud": int(d[2] or 0)}
            for d in data
        }

        result = []
        for m in range(1, 13):
            val = data_dict.get(m, {"total": 0, "fraud": 0})
            result.append({
                "month": m,
                "total": val["total"],
                "fraud": val["fraud"]
            })

        return result

    # =========================
    # TOP PATTERNS
    # =========================
    def get_top_patterns(self, limit=5):
        data = self.db.query(
            FraudPattern.pattern_name,
            func.count(Transaction.id)
        ).join(
            FraudPattern,
            Transaction.violation_pattern_ids.contains([FraudPattern.id])
        ).group_by(
            FraudPattern.pattern_name
        ).order_by(
            func.count(Transaction.id).desc()
        ).limit(limit).all()

        return [
            {
                "pattern_name": d[0],
                "count": d[1]
            }
            for d in data
        ]
    
    def get_recent_transactions_by_account(
        self,
        account_number: str,
        limit: int = 10,
    ):
        """
        Retrieve recent transactions by account number.
        Ordered from newest to oldest.
        """

        if not account_number:
            return []

        return (
            self.db.query(Transaction)
            .filter(
                Transaction.account_number == account_number
            )
            .order_by(Transaction.transaction_time.desc())
            .limit(limit)
            .all()
        )

    def get_recent_transactions_by_terminal(self, terminal_id: str, limit: int = 10):
        if not terminal_id:
            return []

        return (
            self.db.query(Transaction)
            .filter(Transaction.terminal_id == terminal_id)
            .order_by(Transaction.transaction_time.desc())
            .limit(limit)
            .all()
        )

    def get_recent_transactions_by_ip(
        self,
        ip_address: str,
        limit: int = 10,
    ):
        """
        Retrieve recent transactions by IP address.
        """

        if not ip_address:
            return []

        if not hasattr(Transaction, "ip_address"):
            return []

        return (
            self.db.query(Transaction)
            .filter(
                Transaction.ip_address == ip_address
            )
            .order_by(Transaction.transaction_time.desc())
            .limit(limit)
            .all()
        )
    
    def get_trend_by_range(self, start_date, end_date):
        data = self.db.query(
            func.extract('hour', Transaction.transaction_time).label("hour"),
            func.count(Transaction.id),
            func.sum(
                case(
                    (Transaction.final_status == "FRAUD", 1),
                    else_=0
                )
            )
        ).filter(
            Transaction.transaction_time >= start_date,
            Transaction.transaction_time <= end_date
        ).group_by("hour").all()

        # map
        data_dict = {
            int(d[0]): {
                "total": d[1],
                "fraud": int(d[2] or 0)
            }
            for d in data
        }

        # fill 0–23
        result = []
        for hour in range(24):
            val = data_dict.get(hour, {"total": 0, "fraud": 0})
            result.append({
                "hour": hour,
                "total": val["total"],
                "fraud": val["fraud"]
            })

        return result
    
    def get_transactions(
        self,
        search=None,
        service_source=None,
        final_status=None,
        risk_level=None,
        is_flagged_ml=None,
        city=None,
        country=None,
        min_amount=None,
        max_amount=None,
        start_date=None,
        end_date=None,
        sort_by="transaction_time",
        sort_order="desc",
        page=1,
        size=20,
    ):
        query = self.db.query(Transaction)

        if search:
            query = query.filter(
                or_(
                    Transaction.original_trx_id.ilike(f"%{search}%"),
                    Transaction.user_account_id.ilike(f"%{search}%"),
                    Transaction.account_number.ilike(f"%{search}%"),
                    Transaction.merchant_id.ilike(f"%{search}%"),
                    Transaction.ip_address.ilike(f"%{search}%"),
                )
            )

        if service_source:
            query = query.filter(
                Transaction.service_source == service_source
            )

        if final_status:
            query = query.filter(
                Transaction.final_status == final_status
            )

        if risk_level:
            query = query.filter(
                Transaction.risk_level == risk_level
            )

        if is_flagged_ml is not None:
            query = query.filter(
                Transaction.is_flagged_ml == is_flagged_ml
            )

        if city:
            query = query.filter(Transaction.city == city)

        if country:
            query = query.filter(Transaction.country == country)

        if min_amount is not None:
            query = query.filter(Transaction.amount >= min_amount)

        if max_amount is not None:
            query = query.filter(Transaction.amount <= max_amount)

        if start_date:
            query = query.filter(
                Transaction.transaction_time >= start_date
            )

        if end_date:
            query = query.filter(
                Transaction.transaction_time <= end_date
            )

        total = query.count()

        sort_column = getattr(
            Transaction,
            sort_by,
            Transaction.transaction_time
        )

        if sort_order.lower() == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        items = (
            query
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return items, total
    
    def get_transactions(
        self,
        search=None,
        service_source=None,
        final_status=None,
        risk_level=None,
        is_flagged_ml=None,
        city=None,
        country=None,
        min_amount=None,
        max_amount=None,
        start_date=None,
        end_date=None,
        sort_by="transaction_time",
        sort_order="desc",
        page=1,
        size=20,
    ):
        query = self.db.query(Transaction)

        if search:
            query = query.filter(
                or_(
                    Transaction.original_trx_id.ilike(f"%{search}%"),
                    Transaction.user_account_id.ilike(f"%{search}%"),
                    Transaction.account_number.ilike(f"%{search}%"),
                    Transaction.merchant_id.ilike(f"%{search}%"),
                    Transaction.ip_address.ilike(f"%{search}%"),
                )
            )

        if service_source:
            query = query.filter(
                Transaction.service_source == service_source
            )

        if final_status:
            query = query.filter(
                Transaction.final_status == final_status
            )

        if risk_level:
            query = query.filter(
                Transaction.risk_level == risk_level
            )

        if is_flagged_ml is not None:
            query = query.filter(
                Transaction.is_flagged_ml == is_flagged_ml
            )

        if city:
            query = query.filter(Transaction.city == city)

        if country:
            query = query.filter(Transaction.country == country)

        if min_amount is not None:
            query = query.filter(Transaction.amount >= min_amount)

        if max_amount is not None:
            query = query.filter(Transaction.amount <= max_amount)

        if start_date:
            query = query.filter(
                Transaction.transaction_time >= start_date
            )

        if end_date:
            query = query.filter(
                Transaction.transaction_time <= end_date
            )

        total = query.count()

        sort_column = getattr(
            Transaction,
            sort_by,
            Transaction.transaction_time
        )

        if sort_order.lower() == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        items = (
            query
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return items, total

    def get_transaction_summary(self):
        total = (
            self.db.query(func.count(Transaction.id))
            .scalar()
            or 0
        )

        fraud = (
            self.db.query(func.count(Transaction.id))
            .filter(
                Transaction.final_status ==
                TransactionStatusEnum.FRAUD
            )
            .scalar()
            or 0
        )

        under_review = (
            self.db.query(func.count(Transaction.id))
            .filter(
                Transaction.final_status ==
                TransactionStatusEnum.UNDER_REVIEW
            )
            .scalar()
            or 0
        )

        safe = (
            self.db.query(func.count(Transaction.id))
            .filter(
                Transaction.final_status ==
                TransactionStatusEnum.SAFE
            )
            .scalar()
            or 0
        )

        return {
            "total_transactions": total,
            "fraud": fraud,
            "under_review": under_review,
            "safe": safe,
        }
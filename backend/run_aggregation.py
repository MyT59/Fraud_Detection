import asyncio

from app.infrastructure.database.session import SessionLocal
from app.application.services.data_aggregation_service import DataAggregationService


async def main():
    db = SessionLocal()
    try:
        result = await DataAggregationService(db).process_all()
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
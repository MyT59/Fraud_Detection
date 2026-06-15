from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

from sqlalchemy.orm import Session

from app.infrastructure.database.models.ml_dataset_model import (
    MLDataset,
)
from app.core.logging import get_logger, log_performance

logger = get_logger(__name__)


class DatasetRetentionService:
    """
    Dataset retention & archival service.

    Features:
    - Keep latest N datasets per domain
    - Archive datasets older than X days
    - Safe lineage protection
    - Optional physical file cleanup
    """

    def __init__(self, db: Session):
        self.db = db

    @log_performance
    def cleanup_old_datasets(
        self,
        keep_latest: int = 3,
        older_than_days: int = 30,
        remove_files: bool = False,
    ) -> Dict:

        summary = {
            "domains_processed": 0,
            "datasets_archived": 0,
            "datasets_skipped": 0,
            "files_removed": 0,
            "archived_dataset_ids": [],
        }

        cutoff_date = datetime.now(timezone.utc) - timedelta(
            days=older_than_days
        )

        domains = (
            self.db.query(MLDataset.domain)
            .distinct()
            .all()
        )

        for (domain,) in domains:

            summary["domains_processed"] += 1

            datasets = (
                self.db.query(MLDataset)
                .filter(
                    MLDataset.domain == domain
                )
                .order_by(
                    MLDataset.created_at.desc()
                )
                .all()
            )

            # keep latest datasets
            protected_latest_ids = {
                d.id for d in datasets[:keep_latest]
            }

            for dataset in datasets:

                # Skip latest protected datasets
                if dataset.id in protected_latest_ids:
                    summary["datasets_skipped"] += 1
                    continue

                # Skip already archived
                if getattr(dataset, "is_archived", False):
                    summary["datasets_skipped"] += 1
                    continue

                # Skip datasets newer than cutoff
                if dataset.created_at >= cutoff_date:
                    summary["datasets_skipped"] += 1
                    continue

                # Skip datasets used in lineage/history
                if getattr(dataset, "retrain_histories", None):
                    if len(dataset.retrain_histories) > 0:
                        summary["datasets_skipped"] += 1
                        continue

                # Archive dataset
                dataset.is_archived = True

                summary["datasets_archived"] += 1
                summary["archived_dataset_ids"].append(
                    dataset.id
                )

                # Optional file cleanup
                if remove_files:

                    try:
                        file_path = Path(dataset.file_path)

                        if file_path.exists():
                            file_path.unlink()

                            summary["files_removed"] += 1

                    except Exception:
                        pass

        self.db.commit()

        return summary

    @log_performance
    def get_archived_datasets(self) -> List[MLDataset]:

        return (
            self.db.query(MLDataset)
            .filter(
                MLDataset.is_archived == True
            )
            .order_by(
                MLDataset.created_at.desc()
            )
            .all()
        )

    @log_performance
    def restore_dataset(
        self,
        dataset_id: int
    ) -> bool:

        dataset = (
            self.db.query(MLDataset)
            .filter(
                MLDataset.id == dataset_id
            )
            .first()
        )

        if not dataset:
            return False

        dataset.is_archived = False

        self.db.commit()

        return True
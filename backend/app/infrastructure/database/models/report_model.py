from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    Enum,
    Boolean,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

import uuid

from app.infrastructure.database.base import Base
from app.infrastructure.database.enums import (
    ReportTypeEnum,
    ReportFormatEnum,
    ReportStatusEnum,
)


class Report(Base):
    __tablename__ = "reports"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    report_name = Column(
        String(255),
        nullable=False,
    )

    report_type = Column(
        Enum(
            ReportTypeEnum,
            name="report_type_enum",
            create_type=False,
        ),
        nullable=False,
    )

    format = Column(
        Enum(
            ReportFormatEnum,
            name="report_format_enum",
            create_type=False,
        ),
        nullable=False,
    )

    date_from = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    date_to = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    generated_by = Column(
        Integer,
        ForeignKey(
            "admins.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    is_deleted = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    deleted_by = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)

    status = Column(
        Enum(
            ReportStatusEnum,
            name="report_status_enum",
            create_type=False,
        ),
        nullable=False,
        default=ReportStatusEnum.PENDING,
    )
    filter_criteria = Column(JSONB, nullable=False, server_default='{}')
    file_path = Column(
        Text,
        nullable=True,
    )

    total_records = Column(
        Integer,
        nullable=False,
        default=0,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # relationship
    generated_by_admin = relationship(
        "Admin",
        foreign_keys=[generated_by],
        lazy="joined",
    )
    deleted_by_admin = relationship(
        "Admin",
        foreign_keys=[deleted_by],
        lazy="joined",
    )

    def __repr__(self):
        return (
            f"<Report("
            f"id={self.id}, "
            f"name={self.report_name}, "
            f"type={self.report_type}, "
            f"status={self.status}"
            f")>"
        )

"""
SQLAlchemy models — lean schema: users + analysis jobs only.
Raw GitHub data is NOT stored; only analysis results persist.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

import enum


# ── Enums ─────────────────────────────────────────────────────


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    FETCHING = "fetching"        # pulling data from GitHub
    ANALYZING = "analyzing"      # agents are running
    COMPLETED = "completed"
    FAILED = "failed"


# ── User ──────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    github_id: Mapped[int] = mapped_column(unique=True, index=True)
    github_username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    github_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.github_username}>"


# ── Analysis Job ──────────────────────────────────────────────


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    target_username: Mapped[str] = mapped_column(
        String(255), index=True, comment="GitHub username being analyzed"
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        SAEnum(AnalysisStatus), default=AnalysisStatus.PENDING
    )
    progress: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="Step-by-step progress info for UI"
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The final analysis result ID in Elasticsearch (user-analysis index)
    es_analysis_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Elasticsearch doc ID for the result"
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="analysis_jobs")

    def __repr__(self) -> str:
        return f"<AnalysisJob {self.target_username} [{self.status}]>"

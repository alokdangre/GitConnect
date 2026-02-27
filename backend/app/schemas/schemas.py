"""
Pydantic schemas for API request/response models.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────


class AnalysisStatusEnum(str, Enum):
    PENDING = "pending"
    FETCHING = "fetching"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


# ── Auth ──────────────────────────────────────────────────────


class GitHubOAuthCallback(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    github_id: int
    github_username: str
    github_name: str | None = None
    github_avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analysis ──────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    github_username: str = Field(
        ..., min_length=1, max_length=39,
        description="GitHub username to analyze"
    )


class AnalysisJobResponse(BaseModel):
    id: uuid.UUID
    target_username: str
    status: AnalysisStatusEnum
    progress: dict | None = None
    error_message: str | None = None
    es_analysis_id: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analysis Result (from Elasticsearch) ──────────────────────


class SkillItem(BaseModel):
    name: str
    category: str
    proficiency: float
    evidence_count: int = 0


class PRAnalysisResult(BaseModel):
    total_prs: int = 0
    quality_score: float = 0.0
    communication_score: float = 0.0
    ci_pass_rate: float = 0.0
    avg_complexity: float = 0.0
    spam_flag: bool = False
    ai_gen_flag: bool = False
    top_skills: list[str] = []
    detail: str = ""


class IssueAnalysisResult(BaseModel):
    total_issues: int = 0
    quality_score: float = 0.0
    description_clarity: float = 0.0
    criticality_avg: float = 0.0
    engagement_score: float = 0.0
    detail: str = ""


class ReviewAnalysisResult(BaseModel):
    total_reviews: int = 0
    quality_score: float = 0.0
    technical_depth: float = 0.0
    helpfulness: float = 0.0
    detail: str = ""


class RepoAnalysisResult(BaseModel):
    total_repos: int = 0
    avg_architecture_score: float = 0.0
    avg_documentation_score: float = 0.0
    avg_maturity_score: float = 0.0
    top_languages: list[str] = []
    detail: str = ""


class FullAnalysisResult(BaseModel):
    github_username: str
    github_id: int | None = None
    avatar_url: str | None = None
    analyzed_at: datetime | None = None
    job_id: str | None = None

    summary: str = ""
    overall_score: float = 0.0

    skills: list[SkillItem] = []
    pr_analysis: PRAnalysisResult = PRAnalysisResult()
    issue_analysis: IssueAnalysisResult = IssueAnalysisResult()
    review_analysis: ReviewAnalysisResult = ReviewAnalysisResult()
    repo_analysis: RepoAnalysisResult = RepoAnalysisResult()

    strengths: str = ""
    weaknesses: str = ""
    growth_suggestions: str = ""
    red_flags: str = ""


# ── Health ────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str = "ok"
    postgres: str = "unknown"
    elasticsearch: str = "unknown"
    redis: str = "unknown"

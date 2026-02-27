"""
API routes — health, auth, analysis.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.elasticsearch import es_client
from app.core.redis import redis_client
from app.models.models import User, AnalysisJob, AnalysisStatus
from app.schemas.schemas import (
    AnalyzeRequest,
    AnalysisJobResponse,
    FullAnalysisResult,
    HealthResponse,
    UserResponse,
)
from app.services import es_service, cache_service
from app.services.github_fetcher import fetch_all_github_data, fetch_profile

router = APIRouter()


# ── Health ────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Check connectivity to Postgres, Elasticsearch, Redis."""
    pg_status = "ok"
    es_status = "ok"
    rd_status = "ok"

    try:
        await db.execute(select(1))
    except Exception:
        pg_status = "error"

    try:
        await es_client.ping()
    except Exception:
        es_status = "error"

    try:
        await redis_client.ping()
    except Exception:
        rd_status = "error"

    overall = "ok" if all(s == "ok" for s in [pg_status, es_status, rd_status]) else "degraded"
    return HealthResponse(status=overall, postgres=pg_status, elasticsearch=es_status, redis=rd_status)


# ── Users (simplified — no full OAuth yet, register via GitHub token) ──


@router.post("/api/users/register", response_model=UserResponse, tags=["users"])
async def register_user(github_username: str, db: AsyncSession = Depends(get_db)):
    """
    Quick registration: fetches GitHub profile and creates a User record.
    (Will be replaced by full OAuth flow later.)
    """
    # Check if user already exists
    stmt = select(User).where(User.github_username == github_username)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Fetch profile from GitHub
    profile = await fetch_profile(github_username)
    if not profile:
        raise HTTPException(status_code=404, detail=f"GitHub user '{github_username}' not found")

    user = User(
        github_id=profile["databaseId"],
        github_username=profile["login"],
        github_name=profile.get("name"),
        github_avatar_url=profile.get("avatarUrl"),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


# ── Analysis ──────────────────────────────────────────────────


async def _run_analysis(job_id: uuid.UUID, target_username: str, db_url: str):
    """
    Background task: fetch GitHub data → run RAG+ multi-agent pipeline → store results.
    """
    from app.core.database import async_session
    from app.agents.pipeline import run_analysis_pipeline

    async with async_session() as db:
        # Get the job
        stmt = select(AnalysisJob).where(AnalysisJob.id == job_id)
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            return

        try:
            # ── Step 1: Fetch GitHub data ─────────────────────
            job.status = AnalysisStatus.FETCHING
            job.started_at = datetime.now(timezone.utc)
            await db.commit()

            await cache_service.set_job_progress(str(job_id), {
                "step": "fetching", "message": "Fetching GitHub data..."
            })

            github_data = await fetch_all_github_data(target_username)

            # ── Step 2: Run multi-agent analysis pipeline ─────
            job.status = AnalysisStatus.ANALYZING
            await db.commit()

            async def progress_callback(step: str, message: str):
                await cache_service.set_job_progress(str(job_id), {
                    "step": step, "message": message
                })

            analysis_result = await run_analysis_pipeline(
                username=target_username,
                github_data=github_data,
                progress_callback=progress_callback,
            )

            # Attach job_id to the result
            analysis_result["job_id"] = str(job_id)

            # ── Step 3: Store in Elasticsearch ────────────────
            es_doc_id = str(job_id)
            await es_service.store_analysis_result(es_doc_id, analysis_result)

            job.status = AnalysisStatus.COMPLETED
            job.es_analysis_id = es_doc_id
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await cache_service.set_job_progress(str(job_id), {
                "step": "completed", "message": "Analysis complete!"
            })

        except Exception as e:
            job.status = AnalysisStatus.FAILED
            job.error_message = str(e)[:1000]
            await db.commit()

            await cache_service.set_job_progress(str(job_id), {
                "step": "failed", "message": str(e)[:500]
            })


@router.post("/api/analyze", response_model=AnalysisJobResponse, tags=["analysis"])
async def trigger_analysis(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a full analysis for a GitHub username.
    Returns the job immediately; analysis runs in background.
    """
    # Ensure user exists (auto-register)
    stmt = select(User).where(User.github_username == req.github_username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        profile = await fetch_profile(req.github_username)
        if not profile:
            raise HTTPException(status_code=404, detail=f"GitHub user '{req.github_username}' not found")
        user = User(
            github_id=profile["databaseId"],
            github_username=profile["login"],
            github_name=profile.get("name"),
            github_avatar_url=profile.get("avatarUrl"),
        )
        db.add(user)
        await db.flush()

    # Create analysis job
    job = AnalysisJob(
        user_id=user.id,
        target_username=req.github_username,
        status=AnalysisStatus.PENDING,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Launch background analysis
    background_tasks.add_task(
        _run_analysis, job.id, req.github_username, str(settings.database_url)
    )

    return job


@router.get("/api/analysis/job/{job_id}", response_model=AnalysisJobResponse, tags=["analysis"])
async def get_analysis_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get the status of an analysis job."""
    stmt = select(AnalysisJob).where(AnalysisJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Attach live progress from Redis
    progress = await cache_service.get_job_progress(str(job_id))
    if progress:
        job.progress = progress

    return job


@router.get("/api/analysis/{username}", response_model=FullAnalysisResult, tags=["analysis"])
async def get_analysis_result(username: str, db: AsyncSession = Depends(get_db)):
    """
    Get the latest completed analysis result for a GitHub user.
    Fetches from Elasticsearch.
    """
    # Find the latest completed job for this user
    stmt = (
        select(AnalysisJob)
        .where(
            AnalysisJob.target_username == username,
            AnalysisJob.status == AnalysisStatus.COMPLETED,
        )
        .order_by(AnalysisJob.completed_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job or not job.es_analysis_id:
        raise HTTPException(status_code=404, detail=f"No analysis found for '{username}'")

    # Fetch from Elasticsearch
    analysis = await es_service.get_analysis_result(job.es_analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis result missing from index")

    return FullAnalysisResult(**analysis)


@router.get("/api/analysis/{username}/jobs", response_model=list[AnalysisJobResponse], tags=["analysis"])
async def list_user_jobs(username: str, db: AsyncSession = Depends(get_db)):
    """List all analysis jobs for a given username."""
    stmt = (
        select(AnalysisJob)
        .where(AnalysisJob.target_username == username)
        .order_by(AnalysisJob.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return jobs


# Import settings for the background task
from app.core.config import settings  # noqa: E402

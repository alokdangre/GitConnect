"""
FastAPI application — entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.core.elasticsearch import close_es
from app.core.redis import close_redis
from app.services.es_service import create_user_analysis_index
from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────
    # Create PostgreSQL tables (dev convenience — use Alembic in prod)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Ensure Elasticsearch index exists
    await create_user_analysis_index()

    yield

    # ── Shutdown ──────────────────────────────────────────────
    await close_es()
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="AI-powered GitHub profile analyzer & talent platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────
app.include_router(router)

"""
Redis caching service for temporary GitHub data during analysis.
Data is cached with a TTL so it auto-expires — no permanent raw data storage.
"""

import json
from typing import Any

from app.core.redis import redis_client

# Default TTL: 4 hours — enough for retries, then auto-cleanup
DEFAULT_TTL = 4 * 60 * 60


def _key(namespace: str, username: str, sub: str = "") -> str:
    """Build a namespaced Redis key."""
    parts = ["gc", namespace, username]
    if sub:
        parts.append(sub)
    return ":".join(parts)


# ── Store / Retrieve GitHub Data ──────────────────────────────


async def cache_github_data(
    username: str, data_type: str, data: Any, ttl: int = DEFAULT_TTL
) -> None:
    """
    Cache GitHub data temporarily.
    data_type: 'profile' | 'prs' | 'issues' | 'reviews' | 'repos'
    """
    key = _key("github", username, data_type)
    await redis_client.set(key, json.dumps(data, default=str), ex=ttl)


async def get_cached_github_data(username: str, data_type: str) -> Any | None:
    """Retrieve cached GitHub data. Returns None if expired/missing."""
    key = _key("github", username, data_type)
    raw = await redis_client.get(key)
    if raw is None:
        return None
    return json.loads(raw)


async def clear_github_cache(username: str) -> None:
    """Delete all cached GitHub data for a user."""
    for dtype in ("profile", "prs", "issues", "reviews", "repos"):
        key = _key("github", username, dtype)
        await redis_client.delete(key)


# ── Analysis Job Progress ─────────────────────────────────────


async def set_job_progress(job_id: str, progress: dict, ttl: int = DEFAULT_TTL) -> None:
    """Store real-time analysis progress (for WebSocket / polling)."""
    key = _key("job", job_id, "progress")
    await redis_client.set(key, json.dumps(progress, default=str), ex=ttl)


async def get_job_progress(job_id: str) -> dict | None:
    """Retrieve analysis job progress."""
    key = _key("job", job_id, "progress")
    raw = await redis_client.get(key)
    if raw is None:
        return None
    return json.loads(raw)

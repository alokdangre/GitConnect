"""
Redis async client.
"""

import redis.asyncio as redis

from app.core.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> redis.Redis:
    """Return the shared Redis client."""
    return redis_client


async def close_redis() -> None:
    """Gracefully close Redis."""
    await redis_client.aclose()

"""
Elasticsearch async client singleton.
"""

from elasticsearch import AsyncElasticsearch

from app.core.config import settings

es_client = AsyncElasticsearch(hosts=[settings.elasticsearch_url])


async def get_es() -> AsyncElasticsearch:
    """Return the shared ES client."""
    return es_client


async def close_es() -> None:
    """Gracefully close the ES client."""
    await es_client.close()

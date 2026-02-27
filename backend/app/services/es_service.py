"""
Elasticsearch index management — single `user-analysis` index.
Raw GitHub data is NOT indexed; only analysis results are stored here.
"""

from app.core.elasticsearch import es_client

USER_ANALYSIS_INDEX = "user-analysis"

# ── Index Mapping ─────────────────────────────────────────────

USER_ANALYSIS_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,  # dev — bump to 1 for prod
    },
    "mappings": {
        "properties": {
            # ── Identity ──────────────────────────────────────
            "github_username": {"type": "keyword"},
            "github_id": {"type": "long"},
            "avatar_url": {"type": "keyword", "index": False},
            "analyzed_at": {"type": "date"},
            "job_id": {"type": "keyword"},

            # ── Overall Profile ───────────────────────────────
            "summary": {"type": "text"},  # Human-readable summary
            "overall_score": {"type": "float"},  # 0–100

            # ── Skills Radar ──────────────────────────────────
            "skills": {
                "type": "nested",
                "properties": {
                    "name": {"type": "keyword"},
                    "category": {"type": "keyword"},  # language, framework, tool, concept
                    "proficiency": {"type": "float"},  # 0–100
                    "evidence_count": {"type": "integer"},
                },
            },

            # ── PR Analysis Results ───────────────────────────
            "pr_analysis": {
                "properties": {
                    "total_prs": {"type": "integer"},
                    "quality_score": {"type": "float"},
                    "communication_score": {"type": "float"},
                    "ci_pass_rate": {"type": "float"},
                    "avg_complexity": {"type": "float"},
                    "spam_flag": {"type": "boolean"},
                    "ai_gen_flag": {"type": "boolean"},
                    "top_skills": {"type": "keyword"},
                    "detail": {"type": "text", "index": False},  # Full reasoning output
                },
            },

            # ── Issue Analysis Results ────────────────────────
            "issue_analysis": {
                "properties": {
                    "total_issues": {"type": "integer"},
                    "quality_score": {"type": "float"},
                    "description_clarity": {"type": "float"},
                    "criticality_avg": {"type": "float"},
                    "engagement_score": {"type": "float"},
                    "detail": {"type": "text", "index": False},
                },
            },

            # ── Review Analysis Results ───────────────────────
            "review_analysis": {
                "properties": {
                    "total_reviews": {"type": "integer"},
                    "quality_score": {"type": "float"},
                    "technical_depth": {"type": "float"},
                    "helpfulness": {"type": "float"},
                    "detail": {"type": "text", "index": False},
                },
            },

            # ── Repository Analysis Results ───────────────────
            "repo_analysis": {
                "properties": {
                    "total_repos": {"type": "integer"},
                    "avg_architecture_score": {"type": "float"},
                    "avg_documentation_score": {"type": "float"},
                    "avg_maturity_score": {"type": "float"},
                    "top_languages": {"type": "keyword"},
                    "detail": {"type": "text", "index": False},
                },
            },

            # ── Strengths / Weaknesses ────────────────────────
            "strengths": {"type": "text"},       # Agent-generated list
            "weaknesses": {"type": "text"},      # Agent-generated list
            "growth_suggestions": {"type": "text"},
            "red_flags": {"type": "text"},

            # ── Vector embedding (Phase 3/4: recommendations & job matching)
            # Disabled for MVP — uncomment when needed
            # "profile_embedding": {
            #     "type": "dense_vector",
            #     "dims": 1536,
            #     "index": True,
            #     "similarity": "cosine",
            # },
        }
    },
}


# ── Index Lifecycle ───────────────────────────────────────────


async def create_user_analysis_index() -> None:
    """Create the user-analysis index if it doesn't exist."""
    exists = await es_client.indices.exists(index=USER_ANALYSIS_INDEX)
    if not exists:
        await es_client.indices.create(
            index=USER_ANALYSIS_INDEX, body=USER_ANALYSIS_MAPPING
        )


async def delete_user_analysis_index() -> None:
    """Delete the index (dev/testing only)."""
    exists = await es_client.indices.exists(index=USER_ANALYSIS_INDEX)
    if exists:
        await es_client.indices.delete(index=USER_ANALYSIS_INDEX)


async def store_analysis_result(doc_id: str, body: dict) -> None:
    """Index or update an analysis result document."""
    await es_client.index(index=USER_ANALYSIS_INDEX, id=doc_id, document=body)


async def get_analysis_result(doc_id: str) -> dict | None:
    """Retrieve a single analysis result by ES doc ID."""
    try:
        resp = await es_client.get(index=USER_ANALYSIS_INDEX, id=doc_id)
        return resp["_source"]
    except Exception:
        return None


async def search_analyses(query: dict, size: int = 20) -> list[dict]:
    """Run an arbitrary ES query against the analysis index."""
    resp = await es_client.search(index=USER_ANALYSIS_INDEX, body=query, size=size)
    return [hit["_source"] for hit in resp["hits"]["hits"]]

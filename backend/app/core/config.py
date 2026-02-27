"""
Application settings — loaded from environment variables / .env file.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────
    app_name: str = "GitConnect"
    app_env: str = "development"
    secret_key: str = "change-me-in-production"

    # ── PostgreSQL ────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://gitconnect:gitconnect_dev@localhost:5432/gitconnect"
    )

    # ── Elasticsearch ─────────────────────────────────────────
    elasticsearch_url: str = "http://localhost:9200"

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── GitHub OAuth ──────────────────────────────────────────
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:3000/auth/callback"
    github_token: str = ""

    # ── OpenAI ────────────────────────────────────────────────
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o"

    # ── Frontend ──────────────────────────────────────────────
    frontend_url: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()

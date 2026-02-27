"""
Shared utilities for all analysis agents.
- OpenAI client setup
- Common prompt helpers
- JSON extraction from LLM responses
"""

import json
import re
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

# ── OpenAI Client ─────────────────────────────────────────────

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    """Lazy singleton for the async OpenAI client."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# ── LLM Call Helper ───────────────────────────────────────────


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """
    Call OpenAI chat completion and return the assistant message content.
    Uses low temperature for consistent, analytical output.
    """
    client = get_openai_client()
    resp = await client.chat.completions.create(
        model=model or settings.openai_chat_model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return resp.choices[0].message.content or ""


# ── JSON Extraction ───────────────────────────────────────────


def extract_json(text: str) -> dict[str, Any]:
    """
    Extract a JSON object from LLM output.
    Handles markdown code fences, leading text, etc.
    """
    # Try to find JSON in code fences first
    fence_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
    if fence_match:
        candidate = fence_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Try to find a raw JSON object
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # Last resort: return empty dict
    return {}


# ── Data Truncation ───────────────────────────────────────────


def truncate_list(items: list, max_items: int = 20, max_chars_per_item: int = 2000) -> list:
    """
    Truncate a list of items to fit within LLM context limits.
    Each item (if it's a dict) gets its large text fields trimmed.
    """
    result = []
    for item in items[:max_items]:
        if isinstance(item, dict):
            trimmed = {}
            for k, v in item.items():
                if isinstance(v, str) and len(v) > max_chars_per_item:
                    trimmed[k] = v[:max_chars_per_item] + "... [truncated]"
                else:
                    trimmed[k] = v
            result.append(trimmed)
        else:
            result.append(item)
    return result


def summarize_data_for_prompt(data: Any, max_chars: int = 12000) -> str:
    """Convert data to a JSON string, truncated to max_chars."""
    text = json.dumps(data, indent=2, default=str)
    if len(text) > max_chars:
        return text[:max_chars] + "\n... [truncated]"
    return text

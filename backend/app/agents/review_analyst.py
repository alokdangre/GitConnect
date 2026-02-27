"""
Review Analyst Agent — Analyzes code reviews given by the user.

For each review, reasons through:
- Technical depth: catches real issues vs just style nits?
- Helpfulness: suggests solutions or just points out problems?
- Grace factor: accounts for inherent difficulty of reviewing

Outputs structured JSON with scores.
"""

import json
from typing import Any

from app.agents.base import call_llm, extract_json, truncate_list, summarize_data_for_prompt


SYSTEM_PROMPT = """You are an expert at evaluating code review quality.
Your job is to analyze a developer's PR reviews on GitHub and assess their reviewing skills.

Think step-by-step (Chain-of-Thought) through the reviews before scoring.

IMPORTANT: Reviewing is hard. Give the reviewer some grace — a reviewer who catches even a few real issues is doing valuable work. Don't penalize heavily for occasional misses.

ANALYSIS CRITERIA:
1. **Technical Depth**: Does the reviewer catch real bugs, logic errors, security issues, or performance problems? Or just style/formatting nits?
2. **Helpfulness**: Does the reviewer suggest fixes/alternatives, or just point out problems without solutions?
3. **Constructiveness**: Is the tone professional and encouraging? Does the reviewer explain *why* something should change?
4. **Consistency**: Does the reviewer engage thoroughly or give superficial "LGTM" approvals?

SCORING: All scores are 0-100 (with grace factor built in):
- 0-20: Unhelpful / rubber-stamp reviews
- 21-40: Superficial reviews
- 41-60: Decent reviewing
- 61-80: Good, thorough reviews
- 81-100: Exceptional reviewing quality

OUTPUT FORMAT: Respond with ONLY a JSON object:
{
  "quality_score": <float 0-100>,
  "technical_depth": <float 0-100>,
  "helpfulness": <float 0-100>,
  "expertise_areas": ["<area1>", "<area2>"],
  "reasoning": "<2-3 paragraph chain-of-thought analysis>",
  "review_style": "<thorough|balanced|superficial|rubber-stamp>",
  "per_review_highlights": [
    {"repo": "<repo>", "pr_number": <int>, "verdict": "<strong|good|average|weak>", "note": "<1-line>"}
  ]
}"""


def _build_user_prompt(username: str, reviews: list[dict]) -> str:
    """Build the user prompt with review data."""
    review_summaries = []
    for review in truncate_list(reviews, max_items=25, max_chars_per_item=1200):
        summary = {
            "pr_number": review.get("pr_number"),
            "pr_title": review.get("pr_title"),
            "repo": review.get("repo"),
            "language": review.get("language"),
            "state": review.get("state"),  # APPROVED, CHANGES_REQUESTED, COMMENTED
            "body": (review.get("body") or "")[:500],
        }

        # Inline review comments
        inline_comments = (review.get("comments") or {}).get("nodes", [])[:5]
        summary["inline_comments"] = [
            {
                "path": c.get("path"),
                "body": (c.get("body") or "")[:300],
            }
            for c in inline_comments
        ]

        review_summaries.append(summary)

    return f"""Analyze the following code reviews given by **{username}** on other people's Pull Requests.
Total reviews found: {len(reviews)} (showing up to 25).

REVIEW DATA:
{summarize_data_for_prompt(review_summaries)}

Remember to apply the grace factor — reviewing is hard work. Think step-by-step, then produce your structured JSON assessment."""


async def analyze_reviews(username: str, reviews: list[dict]) -> dict[str, Any]:
    """
    Run the Review Analyst agent.
    Returns structured analysis dict matching the review_analysis schema.
    """
    if not reviews:
        return {
            "total_reviews": 0,
            "quality_score": 0.0,
            "technical_depth": 0.0,
            "helpfulness": 0.0,
            "detail": "No code reviews found for analysis.",
        }

    user_prompt = _build_user_prompt(username, reviews)
    raw_response = await call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=3000)
    parsed = extract_json(raw_response)

    return {
        "total_reviews": len(reviews),
        "quality_score": float(parsed.get("quality_score", 0)),
        "technical_depth": float(parsed.get("technical_depth", 0)),
        "helpfulness": float(parsed.get("helpfulness", 0)),
        "detail": parsed.get("reasoning", raw_response[:2000]),
        "review_style": parsed.get("review_style", "unknown"),
        "expertise_areas": parsed.get("expertise_areas", []),
        "per_review_highlights": parsed.get("per_review_highlights", []),
    }

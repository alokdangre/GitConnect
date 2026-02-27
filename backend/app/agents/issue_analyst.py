"""
Issue Analyst Agent — Analyzes issues for quality, communication, engagement.

For each issue, reasons through:
- Quality of description: clarity, reproducibility, context
- Criticality: bug severity, feature importance
- Discussion: how user engages with community responses
- Topic expertise areas revealed

Outputs structured JSON with scores.
"""

import json
from typing import Any

from app.agents.base import call_llm, extract_json, truncate_list, summarize_data_for_prompt


SYSTEM_PROMPT = """You are an expert open source community analyst.
Your job is to analyze a developer's GitHub Issues and produce a structured assessment.

Think step-by-step (Chain-of-Thought) through the issues before scoring.

ANALYSIS CRITERIA:
1. **Description Quality**: Are issues well-written? Do they include reproduction steps, context, expected vs actual behavior?
2. **Criticality Understanding**: Does the developer report important bugs and suggest valuable features, or file trivial/noisy issues?
3. **Engagement**: How does the developer interact in issue discussions? Are they responsive, constructive, helpful?
4. **Expertise Signals**: What domains/technologies do the issues reveal knowledge in?

SCORING: All scores are 0-100 where:
- 0-20: Poor / spammy
- 21-40: Below average
- 41-60: Average
- 61-80: Good
- 81-100: Excellent

OUTPUT FORMAT: Respond with ONLY a JSON object:
{
  "quality_score": <float 0-100>,
  "description_clarity": <float 0-100>,
  "criticality_avg": <float 0-100>,
  "engagement_score": <float 0-100>,
  "topic_areas": ["<area1>", "<area2>"],
  "reasoning": "<2-3 paragraph chain-of-thought analysis>",
  "per_issue_highlights": [
    {"repo": "<repo>", "issue_number": <int>, "verdict": "<strong|good|average|weak>", "note": "<1-line>"}
  ]
}"""


def _build_user_prompt(username: str, issues: list[dict]) -> str:
    """Build the user prompt with issue data."""
    issue_summaries = []
    for issue in truncate_list(issues, max_items=30, max_chars_per_item=1200):
        summary = {
            "number": issue.get("number"),
            "title": issue.get("title"),
            "body": (issue.get("body") or "")[:600],
            "state": issue.get("state"),
            "repo": (issue.get("repository") or {}).get("nameWithOwner"),
            "language": ((issue.get("repository") or {}).get("primaryLanguage") or {}).get("name"),
            "labels": [l["name"] for l in (issue.get("labels") or {}).get("nodes", [])],
            "reactions": (issue.get("reactions") or {}).get("totalCount", 0),
            "comments_count": len((issue.get("comments") or {}).get("nodes", [])),
        }

        # Comment snippets
        comments = (issue.get("comments") or {}).get("nodes", [])[:3]
        summary["comment_snippets"] = [
            {"author": (c.get("author") or {}).get("login"), "body": (c.get("body") or "")[:200]}
            for c in comments
        ]

        issue_summaries.append(summary)

    return f"""Analyze the following GitHub Issues created/participated in by **{username}**.
Total issues found: {len(issues)} (showing up to 30 most recent).

ISSUE DATA:
{summarize_data_for_prompt(issue_summaries)}

Think step-by-step, then produce your structured JSON assessment."""


async def analyze_issues(username: str, issues: list[dict]) -> dict[str, Any]:
    """
    Run the Issue Analyst agent.
    Returns structured analysis dict matching the issue_analysis schema.
    """
    if not issues:
        return {
            "total_issues": 0,
            "quality_score": 0.0,
            "description_clarity": 0.0,
            "criticality_avg": 0.0,
            "engagement_score": 0.0,
            "detail": "No issues found for analysis.",
        }

    user_prompt = _build_user_prompt(username, issues)
    raw_response = await call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=3000)
    parsed = extract_json(raw_response)

    return {
        "total_issues": len(issues),
        "quality_score": float(parsed.get("quality_score", 0)),
        "description_clarity": float(parsed.get("description_clarity", 0)),
        "criticality_avg": float(parsed.get("criticality_avg", 0)),
        "engagement_score": float(parsed.get("engagement_score", 0)),
        "detail": parsed.get("reasoning", raw_response[:2000]),
        "topic_areas": parsed.get("topic_areas", []),
        "per_issue_highlights": parsed.get("per_issue_highlights", []),
    }

"""
PR Analyst Agent — Analyzes pull requests for quality, skills, patterns.

For each PR, reasons through:
- What issue does it solve? Skills/learnings extracted
- Conversation quality: communication, responsiveness, receptiveness
- CI status: failure rate, how quickly failures were addressed
- Code quality: AI-generated? Substantive or trivial? Reviewer burden?
- Chain-of-Thought structured quality judgment

Outputs structured JSON with scores and extracted skills.
"""

import json
from typing import Any

from app.agents.base import call_llm, extract_json, truncate_list, summarize_data_for_prompt


SYSTEM_PROMPT = """You are an expert code reviewer and software engineering analyst.
Your job is to analyze a developer's Pull Requests on GitHub and produce a structured assessment.

You must think step-by-step (Chain-of-Thought) through each PR before producing scores.

ANALYSIS CRITERIA:
1. **Quality**: Are the PRs substantive? Do they solve real problems? Are changes well-structured?
2. **Skills**: What programming languages, frameworks, and concepts does the developer demonstrate?
3. **Communication**: How well does the developer communicate in PR descriptions and conversations?
   - Clear descriptions, responsiveness to review feedback, constructive discussion
4. **CI Discipline**: Does the developer maintain passing CI? How quickly are failures addressed?
5. **Red Flags**: Signs of AI-generated code spam, trivial/low-effort PRs, or PRs that increase reviewer burden without adding value.

SCORING: All scores are 0-100 where:
- 0-20: Poor / Very low quality
- 21-40: Below average
- 41-60: Average / Acceptable
- 61-80: Good / Above average
- 81-100: Excellent / Outstanding

OUTPUT FORMAT: You must respond with ONLY a JSON object (no markdown fences, no extra text):
{
  "quality_score": <float 0-100>,
  "communication_score": <float 0-100>,
  "ci_pass_rate": <float 0-100>,
  "avg_complexity": <float 0-100>,
  "spam_flag": <boolean>,
  "ai_gen_flag": <boolean>,
  "skills_extracted": [
    {"name": "<skill>", "category": "<language|framework|tool|concept>", "evidence_count": <int>}
  ],
  "top_skills": ["<skill1>", "<skill2>", ...],
  "reasoning": "<2-4 paragraph chain-of-thought analysis explaining your scores>",
  "per_pr_highlights": [
    {"repo": "<repo>", "pr_number": <int>, "verdict": "<strong|good|average|weak|spam>", "note": "<1-line>"}
  ]
}"""


def _build_user_prompt(username: str, prs: list[dict]) -> str:
    """Build the user prompt with PR data."""
    # Prepare PR summaries for the LLM
    pr_summaries = []
    for pr in truncate_list(prs, max_items=30, max_chars_per_item=1500):
        summary = {
            "number": pr.get("number"),
            "title": pr.get("title"),
            "body": (pr.get("body") or "")[:800],
            "state": pr.get("state"),
            "merged": pr.get("merged"),
            "additions": pr.get("additions"),
            "deletions": pr.get("deletions"),
            "changedFiles": pr.get("changedFiles"),
            "repo": (pr.get("repository") or {}).get("nameWithOwner"),
            "language": ((pr.get("repository") or {}).get("primaryLanguage") or {}).get("name"),
            "labels": [l["name"] for l in (pr.get("labels") or {}).get("nodes", [])],
            "ci_status": None,
            "reviews": [],
            "comments_count": len((pr.get("comments") or {}).get("nodes", [])),
            "linked_issues": [
                i.get("title") for i in (pr.get("closingIssuesReferences") or {}).get("nodes", [])
            ],
        }

        # Extract CI status
        commits = (pr.get("commits") or {}).get("nodes", [])
        if commits:
            rollup = (commits[0].get("commit") or {}).get("statusCheckRollup")
            if rollup:
                summary["ci_status"] = rollup.get("state")

        # Extract review summaries
        for review in (pr.get("reviews") or {}).get("nodes", [])[:5]:
            summary["reviews"].append({
                "state": review.get("state"),
                "body": (review.get("body") or "")[:300],
                "reviewer": (review.get("author") or {}).get("login"),
            })

        # Extract comment snippets
        comments = (pr.get("comments") or {}).get("nodes", [])[:3]
        summary["comment_snippets"] = [
            {"author": (c.get("author") or {}).get("login"), "body": (c.get("body") or "")[:200]}
            for c in comments
        ]

        pr_summaries.append(summary)

    return f"""Analyze the following Pull Requests by GitHub user **{username}**.
Total PRs found: {len(prs)} (showing up to 30 most recent).

PR DATA:
{summarize_data_for_prompt(pr_summaries)}

Think step-by-step through the PRs, then produce your structured JSON assessment."""


async def analyze_prs(username: str, prs: list[dict]) -> dict[str, Any]:
    """
    Run the PR Analyst agent on a user's PRs.
    Returns structured analysis dict matching the pr_analysis schema.
    """
    if not prs:
        return {
            "total_prs": 0,
            "quality_score": 0.0,
            "communication_score": 0.0,
            "ci_pass_rate": 0.0,
            "avg_complexity": 0.0,
            "spam_flag": False,
            "ai_gen_flag": False,
            "top_skills": [],
            "detail": "No pull requests found for analysis.",
            "skills_extracted": [],
        }

    user_prompt = _build_user_prompt(username, prs)
    raw_response = await call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    parsed = extract_json(raw_response)

    # Build the result with safe defaults
    return {
        "total_prs": len(prs),
        "quality_score": float(parsed.get("quality_score", 0)),
        "communication_score": float(parsed.get("communication_score", 0)),
        "ci_pass_rate": float(parsed.get("ci_pass_rate", 0)),
        "avg_complexity": float(parsed.get("avg_complexity", 0)),
        "spam_flag": bool(parsed.get("spam_flag", False)),
        "ai_gen_flag": bool(parsed.get("ai_gen_flag", False)),
        "top_skills": parsed.get("top_skills", [])[:10],
        "detail": parsed.get("reasoning", raw_response[:2000]),
        "skills_extracted": parsed.get("skills_extracted", []),
        "per_pr_highlights": parsed.get("per_pr_highlights", []),
    }

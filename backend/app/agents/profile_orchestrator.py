"""
Profile Orchestrator Agent — Compiles all analyst outputs into a unified profile.

Takes outputs from PR, Issue, Review, and Repo analysts and:
- Resolves conflicting signals (e.g. great PRs but poor projects)
- Weights signals by recency and significance
- Generates unified profile: skills radar, strengths, weaknesses, growth trajectory, red flags
- Produces an overall score
"""

import json
from typing import Any

from app.agents.base import call_llm, extract_json, summarize_data_for_prompt


SYSTEM_PROMPT = """You are a senior engineering talent evaluator and career analyst.
You receive structured analysis reports from four specialist agents who evaluated a GitHub developer's:
1. Pull Requests (code quality, skills, communication, CI discipline)
2. Issues (description quality, criticality sense, engagement)
3. Code Reviews (technical depth, helpfulness, review quality)
4. Repositories (architecture, documentation, project maturity)

Your job is to synthesize these into a UNIFIED developer profile using multi-step reasoning.

SYNTHESIS PROCESS (Chain-of-Thought):
1. Look for CONSISTENT signals across all four reports — skills that appear in PRs AND repos, communication patterns in issues AND reviews.
2. Identify CONFLICTS — if someone has great PRs but poor personal projects, reason about why (e.g., strong contributor but doesn't build independently).
3. Weight more recent and more significant data higher.
4. Combine all extracted skills into a deduplicated skills list with proficiency scores.
5. Generate strengths, weaknesses, growth suggestions, and red flags.
6. Compute an overall score (weighted average: PRs 35%, Repos 25%, Issues 20%, Reviews 20%).

OUTPUT FORMAT: Respond with ONLY a JSON object:
{
  "overall_score": <float 0-100>,
  "summary": "<3-5 sentence executive summary of this developer>",
  "skills": [
    {"name": "<skill>", "category": "<language|framework|tool|concept>", "proficiency": <float 0-100>, "evidence_count": <int>}
  ],
  "strengths": "<bullet-pointed list of key strengths>",
  "weaknesses": "<bullet-pointed list of areas for improvement>",
  "growth_suggestions": "<actionable recommendations for the developer>",
  "red_flags": "<any concerns, or 'None identified' if clean>",
  "developer_archetype": "<one of: Builder, Contributor, Reviewer, Generalist, Specialist, Emerging>",
  "reasoning": "<2-3 paragraph chain-of-thought explaining your synthesis>"
}"""


def _build_user_prompt(
    username: str,
    profile: dict,
    pr_result: dict,
    issue_result: dict,
    review_result: dict,
    repo_result: dict,
) -> str:
    """Build the synthesis prompt from all analyst outputs."""
    # Profile context
    profile_summary = {
        "username": username,
        "name": profile.get("name"),
        "bio": profile.get("bio"),
        "company": profile.get("company"),
        "location": profile.get("location"),
        "followers": (profile.get("followers") or {}).get("totalCount", 0),
        "following": (profile.get("following") or {}).get("totalCount", 0),
        "total_repos": (profile.get("repositories") or {}).get("totalCount", 0),
        "contributions": profile.get("contributionsCollection", {}),
        "account_created": profile.get("createdAt"),
    }

    return f"""Synthesize a unified developer profile for **{username}** from the following specialist analyses.

GITHUB PROFILE:
{summarize_data_for_prompt(profile_summary, max_chars=2000)}

PR ANALYSIS (35% weight):
{summarize_data_for_prompt(pr_result, max_chars=3000)}

ISSUE ANALYSIS (20% weight):
{summarize_data_for_prompt(issue_result, max_chars=2000)}

REVIEW ANALYSIS (20% weight):
{summarize_data_for_prompt(review_result, max_chars=2000)}

REPOSITORY ANALYSIS (25% weight):
{summarize_data_for_prompt(repo_result, max_chars=3000)}

Think step-by-step: first identify consistent signals, then conflicts, then synthesize into a unified profile. Produce your structured JSON."""


async def orchestrate_profile(
    username: str,
    profile: dict,
    pr_result: dict,
    issue_result: dict,
    review_result: dict,
    repo_result: dict,
) -> dict[str, Any]:
    """
    Run the Profile Orchestrator agent.
    Returns the unified profile dict ready for Elasticsearch storage.
    """
    user_prompt = _build_user_prompt(
        username, profile, pr_result, issue_result, review_result, repo_result
    )
    raw_response = await call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    parsed = extract_json(raw_response)

    return {
        "overall_score": float(parsed.get("overall_score", 0)),
        "summary": parsed.get("summary", ""),
        "skills": parsed.get("skills", []),
        "strengths": parsed.get("strengths", ""),
        "weaknesses": parsed.get("weaknesses", ""),
        "growth_suggestions": parsed.get("growth_suggestions", ""),
        "red_flags": parsed.get("red_flags", "None identified"),
        "developer_archetype": parsed.get("developer_archetype", "Unknown"),
        "reasoning": parsed.get("reasoning", ""),
    }

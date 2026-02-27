"""
Analysis Pipeline — Orchestrates the full RAG+ multi-agent analysis flow.

Flow:
  1. Fetch GitHub data (already cached in Redis)
  2. Run 4 analyst agents in parallel (PR, Issue, Review, Repo)
  3. Feed all results into the Profile Orchestrator
  4. Return the unified analysis result

Each agent runs independently, then the orchestrator synthesizes.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.agents.pr_analyst import analyze_prs
from app.agents.issue_analyst import analyze_issues
from app.agents.review_analyst import analyze_reviews
from app.agents.repo_analyst import analyze_repos
from app.agents.profile_orchestrator import orchestrate_profile


async def run_analysis_pipeline(
    username: str,
    github_data: dict[str, Any],
    progress_callback=None,
) -> dict[str, Any]:
    """
    Run the full multi-agent analysis pipeline.

    Args:
        username: GitHub username being analyzed
        github_data: Dict with keys: profile, prs, issues, reviews, repos
        progress_callback: Optional async callable(step, message) for progress updates

    Returns:
        Complete analysis result dict ready for Elasticsearch storage.
    """
    profile = github_data["profile"]
    prs = github_data["prs"]
    issues = github_data["issues"]
    reviews = github_data["reviews"]
    repos = github_data["repos"]

    # ── Step 1: Run all 4 analysts in parallel ────────────────
    if progress_callback:
        await progress_callback("analyzing_prs", "Analyzing pull requests...")

    # Run all agents concurrently — they're independent
    pr_result, issue_result, review_result, repo_result = await asyncio.gather(
        analyze_prs(username, prs),
        analyze_issues(username, issues),
        analyze_reviews(username, reviews),
        analyze_repos(username, repos),
    )

    if progress_callback:
        await progress_callback("orchestrating", "Synthesizing unified profile...")

    # ── Step 2: Run the Profile Orchestrator ──────────────────
    orchestrated = await orchestrate_profile(
        username=username,
        profile=profile,
        pr_result=pr_result,
        issue_result=issue_result,
        review_result=review_result,
        repo_result=repo_result,
    )

    # ── Step 3: Assemble final result ─────────────────────────
    analysis_result = {
        "github_username": username,
        "github_id": profile.get("databaseId"),
        "avatar_url": profile.get("avatarUrl"),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),

        # From orchestrator
        "summary": orchestrated.get("summary", ""),
        "overall_score": orchestrated.get("overall_score", 0.0),
        "skills": orchestrated.get("skills", []),
        "strengths": orchestrated.get("strengths", ""),
        "weaknesses": orchestrated.get("weaknesses", ""),
        "growth_suggestions": orchestrated.get("growth_suggestions", ""),
        "red_flags": orchestrated.get("red_flags", ""),

        # From individual analysts
        "pr_analysis": {
            "total_prs": pr_result.get("total_prs", 0),
            "quality_score": pr_result.get("quality_score", 0.0),
            "communication_score": pr_result.get("communication_score", 0.0),
            "ci_pass_rate": pr_result.get("ci_pass_rate", 0.0),
            "avg_complexity": pr_result.get("avg_complexity", 0.0),
            "spam_flag": pr_result.get("spam_flag", False),
            "ai_gen_flag": pr_result.get("ai_gen_flag", False),
            "top_skills": pr_result.get("top_skills", []),
            "detail": pr_result.get("detail", ""),
        },
        "issue_analysis": {
            "total_issues": issue_result.get("total_issues", 0),
            "quality_score": issue_result.get("quality_score", 0.0),
            "description_clarity": issue_result.get("description_clarity", 0.0),
            "criticality_avg": issue_result.get("criticality_avg", 0.0),
            "engagement_score": issue_result.get("engagement_score", 0.0),
            "detail": issue_result.get("detail", ""),
        },
        "review_analysis": {
            "total_reviews": review_result.get("total_reviews", 0),
            "quality_score": review_result.get("quality_score", 0.0),
            "technical_depth": review_result.get("technical_depth", 0.0),
            "helpfulness": review_result.get("helpfulness", 0.0),
            "detail": review_result.get("detail", ""),
        },
        "repo_analysis": {
            "total_repos": repo_result.get("total_repos", 0),
            "avg_architecture_score": repo_result.get("avg_architecture_score", 0.0),
            "avg_documentation_score": repo_result.get("avg_documentation_score", 0.0),
            "avg_maturity_score": repo_result.get("avg_maturity_score", 0.0),
            "top_languages": repo_result.get("top_languages", []),
            "detail": repo_result.get("detail", ""),
        },
    }

    return analysis_result

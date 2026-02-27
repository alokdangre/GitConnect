"""
Repo Analyst Agent — Analyzes user's repositories/projects.

For each repo, reasons through:
- Architecture quality: folder structure, separation of concerns, patterns
- Tech stack validation: appropriate technologies for the problem?
- Documentation quality: README completeness, contribution guidelines
- Project maturity: CI/CD, tests, releases, community engagement

Outputs structured JSON with scores.
"""

import json
from typing import Any

from app.agents.base import call_llm, extract_json, truncate_list, summarize_data_for_prompt


SYSTEM_PROMPT = """You are an expert software architect and project evaluator.
Your job is to analyze a developer's GitHub repositories and assess their project-building skills.

Think step-by-step (Chain-of-Thought) through each repository before scoring.

ANALYSIS CRITERIA:
1. **Architecture**: Does the project show good structure? Separation of concerns, clean folder layout, appropriate design patterns?
2. **Tech Stack**: Are the chosen technologies appropriate for the problem being solved? Is the stack modern and well-integrated?
3. **Documentation**: Is the README informative? Does it explain setup, usage, and purpose? Are there contribution guidelines?
4. **Project Maturity**: Does the project have CI/CD, tests, releases, proper versioning? Is it maintained?
5. **Complexity & Ambition**: Is this a toy project or something meaningful? Does it show problem-solving ability?

SCORING: All scores are 0-100:
- 0-20: Toy projects / no effort
- 21-40: Basic projects with minimal structure
- 41-60: Decent projects, some structure
- 61-80: Well-structured, thoughtful projects
- 81-100: Production-quality, impressive engineering

OUTPUT FORMAT: Respond with ONLY a JSON object:
{
  "avg_architecture_score": <float 0-100>,
  "avg_documentation_score": <float 0-100>,
  "avg_maturity_score": <float 0-100>,
  "top_languages": ["<lang1>", "<lang2>"],
  "tech_breadth_score": <float 0-100>,
  "reasoning": "<2-4 paragraph chain-of-thought analysis>",
  "per_repo_highlights": [
    {"repo": "<name>", "verdict": "<impressive|good|average|basic|toy>", "note": "<1-line>"}
  ],
  "notable_patterns": ["<pattern1>", "<pattern2>"]
}"""


def _build_user_prompt(username: str, repos: list[dict]) -> str:
    """Build the user prompt with repository data."""
    repo_summaries = []
    for repo in truncate_list(repos, max_items=20, max_chars_per_item=2000):
        # Extract languages
        languages = [l["name"] for l in (repo.get("languages") or {}).get("nodes", [])]

        # Extract topics
        topics = [t["topic"]["name"] for t in (repo.get("repositoryTopics") or {}).get("nodes", [])]

        # Commit info
        default_branch = repo.get("defaultBranchRef") or {}
        target = default_branch.get("target") or {}
        history = target.get("history") or {}
        total_commits = history.get("totalCount", 0)
        last_commit_nodes = history.get("nodes", [])
        last_commit_date = last_commit_nodes[0].get("committedDate") if last_commit_nodes else None

        # README
        readme_obj = repo.get("object") or {}
        readme_text = readme_obj.get("text") or ""

        summary = {
            "name": repo.get("name"),
            "nameWithOwner": repo.get("nameWithOwner"),
            "description": repo.get("description"),
            "primary_language": (repo.get("primaryLanguage") or {}).get("name"),
            "languages": languages,
            "stars": repo.get("stargazerCount", 0),
            "forks": repo.get("forkCount", 0),
            "watchers": (repo.get("watchers") or {}).get("totalCount", 0),
            "open_issues": (repo.get("issues") or {}).get("totalCount", 0),
            "open_prs": (repo.get("pullRequests") or {}).get("totalCount", 0),
            "releases": (repo.get("releases") or {}).get("totalCount", 0),
            "total_commits": total_commits,
            "last_commit_date": last_commit_date,
            "topics": topics,
            "has_wiki": repo.get("hasWikiEnabled", False),
            "license": (repo.get("licenseInfo") or {}).get("spdxId"),
            "created_at": repo.get("createdAt"),
            "updated_at": repo.get("updatedAt"),
            "readme_preview": readme_text[:1500] if readme_text else "[No README]",
        }
        repo_summaries.append(summary)

    return f"""Analyze the following GitHub repositories owned by **{username}**.
Total repositories: {len(repos)} (showing up to 20, sorted by stars).

REPOSITORY DATA:
{summarize_data_for_prompt(repo_summaries)}

Think step-by-step through each project's quality, then produce your structured JSON assessment."""


async def analyze_repos(username: str, repos: list[dict]) -> dict[str, Any]:
    """
    Run the Repo Analyst agent.
    Returns structured analysis dict matching the repo_analysis schema.
    """
    if not repos:
        return {
            "total_repos": 0,
            "avg_architecture_score": 0.0,
            "avg_documentation_score": 0.0,
            "avg_maturity_score": 0.0,
            "top_languages": [],
            "detail": "No repositories found for analysis.",
        }

    user_prompt = _build_user_prompt(username, repos)
    raw_response = await call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    parsed = extract_json(raw_response)

    return {
        "total_repos": len(repos),
        "avg_architecture_score": float(parsed.get("avg_architecture_score", 0)),
        "avg_documentation_score": float(parsed.get("avg_documentation_score", 0)),
        "avg_maturity_score": float(parsed.get("avg_maturity_score", 0)),
        "top_languages": parsed.get("top_languages", [])[:10],
        "detail": parsed.get("reasoning", raw_response[:2000]),
        "tech_breadth_score": float(parsed.get("tech_breadth_score", 0)),
        "per_repo_highlights": parsed.get("per_repo_highlights", []),
        "notable_patterns": parsed.get("notable_patterns", []),
    }

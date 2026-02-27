"""
GitHub GraphQL data fetcher.
Fetches PRs, issues, reviews, and repos for a given username.
Data is cached in Redis (TTL) — never stored permanently.
"""

import httpx
from typing import Any

from app.core.config import settings
from app.services.cache_service import cache_github_data, get_cached_github_data

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Content-Type": "application/json",
    }


async def _graphql(query: str, variables: dict | None = None) -> dict:
    """Execute a GitHub GraphQL query."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GITHUB_GRAPHQL_URL,
            json={"query": query, "variables": variables or {}},
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"GitHub GraphQL error: {data['errors']}")
        return data["data"]


# ── Profile ───────────────────────────────────────────────────


PROFILE_QUERY = """
query($username: String!) {
  user(login: $username) {
    login
    databaseId
    name
    avatarUrl
    bio
    company
    location
    followers { totalCount }
    following { totalCount }
    repositories(ownerAffiliations: OWNER, first: 0) { totalCount }
    pullRequests(first: 0) { totalCount }
    issues(first: 0) { totalCount }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { totalContributions }
    }
    createdAt
  }
}
"""


async def fetch_profile(username: str) -> dict:
    """Fetch GitHub user profile. Returns cached if available."""
    cached = await get_cached_github_data(username, "profile")
    if cached:
        return cached

    data = await _graphql(PROFILE_QUERY, {"username": username})
    profile = data["user"]
    await cache_github_data(username, "profile", profile)
    return profile


# ── Pull Requests ─────────────────────────────────────────────


PRS_QUERY = """
query($username: String!, $cursor: String) {
  user(login: $username) {
    pullRequests(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        body
        state
        merged
        additions
        deletions
        changedFiles
        createdAt
        mergedAt
        closedAt
        repository {
          nameWithOwner
          primaryLanguage { name }
          stargazerCount
        }
        labels(first: 10) { nodes { name } }
        commits(first: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
        reviews(first: 20) {
          nodes {
            state
            body
            author { login }
          }
        }
        comments(first: 30) {
          nodes {
            body
            author { login }
            createdAt
          }
        }
        closingIssuesReferences(first: 5) {
          nodes {
            number
            title
          }
        }
      }
    }
  }
}
"""


async def fetch_pull_requests(username: str, max_pages: int = 4) -> list[dict]:
    """Fetch user's PRs with conversations, CI status, linked issues."""
    cached = await get_cached_github_data(username, "prs")
    if cached:
        return cached

    all_prs: list[dict] = []
    cursor = None

    for _ in range(max_pages):
        data = await _graphql(PRS_QUERY, {"username": username, "cursor": cursor})
        pr_data = data["user"]["pullRequests"]
        all_prs.extend(pr_data["nodes"])

        if not pr_data["pageInfo"]["hasNextPage"]:
            break
        cursor = pr_data["pageInfo"]["endCursor"]

    await cache_github_data(username, "prs", all_prs)
    return all_prs


# ── Issues ────────────────────────────────────────────────────


ISSUES_QUERY = """
query($username: String!, $cursor: String) {
  user(login: $username) {
    issues(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        body
        state
        createdAt
        closedAt
        repository {
          nameWithOwner
          primaryLanguage { name }
        }
        labels(first: 10) { nodes { name } }
        comments(first: 20) {
          nodes {
            body
            author { login }
            createdAt
          }
        }
        reactions { totalCount }
      }
    }
  }
}
"""


async def fetch_issues(username: str, max_pages: int = 4) -> list[dict]:
    """Fetch issues created/participated in by the user."""
    cached = await get_cached_github_data(username, "issues")
    if cached:
        return cached

    all_issues: list[dict] = []
    cursor = None

    for _ in range(max_pages):
        data = await _graphql(ISSUES_QUERY, {"username": username, "cursor": cursor})
        issue_data = data["user"]["issues"]
        all_issues.extend(issue_data["nodes"])

        if not issue_data["pageInfo"]["hasNextPage"]:
            break
        cursor = issue_data["pageInfo"]["endCursor"]

    await cache_github_data(username, "issues", all_issues)
    return all_issues


# ── Reviews (given by user) ──────────────────────────────────

# GitHub GraphQL doesn't have a direct "reviews given" connection on User, so we
# get them from the user's contributionsCollection or by querying PRs they reviewed.
# Simplified approach: fetch via search query.

REVIEWS_QUERY = """
query($query: String!, $cursor: String) {
  search(query: $query, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        title
        repository { nameWithOwner primaryLanguage { name } }
        createdAt
        reviews(first: 50) {
          nodes {
            author { login }
            state
            body
            comments(first: 20) {
              nodes {
                body
                path
                position
              }
            }
            createdAt
          }
        }
      }
    }
  }
}
"""


async def fetch_reviews(username: str, max_pages: int = 3) -> list[dict]:
    """Fetch PR reviews authored by the user."""
    cached = await get_cached_github_data(username, "reviews")
    if cached:
        return cached

    search_query = f"reviewed-by:{username} is:pr"
    all_reviews: list[dict] = []
    cursor = None

    for _ in range(max_pages):
        data = await _graphql(REVIEWS_QUERY, {"query": search_query, "cursor": cursor})
        search_data = data["search"]

        # Extract only this user's reviews from each PR
        for pr_node in search_data["nodes"]:
            if pr_node is None:
                continue
            user_reviews = [
                {
                    "pr_number": pr_node.get("number"),
                    "pr_title": pr_node.get("title"),
                    "repo": pr_node.get("repository", {}).get("nameWithOwner"),
                    "language": (pr_node.get("repository", {}).get("primaryLanguage") or {}).get("name"),
                    **review,
                }
                for review in pr_node.get("reviews", {}).get("nodes", [])
                if review.get("author", {}).get("login", "").lower() == username.lower()
            ]
            all_reviews.extend(user_reviews)

        if not search_data["pageInfo"]["hasNextPage"]:
            break
        cursor = search_data["pageInfo"]["endCursor"]

    await cache_github_data(username, "reviews", all_reviews)
    return all_reviews


# ── Repositories ──────────────────────────────────────────────


REPOS_QUERY = """
query($username: String!, $cursor: String) {
  user(login: $username) {
    repositories(
      first: 30
      after: $cursor
      ownerAffiliations: OWNER
      orderBy: {field: STARGAZERS, direction: DESC}
      isFork: false
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner
        name
        description
        primaryLanguage { name }
        languages(first: 10) { nodes { name } }
        stargazerCount
        forkCount
        watchers { totalCount }
        issues(states: OPEN) { totalCount }
        pullRequests(states: OPEN) { totalCount }
        releases { totalCount }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 1) {
                totalCount
                nodes { committedDate }
              }
            }
          }
        }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        hasWikiEnabled
        licenseInfo { spdxId name }
        createdAt
        updatedAt
        object(expression: "HEAD:README.md") {
          ... on Blob { text }
        }
      }
    }
  }
}
"""


async def fetch_repositories(username: str, max_pages: int = 2) -> list[dict]:
    """Fetch user's owned repos with README, languages, stats."""
    cached = await get_cached_github_data(username, "repos")
    if cached:
        return cached

    all_repos: list[dict] = []
    cursor = None

    for _ in range(max_pages):
        data = await _graphql(REPOS_QUERY, {"username": username, "cursor": cursor})
        repo_data = data["user"]["repositories"]
        all_repos.extend(repo_data["nodes"])

        if not repo_data["pageInfo"]["hasNextPage"]:
            break
        cursor = repo_data["pageInfo"]["endCursor"]

    await cache_github_data(username, "repos", all_repos)
    return all_repos


# ── Convenience: fetch everything ─────────────────────────────


async def fetch_all_github_data(username: str) -> dict[str, Any]:
    """Fetch all GitHub data for a user. Returns a dict of all categories."""
    profile = await fetch_profile(username)
    prs = await fetch_pull_requests(username)
    issues = await fetch_issues(username)
    reviews = await fetch_reviews(username)
    repos = await fetch_repositories(username)

    return {
        "profile": profile,
        "prs": prs,
        "issues": issues,
        "reviews": reviews,
        "repos": repos,
    }

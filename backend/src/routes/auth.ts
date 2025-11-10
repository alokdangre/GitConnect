import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { exchangeCodeForTokens, type GitHubAppTokenPayload, GitHubOAuthError } from '../lib/githubAppAuth.js';

function buildProfileUpdateData(profile: GitHubUserResponse): Prisma.UserUpdateInput {
  return {
    login: profile.login,
    name: profile.name ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    bio: profile.bio ?? undefined,
    email: profile.email ?? undefined,
    profileUrl: profile.html_url ?? undefined,
    followersCount: profile.followers ?? undefined,
    followingCount: profile.following ?? undefined,
    source: 'github',
  } satisfies Prisma.UserUpdateInput;
}

function buildProfileCreateData(githubId: string, profile: GitHubUserResponse): Prisma.UserCreateInput {
  return {
    githubId,
    login: profile.login,
    name: profile.name ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    bio: profile.bio ?? undefined,
    email: profile.email ?? undefined,
    profileUrl: profile.html_url ?? undefined,
    followersCount: profile.followers ?? undefined,
    followingCount: profile.following ?? undefined,
    source: 'github',
  } satisfies Prisma.UserCreateInput;
}

function buildTokenUpdateData(tokens: GitHubAppTokenPayload, now: Date): Prisma.UserUpdateInput {
  const data = {
    personalAccessToken: tokens.accessToken,
    tokenUpdatedAt: now,
    tokenExpiresAt: tokens.tokenExpiresAt ?? null,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? null,
    githubTokenScope: tokens.scope ?? null,
    githubTokenType: tokens.tokenType ?? null,
    githubRefreshToken: tokens.refreshToken ?? null,
  } satisfies Record<string, unknown>;

  return data as unknown as Prisma.UserUpdateInput;
}

function buildTokenCreateData(tokens: GitHubAppTokenPayload, now: Date): Prisma.UserCreateInput {
  const data = {
    personalAccessToken: tokens.accessToken,
    tokenUpdatedAt: now,
    tokenExpiresAt: tokens.tokenExpiresAt ?? null,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? null,
    githubTokenScope: tokens.scope ?? null,
    githubTokenType: tokens.tokenType ?? null,
    githubRefreshToken: tokens.refreshToken ?? null,
  } satisfies Record<string, unknown>;

  return data as unknown as Prisma.UserCreateInput;
}

async function upsertGitHubUserRecord(githubId: string, profile: GitHubUserResponse, tokens: GitHubAppTokenPayload) {
  const profileUpdate = buildProfileUpdateData(profile);
  const profileCreate = buildProfileCreateData(githubId, profile);
  const now = new Date();
  const tokenUpdate = buildTokenUpdateData(tokens, now);
  const tokenCreate = buildTokenCreateData(tokens, now);

  return prisma.user.upsert({
    where: { githubId },
    update: {
      ...profileUpdate,
      ...tokenUpdate,
    },
    create: {
      ...profileCreate,
      ...tokenCreate,
    },
  });
}

const GITHUB_USER_API_URL = 'https://api.github.com/user';

interface GitHubUserResponse {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  email?: string | null;
  html_url?: string | null;
  followers?: number;
  following?: number;
}

const authRouter = Router();

authRouter.post('/github/callback', async (req, res) => {
  const { code } = req.body as { code?: string };
  const clientId = process.env.GITHUB_APP_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET ?? process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'GitHub OAuth credentials are not configured on the server' });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'Missing GitHub authorization code' });
    return;
  }

  try {
    const tokenPayload = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    const userResponse = await fetch(GITHUB_USER_API_URL, {
      headers: {
        Authorization: `Bearer ${tokenPayload.accessToken}`,
        'User-Agent': 'GitConnect Backend',
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      const text = await userResponse.text();
      res.status(502).json({ error: 'Failed to fetch GitHub user profile', details: text });
      return;
    }

    const githubUser = (await userResponse.json()) as GitHubUserResponse;
    const githubId = githubUser.id.toString();

    const userRecord = await upsertGitHubUserRecord(githubId, githubUser, tokenPayload);

    const {
      personalAccessToken: _personalAccessToken,
      githubRefreshToken: _githubRefreshToken,
      ...sanitizedUser
    } = userRecord as typeof userRecord & {
      personalAccessToken?: string | null;
      githubRefreshToken?: string | null;
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret is not configured on the server' });
      return;
    }

    const appToken = jwt.sign(
      {
        userId: userRecord.id,
      },
      jwtSecret,
      {
        expiresIn: '7d',
      }
    )

    res.json({
      accessToken: tokenPayload.accessToken,
      tokenType: tokenPayload.tokenType,
      scope: tokenPayload.scope,
      tokenExpiresAt: tokenPayload.tokenExpiresAt?.toISOString() ?? null,
      refreshTokenExpiresAt: tokenPayload.refreshTokenExpiresAt?.toISOString() ?? null,
      appToken,
      user: sanitizedUser,
    });
  } catch (error) {
    if (error instanceof GitHubOAuthError) {
      res.status(400).json({ error: error.message, details: error.details });
      return;
    }

    console.error('GitHub OAuth error:', error);
    res.status(500).json({ error: 'Unexpected error during GitHub authentication' });
  }
});

export default authRouter;

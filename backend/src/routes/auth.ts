import { Router } from 'express';
import prisma from '../lib/prisma.js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API_URL = 'https://api.github.com/user';

interface GitHubAccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

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
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
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
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      res.status(502).json({ error: 'Failed to exchange code for access token', details: text });
      return;
    }

    const tokenPayload = (await tokenResponse.json()) as GitHubAccessTokenResponse;

    if (tokenPayload.error || !tokenPayload.access_token) {
      res.status(400).json({
        error: tokenPayload.error ?? 'GitHub OAuth error',
        description: tokenPayload.error_description,
      });
      return;
    }

    const accessToken = tokenPayload.access_token;

    const userResponse = await fetch(GITHUB_USER_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

    const now = new Date();

    const userRecord = await prisma.user.upsert({
      where: { githubId },
      update: {
        login: githubUser.login,
        name: githubUser.name ?? undefined,
        avatarUrl: githubUser.avatar_url ?? undefined,
        bio: githubUser.bio ?? undefined,
        email: githubUser.email ?? undefined,
        profileUrl: githubUser.html_url ?? undefined,
        followersCount: githubUser.followers ?? undefined,
        followingCount: githubUser.following ?? undefined,
        personalAccessToken: accessToken,
        tokenUpdatedAt: now,
        source: 'github',
      },
      create: {
        githubId,
        login: githubUser.login,
        name: githubUser.name ?? undefined,
        avatarUrl: githubUser.avatar_url ?? undefined,
        bio: githubUser.bio ?? undefined,
        email: githubUser.email ?? undefined,
        profileUrl: githubUser.html_url ?? undefined,
        followersCount: githubUser.followers ?? undefined,
        followingCount: githubUser.following ?? undefined,
        personalAccessToken: accessToken,
        tokenUpdatedAt: now,
        source: 'github',
      },
    });

    const { personalAccessToken: _personalAccessToken, ...sanitizedUser } = userRecord;

    res.json({
      accessToken,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({ error: 'Unexpected error during GitHub authentication' });
  }
});

export default authRouter;

import jwt from 'jsonwebtoken';

interface InstallationAccessTokenResponse {
  token: string;
  expires_at: string;
  permissions?: Record<string, string>;
  repositories?: unknown[];
}

export function createGitHubAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY are not configured');
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60,
    exp: now + 10 * 60,
    iss: appId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

export async function createInstallationAccessToken(installationId: number) {
  const jwtToken = createGitHubAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitConnect Backend',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create installation access token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as InstallationAccessTokenResponse;

  return {
    token: data.token,
    expiresAt: new Date(data.expires_at),
    permissions: data.permissions ?? {},
  };
}

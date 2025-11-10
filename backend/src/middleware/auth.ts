import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Prisma, User } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { refreshUserTokens, GitHubOAuthError } from '../lib/githubAppAuth.js';

interface AppJwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

interface TokenFieldShape {
  personalAccessToken?: string | null;
  githubRefreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  githubTokenScope?: string | null;
  githubTokenType?: string | null;
}

type UserWithTokens = User & TokenFieldShape;

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserWithTokens;
    githubToken?: string;
  }
}

const SEND_GENERIC_ERROR = {
  success: false as const,
  error: {
    code: 'SERVER_MISCONFIGURED',
    message: 'Authentication is temporarily unavailable',
  },
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function respond(res: Response, status: number, body: ErrorResponse) {
  return res.status(status).json(body);
}

function extractBearerToken(headerValue?: string | null): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

function decryptPersonalAccessToken(encryptedToken: string): string | null {
  // TODO: Replace this stub with real decryption using KMS or AES-256-GCM.
  return encryptedToken || null;
}

function tokenNeedsRefresh(expiresAt: Date | null, bufferMs = 60_000): boolean {
  if (!expiresAt) return false;
  const threshold = expiresAt.getTime() - bufferMs;
  return Date.now() >= threshold;
}

function resolveGitHubOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_APP_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET ?? process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

function ensureJwtSecret(): string | null {
  return process.env.JWT_SECRET ?? null;
}

function isAppJwtPayload(payload: string | jwt.JwtPayload): payload is AppJwtPayload {
  if (typeof payload === 'string') return false;
  return typeof payload === 'object' && typeof payload.userId === 'string';
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    respond(res, 401, {
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Missing bearer token',
      },
    });
    return;
  }

  const secret = ensureJwtSecret();
  if (!secret) {
    res.status(500).json(SEND_GENERIC_ERROR);
    return;
  }

  let payload: AppJwtPayload;
  try {
    const decoded = jwt.verify(token, secret);
    if (!isAppJwtPayload(decoded)) {
      respond(res, 401, {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token payload is not valid',
        },
      });
      return;
    }
    payload = decoded;
  } catch (error) {
    respond(res, 401, {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token could not be verified',
        details: error instanceof Error ? error.message : undefined,
      },
    });
    return;
  }

  try {
    const user = (await prisma.user.findUnique({ where: { id: payload.userId } })) as UserWithTokens | null;

    if (!user) {
      respond(res, 401, {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with token does not exist',
        },
      });
      return;
    }

    if (!user.personalAccessToken) {
      respond(res, 403, {
        success: false,
        error: {
          code: 'GITHUB_TOKEN_MISSING',
          message: 'User does not have a GitHub token on record',
        },
      });
      return;
    }

    let githubToken = decryptPersonalAccessToken(user.personalAccessToken);

    if (!githubToken) {
      respond(res, 403, {
        success: false,
        error: {
          code: 'GITHUB_TOKEN_INVALID',
          message: 'Stored GitHub token could not be decrypted',
        },
      });
      return;
    }

    if (tokenNeedsRefresh(user.tokenExpiresAt ?? null)) {
      if (!user.githubRefreshToken) {
        respond(res, 401, {
          success: false,
          error: {
            code: 'GITHUB_TOKEN_EXPIRED',
            message: 'Stored GitHub token is expired and cannot be refreshed',
          },
        });
        return;
      }

      const credentials = resolveGitHubOAuthCredentials();
      if (!credentials) {
        res.status(500).json(SEND_GENERIC_ERROR);
        return;
      }

      try {
        const refreshed = await refreshUserTokens({
          refreshToken: user.githubRefreshToken,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
        });

        githubToken = refreshed.accessToken;

        const tokenUpdate: Prisma.UserUpdateInput & TokenFieldShape = {
          personalAccessToken: refreshed.accessToken,
          tokenUpdatedAt: new Date(),
          tokenExpiresAt: refreshed.tokenExpiresAt ?? undefined,
          refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt ?? undefined,
          githubTokenScope: refreshed.scope ?? undefined,
          githubTokenType: refreshed.tokenType ?? undefined,
          githubRefreshToken: refreshed.refreshToken ?? null,
        };

        await prisma.user.update({
          where: { id: user.id },
          data: tokenUpdate,
        });

        user.personalAccessToken = refreshed.accessToken;
        user.githubRefreshToken = refreshed.refreshToken ?? null;
        user.tokenUpdatedAt = tokenUpdate.tokenUpdatedAt ?? new Date();
        user.tokenExpiresAt = refreshed.tokenExpiresAt ?? null;
      } catch (error) {
        if (error instanceof GitHubOAuthError) {
          respond(res, 401, {
            success: false,
            error: {
              code: 'GITHUB_TOKEN_REFRESH_FAILED',
              message: error.message,
              details: error.details,
            },
          });
          return;
        }

        respond(res, 500, {
          success: false,
          error: {
            code: 'GITHUB_TOKEN_REFRESH_FAILED',
            message: 'Failed to refresh GitHub token',
            details: error instanceof Error ? error.message : undefined,
          },
        });
        return;
      }
    }

    req.user = user;
    req.githubToken = githubToken;

    next();
  } catch (error) {
    respond(res, 500, {
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Failed to authenticate request',
        details: error instanceof Error ? error.message : undefined,
      },
    });
  }
}

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import prisma from '../lib/prisma.js';

interface AppJwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
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
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

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

    const githubToken = decryptPersonalAccessToken(user.personalAccessToken);

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

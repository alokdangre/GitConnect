import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth.js';
import { parseZod } from '../validators/github.schema.js';
import {
  judgmentRequestSchema,
  type JudgmentRequestInput,
} from '../validators/judgment.schema.js';
import {
  fetchPullRequestContext,
  fetchIssueContext,
  fetchCommitContext,
  generateJudgment,
} from '../judgment/index.js';
import type { Response } from 'express';

const judgmentRouter = Router();

judgmentRouter.use(authenticateRequest);

judgmentRouter.post('/', async (req, res) => {
  let input: JudgmentRequestInput;

  try {
    input = parseZod(judgmentRequestSchema, req.body);
  } catch (error) {
    if (error instanceof Error && 'issues' in error && Array.isArray((error as any).issues)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body failed validation',
          details: (error as Error & { issues?: unknown }).issues,
        },
      });
      return;
    }

    throw error;
  }

  const { target, limits } = input;
  const githubToken = req.githubToken;

  if (!githubToken) {
    res.status(500).json({
      success: false,
      error: {
        code: 'GITHUB_TOKEN_MISSING',
        message: 'GitHub token not available on request context',
      },
    });
    return;
  }

  try {
    const context = await buildContext({ target, token: githubToken, limits });
    const llmResponse = await generateJudgment(context);

    res.status(200).json({
      success: true,
      data: {
        context,
        judgment: llmResponse,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

async function buildContext(params: {
  target: JudgmentRequestInput['target'];
  token: string;
  limits: JudgmentRequestInput['limits'];
}) {
  const { target, token, limits } = params;

  switch (target.type) {
    case 'pull_request':
      return fetchPullRequestContext({
        token,
        owner: target.owner,
        repo: target.repo,
        pullNumber: target.number,
        limits,
      });
    case 'issue':
      return fetchIssueContext({
        token,
        owner: target.owner,
        repo: target.repo,
        issueNumber: target.number,
        limits,
      });
    case 'commit':
      return fetchCommitContext({
        token,
        owner: target.owner,
        repo: target.repo,
        sha: target.sha,
        limits,
      });
    default: {
      const exhaustiveCheck: never = target;
      throw new Error(`Unsupported target type: ${exhaustiveCheck}`);
    }
  }
}

function handleError(res: Response, error: unknown) {
  if (error instanceof Error && error.name === 'GitHubDataError') {
    res.status(502).json({
      success: false,
      error: {
        code: 'GITHUB_FETCH_FAILED',
        message: error.message,
        details: (error as Error & { githubError?: unknown }).githubError,
      },
    });
    return;
  }

  if (error instanceof Error && error.name === 'VertexConfigError') {
    res.status(500).json({
      success: false,
      error: {
        code: 'VERTEX_CONFIG_ERROR',
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof Error && error.name === 'VertexInvocationError') {
    res.status(502).json({
      success: false,
      error: {
        code: 'VERTEX_INVOCATION_FAILED',
        message: error.message,
        details: error.cause ? { cause: String(error.cause) } : undefined,
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while generating the judgment',
      details: error instanceof Error ? error.message : undefined,
    },
  });
}

export default judgmentRouter;

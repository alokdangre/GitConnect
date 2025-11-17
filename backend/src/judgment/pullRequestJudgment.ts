import { fetchPullRequestContext, type PullRequestContext, type FetchLimits } from './githubData.js';
import { generateJudgment, type LLMJudgmentResponse } from './vertexJudgment.js';

export interface PullRequestJudgmentResult {
  context: PullRequestContext;
  judgment: LLMJudgmentResponse;
}

export async function judgePullRequest(params: {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  limits?: FetchLimits;
}): Promise<PullRequestJudgmentResult> {
  const context = await fetchPullRequestContext({
    token: params.token,
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    limits: params.limits,
  });

  const judgment = await generateJudgment(context);

  return { context, judgment };
}

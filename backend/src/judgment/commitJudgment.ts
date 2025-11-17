import { fetchCommitContext, type CommitContext, type FetchLimits } from './githubData.js';
import { generateJudgment, type LLMJudgmentResponse } from './vertexJudgment.js';

export interface CommitJudgmentResult {
  context: CommitContext;
  judgment: LLMJudgmentResponse;
}

export async function judgeCommit(params: {
  token: string;
  owner: string;
  repo: string;
  sha: string;
  limits?: FetchLimits;
}): Promise<CommitJudgmentResult> {
  const context = await fetchCommitContext({
    token: params.token,
    owner: params.owner,
    repo: params.repo,
    sha: params.sha,
    limits: params.limits,
  });

  const judgment = await generateJudgment(context);

  return { context, judgment };
}

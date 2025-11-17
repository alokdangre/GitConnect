import { fetchIssueContext, type IssueContext, type FetchLimits } from './githubData.js';
import { generateJudgment, type LLMJudgmentResponse } from './vertexJudgment.js';

export interface IssueJudgmentResult {
  context: IssueContext;
  judgment: LLMJudgmentResponse;
}

export async function judgeIssue(params: {
  token: string;
  owner: string;
  repo: string;
  issueNumber: number;
  limits?: FetchLimits;
}): Promise<IssueJudgmentResult> {
  const context = await fetchIssueContext({
    token: params.token,
    owner: params.owner,
    repo: params.repo,
    issueNumber: params.issueNumber,
    limits: params.limits,
  });

  const judgment = await generateJudgment(context);

  return { context, judgment };
}

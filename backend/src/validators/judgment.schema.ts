import { z } from 'zod';

const repoIdentifierSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
});

const pullRequestTargetSchema = repoIdentifierSchema.extend({
  type: z.literal('pull_request'),
  number: z.number().int().positive(),
});

const issueTargetSchema = repoIdentifierSchema.extend({
  type: z.literal('issue'),
  number: z.number().int().positive(),
});

const commitTargetSchema = repoIdentifierSchema.extend({
  type: z.literal('commit'),
  sha: z.string().min(7, 'Commit SHA must be at least 7 characters'),
});

const fetchLimitsSchema = z
  .object({
    maxReviews: z.number().int().positive().max(100).optional(),
    maxComments: z.number().int().positive().max(200).optional(),
    maxFiles: z.number().int().positive().max(200).optional(),
    maxCommits: z.number().int().positive().max(200).optional(),
    maxCommitComments: z.number().int().positive().max(200).optional(),
    patchCharacterLimit: z.number().int().positive().max(20000).optional(),
  })
  .optional();

export const judgmentRequestSchema = z.object({
  target: z.union([pullRequestTargetSchema, issueTargetSchema, commitTargetSchema]),
  limits: fetchLimitsSchema,
});

export type JudgmentRequestInput = z.infer<typeof judgmentRequestSchema>;
export type JudgmentTargetInput = JudgmentRequestInput['target'];
export type JudgmentFetchLimitsInput = NonNullable<JudgmentRequestInput['limits']>;

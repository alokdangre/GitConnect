import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();
const paginationBase = {
  page: positiveInt.optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(30),
};

export const githubRepoParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export const githubMeReposQuerySchema = z.object({
  ...paginationBase,
  type: z.enum(['all', 'owner', 'member']).optional().default('all'),
  sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  visibility: z.enum(['all', 'public', 'private']).optional(),
});

export const githubRepoListQuerySchema = z.object({
  ...paginationBase,
  sha: z.string().min(1).optional(),
  path: z.string().optional(),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const githubIssueListQuerySchema = z.object({
  ...paginationBase,
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  labels: z.string().optional(),
});

export const githubPullListQuerySchema = z.object({
  ...paginationBase,
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  head: z.string().optional(),
  base: z.string().optional(),
  sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const githubUserIssueQuerySchema = z.object({
  ...paginationBase,
  filter: z.enum(['assigned', 'created', 'mentioned', 'subscribed', 'all']).optional(),
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  labels: z.string().optional(),
  sort: z.enum(['created', 'updated', 'comments']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  since: z.string().optional(),
});

export const githubUserPullQuerySchema = z.object({
  ...paginationBase,
  role: z.enum(['author', 'review-requested', 'involves']).optional().default('involves'),
  state: z.enum(['open', 'closed', 'merged', 'all']).optional().default('open'),
  labels: z.string().optional(),
  repo: z.string().optional(),
  base: z.string().optional(),
  head: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['created', 'updated', 'comments']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export type GitHubRepoParams = z.infer<typeof githubRepoParamsSchema>;
export type GitHubMeReposQuery = z.infer<typeof githubMeReposQuerySchema>;
export type GitHubRepoListQuery = z.infer<typeof githubRepoListQuerySchema>;
export type GitHubIssueListQuery = z.infer<typeof githubIssueListQuerySchema>;
export type GitHubPullListQuery = z.infer<typeof githubPullListQuerySchema>;
export type GitHubUserIssueQuery = z.infer<typeof githubUserIssueQuerySchema>;
export type GitHubUserPullQuery = z.infer<typeof githubUserPullQuerySchema>;

export function parseZod<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue: z.ZodIssue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const error = new Error('INVALID_PARAMS');
    (error as Error & { issues?: typeof issues }).issues = issues;
    throw error;
  }
  return result.data;
}

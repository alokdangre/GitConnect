import { VertexAI, type GenerativeModel } from '@google-cloud/vertexai';
import { z } from 'zod';
import type { GitHubContext, JudgmentTargetType } from './githubData.js';

export type JudgmentDecision = 'approve' | 'request_changes' | 'comment';

export interface JudgmentResponseMeta {
  repository: string;
  targetType: JudgmentTargetType;
  identifier: string;
}

export interface LLMJudgmentResponse {
  decision: JudgmentDecision;
  confidence: number;
  summary: string;
  keyFindings: string[];
  risks: string[];
  recommendedActions: string[];
  metadata: JudgmentResponseMeta;
}

export class VertexConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VertexConfigError';
  }
}

export class VertexInvocationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'VertexInvocationError';
  }
}

const judgmentSchema = z.object({
  decision: z.enum(['approve', 'request_changes', 'comment']),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  keyFindings: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  metadata: z.object({
    repository: z.string().min(1),
    targetType: z.string().min(1),
    identifier: z.string().min(1),
  }),
});

const VERTEX_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    decision: {
      type: 'string',
      enum: ['approve', 'request_changes', 'comment'],
      description: 'Overall disposition for the change set',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score between 0 and 1',
    },
    summary: {
      type: 'string',
      description: 'Short paragraph summarizing the reasoning',
    },
    keyFindings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Notable observations about the change',
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      description: 'Potential risks or regressions to watch for',
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete actions or follow-ups recommended to the developer',
    },
    metadata: {
      type: 'object',
      properties: {
        repository: { type: 'string' },
        targetType: { type: 'string' },
        identifier: { type: 'string' },
      },
      required: ['repository', 'targetType', 'identifier'],
      additionalProperties: false,
    },
  },
  required: ['decision', 'confidence', 'summary', 'keyFindings', 'risks', 'recommendedActions', 'metadata'],
  additionalProperties: false,
} as const;

const SYSTEM_INSTRUCTION = `You are a senior software engineer who reviews GitHub pull requests, issues, and commits.
Given context about a change, produce a JSON object that strictly matches the provided schema.
Do not include any commentary outside the JSON object.`;

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_LOCATION = 'us-central1';

let cachedModel: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (cachedModel) {
    return cachedModel;
  }

  const projectId = process.env.VERTEX_PROJECT_ID ?? process.env.GOOGLE_PROJECT_ID;
  if (!projectId) {
    throw new VertexConfigError('Missing VERTEX_PROJECT_ID or GOOGLE_PROJECT_ID environment variable.');
  }

  const location = process.env.VERTEX_LOCATION ?? DEFAULT_LOCATION;
  const modelName = process.env.VERTEX_MODEL ?? DEFAULT_MODEL;

  const vertexAI = new VertexAI({
    project: projectId,
    location,
  });

  cachedModel = vertexAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      role: 'system',
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
  });

  return cachedModel;
}

function buildPrompt(context: GitHubContext): string {
  const truncatedContext = JSON.stringify(context, null, 2);
  return [
    `Repository: ${context.repository}`,
    `Target: ${context.identifier} (${context.type})`,
    '---',
    'Context JSON:',
    truncatedContext,
  ].join('\n');
}

export async function generateJudgment(context: GitHubContext): Promise<LLMJudgmentResponse> {
  const model = getModel();

  try {
    const prompt = buildPrompt(context);
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: VERTEX_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    const candidates = result.response?.candidates ?? [];
    const firstCandidate = candidates[0];
    const text = firstCandidate?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new VertexInvocationError('Vertex AI returned an empty response.');
    }

    const parsedJson = JSON.parse(text);
    const judgment = judgmentSchema.parse(parsedJson);

    const enriched: LLMJudgmentResponse = {
      decision: judgment.decision,
      confidence: judgment.confidence,
      summary: judgment.summary,
      keyFindings: judgment.keyFindings,
      risks: judgment.risks,
      recommendedActions: judgment.recommendedActions,
      metadata: {
        repository: judgment.metadata.repository || context.repository,
        targetType: (judgment.metadata.targetType as JudgmentTargetType) || context.type,
        identifier: judgment.metadata.identifier || context.identifier,
      },
    };

    return enriched;
  } catch (error) {
    if (error instanceof VertexInvocationError || error instanceof VertexConfigError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      throw new VertexInvocationError('Vertex AI response failed validation against schema.', error);
    }

    if (error instanceof SyntaxError) {
      throw new VertexInvocationError('Vertex AI response was not valid JSON.', error);
    }

    throw new VertexInvocationError('Failed to invoke Vertex AI for judgment.', error);
  }
}

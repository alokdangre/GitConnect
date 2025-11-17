import { VertexAI, type GenerativeModel } from '@google-cloud/vertexai';
import type { GitHubContext } from './githubData.js';

export interface LLMJudgmentResponse {
  text: string;
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

const SYSTEM_INSTRUCTION = `You are a senior software engineer who reviews GitHub pull requests, issues, and commits.
Given context about a change, produce a concise natural-language review.
Return plain text only. Do not wrap the answer in JSON or any other structured format.`;

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
        maxOutputTokens: 512,
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

    return {
      text,
    };
  } catch (error) {
    if (error instanceof VertexInvocationError || error instanceof VertexConfigError) {
      throw error;
    }
    throw new VertexInvocationError('Failed to invoke Vertex AI for judgment.', error);
  }
}

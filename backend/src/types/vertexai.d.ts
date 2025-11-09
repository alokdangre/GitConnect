declare module '@google-cloud/vertexai' {
  export interface VertexAIOptions {
    project: string;
    location?: string;
  }

  export interface Part {
    text?: string;
  }

  export interface Content {
    role?: string;
    parts?: Part[];
  }

  export interface Candidate {
    content?: Content;
  }

  export interface GenerateContentRequest {
    contents: Content[];
    generationConfig?: Record<string, unknown>;
  }

  export interface GenerateContentResult {
    response?: {
      candidates?: Candidate[];
    };
  }

  export interface GenerativeModel {
    generateContent(request: GenerateContentRequest): Promise<GenerateContentResult>;
  }

  export class VertexAI {
    constructor(options: VertexAIOptions);
    getGenerativeModel(options: Record<string, unknown>): GenerativeModel;
  }
}

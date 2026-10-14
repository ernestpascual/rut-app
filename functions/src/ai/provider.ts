export interface EmbeddingResult {
  embedding: number[];
  model: string;
  charCount: number;
}

export interface InspirationContextItem {
  id: string;
  title: string;
  summary: string;
  userNote?: string | null;
  caption?: string | null;
  url?: string | null;
  domain?: string | null;
  author?: string | null;
  tags?: string[];
  concepts?: string[];
}

export interface ChatRequest {
  message: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  retrievedInspirations: InspirationContextItem[];
  pinnedInspirations: InspirationContextItem[];
  webAccess?: boolean;
}

export interface ChatResult {
  response: string;
  sourceInspirationIds: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  webSources?: Array<{ title?: string; uri?: string }>;
}

export interface InspirationInput {
  title: string;
  sharedText?: string | null;
  userNote?: string | null;
  url?: string | null;
  previewDescription?: string | null;
}

export interface SummaryResult {
  aiSummary: string;
  aiTags: string[];
  concepts: string[];
  embedding: number[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
}

export interface ProjectLinkRequest {
  projectTitle: string;
  projectBrief?: string | null;
  projectNotes?: string;
  inspirations: Array<{
    id: string;
    title: string;
    aiSummary?: string | null;
    userNote?: string | null;
    concepts?: string[];
  }>;
}

export interface ProjectLinkResult {
  suggestions: Array<{
    inspirationId: string;
    reason: string;
    confidence: number;
  }>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
}

export interface AIProvider {
  generateEmbedding(input: string): Promise<EmbeddingResult>;
  generateChatResponse(input: ChatRequest): Promise<ChatResult>;
  summarizeInspiration(input: InspirationInput): Promise<SummaryResult>;
  suggestProjectLinks(input: ProjectLinkRequest): Promise<ProjectLinkResult>;
}

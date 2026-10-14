import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  EmbeddingResult,
  ChatRequest,
  ChatResult,
  InspirationInput,
  SummaryResult,
  ProjectLinkRequest,
  ProjectLinkResult
} from './provider';
import {
  INDEXING_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  PROJECT_LINKING_SYSTEM_PROMPT
} from './prompts';
import { calculateCostMicros } from '../cost/pricing';

import { validateFlashModel, getGeminiModel } from '../config';

export class GeminiAIProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private flashModel: string;
  private readonly embedModel = 'text-embedding-004';

  constructor(apiKey: string, modelName?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.flashModel = modelName ? validateFlashModel(modelName) : getGeminiModel();
  }

  async generateEmbedding(input: string): Promise<EmbeddingResult> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.embedModel });
      const result = await model.embedContent(input.slice(0, 2048));
      return {
        embedding: result.embedding.values,
        model: this.embedModel,
        charCount: input.length,
      };
    } catch (err: any) {
      console.warn('Gemini embedding failed, using fallback vector:', err);
      // Deterministic fallback vector
      const fallback = new Array(64).fill(0.01);
      return {
        embedding: fallback,
        model: 'fallback-embed',
        charCount: input.length,
      };
    }
  }

  async summarizeInspiration(input: InspirationInput): Promise<SummaryResult> {
    const textToAnalyze = `
TITLE: ${input.title}
USER NOTE: ${input.userNote || 'none'}
SHARED TEXT: ${input.sharedText || 'none'}
PAGE PREVIEW: ${input.previewDescription || 'none'}
`;

    const model = this.genAI.getGenerativeModel({
      model: this.flashModel,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `${INDEXING_SYSTEM_PROMPT}\n\nCONTENT TO ANALYZE:\n${textToAnalyze}`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let parsed: { aiSummary?: string; aiTags?: string[]; concepts?: string[] } = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {
        aiSummary: responseText.slice(0, 200),
        aiTags: ['saved'],
        concepts: ['idea'],
      };
    }

    const embedResult = await this.generateEmbedding(textToAnalyze);

    const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(prompt.length / 4);
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
    const cost = calculateCostMicros(this.flashModel, inputTokens, outputTokens, textToAnalyze.length);

    return {
      aiSummary: parsed.aiSummary || `Saved material: ${input.title}`,
      aiTags: parsed.aiTags || [],
      concepts: parsed.concepts || [],
      embedding: embedResult.embedding,
      model: this.flashModel,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }

  async generateChatResponse(input: ChatRequest): Promise<ChatResult> {
    const modelOptions: any = { model: this.flashModel };
    if (input.webAccess) {
      modelOptions.tools = [{ googleSearch: {} }];
    }

    const model = this.genAI.getGenerativeModel(modelOptions);

    const contextItems = [...input.pinnedInspirations, ...input.retrievedInspirations];
    const contextFormatted = contextItems
      .map((item, idx) => {
        const lines = [
          `[DUMP KNOWLEDGE ENTRY #${idx + 1}]`,
          `• ID: ${item.id}`,
          `• Title: "${item.title}"`,
        ];
        if (item.domain || item.author) {
          lines.push(`• Source / Author: ${item.author ? `@${item.author} on ` : ''}${item.domain || 'Web'}`);
        }
        if (item.userNote) {
          lines.push(`• User's Personal Note: "${item.userNote}"`);
        }
        if (item.caption) {
          lines.push(`• Saved Caption / Post Text: "${item.caption}"`);
        }
        if (item.summary) {
          lines.push(`• AI Summary & Context: ${item.summary}`);
        }
        if (item.tags && item.tags.length > 0) {
          lines.push(`• Tags: #${item.tags.join(' #')}`);
        }
        if (item.concepts && item.concepts.length > 0) {
          lines.push(`• Concepts: ${item.concepts.join(', ')}`);
        }
        if (item.url) {
          lines.push(`• Link: ${item.url}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');

    const webAccessDirective = input.webAccess
      ? `\nLIVE INTERNET ACCESS: ACTIVATED.
You have active Google Search grounding. Perform live searches to bring in real-world cultural precedents, design movements, contemporary studio work, architectural benchmarks, and recent articles. Integrate these real-world references dynamically into your brainstorming.`
      : '';

    const fullPrompt = `${CHAT_SYSTEM_PROMPT}${webAccessDirective}

======================================================
RETRIEVED KNOWLEDGE BASE CONTEXT (FROM USER'S DUMP):
======================================================
${contextFormatted || 'No relevant saves retrieved.'}
======================================================

USER QUERY:
${input.message}

Formulate an insightful response exploring this train of thought grounded in the user's dump knowledge base. Explicitly cite which [ID: ...] sources you drew from.
`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    // Extract valid source IDs referenced
    const citedIds: string[] = [];
    for (const item of contextItems) {
      if (responseText.includes(item.id) || responseText.includes(item.title)) {
        citedIds.push(item.id);
      }
    }

    // Extract web search grounding sources if present
    const webSources: Array<{ title?: string; uri?: string }> = [];
    const candidate = result.response.candidates?.[0];
    const groundingMetadata = (candidate as any)?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          webSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }
    }

    const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(fullPrompt.length / 4);
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
    const cost = calculateCostMicros(this.flashModel, inputTokens, outputTokens);

    return {
      response: responseText,
      sourceInspirationIds: citedIds,
      model: this.flashModel,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
      webSources: webSources.length > 0 ? webSources : undefined,
    };
  }

  async suggestProjectLinks(input: ProjectLinkRequest): Promise<ProjectLinkResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.flashModel,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const candidates = input.inspirations
      .map((i) => `[ID: ${i.id}] "${i.title}": ${i.aiSummary || i.userNote || ''}`)
      .join('\n');

    const prompt = `${PROJECT_LINKING_SYSTEM_PROMPT}

PROJECT:
Title: ${input.projectTitle}
Brief: ${input.projectBrief || 'none'}
Notes: ${input.projectNotes || 'none'}

CANDIDATES FROM USER BANK:
${candidates}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let suggestions: Array<{ inspirationId: string; reason: string; confidence: number }> = [];
    try {
      suggestions = JSON.parse(responseText);
    } catch {
      suggestions = [];
    }

    // Validate that IDs match real candidate IDs
    const validCandidateIds = new Set(input.inspirations.map((i) => i.id));
    suggestions = suggestions.filter((s) => validCandidateIds.has(s.inspirationId));

    const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(prompt.length / 4);
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
    const cost = calculateCostMicros(this.flashModel, inputTokens, outputTokens);

    return {
      suggestions,
      model: this.flashModel,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }
}

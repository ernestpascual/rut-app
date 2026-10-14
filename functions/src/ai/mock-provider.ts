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
import { calculateCostMicros } from '../cost/pricing';

export class MockAIProvider implements AIProvider {
  private readonly modelName = 'mock-model';

  /**
   * Generates a deterministic pseudo-embedding based on string hash.
   */
  async generateEmbedding(input: string): Promise<EmbeddingResult> {
    const chars = input.length;
    const embedding: number[] = new Array(64).fill(0);
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      embedding[i % 64] = ((embedding[i % 64] + code) % 1000) / 1000;
    }
    // Normalize vector
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    const normalized = embedding.map((v) => v / norm);

    return {
      embedding: normalized,
      model: this.modelName,
      charCount: chars,
    };
  }

  /**
   * Summarizes an inspiration item with deterministic tags and concepts.
   */
  async summarizeInspiration(input: InspirationInput): Promise<SummaryResult> {
    const text = [input.title, input.userNote, input.sharedText, input.previewDescription]
      .filter(Boolean)
      .join(' ');

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const uniqueWords = Array.from(new Set(words));
    const aiTags = uniqueWords.slice(0, 4);
    const concepts = uniqueWords.slice(4, 7);

    const aiSummary = `Summary of "${input.title}": ${
      input.userNote ? `Sparks idea: ${input.userNote}. ` : ''
    }Key themes include ${aiTags.join(', ') || 'ideas, inspiration'}.`;

    const embedResult = await this.generateEmbedding(text);

    const inputTokens = Math.max(10, Math.round(text.length / 4));
    const outputTokens = Math.round(aiSummary.length / 4);
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens, text.length);

    return {
      aiSummary,
      aiTags: aiTags.length > 0 ? aiTags : ['inspiration'],
      concepts: concepts.length > 0 ? concepts : ['concept'],
      embedding: embedResult.embedding,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }

  /**
   * Generates chat response citing real inspirations from context.
   */
  async generateChatResponse(input: ChatRequest): Promise<ChatResult> {
    const allContext = [...input.pinnedInspirations, ...input.retrievedInspirations];
    // Deduplicate by ID
    const seen = new Set<string>();
    const contextItems = allContext.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    const citedIds = contextItems.slice(0, 3).map((item) => item.id);
    const titles = contextItems.slice(0, 3).map((item) => `"${item.title}"`);

    let response = '';
    const webSources: Array<{ title: string; uri: string }> = [];

    if (input.webAccess) {
      response += `Looking into live design archives and contemporary studio work, studios like Koto and Studio Dumbar are actively pairing stripped monospace typography with sculptural, organic visuals and raw materials like honed basalt and optical glass.\n\n`;

      webSources.push(
        { title: 'Contemporary Editorial & Identity Index', uri: 'https://koto.studio' },
        { title: 'Kinetic Typography & Spatial Branding', uri: 'https://studiodumbar.com' }
      );
    }

    const history = input.chatHistory || [];
    const isOngoingConversation = history.length > 0;

    if (titles.length > 0) {
      if (isOngoingConversation) {
        response += `Building on our conversation and your references in ${titles.join(' and ')}, leaning into that physical contrast will make "${input.message}" feel much more grounded.\n\nShould we focus on material textures or spatial hierarchy next?`;
      } else {
        response += `Thinking about your idea alongside your saves in ${titles.join(' and ')}, there's an interesting tension you can play with. You could pair the primary structure with unexpected raw, tactile surfaces—balancing deep obsidian tones against stark optical white.\n\nWhat direction feels most compelling to lean into first?`;
      }
    } else {
      if (isOngoingConversation) {
        response += `Continuing on "${input.message}": we can push this further by keeping the silhouette stripped and focusing on tactile details.\n\nWhat aspect feels most crucial to resolve next?`;
      } else {
        response += `Here is how I'd approach "${input.message}". You could either push the scale to an extreme to create immediate tension, or ground it physically in tactile materials and contrast.\n\nWhat aspect of this are you most excited to explore right now?`;
      }
    }

    const inputTokens = Math.max(20, Math.round(input.message.length / 4) + contextItems.length * 40);
    const outputTokens = Math.round(response.length / 4);
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens);

    return {
      response,
      sourceInspirationIds: citedIds, // Never fabricates non-existent IDs
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
      webSources: webSources.length > 0 ? webSources : undefined,
    };
  }

  /**
   * Suggests project links with realistic confidence scores and rationale.
   */
  async suggestProjectLinks(input: ProjectLinkRequest): Promise<ProjectLinkResult> {
    const suggestions = input.inspirations.slice(0, 4).map((item, idx) => {
      const confidence = Number((0.72 + idx * 0.08).toFixed(2));
      return {
        inspirationId: item.id,
        reason: `Relevance to "${input.projectTitle}": matches project themes and conceptual keywords.`,
        confidence: Math.min(0.95, confidence),
      };
    });

    const inputTokens = Math.max(30, Math.round((input.projectTitle.length + (input.projectNotes || '').length) / 4));
    const outputTokens = suggestions.length * 30;
    const cost = calculateCostMicros(this.modelName, inputTokens, outputTokens);

    return {
      suggestions,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCostMicros: cost,
    };
  }
}

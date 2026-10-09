"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAIProvider = void 0;
const pricing_1 = require("../cost/pricing");
class MockAIProvider {
    constructor() {
        this.modelName = 'mock-model';
    }
    /**
     * Generates a deterministic pseudo-embedding based on string hash.
     */
    async generateEmbedding(input) {
        const chars = input.length;
        const embedding = new Array(64).fill(0);
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
    async summarizeInspiration(input) {
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
        const aiSummary = `Summary of "${input.title}": ${input.userNote ? `Sparks idea: ${input.userNote}. ` : ''}Key themes include ${aiTags.join(', ') || 'ideas, inspiration'}.`;
        const embedResult = await this.generateEmbedding(text);
        const inputTokens = Math.max(10, Math.round(text.length / 4));
        const outputTokens = Math.round(aiSummary.length / 4);
        const cost = (0, pricing_1.calculateCostMicros)(this.modelName, inputTokens, outputTokens, text.length);
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
    async generateChatResponse(input) {
        const allContext = [...input.pinnedInspirations, ...input.retrievedInspirations];
        // Deduplicate by ID
        const seen = new Set();
        const contextItems = allContext.filter((item) => {
            if (seen.has(item.id))
                return false;
            seen.add(item.id);
            return true;
        });
        const citedIds = contextItems.slice(0, 3).map((item) => item.id);
        const titles = contextItems.slice(0, 3).map((item) => `"${item.title}"`);
        let response = `In response to "${input.message}": `;
        if (titles.length > 0) {
            response += `Drawing from your saved inspiration in ${titles.join(' and ')}, this train of thought suggests combining these visual motifs and concepts to explore new directions.`;
        }
        else {
            response += `Exploring this train of thought: Consider brainstorming related visual elements, saving links or snippets to your bank to anchor the AI synthesis.`;
        }
        const inputTokens = Math.max(20, Math.round(input.message.length / 4) + contextItems.length * 40);
        const outputTokens = Math.round(response.length / 4);
        const cost = (0, pricing_1.calculateCostMicros)(this.modelName, inputTokens, outputTokens);
        return {
            response,
            sourceInspirationIds: citedIds, // Never fabricates non-existent IDs
            model: this.modelName,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
        };
    }
    /**
     * Suggests project links with realistic confidence scores and rationale.
     */
    async suggestProjectLinks(input) {
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
        const cost = (0, pricing_1.calculateCostMicros)(this.modelName, inputTokens, outputTokens);
        return {
            suggestions,
            model: this.modelName,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
        };
    }
}
exports.MockAIProvider = MockAIProvider;
//# sourceMappingURL=mock-provider.js.map
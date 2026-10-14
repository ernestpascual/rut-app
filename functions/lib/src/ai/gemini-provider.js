"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAIProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const prompts_1 = require("./prompts");
const pricing_1 = require("../cost/pricing");
const config_1 = require("../config");
class GeminiAIProvider {
    constructor(apiKey, modelName) {
        this.embedModel = 'text-embedding-004';
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.flashModel = modelName ? (0, config_1.validateFlashModel)(modelName) : (0, config_1.getGeminiModel)();
    }
    async generateEmbedding(input) {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.embedModel });
            const result = await model.embedContent(input.slice(0, 2048));
            return {
                embedding: result.embedding.values,
                model: this.embedModel,
                charCount: input.length,
            };
        }
        catch (err) {
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
    async summarizeInspiration(input) {
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
        const prompt = `${prompts_1.INDEXING_SYSTEM_PROMPT}\n\nCONTENT TO ANALYZE:\n${textToAnalyze}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        let parsed = {};
        try {
            parsed = JSON.parse(responseText);
        }
        catch {
            parsed = {
                aiSummary: responseText.slice(0, 200),
                aiTags: ['saved'],
                concepts: ['idea'],
            };
        }
        const embedResult = await this.generateEmbedding(textToAnalyze);
        const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(prompt.length / 4);
        const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
        const cost = (0, pricing_1.calculateCostMicros)(this.flashModel, inputTokens, outputTokens, textToAnalyze.length);
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
    async generateChatResponse(input) {
        const contextItems = [...input.pinnedInspirations, ...input.retrievedInspirations];
        const contextFormatted = contextItems.length > 0
            ? `\n\nRelevant inspiration items from user's dump (cite naturally with [ID: id] if referencing):\n` +
                contextItems
                    .map((item) => `- [ID: ${item.id}] "${item.title}": ${item.summary || item.userNote || item.caption || ''}`)
                    .join('\n')
            : '';
        const webAccessDirective = input.webAccess
            ? `\nLive internet search grounding is active. Perform real-time searches when helpful to reference current precedents.`
            : '';
        const systemInstructionText = `${prompts_1.CHAT_SYSTEM_PROMPT}${webAccessDirective}${contextFormatted}`;
        // Multi-turn conversation history
        const contents = [];
        if (input.chatHistory && input.chatHistory.length > 0) {
            for (const msg of input.chatHistory) {
                if (msg.content && (msg.role === 'user' || msg.role === 'assistant')) {
                    contents.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }],
                    });
                }
            }
        }
        // Add current user message
        contents.push({
            role: 'user',
            parts: [{ text: input.message }],
        });
        // Helper to generate with target or fallback model
        const tryGenerate = async (modelName) => {
            const modelOptions = {
                model: modelName,
                systemInstruction: systemInstructionText,
                generationConfig: {
                    temperature: 0.7,
                },
            };
            if (input.webAccess) {
                modelOptions.tools = [{ googleSearch: {} }];
            }
            const model = this.genAI.getGenerativeModel(modelOptions);
            return await model.generateContent({ contents });
        };
        let result;
        let actualModel = this.flashModel;
        try {
            result = await tryGenerate(this.flashModel);
        }
        catch (err) {
            console.warn(`[GeminiAIProvider] Error generating with model "${this.flashModel}":`, err?.message || err);
            // Fallback to gemini-2.0-flash if specified model is unsupported
            if (this.flashModel !== 'gemini-2.0-flash') {
                try {
                    actualModel = 'gemini-2.0-flash';
                    result = await tryGenerate('gemini-2.0-flash');
                }
                catch (fbErr) {
                    console.warn('[GeminiAIProvider] Fallback to gemini-2.0-flash failed:', fbErr?.message || fbErr);
                    throw fbErr;
                }
            }
            else {
                throw err;
            }
        }
        const responseText = result.response.text();
        // Extract valid source IDs referenced
        const citedIds = [];
        for (const item of contextItems) {
            if (responseText.includes(item.id) || responseText.includes(item.title)) {
                citedIds.push(item.id);
            }
        }
        // Extract web search grounding sources if present
        const webSources = [];
        const candidate = result.response.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
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
        const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(systemInstructionText.length / 4);
        const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
        const cost = (0, pricing_1.calculateCostMicros)(this.flashModel, inputTokens, outputTokens);
        return {
            response: responseText,
            sourceInspirationIds: citedIds,
            model: actualModel,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
            webSources: webSources.length > 0 ? webSources : undefined,
        };
    }
    async suggestProjectLinks(input) {
        const model = this.genAI.getGenerativeModel({
            model: this.flashModel,
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });
        const candidates = input.inspirations
            .map((i) => `[ID: ${i.id}] "${i.title}": ${i.aiSummary || i.userNote || ''}`)
            .join('\n');
        const prompt = `${prompts_1.PROJECT_LINKING_SYSTEM_PROMPT}

PROJECT:
Title: ${input.projectTitle}
Brief: ${input.projectBrief || 'none'}
Notes: ${input.projectNotes || 'none'}

CANDIDATES FROM USER BANK:
${candidates}
`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        let suggestions = [];
        try {
            suggestions = JSON.parse(responseText);
        }
        catch {
            suggestions = [];
        }
        // Validate that IDs match real candidate IDs
        const validCandidateIds = new Set(input.inspirations.map((i) => i.id));
        suggestions = suggestions.filter((s) => validCandidateIds.has(s.inspirationId));
        const inputTokens = result.response.usageMetadata?.promptTokenCount || Math.round(prompt.length / 4);
        const outputTokens = result.response.usageMetadata?.candidatesTokenCount || Math.round(responseText.length / 4);
        const cost = (0, pricing_1.calculateCostMicros)(this.flashModel, inputTokens, outputTokens);
        return {
            suggestions,
            model: this.flashModel,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
        };
    }
}
exports.GeminiAIProvider = GeminiAIProvider;
//# sourceMappingURL=gemini-provider.js.map
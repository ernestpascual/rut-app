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
    /**
     * Resolves an ordered list of candidate models for Google Generative AI API,
     * attempting the user-selected/configured model first and falling back gracefully
     * to corresponding production Gemini endpoints if a preview tier is not yet released.
     */
    getCandidateModels(preferredModel) {
        const list = [preferredModel];
        if (preferredModel === 'gemini-4') {
            list.push('gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash');
        }
        else if (preferredModel === 'gemini-3.8-flash') {
            list.push('gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash');
        }
        else if (preferredModel === 'gemini-3.6-flash') {
            list.push('gemini-2.0-flash', 'gemini-1.5-flash');
        }
        else {
            list.push('gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash');
        }
        return Array.from(new Set(list));
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
        const prompt = `${prompts_1.INDEXING_SYSTEM_PROMPT}\n\nCONTENT TO ANALYZE:\n${textToAnalyze}`;
        let result;
        let actualModel = this.flashModel;
        const candidateModels = this.getCandidateModels(this.flashModel);
        for (const targetModel of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: targetModel,
                    generationConfig: {
                        responseMimeType: 'application/json',
                    },
                });
                result = await model.generateContent(prompt);
                actualModel = targetModel;
                break;
            }
            catch (err) {
                console.warn(`[GeminiAIProvider] Summarize attempt with model "${targetModel}" failed:`, err?.message || err);
            }
        }
        if (!result) {
            throw new Error(`Gemini summarization failed across models: ${candidateModels.join(', ')}`);
        }
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
            model: actualModel,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
        };
    }
    async generateChatResponse(input) {
        const rawHistory = input.chatHistory || [];
        const historyText = rawHistory.slice(-8).map((m) => m.content || '').join(' ').toLowerCase();
        const isReevaluate = !!input.isReevaluate;
        const totalBankCount = typeof input.totalBankCount === 'number' && input.totalBankCount > 0 ? input.totalBankCount : 0;
        // Anti-fatigue: filter out items already discussed in recent history unless user mentions them
        // or when the user is explicitly requesting a re-evaluation
        const userMentions = (title, id) => input.message.toLowerCase().includes(title.toLowerCase()) || input.message.includes(id);
        const contextItems = [...input.pinnedInspirations, ...input.retrievedInspirations];
        const freshContextItems = isReevaluate
            ? contextItems
            : contextItems.filter((item) => !historyText.includes(item.title.toLowerCase()) || userMentions(item.title, item.id));
        const itemsToProvide = freshContextItems.length > 0 ? freshContextItems : (isReevaluate ? contextItems : []);
        const totalCountText = totalBankCount > 0 ? totalBankCount : itemsToProvide.length;
        let contextFormatted = '';
        if (itemsToProvide.length > 0) {
            const itemsList = itemsToProvide.slice(0, 5)
                .map((item) => {
                const snippet = (item.summary || item.userNote || item.caption || '').slice(0, 160).trim();
                return `- "${item.title}" [ID: ${item.id}]: ${snippet}`;
            })
                .join('\n');
            contextFormatted =
                `\n\nUSER'S INSPIRATION BANK / DUMP CONTEXT:\n` +
                    `- Total inspirations saved in user's bank: ${totalCountText}.\n` +
                    `- Representative / retrieved candidate saves matching this query:\n${itemsList}\n` +
                    `(CRITICAL INSTRUCTION: The user's bank has ${totalCountText} total saved inspirations. The items above are candidate search results retrieved for this query, NOT their entire bank. NEVER claim or tell the user that their bank 'only has 2 items' or 'only has these items'. When the user says 'bank' or 'dump', they are ALWAYS referring to this saved inspiration vault. ${isReevaluate ? 'The user asked to re-evaluate: provide a fresh critical perspective, alternative angles, or deeper analysis.' : 'Connect relevant items naturally as a thoughtful peer; do not list IDs.'})`;
        }
        else if (totalBankCount > 0) {
            contextFormatted =
                `\n\nUSER'S INSPIRATION BANK / DUMP CONTEXT:\n` +
                    `- Total inspirations saved in user's bank: ${totalBankCount}.\n` +
                    `- No saved inspirations matched the specific keywords in this query.\n` +
                    `(CRITICAL INSTRUCTION: When the user asks about their bank or dump, note that their bank contains ${totalBankCount} saved inspirations in total, but none matched this specific query. Answer their question directly with real technical/creative depth.)`;
        }
        const memoryDirective = input.memorySummary
            ? `\n\nCompacted Memory from earlier in this thought:\n${input.memorySummary}`
            : '';
        const webAccessDirective = input.webAccess
            ? `\n\nWEB SEARCH GROUNDING:\nLive internet search is active. Ground your insights in contemporary design precedents, architectural projects, or studio work when relevant.`
            : '';
        const systemInstructionText = `${prompts_1.CHAT_SYSTEM_PROMPT}${memoryDirective}${webAccessDirective}${contextFormatted}`;
        // Clean, alternating multi-turn conversation history
        const contents = [];
        for (const msg of rawHistory) {
            if (!msg.content)
                continue;
            const role = msg.role === 'user' ? 'user' : 'model';
            // If previous message had the same role, combine them to keep strictly alternating turns
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += `\n\n${msg.content}`;
            }
            else {
                contents.push({
                    role,
                    parts: [{ text: msg.content }],
                });
            }
        }
        // Ensure the conversation ends with the current user message
        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents[contents.length - 1].parts[0].text = input.message;
        }
        else {
            contents.push({
                role: 'user',
                parts: [{ text: input.message }],
            });
        }
        // Ensure the first turn is always from 'user'
        while (contents.length > 0 && contents[0].role !== 'user') {
            contents.shift();
        }
        // Helper to generate with target or fallback model
        const tryGenerate = async (modelName) => {
            const modelOptions = {
                model: modelName,
                systemInstruction: systemInstructionText,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                },
            };
            if (input.webAccess) {
                modelOptions.tools = [{ googleSearch: {} }];
            }
            const model = this.genAI.getGenerativeModel(modelOptions);
            return await model.generateContent({ contents });
        };
        let result;
        const requestedModel = input.model ? (0, config_1.validateFlashModel)(input.model) : this.flashModel;
        let actualModel = requestedModel;
        let lastError = null;
        const candidateModels = this.getCandidateModels(requestedModel);
        for (const targetModel of candidateModels) {
            try {
                result = await tryGenerate(targetModel);
                actualModel = targetModel;
                break;
            }
            catch (err) {
                lastError = err;
                console.warn(`[GeminiAIProvider] Attempt with model "${targetModel}" failed:`, err?.message || err);
            }
        }
        if (!result) {
            throw lastError || new Error(`Gemini inference failed across candidate models: ${candidateModels.join(', ')}`);
        }
        const responseText = result.response.text();
        // Extract all sources used by the answer:
        // 1. Items directly mentioned in text by ID or title
        // 2. Active candidate inspirations that were provided as grounding for this query
        const citedIds = [];
        const responseLower = responseText.toLowerCase();
        for (const item of contextItems) {
            const titleLower = item.title.toLowerCase();
            const titleTokens = titleLower.split(/[^a-z0-9_]+/).filter((w) => w.length > 3);
            const isMentioned = responseText.includes(item.id) ||
                responseLower.includes(titleLower) ||
                (titleTokens.length > 0 && titleTokens.filter((w) => responseLower.includes(w)).length >= Math.min(2, titleTokens.length));
            if (isMentioned && !citedIds.includes(item.id)) {
                citedIds.push(item.id);
            }
        }
        // If candidate items were retrieved to ground the answer and the model did not state the bank lacked matches,
        // ensure all grounding items used are included in citedIds
        const isHonestDenial = responseLower.includes('does not have anything saved') ||
            responseLower.includes("don't have anything saved") ||
            responseLower.includes("don't have any saved") ||
            responseLower.includes('no saved inspirations matched');
        if (!isHonestDenial && citedIds.length === 0 && itemsToProvide.length > 0) {
            for (const item of itemsToProvide) {
                if (!citedIds.includes(item.id)) {
                    citedIds.push(item.id);
                }
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
        let result;
        let actualModel = this.flashModel;
        const candidateModels = this.getCandidateModels(this.flashModel);
        for (const targetModel of candidateModels) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: targetModel,
                    generationConfig: {
                        responseMimeType: 'application/json',
                    },
                });
                result = await model.generateContent(prompt);
                actualModel = targetModel;
                break;
            }
            catch (err) {
                console.warn(`[GeminiAIProvider] Project links attempt with model "${targetModel}" failed:`, err?.message || err);
            }
        }
        if (!result) {
            throw new Error(`Gemini project linking failed across models: ${candidateModels.join(', ')}`);
        }
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
            model: actualModel,
            inputTokens,
            outputTokens,
            estimatedCostMicros: cost,
        };
    }
}
exports.GeminiAIProvider = GeminiAIProvider;
//# sourceMappingURL=gemini-provider.js.map
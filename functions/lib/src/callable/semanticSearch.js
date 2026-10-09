"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticSearch = void 0;
const https_1 = require("firebase-functions/v2/https");
const factory_1 = require("../ai/factory");
const retrieval_1 = require("../ai/retrieval");
const ledger_1 = require("../cost/ledger");
const config_1 = require("../config");
exports.semanticSearch = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in to perform search.');
    }
    const uid = request.auth.uid;
    const queryText = (request.data?.query || '').trim();
    if (!queryText) {
        return { inspirationIds: [] };
    }
    if (await (0, config_1.isAiKillSwitchActive)()) {
        throw new https_1.HttpsError('unavailable', 'AI search is temporarily disabled.');
    }
    if (!(await (0, ledger_1.checkCostGuardrails)(uid))) {
        throw new https_1.HttpsError('resource-exhausted', 'Daily AI cost limit reached for this account.');
    }
    try {
        const aiProvider = (0, factory_1.getAIProvider)();
        const embedResult = await aiProvider.generateEmbedding(queryText);
        // Strict owner retrieval: searches only index records belonging to this user
        const results = await (0, retrieval_1.searchOwnerIndex)(uid, embedResult.embedding, 15);
        // Record usage
        await (0, ledger_1.recordUsageEvent)({
            uid,
            operation: 'search',
            provider: embedResult.model.includes('gemini') ? 'google' : 'mock',
            model: embedResult.model,
            inputTokens: Math.round(queryText.length / 4),
            outputTokens: 0,
            chars: queryText.length,
            estimatedCostMicros: 10,
            status: 'success',
        });
        return {
            inspirationIds: results.map((r) => r.inspirationId),
        };
    }
    catch (err) {
        console.error(`[Semantic Search] Error for ${uid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Semantic search failed.');
    }
});
//# sourceMappingURL=semanticSearch.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithBank = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const factory_1 = require("../ai/factory");
const retrieval_1 = require("../ai/retrieval");
const ledger_1 = require("../cost/ledger");
exports.chatWithBank = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = request.auth.uid;
    const chatId = request.data?.chatId;
    const userMessage = (request.data?.message || '').trim();
    if (!chatId || !userMessage) {
        throw new https_1.HttpsError('invalid-argument', 'Chat ID and message content are required.');
    }
    if (await (0, config_1.isAiKillSwitchActive)()) {
        throw new https_1.HttpsError('unavailable', 'AI chat is currently disabled by system administrator.');
    }
    if (!(await (0, ledger_1.checkCostGuardrails)(uid))) {
        throw new https_1.HttpsError('resource-exhausted', 'Daily AI cost limit reached for this account.');
    }
    try {
        const requestedModel = request.data?.model || undefined;
        const aiProvider = (0, factory_1.getAIProvider)(requestedModel);
        // 1. Fetch chat session doc to get pinned items
        const chatDoc = await config_1.db.collection('users').doc(uid).collection('chats').doc(chatId).get();
        if (!chatDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Chat session not found.');
        }
        const chatData = chatDoc.data() || {};
        const pinnedIds = chatData.pinnedInspirationIds || [];
        // 2. Fetch pinned inspiration items
        const pinnedInspirations = [];
        for (const pid of pinnedIds.slice(0, 10)) {
            const itemSnap = await config_1.db.collection('users').doc(uid).collection('inspirations').doc(pid).get();
            if (itemSnap.exists) {
                const d = itemSnap.data();
                pinnedInspirations.push({
                    id: pid,
                    title: d?.title || 'Untitled',
                    summary: d?.aiSummary || d?.userNote || d?.sharedText || '',
                    userNote: d?.userNote,
                    url: d?.url,
                });
            }
        }
        // 3. Perform semantic retrieval for relevant inspirations using message embedding
        const retrievedInspirations = [];
        const queryEmbed = await aiProvider.generateEmbedding(userMessage);
        const searchMatches = await (0, retrieval_1.searchOwnerIndex)(uid, queryEmbed.embedding, 5);
        for (const match of searchMatches) {
            // Exclude already pinned
            if (pinnedIds.includes(match.inspirationId))
                continue;
            const itemSnap = await config_1.db
                .collection('users')
                .doc(uid)
                .collection('inspirations')
                .doc(match.inspirationId)
                .get();
            if (itemSnap.exists) {
                const d = itemSnap.data();
                retrievedInspirations.push({
                    id: match.inspirationId,
                    title: d?.title || 'Untitled',
                    summary: d?.aiSummary || d?.userNote || d?.sharedText || '',
                    userNote: d?.userNote,
                    url: d?.url,
                });
            }
        }
        // 4. Fetch recent chat history window (last 6 messages)
        const historySnap = await config_1.db
            .collection('users')
            .doc(uid)
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(6)
            .get();
        const chatHistory = [];
        historySnap.docs.reverse().forEach((d) => {
            const m = d.data();
            if (m.role === 'user' || m.role === 'assistant') {
                chatHistory.push({ role: m.role, content: m.content });
            }
        });
        // 5. Generate AI Chat response
        const chatResult = await aiProvider.generateChatResponse({
            message: userMessage,
            chatHistory,
            pinnedInspirations,
            retrievedInspirations,
        });
        // 6. Record usage event in integer micros
        await (0, ledger_1.recordUsageEvent)({
            uid,
            operation: 'chat',
            provider: chatResult.model.includes('gemini') ? 'google' : 'mock',
            model: chatResult.model,
            inputTokens: chatResult.inputTokens,
            outputTokens: chatResult.outputTokens,
            estimatedCostMicros: chatResult.estimatedCostMicros,
            status: 'success',
        });
        return {
            response: chatResult.response,
            sourceInspirationIds: chatResult.sourceInspirationIds,
            model: chatResult.model,
            inputTokens: chatResult.inputTokens,
            outputTokens: chatResult.outputTokens,
            estimatedCostMicros: chatResult.estimatedCostMicros,
        };
    }
    catch (err) {
        console.error(`[Chat With Bank] Error for user ${uid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Chat generation failed.');
    }
});
//# sourceMappingURL=chatWithBank.js.map
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
        const webAccess = Boolean(request.data?.webAccess);
        const aiProvider = (0, factory_1.getAIProvider)(requestedModel);
        // 1. Fetch chat session doc to get pinned items
        const chatDoc = await config_1.db.collection('users').doc(uid).collection('chats').doc(chatId).get();
        if (!chatDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Chat session not found.');
        }
        const chatData = chatDoc.data() || {};
        const pinnedIds = chatData.pinnedInspirationIds || [];
        // 2. Fetch pinned inspiration items with full RAG detail
        const pinnedInspirations = [];
        for (const pid of pinnedIds.slice(0, 10)) {
            const itemSnap = await config_1.db.collection('users').doc(uid).collection('inspirations').doc(pid).get();
            if (itemSnap.exists) {
                const d = itemSnap.data();
                pinnedInspirations.push({
                    id: pid,
                    title: d?.title || 'Untitled',
                    summary: d?.aiSummary || d?.userNote || d?.sharedText || d?.previewDescription || '',
                    userNote: d?.userNote || null,
                    caption: d?.caption || null,
                    url: d?.url || null,
                    domain: d?.sourceDomain || d?.siteName || d?.sourcePlatform || null,
                    author: d?.author || null,
                    tags: d?.tags || [],
                    concepts: d?.concepts || [],
                });
            }
        }
        // 3. Multi-source RAG Knowledge Base Retrieval
        // Sources:
        // A) Semantic vector search via _aiInspirationIndex
        // B) Direct Firestore dump collection items
        // C) Client-provided dumpContext (ensures offline/recent saves are immediately in knowledgebase)
        const candidateMap = new Map();
        // Client dump context
        const clientDump = Array.isArray(request.data?.dumpContext)
            ? request.data.dumpContext
            : [];
        for (const item of clientDump) {
            if (item.id && !pinnedIds.includes(item.id)) {
                candidateMap.set(item.id, item);
            }
        }
        // Vector search
        try {
            const queryEmbed = await aiProvider.generateEmbedding(userMessage);
            const searchMatches = await (0, retrieval_1.searchOwnerIndex)(uid, queryEmbed.embedding, 10);
            for (const match of searchMatches) {
                if (pinnedIds.includes(match.inspirationId))
                    continue;
                if (!candidateMap.has(match.inspirationId)) {
                    const snap = await config_1.db
                        .collection('users')
                        .doc(uid)
                        .collection('inspirations')
                        .doc(match.inspirationId)
                        .get();
                    if (snap.exists) {
                        const d = snap.data();
                        candidateMap.set(match.inspirationId, {
                            id: match.inspirationId,
                            title: d?.title || 'Untitled',
                            summary: d?.aiSummary || d?.userNote || d?.sharedText || d?.previewDescription || '',
                            userNote: d?.userNote || null,
                            caption: d?.caption || null,
                            url: d?.url || null,
                            domain: d?.sourceDomain || d?.siteName || d?.sourcePlatform || null,
                            author: d?.author || null,
                            tags: d?.tags || [],
                            concepts: d?.concepts || [],
                        });
                    }
                }
            }
        }
        catch (e) {
            console.warn('[RAG] Vector retrieval error:', e);
        }
        // Firestore fallback / top recent saves if pool is small
        if (candidateMap.size < 8) {
            try {
                const recentSnap = await config_1.db
                    .collection('users')
                    .doc(uid)
                    .collection('inspirations')
                    .where('archived', '==', false)
                    .limit(20)
                    .get();
                recentSnap.forEach((docSnap) => {
                    if (!pinnedIds.includes(docSnap.id) && !candidateMap.has(docSnap.id)) {
                        const d = docSnap.data();
                        candidateMap.set(docSnap.id, {
                            id: docSnap.id,
                            title: d?.title || 'Untitled',
                            summary: d?.aiSummary || d?.userNote || d?.sharedText || d?.previewDescription || '',
                            userNote: d?.userNote || null,
                            caption: d?.caption || null,
                            url: d?.url || null,
                            domain: d?.sourceDomain || d?.siteName || d?.sourcePlatform || null,
                            author: d?.author || null,
                            tags: d?.tags || [],
                            concepts: d?.concepts || [],
                        });
                    }
                });
            }
            catch (e) {
                console.warn('[RAG] Firestore dump fetch fallback:', e);
            }
        }
        // Keyword & thematic scoring across candidate pool
        const qTokens = userMessage.toLowerCase().split(/[\s,.-]+/).filter((t) => t.length > 2);
        const scoredList = Array.from(candidateMap.values()).map((item) => {
            let score = 0;
            const haystack = `${item.title} ${item.userNote || ''} ${item.caption || ''} ${item.summary || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')} ${item.domain || ''}`.toLowerCase();
            for (const tok of qTokens) {
                if (haystack.includes(tok))
                    score += 3;
            }
            return { item, score };
        });
        scoredList.sort((a, b) => b.score - a.score);
        const isDumpQuery = /dump|bank|save|inspiration|reference/i.test(userMessage);
        const scoredPositive = scoredList.filter((sc) => sc.score > 0);
        const retrievedInspirations = isDumpQuery
            ? (scoredPositive.length > 0 ? scoredPositive.slice(0, 4) : scoredList.slice(0, 3)).map((sc) => sc.item)
            : scoredPositive.slice(0, 3).map((sc) => sc.item);
        // 4. Multi-turn conversation history window (up to 12 messages for full dialogue memory)
        let chatHistory = [];
        if (Array.isArray(request.data?.chatHistory) && request.data.chatHistory.length > 0) {
            chatHistory = request.data.chatHistory
                .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
                .map((m) => ({ role: m.role, content: m.content.trim() }));
        }
        else {
            try {
                const historySnap = await config_1.db
                    .collection('users')
                    .doc(uid)
                    .collection('chats')
                    .doc(chatId)
                    .collection('messages')
                    .orderBy('createdAt', 'desc')
                    .limit(12)
                    .get();
                historySnap.docs.reverse().forEach((d) => {
                    const m = d.data();
                    if (m.role === 'user' || m.role === 'assistant') {
                        chatHistory.push({ role: m.role, content: (m.content || '').trim() });
                    }
                });
            }
            catch (hErr) {
                console.warn('[Chat] History fetch error:', hErr);
            }
        }
        // Strip out the current message if it was already saved and present at the end of chatHistory
        if (chatHistory.length > 0) {
            const last = chatHistory[chatHistory.length - 1];
            if (last.role === 'user' && last.content === userMessage) {
                chatHistory = chatHistory.slice(0, -1);
            }
        }
        // 5. Generate AI Chat response
        const chatResult = await aiProvider.generateChatResponse({
            message: userMessage,
            chatHistory,
            pinnedInspirations,
            retrievedInspirations,
            webAccess,
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
            webAccess,
            webSources: chatResult.webSources || [],
        };
    }
    catch (err) {
        console.error(`[Chat With Bank] Error for user ${uid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Chat generation failed.');
    }
});
//# sourceMappingURL=chatWithBank.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const factory_1 = require("../ai/factory");
const ledger_1 = require("../cost/ledger");
exports.summarizeChat = (0, https_1.onCall)({
    invoker: 'public',
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = request.auth.uid;
    const chatId = request.data?.chatId;
    if (!chatId) {
        throw new https_1.HttpsError('invalid-argument', 'Chat ID is required.');
    }
    if (await (0, config_1.isAiKillSwitchActive)()) {
        throw new https_1.HttpsError('unavailable', 'AI operations are currently disabled.');
    }
    const chatDocRef = config_1.db.collection('users').doc(uid).collection('chats').doc(chatId);
    const chatDoc = await chatDocRef.get();
    if (!chatDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Chat session not found.');
    }
    const chatData = chatDoc.data() || {};
    // Fetch messages to check if there are changes
    const msgSnap = await chatDocRef.collection('messages').orderBy('createdAt', 'asc').get();
    if (msgSnap.empty) {
        return { summary: '', cached: true };
    }
    const messages = msgSnap.docs.map((d) => d.data());
    const lastMessage = messages[messages.length - 1];
    // If there are no last changes from the chat, do not reprocess the summary!
    if (chatData.thoughtSummary && chatData.summaryLastMessageId === lastMessage.id) {
        return {
            summary: chatData.thoughtSummary,
            cached: true,
        };
    }
    if (!(await (0, ledger_1.checkCostGuardrails)(uid))) {
        // If guardrail hit, return existing summary or quick local synthesis
        if (chatData.thoughtSummary) {
            return { summary: chatData.thoughtSummary, cached: true };
        }
        throw new https_1.HttpsError('resource-exhausted', 'Daily AI cost limit reached.');
    }
    try {
        const conversationText = messages
            .slice(-20)
            .map((m) => `${m.role === 'user' ? 'User' : 'Rut'}: ${m.content}`)
            .join('\n\n');
        const prompt = `You are an expert editorial curator. Summarize the following brainstorming conversation in EXACTLY 2 clear, concise sentences. Focus strictly on the most relevant creative angles, core decisions, or practical insights developed during the chat. Do not include intro or outro text—provide ONLY the 2-sentence summary.

CONVERSATION:
${conversationText}`;
        const requestedModel = request.data?.model || chatData.model || undefined;
        const aiProvider = (0, factory_1.getAIProvider)(requestedModel);
        const chatResult = await aiProvider.generateChatResponse({
            message: prompt,
            chatHistory: [],
            retrievedInspirations: [],
            pinnedInspirations: [],
            model: requestedModel,
        });
        const summary = (chatResult.response || '').trim();
        await (0, ledger_1.recordUsageEvent)({
            uid,
            operation: 'chat',
            provider: 'google',
            model: chatResult.model,
            inputTokens: chatResult.inputTokens,
            outputTokens: chatResult.outputTokens,
            estimatedCostMicros: chatResult.estimatedCostMicros,
            status: 'success',
        });
        // Store generated summary in Firestore
        await chatDocRef.set({
            thoughtSummary: summary,
            summaryLastMessageId: lastMessage.id,
            summaryUpdatedAt: Date.now(),
            summaryMessageCount: messages.length,
            updatedAt: Date.now(),
        }, { merge: true });
        return {
            summary,
            cached: false,
        };
    }
    catch (err) {
        console.error(`[summarizeChat] Error for chat ${chatId}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Failed to summarize chat.');
    }
});
//# sourceMappingURL=summarizeChat.js.map
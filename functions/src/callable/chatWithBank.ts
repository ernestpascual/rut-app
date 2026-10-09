import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, isAiKillSwitchActive } from '../config';
import { getAIProvider } from '../ai/factory';
import { searchOwnerIndex } from '../ai/retrieval';
import { recordUsageEvent, checkCostGuardrails } from '../cost/ledger';
import { InspirationContextItem } from '../ai/provider';

export const chatWithBank = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const chatId = request.data?.chatId;
  const userMessage = (request.data?.message || '').trim();

  if (!chatId || !userMessage) {
    throw new HttpsError('invalid-argument', 'Chat ID and message content are required.');
  }

  if (await isAiKillSwitchActive()) {
    throw new HttpsError('unavailable', 'AI chat is currently disabled by system administrator.');
  }

  if (!(await checkCostGuardrails(uid))) {
    throw new HttpsError('resource-exhausted', 'Daily AI cost limit reached for this account.');
  }

  try {
    const requestedModel = request.data?.model || undefined;
    const aiProvider = getAIProvider(requestedModel);

    // 1. Fetch chat session doc to get pinned items
    const chatDoc = await db.collection('users').doc(uid).collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      throw new HttpsError('not-found', 'Chat session not found.');
    }
    const chatData = chatDoc.data() || {};
    const pinnedIds: string[] = chatData.pinnedInspirationIds || [];

    // 2. Fetch pinned inspiration items
    const pinnedInspirations: InspirationContextItem[] = [];
    for (const pid of pinnedIds.slice(0, 10)) {
      const itemSnap = await db.collection('users').doc(uid).collection('inspirations').doc(pid).get();
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
    const retrievedInspirations: InspirationContextItem[] = [];
    const queryEmbed = await aiProvider.generateEmbedding(userMessage);
    const searchMatches = await searchOwnerIndex(uid, queryEmbed.embedding, 5);

    for (const match of searchMatches) {
      // Exclude already pinned
      if (pinnedIds.includes(match.inspirationId)) continue;

      const itemSnap = await db
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
    const historySnap = await db
      .collection('users')
      .doc(uid)
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
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
    await recordUsageEvent({
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
  } catch (err: any) {
    console.error(`[Chat With Bank] Error for user ${uid}:`, err);
    throw new HttpsError('internal', err.message || 'Chat generation failed.');
  }
});

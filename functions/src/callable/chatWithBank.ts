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
    const webAccess = Boolean(request.data?.webAccess);
    const aiProvider = getAIProvider(requestedModel);

    // 1. Fetch chat session doc to get pinned items
    const chatDoc = await db.collection('users').doc(uid).collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      throw new HttpsError('not-found', 'Chat session not found.');
    }
    const chatData = chatDoc.data() || {};
    const pinnedIds: string[] = chatData.pinnedInspirationIds || [];

    // 2. Fetch pinned inspiration items with full RAG detail
    const pinnedInspirations: InspirationContextItem[] = [];
    for (const pid of pinnedIds.slice(0, 10)) {
      const itemSnap = await db.collection('users').doc(uid).collection('inspirations').doc(pid).get();
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
    const candidateMap = new Map<string, InspirationContextItem>();

    // Client dump context
    const clientDump: InspirationContextItem[] = Array.isArray(request.data?.dumpContext)
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
      const searchMatches = await searchOwnerIndex(uid, queryEmbed.embedding, 10);
      for (const match of searchMatches) {
        if (pinnedIds.includes(match.inspirationId)) continue;
        if (!candidateMap.has(match.inspirationId)) {
          const snap = await db
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
    } catch (e) {
      console.warn('[RAG] Vector retrieval error:', e);
    }

    // Firestore fallback / top recent saves if pool is small
    if (candidateMap.size < 8) {
      try {
        const recentSnap = await db
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
      } catch (e) {
        console.warn('[RAG] Firestore dump fetch fallback:', e);
      }
    }

    // Keyword & thematic scoring across candidate pool
    const qTokens = userMessage.toLowerCase().split(/[\s,.-]+/).filter((t: string) => t.length > 2);
    const scoredList = Array.from(candidateMap.values()).map((item) => {
      let score = 0;
      const haystack = `${item.title} ${item.userNote || ''} ${item.caption || ''} ${item.summary || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')} ${item.domain || ''}`.toLowerCase();

      for (const tok of qTokens) {
        if (haystack.includes(tok)) score += 3;
      }
      return { item, score };
    });

    scoredList.sort((a, b) => b.score - a.score);
    const isDumpQuery = /dump|bank|save|inspiration|reference/i.test(userMessage);
    const scoredPositive = scoredList.filter((sc) => sc.score > 0);
    const retrievedInspirations = isDumpQuery
      ? (scoredPositive.length > 0 ? scoredPositive.slice(0, 4) : scoredList.slice(0, 3)).map((sc) => sc.item)
      : scoredPositive.slice(0, 3).map((sc) => sc.item);

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
      webAccess,
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
      webAccess,
      webSources: chatResult.webSources || [],
    };
  } catch (err: any) {
    console.error(`[Chat With Bank] Error for user ${uid}:`, err);
    throw new HttpsError('internal', err.message || 'Chat generation failed.');
  }
});

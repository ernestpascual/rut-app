import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, isAiKillSwitchActive } from '../config';
import { getAIProvider } from '../ai/factory';
import { searchOwnerIndex } from '../ai/retrieval';
import { recordUsageEvent, checkCostGuardrails } from '../cost/ledger';
import { InspirationContextItem } from '../ai/provider';

export const chatWithBank = onCall(
  {
    invoker: 'public',
    cors: true,
    timeoutSeconds: 60,
  },
  async (request) => {
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
      // 1. Fetch chat session doc or auto-create if missing
      let pinnedIds: string[] = Array.isArray(request.data?.pinnedInspirationIds)
        ? request.data.pinnedInspirationIds
        : [];
      let memorySummary: string | null =
        typeof request.data?.memorySummary === 'string' ? request.data.memorySummary : null;
      let sessionModel: string | null = null;

      try {
        const chatDocRef = db.collection('users').doc(uid).collection('chats').doc(chatId);
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) {
          const chatData = chatDoc.data() || {};
          if (Array.isArray(chatData.pinnedInspirationIds)) {
            pinnedIds = Array.from(new Set([...pinnedIds, ...chatData.pinnedInspirationIds]));
          }
          if (chatData.memorySummary && !memorySummary) {
            memorySummary = chatData.memorySummary;
          }
          if (chatData.model) {
            sessionModel = chatData.model;
          }
        }
      } catch (docErr) {
        console.warn('[chatWithBank] Chat doc fetch/init warning:', docErr);
      }

      // 2. Fetch user's preferred model from Settings if neither request nor thought specifies one
      let userPreferredModel: string | null = null;
      if (!request.data?.model && !sessionModel) {
        try {
          const userSnap = await db.collection('users').doc(uid).get();
          if (userSnap.exists && userSnap.data()?.preferredModel) {
            userPreferredModel = userSnap.data()?.preferredModel;
          }
        } catch (uErr) {
          console.warn('[chatWithBank] User doc fetch warning:', uErr);
        }
      }

      // Priority: request override > thought setting > user settings preferredModel > default
      const requestedModel = request.data?.model || sessionModel || userPreferredModel || undefined;
      const webAccess = Boolean(request.data?.webAccess);
      const aiProvider = getAIProvider(requestedModel);

      // Save/persist session with model
      try {
        const chatDocRef = db.collection('users').doc(uid).collection('chats').doc(chatId);
        await chatDocRef.set(
          {
            id: chatId,
            ownerUid: uid,
            model: requestedModel || 'gemini-3.5-flash-lite',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (docErr) {
        console.warn('[chatWithBank] Chat doc update warning:', docErr);
      }

      // 2. Multi-turn conversation history window (capped at 20 recent turns; earlier turns compacted)
      let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (Array.isArray(request.data?.chatHistory) && request.data.chatHistory.length > 0) {
        chatHistory = request.data.chatHistory
          .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m: any) => ({ role: m.role, content: m.content.trim() }));
      } else {
        try {
          const historySnap = await db
            .collection('users')
            .doc(uid)
            .collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

          const fetched = historySnap.docs.reverse().map((d) => {
            const m = d.data();
            return { role: m.role as 'user' | 'assistant', content: (m.content || '').trim() };
          }).filter((m) => m.role === 'user' || m.role === 'assistant');

          chatHistory = fetched;
        } catch (hErr) {
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

      // 3. Fetch pinned inspiration items with full RAG detail
      const pinnedInspirations: InspirationContextItem[] = [];
      for (const pid of pinnedIds.slice(0, 4)) {
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

      // 4. Multi-source RAG Knowledge Base Retrieval
      const candidateMap = new Map<string, InspirationContextItem>();

      // Fetch user's inspirations directly from Firestore so server RAG is always comprehensive
      try {
        const userInspirationsSnap = await db
          .collection('users')
          .doc(uid)
          .collection('inspirations')
          .where('archived', '==', false)
          .limit(80)
          .get();

        for (const doc of userInspirationsSnap.docs) {
          if (!pinnedIds.includes(doc.id)) {
            const d = doc.data();
            candidateMap.set(doc.id, {
              id: doc.id,
              title: d?.title || 'Untitled',
              summary: d?.aiSummary || d?.userNote || d?.sharedText || d?.previewDescription || d?.caption || '',
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
      } catch (fetchErr) {
        console.warn('[RAG] Error fetching user inspirations from Firestore:', fetchErr);
      }

      // Add client dump context (e.g. from local storage or cached state)
      const clientDump: InspirationContextItem[] = Array.isArray(request.data?.dumpContext)
        ? request.data.dumpContext
        : [];
      for (const item of clientDump) {
        if (item.id && !pinnedIds.includes(item.id) && !candidateMap.has(item.id)) {
          candidateMap.set(item.id, item);
        }
      }

      // Fetch total bank count from Firestore so the assistant always knows the true bank size
      let totalBankCount = typeof request.data?.totalBankCount === 'number' && request.data.totalBankCount > 0
        ? request.data.totalBankCount
        : 0;

      try {
        const countSnap = await db
          .collection('users')
          .doc(uid)
          .collection('inspirations')
          .where('archived', '==', false)
          .count()
          .get();
        totalBankCount = Math.max(totalBankCount, countSnap.data().count);
      } catch (countErr) {
        totalBankCount = Math.max(totalBankCount, candidateMap.size, clientDump.length);
      }
      totalBankCount = Math.max(totalBankCount, candidateMap.size, clientDump.length);

      // Check if user specifically asks to inspect or pull from their dump/bank
      const isDumpQuery =
        /\b(dump|bank|saves?|saved|inspirations?|references?|bookmarks?|vault|pin(ned)?)\b/i.test(userMessage) ||
        /\b(check|pull|search|look up|show me|find|from my|what do i have)\b.*\b(dump|bank|saves?|inspirations?|notes?)\b/i.test(userMessage) ||
        /\b(pull|bring up|connect to|relate to)\b.*\b(saves?|inspirations?|bank|dump)\b/i.test(userMessage);

      // Check if user specifically asks to re-evaluate, review, or rethink
      const isReevaluateQuery =
        /\b(re-?evaluate|re-?examine|re-?check|re-?assess|re-?think|re-?consider|look again|check again|analyze again|look closer|re-?analyze|review|fresh look|re-?inspect|take another look|evaluate again)\b/i.test(userMessage);

      // Clean, meaningful search tokens (ignoring purely grammatical filler)
      const STOP_WORDS = new Set([
        'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
        'will', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'all', 'any', 'can',
        'could', 'should', 'would', 'about', 'into', 'some', 'than', 'them', 'then', 'there',
        'these', 'they', 'you', 'your', 'our', 'just', 'more', 'also', 'like', 'think',
        'give', 'tell', 'help', 'much', 'many', 'good', 'well', 'talk', 'such', 'very',
        'even', 'most', 'only', 'hello', 'hey', 'okay', 'sure', 'please', 'thanks', 'thank',
        'something', 'anything', 'everything', 'nothing', 'things', 'thing',
        'question', 'answer', 'does', 'doesnt', "doesn't", 'dont', "don't", 'did', 'didnt', "didn't"
      ]);

      const qTokens = userMessage
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((t: string) => t.length > 2 && !STOP_WORDS.has(t));

      // Separate meta-vocabulary (terms like 'bank', 'dump', 'vault', 'saves', 'inspirations')
      // from actual subject matter keywords (like 'wifi', 'sensor', 'iot', 'poster', 'typography')
      const BANK_META_TERMS = new Set([
        'bank', 'dump', 'save', 'saves', 'saved', 'vault',
        'inspiration', 'inspirations', 'reference', 'references',
        'item', 'items', 'note', 'notes', 'file', 'files',
        'pin', 'pins', 'pinned', 'bookmark', 'bookmarks', 'total'
      ]);

      const topicTokens = qTokens.filter((t: string) => !BANK_META_TERMS.has(t));
      const isBroadBankQuery = isDumpQuery && topicTokens.length === 0;

      // Stem generator for fuzzy matching (plural, ing, ed)
      const getWordStems = (word: string): string[] => {
        const clean = word.toLowerCase().trim();
        if (clean.length <= 2) return [clean];
        const stems = new Set<string>([clean]);
        if (clean.endsWith('ies') && clean.length > 4) {
          stems.add(clean.slice(0, -3) + 'y');
        } else if (clean.endsWith('es') && clean.length > 4) {
          stems.add(clean.slice(0, -2));
        } else if (clean.endsWith('s') && clean.length > 3) {
          stems.add(clean.slice(0, -1));
        }
        if (clean.endsWith('ing') && clean.length > 5) {
          stems.add(clean.slice(0, -3));
        } else if (clean.endsWith('ed') && clean.length > 4) {
          stems.add(clean.slice(0, -2));
        }
        return Array.from(stems);
      };

      // Vector semantic search with realistic cosine thresholds
      const vectorThreshold = isDumpQuery ? 0.35 : 0.44;
      const vectorSimMap = new Map<string, number>();

      try {
        const queryEmbed = await aiProvider.generateEmbedding(userMessage);
        const searchMatches = await searchOwnerIndex(uid, queryEmbed.embedding, 12, vectorThreshold);
        for (const match of searchMatches) {
          if (pinnedIds.includes(match.inspirationId)) continue;
          vectorSimMap.set(match.inspirationId, match.similarity);
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

      // Anti-fatigue tracking: find inspiration titles / IDs already discussed in recent history
      // When the user asks to re-evaluate, do NOT lock them out!
      const recentlyDiscussed = new Set<string>();
      if (!isReevaluateQuery) {
        for (const turn of chatHistory.slice(-8)) {
          const contentLower = (turn.content || '').toLowerCase();
          for (const item of candidateMap.values()) {
            if (contentLower.includes(item.id.toLowerCase()) || contentLower.includes(item.title.toLowerCase())) {
              recentlyDiscussed.add(item.id);
            }
          }
          for (const item of pinnedInspirations) {
            if (contentLower.includes(item.id.toLowerCase()) || contentLower.includes(item.title.toLowerCase())) {
              recentlyDiscussed.add(item.id);
            }
          }
        }
      }

      const userExplicitlyAsked = (itemTitle: string, itemId: string) =>
        isReevaluateQuery || userMessage.toLowerCase().includes(itemTitle.toLowerCase()) || userMessage.includes(itemId);

      let retrievedInspirations: InspirationContextItem[] = [];

      if (isBroadBankQuery) {
        // Broad bank query: provide representative sample across active inspirations
        retrievedInspirations = Array.from(candidateMap.values()).slice(0, 5);
      } else {
        const tokensToScore = topicTokens.length > 0 ? topicTokens : qTokens;

        // Multi-layer Hybrid Scoring (Keyword Stems + Field Specificity + Vector Cosine Similarity)
        const scoredList = Array.from(candidateMap.values())
          .filter((item) => !recentlyDiscussed.has(item.id) || userExplicitlyAsked(item.title, item.id))
          .map((item) => {
            let score = 0;
            const titleLower = (item.title || '').toLowerCase();
            const tagsLower = (item.tags || []).join(' ').toLowerCase();
            const conceptsLower = (item.concepts || []).join(' ').toLowerCase();
            const summaryLower = (item.summary || '').toLowerCase();
            const noteLower = (item.userNote || item.caption || '').toLowerCase();
            const domainLower = (item.domain || '').toLowerCase();
            const haystack = `${titleLower} ${tagsLower} ${conceptsLower} ${summaryLower} ${noteLower} ${domainLower}`;

            for (const tok of tokensToScore) {
              const stems = getWordStems(tok);

              for (const stem of stems) {
                const exactRegex = new RegExp(`(?:^|[^a-z0-9_])${stem}(?:$|[^a-z0-9_])`, 'i');

                if (exactRegex.test(titleLower)) {
                  score += 7;
                  break;
                }
                if (exactRegex.test(tagsLower) || exactRegex.test(conceptsLower)) {
                  score += 5;
                  break;
                }
                if (exactRegex.test(summaryLower) || exactRegex.test(noteLower)) {
                  score += 4;
                  break;
                }
                if (haystack.includes(stem)) {
                  score += 3;
                  break;
                }
              }
            }

            // Add continuous vector similarity bonus
            const vectorSim = vectorSimMap.get(item.id);
            if (typeof vectorSim === 'number' && vectorSim > 0) {
              score += Math.round(vectorSim * 14);
            }

            return { item, score, vectorSim: vectorSim || 0 };
          });

        scoredList.sort((a, b) => b.score - a.score);

        // In dump queries, require score >= 4 to be considered relevant.
        // In normal dialogue, require score >= 7 or vector similarity >= 0.48 so only truly relevant saves ground the discussion.
        const minScoreThreshold = isDumpQuery ? 4 : 7;
        const scoredPositive = scoredList.filter((sc) => sc.score >= minScoreThreshold);

        retrievedInspirations = scoredPositive
          .slice(0, isDumpQuery ? 4 : 2)
          .map((sc) => sc.item);
      }

      // For pinned inspirations: only pass them if not already exhaustively cited in recent history (unless re-evaluating)
      const freshPinned = isReevaluateQuery
        ? pinnedInspirations
        : pinnedInspirations.filter(
            (item) => !recentlyDiscussed.has(item.id) || userExplicitlyAsked(item.title, item.id)
          );

      // Memory Compaction: Only when conversation has grown very long (> 20 messages),
      // compact older turns into memorySummary while preserving the last 20 turns of active dialogue
      if (chatHistory.length > 20) {
        const older = chatHistory.slice(0, -20);
        const recent = chatHistory.slice(-20);
        const compactionExcerpt = older
          .map((m) => `${m.role === 'user' ? 'User' : 'Rut'}: "${m.content.slice(0, 90)}"`)
          .join('; ');
        memorySummary = memorySummary
          ? `${memorySummary} Earlier: ${compactionExcerpt}`.slice(0, 800)
          : `Earlier conversation points: ${compactionExcerpt}`.slice(0, 800);
        chatHistory = recent;

        try {
          await db.collection('users').doc(uid).collection('chats').doc(chatId).set(
            {
              memorySummary,
              compactedMessageCount: older.length,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } catch (compErr) {
          console.warn('[Chat] Failed to persist compacted memory:', compErr);
        }
      }

      // 5. Generate AI Chat response
      const chatResult = await aiProvider.generateChatResponse({
        message: userMessage,
        chatHistory,
        pinnedInspirations: freshPinned,
        retrievedInspirations,
        webAccess,
        memorySummary,
        model: requestedModel,
        totalBankCount,
        isReevaluate: isReevaluateQuery,
        isLiveAudio: Boolean(request.data?.isLiveAudio),
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
        memorySummary: memorySummary || undefined,
      };
    } catch (err: any) {
      console.error(`[Chat With Bank] Error for user ${uid}:`, err);
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', err?.message || 'Chat generation failed.');
    }
  }
);

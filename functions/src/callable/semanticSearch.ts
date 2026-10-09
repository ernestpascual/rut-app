import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAIProvider } from '../ai/factory';
import { searchOwnerIndex } from '../ai/retrieval';
import { recordUsageEvent, checkCostGuardrails } from '../cost/ledger';
import { isAiKillSwitchActive } from '../config';

export const semanticSearch = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in to perform search.');
  }

  const uid = request.auth.uid;
  const queryText = (request.data?.query || '').trim();

  if (!queryText) {
    return { inspirationIds: [] };
  }

  if (await isAiKillSwitchActive()) {
    throw new HttpsError('unavailable', 'AI search is temporarily disabled.');
  }

  if (!(await checkCostGuardrails(uid))) {
    throw new HttpsError('resource-exhausted', 'Daily AI cost limit reached for this account.');
  }

  try {
    const aiProvider = getAIProvider();
    const embedResult = await aiProvider.generateEmbedding(queryText);

    // Strict owner retrieval: searches only index records belonging to this user
    const results = await searchOwnerIndex(uid, embedResult.embedding, 15);

    // Record usage
    await recordUsageEvent({
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
  } catch (err: any) {
    console.error(`[Semantic Search] Error for ${uid}:`, err);
    throw new HttpsError('internal', err.message || 'Semantic search failed.');
  }
});

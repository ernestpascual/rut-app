import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, isAiKillSwitchActive } from '../config';
import { getAIProvider } from '../ai/factory';
import { recordUsageEvent, checkCostGuardrails } from '../cost/ledger';

export const suggestProjectLinks = onCall({ invoker: 'public', cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const projectId = request.data?.projectId;

  if (!projectId) {
    throw new HttpsError('invalid-argument', 'Project ID is required.');
  }

  if (await isAiKillSwitchActive()) {
    throw new HttpsError('unavailable', 'AI matching is temporarily disabled.');
  }

  if (!(await checkCostGuardrails(uid))) {
    throw new HttpsError('resource-exhausted', 'Daily AI cost limit reached.');
  }

  try {
    const projSnap = await db.collection('users').doc(uid).collection('projects').doc(projectId).get();
    if (!projSnap.exists) {
      throw new HttpsError('not-found', 'Project not found.');
    }
    const projData = projSnap.data() || {};

    // Fetch existing linked inspiration IDs to exclude
    const linksSnap = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(projectId)
      .collection('inspirationLinks')
      .get();

    const existingLinkedIds = new Set(linksSnap.docs.map((d) => d.id));

    // Fetch candidate inspirations
    const inspirationsSnap = await db
      .collection('users')
      .doc(uid)
      .collection('inspirations')
      .where('archived', '==', false)
      .limit(30)
      .get();

    const candidates = inspirationsSnap.docs
      .filter((d) => !existingLinkedIds.has(d.id))
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || 'Untitled',
          aiSummary: data.aiSummary,
          userNote: data.userNote,
          concepts: data.concepts,
        };
      });

    if (candidates.length === 0) {
      return { suggestions: [] };
    }

    const requestedModel = request.data?.model || undefined;
    const aiProvider = getAIProvider(requestedModel);
    const result = await aiProvider.suggestProjectLinks({
      projectTitle: projData.title || '',
      projectBrief: projData.brief,
      projectNotes: projData.notes,
      inspirations: candidates,
    });

    await recordUsageEvent({
      uid,
      operation: 'project_link',
      provider: result.model.includes('gemini') ? 'google' : 'mock',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostMicros: result.estimatedCostMicros,
      status: 'success',
    });

    return {
      suggestions: (result.suggestions || []).slice(0, 5),
    };
  } catch (err: any) {
    console.error(`[Project Link Suggestion] Error for ${uid}:`, err);
    throw new HttpsError('internal', err.message || 'Could not suggest project links.');
  }
});

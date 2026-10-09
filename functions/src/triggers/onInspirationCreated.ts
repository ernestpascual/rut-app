import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db, isAiKillSwitchActive } from '../config';
import { getAIProvider } from '../ai/factory';
import { saveIndexRecord } from '../ai/retrieval';
import { fetchPublicMetadata } from '../metadata/fetcher';
import { recordUsageEvent, checkCostGuardrails } from '../cost/ledger';

export const onInspirationWritten = onDocumentWritten(
  'users/{uid}/inspirations/{inspirationId}',
  async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) {
      // Document deleted - cleanup index
      const { uid, inspirationId } = event.params;
      try {
        await db.collection('_aiInspirationIndex').doc(`${uid}_${inspirationId}`).delete();
      } catch (err) {
        console.warn('Index cleanup error:', err);
      }
      return;
    }

    const data = afterSnap.data();
    if (!data || data.processingStatus !== 'pending') {
      return; // Only process pending items
    }

    const { uid, inspirationId } = event.params;

    // Check kill switch
    if (await isAiKillSwitchActive()) {
      console.warn('[Indexing] AI Kill Switch is active. Marking failed.');
      await afterSnap.ref.update({
        processingStatus: 'failed',
        processingErrorCode: 'AI_DISABLED',
        updatedAt: Date.now(),
      });
      return;
    }

    // Check cost guardrails
    if (!(await checkCostGuardrails(uid))) {
      console.warn(`[Indexing] User ${uid} daily limit reached.`);
      await afterSnap.ref.update({
        processingStatus: 'failed',
        processingErrorCode: 'DAILY_LIMIT_REACHED',
        updatedAt: Date.now(),
      });
      return;
    }

    // Mark as processing
    await afterSnap.ref.update({ processingStatus: 'processing' });

    try {
      let previewDescription = data.previewDescription || null;
      let remotePreviewImageUrl = data.remotePreviewImageUrl || null;
      let canonicalUrl = data.canonicalUrl || null;

      // 1. Fetch public metadata if URL present and not yet fetched
      if (data.url && !data.previewDescription) {
        const meta = await fetchPublicMetadata(data.url);
        previewDescription = meta.description;
        remotePreviewImageUrl = meta.remotePreviewImageUrl;
        canonicalUrl = meta.canonicalUrl;
      }

      // 2. Call AI provider for summary, tags, and embedding
      const userDoc = await db.collection('users').doc(uid).get();
      const preferredModel = userDoc.data()?.preferredModel || undefined;
      const aiProvider = getAIProvider(preferredModel);
      const summaryResult = await aiProvider.summarizeInspiration({
        title: data.title || '',
        sharedText: data.sharedText,
        userNote: data.userNote,
        url: data.url,
        previewDescription,
      });

      // 3. Save embedding in server-only collection
      await saveIndexRecord({
        ownerUid: uid,
        inspirationId,
        inspirationPath: afterSnap.ref.path,
        contentHash: data.duplicateOf || '',
        embeddingModel: summaryResult.model,
        embeddingVersion: 1,
        embedding: summaryResult.embedding,
        updatedAt: Date.now(),
      });

      // 4. Record cost
      await recordUsageEvent({
        uid,
        operation: 'indexing',
        provider: summaryResult.model.includes('gemini') ? 'google' : 'mock',
        model: summaryResult.model,
        inputTokens: summaryResult.inputTokens,
        outputTokens: summaryResult.outputTokens,
        estimatedCostMicros: summaryResult.estimatedCostMicros,
        status: 'success',
      });

      // 5. Update user-visible document
      await afterSnap.ref.update({
        aiSummary: summaryResult.aiSummary,
        aiTags: summaryResult.aiTags,
        concepts: summaryResult.concepts,
        previewDescription,
        remotePreviewImageUrl,
        canonicalUrl,
        processingStatus: 'ready',
        processingErrorCode: null,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error(`[Indexing] Error processing ${inspirationId}:`, err);
      await afterSnap.ref.update({
        processingStatus: 'failed',
        processingErrorCode: 'INDEXING_FAILED',
        updatedAt: Date.now(),
      });
    }
  }
);

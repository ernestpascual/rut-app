"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onInspirationWritten = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const factory_1 = require("../ai/factory");
const retrieval_1 = require("../ai/retrieval");
const fetcher_1 = require("../metadata/fetcher");
const ledger_1 = require("../cost/ledger");
exports.onInspirationWritten = (0, firestore_1.onDocumentWritten)('users/{uid}/inspirations/{inspirationId}', async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) {
        // Document deleted - cleanup index
        const { uid, inspirationId } = event.params;
        try {
            await config_1.db.collection('_aiInspirationIndex').doc(`${uid}_${inspirationId}`).delete();
        }
        catch (err) {
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
    if (await (0, config_1.isAiKillSwitchActive)()) {
        console.warn('[Indexing] AI Kill Switch is active. Marking failed.');
        await afterSnap.ref.update({
            processingStatus: 'failed',
            processingErrorCode: 'AI_DISABLED',
            updatedAt: Date.now(),
        });
        return;
    }
    // Check cost guardrails
    if (!(await (0, ledger_1.checkCostGuardrails)(uid))) {
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
            const meta = await (0, fetcher_1.fetchPublicMetadata)(data.url);
            previewDescription = meta.description;
            remotePreviewImageUrl = meta.remotePreviewImageUrl;
            canonicalUrl = meta.canonicalUrl;
        }
        // 2. Call AI provider for summary, tags, and embedding
        const userDoc = await config_1.db.collection('users').doc(uid).get();
        const preferredModel = userDoc.data()?.preferredModel || undefined;
        const aiProvider = (0, factory_1.getAIProvider)(preferredModel);
        const summaryResult = await aiProvider.summarizeInspiration({
            title: data.title || '',
            sharedText: data.sharedText,
            userNote: data.userNote,
            url: data.url,
            previewDescription,
        });
        // 3. Save embedding in server-only collection
        await (0, retrieval_1.saveIndexRecord)({
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
        await (0, ledger_1.recordUsageEvent)({
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
    }
    catch (err) {
        console.error(`[Indexing] Error processing ${inspirationId}:`, err);
        await afterSnap.ref.update({
            processingStatus: 'failed',
            processingErrorCode: 'INDEXING_FAILED',
            updatedAt: Date.now(),
        });
    }
});
//# sourceMappingURL=onInspirationCreated.js.map
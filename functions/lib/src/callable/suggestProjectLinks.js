"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestProjectLinks = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const factory_1 = require("../ai/factory");
const ledger_1 = require("../cost/ledger");
exports.suggestProjectLinks = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = request.auth.uid;
    const projectId = request.data?.projectId;
    if (!projectId) {
        throw new https_1.HttpsError('invalid-argument', 'Project ID is required.');
    }
    if (await (0, config_1.isAiKillSwitchActive)()) {
        throw new https_1.HttpsError('unavailable', 'AI matching is temporarily disabled.');
    }
    if (!(await (0, ledger_1.checkCostGuardrails)(uid))) {
        throw new https_1.HttpsError('resource-exhausted', 'Daily AI cost limit reached.');
    }
    try {
        const projSnap = await config_1.db.collection('users').doc(uid).collection('projects').doc(projectId).get();
        if (!projSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Project not found.');
        }
        const projData = projSnap.data() || {};
        // Fetch existing linked inspiration IDs to exclude
        const linksSnap = await config_1.db
            .collection('users')
            .doc(uid)
            .collection('projects')
            .doc(projectId)
            .collection('inspirationLinks')
            .get();
        const existingLinkedIds = new Set(linksSnap.docs.map((d) => d.id));
        // Fetch candidate inspirations
        const inspirationsSnap = await config_1.db
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
        const aiProvider = (0, factory_1.getAIProvider)(requestedModel);
        const result = await aiProvider.suggestProjectLinks({
            projectTitle: projData.title || '',
            projectBrief: projData.brief,
            projectNotes: projData.notes,
            inspirations: candidates,
        });
        await (0, ledger_1.recordUsageEvent)({
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
    }
    catch (err) {
        console.error(`[Project Link Suggestion] Error for ${uid}:`, err);
        throw new https_1.HttpsError('internal', err.message || 'Could not suggest project links.');
    }
});
//# sourceMappingURL=suggestProjectLinks.js.map
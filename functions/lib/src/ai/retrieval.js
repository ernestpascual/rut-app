"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosineSimilarity = cosineSimilarity;
exports.saveIndexRecord = saveIndexRecord;
exports.deleteIndexRecord = deleteIndexRecord;
exports.searchOwnerIndex = searchOwnerIndex;
const config_1 = require("../config");
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length)
        return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
/**
 * Stores embedding in server-only _aiInspirationIndex.
 * Never accessible to client.
 */
async function saveIndexRecord(record) {
    const indexDocId = `${record.ownerUid}_${record.inspirationId}`;
    await config_1.db.collection('_aiInspirationIndex').doc(indexDocId).set(record);
}
/**
 * Deletes index record when inspiration is deleted.
 */
async function deleteIndexRecord(ownerUid, inspirationId) {
    const indexDocId = `${ownerUid}_${inspirationId}`;
    await config_1.db.collection('_aiInspirationIndex').doc(indexDocId).delete();
}
/**
 * Performs owner-isolated semantic retrieval.
 * Returns only inspiration IDs and similarity score. Never returns raw embeddings.
 */
async function searchOwnerIndex(ownerUid, queryEmbedding, limit = 10, minSimilarity = 0.38) {
    // Query only records belonging to the authenticated user
    const snapshot = await config_1.db
        .collection('_aiInspirationIndex')
        .where('ownerUid', '==', ownerUid)
        .get();
    const scored = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.embedding && data.inspirationId) {
            const sim = cosineSimilarity(queryEmbedding, data.embedding);
            if (sim >= minSimilarity) {
                scored.push({
                    inspirationId: data.inspirationId,
                    similarity: sim,
                });
            }
        }
    });
    // Sort descending by similarity
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}
//# sourceMappingURL=retrieval.js.map
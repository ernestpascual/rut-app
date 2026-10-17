import { db } from '../config';

export interface IndexRecord {
  ownerUid: string;
  inspirationId: string;
  inspirationPath: string;
  contentHash: string;
  embeddingModel: string;
  embeddingVersion: number;
  embedding: number[];
  updatedAt: number;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
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
export async function saveIndexRecord(record: IndexRecord): Promise<void> {
  const indexDocId = `${record.ownerUid}_${record.inspirationId}`;
  await db.collection('_aiInspirationIndex').doc(indexDocId).set(record);
}

/**
 * Deletes index record when inspiration is deleted.
 */
export async function deleteIndexRecord(ownerUid: string, inspirationId: string): Promise<void> {
  const indexDocId = `${ownerUid}_${inspirationId}`;
  await db.collection('_aiInspirationIndex').doc(indexDocId).delete();
}

/**
 * Performs owner-isolated semantic retrieval.
 * Returns only inspiration IDs and similarity score. Never returns raw embeddings.
 */
export async function searchOwnerIndex(
  ownerUid: string,
  queryEmbedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.38
): Promise<Array<{ inspirationId: string; similarity: number }>> {
  // Query only records belonging to the authenticated user
  const snapshot = await db
    .collection('_aiInspirationIndex')
    .where('ownerUid', '==', ownerUid)
    .get();

  const scored: Array<{ inspirationId: string; similarity: number }> = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as IndexRecord;
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

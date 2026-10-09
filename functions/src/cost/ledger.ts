import * as admin from 'firebase-admin';
import { db } from '../config';
import { PRICING_VERSION } from './pricing';

export interface UsageRecordParams {
  uid: string;
  operation: 'indexing' | 'chat' | 'search' | 'project_link';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  chars?: number;
  estimatedCostMicros: number;
  status: 'success' | 'failed';
  retryCount?: number;
}

// Guardrails
const MAX_DAILY_COST_MICROS = 2000000; // $2.00 / day per user max
const MAX_DAILY_REQUESTS = 500;

export async function checkCostGuardrails(uid: string): Promise<boolean> {
  try {
    const todayDoc = await db.collection('users').doc(uid).collection('usageSummaries').doc('today').get();
    if (todayDoc.exists) {
      const data = todayDoc.data();
      if (data) {
        if ((data.totalCostMicros || 0) > MAX_DAILY_COST_MICROS) {
          return false;
        }
        const totalRequests = (data.totalIndexed || 0) + (data.totalChatRequests || 0) + (data.totalSearches || 0);
        if (totalRequests > MAX_DAILY_REQUESTS) {
          return false;
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }
  return true;
}

export async function recordUsageEvent(params: UsageRecordParams): Promise<void> {
  const now = Date.now();
  const dateObj = new Date(now);
  const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

  try {
    const batch = db.batch();

    // 1. Insert detailed event (WITHOUT raw prompt or secrets)
    const eventRef = db.collection('users').doc(params.uid).collection('usageEvents').doc();
    batch.set(eventRef, {
      ownerUid: params.uid,
      operation: params.operation,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      chars: params.chars || 0,
      estimatedCostMicros: params.estimatedCostMicros,
      status: params.status,
      retryCount: params.retryCount || 0,
      pricingVersion: PRICING_VERSION,
      timestamp: now,
    });

    // 2. Update today summary
    const todayRef = db.collection('users').doc(params.uid).collection('usageSummaries').doc('today');
    batch.set(
      todayRef,
      {
        totalCostMicros: admin.firestore.FieldValue.increment(params.estimatedCostMicros),
        totalIndexed: admin.firestore.FieldValue.increment(params.operation === 'indexing' ? 1 : 0),
        totalChatRequests: admin.firestore.FieldValue.increment(params.operation === 'chat' ? 1 : 0),
        totalEmbeddings: admin.firestore.FieldValue.increment(params.operation === 'search' ? 1 : 0),
        lastUpdated: now,
      },
      { merge: true }
    );

    // 3. Update monthly summary
    const monthRef = db.collection('users').doc(params.uid).collection('usageSummaries').doc(monthKey);
    batch.set(
      monthRef,
      {
        totalCostMicros: admin.firestore.FieldValue.increment(params.estimatedCostMicros),
        totalIndexed: admin.firestore.FieldValue.increment(params.operation === 'indexing' ? 1 : 0),
        totalChatRequests: admin.firestore.FieldValue.increment(params.operation === 'chat' ? 1 : 0),
        totalEmbeddings: admin.firestore.FieldValue.increment(params.operation === 'search' ? 1 : 0),
        lastUpdated: now,
      },
      { merge: true }
    );

    await batch.commit();
  } catch (err) {
    console.error(`[Cost Ledger] Failed to record usage for user ${params.uid}:`, err);
  }
}

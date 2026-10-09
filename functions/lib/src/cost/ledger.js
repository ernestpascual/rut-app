"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCostGuardrails = checkCostGuardrails;
exports.recordUsageEvent = recordUsageEvent;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const pricing_1 = require("./pricing");
// Guardrails
const MAX_DAILY_COST_MICROS = 2000000; // $2.00 / day per user max
const MAX_DAILY_REQUESTS = 500;
async function checkCostGuardrails(uid) {
    try {
        const todayDoc = await config_1.db.collection('users').doc(uid).collection('usageSummaries').doc('today').get();
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
    }
    catch {
        // Non-blocking fallback
    }
    return true;
}
async function recordUsageEvent(params) {
    const now = Date.now();
    const dateObj = new Date(now);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    try {
        const batch = config_1.db.batch();
        // 1. Insert detailed event (WITHOUT raw prompt or secrets)
        const eventRef = config_1.db.collection('users').doc(params.uid).collection('usageEvents').doc();
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
            pricingVersion: pricing_1.PRICING_VERSION,
            timestamp: now,
        });
        // 2. Update today summary
        const todayRef = config_1.db.collection('users').doc(params.uid).collection('usageSummaries').doc('today');
        batch.set(todayRef, {
            totalCostMicros: admin.firestore.FieldValue.increment(params.estimatedCostMicros),
            totalIndexed: admin.firestore.FieldValue.increment(params.operation === 'indexing' ? 1 : 0),
            totalChatRequests: admin.firestore.FieldValue.increment(params.operation === 'chat' ? 1 : 0),
            totalEmbeddings: admin.firestore.FieldValue.increment(params.operation === 'search' ? 1 : 0),
            lastUpdated: now,
        }, { merge: true });
        // 3. Update monthly summary
        const monthRef = config_1.db.collection('users').doc(params.uid).collection('usageSummaries').doc(monthKey);
        batch.set(monthRef, {
            totalCostMicros: admin.firestore.FieldValue.increment(params.estimatedCostMicros),
            totalIndexed: admin.firestore.FieldValue.increment(params.operation === 'indexing' ? 1 : 0),
            totalChatRequests: admin.firestore.FieldValue.increment(params.operation === 'chat' ? 1 : 0),
            totalEmbeddings: admin.firestore.FieldValue.increment(params.operation === 'search' ? 1 : 0),
            lastUpdated: now,
        }, { merge: true });
        await batch.commit();
    }
    catch (err) {
        console.error(`[Cost Ledger] Failed to record usage for user ${params.uid}:`, err);
    }
}
//# sourceMappingURL=ledger.js.map
# `rut` Cost Safety & Guardrails Guide

This document specifies the cost safety architecture, pricing calculations, automated spending guardrails, and operational configuration procedures for `rut`.

---

## 1. Core Principles

1. **Deterministic Micros Accounting**: All costs are calculated and recorded using 64-bit integer micros (`1 USD = 1,000,000 micros`), eliminating floating-point rounding discrepancies.
2. **Pre-Execution Guardrails**: Every billable AI operation (indexing, chat, retrieval, project matching) executes a server-side guardrail check *before* calling the Gemini API.
3. **Zero Secret Leakage in Audit Trails**: Usage events record token counts, character lengths, and micro-costs, but **never** log raw prompts, user notes, or credentials.
4. **Instant Global Kill-Switch**: A single Firestore boolean instantly disengages all AI features across iOS, Android, Web, and the Chrome Extension without redeploying code.

---

## 2. Integer Micros Pricing Table

Defined in [`functions/src/cost/pricing.ts`](file:///Users/ernest.pascual/Downloads/Development/rut/functions/src/cost/pricing.ts):

| Model / Service | Input (per 1k tokens) | Output (per 1k tokens) | Embedding (per 1k chars) | Equivalent USD Cost |
|---|---|---|---|---|
| **`gemini-3.5-flash-lite`** | 38 µs | 150 µs | 0 µs | $0.038 / 1M in • $0.150 / 1M out |
| **`gemini-3.6-flash`** (Default) | 75 µs | 300 µs | 0 µs | $0.075 / 1M in • $0.300 / 1M out |
| **`gemini-3.8-flash`** | 75 µs | 300 µs | 0 µs | $0.075 / 1M in • $0.300 / 1M out |
| **`gemini-4`** | 75 µs | 300 µs | 0 µs | $0.075 / 1M in • $0.300 / 1M out |
| **`text-embedding-004`** | 0 µs | 0 µs | 25 µs | $0.025 / 1M characters |
| **`mock-model`** (Test) | 10 µs | 20 µs | 5 µs | Dev testing baseline |

### Calculation Formula
```typescript
const inputCost = Math.round((inputTokens / 1000) * rates.inputPer1kTokensMicros);
const outputCost = Math.round((outputTokens / 1000) * rates.outputPer1kTokensMicros);
const embedCost = Math.round((chars / 1000) * rates.embeddingPer1kCharsMicros);

const totalCostMicros = inputCost + outputCost + embedCost;
```

---

## 3. Automated Guardrails

### A. Per-User Daily Budget Cap
Defined in [`functions/src/cost/ledger.ts`](file:///Users/ernest.pascual/Downloads/Development/rut/functions/src/cost/ledger.ts):

```typescript
const MAX_DAILY_COST_MICROS = 2000000; // $2.00 / day per user max
const MAX_DAILY_REQUESTS = 500;        // 500 requests / day per user max
```

- **How it works**:
  Before any Gemini call runs, `checkCostGuardrails(uid)` queries the user's daily summary document: `users/{uid}/usageSummaries/today`.
- **Enforcement**:
  - If `totalCostMicros > 2,000,000` ($2.00) OR `totalRequests > 500`:
    - The operation is blocked.
    - Status is marked: `processingErrorCode: 'DAILY_LIMIT_REACHED'`.
    - Returns error code `DAILY_LIMIT_REACHED` to the client.

### B. Sliding Context Window & Output Token Bounds
- **Chat History Sliding Window**: Chat prompts only carry the last 6 messages and top 5 reference items. This prevents conversation token lengths from ballooning linearly.
- **Max Output Tokens**: Capped at 1,000 tokens on model generation config.

### C. Content Hash Deduplication
- Each item computes `contentHash` based on the title, note, and URL.
- If you edit tags or folder structure, re-indexing is automatically bypassed, saving $0.00 in unnecessary embeddings.

### D. Model Allowlist Enforcement
Defined in [`functions/src/config.ts`](file:///Users/ernest.pascual/Downloads/Development/rut/functions/src/config.ts):
- Only approved cost-efficient models are permitted:
  - `gemini-3.5-flash-lite`
  - `gemini-3.6-flash`
  - `gemini-3.8-flash`
  - `gemini-4`
- Any request requesting an unauthorized or expensive model throws an error before hitting the provider.

---

## 4. How to Configure & Adjust Guardrails

### 1. How to Adjust Daily Spending Limits
To adjust the user spending cap, update [`functions/src/cost/ledger.ts`](file:///Users/ernest.pascual/Downloads/Development/rut/functions/src/cost/ledger.ts#L18-L21):

```typescript
// To change to $5.00 / day and 1,000 requests:
const MAX_DAILY_COST_MICROS = 5000000; // 5,000,000 micros = $5.00
const MAX_DAILY_REQUESTS = 1000;
```
Then deploy functions:
```bash
npx -y firebase-tools@latest deploy --only functions
```

---

### 2. How to Trigger the Global Emergency AI Kill-Switch

If unexpected provider traffic or anomalous usage occurs, you can immediately freeze all AI calls without deploying code or shutting down the app.

#### Via Firebase Console:
1. Open the [Firebase Console](https://console.firebase.google.com/project/izepak/firestore).
2. Go to **Cloud Firestore**.
3. Create or navigate to collection: `_systemConfig`.
4. Open or create document: `global`.
5. Set field:
   ```json
   {
     "killSwitchEnabled": true
   }
   ```
6. **Result**: Within 100ms, all Cloud Functions will reject AI indexing, search, and chat, returning `AI_DISABLED` and halting cost accumulation.

#### To Re-enable:
Change `"killSwitchEnabled": false`.

---

### 3. How to Change the Default Gemini Model
In Firebase Functions configuration or environment variables:
```bash
# Example: Default to Gemini 3.5 Flash Lite for maximum cost savings
firebase functions:secrets:set GEMINI_MODEL="gemini-3.5-flash-lite"
```
Or set `process.env.GEMINI_MODEL = "gemini-3.5-flash-lite"` in your server environment.

---

### 4. How to Setup Google Cloud Billing Budget Alerts

To receive email and SMS alerts before unexpected spending occurs:

1. Go to the [Google Cloud Billing Console](https://console.cloud.google.com/billing).
2. Select your billing account linked to the Firebase project (`izepak`).
3. Click **Budgets & alerts** → **Create budget**.
4. Configure target amounts:
   - **Budget Name**: `rut-monthly-safety-cap`
   - **Target Amount**: `$10.00` (or your preferred ceiling)
   - **Threshold Rules**:
     - 50% of budget ($5.00) → Email alert
     - 80% of budget ($8.00) → Email alert
     - 100% of budget ($10.00) → High-priority email alert
5. Click **Finish**.

---

## 5. Ledger Data Structure (Auditability)

Every AI interaction writes to Firestore under the user's isolated subcollections:

### Transaction Log: `users/{uid}/usageEvents/{eventId}`
```json
{
  "ownerUid": "user_xyz",
  "operation": "indexing",
  "provider": "google",
  "model": "gemini-3.6-flash",
  "inputTokens": 348,
  "outputTokens": 82,
  "chars": 1240,
  "estimatedCostMicros": 81,
  "status": "success",
  "pricingVersion": "2026-09-01",
  "timestamp": 1729000000000
}
```

### Daily Summary: `users/{uid}/usageSummaries/today`
```json
{
  "totalCostMicros": 1620,
  "totalIndexed": 20,
  "totalChatRequests": 0,
  "totalEmbeddings": 0,
  "lastUpdated": 1729000000000
}
```
*(Automatically rolled over and accumulated into monthly summaries `users/{uid}/usageSummaries/YYYY-MM`)*

---

## 6. Related Documentation
- **[COST_ESTIMATE_20261018_010900.md](COST_ESTIMATE_20261018_010900.md)**: Unit economics, per-user monthly estimates, and fleet scale projections.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: High-level system architecture and integer micros accounting pillar.
- **[GOOGLE_USAGE.md](GOOGLE_USAGE.md)**: Google AI and Firebase service utilization guide.


# Cost Audit: rut AI-Indexed Inspiration Bank

## 1. Executive Summary

`rut` is designed with strict cost-efficiency principles:
- **No Firebase Storage**: Zero storage bucket bandwidth or GB-month storage charges.
- **Server-Only Indexing**: Vectors are stored in protected collection `_aiInspirationIndex` and never transferred to clients.
- **Integer Micros Accounting**: All usage calculations are tracked in integer micros (`1 USD = 1,000,000 micros`) on the backend to eliminate floating-point billing discrepancy.
- **Hard Daily Guardrails**: Maximum estimated cost per user per day is capped at 2,000,000 micros ($2.00) with a 500-request limit.
- **Central Kill Switch**: A global document `_systemConfig/global` can disengage all AI invocations instantly if anomalous provider traffic occurs.

---

## 2. Infrastructure Services Used

| Service | Role | Free Tier / Pricing Basis |
|---|---|---|
| **Firebase Authentication** | Email/Password user auth | Free (unlimited users on Spark/Blaze) |
| **Cloud Firestore** | Document persistence & security rules | 50K reads/day, 20K writes/day free; $0.06 / 100K reads thereafter |
| **Firebase Cloud Functions (2nd Gen)** | Privileged AI, metadata fetch & RAG | 2M invocations/mo free; $0.40 / 1M invocations |
| **Firebase Hosting** | PWA & web bundle static delivery | 10 GB storage free, 360 MB/day data transfer |
| **Google Gemini API** | Embeddings & LLM synthesis | `gemini-1.5-flash`: $0.075 / 1M input tokens, $0.30 / 1M output tokens; `text-embedding-004`: $0.025 / 1M chars |
| **Firebase Storage** | **NONE** | **NOT PROVISIONED ($0.00)** |

---

## 3. Operational Flows & Firestore Read/Write Budgets

### A. New Inspiration Ingestion (Manual or Shared)
1. Client writes document to `users/{uid}/inspirations/{id}` with `processingStatus: 'pending'` (1 write).
2. Cloud Function trigger `onInspirationWritten` fires (1 invocation).
3. SSRF-protected metadata fetcher downloads max 256KB from target website (0 Firebase calls).
4. AI Provider generates summary, tags, and embedding vector.
5. Index document written to `_aiInspirationIndex/{uid}_{id}` (1 write).
6. User inspiration document updated to `processingStatus: 'ready'` (1 write).
7. Usage event logged to `users/{uid}/usageEvents` and summaries updated (2 writes).
- **Total per saved item**: ~5 Firestore writes, 0 storage charges.

### B. Train of Thought (Chat Turn)
1. User writes message to `users/{uid}/chats/{chatId}/messages/{msgId}` (1 write).
2. Callable `chatWithBank` invoked (1 invocation).
3. Reads session doc (1 read).
4. Reads pinned items (N reads, bounded at max 10).
5. Vector retrieval queries `_aiInspirationIndex` matching `ownerUid` (M reads, capped at user's total index count).
6. Reads candidate inspiration documents for context (max 5 reads).
7. Reads recent chat window (max 6 reads).
8. Gemini generates answer citing exact inspiration IDs.
9. Writes assistant message (1 write).
10. Writes usage event & updates summary (2 writes).
- **Total per chat turn**: ~15–25 Firestore reads, 4 writes.

### C. Project Inspiration Link Matching
1. Callable `suggestProjectLinks` invoked (1 invocation).
2. Reads project document (1 read).
3. Reads unlinked inspirations (max 30 reads).
4. AI evaluates relevance and returns confidence scores.
5. Writes usage event (2 writes).
- **Total per project match run**: ~31 reads, 2 writes.

---

## 4. AI Cost Formulas in Integer Micros

### Token Pricing Table (`PRICING_VERSION = "2026-09-01"`)

```text
Input Cost Micros  = Math.round((inputTokens / 1000) * 75)
Output Cost Micros = Math.round((outputTokens / 1000) * 300)
Embed Cost Micros  = Math.round((characters / 1000) * 25)
Total Cost Micros  = Input Cost + Output Cost + Embed Cost
```

Example Calculations:
- **Indexing a saved article** (1,200 chars, 350 input tokens, 80 output tokens):
  - Input: `(350 / 1000) * 75` = 26 micros ($0.000026)
  - Output: `(80 / 1000) * 300` = 24 micros ($0.000024)
  - Embed: `(1200 / 1000) * 25` = 30 micros ($0.000030)
  - **Total**: **80 micros ($0.00008)**
- **Chat Turn** (1,500 prompt tokens with 5 inspirations in context, 250 output tokens):
  - Input: `(1500 / 1000) * 75` = 113 micros
  - Output: `(250 / 1000) * 300` = 75 micros
  - **Total**: **188 micros ($0.000188)**

---

## 5. Usage Scenarios

| Tier | Monthly Ingested Items | Monthly Chat Turns | Project Matches | Monthly Firestore Cost | Monthly AI Cost | Total Monthly Cost / User |
|---|---|---|---|---|---|---|
| **Low (Casual)** | 25 items | 15 chats | 2 runs | $0.00 (within free tier) | $0.005 | **< $0.01** |
| **Medium (Active Creator)** | 300 items | 120 chats | 10 runs | $0.00 (within free tier) | $0.047 | **~ $0.05** |
| **High (Power Researcher)** | 2,500 items | 800 chats | 50 runs | $0.22 | $0.35 | **~ $0.57** |

---

## 6. Cost Hot Spots & Existing Controls

1. **Hot Spot: Unlimited re-embedding of edited items**
   - *Control*: Content hashing with `contentHash`. If title/notes/URL hash has not changed, re-embedding is skipped.
2. **Hot Spot: Runaway chat context length**
   - *Control*: Context is bounded to a sliding window of the last 6 messages, maximum 10 pinned items, and top 5 vector matches.
3. **Hot Spot: High-frequency semantic search queries**
   - *Control*: Client search supports debounce and manual toggle (`AI ON` / `AI OFF`).
4. **Hot Spot: Malicious prompt injection attempting to trigger large completions**
   - *Control*: Max output tokens configured at 1,000 on generation config.

---

## 7. Budget Alerts & Kill-Switch Procedures

### Recommended Cloud Budgets
1. **Google Cloud Budget Alert**: Set at $10.00/month with 50%, 80%, and 100% threshold notifications to the admin email.
2. **Firebase Budget Alert**: Linked to the billing account.

### Global AI Kill-Switch Procedure
To immediately stop all billable AI calls across the entire infrastructure without redeploying code:
1. Open Cloud Firestore in Firebase Console.
2. Navigate to collection `_systemConfig`, document `global`.
3. Set boolean field: `killSwitchEnabled: true`.
4. All callable endpoints and triggers will immediately halt AI provider calls, return `AI_DISABLED` errors to clients, and prevent further cost accumulation.

To reactivate: set `killSwitchEnabled: false`.

---

## 8. Related Documentation
- For current per-user unit economics and scaling projections, see **[COST_ESTIMATE_20261018_010900.md](COST_ESTIMATE_20261018_010900.md)**.
- For operational procedures on configuring guardrails and daily quotas, see **[COST_SAFETY_GUARDRAILS.md](COST_SAFETY_GUARDRAILS.md)**.


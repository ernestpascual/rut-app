# `rut` AI Cost Analysis & Pricing Breakdown

This document provides a comprehensive cost breakdown for all AI and cloud functions in `rut`, including token consumption formulas, per-action costs, monthly usage profiles, and built-in budget guardrails.

---

## 1. Executive Summary

- **Extremely Low Cost**: Powered by **Google Gemini 2.5 Flash** and **text-embedding-004**, running `rut` costs fractions of a cent per user action.
- **Indexing 1,000 saved inspirations**: Costs approximately **$0.08 (8 cents)**.
- **500 interactive chat brainstorm turns**: Costs approximately **$0.10 (10 cents)**.
- **Average Active User**: Costs **under $0.10 / month**.
- **No Storage Costs**: `rut` does not provision a Firebase Cloud Storage bucket; media uses remote URL previews, saving GB-month bandwidth and storage fees.

---

## 2. Pricing Reference Rates (Google Gemini API & Firebase)

| Service / Resource | Rate Basis | Cost (USD) | Cost in Integer Micros (`1 USD = 1,000,000 µs`) |
|---|---|---|---|
| **Gemini 2.5 Flash (Input)** | Per 1,000,000 tokens | $0.075 / 1M | 75 µs per 1,000 tokens |
| **Gemini 2.5 Flash (Output)** | Per 1,000,000 tokens | $0.300 / 1M | 300 µs per 1,000 tokens |
| **Gemini 2.5 Flash-Lite (Input)** | Per 1,000,000 tokens | $0.0375 / 1M | 38 µs per 1,000 tokens |
| **Gemini 2.5 Flash-Lite (Output)**| Per 1,000,000 tokens | $0.150 / 1M | 150 µs per 1,000 tokens |
| **Gemini 2.5 Pro (Input)** | Per 1,000,000 tokens | $1.250 / 1M | 1,250 µs per 1,000 tokens |
| **Gemini 2.5 Pro (Output)** | Per 1,000,000 tokens | $5.000 / 1M | 5,000 µs per 1,000 tokens |
| **text-embedding-004** | Per 1,000,000 characters | $0.025 / 1M | 25 µs per 1,000 characters |
| **Cloud Firestore Reads** | Free tier: 50,000 / day | $0.06 / 100K reads | 0.6 µs per read |
| **Cloud Firestore Writes**| Free tier: 20,000 / day | $0.18 / 100K writes | 1.8 µs per write |
| **Cloud Functions (2nd Gen)**| Free tier: 2M calls / mo | $0.40 / 1M calls | 0.4 µs per call |
| **Firebase Storage** | Not Provisioned | **$0.00** | **0 µs** |

---

## 3. Cost Per AI Function

### Function 1: `onInspirationWritten` (AI Ingestion & Indexing)
- **When it runs**: Automatically triggered when you dump/save a link, text, image, or Instagram reel (via Web, Mobile Share, or Chrome Extension).
- **What it does**:
  1. Scrapes OpenGraph webpage metadata (if raw URL).
  2. Calls Gemini Flash to generate `aiSummary` (1–2 sentences), up to 5 `aiTags`, and 4 design `concepts`.
  3. Calls `text-embedding-004` to generate semantic vector embedding.
  4. Stores vector in server-only collection `_aiInspirationIndex`.
- **Token / Resource Usage per Item**:
  - LLM Input: ~350 tokens (title, notes, captured description, system prompt)
  - LLM Output: ~80 tokens (JSON payload with summary, tags, and concepts)
  - Embedding: ~1,200 characters
- **Cost Calculation**:
  - LLM Input: `(350 / 1,000,000) * $0.075` = $0.00002625 (26 µs)
  - LLM Output: `(80 / 1,000,000) * $0.300` = $0.00002400 (24 µs)
  - Embedding: `(1,200 / 1,000,000) * $0.025` = $0.00003000 (30 µs)
  - **Total Cost per Inspiration**: **$0.00008025 USD (~0.008 cents / item)**
- **Scale Reference**:
  - 100 items saved = **$0.008** (under 1 cent)
  - 1,000 items saved = **$0.08** (8 cents)
  - 10,000 items saved = **$0.80** (80 cents)

---

### Function 2: `chatWithBank` (Train of Thought / AI Brainstorm)
- **When it runs**: Each time you send a chat message inside an idea or standalone Train of Thought session.
- **What it does**:
  1. Gathers active prompt, recent sliding window (last 6 messages), and pinned inspirations.
  2. Gathers relevant items from your Dump bank as grounding context.
  3. Performs Google Search Grounding if `🌐 Live Web Search` is toggled on.
  4. Streams synthesized, structured design critique and citations.
- **Token / Resource Usage per Turn (Gemini 2.5 Flash)**:
  - LLM Input: ~1,200 – 1,800 tokens (system instructions + context + chat history)
  - LLM Output: ~250 – 400 tokens
- **Cost Calculation (Flash)**:
  - LLM Input: `(1,500 / 1,000,000) * $0.075` = $0.0001125 (113 µs)
  - LLM Output: `(300 / 1,000,000) * $0.300` = $0.0000900 (90 µs)
  - **Total Cost per Chat Turn**: **$0.0002025 USD (~0.02 cents / message)**
- **Scale Reference**:
  - 100 chat messages = **$0.02** (2 cents)
  - 500 chat messages = **$0.10** (10 cents)
  - 2,500 chat messages = **$0.50** (50 cents)
- *Note on Model Variants*:
  - **Flash-Lite**: ~$0.00010 USD / turn (~50% cheaper)
  - **Pro**: ~$0.0025 USD / turn (recommended only for deep strategic synthesis)

---

### Function 3: `suggestProjectLinks` (Idea Reference Matcher)
- **When it runs**: When reviewing an Idea brief or auto-matching inspirations to your ideas.
- **What it does**: Compares the idea's core themes against unlinked items in your dump.
- **Token Usage**: ~800 input tokens, ~100 output tokens.
- **Cost per Match Run**: **~$0.00009 USD (< 0.01 cents)**.

---

### Function 4: `captureMetadata` (OpenGraph Scraper)
- **When it runs**: When capturing links from Safari/Chrome share sheets.
- **Cost**: **$0.00 AI tokens**. Only standard HTTP fetch and Cloud Function execution (well within Firebase's 2,000,000 free invocations/month).

---

## 4. User Monthly Cost Scenarios

| User Profile | Monthly Activity | Cloud Firestore Cost | Google Gemini AI Cost | Total Estimated Cost / Month |
|---|---|---|---|---|
| **Casual User** | • 50 items dumped<br>• 30 chat messages<br>• 2 idea match runs | $0.00 *(Within Free Tier)* | $0.010 USD | **$0.01 / mo** |
| **Active Creator** | • 300 items dumped<br>• 150 chat messages<br>• 10 idea match runs | $0.00 *(Within Free Tier)* | $0.055 USD | **$0.06 / mo** |
| **Heavy Researcher** | • 1,500 items dumped<br>• 600 chat messages<br>• 30 idea match runs | $0.05 USD | $0.245 USD | **~$0.30 / mo** |
| **Power Agency User** | • 5,000 items dumped<br>• 2,000 chat messages<br>• 100 idea match runs | $0.35 USD | $0.810 USD | **~$1.16 / mo** |

---

## 5. Built-in Cost Protection & Safety Controls

To guarantee that costs never spiral out of control, `rut` has several hardcoded safety mechanisms:

1. **Daily User Spending Guardrail**:
   - Every user has a daily budget cap enforced in [`functions/src/cost/ledger.ts`](file:///Users/ernest.pascual/Downloads/Development/rut/functions/src/cost/ledger.ts).
   - Maximum daily cost is capped at **2,000,000 micros ($2.00 / day)** and **500 requests / day**. If reached, further indexing and chat queries are paused until midnight UTC.
2. **Integer Micros Accounting**:
   - All token usage is calculated in integer micros on the backend to avoid floating-point billing discrepancies.
3. **Sliding Context Window**:
   - Chat context is strictly bounded to the last 6 messages and max 5 reference items. This prevents conversation tokens from growing linearly and ballooning costs.
4. **Content Hashing (`contentHash`)**:
   - Editing an existing item does not re-trigger AI embedding if the title, note, and URL content hash has not changed.
5. **Instant Emergency Kill-Switch**:
   - A global flag in Firestore (`_systemConfig/global.killSwitchEnabled = true`) immediately cuts off all AI invocations across all devices without needing to redeploy code.

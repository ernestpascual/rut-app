# Google Products & AI Architecture in `rut`

This document details how `rut` leverages Google Cloud Platform, Firebase, and Google AI (Gemini) services across its multi-platform ecosystem (iOS, Android, Web, and Chrome Extension).

---

## 1. Architectural Overview

`rut` is built as an AI-powered creative knowledge repository and visual thinking workspace. It uses a serverless, event-driven architecture where client apps dump creative content, and Google Cloud services autonomously analyze, index, embed, and synthesize that data in real time.

```
┌────────────────────────────────────────────────────────────────────────┐
│                            CLIENT SURFACES                             │
│   • iOS & Android (Expo / React Native)                                │
│   • Web Application (Vite / React)                                     │
│   • Chrome Extension (Manifest V3 Service Worker)                      │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
      1. Direct Document Writes              2. Authenticated Callable Calls
         (Real-time Sync)                        (Search, Chat, Linking)
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Google Cloud Firestore         │  │   Cloud Functions for        │
│   • users/{uid}/inspirations         │  │   Firebase (2nd Gen)         │
│   • users/{uid}/projects             │  │   (Google Cloud Run)         │
│   • users/{uid}/chats                │  │   • semanticSearch           │
│   • Server-only collections          │  │   • chatWithBank             │
│     (_aiInspirationIndex,            │  │   • suggestProjectLinks      │
│      _aiUsageLedger, _systemConfig)  │  │   • captureMetadata          │
└───────────────────┬──────────────────┘  └──────────────┬───────────────┘
                    │                                    │
                    │ 3. onDocumentWritten Trigger       │
                    ▼                                    │
┌──────────────────────────────────────┐                 │
│   Background Ingestion Pipeline      │                 │
│   (functions: onInspirationWritten)  │                 │
└───────────────────┬──────────────────┘                 │
                    │                                    │
                    ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE AI / GEMINI SUITE                        │
│                                                                        │
│   • Gemini Flash Models (3.5 Flash Lite, 3.6 Flash, 3.8 Flash, 4)      │
│     - Automatic Summaries, Smart Tagging, Concept Extraction           │
│     - Grounded Multi-Turn Creative Brainstorming                       │
│     - Structured Project Linking (JSON Schema output)                  │
│                                                                        │
│   • Google Text Embeddings (text-embedding-004)                        │
│     - 768-dimensional dense vector embeddings for RAG                  │
│                                                                        │
│   • Google Search Grounding (tools: [{ googleSearch: {} }])            │
│     - Real-time internet search citations and factual grounding        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Google AI & Generative Language Services

All AI operations in `rut` run server-side via the `@google/generative-ai` SDK (`^0.24.1`) inside Google Cloud Functions, ensuring client apps never hold API keys or sensitive models.

### 2.1 Gemini Models & LLM Inference
`rut` dynamically selects, normalizes, and validates Google Gemini models based on task requirements and user preferences:

| Model ID | Primary Role | Highlights |
|---|---|---|
| **`gemini-3.5-flash-lite`** | **Default Ingestion & Tagging** | Ultra-low latency, minimal token cost ($0.0375/1M input tokens), ideal for background indexing. |
| **`gemini-3.6-flash`** | **Creative Brainstorming & Synthesis** | High reasoning capability with fast turnarounds for Chat with Bank and concept extraction. |
| **`gemini-3.8-flash`** | **Advanced Linking & Complex Queries** | Deeper structural understanding for project-asset matching. |
| **`gemini-4`** | **High-Fidelity Reasoning** | Available for complex architectural or creative design queries. |
| **`gemini-2.0-flash`** | **Automatic Resiliency Fallback** | Used as an automatic fallback if an experimental model ID fails during runtime. |

### 2.2 Google Text Embeddings (`text-embedding-004`)
- **Dimensions**: Dense 768-dimensional vectors.
- **Workflow**:
  1. Content strings (`TITLE`, `USER NOTE`, `SHARED TEXT`, `PAGE PREVIEW`) are sanitized and embedded via `genAI.getGenerativeModel({ model: 'text-embedding-004' }).embedContent()`.
  2. Embeddings are stored in the server-only `_aiInspirationIndex` collection.
  3. Vectors are queried via cosine similarity in `semanticSearch` to enable natural-language searching across the user's visual and text dumps.

### 2.3 Google Search Grounding (`googleSearch`)
- **Integration**: Enabled in `chatWithBank` when `webAccess: true`.
- **Mechanism**: Configured via Gemini SDK tools:
  ```typescript
  modelOptions.tools = [{ googleSearch: {} }];
  ```
- **Outcome**: The model queries Google Search in real-time to augment private bank inspirations with fresh internet context. Citations and source URLs from `groundingMetadata.groundingChunks` are returned and rendered as interactive reference links in the UI.

### 2.4 Structured Outputs (JSON Schema Mode)
- **Application**: Ingestion pipeline (`summarizeInspiration`) and project linker (`suggestProjectLinks`).
- **Configuration**: `generationConfig: { responseMimeType: 'application/json' }`.
- **Guarantees**: Predictable, type-safe responses parsed directly into domain types (`aiSummary`, `aiTags`, `concepts`, `suggestions`) without flaky regex parsing.

---

## 3. Core AI Workflows & Features

### 3.1 Background Auto-Enrichment (`onInspirationWritten`)
- **Trigger**: Any write to `users/{uid}/inspirations/{id}` with `processingStatus: 'pending'`.
- **Pipeline**:
  1. **OpenGraph & Metadata Fetching**: Extracts canonical URL, description, and thumbnail image.
  2. **Gemini Ingestion Call**: Analyzes the text and metadata to produce an executive 1–2 sentence summary, up to 5 auto-tags (`aiTags`), and 4 design concepts (`concepts`).
  3. **Vector Generation**: Generates a 768-dim embedding with `text-embedding-004`.
  4. **Indexing**: Saves vector to `_aiInspirationIndex/{uid}_{id}`.
  5. **Cost Accounting**: Logs token counts and micro-dollar costs to `_aiUsageLedger`.
  6. **Status Update**: Transitions document status to `processingStatus: 'ready'`.

### 3.2 "Chat with Bank" (Private RAG Brainstorming)
- **Endpoint**: `chatWithBank` (HTTPS Callable).
- **Retrieval-Augmented Generation (RAG)**:
  - Retrieves pinned inspirations and semantically matching bank items.
  - Combines conversation history into an alternating multi-turn prompt.
  - Injects inspiration snippets into system instructions with strict citation tags (`[ID: id]`).
  - Optionally activates Google Search grounding for live web precedent lookups.

### 3.3 Semantic Search (`semanticSearch`)
- **Endpoint**: `semanticSearch` (HTTPS Callable).
- **Execution**: Converts user's search query into an embedding vector, performs vector similarity matching against `_aiInspirationIndex`, and returns sorted inspiration items with match confidence scores.

### 3.4 AI Project Linker (`suggestProjectLinks`)
- **Endpoint**: `suggestProjectLinks` (HTTPS Callable).
- **Execution**: Evaluates a project's brief and creative notes against candidates in the user's dump. Returns ranked suggestions with confidence ratings and reasoning.

---

## 4. Firebase & Google Cloud Infrastructure

| Google / Firebase Product | Role in `rut` | Implementation Details |
|---|---|---|
| **Cloud Firestore** | Primary NoSQL Database | Stores user inspirations, collections, projects, and chat sessions. Multi-tenant document architecture (`users/{uid}/...`). |
| **Cloud Functions (2nd Gen)** | Serverless Compute Engine | Powered by **Google Cloud Run** running on Node 20. Houses all AI pipelines, callable APIs, and background triggers. |
| **Firebase Authentication** | Identity & Access Management | Cross-platform auth supporting Web, iOS, Android, and Chrome extension handoffs. Generates verified JWT ID tokens. |
| **Firestore Security Rules** | Data Privacy & Authorization | Strictly enforces multi-tenancy (`request.auth.uid == userId`) and completely blocks client access to internal AI indices. |
| **Google Secret Manager** | Sensitive Key Management | Stores `GEMINI_API_KEY` securely in Cloud Functions environments without exposing keys to clients or repositories. |
| **Firebase Hosting** | Web Production CDN | Edge-cached static hosting for the React web application with single-page app rewrites. |
| **Firebase Emulator Suite** | Offline Local Development | Local emulation of Auth (`:9099`), Functions (`:5001`), Firestore (`:8080`), and UI (`:4000`) for cost-free testing. |

---

## 5. Security, Privacy & Cost Guardrails

### 5.1 Zero Client-Side AI Secrets
- `GEMINI_API_KEY` and Google Cloud credentials are never distributed in mobile bundles or web builds.
- All Gemini calls originate from authenticated Google Cloud Run instances.

### 5.2 Server-Side Private Indexing
- The vector collection `_aiInspirationIndex` and the usage log `_aiUsageLedger` are private server collections.
- Client SDKs have no direct read or write permissions to these paths under `firestore.rules`.

### 5.3 AI Cost Accounting & Kill Switches
- **Real-time Cost Ledger**: `functions/src/cost/ledger.ts` records every Gemini invocation, tracking input tokens, output tokens, model name, and micro-dollar costs.
- **Daily Budget Guardrails**: `checkCostGuardrails(uid)` halts AI processing if a user exceeds configured daily thresholds.
- **Global AI Kill Switch**: Instant administrative shutdown via `_systemConfig/global` document (`killSwitchEnabled: true`).
- **Zero Storage Egress Fees**: `rut` relies on remote preview URLs rather than storing duplicate media files in Google Cloud Storage buckets, eliminating bandwidth and GB-month storage charges.

---

## 6. Multi-Platform Integration Matrix

| Platform | Google Technology Utilized | Primary Purpose |
|---|---|---|
| **iOS / Android App** (React Native / Expo) | `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/functions` | Real-time dump browsing, mobile share target ingestion, semantic search, and chat. |
| **Web App** (React / Vite) | Firebase Web SDK, Firebase Hosting, Firestore Realtime Listeners | Full desktop dashboard, Bento grid, canvas thinking, and responsive mobile web. |
| **Chrome Extension** (Manifest V3) | Firebase REST / Firestore direct sync, Auth handoff | 1-click URL and social media dumping with automatic `processingStatus: 'pending'` triggers. |
| **Cloud Functions Backend** | `@google/generative-ai`, `firebase-admin`, `firebase-functions/v2` | Event-driven background AI indexing, vector embeddings, RAG chat, and Google Search grounding. |

---

## 7. Related Documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Overall system architecture and technical pillars.
- **[COST_ESTIMATE_20261018_010900.md](COST_ESTIMATE_20261018_010900.md)**: Detailed resource pricing and per-user cost models.
- **[SECURITY_SCAN_20261017_165100.md](SECURITY_SCAN_20261017_165100.md)**: Security vulnerability scan and Firestore rules assessment.


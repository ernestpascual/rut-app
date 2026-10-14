# rut: Universal Inspiration Bank & Idea Studio

`rut` is a cross-platform (iOS, Android, Web, and Chrome Extension) private creative workspace and inspiration bank. Dump links, snippets, thoughts, and shared social posts from Instagram, Pinterest, TikTok, X, Threads, YouTube, and the web. Organize your dump, draft creative ideas, auto-match saved inspirations as references, and brainstorm in an interactive AI Train of Thought with live internet search grounding.

Live Web App: **[rut.web.app](https://rut.web.app)**

---

## 1. Product Overview

`rut` solves creative fragmentation:

1. **Share From Phone ➔ Dump**: Share from your phone (iOS, Android, or PWA share target) or browser to instantly capture inspiration. Everything starts in the **Dump** inbox.
2. **Instagram Collection Importer (Chrome Extension)**: Connect your Chrome Extension to your Instagram Saved Collections. The extension auto-scrolls the virtualized DOM and syncs Reels, captions, and thumbnails directly to your Insight Bank.
3. **Fast Filter & Search**: Instant client-side search across titles, notes, domains, and auto-generated tags, with multi-platform filtering (`INSTAGRAM`, `PINTEREST`, `TIKTOK`, `X`, `WEB`, etc.).
4. **Idea Studio & Reference Matcher**: Write your creative concept, brief, and specifications. Run **Find Inspirations From Dump** to automatically score and attach relevant references from your bank.
5. **Interactive AI Train of Thought**: Brainstorm directly on any idea or standalone chat. Query your personal dump, toggle live internet search grounding (`🌐 Live Web Search`), switch Gemini models on the fly, and navigate with a clean, uncluttered interface.

---

## 2. Active Features & Capabilities

### 💬 Interactive AI Train of Thought & Brainstorming
- **Decluttered Chat Canvas**: A clean, distraction-free creative workspace with a prominent back button (`← CHATS`) and streamlined input bar.
- **Hamburger Options Menu (`☰`)**:
  - **AI Model Switcher**: Switch on the fly between Google Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash-lite`) with preferences saved across sessions.
  - **Pull & Check From Dump**: Browse saved inspirations, pin them into reasoning context, or ask the AI directly about any item.
  - **Live Web Search Toggle**: One-tap toggle (`🌐 Live Web Search: ON/OFF`) to ground answers in real-time Google search results and contemporary precedents.
  - **Delete Train of Thought**: Safe deletion with an in-app confirmation modal.
- **RAG Over Your Personal Dump**: The AI inference engine anchors your saved inspirations into reasoning context, citing specific references inline with clickable source cards.
- **Formatted Markdown & Sources**: Cross-platform Markdown rendering supporting headers, bullet lists, bold emphasis, code blocks, and source pill links.

### 🧩 Instagram Saved Collection Chrome Extension (`/chrome-extension`)
- **Manifest V3 & CSP Compliant**: Built with Vite and `@crxjs/vite-plugin`, leveraging `firebase/auth/web-extension` to prevent Content Security Policy violations.
- **Virtualized DOM Scraper**: Handles Instagram's DOM recycling by harvesting Reel shortcodes, canonical links, captions, and CDN thumbnails on every scroll tick with randomized jitter (1200ms–1600ms) to avoid rate limits.
- **Deterministic Batch Sync**: Deduplicates and batches writes in chunks of 400 directly to `users/{uid}/inspirations/ig_reel_{shortcode}`.
- **Background AI Auto-Enrichment**: Writes with `processingStatus: 'pending'` to automatically trigger background Cloud Functions for AI auto-tagging, summarization, and vector embeddings.
- **One-Command Distribution**: `npm run zip` packages `rut-extension.zip` for instant sharing with teammates and beta testers.

### 📥 Universal Phone Share ➔ Dump Folder
- **Single Inbox Architecture**: All incoming material begins in the `dump` folder, keeping discovery separate from structured project ideas.
- **Native OS & PWA Share Targets**: Native iOS/Android share sheets and PWA Web Share Target API capture links directly into the database.
- **Quick Dump Input**: Paste links from Pinterest, Instagram, TikTok, X, YouTube, or any website with automatic platform detection, metadata extraction, and canonicalization.

### 🎯 Idea Studio & Reference Attachment
- **Structured Idea Workspace**: Formulate titles, briefs, notes, specifications, and tags.
- **Dump Reference Matcher**: Scans saved inspirations with concept clustering and token affinity, providing transparent match reasoning (*e.g., "94% MATCH — Matches brutalist, typography, poster in dump tags"*).
- **One-Tap Linking**: Attach individual matches, attach all, or manually browse and connect inspirations.
- **Integrated Thought Flow**: View thought trains attached directly to your ideas, with one-tap expansion into the full chat workspace.

### 🎨 Editorial Monochrome Design System
- **High-Contrast Fashion Layout**: Strict adherence to [`DESIGN.md`](DESIGN.md) — 0px sharp corners, pure `#000000` / `#ffffff` contrasts, clean hairlines, and modern typographic hierarchies.
- **Light & Dark Themes**: Instant toggle with persistence in `AsyncStorage`.

### 🛡️ Cost Safety & Guardrails
- **Integer Micros Accounting**: Costs tracked in integer micros (`1 USD = 1,000,000 micros`) on the backend.
- **Daily Budget Cap**: Enforces a strict $2.00 / 500 requests per user per day safety cap.
- **Emergency Kill-Switch**: Central boolean in Firestore halts all AI operations instantly.
- Detailed documentation: [`COST_ANALYSIS.md`](COST_ANALYSIS.md) and [`COST_SAFETY_GUARDRAILS.md`](COST_SAFETY_GUARDRAILS.md).

---

## 3. Architecture & Tech Stack

```
rut/
├── app/                        # Expo Router cross-platform app (iOS, Android, Web)
│   ├── (auth)/                 # Auth flows (Login, Sign-up, Forgot Password)
│   ├── (app)/
│   │   ├── (tabs)/             # Tab navigation: Bank (Dump), Ideas, Chats, Settings
│   │   ├── project/[id].tsx    # Idea Studio & Train of Thought workspace
│   │   ├── chat/[id].tsx       # Full Chat interface with hamburger menu & live web
│   │   └── inspiration/[id].tsx# Inspiration detail & edit view
│   └── share-target.tsx        # Mobile OS & PWA incoming share receiver
├── chrome-extension/           # Standalone Manifest V3 Chrome Extension
│   ├── src/
│   │   ├── background/         # Service worker: MV3 Auth & Firestore batch sync
│   │   ├── content/            # Instagram DOM virtualized scraper
│   │   ├── popup/              # React Popup UI (4 states)
│   │   └── types/              # Mirrored schemas & message contracts
│   └── manifest.json           # Chrome MV3 manifest with externally_connectable
├── functions/                  # Firebase Cloud Functions (Node.js 20, TypeScript)
│   └── src/
│       ├── ai/                 # Gemini API integration & vector embeddings
│       ├── callable/           # captureMetadata, chatWithBank, suggestProjectLinks
│       ├── cost/               # Integer micros ledger, guardrails, pricing tables
│       └── triggers/           # onInspirationWritten (auto AI enrichment)
└── src/
    ├── components/ui/          # Design system components & MarkdownRenderer
    ├── design/                 # Tokens (typography, monochrome palette, spacing)
    ├── features/
    │   ├── auth/               # AuthContext, dummy login fallback, session sync
    │   ├── chat/               # Chat service, model manager, web search grounding
    │   ├── dump/               # Dump CRUD, sorting algorithms, enrichment
    │   └── ideas/              # Concept cluster matcher engine
    ├── lib/firebase/           # Firebase client initialization
    └── utils/                  # URL normalization, domain detection, metadata
```

- **Frontend**: React Native 0.86, Expo SDK 52+, Expo Router v4, React 19.
- **Chrome Extension**: Vite 6, `@crxjs/vite-plugin`, React 19, TypeScript.
- **Backend**: Firebase Cloud Functions v2 (TypeScript), Cloud Firestore.
- **AI & Reasoning**: Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash-lite`, `text-embedding-004`).
- **Hosting**: Firebase Hosting ([rut.web.app](https://rut.web.app)).

---

## 4. Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/ernestpascual/rut-app.git
cd rut

# 2. Install main app dependencies
npm install

# 3. Install Cloud Functions dependencies (optional)
cd functions && npm install && cd ..

# 4. Install Chrome Extension dependencies (optional)
cd chrome-extension && npm install && cd ..
```

### Environment Setup
Copy the sample environment configuration:
```bash
cp .env.example .env.local
```
Add your Firebase and Gemini credentials to `.env.local` (this file is `.gitignore`d and never committed).

---

## 5. Development & Execution

### Safe Expo CLI Execution
> [!IMPORTANT]
> In accordance with [`AGENTS.md`](AGENTS.md), always run Expo commands with `EXPO_NO_DOTENV=1` to prevent automatic `.env.local` loading:

```bash
# Start Expo development server safely
npm run start:safe

# Start Web development server
npm run web:safe
```

### Building & Deploying the Web App
```bash
# Export static web bundle safely
npm run export:web:safe

# Deploy to Firebase Hosting (rut)
npx -y firebase-tools@latest deploy --only hosting:rut
```

### Building & Testing the Chrome Extension
```bash
cd chrome-extension

# Build production unpacked extension
npm run build

# Or package as a zip archive for distribution
npm run zip
```

**Loading the Extension in Google Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the `chrome-extension/dist` folder.
4. Pin the **rut** icon to your Chrome toolbar.
5. Log in and navigate to any Instagram Saved Collection (`instagram.com/{username}/saved/`) to start syncing Reels.

---

## 6. Testing & Quality Assurance

Run all test suites and TypeScript verifications:

```bash
# Run unit tests across services, matching engine, and URL utilities
npm test

# Run TypeScript type check on the main app
npx tsc --noEmit

# Run TypeScript type check on the Chrome Extension
cd chrome-extension && npx tsc --noEmit && cd ..
```

---

## 7. License

MIT License. See [LICENSE](LICENSE) for details.

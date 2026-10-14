# rut: Universal Inspiration Bank & Idea Studio

`rut` is a cross-platform (iOS, Android, Web, and Chrome Extension) private creative workspace and inspiration bank. Dump links, snippets, thoughts, and shared social posts from Instagram, Pinterest, TikTok, X, Threads, YouTube, and the web. Organize your dump, draft creative ideas, auto-match saved inspirations as references, and brainstorm in an interactive AI Train of Thought with live internet grounding and evolving thesis synthesis.

Live Web App: **[rut.web.app](https://rut.web.app)**

---

## 1. Product Overview

`rut` solves creative fragmentation:
1. **Share From Phone ➔ Dump**: Share from your phone (iOS, Android, or PWA share target) or browser to instantly capture inspiration. Everything starts in the **Dump** folder.
2. **Instagram Collection Importer (Chrome Extension)**: Connect your Chrome Extension to your Instagram Saved Collections. The extension auto-scrolls the virtualized DOM and syncs Reels, captions, and thumbnails directly to your Insight Bank.
3. **Sort, Filter & Semantic Search**: Filter by platform (`INSTAGRAM`, `PINTEREST`, `TIKTOK`, `X`, `WEB`, etc.) or sort by date, platform, title, or tag density.
4. **Idea Studio & Concept Matcher**: Write your creative concept, brief, and specifications. Run **Find Inspirations From Dump** to automatically score and attach relevant references from your bank.
5. **Interactive AI Train of Thought**: Brainstorm directly on any idea or chat. Query with RAG over your personal dump, toggle live internet grounding (`🌐 WEB: ON/OFF`), switch Gemini models, and maintain an evolving **1–2 sentence Thesis Statement** dynamically updated on top.

---

## 2. Key Features & Technologies

### 💡 Interactive AI Train of Thought & Brainstorming
- **RAG Over Your Personal Dump**: The AI inference engine anchors your saved inspirations into reasoning context, citing specific references inline with direct links.
- **Live Internet Access Toggle**: One-tap toggle (`🌐 WEB: ON / OFF`) to perform real-time search synthesis, extracting design precedents and contemporary movements alongside personal references.
- **Evolving 1–2 Sentence Thesis Statement**:
  - Maintained persistently at the top of every Idea page and Chat workspace.
  - After each chat turn, the assistant distills your conversation into a sharp 1–2 sentence thesis statement that stays synchronized across views.
  - Tapping any thought bubble in an Idea instantly expands it into the full chat workspace.
- **Multi-Model Switcher**: Switch on the fly between Google Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash-lite`, etc.) with user preferences saved across sessions.
- **Formatted Markdown & Source Citations**: Powered by a custom cross-platform [`MarkdownRenderer`](src/components/ui/MarkdownRenderer.tsx) supporting headings, bullet lists, bold emphasis, inline code, and clickable source pills.

### 🧩 Instagram Saved Collection Chrome Extension (`/chrome-extension`)
- **Manifest V3 & CSP Compliant**: Built with Vite and `@crxjs/vite-plugin`, leveraging `firebase/auth/web-extension` to prevent Content Security Policy violations.
- **Virtualized DOM Scraper**: Handles Instagram's DOM recycling by harvesting Reel shortcodes, canonical links, captions, and CDN thumbnails on every scroll tick with randomized jitter (1200ms–1600ms) to avoid rate limits.
- **Deterministic Batch Sync**: Deduplicates and batches writes in chunks of 400 directly to `users/{uid}/inspirations/ig_reel_{shortcode}`.
- **Auto-Enrichment Trigger**: Writes with `processingStatus: 'pending'` to automatically trigger background Cloud Functions for AI auto-tagging, summarization, and vector embeddings.
- **One-Command Distribution**: `npm run zip` packages `rut-extension.zip` for instant sharing with teammates and beta testers.

### 📥 Universal Phone Share ➔ Dump Folder
- **Single Inbox Architecture**: All incoming material begins in the `dump` folder, keeping discovery separate from structured project ideas.
- **Native OS & PWA Share Targets**: Native iOS/Android share sheets and PWA Web Share Target API capture links directly into the database.
- **Quick Dump Input**: Paste links from Pinterest, Instagram, TikTok, X, YouTube, or any website with automatic platform detection, metadata extraction, and canonicalization.

### 🎯 Idea Studio & Reference Attachment
- **Structured Idea Workspace**: Formulate titles, briefs, notes, specifications, and tags.
- **Dump Reference Matcher**: Scans saved inspirations with concept clustering and token affinity, providing transparent match reasoning (*e.g., "94% MATCH — Matches brutalist, typography, poster in dump tags"*).
- **One-Tap Linking**: Attach individual matches, attach all, or manually browse and connect inspirations.

### 🎨 Editorial Monochrome Design System
- **High-Contrast Fashion Layout**: Strict adherence to [`DESIGN.md`](DESIGN.md) — 0px sharp corners, pure `#000000` / `#ffffff` contrasts, clean hairlines, and modern typographic hierarchies.
- **Light & Dark Themes**: Instant toggle with persistence in `AsyncStorage`.

---

## 3. Architecture & Tech Stack

```
rut/
├── app/                        # Expo Router cross-platform app (iOS, Android, Web)
│   ├── (auth)/                 # Auth flows (Login, Sign-up, Forgot Password)
│   ├── (app)/
│   │   ├── (tabs)/             # Tab navigation: Bank (Dump), Ideas, Chats, Settings
│   │   ├── project/[id].tsx    # Idea Studio & Train of Thought workspace
│   │   ├── chat/[id].tsx       # Full Chat interface with live web & model picker
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
│       ├── callable/           # captureMetadata, semanticSearch, chatWithBank
│       └── triggers/           # onInspirationWritten (auto AI enrichment)
└── src/
    ├── components/ui/          # Design system components & MarkdownRenderer
    ├── design/                 # Tokens (typography, monochrome palette, spacing)
    ├── features/
    │   ├── auth/               # AuthContext, dummy login fallback, session sync
    │   ├── chat/               # Chat service, thesis generator, model manager
    │   ├── dump/               # Dump CRUD, sorting algorithms, enrichment
    │   └── ideas/              # Concept cluster matcher engine
    ├── lib/firebase/           # Firebase client initialization
    └── utils/                  # URL normalization, domain detection, metadata
```

- **Frontend**: React Native 0.86, Expo SDK 52+, Expo Router v4, React 19.
- **Chrome Extension**: Vite 6, `@crxjs/vite-plugin`, React 19, TypeScript.
- **Backend**: Firebase Cloud Functions v2 (TypeScript), Cloud Firestore.
- **AI & Reasoning**: Google Gemini API, custom thesis distillation, client-side concept matcher.
- **Hosting**: Firebase Hosting (`https://rut.web.app`).

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

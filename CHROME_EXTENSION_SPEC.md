# Agentic IDE Spec: Instagram Saved Collection -> Insight Bank Chrome Extension

## Role & Objective
You are an expert Full-Stack TypeScript, Firebase, and Chrome Extension (Manifest V3) engineer. 
Your objective is to build a Chrome Extension inside a dedicated `/chrome-extension` directory within this existing repository. The extension authenticates the user against our existing Firebase project, detects when they are viewing an Instagram Web Saved Collection, scrapes all Reels along with their rich metadata (handling Instagram's virtualized DOM), and syncs them as `url` type items into the user's "Insight Bank" via Firebase Cloud Functions / Firestore.

---

## PHASE 1: Codebase Discovery & Schema Alignment (DO THIS FIRST)
Before writing any code or creating files, search and analyze the existing repository to answer the following questions:

1. **Firebase Configuration & Architecture:**
   - Locate where `firebaseConfig` (API key, `projectId`, `authDomain`, etc.) is initialized.
   - Check if `firebase.json` exists and whether Firebase Cloud Functions (`/functions`) or Next.js/Node backend API routes are used.
2. **Authentication Providers:**
   - Identify how users currently log into the main web app (e.g., Google OAuth, Email/Password, Magic Link).
3. **"Insight Bank" Data Model & Ingestion Pipeline:**
   - Search the codebase for `"Insight Bank"`, `insightBank`, `insights`, or `type: "url"` / `type: 'url'`.
   - Determine the exact Firestore collection path (e.g., `users/{userId}/insightBank/{docId}` or top-level `insights/{docId}`) and the required TypeScript interface/fields for a `url` item.
   - Check if adding a URL in the main web app triggers a Cloud Function, webhook, or server action (e.g., for metadata unfurling, AI tagging, or embeddings) versus a direct Firestore client write.

> **STOP & REPORT:** Output a brief summary of the discovered Firestore paths, TypeScript interfaces, Auth methods, and Cloud Functions before proceeding to Phase 2. Align all field names in Phases 3–5 with the exact schema discovered in the repo.

---

## PHASE 2: Monorepo / Subfolder Scaffolding (`/chrome-extension`)
Create an isolated `/chrome-extension` directory at the root of the repository so its build pipeline and dependencies do not conflict with the main application.

1. **Tech Stack:**
   - **Bundler/Framework:** Vite + `@crxjs/vite-plugin` (or `wxt`) with TypeScript and TailwindCSS.
   - **Firebase SDK:** `firebase` (v10.8+ / v11+), specifically leveraging `firebase/auth/web-extension` to comply with Chrome Manifest V3 Content Security Policy (CSP) rules (no remote code execution).
2. **Directory Structure:**
   ```text
   /chrome-extension
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   ├── manifest.json
   └── src/
       ├── config/
       │   └── firebase.ts          # Reuses env vars from main app
       ├── types/
       │   └── insight.ts           # Mirrors main app's Insight Bank schema
       ├── background/
       │   └── service-worker.ts    # Owns Firebase Auth + Cloud Function/Firestore sync
       ├── content/
       │   └── instagram-scraper.ts # Auto-scrolls & extracts Reel metadata from IG DOM
       └── popup/
           ├── index.html
           ├── main.tsx
           └── Popup.tsx            # Auth UI, Collection detector, & Sync progress UI
   ```
3. **Manifest V3 (`manifest.json`):**
   - Permissions: `["storage", "activeTab", "scripting", "identity"]`
   - Host Permissions: `["*://*.instagram.com/*"]` (plus the main app's domain if using web-session handoff).
   - Configure `externally_connectable` matching the main web app's localhost and production URLs to allow seamless session handoff.

---

## PHASE 3: Chrome Extension Authentication Layer (MV3 + Firebase)

Manifest V3 Service Workers have no DOM (`window` or `document`) and Chrome strictly blocks remote script injection (`signInWithPopup` from standard `firebase/auth` will fail). Implement the following MV3-compliant authentication architecture:

1. **Single Auth Owner in Background Service Worker (`src/background/service-worker.ts`):**
   - Initialize Firebase using `import { getAuth, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, GoogleAuthProvider, signInWithCustomToken } from "firebase/auth/web-extension"`.
   - Register `onAuthStateChanged` synchronously at the top level of the service worker.
   - Whenever auth state changes, write a sanitized user snapshot (`{ uid, email, displayName, photoURL }`) to `chrome.storage.local`.
   - Before making any authenticated call in a message listener, always call `await auth.authStateReady()` so cold service worker boots rehydrate the session from IndexedDB before reading `auth.currentUser`.
2. **Supported Login Flows (Implement in Popup & Background):**
   - **Flow A: Google OAuth via Chrome Identity (`chrome.identity`):**
     - Popup sends `{ type: "AUTH_LOGIN_GOOGLE" }` to Background.
     - Background calls `chrome.identity.getAuthToken({ interactive: true })`, creates a credential via `GoogleAuthProvider.credential(null, accessToken)`, and calls `signInWithCredential(auth, credential)`.
   - **Flow B: Email/Password or Web App Session Handoff:**
     - Provide an Email/Password form in `Popup.tsx` that messages `{ type: "AUTH_LOGIN_EMAIL", email, password }` to Background.
     - *(Bonus)* Add a lightweight bridge or listener via `chrome.runtime.onMessageExternal` so if the user is already logged into our main web app, the web app can pass a custom token or auth state directly to the extension.
3. **Security Boundary:**
   - Never expose raw Firebase ID tokens to the `instagram-scraper.ts` content script. All Firestore writes and Cloud Function invocations must happen inside `service-worker.ts`.

---

## PHASE 4: Instagram Saved Collection Detection & Rich Metadata Scraper

Instagram Web uses a virtualized React DOM—as the user scrolls down a saved collection, top rows unmount from the DOM. The content script (`src/content/instagram-scraper.ts`) must verify the user is inside a Saved Collection and continuously harvest metadata during scrolling.

1. **Collection Route Validation:**
   - Verify `window.location.pathname` matches `/^\/[^/]+\/saved\/([^/]+)\/([^/]+)\/?/` (e.g., `instagram.com/{username}/saved/{collection_slug}/{collection_id}/`) or the general `/saved/all-posts/` view.
   - Extract the **Collection Info**:
     - `collectionSlug` and `collectionId` from the URL path.
     - `collectionTitle` from the collection header DOM element (`main header h1` or breadcrumb text, falling back to `collectionSlug`).
2. **Rich Metadata Extraction (Per Reel):**
   - Maintain a `Map<string, ScrapedReelMetadata>` keyed by the Reel `shortcode` so items are deduplicated and preserved before Instagram unmounts their DOM nodes.
   - On each scroll tick, query all anchor tags matching `a[href*="/reel/"]` inside `<main>` and extract:
     ```typescript
     export interface ScrapedReelMetadata {
       shortcode: string;          // e.g., "C1a2b3c4d5e" parsed from /reel/{shortcode}/
       url: string;                // Canonical URL: "https://www.instagram.com/reel/{shortcode}/"
       type: "url";                // Required by Insight Bank schema
       title?: string;             // Derived from first line of caption/alt text
       caption: string | null;     // Extracted from child <img> alt attribute (IG places caption/author here)
       thumbnailUrl: string | null;// Extracted from child <img> src
       viewCountText: string | null;// Extracted from overlay span text if present in grid
       collection: {
         id: string;
         slug: string;
         name: string;
       };
       source: "instagram_collection";
       scrapedAt: string;          // ISO timestamp
     }
     ```
3. **Auto-Scroll & Rate-Limit Protection Loop:**
   - Scroll incrementally (`window.scrollBy(0, window.innerHeight * 0.85)`) every `1200ms–1600ms` (randomized jitter) to allow network requests and image attributes to hydrate without triggering Instagram rate limits.
   - Emit real-time progress messages (`{ type: "SCRAPE_PROGRESS", count: map.size, collectionName }`) to the Popup UI.
   - Stop when `document.documentElement.scrollHeight` stops growing after 3 consecutive retry checks (waiting `1500ms` per retry to account for slow network fetches) or when the user clicks "Stop & Sync Now" in the Popup.

---

## PHASE 5: Firestore / Cloud Functions Sync Pipeline

Based on what you discovered in **Phase 1**, wire the background service worker to sync the scraped array of `ScrapedReelMetadata` to the user's Insight Bank:

1. **Deduplication & Deterministic IDs:**
   - To ensure re-syncing the same Instagram Collection does not create duplicate items in the user's Insight Bank, generate a deterministic document ID (e.g., `ig_reel_${shortcode}`) OR query existing `url` items for that user before writing.
2. **Sync Execution (Choose the architecture that matches our codebase):**
   - **If the codebase uses Firebase Cloud Functions (`onCall` or HTTPS API):**
     - Create or extend a Callable Cloud Function (e.g., `syncInstagramCollection`) or backend API endpoint that verifies `request.auth.uid`, accepts a batch of scraped Reels, maps them to the exact Insight Bank `url` document schema, commits them using `db.batch()` (chunked in batches of 400 to stay under Firestore's 500-operation limit), and triggers any existing post-processing (unfurling/AI tagging) if applicable.
   - **If the codebase writes directly to Firestore via Client SDK:**
     - Import `getFirestore`, `writeBatch`, `doc`, `serverTimestamp` from `firebase/firestore` inside `service-worker.ts`.
     - Map each `ScrapedReelMetadata` object into the exact Insight Bank document structure discovered in Phase 1 (setting `type: "url"`, `userId: currentUser.uid`, `url: item.url`, plus the nested `metadata` fields) and commit using `writeBatch` in chunks of 400.

---

## PHASE 6: Popup UI States & Verification

Build a clean, responsive Popup UI (`src/popup/Popup.tsx`) with 4 explicit states:

1. **Unauthenticated:** Login form (Google Sign-In button + Email/Password fallback).
2. **Authenticated — Wrong Page:** User is logged in, but the active tab is not an Instagram Saved Collection. Show current user email and a button/instruction to open `instagram.com/{username}/saved/`.
3. **Authenticated — Collection Detected:** Displays the detected Instagram Collection name (e.g., *"Collection: UI Inspiration"*) and a primary **"Sync Reels to Insight Bank"** CTA button.
4. **Syncing / Completed:** Live counter showing *"Found X Reels... Scrolling"* with a *"Stop & Sync Early"* button, transitioning to *"Successfully synced X Reels to Insight Bank"* with a link to open the main app.

# rut — Instagram Saved Collection Chrome Extension

A Manifest V3 Chrome Extension that authenticates against the rut Firebase project, detects when you are viewing an Instagram Saved Collection or Saved Posts, auto-scrolls and harvests Reels with metadata from Instagram's virtualized DOM, and syncs them directly into your rut **Insight Bank**.

---

## Features

- **Manifest V3 Compliant Authentication:**
  - Secure background session rehydration using `firebase/auth/web-extension`.
  - Supports Google OAuth via `chrome.identity` and Email/Password sign-in.
  - Sanitized session state persisted to `chrome.storage.local`.
- **Virtualized DOM Scraper:**
  - Detects collection routes (`/saved/{collection_slug}/{collection_id}/` and `/saved/all-posts/`).
  - Harvests reel shortcodes, canonical URLs, captions, thumbnails, and collection labels before Instagram unmounts rows from memory.
  - Jittered auto-scroll loop (1200ms–1600ms) with automatic retry and rate-limit guardrails.
- **Deterministic Firestore Sync:**
  - Batches writes in chunks of 400 directly to `users/{uid}/inspirations/ig_reel_{shortcode}`.
  - Sets `processingStatus: 'pending'` to automatically activate Cloud Function `onInspirationWritten` for embeddings, vector indexing, and AI summaries.

---

## Development & Installation

### 1. Install Dependencies & Build
```bash
cd chrome-extension
npm install
npm run build
```

This compiles TypeScript, packages the Manifest V3 bundle, and outputs production assets into `chrome-extension/dist/`.

### 2. Load Unpacked in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `chrome-extension/dist` folder.
5. The extension will appear in your Chrome toolbar.

### 3. Usage
1. Click the rut extension icon in your Chrome toolbar.
2. Sign in with your rut account (Google OAuth or Email/Password).
3. Navigate to any Instagram Saved Collection (e.g. `https://www.instagram.com/{your_username}/saved/`).
4. Click **SYNC REELS TO INSIGHT BANK**.
5. Once complete, open your rut web app (`https://rut.web.app/bank`) to explore your newly synced inspirations.

---

## Sharing with Testers (.zip)

To package a standalone `.zip` file for teammates or beta testers:

1. Run:
   ```bash
   cd chrome-extension
   npm run zip
   ```
   This builds the extension and outputs `chrome-extension/rut-extension.zip`.

2. Send `rut-extension.zip` to your testers.

3. **Instructions for Testers:**
   - Download and unzip `rut-extension.zip` into a folder on their computer.
   - Open Google Chrome and go to `chrome://extensions`.
   - Enable **Developer mode** (top-right toggle).
   - Click **Load unpacked** and select the unzipped folder.


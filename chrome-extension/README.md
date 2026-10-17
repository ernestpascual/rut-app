# rut — Browser Extension (v1.0.3)

A Manifest V3 browser extension for `rut` that authenticates against Firebase, enables 1-click URL dumping with automatic duplicate prevention, and syncs saved collections across **Instagram**, **Facebook**, and **Pinterest** directly into your private rut **Insight Bank**.

---

## Features in v1.0.3

- **Manifest V3 Authentication:**
  - Secure background session rehydration using `firebase/auth/web-extension`.
  - Streamlined Email and Password authentication.
  - Session state persisted to `chrome.storage.local`.
  - Displays extension build version `v1.0.3` dynamically in the header and footer.
- **Single Dump Link (Auto-Save Current Website to Dump):**
  - Instantly captures and auto-saves the website you are currently browsing straight into your dump folder.
  - Automatically pre-populates the active tab's URL and page title.
  - Built-in duplicate detection checks existing URLs and shortcodes to prevent redundant saves.
- **Collections Sync (Import All Collections from IG, Pinterest, FB):**
  - Syncs and imports all your saved collections from **Instagram Collection**, **Facebook Collection**, and **Pinterest Collection** directly into your dump folder.
  - Scrapes virtualized DOMs (including Instagram reels, canonical URLs, captions, and thumbnails) before memory unmounts.
  - Batches writes directly to Firestore and queues items for automated AI enrichment (embeddings, vector indexing, and summary tags).

---

## Installing the Latest Build (v1.0.3)

### Method A: Install from Packaged `.zip` (Fastest for Testers)

A ready-to-use distribution package is built at `chrome-extension/rut-extension.zip`.

1. **Unzip the extension:**
   Extract `rut-extension.zip` into a local directory on your computer:
   ```bash
   unzip -q rut-extension.zip -d rut-extension-unpacked
   ```
2. **Open Chrome Extensions:**
   In Google Chrome (or Brave, Edge, Arc), enter `chrome://extensions/` in the address bar.
3. **Turn on Developer Mode:**
   Toggle on **Developer mode** using the switch in the upper-right corner.
4. **Load Unpacked:**
   Click the **Load unpacked** button in the top-left toolbar.
   Select the extracted folder containing `manifest.json`.
5. **Verify Version:**
   The extension card will display **rut — Instagram Saved to Insight Bank** `1.0.3`.
   Pin the extension to your toolbar and open it to verify `v1.0.3` in the header badge.

---

### Method B: Build & Install from Source

If you are developing or compiling from source:

1. **Install dependencies and build:**
   ```bash
   cd chrome-extension
   npm install
   npm run build
   ```
   This compiles TypeScript, bundles React 19 and Vite with `@crxjs/vite-plugin`, and outputs distribution assets to `chrome-extension/dist/`.

2. **Load Unpacked:**
   - Go to `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `chrome-extension/dist` folder.

3. **Packaging a new `.zip` for distribution:**
   ```bash
   npm run zip
   ```
   This builds and archives the latest distribution into `chrome-extension/rut-extension.zip`.

---

## Reloading After Updates

When pulling changes from git or modifying extension code:
1. Rebuild if running from source: `npm run build`
2. Navigate to `chrome://extensions/`.
3. Locate the **rut** extension card and click the **Reload (↻)** icon.

---

## Usage Guide

1. **Sign In**: Click the rut extension icon in your Chrome toolbar. Sign in with your rut account (Email and Password).
2. **Single Dump Link (Auto-Save Current Website)**:
   - When browsing any website, article, or post, click the rut extension icon.
   - The extension auto-detects and pre-populates the current website URL in the **DUMP LINK** tab.
   - Click **DUMP** to auto-save the page straight into your dump folder. If the URL is already present in your dump, the extension informs you and avoids duplicates.
3. **Collections Sync (Import All Collections from IG, Pinterest, FB)**:
   - Go to the **SYNC COLLECTION** tab.
   - Select your target platform: **Instagram Collection**, **Facebook Collection**, or **Pinterest Collection**.
   - Navigate to your saved collection page in the active tab (e.g., `https://www.instagram.com/{your_username}/saved/`).
   - Click **START SYNC** to harvest and import all saved posts and reels directly into your dump folder.
4. **View in Insight Bank**: Open your rut web app at [rut.web.app/bank](https://rut.web.app/bank) to see all your dumped links, imported collections, and auto-generated AI insights.


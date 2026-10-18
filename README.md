# rut: Universal Inspiration Bank & Idea Studio

`rut` is a cross-platform (iOS, Android, Web, and Chrome Extension) private creative workspace and inspiration bank. Capture links, snippets, thoughts, and social posts from Instagram, Pinterest, TikTok, X, Threads, YouTube, and the web. Organize your dump, auto-match saved inspirations to creative briefs, and brainstorm with an interactive AI Train of Thought grounded in your private vault, hands-free Google Live voice mode, and real-time Google search.

Live Web App: **[rut.web.app](https://rut.web.app)** | Submission & Benchmarks: **[submission.md](submission.md)**

---

## Top "By the Numbers" Highlights

| Metric | Measured Value | Significance |
|---|:---:|---|
| **Blended Unit Cost** | **$0.039 / user / mo** | **99.2% Gross Margin** ($4.961 profit on a $5/mo tier) via integer-micros accounting. |
| **In-Memory Vector Search** | **< 25 ms** | Sub-perceptual retrieval across 768-dim embeddings with **$0 external vector DB costs**. |
| **Zero-Binary Storage** | **0 bytes ($0.00)** | Verified remote URL architecture eliminating cloud bucket media storage and egress bills. |
| **Automated Test Suite** | **120 / 120 (100%)** | Zero-defect resilience across **15 test suites** and **0 TypeScript errors** (Web, Mobile, Functions, Extension). |
| **Tri-Surface Ubiquity** | **3 Ecosystems** | Unified across **Web PWA** (`rut.web.app`), **Native Mobile** (iOS & Android share sheets), and **Chrome Extension** (v1.0.3). |
| **Google Live Voice Flow** | **720 ms – 1,180 ms** | Real-time spoken dialogue via direct `gemini-3.5-flash-lite` routing with auto-rearming. |
| **RAG Efficiency** | **~6,590 turns / $1.00** | Full 5-source citation-backed brainstorm turns costing just **$0.000152 (151.7 µs)** each. |
| **Apple TestFlight Delivery** | **App Store #6822694174** | Automated EAS cloud compilation and zero-touch direct distribution to Apple TestFlight. |

---

## Core Features at a Glance

- **Universal Capture & Phone Share**: Ingest links directly from iOS and Android native share sheets, PWA web share targets, or direct URL paste.
- **Chrome Extension (Single Dump Link & Collections Sync — v1.0.3)**:
  - **Single Dump Link**: Auto-captures and saves the website you are currently browsing directly to your dump folder with 1-click dumping and duplicate prevention.
  - **Collections Sync**: Extracts and imports all your saved collections from **Instagram**, **Pinterest**, and **Facebook** directly into your dump folder with automated AI enrichment.
- **Hands-Free Google Live Mode**: Real-time conversational voice brainstorming with continuous speech recognition, low-latency audio response via `gemini-3.5-flash-lite`, waveform waiting animations, and auto-rearming loop.
- **Stream Deck Macro Prompts & 6 Friend Personas**: Collapsible rapid-action deck with 4 creative macros (*Similar Ideas, Angle Shift, Critique, Implementation*) and 6 specialized sparring personas (*Rei - Facts, Tala - Gut Feel, Linh - Realist, Minji - Optimist, Priya - What Ifs, Kamila - Organized*).
- **Interactive AI Train of Thought**: Brainstorm directly against your personal dump. Cites specific inspirations inline with clickable cards, supports on-the-fly Gemini model switching, and toggles real-time Google Search grounding (`🌐 Live Web Search`).
- **Multi-Thought Idea Studio & Stream Switcher**: Connect multiple independent "Train of Thought" brainstorm threads to a single idea with instantaneous tab switching (< 35ms).
- **Contextual Idea Export Suite**: One-click client-side export to Markdown, Semantic HTML for PDF print export, and DOC format including aggregated thought summaries (< 120ms).
- **Idea Studio & Reference Matcher**: Draft briefs and concepts while the AI automatically scores and links relevant references from your dump with transparent match reasoning.
- **Fast Filter & Search**: Instant client-side search across titles, notes, and auto-generated tags with multi-platform filtering (`INSTAGRAM`, `PINTEREST`, `TIKTOK`, `X`, `WEB`).
- **Editorial Monochrome Design**: High-contrast, typography-first aesthetic strictly adhering to [`DESIGN.md`](DESIGN.md) (0px radius vocabulary, pure black & white, flat elevation).
- **Cost Safety & Deterministic Accounting**: Integer micros accounting (`$1 = 1,000,000 µs`), daily user budget caps ($2.00 / 500 requests), and an instant global emergency kill-switch.

---

## Documentation Deep-Dives

Detailed technical guides, architectural specifications, and audits are maintained in the repository:

| Guide | Description |
|---|---|
| **[Pitch Deck & Benchmarks](submission.md)** | Complete submission deck: Problem, USP, Architecture & Sequence diagrams, Cost model, Top 15 Benchmarks. |
| **[Architecture & System Design](docs/ARCHITECTURE.md)** | High-level topology, technical pillars, data flow, and isolation principles. |
| **[Google Cloud, Firebase & Gemini AI](docs/GOOGLE_USAGE.md)** | Full breakdown of Gemini models, `text-embedding-004`, Search Grounding, and Cloud Functions. |
| **[Universal Sharing & Capture Pipeline](docs/SHARING.md)** | iOS Share Extension, Android SEND intents, PWA Share Target, and deduplication logic. |
| **[Cost Estimates & Unit Economics](docs/COST_ESTIMATE_20261018_010900.md)** | Per-action unit costs, user persona monthly estimates, and fleet scaling projections. |
| **[Cost Safety & Guardrails Manual](docs/COST_SAFETY_GUARDRAILS.md)** | Step-by-step procedures for adjusting daily limits, billing alerts, and the central kill-switch. |
| **[Security Audit & Vulnerability Assessment](docs/SECURITY_SCAN_20261017_165100.md)** | Automated dependency scan, Red Team Firestore security rules audit, and SSRF defenses. |
| **[Design System Guidelines](DESIGN.md)** | Editorial typography tokens, monochrome palette, spacing rules, and layout constraints. |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Mobile & Web App** | React Native 0.86, Expo SDK 52+, Expo Router v4, React 19, TypeScript |
| **Chrome Extension** | Manifest V3, Vite 6, `@crxjs/vite-plugin`, React 19 |
| **Backend & Compute** | Firebase Cloud Functions v2 (Node.js 20 on Google Cloud Run) |
| **Database & Auth** | Cloud Firestore, Firebase Authentication |
| **AI & Embeddings** | Google Gemini (`gemini-3.5-flash-lite` default, `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-4`), Google Live 3.5 API, `text-embedding-004` |
| **Distribution & Edge** | Firebase Hosting ([rut.web.app](https://rut.web.app)), Apple TestFlight (`#6822694174`), Android APK |

---

## Quickstart

### 1. Installation
```bash
# Clone repository
git clone https://github.com/ernestpascual/rut-app.git
cd rut

# Install app dependencies
npm install

# Optional: Install Cloud Functions or Extension dependencies
cd functions && npm install && cd ..
cd chrome-extension && npm install && cd ..
```

### 2. Environment Configuration
Copy sample config to `.env.local` (kept strictly in `.gitignore`):
```bash
cp .env.example .env.local
```

### 3. Safe Execution (Expo)
> [!IMPORTANT]
> Always execute Expo CLI commands with `EXPO_NO_DOTENV=1` to ensure environment boundaries are preserved:

```bash
# Start development server safely
npm run start:safe

# Launch Web development server
npm run web:safe
```

### 4. Tests & Type Checks
```bash
# Run client unit test suite (12 suites, 105 tests passing)
npm test

# Run Cloud Functions test suite (3 suites, 15 tests passing)
npm --prefix functions test

# Run TypeScript verification (0 errors across Web, Mobile, Functions)
npx tsc --noEmit
npm --prefix functions run build
```

### 5. Chrome Extension Installation & Capabilities (v1.0.3)

The `rut` browser extension provides two core capture workflows:
- **Single Dump Link (Auto-Save Active Website)**: With one click, auto-saves the website you are currently browsing straight into your dump folder. Pre-populates the active tab URL and title, and automatically checks for duplicates to prevent saving identical links twice.
- **Collections Sync (Instagram, Pinterest, Facebook)**: Select between Instagram Collection, Facebook Collection, or Pinterest Collection to batch-import all saved items from that collection into your dump folder. Features an auto-scrolling virtualized scraper for reels and posts, deterministic Firestore chunking, and instant triggering of AI tagging and embeddings.

#### Quick Install (Pre-Built Package)
The latest pre-compiled build is available at `chrome-extension/rut-extension.zip` (or `chrome-extension/dist/`):

1. **Extract the package**:
   Unzip `chrome-extension/rut-extension.zip` into a folder (e.g. `chrome-extension/rut-extension-unpacked/`) or use the existing `chrome-extension/dist/` folder.
   ```bash
   unzip -q chrome-extension/rut-extension.zip -d chrome-extension/rut-extension-unpacked
   ```
2. **Open Extensions in Chrome**:
   Open Google Chrome (or any Chromium browser like Brave, Edge, or Arc) and navigate to `chrome://extensions/`.
3. **Enable Developer Mode**:
   Toggle on the **Developer mode** switch in the top-right corner of the page.
4. **Load Unpacked Extension**:
   Click the **Load unpacked** button in the top-left toolbar.
   Select the extracted directory (`chrome-extension/rut-extension-unpacked` or `chrome-extension/dist`) containing `manifest.json`.
5. **Verify & Pin**:
   - Pin the **rut** extension to your toolbar for easy access.
   - Click the extension icon: confirm the `v1.0.3` version badge in the header and sign in with your rut account (Email & Password).

#### Building from Source
To build a fresh release from source:
```bash
cd chrome-extension
npm install
npm run build   # Outputs production assets to chrome-extension/dist/
npm run zip     # Re-packages chrome-extension/rut-extension.zip
```
Then load `chrome-extension/dist/` via `chrome://extensions/` as unpacked.

#### Updating & Reloading
When pulling changes or rebuilding:
1. Go to `chrome://extensions/`.
2. Click the **Reload (↻)** icon on the rut extension card to apply the newest build immediately.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

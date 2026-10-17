# rut: Universal Inspiration Bank & Idea Studio

`rut` is a cross-platform (iOS, Android, Web, and Chrome Extension) private creative workspace and inspiration bank. Capture links, snippets, thoughts, and social posts from Instagram, Pinterest, TikTok, X, Threads, YouTube, and the web. Organize your dump, auto-match saved inspirations to creative briefs, and brainstorm with an interactive AI Train of Thought grounded in your private vault and live Google search.

Live Web App: **[rut.web.app](https://rut.web.app)**

---

## Core Features at a Glance

- **Universal Capture & Phone Share**: Ingest links directly from iOS and Android native share sheets, PWA web share targets, or direct URL paste.
- **Instagram Saved Collection Sync**: Chrome extension auto-scrolls virtualized collections, harvesting Reels, captions, and thumbnails into your bank in deterministic batches.
- **Fast Filter & Search**: Instant client-side search across titles, notes, and auto-generated tags with multi-platform filtering (`INSTAGRAM`, `PINTEREST`, `TIKTOK`, `X`, `WEB`).
- **Interactive AI Train of Thought**: Brainstorm directly against your personal dump. Cites specific inspirations inline with clickable cards, supports on-the-fly Gemini model switching, and toggles real-time Google Search grounding (`🌐 Live Web Search`).
- **Idea Studio & Reference Matcher**: Draft briefs and concepts while the AI automatically scores and links relevant references from your dump with transparent match reasoning.
- **Editorial Monochrome Design**: High-contrast, typography-first aesthetic strictly adhering to [`DESIGN.md`](DESIGN.md) (0px radius vocabulary, pure black & white, flat elevation).
- **Cost Safety & Deterministic Accounting**: Integer micros accounting (`$1 = 1,000,000 µs`), daily user budget caps ($2.00 / 500 requests), and an instant global emergency kill-switch.

---

## Documentation Deep-Dives

Detailed technical guides, architectural specifications, and audits are maintained in [`docs/`](docs/):

| Guide | Description |
|---|---|
| **[Architecture & System Design](docs/ARCHITECTURE.md)** | High-level topology, technical pillars, data flow, and isolation principles. |
| **[Google Cloud, Firebase & Gemini AI](docs/GOOGLE_USAGE.md)** | Full breakdown of Gemini models, `text-embedding-004`, Search Grounding, and Cloud Functions. |
| **[Universal Sharing & Capture Pipeline](docs/SHARING.md)** | iOS Share Extension, Android SEND intents, PWA Share Target, and deduplication logic. |
| **[Cost Estimates & Unit Economics](docs/COST_ESTIMATE_20261017_165100.md)** | Per-action unit costs, user persona monthly estimates, and fleet scaling projections. |
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
| **AI & Embeddings** | Google Gemini (`gemini-3.5-flash-lite`, `gemini-3.6-flash`), `text-embedding-004` |
| **Hosting & Edge** | Firebase Hosting ([rut.web.app](https://rut.web.app)) |

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
# Run unit test suite
npm test

# Run TypeScript verification
npx tsc --noEmit
```

### 5. Chrome Extension Build
```bash
cd chrome-extension
npm run build   # Production unpacked build in chrome-extension/dist
npm run zip     # Packaged zip distribution
```
Load the unpacked extension in Chrome via `chrome://extensions/` with Developer Mode enabled.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

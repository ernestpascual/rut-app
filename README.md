# rut: Universal Inspiration Bank & Idea Studio

`rut` is a cross-platform (iOS, Android, Web, and installable PWA) private inspiration bank. Dump links, snippets, thoughts, and shared social posts from Pinterest, Instagram, TikTok, X, Threads, YouTube, and the web. Organize and sort your dump, write creative ideas, and automatically match inspirations from your dump to attach as references.

Built with **Expo 52+**, **Expo Router**, **Cloud Firestore**, and **Firebase Cloud Functions**. Follows the editorial monochrome design system (`DESIGN.md`).

---

## 1. Product Overview

`rut` solves creative fragmentation. When you discover inspiring material on Pinterest, Instagram, TikTok, X, or any website:
1. **Share From Phone ➔ Dump**: When you share from your phone (iOS, Android, or PWA share target), it instantly captures the inspiration. All incoming material goes into a folder called **Dump**. Everything starts there.
2. **Sort & Filter**: In your Dump, sort inspirations by date (newest/oldest), platform source, title (A-Z / Z-A), or tag density.
3. **Write Ideas & Attach References**: In the Idea Studio, write your creative concept, brief, and notes. Hit **Find Inspirations From Dump** to match your saved references from the dump and attach them to the idea.
4. **Test Mode (No Auth Required)**: Instant 1-tap dummy login allows testing all dumping, sorting, and idea reference matching features without setting up Firebase Authentication accounts.

---

## 2. Key Features

### Universal Phone Share ➔ Dump Folder (Everything Starts Here)
- **Folder: Dump**: All inspirations shared from mobile apps or dumped via URL automatically belong to the `dump` folder. This is the primary inbox for all incoming inspiration.
- **Incoming OS Share Target**: Native Android/iOS share target and PWA `share_target` capture incoming links and immediately add them to your Dump folder.
- **Quick Dump Bar**: Paste any Pinterest pin (`pinterest.com`, `pin.it`), Instagram post or reel (`instagram.com`), TikTok, X/Twitter, or web URL directly from the Dump screen with live platform detection.
- **Clean Slate**: Starts with a clean, empty dump ready for your own links and notes (no mock data clutter).

### Real-Time Dump Sorting & Filtering
- **Multi-Criteria Sorting**:
  - `NEWEST`: Most recently dumped items first.
  - `OLDEST`: Chronological discovery order.
  - `PLATFORM`: Grouped/alphabetized by platform (Pinterest, Instagram, TikTok, X, Web).
  - `TITLE A-Z` & `TITLE Z-A`: Alphabetical browsing.
  - `TAGS`: Items with the highest tag and concept density.
- **Platform Pills**: Instant filtering by `ALL`, `PINTEREST`, `INSTAGRAM`, `TIKTOK`, `X`, `THREADS`, `YOUTUBE`, or `WEB`.
- **Search**: Keyword search and semantic search over titles, summaries, user notes, and concepts.

### Idea Studio (Idea ➔ Dump Match ➔ Reference Attachment)
- **Draft Creative Ideas**: Formulate the idea title, concept brief, notes & specifications, and tags.
- **Dump Reference Matcher**:
  - Scans your saved dump inspirations using concept clustering and token affinity.
  - Ranks matches with a confidence score (e.g. `96% MATCH`) and transparent reasoning (*e.g. "Matches ceramic, organic, tableware in dump tags and concepts"*).
- **One-Tap Reference Attachment**:
  - Click `+ ATTACH AS REFERENCE` on individual suggestions or `ATTACH ALL MATCHES`.
  - Attached references feature visual thumbnail cards, platform badges, external source links, and detachable controls.
  - `+ BROWSE DUMP`: Manually browse and attach any unlinked item from your bank.

### Editorial Light & Dark Modes
- **High-Contrast Monochrome**: Strictly conforms to the pure editorial fashion layout philosophy defined in `DESIGN.md`. Zero gradients on interactive chrome, crisp hairlines, and 0px right-angle geometry.
- **Dynamic Theming**:
  - `LIGHT`: Pure white canvas (`#ffffff`), pure black ink (`#000000`), hairline borders.
  - `DARK`: Pure pitch canvas (`#000000`), pure white ink (`#ffffff`), refined hairline borders (`#333333`).
  - `SYSTEM`: Automatically synchronizes with OS device appearance.
- **Fast Access & Persistence**:
  - Quick toggle button right in the top navigation header (`LIGHT` / `DARK`).
  - Dedicated **Appearance** preference controls in Settings (`LIGHT`, `DARK`, `SYSTEM`).
  - Choice is saved in `AsyncStorage` and restored across application reloads.

### Test Mode & Offline Persistence
- **1-Tap Dummy Login**: Click `⚡ ENTER WITH DUMMY LOGIN (TEST)` on the login screen or landing page to enter immediately with zero friction.
- **Local Storage Layer**: All dumped items, ideas, and attached references persist locally via `AsyncStorage` when running in test mode or when offline.
- **Firebase Dual-Mode**: Seamlessly integrates with Cloud Firestore when authenticated with live Firebase credentials.

---

## 3. Technology Stack & Architecture

- **Client**: Expo SDK 52+, React Native 0.76+, Expo Router, React Native Web.
- **Design System**: Editorial monochrome (`#000000` / `#ffffff`), 0px border radius, high-contrast typography following [`DESIGN.md`](DESIGN.md).
- **Local Persistence**: `@react-native-async-storage/async-storage`.
- **Backend**: Firebase Cloud Functions (Node.js 20, TypeScript), Firebase Admin SDK.
- **Database**: Cloud Firestore with user-scoped rules.
- **AI Matching**: Smart client-side matcher (`src/features/ideas/ideaMatcher.ts`) + optional Cloud Function callable (`suggestProjectLinks`).

---

## 4. Repository Structure

```text
app/
  _layout.tsx             # Root layout with AuthProvider & NavigationGuard
  index.tsx               # Editorial landing page with 1-tap test access
  +not-found.tsx          # 404 screen
  +native-intent.ts       # Native deep link & share intent handler
  share-target.tsx        # Incoming share capture UI (native & PWA)
  (auth)/
    login.tsx             # Login screen with 1-tap test dummy access
    sign-up.tsx           # Email registration
    forgot-password.tsx   # Password recovery
  (app)/
    (tabs)/
      _layout.tsx         # Bottom tab navigation (DUMP, CHATS, IDEAS, SETTINGS)
      bank/index.tsx      # Dump folder with Quick Dump & Sorting controls
      projects/index.tsx  # Ideas Studio workspace list
      chats/index.tsx     # Trains of thought list
      settings/index.tsx  # User account & telemetry settings
    inspiration/
      new.tsx             # Manual link / note creation
      [id].tsx            # Detail, edit, and archive view
    project/
      new.tsx             # Write new idea
      [id].tsx            # Idea Studio: write idea, match dump, attach references
    chat/
      new.tsx             # Start new train of thought
      [id].tsx            # Interactive brainstorming chat
src/
  components/ui/          # Button, Input, Card, Badge, TopNav, AnnouncementBar
  design/tokens.ts        # Typography, colors, spacing, and component styles
  features/
    auth/                 # AuthContext with dummy user support & session storage
    capture/              # Staging storage & share hook
    dump/                 # Dump service: storage, quick dumping, sorting
    ideas/                # Idea matcher engine with concept clusters & scoring
  lib/                    # Firebase client initialization & Zod validation
  utils/                  # URL normalization, platform detection (Pinterest, IG, etc.)
functions/
  src/
    ai/                   # Gemini & Mock AI providers
    callable/             # semanticSearch, chatWithBank, suggestProjectLinks
    triggers/             # onInspirationWritten indexing trigger
```

---

## 5. Getting Started

### Prerequisites
- **Node.js**: `v20` or higher
- **npm**: `v10` or higher
- **Expo CLI**: Included with project

### Installation
```bash
# Clone the repository
git clone https://github.com/example/rut.git
cd rut

# Install client dependencies
npm install

# Install functions dependencies (if deploying backend)
cd functions && npm install && cd ..
```

### Running Locally (Safe Execution)
> [!IMPORTANT]
> Adhere to [`AGENTS.md`](AGENTS.md): Never access `.env.local` directly. Always invoke Expo with dotenv disabled:
> ```bash
> npm run start:safe
> npm run web:safe
> ```

To launch the web interface:
```bash
npm run web:safe
```
Open `http://localhost:8081` in your browser. Click **ENTER INSPIRATION BANK (TEST)** to test without entering credentials.

---

## 6. How to Test Core Features

1. **Test Dummy Login**:
   - On the landing page or login screen, click `⚡ ENTER WITH DUMMY LOGIN (TEST)`.
   - You enter the Inspiration Bank immediately with no credentials required.

2. **Test Quick Link Dump**:
   - In the Bank tab, look at the **Quick Dump** bar.
   - Paste a Pinterest link (e.g. `https://www.pinterest.com/pin/123456789/`) or Instagram link (e.g. `https://instagram.com/reel/example/`).
   - Notice the platform badge automatically appears (e.g. `DETECTED: PINTEREST`).
   - Click `DUMP`. The item is saved directly into your bank.

3. **Test Sorting**:
   - Dump a few links with different platforms and titles.
   - Click the sort pills (`NEWEST`, `OLDEST`, `PLATFORM`, `TITLE A-Z`, `TITLE Z-A`, `TAGS`).
   - The inspiration list re-orders in real time.

4. **Test Idea Studio & Reference Attachment**:
   - Navigate to the **IDEAS** tab and click `+ WRITE IDEA`.
   - Enter a title (e.g. *"Scandinavian Ceramic Studio"*), concept brief, and notes.
   - Save and open the idea.
   - Click **⚡ FIND INSPIRATIONS FROM DUMP**.
   - `rut` scans your dumped items, scores relevance, and displays matching references with reasons and confidence ratings.
   - Click `+ ATTACH AS REFERENCE` to link them to the idea, or use `+ BROWSE DUMP` to pick any item manually.

---

## 7. Quality & Validation

Run all unit tests and TypeScript validations:

```bash
# Run unit tests (URL parsing, schemas, idea matcher, dump service)
npm test

# Type-check TypeScript codebase
npx tsc --noEmit
```

---

## 8. License

MIT License. See [LICENSE](LICENSE) for details.

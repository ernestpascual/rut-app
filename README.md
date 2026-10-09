# rut: AI-Indexed Inspiration Bank

`rut` is a cross-platform (iOS, Android, Web, and installable PWA) inspiration bank and private idea dump. Users save links, snippets, thoughts, and shared social posts. AI indexes this material so users can search it semantically, explore different trains of thought through chat, generate new ideas, and connect relevant inspiration to projects.

Built with **Expo**, **Expo Router**, **Cloud Firestore**, and **Firebase Cloud Functions**. Follows the editorial monochrome design system (`DESIGN.md`).

---

## 1. Product Overview
`rut` solves the problem of scattered creative sparks. When you find an inspiring post on Instagram, TikTok, X, Threads, or the web, share it directly to `rut`. The system securely indexes the content, generates summaries, tags, and conceptual themes, and lets you chat with your inspiration bank across isolated trains of thought.

## 2. Feature Overview
- **Universal Capture**: Incoming OS share target for iOS, Android, and PWA, plus manual URL and note entry.
- **AI Semantic Indexing**: Automated enrichment generating summaries, descriptive tags, concepts, and vector embeddings.
- **Isolated Thought Trains (Chats)**: Workspaces where you can pin inspirations, brainstorm concepts, and receive citations linking back to exact inspiration items.
- **Thematic Projects**: Workspaces with briefs, notes, and AI-suggested inspiration links ranked by confidence score.
- **Runtime Cost Audit**: Real-time telemetry displaying token consumption and estimated costs in integer micros ($ USD).
- **Editorial Design System**: Pure black (`#000000`) and pure white (`#ffffff`), `0px` radius on all cards, inputs, and buttons, with a single `24px` announcement pill and `-0.48px` hero typography tracking.

## 3. Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full data flow diagrams.
- **Client**: Expo 57, React Native 0.86, Expo Router, React Native Web.
- **Backend**: Firebase Cloud Functions (Node.js 20, TypeScript), Firebase Admin SDK.
- **Database**: Cloud Firestore with user-scoped security rules and server-only vector collections.
- **AI Engine**: Modular provider abstraction supporting Google Gemini 1.5 Flash and a deterministic offline Mock Provider.

## 4. Repository Structure
```text
app/
  _layout.tsx             # Root layout with AuthProvider & NavigationGuard
  +not-found.tsx          # 404 screen
  +native-intent.ts       # Native deep link & share intent rewrites
  share-target.tsx        # Incoming share capture UI (native & PWA)
  (auth)/                 # Sign in, sign up, forgot password
  (app)/                  # Authenticated screens
    (tabs)/               # Tab navigation: bank, chats, projects, settings
    inspiration/          # Manual creation & detail view
    chat/                 # New train of thought & chat workspace
    project/              # New project & project workspace
src/
  components/ui/          # Button, Input, AnnouncementBar, TopNav, Card, Badge, SourceCard
  design/                 # Tokens matching DESIGN.md
  features/               # AuthContext, capture hooks, staging storage
  lib/                    # Firebase client initialization & Zod validation
  utils/                  # URL normalization, platform detection, content hashing
functions/
  src/
    ai/                   # AI Provider interface, Gemini provider, Mock provider, prompts
    metadata/             # SSRF-protected public metadata fetcher
    cost/                 # Versioned pricing in integer micros & usage ledger
    callable/             # semanticSearch, chatWithBank, suggestProjectLinks, deleteAccountData
    triggers/             # onInspirationWritten indexing trigger
public/
  manifest.json           # Installable PWA manifest with share_target
  sw.js                   # Service worker with app-shell caching
docs/
  COST_AUDIT.md           # Pricing formulas, usage scenarios, kill-switch procedures
  SHARING.md              # Platform share mechanics, staging flow, binary rejection
  ARCHITECTURE.md         # Comprehensive architectural specification
firestore.rules           # Production Firestore security rules
firestore.indexes.json    # Composite and vector index configurations
firebase.json             # Emulator, Hosting, Functions, and Firestore configuration
AGENTS.md                 # Strict environment boundaries protecting .env.local
DESIGN.md                 # Visual design system source of truth
```

## 5. Prerequisites
- **Node.js**: `v20` or higher
- **npm**: `v10` or higher
- **Expo CLI**: Included with project
- **Firebase CLI**: Install globally or run via `npx -y firebase-tools@latest`

## 6. Installation
```bash
# Clone the repository
git clone https://github.com/example/rut.git
cd rut

# Install client dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..
```

## 7. Safe Environment-Variable Workflow
> [!CAUTION]
> **Non-negotiable rule**: Never open, read, print, grep, parse, source, or copy `.env.local`.
> Always disable Expo dotenv loading during development and export:
> ```bash
> EXPO_NO_DOTENV=1 npx expo start
> EXPO_NO_DOTENV=1 npx expo export --platform web
> ```
> Use the preconfigured `cross-env` scripts:
> - `npm run start:safe`
> - `npm run web:safe`
> - `npm run export:web:safe`

## 8. Agent Boundary Protection
All AI coding agents working on this codebase must adhere to `AGENTS.md`. Local `.env` files are ignored in `.gitignore`.

## 9. `.env.example` Field Descriptions
```bash
# Public Firebase client credentials (safe for client bundles)
EXPO_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="rut-app.firebaseapp.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="rut-app"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="rut-app.appspot.com"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
EXPO_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Emulator toggle (1 = enable local emulators, 0 = live)
EXPO_PUBLIC_USE_FIREBASE_EMULATOR="1"
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST="127.0.0.1"
```

## 10. Firebase Project Setup
1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Set active project locally:
   ```bash
   npx firebase-tools use --add
   ```

## 11. Authentication Setup
1. Enable **Email/Password** sign-in under **Authentication > Sign-in method**.
2. No anonymous authentication is used.

## 12. Firestore Setup
1. Create a Cloud Firestore database in **Native mode**.
2. Location: Select a location close to your users (e.g. `us-central1` or `asia-east1`).

## 13. Security-Rule Deployment
```bash
npx firebase-tools deploy --only firestore:rules
```
Ensures complete isolation: users can only read/write their own `users/{uid}` hierarchy. Clients have zero access to `_aiInspirationIndex`.

## 14. Firestore Index Deployment
```bash
npx firebase-tools deploy --only firestore:indexes
```

## 15. Cloud Functions Setup
Functions handle AI synthesis, vector generation, SSRF-protected scraping, and recursive data deletions.
```bash
cd functions
npm run build
cd ..
npx firebase-tools deploy --only functions
```

## 16. AI Secret Configuration
Never put private AI keys in client code! Configure Gemini API key as a Cloud Functions secret:
```bash
npx firebase-tools functions:secrets:set GEMINI_API_KEY
```
If no key is configured, the application runs on the deterministic `MockAIProvider`.

## 17. Emulator Setup
Run local emulators for zero-cost offline testing:
```bash
npx firebase-tools emulators:start
```
Emulators run on:
- Auth: `http://127.0.0.1:9099`
- Firestore: `http://127.0.0.1:8080`
- Functions: `http://127.0.0.1:5001`
- Emulator UI: `http://127.0.0.1:4000`

## 18. Running iOS
```bash
npm run start:safe
# Press 'i' to launch in iOS Simulator
```

## 19. Running Android
```bash
npm run start:safe
# Press 'a' to launch in Android Emulator
```

## 20. Running Web
```bash
npm run web:safe
```

## 21. Creating Expo Development Builds
```bash
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile development --platform android
```

## 22. Testing Incoming Shares
- **Android**: Test via ADB:
  ```bash
  adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "https://instagram.com/p/example" com.rut.app
  ```
- **iOS**: Test deep link scheme:
  ```bash
  xcrun simctl openurl booted "rut://share?url=https://example.com/article&title=Design"
  ```
- **Web**: Navigate to `http://localhost:8081/share-target?url=https://example.com/article&title=Design`.

## 23. PWA Setup and Export
Build the static PWA bundle:
```bash
npm run export:web:safe
```
Exports static assets to `dist/`, including `manifest.json` and `sw.js`.

## 24. Deployment Instructions
Deploy static web & PWA to Firebase Hosting:
```bash
npx firebase-tools deploy --only hosting
```

## 25. Cost-Audit Explanation
See [docs/COST_AUDIT.md](docs/COST_AUDIT.md).
Usage events log input tokens, output tokens, characters, and model pricing in integer micros. The in-app Settings tab renders real-time estimated expenditures.

## 26. No-Storage Limitation
`rut` does not initialize Firebase Storage or permit file uploads. Photos, videos, and PDFs are rejected at the capture boundary. External preview images are stored strictly as URL strings.

## 27. Social-Platform Sharing Limitations
`rut` does not access private accounts or scrape behind paywalls. URLs from Instagram, TikTok, X, and Threads are normalized and indexed from publicly accessible meta tags or user notes.

## 28. Troubleshooting
- **AI not responding**: Check whether `_systemConfig/global` has `killSwitchEnabled: true`. Verify `GEMINI_API_KEY` secret in functions.
- **Port conflicts on emulators**: Ensure ports 9099, 8080, 5001, and 4000 are unallocated.
- **Incoming share lost**: Verify user signed into the same account; check staged storage in Settings.

## 29. Validation Commands
Run complete quality verification with dotenv loading disabled:
```bash
# Unit tests
npm test

# Backend functions tests
cd functions && npm test && npm run build && cd ..

# Client TypeScript check
npm run type-check

# Production Web Export
npm run export:web:safe
```

## 30. Future Roadmap
- Local on-device semantic vector ranking using WebAssembly.
- Offline SQLite sync for reading saved material without connectivity.
- Export inspiration bank as markdown/JSON bundle.

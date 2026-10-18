# Demo Flow: rut

A concise, step-by-step presentation script and screen flow for demonstrating **rut**.

---

## 1. Sharing from Phone to Dump
- **Screen**: Mobile Phone (iOS / Android)
- **Action**:
  1. Open Instagram, TikTok, or browser.
  2. Tap native **Share** → select **rut** (uses native iOS Share Extension / Android SEND intent).
  3. The link silently drops into your private Dump.
  4. Background Gemini worker automatically extracts OpenGraph metadata, writes a 2-sentence summary, tags visual styles, and embeds 768-d vectors.
- **Presenter Cue**: *"Whenever I spot inspiration on mobile, one tap in the native share sheet dumps it into rut. Gemini immediately tags, summarizes, and indexes it behind the scenes."*

---

## 2. Extension: Single Dump
- **Screen**: Desktop Chrome Browser
- **Action**:
  1. Browse to any article, design showcase, or website (e.g. Awwwards or architectural site).
  2. Click the **rut Chrome Extension** icon (`Manifest V3`).
  3. In **Quick Dump** mode, verify auto-detected title, URL, and platform badge.
  4. Tap **SAVE TO DUMP** (includes instant duplicate detection).
- **Presenter Cue**: *"On desktop, the rut extension captures active pages with a single click, preventing duplicates and keeping desktop tabs clean."*

---

## 3. Extension: Collections Dump
- **Screen**: Desktop Chrome Browser (Instagram Saved Posts / Pinterest Board / Facebook Saved)
- **Action**:
  1. Open an Instagram Saved collection (`instagram.com/your-handle/saved/...`).
  2. Click the **rut Extension** icon → switch to **Collection Sync**.
  3. Click **SYNC SAVED COLLECTION**.
  4. Watch the virtualized scraper scroll the DOM, extract all reel links, captions, and thumbnails, and batch-sync them to Firestore.
- **Presenter Cue**: *"Instead of letting hundreds of bookmarks rot in siloed apps, rut's collections scraper virtualizes the DOM and pulls entire saved collections directly into your inspiration bank in seconds."*

---

## 4. Creating a New Thought (Train of Thought AI)
- **Screen**: Web / Mobile App → **Thoughts** tab (`/(app)/(tabs)/thoughts`)
- **Action**:
  1. Tap **+ NEW THOUGHT** to open the interactive brainstorming canvas.
  2. **Pull from Dump**:
     - Tap top-right menu `···` → **Pull & Check From Dump**.
     - Search by tag or keyword (e.g. `brutalist`).
     - Tap **+ PIN CONTEXT** to inject that inspiration into prompt memory.
  3. **Ask from Dump**:
     - On any dump item card, tap **💬 ASK AI ABOUT THIS**.
     - Gemini analyzes that item's specific aesthetic, composition, and principles in relation to your thought.
  4. **Use Macros**:
     - Expand the **MACRO PROMPTS** deck at the bottom.
     - Tap **Occam's Razor** (strips bloat) or **Pareto (80/20)** (identifies high-impact core).
  5. **Use Friends (Personas)**:
     - Expand the **FRIENDS** deck.
     - Switch perspectives: tap **Rei** for objective facts, **Linh** for downside risks, or **Priya** for creative wildcards.
- **Presenter Cue**: *"Thoughts is our multi-turn ideation canvas. We can pull references from our Dump, ask Gemini to dissect them, run thinking macros like Occam's Razor, or spar with specialized friend personas like Rei and Linh."*

---

## 5. Create a New Idea (Idea Studio)
- **Screen**: **Ideas** tab (`/(app)/(tabs)/ideas`) → Tap **+ NEW IDEA** (`/(app)/project/new`)
- **Action**: Fill in the form using this copy-paste mock example:

```text
Title:
Brutalist Coffee Roastery App

Brief (2 Sentences):
A high-contrast, editorial mobile ordering experience featuring stark monochrome typography and zero-radius geometry. It replaces bloated reward sliders with raw bean origins and tactile kinetic interactions for craft brew purists.

Initial Notes (3 Notes):
1. Stark B&W palette with heavy serif editorial headers paired with monospace technical specs.
2. Zero-friction single-origin selector showcasing altitude, roast curves, and farmer provenance.
3. Tactile bag checkout with zero-radius cards, flat hairline borders, and snappy micro-haptics.

Tags (2 Tags):
brutalism, editorial-ui
```

- Tap **CREATE PROJECT**.
- **Presenter Cue**: *"When an idea crystallizes, we graduate it to the Idea Studio with a crisp brief, initial notes, and aesthetic tags."*

---

## 6. Idea Studio: Scan, Browse, Link Chat, & Switch Models
- **Screen**: Idea Detail view (`/(app)/project/[id]`)
- **Action**:
  1. **Scan Dump**:
     - Tap **⚡ SCAN DUMP**.
     - AI runs semantic vector cosine similarity across your saved inspirations and surfaces top matches with confidence scores (e.g. 92%) and rationale.
     - Tap **ATTACH** to link matching references to this idea.
  2. **Browse Dump**:
     - Tap **+ BROWSE DUMP** to manually search and attach unlinked bank items.
  3. **Link Chat & Add a New Chat**:
     - In the Train of Thought section, tap **LINK CHAT** to view and connect an existing conversation.
     - Or tap **+ NEW THOUGHT** to spawn a fresh, dedicated thought stream with all attached references pinned automatically.
  4. **Change Models**:
     - Tap the model pill in the toolbar (`FLASH-LITE ▾` / `FLASH ▾`).
     - Seamlessly toggle between `gemini-3.5-flash-lite` (speed/efficiency), `gemini-3.6-flash`, or `gemini-3.8-flash` (deep synthesis).
- **Presenter Cue**: *"Inside the Idea Studio, rut scans our bank to recommend matching references with transparent reasoning. We can link or spawn dedicated thoughts and switch Gemini models on the fly."*

---

## 7. Export One
- **Screen**: Idea Detail view → Top Nav **EXPORT ▾**
- **Action**:
  1. Tap **EXPORT ▾** in the top navigation bar.
  2. View export choices: **📋 Copy as Markdown**, **📄 Export as PDF**, or **📝 Export as Doc**.
  3. Tap **PRINT / PDF ↗** (or **COPY AS MARKDOWN**).
  4. Show the clean, editorial export containing the brief, specifications, attached dump references, and full thought transcript.
- **Presenter Cue**: *"Finally, with one click, we export the complete idea—brief, specs, attached visual references, and AI thinking transcript—ready for handoff to design or development."*

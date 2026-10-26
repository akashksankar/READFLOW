# ReadFlow — Calm Local-First PDF Reader & Study Desk

ReadFlow is a local-first web application that transforms dense PDFs into a calm, book-grade reading and study experience. Everything runs 100% in your browser via IndexedDB (Dexie) and PDF.js — no accounts, no cloud uploads, and no AI calls.

## Key Capabilities

### 1. Three Reading Modes (`Comfort`, `Paged`, `Original`)
- **Comfort Mode**: Reflows extracted PDF text into a single responsive column with intelligent two-column de-leaving, hyphenated word joining, repeating header/footer removal, and inline figures.
- **Paged Mode**: Paginates chapters using native CSS multi-column layout with 60fps swipe, tap zones (`Normal` or `Wide center`), keyboard arrows, and three page-turn styles (`Slide`, `Fade`, and 3D `Flip`), while preserving your exact character position across font-size changes.
- **Original Mode**: Virtualized PDF canvas view with pinch/double-tap/button zoom (`1x`–`4x`) and an interactive **Add Region** tool to capture custom diagrams.

### 2. Book Typography, Reading Styles & Drop Caps
- **9 Self-Hosted OFL-1.1 Variable Fonts**: `Literata`, `Newsreader`, `Source Serif 4`, `Lora`, `EB Garamond`, `Crimson Pro`, `Playfair Display`, `Lexend`, and `Atkinson Hyperlegible Next` — loaded lazily on demand.
- **7 Named Reading Styles + Custom**: `Classic`, `Manuscript`, `Editorial`, `Study`, `Story`, `Clear`, and `Plain`.
- **Editorial Drop Caps**: `Off`, `Drop cap` (2–4 lines), `Raised`, `Bold first word`, and `Small caps`, with automatic 3:1 WCAG contrast verification against all 5 themes (`Paper & Ink`, `Sepia`, `Forest`, `Midnight`, `OLED Black`).
- **Opening Text Sequence**: Subtle `< 1.2s` title and chapter-opener animation on Page 1 with a 5-minute session cooldown and instant tap/scroll skip.

### 3. Figures Gallery, Inline Figures & Lightbox
- Automatically detects raster images and vector diagrams via `page.getOperatorList()`, filters out small icons, thin rules, full-page watermarks, and repeating logos, and matches `Fig./Table/Chart` captions.
- Browse all extracted figures in the two-column masonry **Figures Sheet** or inspect them in the full-screen **Lightbox** (zoom `1x`–`4x`, pan, download, copy, or save to your Notebook).

### 4. Today Dashboard, Daily Challenges & Personal Routine (`/today`)
- **Accurate Active-Time Tracking**: Counts active reading seconds only when the tab is visible, focused, and interacted with within the last 60 seconds, plus pages read ($\ge 3\text{s}$ dwell) and estimated words.
- **Editorial Visuals**: 240-degree `GoalArc`, 7 vertical swallowtail bookmark `WeekRibbons`, `CurrentlyReading` with pace-based time-left estimate, 12-week `HeatMap`, deterministic date-seeded **Daily Challenges**, and **Personal Routine Tasks** with streaks.

### 5. Rule-Based Flashcards & Swipe Learning (`/cards`)
- **Non-AI Rule-Based Card Maker**: Extracts `Definition`, `Bold term`, `Fact` (`{{blank}}` cloze), `List`, and `Key sentence` candidates from any highlighted passage or chapter heading (unchecked by default so you curate what to keep).
- **8 Theme-Tuned Card Paper Tints**: `Warm Ivory`, `Soft Ochre`, `Terracotta Tint`, `Sage Leaf`, `Slate Blue`, `Dusk Plum`, `Warm Rose`, and `Charcoal`.
- **5-Box Leitner Scheduler & 3-Card Stack Study View**: Swipe right (`Got it`), left (`Again`), up (`Save`), or tap/Space to flip in 3D, with full keyboard and button parity and instant `Undo`.

## Development & Verification

```bash
# Install dependencies
npm install

# Generate deterministic PDF test fixtures in tests/fixtures/
npx tsx scripts/generate-fixtures.ts

# Run WCAG 2.1 AA contrast verification across all themes, highlights, and cards
npx tsx scripts/verify-contrast.ts

# Run unit tests (Vitest)
npx vitest run

# Typecheck and build production bundle
npm run lint
npm run build
```

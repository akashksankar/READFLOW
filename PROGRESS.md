# ReadFlow — Build Progress (Phase 1 + Phase 2)

## Phase 1 Milestones (Completed)
- **Step 0 — Audit & Dependencies**: Audited packages, documented licenses in `DEPENDENCIES.md`, and recorded rule resolutions in `DESIGN_NOTES.md`.
- **Step 1 — Design Tokens & Theme Engine**: Implemented 5 WCAG-verified themes (`Paper & Ink`, `Sepia`, `Forest`, `Midnight`, `OLED Black`), 4 highlight washes (`Saffron`, `Clay`, `Sage`, `Slate`), and 10-step type scale in `src/styles/tokens.css`.
- **Step 2 — Motion Primitives**: Spring presets, duration/easing tokens, Reduced Motion and Lite Mode detection (`src/motion/`).
- **Step 3 — Dexie v1 Database**: Local IndexedDB schema (`documents`, `files`, `pages`, `progress`, `highlights`, `bookmarks`, `settings`).
- **Step 4 — PDF Worker & Extraction Pipeline**: Two-column reading order, hyphenated lowercase word joining, repeating header/footer detection, and page quality scoring (`src/features/extract/`).
- **Step 5 — Library & Import Flow**: SHA-256 deduplication, cover rendering, and honest validation for non-PDF/encrypted/scanned files (`src/features/library/`, `src/features/import/`).
- **Step 6 — Comfort & Original Reader Views**: Virtualized `ComfortView` (`@tanstack/react-virtual`) and on-demand `OriginalView` canvas renderer with pinch/double-tap/button zoom (`src/features/reader/`).
- **Step 7 — Highlights, Notes, Bookmarks & Ambience**: Text anchoring with prefix/suffix fallback, Markdown export, and synthesized Web Audio ambience (`Rain`, `Warm room`, `Fireplace`).

## Phase 2 Milestones (Completed)
- **Phase 2 Step 1 — Fonts, Reading Styles & Drop Caps**:
  - Added 9 self-hosted OFL-1.1 variable fonts (`Literata`, `Newsreader`, `Source Serif 4`, `Lora`, `EB Garamond`, `Crimson Pro`, `Playfair Display`, `Lexend`, `Atkinson Hyperlegible Next`) loaded lazily on selection or specimen preview.
  - Added 7 named Reading Style presets (`Classic`, `Manuscript`, `Editorial`, `Study`, `Story`, `Clear`, `Plain`) plus automatic `Custom` state when any control diverges.
  - Added pure CSS `::first-letter` drop caps (`Off`, `Drop cap` 2–4 lines, `Raised`, `Bold first word`, `Small caps`) on paragraphs $\ge 80$ chars starting a document or following a heading, with automatic 3:1 theme contrast validation.
- **Phase 2 Step 2 — Opening Text Animations**:
  - Built `SplitText` and `OpeningSequence` (< 1.2s total, once per document open with 5-minute session cooldown, skippable on tap/scroll, disabled in Reduced Motion / Lite Mode, waits on `document.fonts.ready`).
- **Phase 2 Step 3 — Figures Gallery, Inline Figures & Lightbox**:
  - Built operator-list raster & vector diagram detector (`detectFigures.ts`), 2x page cropper with 6pt padding into WebP/JPEG (`cropFigure.ts`), watermark deduplication ($\ge 40\%$ pages), caption matching, `FiguresSheet`, `Lightbox`, and `AddRegionOverlay` safety net in Original mode.
- **Phase 2 Step 4 — Page-Flip Reading Mode (`PagedReader`)**:
  - Built native CSS multi-column paginator over a 3-original-page sliding window with `Slide`, `Fade`, and `Flip` (CSS 3D `perspective: 1400px` `rotateY`) turns, configurable tap zones (`Normal` / `Wide center`), and `(pageIndex, blockIndex, charOffset)` anchor preservation across font-size changes.
- **Phase 2 Step 5 & 6 — Session Tracking, Today Dashboard, Daily Challenges & Personal Tasks**:
  - Built `ReadingSessionTracker` (1s active tick when visible, focused, and interacted with within 60s; $\ge 3\text{s}$ page dwell; word estimate `chars / 5`).
  - Built `/today` dashboard (`GoalArc`, 7 vertical swallowtail `WeekRibbons`, `CurrentlyReading` with pace-based time left, 12-week `HeatMap`, `Totals`, deterministic date-seeded `Challenges`, and `Tasks` with streaks).
- **Phase 2 Step 7 — Flashcards: Rule-Based Card Maker, Saved Deck & Swipe Learning**:
  - Built non-AI rule-based card candidate engine (`Definition`, `Bold term`, `Fact` cloze, `List`, `Key sentence`) unchecked by default in `CardMaker`, 8 theme-tuned card colors (`--card-1`..`--card-8`), 5-box Leitner scheduler, `Saved` smart deck, and 60fps 3-card stack `StudyView` with swipe, flip, keyboard shortcuts, and Undo.
- **Phase 2 Step 8 & 9 — Navigation Shell, Tests, Fixtures & Docs**:
  - Built `NavigationShell` (bottom bar on phones, slim left rail on desktop for `Library`, `Today`, `Cards` with due count badge), generated 11 PDF fixtures, and verified all unit tests and WCAG contrast checks.

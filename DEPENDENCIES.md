# ReadFlow — Dependencies & Architecture Record

Checked on 25 Oct 2026 against npm registry (`npm view <pkg> version license`) and `package.json`.

## Pre-existing in Repository
- `react`: `^19.0.1`
- `react-dom`: `^19.0.1`
- `vite`: `^8.3.0`
- `@vitejs/plugin-react`: `^6.1.1`
- `@tailwindcss/vite`: `^4.3.3`
- `tailwindcss`: `^4.3.3`
- `typescript`: `^7.0.2`
- `motion`: `^12.23.24` (imported via `motion/react`, MIT licensed — covers layout, drag, `useTransform`, `Reorder`, springs, and `AnimatePresence`)
- `lucide-react`: `^0.546.0`

## Phase 1 Core & UI Packages
- `pdfjs-dist`: `^6.4.299` — Mozilla PDF.js used directly for text extraction (`getTextContent`), operator list inspection (`getOperatorList` for Figures), and canvas rendering with Vite `?url` worker (`pdfjs-dist/build/pdf.worker.min.mjs?url`) and local `cmaps/` + `standard_fonts/` in `public/`.
- `dexie`: `^4.4.7` — IndexedDB persistence wrapper (Version 1 & Version 2 schema with `db.version(2).stores(...).upgrade(...)`).
- `dexie-react-hooks`: `^4.4.0` — Reactive `useLiveQuery` hooks.
- `@tanstack/react-virtual`: `^3.14.22` — Dynamic-measurement virtualization for Comfort and Original scroll modes.
- `wouter`: `^3.13.0` — Lightweight (~2 KB) router for `/`, `/today`, `/cards`, `/cards/:deckId`, `/cards/:deckId/study`, `/read/:id`, and `/notes/:id`.
- `sonner`: `^2.0.8` — Swipe-dismissible toast system styled strictly with Folio CSS tokens.
- `clsx`: `^2.1.1`, `tailwind-merge`: `^3.7.0`, `class-variance-authority`: `^0.7.1` — Class composition utilities.
- `@radix-ui/react-dialog`: `^1.3.1`, `@radix-ui/react-slider`: `^1.6.1`, `@radix-ui/react-switch`: `^1.4.1`, `@radix-ui/react-toggle-group`: `^1.2.1`, `@radix-ui/react-dropdown-menu`: `^2.2.1`, `@radix-ui/react-tooltip`: `^1.4.1` — Accessible primitives restyled to Folio tokens.

## Self-Hosted OFL-1.1 Variable Fonts (Fontsource)
### Preloaded / First-Load Core Fonts
- `@fontsource-variable/fraunces`: `^5.3.0` (License: `OFL-1.1`) — Brand wordmark, editorial headings, drop caps, and tabular folio numerals.
- `@fontsource-variable/literata`: `^5.3.0` (License: `OFL-1.1`) — Default Classic reading body serif and flashcard face.
- `@fontsource-variable/instrument-sans`: `^5.3.0` (License: `OFL-1.1`) — Interface controls, Study headings, and optional body sans.

### Phase 2 Lazily Loaded Reading & Heading Fonts (Loaded on selection or specimen preview only)
- `@fontsource-variable/source-serif-4`: `^5.3.1` (License: `OFL-1.1`) — Study and technical reading serif.
- `@fontsource-variable/newsreader`: `^5.3.0` (License: `OFL-1.1`) — Editorial reading serif & italic headings.
- `@fontsource-variable/lora`: `^5.3.0` (License: `OFL-1.1`) — Story calligraphic warm serif.
- `@fontsource-variable/eb-garamond`: `^5.3.0` (License: `OFL-1.1`) — Manuscript classical literary serif.
- `@fontsource-variable/crimson-pro`: `^5.3.0` (License: `OFL-1.1`) — Compact bookish serif for small screens.
- `@fontsource-variable/playfair-display`: `^5.3.0` (License: `OFL-1.1`) — High-contrast dramatic headings and openers only.
- `@fontsource-variable/atkinson-hyperlegible-next`: `^5.3.0` (License: `OFL-1.1`) — Maximum letter clarity for Clear accessibility preset (with `@fontsource/atkinson-hyperlegible` fallback).
- `@fontsource-variable/lexend`: `^5.3.0` (License: `OFL-1.1`) — Wide, even spacing reading sans.

## Dev Dependencies for Verification & Fixtures
- `vitest`: `^5.0.5` — Unit testing for Phase 1 & Phase 2 rules.
- `pdf-lib`: `^1.17.1` — Scripted generation of deterministic test PDF fixtures under `tests/fixtures/`.

## Explicitly Excluded (Zero Installed)
- `react-pageflip`, `react-tinder-card`, Chart.js, Recharts, GSAP / SplitText, AutoAnimate, React Transition Group, React Aria, Headless UI, `react-pdf`, Zustand, Redux, `@use-gesture/react`, Howler.js, Tone.js, Lottie, Three.js, any AI SDK, network spaced-repetition package, or analytics package.

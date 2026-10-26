# ReadFlow — Performance & Memory Architecture

## 1. Bundle & Lazy Loading
- **Route-Level Code Splitting**: `ReaderPage`, `NotebookPage`, `TodayPage`, `DeckList`, and `StudyView` are lazy-loaded via `React.lazy` so initial boot only loads the Library shell.
- **On-Demand Variable Fonts**: Only the default UI/display/reading fonts (`Plus Jakarta Sans`, `Fraunces`, `Literata`) load at startup. The remaining 7 reading/heading fonts (`Newsreader`, `Source Serif 4`, `Lora`, `EB Garamond`, `Crimson Pro`, `Playfair Display`, `Lexend`, `Atkinson Hyperlegible Next`) are dynamically imported via `ensureFontLoaded()` only when the user opens the font picker or selects a preset that uses them.

## 2. Reader Virtualization & Memory Discipline
- **Comfort Mode (`ComfortView`)**: Virtualized via `@tanstack/react-virtual` (`overscan: 3`), keeping DOM node count flat regardless of whether the PDF has 10 or 500 pages.
- **Paged Mode (`PagedReader`)**: Uses native CSS multi-column layout (`column-width`, `column-gap`, `column-fill: auto`) over a 3-original-page sliding window (`prev`, `current`, `next`) and translates the column strip via GPU-composited `transform: translate3d(...)`.
- **Original Mode (`OriginalView`)**: Virtualized with `overscan: 1`, capping `devicePixelRatio` at `2`. Unmounted pages immediately cancel active `RenderTask`s, zero canvas dimensions (`canvas.width = 0; canvas.height = 0`), and call `page.cleanup()`.
- **Single PDF Worker**: Reuses one `PDFDocumentProxy` per open reader session and calls `destroy()` on unmount.

## 3. Background Figure Extraction & Storage Hygiene
- **Non-Blocking Operator Scan**: `startOrResumeFigureDetection` runs at low priority after text extraction, yielding to the main thread (`setTimeout(..., 12)`) between pages so frame times stay well under 50ms.
- **Single 2x Page Render per Page with Figures**: Renders a page once at scale 2, crops all candidate bounding boxes with 6pt padding into `fullBlob` ($\le 1200\text{px}$ long edge) and `thumbBlob` ($\sim 360\text{px}$ wide) encoded as WebP (with JPEG fallback), and immediately zeros temporary canvases.
- **Object URL Lifecycle**: `FigureThumbImage` and `Lightbox` create `URL.createObjectURL(blob)` inside `useEffect` and revoke it on unmount (`URL.revokeObjectURL`) to prevent blob URL leaks.
- **Storage Controls**: `Aa -> More -> Storage` displays exact MB used by documents and figure thumbnails and provides a one-click `Clear extracted figures` action.

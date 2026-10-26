import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * Dynamically loads pdfjs-dist and configures the worker only when a PDF is imported or opened.
 * Passes local /cmaps/ and /standard_fonts/ so CJK and non-embedded fonts render without network calls.
 */
export async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const [pdfjs, workerModule] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

export interface LoadPdfOptions {
  data: ArrayBuffer | Uint8Array;
  onProgress?: (loaded: number, total: number) => void;
}

export async function loadPdfDocument({
  data,
  onProgress,
}: LoadPdfOptions): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  });

  if (onProgress) {
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      if (progressData.total > 0) {
        onProgress(progressData.loaded, progressData.total);
      }
    };
  }

  return await loadingTask.promise;
}

export async function destroyPdfDocument(doc: PDFDocumentProxy | null | undefined): Promise<void> {
  if (!doc) return;
  try {
    const d = doc as PDFDocumentProxy & { destroy?: () => Promise<void>; cleanup?: () => Promise<void> };
    if (typeof d.destroy === 'function') {
      await d.destroy();
    } else if (typeof d.cleanup === 'function') {
      await d.cleanup();
    }
  } catch {
    // ignore
  }
}

/**
 * Renders page 1 to an offscreen/detached canvas (~360px wide) and returns a WebP/JPEG Blob for the cover.
 */
export async function renderCoverThumbnail(pdfDoc: PDFDocumentProxy): Promise<Blob | null> {
  let page: PDFPageProxy | null = null;
  try {
    page = await pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 360;
    const scale = targetWidth / Math.max(1, baseViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            canvas.toBlob((fallback) => resolve(fallback), 'image/jpeg', 0.85);
          }
        },
        'image/webp',
        0.85
      );
    });

    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    return blob;
  } catch {
    if (page) {
      try {
        page.cleanup();
      } catch {
        // ignore
      }
    }
    return null;
  }
}

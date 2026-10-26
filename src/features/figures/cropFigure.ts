import { db, type FigureBBox, type FigureRecord } from '../../data/db';
import { getPdfJs, loadPdfDocument, destroyPdfDocument } from '../pdf/pdfClient';
import { extractSinglePdfPage } from '../extract/extractPage';
import { detectPageFigureCandidates } from './detectFigures';

function canvasToBlobWithFallback(
  canvas: HTMLCanvasElement,
  quality = 0.86
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else {
          canvas.toBlob((jpeg) => resolve(jpeg), 'image/jpeg', quality);
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Renders a single PDF page once at scale 2 and crops one or more normalized bounding boxes
 * with 6 points of padding into fullBlob (<=1200px long edge) and thumbBlob (~360px wide).
 */
export async function renderAndCropPageFigures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  candidates: {
    bboxNormalized: FigureBBox;
    kind: 'image' | 'diagram';
    caption: string;
  }[]
): Promise<
  {
    bbox: FigureBBox;
    kind: 'image' | 'diagram';
    caption: string;
    thumbBlob: Blob;
    fullBlob: Blob;
    w: number;
    h: number;
  }[]
> {
  if (candidates.length === 0 || typeof document === 'undefined') return [];

  const baseVp = page.getViewport({ scale: 1 });
  const renderScale = 2;
  const vp = page.getViewport({ scale: renderScale });

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = Math.round(vp.width);
  pageCanvas.height = Math.round(vp.height);
  const pageCtx = pageCanvas.getContext('2d', { alpha: false });
  if (!pageCtx) return [];

  try {
    await page.render({
      canvasContext: pageCtx,
      viewport: vp,
      canvas: pageCanvas,
    }).promise;

    const results: {
      bbox: FigureBBox;
      kind: 'image' | 'diagram';
      caption: string;
      thumbBlob: Blob;
      fullBlob: Blob;
      w: number;
      h: number;
    }[] = [];

    const padPx = 6 * renderScale; // 6 points of padding

    for (const cand of candidates) {
      const srcX = Math.max(0, Math.round(cand.bboxNormalized.x * vp.width - padPx));
      const srcY = Math.max(0, Math.round(cand.bboxNormalized.y * vp.height - padPx));
      const srcRight = Math.min(
        vp.width,
        Math.round((cand.bboxNormalized.x + cand.bboxNormalized.w) * vp.width + padPx)
      );
      const srcBottom = Math.min(
        vp.height,
        Math.round((cand.bboxNormalized.y + cand.bboxNormalized.h) * vp.height + padPx)
      );

      const srcW = Math.max(16, srcRight - srcX);
      const srcH = Math.max(16, srcBottom - srcY);

      // 1. Full crop (capped at 1200px maximum long edge)
      const maxLongEdge = 1200;
      const longEdge = Math.max(srcW, srcH);
      const fullScale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
      const fullW = Math.max(1, Math.round(srcW * fullScale));
      const fullH = Math.max(1, Math.round(srcH * fullScale));

      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = fullW;
      fullCanvas.height = fullH;
      const fullCtx = fullCanvas.getContext('2d', { alpha: false });
      if (!fullCtx) continue;
      fullCtx.drawImage(pageCanvas, srcX, srcY, srcW, srcH, 0, 0, fullW, fullH);
      const fullBlob = await canvasToBlobWithFallback(fullCanvas, 0.88);
      fullCanvas.width = 0;
      fullCanvas.height = 0;

      // 2. Thumbnail crop (~360px wide)
      const thumbTargetW = Math.min(360, fullW);
      const thumbScale = thumbTargetW / Math.max(1, srcW);
      const thumbW = Math.max(1, Math.round(srcW * thumbScale));
      const thumbH = Math.max(1, Math.round(srcH * thumbScale));

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
      if (!thumbCtx) continue;
      thumbCtx.drawImage(pageCanvas, srcX, srcY, srcW, srcH, 0, 0, thumbW, thumbH);
      const thumbBlob = await canvasToBlobWithFallback(thumbCanvas, 0.82);
      thumbCanvas.width = 0;
      thumbCanvas.height = 0;

      if (fullBlob && thumbBlob) {
        results.push({
          bbox: cand.bboxNormalized,
          kind: cand.kind,
          caption: cand.caption,
          thumbBlob,
          fullBlob,
          w: fullW,
          h: fullH,
        });
      }
    }

    return results;
  } finally {
    pageCanvas.width = 0;
    pageCanvas.height = 0;
  }
}

/**
 * Background Figure Detection Coordinator:
 * - Runs at low priority after text extraction, yielding between pages
 * - Tracks repeated image signatures across >=40% of pages (logos/watermarks) and removes them
 * - Updates listeners with (scannedPages, totalPages, figureCount)
 */
interface FigureScanJob {
  docId: string;
  priorityPage: number | null;
  cancelled: boolean;
  listeners: Set<(scanned: number, total: number, found: number) => void>;
}

const activeFigureJobs = new Map<string, FigureScanJob>();

export function subscribeToFigureScanProgress(
  docId: string,
  cb: (scanned: number, total: number, found: number) => void
): () => void {
  const job = activeFigureJobs.get(docId);
  if (!job) return () => {};
  job.listeners.add(cb);
  return () => {
    job.listeners.delete(cb);
  };
}

export function prioritizeFigureScanPage(docId: string, pageIndex: number) {
  const job = activeFigureJobs.get(docId);
  if (job) {
    job.priorityPage = pageIndex;
  }
}

export async function startOrResumeFigureDetection(
  docId: string,
  forceRescan = false
): Promise<void> {
  if (activeFigureJobs.has(docId)) return;

  try {
    const doc = await db.documents.get(docId);
    if (!doc) return;
    if (!forceRescan && doc.figuresStatus === 'done') return;

    if (forceRescan) {
      await db.figures.where('docId').equals(docId).delete();
      await db.documents.update(docId, {
        figuresStatus: 'scanning',
        figuresScannedPages: 0,
        figureCount: 0,
      });
    }

    const fileRec = await db.files.get(docId);
    if (!fileRec) return;

    const job: FigureScanJob = {
      docId,
      priorityPage: null,
      cancelled: false,
      listeners: new Set(),
    };
    activeFigureJobs.set(docId, job);

    const pdfjs = await getPdfJs();
    const buf = await fileRec.blob.arrayBuffer();
    const pdfDoc = await loadPdfDocument({ data: buf });
    const totalPages = pdfDoc.numPages;

    const scannedPages = new Set<number>();
    const signaturePagesMap = new Map<string, { pageIndex: number; figId: string }[]>();
    let totalFound = await db.figures.where('docId').equals(docId).count();

    let nextPage = 0;

    try {
      while (scannedPages.size < totalPages && !job.cancelled) {
        let targetPage: number | null = null;
        if (
          job.priorityPage !== null &&
          job.priorityPage >= 0 &&
          job.priorityPage < totalPages &&
          !scannedPages.has(job.priorityPage)
        ) {
          targetPage = job.priorityPage;
          job.priorityPage = null;
        } else {
          while (nextPage < totalPages && scannedPages.has(nextPage)) {
            nextPage++;
          }
          if (nextPage < totalPages) targetPage = nextPage;
        }

        if (targetPage === null) break;

        // Check if page already has figures stored (when resuming)
        const existingOnPage = await db.figures
          .where('[docId+pageIndex]')
          .equals([docId, targetPage])
          .count();

        if (existingOnPage === 0) {
          const page = await pdfDoc.getPage(targetPage + 1);
          const extracted = await extractSinglePdfPage(page);
          const candidates = await detectPageFigureCandidates(
            page,
            pdfjs.OPS,
            extracted.lines,
            extracted.charCount
          );

          if (candidates.length > 0 && !job.cancelled) {
            const croppedList = await renderAndCropPageFigures(page, candidates);
            const records: FigureRecord[] = croppedList.map((c, idx) => {
              const id = `fig_${docId}_${targetPage}_${idx}`;
              const sig = candidates[idx]?.imageSignature ?? '';
              if (sig) {
                const list = signaturePagesMap.get(sig) ?? [];
                list.push({ pageIndex: targetPage!, figId: id });
                signaturePagesMap.set(sig, list);
              }
              return {
                id,
                docId,
                pageIndex: targetPage!,
                bbox: c.bbox,
                kind: c.kind,
                caption: c.caption,
                thumbBlob: c.thumbBlob,
                fullBlob: c.fullBlob,
                w: c.w,
                h: c.h,
                createdAt: Date.now(),
              };
            });

            if (records.length > 0) {
              await db.figures.bulkPut(records);
              totalFound += records.length;
            }
          }

          page.cleanup();
        }

        scannedPages.add(targetPage);

        // Drop repeated watermark/logo figures appearing at identical position on >=40% of pages (when >=5 pages scanned)
        if (scannedPages.size >= 5) {
          const threshold = Math.ceil(scannedPages.size * 0.4);
          for (const [sig, occurrences] of signaturePagesMap.entries()) {
            if (occurrences.length >= threshold) {
              const idsToDelete = occurrences.map((o) => o.figId);
              await db.figures.bulkDelete(idsToDelete);
              totalFound = Math.max(0, totalFound - idsToDelete.length);
              signaturePagesMap.delete(sig);
            }
          }
        }

        if (scannedPages.size % 3 === 0 || scannedPages.size === totalPages) {
          await db.documents.update(docId, {
            figuresScannedPages: scannedPages.size,
            figureCount: totalFound,
            figuresStatus: scannedPages.size >= totalPages ? 'done' : 'scanning',
          });
        }

        for (const l of job.listeners) {
          l(scannedPages.size, totalPages, totalFound);
        }

        // Yield between pages so main thread never blocks
        await new Promise((r) => setTimeout(r, 12));
      }

      if (!job.cancelled) {
        const finalCount = await db.figures.where('docId').equals(docId).count();
        await db.documents.update(docId, {
          figuresScannedPages: totalPages,
          figureCount: finalCount,
          figuresStatus: 'done',
        });
      }
    } finally {
      await destroyPdfDocument(pdfDoc);
    }
  } catch {
    // Silent failure per Section 4 ("Detection failures never block reading; log them silently and continue.")
  } finally {
    activeFigureJobs.delete(docId);
  }
}

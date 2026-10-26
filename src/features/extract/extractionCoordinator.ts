import { db, makePageId, type PageRecord } from '../../data/db';
import { loadPdfDocument } from '../pdf/pdfClient';
import {
  extractSinglePdfPage,
  detectRepeatedFurnitureSignatures,
  buildBlocksFromLines,
  type GroupedLine,
} from './extractPage';

interface ExtractionJob {
  docId: string;
  priorityPage: number | null;
  cancelled: boolean;
  listeners: Set<(extractedCount: number, totalPages: number) => void>;
}

const activeJobs = new Map<string, ExtractionJob>();

export function subscribeToExtractionProgress(
  docId: string,
  cb: (extractedCount: number, totalPages: number) => void
): () => void {
  const job = activeJobs.get(docId);
  if (!job) return () => {};
  job.listeners.add(cb);
  return () => {
    job.listeners.delete(cb);
  };
}

export function prioritizeExtractionPage(docId: string, pageIndex: number) {
  const job = activeJobs.get(docId);
  if (job) {
    job.priorityPage = pageIndex;
  }
}

export function cancelBackgroundExtraction(docId: string) {
  const job = activeJobs.get(docId);
  if (job) {
    job.cancelled = true;
    activeJobs.delete(docId);
  }
}

/**
 * Extracts a specific page on demand if it hasn't been extracted yet.
 */
export async function ensurePageExtractedOnDemand(
  docId: string,
  pageIndex: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingPdfDoc?: any
): Promise<PageRecord | null> {
  const pageId = makePageId(docId, pageIndex);
  const cached = await db.pages.get(pageId);
  if (cached) return cached;

  prioritizeExtractionPage(docId, pageIndex);

  let pdfDoc = existingPdfDoc;
  let shouldDestroy = false;
  try {
    if (!pdfDoc) {
      const fileRec = await db.files.get(docId);
      if (!fileRec) return null;
      const buf = await fileRec.blob.arrayBuffer();
      pdfDoc = await loadPdfDocument({ data: buf });
      shouldDestroy = true;
    }

    const page = await pdfDoc.getPage(pageIndex + 1);
    const extracted = await extractSinglePdfPage(page);
    page.cleanup();

    const record: PageRecord = {
      id: pageId,
      docId,
      pageIndex,
      blocks: extracted.blocks,
      charCount: extracted.charCount,
      quality: extracted.quality,
    };

    await db.pages.put(record);
    return record;
  } catch {
    return null;
  } finally {
    if (shouldDestroy && pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Continues extracting remaining pages in the background, yielding between pages
 * and prioritizing any page requested by the reader.
 */
export async function resumeBackgroundExtraction(docId: string): Promise<void> {
  if (activeJobs.has(docId)) return;

  const doc = await db.documents.get(docId);
  if (!doc || doc.status === 'ready' || doc.status === 'scanned') return;

  const fileRec = await db.files.get(docId);
  if (!fileRec) return;

  const job: ExtractionJob = {
    docId,
    priorityPage: null,
    cancelled: false,
    listeners: new Set(),
  };
  activeJobs.set(docId, job);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfDoc: any = null;
  try {
    const buffer = await fileRec.blob.arrayBuffer();
    pdfDoc = await loadPdfDocument({ data: buffer });
    const totalPages = pdfDoc.numPages;

    const existingPages = await db.pages.where('docId').equals(docId).toArray();
    const extractedSet = new Set<number>(existingPages.map((p) => p.pageIndex));

    const sampleLinesForFurniture: GroupedLine[][] = [];
    const medianFonts = new Map<number, number>();
    const rawPageLines = new Map<number, GroupedLine[]>();

    // Collect furniture sample from first up to 10 pages
    const sampleLimit = Math.min(totalPages, 10);
    for (let i = 0; i < sampleLimit; i++) {
      if (job.cancelled) break;
      const page = await pdfDoc.getPage(i + 1);
      const res = await extractSinglePdfPage(page);
      page.cleanup();
      sampleLinesForFurniture.push(res.lines);
      rawPageLines.set(i, res.lines);
      medianFonts.set(i, res.medianFontSize);
      await new Promise((r) => setTimeout(r, 0));
    }

    const furnitureSigs = detectRepeatedFurnitureSignatures(sampleLinesForFurniture);

    // Re-update initial sample pages with detected repeated furniture signatures
    for (const [pIdx, lines] of rawPageLines.entries()) {
      if (job.cancelled) break;
      const medFont = medianFonts.get(pIdx) ?? 12;
      const blocks = buildBlocksFromLines(lines, medFont, furnitureSigs);
      const existing = await db.pages.get(makePageId(docId, pIdx));
      if (existing) {
        await db.pages.put({
          ...existing,
          blocks,
        });
      }
      extractedSet.add(pIdx);
    }

    let nextSequential = 0;

    while (extractedSet.size < totalPages && !job.cancelled) {
      let targetPage: number | null = null;

      if (
        job.priorityPage !== null &&
        job.priorityPage >= 0 &&
        job.priorityPage < totalPages &&
        !extractedSet.has(job.priorityPage)
      ) {
        targetPage = job.priorityPage;
        job.priorityPage = null;
      } else {
        while (nextSequential < totalPages && extractedSet.has(nextSequential)) {
          nextSequential++;
        }
        if (nextSequential < totalPages) {
          targetPage = nextSequential;
        }
      }

      if (targetPage === null) break;

      const page = await pdfDoc.getPage(targetPage + 1);
      const extracted = await extractSinglePdfPage(page, furnitureSigs);
      page.cleanup();

      const pageRec: PageRecord = {
        id: makePageId(docId, targetPage),
        docId,
        pageIndex: targetPage,
        blocks: extracted.blocks,
        charCount: extracted.charCount,
        quality: extracted.quality,
      };

      await db.pages.put(pageRec);
      extractedSet.add(targetPage);

      const count = extractedSet.size;
      if (count % 3 === 0 || count === totalPages) {
        await db.documents.update(docId, {
          extractedPages: count,
          status: count >= totalPages ? 'ready' : 'extracting',
        });
      }

      for (const listener of job.listeners) {
        listener(count, totalPages);
      }

      // Yield to main thread between pages so frames never block >50ms
      await new Promise((r) => setTimeout(r, 4));
    }

    if (!job.cancelled) {
      await db.documents.update(docId, {
        extractedPages: totalPages,
        status: 'ready',
      });
    }
  } catch {
    // Keep partial progress safe
  } finally {
    activeJobs.delete(docId);
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }
    }
  }
}

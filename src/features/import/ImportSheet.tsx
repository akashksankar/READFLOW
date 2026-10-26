import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check } from 'lucide-react';
import {
  db,
  makePageId,
  requestPersistentStorage,
  type DocumentRecord,
  type PageRecord,
  type ReaderMode,
} from '../../data/db';
import { Sheet } from '../../motion/Sheet';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { loadPdfDocument, renderCoverThumbnail } from '../pdf/pdfClient';
import {
  extractSinglePdfPage,
  detectRepeatedFurnitureSignatures,
  buildBlocksFromLines,
  type GroupedLine,
} from '../extract/extractPage';
import { resumeBackgroundExtraction } from '../extract/extractionCoordinator';
import { validatePdfBytes, classifyPdfLoadError } from './validateFile';
import { hashArrayBuffer } from '../../lib/hash';
import { formatBytes } from '../../lib/format';
import { Button } from '../../ui/Primitives';
import { Cover } from '../../ui/Cover';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

interface ImportSheetProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDocument: (docId: string, initialMode?: ReaderMode) => void;
  onSelectAnotherFile: () => void;
}

type ImportStep = 'reading' | 'extracting' | 'cover' | 'done';

interface ImportErrorState {
  code: string;
  title: string;
  message: string;
  recoveryLabel: string;
  duplicateDocId?: string;
  scannedDocId?: string;
}

function cleanTitleFromFilename(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled Document';
}

export function ImportSheet({
  file,
  open,
  onOpenChange,
  onOpenDocument,
  onSelectAnotherFile,
}: ImportSheetProps) {
  const { isReducedMotion } = useAppMotion();
  const [step, setStep] = useState<ImportStep>('reading');
  const [readFraction, setReadFraction] = useState(0);
  const [extractedPages, setExtractedPages] = useState(0);
  const [initialTargetPages, setInitialTargetPages] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ImportErrorState | null>(null);
  const [createdDoc, setCreatedDoc] = useState<DocumentRecord | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!open || !file) return;
    abortRef.current = false;
    setStep('reading');
    setReadFraction(0);
    setExtractedPages(0);
    setInitialTargetPages(1);
    setTotalPages(0);
    setSizeWarning(null);
    setErrorState(null);
    setCreatedDoc(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdfDoc: any = null;

    (async () => {
      try {
        // Step 1: Read file & validate bytes
        const buffer = await file.arrayBuffer();
        if (abortRef.current) return;
        setReadFraction(0.4);

        const validation = await validatePdfBytes(buffer, file.size);
        if (abortRef.current) return;

        if (!validation.valid) {
          setErrorState({
            code: validation.code,
            title: validation.title,
            message: validation.message,
            recoveryLabel: validation.recoveryLabel,
          });
          return;
        }

        if (validation.warning) {
          setSizeWarning(validation.warning);
        }

        // Duplicate detection via SHA-256
        const hash = await hashArrayBuffer(buffer);
        if (abortRef.current) return;
        setReadFraction(0.7);

        const existingDoc = await db.documents
          .where('hash')
          .equals(hash)
          .filter((d) => !d.softDeletedAt)
          .first();

        if (existingDoc) {
          setErrorState({
            code: 'duplicate',
            title: 'Already in your library',
            message: `"${existingDoc.title}" is already in your library (${existingDoc.pageCount} pages).`,
            recoveryLabel: 'Open',
            duplicateDocId: existingDoc.id,
          });
          return;
        }

        // Load PDF with PDF.js
        try {
          pdfDoc = await loadPdfDocument({
            data: buffer.slice(0),
            onProgress: (loaded, total) => {
              if (!abortRef.current && total > 0) {
                setReadFraction(0.7 + 0.3 * Math.min(1, loaded / total));
              }
            },
          });
        } catch (pdfErr) {
          if (abortRef.current) return;
          const classified = classifyPdfLoadError(pdfErr);
          setErrorState(classified);
          return;
        }

        if (abortRef.current) return;
        setReadFraction(1);

        const numPages = pdfDoc.numPages;
        if (!numPages || numPages < 1) {
          setErrorState({
            code: 'corrupted',
            title: 'Could not read this PDF',
            message: 'This PDF contains no readable pages.',
            recoveryLabel: 'Choose another file',
          });
          return;
        }

        setTotalPages(numPages);
        const firstBatchCount = Math.min(numPages, 5);
        setInitialTargetPages(firstBatchCount);
        setStep('extracting');

        const docId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Step 2: Extract first batch of pages (1..firstBatchCount)
        const extractedRecords: PageRecord[] = [];
        const rawLinesPerPage: GroupedLine[][] = [];
        const medianFonts: number[] = [];
        let totalCharsExtracted = 0;

        for (let i = 0; i < firstBatchCount; i++) {
          if (abortRef.current) return;
          const page = await pdfDoc.getPage(i + 1);
          const extracted = await extractSinglePdfPage(page);
          page.cleanup();

          rawLinesPerPage.push(extracted.lines);
          medianFonts.push(extracted.medianFontSize);
          totalCharsExtracted += extracted.charCount;

          extractedRecords.push({
            id: makePageId(docId, i),
            docId,
            pageIndex: i,
            blocks: extracted.blocks,
            charCount: extracted.charCount,
            quality: extracted.quality,
          });

          setExtractedPages(i + 1);
          await new Promise((r) => setTimeout(r, 0));
        }

        // Apply furniture detection on initial batch if >= 3 pages
        if (firstBatchCount >= 3) {
          const furnitureSigs = detectRepeatedFurnitureSignatures(rawLinesPerPage);
          for (let i = 0; i < extractedRecords.length; i++) {
            extractedRecords[i].blocks = buildBlocksFromLines(
              rawLinesPerPage[i],
              medianFonts[i],
              furnitureSigs
            );
          }
        }

        if (abortRef.current) return;

        // Step 3: Making cover
        setStep('cover');
        const coverBlob = await renderCoverThumbnail(pdfDoc);
        if (abortRef.current) return;

        const avgCharsPerPage = totalCharsExtracted / Math.max(1, firstBatchCount);
        const isScannedOrImageOnly = avgCharsPerPage < 30;

        const now = Date.now();
        const title = cleanTitleFromFilename(file.name);
        const docRecord: DocumentRecord = {
          id: docId,
          title,
          fileName: file.name,
          size: file.size,
          hash,
          pageCount: numPages,
          addedAt: now,
          lastOpenedAt: now,
          extractedPages: firstBatchCount,
          status: isScannedOrImageOnly
            ? 'scanned'
            : firstBatchCount >= numPages
              ? 'ready'
              : 'extracting',
          coverBlobId: coverBlob ? docId : null,
          softDeletedAt: null,
        };

        const pdfBlob = new Blob([buffer], { type: 'application/pdf' });

        await db.transaction(
          'rw',
          [db.documents, db.files, db.covers, db.pages, db.progress],
          async () => {
            await db.documents.put(docRecord);
            await db.files.put({ docId, blob: pdfBlob });
            if (coverBlob) {
              await db.covers.put({ docId, blob: coverBlob });
            }
            await db.pages.bulkPut(extractedRecords);
            await db.progress.put({
              docId,
              pageIndex: 0,
              blockIndex: 0,
              scrollOffset: 0,
              fraction: 0,
              mode: isScannedOrImageOnly ? 'original' : 'comfort',
              updatedAt: now,
            });
          }
        );

        await requestPersistentStorage();

        if (isScannedOrImageOnly) {
          setErrorState({
            code: 'no-text',
            title: 'No extractable text found',
            message:
              'This PDF appears to be a scanned document or image-only file. OCR is not supported yet, but you can read it right away in Original PDF mode.',
            recoveryLabel: 'Open in Original mode',
            scannedDocId: docId,
          });
          return;
        }

        setCreatedDoc(docRecord);
        setStep('done');

        // Start background extraction for remaining pages
        if (firstBatchCount < numPages) {
          void resumeBackgroundExtraction(docId);
        }

        // Open reader after brief confirmation
        window.setTimeout(() => {
          if (!abortRef.current) {
            onOpenDocument(docId, 'comfort');
          }
        }, isReducedMotion ? 100 : 360);
      } catch (err) {
        if (!abortRef.current) {
          const classified = classifyPdfLoadError(err);
          setErrorState(classified);
        }
      } finally {
        if (pdfDoc) {
          try {
            await pdfDoc.destroy();
          } catch {
            // ignore
          }
        }
      }
    })();

    return () => {
      abortRef.current = true;
      if (pdfDoc) {
        try {
          void pdfDoc.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [file, open, onOpenDocument, isReducedMotion]);

  // Compute real determinate progress 0..1
  const determinateFraction = (() => {
    if (step === 'reading') return readFraction * 0.35;
    if (step === 'extracting') {
      const extFrac = initialTargetPages > 0 ? extractedPages / initialTargetPages : 0;
      return 0.35 + extFrac * 0.5;
    }
    if (step === 'cover') return 0.9;
    return 1;
  })();

  const steps: { id: ImportStep; label: string }[] = [
    { id: 'reading', label: 'Reading file' },
    {
      id: 'extracting',
      label:
        totalPages > 0
          ? `Finding text (page ${Math.max(1, extractedPages)} of ${totalPages})`
          : 'Finding text',
    },
    { id: 'cover', label: 'Making cover' },
  ];

  const stepOrder: ImportStep[] = ['reading', 'extracting', 'cover', 'done'];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Import PDF"
      description="Validating and preparing PDF document for reading"
      mode="dialog-or-sheet"
    >
      {file && (
        <div className="space-y-4">
          {/* File header metadata */}
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <p className="font-sans text-sm font-medium text-ink truncate" title={file.name}>
              {file.name}
            </p>
            <span className="font-folio text-xs text-ink-3 shrink-0">
              {formatBytes(file.size)}
            </span>
          </div>

          {sizeWarning && !errorState && (
            <p className="text-xs text-ink-2 bg-bg px-3 py-2 rounded-[var(--radius-xs)] border border-line">
              {sizeWarning}
            </p>
          )}

          <AnimatePresence mode="wait">
            {errorState ? (
              <motion.div
                key="error"
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: MOTION_TOKENS.dur.fast }}
                className="space-y-4 py-2"
              >
                <div className="flex items-start gap-3">
                  <div className="error-nudge mt-0.5 text-state-error shrink-0">
                    <Icon icon={AlertCircle} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-base font-medium text-ink">
                      {errorState.title}
                    </h3>
                    <p className="text-sm text-ink-2 leading-relaxed">
                      {errorState.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                  {errorState.duplicateDocId ? (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        const targetId = errorState.duplicateDocId!;
                        onOpenChange(false);
                        onOpenDocument(targetId);
                      }}
                    >
                      Open
                    </Button>
                  ) : errorState.scannedDocId ? (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        const targetId = errorState.scannedDocId!;
                        onOpenChange(false);
                        onOpenDocument(targetId, 'original');
                      }}
                    >
                      {errorState.recoveryLabel}
                    </Button>
                  ) : errorState.code === 'storage-full' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      {errorState.recoveryLabel}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onSelectAnotherFile();
                      }}
                    >
                      {errorState.recoveryLabel}
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: MOTION_TOKENS.dur.fast }}
                className="space-y-4"
              >
                {/* Determinate scaleX bar */}
                <div
                  role="progressbar"
                  aria-label="Import progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(determinateFraction * 100)}
                  className="h-[3px] w-full overflow-hidden rounded-[var(--radius-xs)] bg-line"
                >
                  <div
                    className="h-full w-full origin-left bg-accent transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]"
                    style={{ transform: `scaleX(${determinateFraction})` }}
                  />
                </div>

                {/* Three-step progress list */}
                <ul className="divide-y divide-line border-y border-line">
                  {steps.map((s, idx) => {
                    const isCompleted = currentIdx > idx || step === 'done';
                    const isCurrent = currentIdx === idx && step !== 'done';
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <span
                          className={cn(
                            'transition-colors duration-[var(--dur-fast)]',
                            isCurrent
                              ? 'font-medium text-ink'
                              : isCompleted
                                ? 'text-ink-2'
                                : 'text-ink-3'
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="flex h-5 w-5 items-center justify-center">
                          {isCompleted ? (
                            <span className="text-state-success">
                              <Icon icon={Check} className="h-4 w-4" />
                            </span>
                          ) : isCurrent ? (
                            <span
                              aria-label="In progress"
                              className="h-2 w-2 rounded-[var(--radius-pill)] bg-accent"
                            />
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {createdDoc && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-12 shrink-0">
                      <Cover
                        docId={createdDoc.id}
                        title={createdDoc.title}
                        pageCount={createdDoc.pageCount}
                        hasCoverBlob={Boolean(createdDoc.coverBlobId)}
                        layoutId={`cover-${createdDoc.id}`}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-medium text-ink truncate">
                        {createdDoc.title}
                      </p>
                      <p className="font-folio text-xs text-ink-3">
                        {createdDoc.pageCount} pages · Opening reader
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Sheet>
  );
}

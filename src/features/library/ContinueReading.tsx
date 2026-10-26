import React from 'react';
import type { DocumentRecord, ProgressRecord } from '../../data/db';
import { computeProgressPercent } from '../../lib/format';
import { Cover } from '../../ui/Cover';
import { RibbonProgressBar } from '../../ui/Ribbon';
import { Button } from '../../ui/Primitives';

interface ContinueReadingProps {
  doc: DocumentRecord;
  progress: ProgressRecord;
  onContinue: (docId: string) => void;
}

/**
 * Continue reading:
 * Shown only when at least one document has progress between 1% and 99%.
 * Shows the most recently opened one as a large cover (~40% width on mobile, left aligned),
 * title in Fraunces, "page 42 of 310" with tabular figures, a ribbon progress line, and a "Continue" button.
 */
export function ContinueReading({ doc, progress, onContinue }: ContinueReadingProps) {
  const currentPage = Math.min(doc.pageCount, Math.max(1, progress.pageIndex + 1));
  const pct = computeProgressPercent(progress.pageIndex, progress.fraction, doc.pageCount);

  return (
    <section aria-label="Continue reading" className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="folio-label">Continue reading</span>
        <span className="font-folio text-xs text-ink-3">{pct}%</span>
      </div>

      <div className="flex items-start gap-4 sm:gap-5 border-y border-line py-4">
        <button
          type="button"
          onClick={() => onContinue(doc.id)}
          aria-label={`Continue reading ${doc.title}`}
          className="book-cover-interactive w-[38%] max-w-[144px] shrink-0 text-left focus-visible:rounded-[var(--radius-sm)]"
        >
          <Cover
            docId={doc.id}
            title={doc.title}
            pageCount={doc.pageCount}
            hasCoverBlob={Boolean(doc.coverBlobId)}
            layoutId={`cover-${doc.id}`}
            size="lg"
          />
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
          <div className="space-y-1.5">
            <h2 className="font-display text-lg sm:text-xl font-medium leading-snug text-ink line-clamp-3 break-words">
              <button
                type="button"
                onClick={() => onContinue(doc.id)}
                className="text-left hover:underline focus:outline-none"
              >
                {doc.title}
              </button>
            </h2>
            <p className="font-folio text-xs sm:text-sm text-ink-2">
              page {currentPage} of {doc.pageCount}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <RibbonProgressBar
              progress={pct}
              currentPage={currentPage}
              totalPages={doc.pageCount}
            />
            <div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onContinue(doc.id)}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

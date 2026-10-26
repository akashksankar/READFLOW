import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { db } from '../data/db';
import { useAppMotion } from '../motion/useReducedMotion';
import { MOTION_TOKENS } from '../motion/tokens';
import { cn } from '../lib/cn';

/**
 * Six deterministic token-based colorways for typographic covers
 * when a page-1 thumbnail has not rendered or for clean typographic bindings.
 */
const COVER_PALETTES = [
  { bg: 'var(--surface)', border: 'var(--line)', spine: 'var(--accent)', label: 'var(--ink-3)' },
  { bg: 'var(--bg)', border: 'var(--line)', spine: 'var(--ink-2)', label: 'var(--ink-3)' },
  { bg: 'var(--surface)', border: 'var(--line)', spine: 'var(--ink-3)', label: 'var(--ink-2)' },
  { bg: 'var(--bg)', border: 'var(--line)', spine: 'var(--accent)', label: 'var(--ink-2)' },
  { bg: 'var(--surface)', border: 'var(--line)', spine: 'var(--ink)', label: 'var(--ink-3)' },
  { bg: 'var(--bg)', border: 'var(--line)', spine: 'var(--line)', label: 'var(--ink-3)' },
];

function hashTitleIndex(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return h % COVER_PALETTES.length;
}

interface CoverProps {
  docId: string;
  title: string;
  pageCount?: number;
  hasCoverBlob?: boolean;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Cover({
  docId,
  title,
  pageCount,
  hasCoverBlob,
  layoutId,
  className,
  size = 'md',
}: CoverProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const { isReducedMotion, isLiteMode } = useAppMotion();

  useEffect(() => {
    if (!hasCoverBlob) {
      setThumbUrl(null);
      return;
    }
    let active = true;
    let createdUrl: string | null = null;

    db.covers
      .get(docId)
      .then((record) => {
        if (!active || !record?.blob) return;
        createdUrl = URL.createObjectURL(record.blob);
        setThumbUrl(createdUrl);
      })
      .catch(() => {
        // fallback to typographic cover
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [docId, hasCoverBlob]);

  const palette = useMemo(() => COVER_PALETTES[hashTitleIndex(title || docId)], [title, docId]);
  const enableLayout = Boolean(layoutId && !isReducedMotion && !isLiteMode);

  return (
    <motion.div
      layoutId={enableLayout ? layoutId : undefined}
      transition={{
        duration: MOTION_TOKENS.dur.slow,
        ease: MOTION_TOKENS.ease.out,
      }}
      className={cn(
        'book-cover-card relative aspect-[3/4] w-full overflow-hidden border border-line select-none',
        className
      )}
      style={{ backgroundColor: palette.bg }}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={`Cover of ${title}`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-top"
          onError={() => setThumbUrl(null)}
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-between p-3.5 pl-4 sm:p-4 sm:pl-5">
          <div className="border-b border-line pb-2">
            <span className="folio-label block truncate">
              {pageCount ? `${pageCount} pages` : 'Folio edition'}
            </span>
          </div>

          <div className="my-auto py-2">
            <p
              className={cn(
                'font-display text-ink font-medium leading-snug line-clamp-4 break-words',
                size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
              )}
            >
              {title}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-2">
            <span className="font-folio text-[11px] text-ink-3">ReadFlow</span>
            <span
              className="h-2 w-1.5"
              style={{ backgroundColor: palette.spine }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* 4px book spine edge crease on the left (one of the few allowed gradients as it carries physical book meaning) */}
      <div
        aria-hidden="true"
        className="book-cover-spine pointer-events-none absolute inset-y-0 left-0 w-[5px]"
      />
    </motion.div>
  );
}

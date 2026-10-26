import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquarePlus, Copy, Trash2, Check, X, Layers } from 'lucide-react';
import type { HighlightColor, HighlightRecord } from '../../data/db';
import { useViewportTier } from '../../motion/Sheet';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

export const HIGHLIGHT_COLORS: {
  id: HighlightColor;
  label: string;
  dotColor: string;
}[] = [
  { id: 'saffron', label: 'Saffron highlight', dotColor: '#F2C14E' },
  { id: 'clay', label: 'Clay highlight', dotColor: '#E8A08A' },
  { id: 'sage', label: 'Sage highlight', dotColor: '#A9C5A0' },
  { id: 'slate', label: 'Slate highlight', dotColor: '#9DBCD4' },
];

export interface SelectionDraft {
  segments: {
    pageIndex: number;
    blockIndex: number;
    start: number;
    end: number;
    quote: string;
    prefix: string;
    suffix: string;
  }[];
  fullText: string;
  rect: { top: number; left: number; width: number; bottom: number };
}

interface HighlightBarProps {
  selection: SelectionDraft | null;
  activeHighlight: HighlightRecord | null;
  anchorRect?: { top: number; left: number; width: number; bottom: number } | null;
  onCreateHighlight: (color: HighlightColor, note?: string) => void;
  onUpdateHighlight: (id: string, partial: Partial<HighlightRecord>) => void;
  onDeleteHighlight: (highlight: HighlightRecord) => void;
  onCopyText: (text: string) => void;
  onMakeCard?: (text: string, pageIndex: number, highlightId?: string) => void;
  onDismiss: () => void;
}

/**
 * Highlight creation & editing bar:
 * - Mobile uses a docked bar above the bottom chrome (never a floating menu, because native selection handles collide).
 * - Desktop floats near the selection or tapped highlight.
 * - Four color dots ("Saffron highlight", etc.), Note, Card, Copy, and Delete (when editing).
 */
export function HighlightBar({
  selection,
  activeHighlight,
  anchorRect,
  onCreateHighlight,
  onUpdateHighlight,
  onDeleteHighlight,
  onCopyText,
  onMakeCard,
  onDismiss,
}: HighlightBarProps) {
  const tier = useViewportTier();
  const { isReducedMotion } = useAppMotion();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('saffron');

  const isVisible = Boolean(selection || activeHighlight);

  useEffect(() => {
    if (activeHighlight) {
      setSelectedColor(activeHighlight.color);
      setNoteText(activeHighlight.note || '');
      setNoteOpen(Boolean(activeHighlight.note));
    } else if (selection) {
      setNoteOpen(false);
      setNoteText('');
    }
  }, [selection, activeHighlight]);

  const rect = selection?.rect ?? anchorRect ?? null;
  const isMobileOrTablet = tier !== 'desktop';

  const handleColorClick = (color: HighlightColor) => {
    setSelectedColor(color);
    if (activeHighlight) {
      onUpdateHighlight(activeHighlight.id, { color });
      if (!noteOpen) onDismiss();
    } else if (selection) {
      if (noteOpen) {
        // Keep note editor open with chosen color
      } else {
        onCreateHighlight(color, '');
      }
    }
  };

  const handleSaveWithNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeHighlight) {
      onUpdateHighlight(activeHighlight.id, {
        color: selectedColor,
        note: noteText.trim(),
      });
      onDismiss();
    } else if (selection) {
      onCreateHighlight(selectedColor, noteText.trim());
    }
  };

  // Compute desktop floating position clamped inside viewport
  const desktopStyle: React.CSSProperties = (() => {
    if (isMobileOrTablet || !rect) return {};
    const barWidth = 372;
    const rawLeft = rect.left + rect.width / 2 - barWidth / 2;
    const clampedLeft = Math.max(16, Math.min(window.innerWidth - barWidth - 16, rawLeft));
    const placeBelow = rect.top < 110;
    const top = placeBelow ? rect.bottom + 10 : Math.max(16, rect.top - (noteOpen ? 124 : 58));
    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${clampedLeft}px`,
      width: `${barWidth}px`,
    };
  })();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="toolbar"
          aria-label={activeHighlight ? 'Edit highlight' : 'Create highlight'}
          initial={{ opacity: 0, y: isReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isReducedMotion ? 0 : 8 }}
          transition={{
            duration: MOTION_TOKENS.dur.fast,
            ease: MOTION_TOKENS.ease.out,
          }}
          style={!isMobileOrTablet ? desktopStyle : undefined}
          className={cn(
            'z-40 border border-line bg-surface text-ink shadow-[var(--shadow-2)]',
            isMobileOrTablet
              ? 'fixed inset-x-3 bottom-[84px] rounded-[var(--radius-sm)] p-2.5'
              : 'rounded-[var(--radius-sm)] p-2'
          )}
        >
          <div className="flex items-center justify-between gap-1">
            {/* Four color dots */}
            <div className="flex items-center gap-0.5">
              {HIGHLIGHT_COLORS.map((c) => {
                const isCurrent =
                  (activeHighlight && activeHighlight.color === c.id) ||
                  (noteOpen && selectedColor === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={Boolean(isCurrent)}
                    onClick={() => handleColorClick(c.id)}
                    className="btn-press flex h-[38px] w-[36px] items-center justify-center rounded-[var(--radius-xs)] hover:bg-bg"
                  >
                    <span
                      className={cn(
                        'h-4 w-4 rounded-[var(--radius-pill)] border border-ink/20 transition-transform duration-[var(--dur-instant)]',
                        isCurrent && 'scale-115 ring-2 ring-ink ring-offset-2 ring-offset-surface'
                      )}
                      style={{ backgroundColor: c.dotColor }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-[1px] bg-line" aria-hidden="true" />

            {/* Note, Card, Copy, Delete / Close */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setNoteOpen((v) => !v)}
                aria-expanded={noteOpen}
                className={cn(
                  'btn-press inline-flex h-[38px] items-center gap-1 rounded-[var(--radius-xs)] px-2 text-xs font-medium',
                  noteOpen ? 'bg-ink text-bg' : 'text-ink hover:bg-bg'
                )}
              >
                <Icon icon={MessageSquarePlus} className="h-3.5 w-3.5" />
                <span>Note</span>
              </button>

              {onMakeCard && (
                <button
                  type="button"
                  aria-label="Make flashcard from selection"
                  onClick={() => {
                    const text = activeHighlight?.quote ?? selection?.fullText ?? '';
                    const pageIdx =
                      activeHighlight?.pageIndex ?? selection?.segments[0]?.pageIndex ?? 0;
                    if (text) {
                      onMakeCard(text, pageIdx, activeHighlight?.id);
                    }
                  }}
                  className="btn-press inline-flex h-[38px] items-center gap-1 rounded-[var(--radius-xs)] px-2 text-xs font-medium text-ink hover:bg-bg"
                >
                  <Icon icon={Layers} className="h-3.5 w-3.5" />
                  <span>Card</span>
                </button>
              )}

              <button
                type="button"
                aria-label="Copy text"
                onClick={() => {
                  const text = activeHighlight?.quote ?? selection?.fullText ?? '';
                  if (text) onCopyText(text);
                }}
                className="btn-press inline-flex h-[38px] items-center gap-1 rounded-[var(--radius-xs)] px-2 text-xs font-medium text-ink hover:bg-bg"
              >
                <Icon icon={Copy} className="h-3.5 w-3.5" />
                <span>Copy</span>
              </button>

              {activeHighlight ? (
                <button
                  type="button"
                  aria-label="Delete highlight"
                  onClick={() => onDeleteHighlight(activeHighlight)}
                  className="btn-press inline-flex h-[38px] w-[36px] items-center justify-center rounded-[var(--radius-xs)] text-state-error hover:bg-bg"
                >
                  <Icon icon={Trash2} className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Dismiss selection bar"
                  onClick={onDismiss}
                  className="btn-press inline-flex h-[38px] w-[36px] items-center justify-center rounded-[var(--radius-xs)] text-ink-3 hover:text-ink"
                >
                  <Icon icon={X} className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {noteOpen && (
            <form onSubmit={handleSaveWithNote} className="mt-2 border-t border-line pt-2 flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a quiet note..."
                aria-label="Highlight note"
                autoFocus
                className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Save note"
                className="btn-press inline-flex h-[34px] items-center gap-1 rounded-[var(--radius-xs)] bg-ink px-3 text-xs font-medium text-bg"
              >
                <Icon icon={Check} className="h-3.5 w-3.5" />
                <span>Save</span>
              </button>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

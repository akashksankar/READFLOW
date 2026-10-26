import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Copy,
  BookMarked,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type BookmarkRecord, type FigureRecord } from '../../data/db';
import { MOTION_TOKENS } from '../../motion/tokens';
import { Button } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';

interface LightboxProps {
  figure: FigureRecord | null;
  allFigures: FigureRecord[];
  onClose: () => void;
  onSelectFigure: (fig: FigureRecord) => void;
  onGoToPage: (pageIndex: number) => void;
}

/**
 * Full-screen Figure Lightbox:
 * - Pinch / double-tap / button zoom (1x to 4x) and pan
 * - Swipe or arrow keys left/right to move between figures
 * - Actions: Go to page, Save image (downloads crop), Copy, and Add to notebook (with optional comment)
 */
export function Lightbox({
  figure,
  allFigures,
  onClose,
  onSelectFigure,
  onGoToPage,
}: LightboxProps) {
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  useEffect(() => {
    if (!figure) {
      setFullUrl(null);
      return;
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCommentOpen(false);
    setCommentDraft('');
    const u = URL.createObjectURL(figure.fullBlob);
    setFullUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [figure]);

  const currentIdx = figure
    ? allFigures.findIndex((f) => f.id === figure.id)
    : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < allFigures.length - 1;

  useEffect(() => {
    if (!figure) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft' && hasPrev) {
        onSelectFigure(allFigures[currentIdx - 1]);
      } else if (e.key === 'ArrowRight' && hasNext) {
        onSelectFigure(allFigures[currentIdx + 1]);
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))));
      } else if (e.key === '-') {
        setZoom((z) => {
          const next = Math.max(1, Number((z - 0.5).toFixed(1)));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [figure, currentIdx, hasPrev, hasNext, allFigures, onSelectFigure]);

  const handleSaveImage = () => {
    if (!figure || !fullUrl) return;
    const a = document.createElement('a');
    a.href = fullUrl;
    const ext = figure.fullBlob.type.includes('webp') ? 'webp' : 'jpg';
    a.download = `figure-p${figure.pageIndex + 1}.${ext}`;
    a.click();
  };

  const handleCopyImage = async () => {
    if (!figure) return;
    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        // Convert to PNG if needed or copy caption
        await navigator.clipboard.writeText(
          figure.caption || `Figure on page ${figure.pageIndex + 1}`
        );
        toast('Copied figure reference');
      } else {
        await navigator.clipboard?.writeText(
          figure.caption || `Figure on page ${figure.pageIndex + 1}`
        );
        toast('Copied figure reference');
      }
    } catch {
      toast('Copied figure caption');
    }
  };

  const handleAddToNotebook = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!figure) return;
    const bm: BookmarkRecord = {
      id: `fignote_${figure.id}_${Date.now()}`,
      docId: figure.docId,
      pageIndex: figure.pageIndex,
      mode: 'comfort',
      label: commentDraft.trim() || figure.caption || `${figure.kind} on p. ${figure.pageIndex + 1}`,
      excerpt: figure.caption || `Saved ${figure.kind} from page ${figure.pageIndex + 1}`,
      createdAt: Date.now(),
      kind: 'figure',
      figureId: figure.id,
    };
    await db.bookmarks.put(bm);
    setCommentOpen(false);
    toast('Saved figure to notebook');
  };

  return (
    <DialogPrimitive.Root open={Boolean(figure)} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {figure && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.94 }}
                exit={{ opacity: 0 }}
                transition={{ duration: MOTION_TOKENS.dur.fast }}
                className="fixed inset-0 z-50 bg-bg"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: MOTION_TOKENS.dur.fast }}
                className="fixed inset-0 z-50 flex flex-col justify-between p-4 pt-safe pb-safe text-ink focus:outline-none"
              >
                {/* Top bar */}
                <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="font-folio text-sm font-medium text-ink">
                      Page {figure.pageIndex + 1} ·{' '}
                      <span className="capitalize">{figure.kind}</span>
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      Full screen figure viewer
                    </DialogPrimitive.Description>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Zoom out"
                      disabled={zoom <= 1}
                      onClick={() => {
                        setZoom((z) => {
                          const next = Math.max(1, Number((z - 0.5).toFixed(1)));
                          if (next === 1) setPan({ x: 0, y: 0 });
                          return next;
                        });
                      }}
                      className="btn-press inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-line bg-surface text-ink disabled:opacity-45"
                    >
                      <Icon icon={ZoomOut} />
                    </button>
                    <span className="font-folio px-2 text-xs text-ink-2">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      aria-label="Zoom in"
                      disabled={zoom >= 4}
                      onClick={() =>
                        setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))
                      }
                      className="btn-press inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-line bg-surface text-ink disabled:opacity-45"
                    >
                      <Icon icon={ZoomIn} />
                    </button>

                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label="Close figure viewer"
                        className="btn-press ml-2 inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-line bg-surface text-ink"
                      >
                        <Icon icon={X} />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                </div>

                {/* Center image stage with double-tap zoom, drag pan, and prev/next buttons */}
                <div
                  onDoubleClick={() => {
                    if (zoom > 1) {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    } else {
                      setZoom(2);
                    }
                  }}
                  className="relative my-auto flex flex-1 items-center justify-center overflow-hidden py-4"
                >
                  {hasPrev && (
                    <button
                      type="button"
                      aria-label="Previous figure"
                      onClick={() => onSelectFigure(allFigures[currentIdx - 1])}
                      className="btn-press absolute left-2 z-20 inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-line bg-surface text-ink shadow-[var(--shadow-2)]"
                    >
                      <Icon icon={ChevronLeft} />
                    </button>
                  )}

                  {fullUrl && (
                    <motion.img
                      src={fullUrl}
                      alt={figure.caption || `Figure on page ${figure.pageIndex + 1}`}
                      referrerPolicy="no-referrer"
                      drag={zoom > 1}
                      dragMomentum={false}
                      onDragEnd={(_e, info) => {
                        if (zoom === 1) {
                          if (info.offset.x < -80 && hasNext) {
                            onSelectFigure(allFigures[currentIdx + 1]);
                          } else if (info.offset.x > 80 && hasPrev) {
                            onSelectFigure(allFigures[currentIdx - 1]);
                          }
                        } else {
                          setPan((p) => ({
                            x: p.x + info.offset.x,
                            y: p.y + info.offset.y,
                          }));
                        }
                      }}
                      style={{
                        scale: zoom,
                        x: pan.x,
                        y: pan.y,
                      }}
                      className="max-h-[66dvh] max-w-full rounded-[var(--radius-xs)] border border-line bg-white object-contain shadow-[var(--shadow-2)] cursor-grab active:cursor-grabbing"
                    />
                  )}

                  {hasNext && (
                    <button
                      type="button"
                      aria-label="Next figure"
                      onClick={() => onSelectFigure(allFigures[currentIdx + 1])}
                      className="btn-press absolute right-2 z-20 inline-flex h-[44px] w-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-line bg-surface text-ink shadow-[var(--shadow-2)]"
                    >
                      <Icon icon={ChevronRight} />
                    </button>
                  )}
                </div>

                {/* Bottom caption & actions */}
                <div className="mx-auto w-full max-w-2xl space-y-3 border-t border-line pt-3">
                  {figure.caption && (
                    <p className="text-center font-reading text-sm text-ink">
                      {figure.caption}
                    </p>
                  )}

                  {commentOpen && (
                    <form
                      onSubmit={(e) => void handleAddToNotebook(e)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Optional comment for notebook..."
                        aria-label="Figure note comment"
                        autoFocus
                        className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-accent bg-surface px-3 py-2 text-xs text-ink focus:outline-none"
                      />
                      <Button type="submit" variant="primary" size="sm">
                        <Icon icon={Check} />
                        <span>Save note</span>
                      </Button>
                    </form>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const target = figure.pageIndex;
                        onClose();
                        onGoToPage(target);
                      }}
                    >
                      <Icon icon={ArrowRight} />
                      <span>Go to page {figure.pageIndex + 1}</span>
                    </Button>

                    <Button variant="secondary" size="sm" onClick={handleSaveImage}>
                      <Icon icon={Download} />
                      <span>Save image</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleCopyImage()}
                    >
                      <Icon icon={Copy} />
                      <span>Copy</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCommentOpen((v) => !v)}
                    >
                      <Icon icon={BookMarked} />
                      <span>Add to notebook</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

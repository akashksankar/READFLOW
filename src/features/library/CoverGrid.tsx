import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { MoreVertical, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
import type { DocumentRecord, ProgressRecord } from '../../data/db';
import { computeProgressPercent, formatRelativeDate } from '../../lib/format';
import { listItem } from '../../motion/variants';
import { useAppMotion } from '../../motion/useReducedMotion';
import { Cover } from '../../ui/Cover';
import { Icon } from '../../ui/Icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../ui/Primitives';

interface CoverGridProps {
  documents: DocumentRecord[];
  progressMap: Map<string, ProgressRecord>;
  onOpenDocument: (docId: string) => void;
  onRenameDocument: (docId: string, newTitle: string) => void;
  onRemoveDocument: (doc: DocumentRecord) => void;
  onRescanFigures?: (doc: DocumentRecord) => void;
  hasContinueReading?: boolean;
}

export function CoverGrid({
  documents,
  progressMap,
  onOpenDocument,
  onRenameDocument,
  onRemoveDocument,
  onRescanFigures,
  hasContinueReading = false,
}: CoverGridProps) {
  const { isReducedMotion } = useAppMotion();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const startRename = (doc: DocumentRecord) => {
    setRenamingId(doc.id);
    setRenameDraft(doc.title);
    setMenuOpenId(null);
  };

  const commitRename = (docId: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      onRenameDocument(docId, trimmed);
    }
    setRenamingId(null);
  };

  const handleTouchStart = (docId: string) => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setMenuOpenId(docId);
    }, 520);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <section aria-label="All documents" className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="folio-label">All documents</span>
        <span className="font-folio text-xs text-ink-3">{documents.length}</span>
      </div>

      <div
        className={
          hasContinueReading
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-7'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-8'
        }
      >
        {documents.map((doc, idx) => {
          const prog = progressMap.get(doc.id);
          const pct = prog
            ? computeProgressPercent(prog.pageIndex, prog.fraction, doc.pageCount)
            : 0;
          const isRenaming = renamingId === doc.id;
          const figCount = doc.figureCount ?? 0;

          return (
            <motion.article
              key={doc.id}
              custom={{ index: idx, reduced: isReducedMotion }}
              variants={listItem}
              initial="initial"
              animate="animate"
              exit="exit"
              className="group flex flex-col"
              onTouchStart={() => handleTouchStart(doc.id)}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
            >
              <button
                type="button"
                onClick={() => onOpenDocument(doc.id)}
                aria-label={`Open ${doc.title}`}
                className="book-cover-interactive w-full text-left focus-visible:rounded-[var(--radius-sm)]"
              >
                <Cover
                  docId={doc.id}
                  title={doc.title}
                  pageCount={doc.pageCount}
                  hasCoverBlob={Boolean(doc.coverBlobId)}
                  layoutId={`cover-${doc.id}`}
                />
              </button>

              <div className="mt-2.5 flex flex-1 flex-col justify-between">
                {isRenaming ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitRename(doc.id);
                    }}
                    className="flex items-center gap-1 pb-2"
                  >
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      aria-label="Document title"
                      autoFocus
                      className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-accent bg-surface px-2 py-1 text-xs font-medium text-ink focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Save title"
                      className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] bg-ink text-bg"
                    >
                      <Icon icon={Check} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      aria-label="Cancel rename"
                      className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] border border-line text-ink-2"
                    >
                      <Icon icon={X} className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-display text-sm font-medium leading-snug text-ink line-clamp-2 break-words">
                      <button
                        type="button"
                        onClick={() => onOpenDocument(doc.id)}
                        className="text-left hover:underline focus:outline-none"
                      >
                        {doc.title}
                      </button>
                    </h3>

                    <DropdownMenu
                      open={menuOpenId === doc.id ? true : undefined}
                      onOpenChange={(open) => setMenuOpenId(open ? doc.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${doc.title}`}
                          className="btn-press -mr-1.5 -mt-1 inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-ink-3 hover:text-ink"
                        >
                          <Icon icon={MoreVertical} className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => startRename(doc)}>
                          <Icon icon={Pencil} className="h-4 w-4" />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        {onRescanFigures && (
                          <DropdownMenuItem onSelect={() => onRescanFigures(doc)}>
                            <Icon icon={RefreshCw} className="h-4 w-4" />
                            <span>Rescan figures</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          destructive
                          onSelect={() => onRemoveDocument(doc)}
                        >
                          <Icon icon={Trash2} className="h-4 w-4" />
                          <span>Remove</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Hairline rule + metadata: "13% · 4 figs · opened 2 days ago" */}
                <div className="mt-2 border-t border-line pt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                  <span className="font-folio">{pct}%</span>
                  {figCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-folio">{figCount} fig{figCount === 1 ? '' : 's'}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{formatRelativeDate(doc.lastOpenedAt)}</span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

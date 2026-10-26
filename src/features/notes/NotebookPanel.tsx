import React, { useState, useMemo } from 'react';
import { Trash2, Download, ExternalLink, Check, X, Layers } from 'lucide-react';
import type {
  BookmarkRecord,
  FigureRecord,
  HighlightColor,
  HighlightRecord,
  ReaderMode,
} from '../../data/db';
import { HIGHLIGHT_COLORS } from './HighlightBar';
import { FigureThumbImage } from '../figures/FiguresSheet';
import { SegmentedControl } from '../../ui/Primitives';
import { BookmarkRibbonIcon } from '../../ui/Ribbon';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

type NotebookTab = 'highlights' | 'bookmarks';

interface NotebookContentProps {
  docId: string;
  docTitle: string;
  currentMode?: ReaderMode;
  highlights: HighlightRecord[];
  bookmarks: BookmarkRecord[];
  figures?: FigureRecord[];
  unplacedIds?: Set<string>;
  onJumpToHighlight: (highlight: HighlightRecord) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  onDeleteHighlight: (highlight: HighlightRecord) => void;
  onJumpToBookmark: (bookmark: BookmarkRecord) => void;
  onUpdateBookmarkLabel: (id: string, label: string) => void;
  onDeleteBookmark: (bookmark: BookmarkRecord) => void;
  onMakeCardFromHighlight?: (highlight: HighlightRecord) => void;
  onSelectFigure?: (figure: FigureRecord) => void;
  onOpenFullScreenNotebook?: () => void;
}

export function NotebookContent({
  docTitle,
  currentMode,
  highlights,
  bookmarks,
  figures = [],
  unplacedIds,
  onJumpToHighlight,
  onUpdateHighlightNote,
  onDeleteHighlight,
  onJumpToBookmark,
  onUpdateBookmarkLabel,
  onDeleteBookmark,
  onMakeCardFromHighlight,
  onSelectFigure,
  onOpenFullScreenNotebook,
}: NotebookContentProps) {
  const [tab, setTab] = useState<NotebookTab>('highlights');
  const [colorFilter, setColorFilter] = useState<HighlightColor | 'all'>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [bookmarkLabelDraft, setBookmarkLabelDraft] = useState('');

  const figuresMap = useMemo(() => {
    const map = new Map<string, FigureRecord>();
    for (const f of figures) {
      map.set(f.id, f);
    }
    return map;
  }, [figures]);

  // Group highlights in document order under page folios
  const groupedHighlights = useMemo(() => {
    const filtered =
      colorFilter === 'all'
        ? [...highlights]
        : highlights.filter((h) => h.color === colorFilter);

    filtered.sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
      return a.start - b.start;
    });

    const groups = new Map<number, HighlightRecord[]>();
    for (const h of filtered) {
      const list = groups.get(h.pageIndex) ?? [];
      list.push(h);
      groups.set(h.pageIndex, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [highlights, colorFilter]);

  const sortedBookmarks = useMemo(() => {
    return [...bookmarks].sort((a, b) => a.pageIndex - b.pageIndex);
  }, [bookmarks]);

  const handleExportMarkdown = () => {
    const lines: string[] = [`# ${docTitle} — Notebook`, ''];
    if (highlights.length > 0) {
      lines.push('## Highlights', '');
      for (const [pageIdx, items] of groupedHighlights) {
        lines.push(`### Page ${pageIdx + 1}`, '');
        for (const h of items) {
          lines.push(`> ${h.quote}`);
          if (h.note) {
            lines.push('', h.note);
          }
          lines.push('');
        }
      }
    }
    if (sortedBookmarks.length > 0) {
      lines.push('## Bookmarks', '');
      for (const bm of sortedBookmarks) {
        lines.push(
          `- **Page ${bm.pageIndex + 1}**${bm.label ? ` — ${bm.label}` : ''}: ${bm.excerpt}`
        );
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/[^a-z0-9_-]+/gi, '_')}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top bar: Segmented tabs + optional Full-screen / Export actions */}
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl<NotebookTab>
          ariaLabel="Notebook sections"
          layoutGroupId="notebook-tab-seg"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'highlights', label: 'Highlights', count: highlights.length },
            { value: 'bookmarks', label: 'Bookmarks', count: bookmarks.length },
          ]}
        />

        <div className="flex items-center gap-1">
          {(highlights.length > 0 || bookmarks.length > 0) && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              aria-label="Export notebook as Markdown"
              title="Export Markdown"
              className="btn-press inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-xs)] text-ink-2 hover:text-ink"
            >
              <Icon icon={Download} />
            </button>
          )}
          {onOpenFullScreenNotebook && (
            <button
              type="button"
              onClick={onOpenFullScreenNotebook}
              aria-label="Open full-screen notebook"
              title="Open full-screen notebook"
              className="btn-press inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-xs)] text-ink-2 hover:text-ink"
            >
              <Icon icon={ExternalLink} />
            </button>
          )}
        </div>
      </div>

      {currentMode === 'original' && tab === 'highlights' && (
        <p className="text-xs text-ink-3 border-b border-line pb-2.5">
          Highlights are created in Comfort or Paged mode. Tapping an entry below opens it in Comfort mode.
        </p>
      )}

      {tab === 'highlights' ? (
        <div className="space-y-4">
          {/* Color filter row: "All" + four color dots with accessible names */}
          <div
            role="group"
            aria-label="Filter highlights by color"
            className="flex items-center gap-1.5 border-b border-line pb-3"
          >
            <button
              type="button"
              onClick={() => setColorFilter('all')}
              aria-pressed={colorFilter === 'all'}
              className={cn(
                'btn-press rounded-[var(--radius-xs)] px-2.5 py-1 text-xs font-medium min-h-[32px]',
                colorFilter === 'all'
                  ? 'bg-ink text-bg'
                  : 'text-ink-2 hover:text-ink'
              )}
            >
              All
            </button>
            {HIGHLIGHT_COLORS.map((c) => {
              const active = colorFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Filter by ${c.label}`}
                  aria-pressed={active}
                  onClick={() => setColorFilter(active ? 'all' : c.id)}
                  className={cn(
                    'btn-press inline-flex h-[32px] items-center gap-1.5 rounded-[var(--radius-xs)] border px-2 text-xs',
                    active
                      ? 'border-ink bg-bg font-medium text-ink'
                      : 'border-transparent text-ink-3 hover:text-ink'
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-[var(--radius-pill)] border border-ink/20"
                    style={{ backgroundColor: c.dotColor }}
                  />
                  <span className="capitalize">{c.id}</span>
                </button>
              );
            })}
          </div>

          {groupedHighlights.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <svg
                width="48"
                height="32"
                viewBox="0 0 48 32"
                fill="none"
                aria-hidden="true"
                className="mx-auto text-ink-3"
              >
                <path
                  d="M6 10H42M6 18H34M6 26H24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-draw-short"
                />
                <rect
                  x="5"
                  y="6"
                  width="30"
                  height="8"
                  rx="1"
                  fill="var(--hl-saffron)"
                />
              </svg>
              <p className="text-sm text-ink-2">Select any text to highlight it</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHighlights.map(([pageIdx, items]) => (
                <div key={pageIdx} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-line pb-1">
                    <span className="font-folio text-xs text-ink-3">
                      Page {pageIdx + 1}
                    </span>
                  </div>

                  <div className="divide-y divide-line">
                    {items.map((hl) => {
                      const isUnplaced = Boolean(hl.unplaced || unplacedIds?.has(hl.id));
                      const isEditing = editingNoteId === hl.id;
                      const colorMeta = HIGHLIGHT_COLORS.find((c) => c.id === hl.color);

                      return (
                        <article
                          key={hl.id}
                          className="notebook-entry-row py-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onJumpToHighlight(hl)}
                              className="text-left flex-1 group focus-visible:rounded-[var(--radius-xs)]"
                            >
                              <span className="sr-only">
                                {colorMeta?.label ?? 'Highlight'} on page {pageIdx + 1}:
                              </span>
                              <span
                                data-color={hl.color}
                                className="hl-wash font-reading text-sm leading-relaxed text-ink group-hover:opacity-90"
                              >
                                {hl.quote}
                              </span>
                            </button>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {onMakeCardFromHighlight && (
                                <button
                                  type="button"
                                  aria-label="Make flashcard from highlight"
                                  title="Make card"
                                  onClick={() => onMakeCardFromHighlight(hl)}
                                  className="btn-press inline-flex h-8 px-2 items-center gap-1 rounded-[var(--radius-xs)] text-xs text-ink-2 hover:text-ink"
                                >
                                  <Icon icon={Layers} className="h-3.5 w-3.5" />
                                  <span>Make card</span>
                                </button>
                              )}

                              <button
                                type="button"
                                aria-label="Delete highlight"
                                onClick={() => onDeleteHighlight(hl)}
                                className="btn-press inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] text-ink-3 hover:text-state-error"
                              >
                                <Icon icon={Trash2} className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {isUnplaced && (
                            <p className="folio-label text-[11px] text-ink-3">
                              Unplaced · Kept in notebook
                            </p>
                          )}

                          {isEditing ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                onUpdateHighlightNote(hl.id, noteDraft.trim());
                                setEditingNoteId(null);
                              }}
                              className="flex items-center gap-1.5 pt-1"
                            >
                              <input
                                type="text"
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Add a note..."
                                aria-label="Edit highlight note"
                                autoFocus
                                className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-accent bg-bg px-2.5 py-1 text-xs font-sans text-ink focus:outline-none"
                              />
                              <button
                                type="submit"
                                aria-label="Save note"
                                className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] bg-ink text-bg"
                              >
                                <Icon icon={Check} className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Cancel note edit"
                                onClick={() => setEditingNoteId(null)}
                                className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] border border-line text-ink-2"
                              >
                                <Icon icon={X} className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          ) : hl.note ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(hl.id);
                                setNoteDraft(hl.note);
                              }}
                              className="block w-full text-left font-sans text-xs text-ink-2 hover:text-ink"
                            >
                              {hl.note}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(hl.id);
                                setNoteDraft('');
                              }}
                              className="font-sans text-xs text-ink-3 hover:text-ink-2"
                            >
                              Add note
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Bookmarks & Saved Figures tab */
        <div>
          {sortedBookmarks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="flex justify-center">
                <BookmarkRibbonIcon active={false} className="text-ink-3" />
              </div>
              <p className="text-sm text-ink-2">Tap the ribbon to mark your place</p>
            </div>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {sortedBookmarks.map((bm) => {
                const isEditingBm = editingBookmarkId === bm.id;
                const linkedFigure = bm.figureId ? figuresMap.get(bm.figureId) : undefined;

                return (
                  <article key={bm.id} className="notebook-entry-row py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (linkedFigure && onSelectFigure) {
                            onSelectFigure(linkedFigure);
                          } else {
                            onJumpToBookmark(bm);
                          }
                        }}
                        className="flex items-start gap-2.5 text-left min-w-0 flex-1 group"
                      >
                        <BookmarkRibbonIcon active className="mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-baseline gap-2">
                            <span className="font-folio text-xs font-medium text-ink group-hover:underline">
                              Page {bm.pageIndex + 1}
                            </span>
                            {bm.label && (
                              <span className="text-xs text-ink-2 truncate">
                                · {bm.label}
                              </span>
                            )}
                          </div>
                          {linkedFigure && (
                            <div className="w-28 overflow-hidden rounded-[var(--radius-xs)] border border-line bg-white">
                              <FigureThumbImage
                                blob={linkedFigure.thumbBlob}
                                alt={linkedFigure.caption || `Figure on page ${bm.pageIndex + 1}`}
                                className="h-20 w-full object-contain"
                              />
                            </div>
                          )}
                          <p className="mt-0.5 text-xs text-ink-3 line-clamp-1">
                            {bm.excerpt || `Marked in ${bm.mode} mode`}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label={`Remove bookmark on page ${bm.pageIndex + 1}`}
                        onClick={() => onDeleteBookmark(bm)}
                        className="btn-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-ink-3 hover:text-state-error"
                      >
                        <Icon icon={Trash2} className="h-4 w-4" />
                      </button>
                    </div>

                    {isEditingBm ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onUpdateBookmarkLabel(bm.id, bookmarkLabelDraft.trim());
                          setEditingBookmarkId(null);
                        }}
                        className="flex items-center gap-1.5 pl-7"
                      >
                        <input
                          type="text"
                          value={bookmarkLabelDraft}
                          onChange={(e) => setBookmarkLabelDraft(e.target.value)}
                          placeholder="Bookmark label..."
                          aria-label="Bookmark label"
                          autoFocus
                          className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-accent bg-bg px-2 py-1 text-xs text-ink focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label="Save label"
                          className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] bg-ink text-bg"
                        >
                          <Icon icon={Check} className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel label edit"
                          onClick={() => setEditingBookmarkId(null)}
                          className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] border border-line text-ink-2"
                        >
                          <Icon icon={X} className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="pl-7">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBookmarkId(bm.id);
                            setBookmarkLabelDraft(bm.label || '');
                          }}
                          className="text-[11px] text-ink-3 hover:text-ink-2"
                        >
                          {bm.label ? 'Edit label' : 'Add label'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

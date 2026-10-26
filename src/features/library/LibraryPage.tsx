import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Upload, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  db,
  purgeDocumentCompletely,
  type DocumentRecord,
  type ProgressRecord,
  type ReaderMode,
} from '../../data/db';
import { useAppSettings } from '../../app/providers';
import { fadeUp } from '../../motion/variants';
import { computeProgressPercent } from '../../lib/format';
import { BrandRibbonMark } from '../../ui/Ribbon';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';
import { EmptyState } from './EmptyState';
import { ContinueReading } from './ContinueReading';
import { CoverGrid } from './CoverGrid';
import { ImportSheet } from '../import/ImportSheet';
import { startOrResumeFigureDetection } from '../figures/cropFigure';

type SortOption = 'recent' | 'title' | 'progress';

export function LibraryPage() {
  const [, setLocation] = useLocation();
  const { isReducedMotion, storageBlocked, hasPlayedIntro, markIntroPlayed } = useAppSettings();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deleteTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!hasPlayedIntro) {
      const t = window.setTimeout(() => markIntroPlayed(), 400);
      return () => window.clearTimeout(t);
    }
  }, [hasPlayedIntro, markIntroPlayed]);

  // Clean up any pending soft-delete timers on unmount
  useEffect(() => {
    const timers = deleteTimersRef.current;
    return () => {
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  // Full-window drag-and-drop on desktop
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter++;
        setIsDraggingWindow(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) {
        setIsDraggingWindow(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingWindow(false);
      const droppedFile = e.dataTransfer?.files?.[0];
      if (droppedFile) {
        setSelectedFile(droppedFile);
        setImportSheetOpen(true);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const liveData = useLiveQuery(async () => {
    const [docs, progresses] = await Promise.all([
      db.documents.toArray(),
      db.progress.toArray(),
    ]);
    const activeDocs = docs.filter((d) => !d.softDeletedAt);
    const progMap = new Map<string, ProgressRecord>();
    for (const p of progresses) {
      progMap.set(p.docId, p);
    }
    return { docs: activeDocs, progMap };
  }, []);

  const triggerFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportSheetOpen(true);
    }
  };

  const handleOpenDocument = useCallback(
    async (docId: string, initialMode?: ReaderMode) => {
      try {
        await db.documents.update(docId, { lastOpenedAt: Date.now() });
        if (initialMode) {
          const existingProg = await db.progress.get(docId);
          if (existingProg) {
            await db.progress.update(docId, { mode: initialMode });
          }
        }
      } catch {
        // ignore
      }
      setLocation(`/read/${docId}`);
    },
    [setLocation]
  );

  const handleRenameDocument = useCallback(async (docId: string, newTitle: string) => {
    await db.documents.update(docId, { title: newTitle });
    toast('Title updated');
  }, []);

  const handleRemoveDocument = useCallback((doc: DocumentRecord) => {
    const docId = doc.id;
    const deletedAt = Date.now();
    void db.documents.update(docId, { softDeletedAt: deletedAt });

    const timerId = window.setTimeout(() => {
      deleteTimersRef.current.delete(docId);
      void purgeDocumentCompletely(docId);
    }, 6000);

    deleteTimersRef.current.set(docId, timerId);

    toast(`Removed "${doc.title}"`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = deleteTimersRef.current.get(docId);
          if (pending) {
            window.clearTimeout(pending);
            deleteTimersRef.current.delete(docId);
          }
          void db.documents.update(docId, { softDeletedAt: null });
        },
      },
    });
  }, []);

  // Determine Continue Reading hero candidate: most recently opened with progress between 1% and 99%
  const continueReadingCandidate = useMemo(() => {
    if (!liveData) return null;
    const { docs, progMap } = liveData;
    const sortedByRecent = [...docs].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    for (const d of sortedByRecent) {
      const prog = progMap.get(d.id);
      if (!prog) continue;
      const pct = computeProgressPercent(prog.pageIndex, prog.fraction, d.pageCount);
      if (pct >= 1 && pct <= 99) {
        return { doc: d, progress: prog };
      }
    }
    return null;
  }, [liveData]);

  // Filter and sort documents
  const filteredAndSortedDocs = useMemo(() => {
    if (!liveData) return [];
    const { docs, progMap } = liveData;
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? docs.filter((d) => d.title.toLowerCase().includes(q))
      : [...docs];

    filtered.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'progress') {
        const pa = progMap.get(a.id);
        const pb = progMap.get(b.id);
        const pctA = pa ? computeProgressPercent(pa.pageIndex, pa.fraction, a.pageCount) : 0;
        const pctB = pb ? computeProgressPercent(pb.pageIndex, pb.fraction, b.pageCount) : 0;
        if (pctB !== pctA) return pctB - pctA;
      }
      return b.lastOpenedAt - a.lastOpenedAt;
    });

    return filtered;
  }, [liveData, searchQuery, sortBy]);

  const sortLabels: Record<SortOption, string> = {
    recent: 'Recent',
    title: 'Title',
    progress: 'Progress',
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col">
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Import PDF file"
      />

      {/* Full-window desktop drag-and-drop overlay */}
      <AnimatePresence>
        {isDraggingWindow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/92 p-6 pointer-events-none"
          >
            <div className="flex h-full w-full max-w-4xl max-h-[80dvh] items-center justify-center rounded-[var(--radius-sm)] border-2 border-dashed border-accent bg-surface/60">
              <p className="font-display text-2xl font-medium text-ink">
                Drop to add
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library Header */}
      <motion.header
        custom={isReducedMotion}
        variants={!hasPlayedIntro ? fadeUp : undefined}
        initial={!hasPlayedIntro ? 'initial' : false}
        animate="animate"
        className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-safe"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          {/* Brand wordmark in Fraunces with ribbon mark */}
          <a
            href="/"
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:rounded-[var(--radius-xs)]"
          >
            <BrandRibbonMark />
            <span className="font-display text-xl font-medium tracking-tight text-ink">
              ReadFlow
            </span>
          </a>

          {/* Controls: Search, Sort (Recent, Title, Progress), Import */}
          <div className="flex items-center gap-2">
            {searchOpen ? (
              <div className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 h-[40px] w-[170px] sm:w-[240px]">
                <Icon icon={Search} className="h-4 w-4 text-ink-3" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search library..."
                  aria-label="Search library by title"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className="btn-press inline-flex h-7 w-7 items-center justify-center text-ink-3 hover:text-ink"
                >
                  <Icon icon={X} className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="icon"
                aria-label="Search library"
                onClick={() => {
                  setSearchOpen(true);
                  window.setTimeout(() => searchInputRef.current?.focus(), 20);
                }}
              >
                <Icon icon={Search} />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="md"
                  aria-label={`Sort library: ${sortLabels[sortBy]}`}
                  className="px-3"
                >
                  <Icon icon={ArrowUpDown} />
                  <span className="hidden sm:inline text-xs">
                    {sortLabels[sortBy]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['recent', 'title', 'progress'] as SortOption[]).map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    onSelect={() => setSortBy(opt)}
                    className={sortBy === opt ? 'font-medium text-accent' : ''}
                  >
                    <span>Sort by {sortLabels[opt]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="accent"
              size="md"
              onClick={triggerFilePicker}
              className="px-3.5 sm:px-4"
            >
              <Icon icon={Upload} />
              <span>Import</span>
            </Button>
          </div>
        </div>
      </motion.header>

      {storageBlocked && (
        <div
          role="alert"
          className="mx-auto mt-4 max-w-6xl px-5"
        >
          <div className="rounded-[var(--radius-xs)] border border-state-error bg-[var(--state-error-bg)] px-4 py-3 text-sm text-ink">
            Browser storage is restricted (for example, private browsing mode). Imported documents may not persist after closing this tab.
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:py-8 pb-safe">
        {!liveData ? (
          <div className="py-16 text-center text-sm text-ink-3">Loading library…</div>
        ) : liveData.docs.length === 0 ? (
          <EmptyState onImportClick={triggerFilePicker} />
        ) : filteredAndSortedDocs.length === 0 && searchQuery.trim().length > 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-ink-2">
              No documents match &ldquo;{searchQuery}&rdquo;.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </Button>
          </div>
        ) : continueReadingCandidate && !searchQuery.trim() ? (
          /* Desktop: continue-reading takes 5 of 12 columns beside a 4-column grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-5">
              <ContinueReading
                doc={continueReadingCandidate.doc}
                progress={continueReadingCandidate.progress}
                onContinue={(id) => void handleOpenDocument(id)}
              />
            </div>
            <div className="lg:col-span-7">
              <CoverGrid
                documents={filteredAndSortedDocs}
                progressMap={liveData.progMap}
                onOpenDocument={(id) => void handleOpenDocument(id)}
                onRenameDocument={(id, t) => void handleRenameDocument(id, t)}
                onRemoveDocument={handleRemoveDocument}
                onRescanFigures={(doc) => {
                  toast(`Rescanning figures in "${doc.title}"…`);
                  void startOrResumeFigureDetection(doc.id, true);
                }}
                hasContinueReading
              />
            </div>
          </div>
        ) : (
          <CoverGrid
            documents={filteredAndSortedDocs}
            progressMap={liveData.progMap}
            onOpenDocument={(id) => void handleOpenDocument(id)}
            onRenameDocument={(id, t) => void handleRenameDocument(id, t)}
            onRemoveDocument={handleRemoveDocument}
            onRescanFigures={(doc) => {
              toast(`Rescanning figures in "${doc.title}"…`);
              void startOrResumeFigureDetection(doc.id, true);
            }}
          />
        )}
      </main>

      <ImportSheet
        file={selectedFile}
        open={importSheetOpen}
        onOpenChange={setImportSheetOpen}
        onOpenDocument={(id, mode) => void handleOpenDocument(id, mode)}
        onSelectAnotherFile={triggerFilePicker}
      />
    </div>
  );
}

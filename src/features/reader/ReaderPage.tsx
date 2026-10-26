import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { toast } from 'sonner';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  db,
  type BookmarkRecord,
  type FigureRecord,
  type HighlightColor,
  type HighlightRecord,
  type PageRecord,
  type ReaderMode,
} from '../../data/db';
import { useAppSettings } from '../../app/providers';
import { Sheet, useViewportTier } from '../../motion/Sheet';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { loadPdfDocument, destroyPdfDocument } from '../pdf/pdfClient';
import {
  resumeBackgroundExtraction,
  subscribeToExtractionProgress,
} from '../extract/extractionCoordinator';
import {
  startOrResumeFigureDetection,
  subscribeToFigureScanProgress,
  prioritizeFigureScanPage,
} from '../figures/cropFigure';
import { FiguresSheet } from '../figures/FiguresSheet';
import { Lightbox } from '../figures/Lightbox';
import { PagedReader } from '../paged/PagedReader';
import { ReadingSessionTracker } from '../tracking/sessionTracker';
import { CardMaker } from '../cards/CardMaker';
import { ambienceEngine } from '../ambience/engine';
import { AmbienceControl } from '../ambience/AmbienceControl';
import { ReadingSettingsSheet } from '../settings/ReadingSettingsSheet';
import { HighlightBar, type SelectionDraft } from '../notes/HighlightBar';
import { NotebookContent } from '../notes/NotebookPanel';
import { ComfortView } from './ComfortView';
import { OriginalView } from './OriginalView';
import { ReaderChrome, type ActiveReaderSheet } from './Chrome';
import { Button } from '../../ui/Primitives';
import { cn } from '../../lib/cn';

interface ReaderPageProps {
  docId: string;
}

export function ReaderPage({ docId }: ReaderPageProps) {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const tier = useViewportTier();
  const isDesktop = tier === 'desktop';
  const { settings, updateSettings } = useAppSettings();
  const { isReducedMotion } = useAppMotion();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDoneRef = useRef<boolean>(false);
  const jumpHandlerRef = useRef<((pageIndex: number) => void) | null>(null);
  const saveProgressTimeoutRef = useRef<number | null>(null);
  const sessionTrackerRef = useRef<ReadingSessionTracker | null>(null);
  const latestPositionRef = useRef<{
    pageIndex: number;
    blockIndex: number;
    fraction: number;
    mode: ReaderMode;
  }>({
    pageIndex: 0,
    blockIndex: 0,
    fraction: 0,
    mode: 'comfort',
  });

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [mode, setMode] = useState<ReaderMode>(() =>
    settings.readingFlow === 'paged' ? 'paged' : 'comfort'
  );
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [progressInitialized, setProgressInitialized] = useState(false);
  const [textSettled, setTextSettled] = useState(false);

  // Chrome & sheet states
  const [chromeVisible, setChromeVisible] = useState<boolean>(() => {
    try {
      const seen = sessionStorage.getItem('readflow_chrome_seen');
      if (!seen) {
        sessionStorage.setItem('readflow_chrome_seen', '1');
        return true;
      }
    } catch {
      // ignore
    }
    return isDesktop;
  });
  const [activeSheet, setActiveSheet] = useState<ActiveReaderSheet>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<HighlightRecord | null>(null);
  const [highlightAnchorRect, setHighlightAnchorRect] = useState<{
    top: number;
    left: number;
    width: number;
    bottom: number;
  } | null>(null);
  const [unplacedIds, setUnplacedIds] = useState<Set<string>>(new Set());
  const [pulseTarget, setPulseTarget] = useState<{
    type: 'page' | 'highlight';
    idOrPage: string | number;
  } | null>(null);
  const [extractingProgress, setExtractingProgress] = useState<{
    extracted: number;
    total: number;
  } | null>(null);
  const [figureScanProgress, setFigureScanProgress] = useState<{
    scanned: number;
    total: number;
  } | null>(null);
  const [activeLightboxFigure, setActiveLightboxFigure] = useState<FigureRecord | null>(null);
  const [addingRegion, setAddingRegion] = useState(false);

  // CardMaker modal state
  const [cardMakerDraft, setCardMakerDraft] = useState<{
    open: boolean;
    initialText: string;
    pageNumber: number | null;
    boldPhrases?: string[];
    headingTitle?: string;
    sourceHighlightId?: string | null;
  }>({
    open: false,
    initialText: '',
    pageNumber: null,
  });

  const [isAmbiencePlaying, setIsAmbiencePlaying] = useState(false);

  const progressScaleX = useMotionValue(0);

  // Query live document, pages, highlights, bookmarks, and figures from Dexie
  const liveData = useLiveQuery(async () => {
    const [doc, pages, highlights, bookmarks, figures] = await Promise.all([
      db.documents.get(docId),
      db.pages.where('docId').equals(docId).toArray(),
      db.highlights.where('docId').equals(docId).toArray(),
      db.bookmarks.where('docId').equals(docId).toArray(),
      db.figures.where('docId').equals(docId).toArray(),
    ]);
    const pagesMap = new Map<number, PageRecord>();
    for (const p of pages) {
      pagesMap.set(p.pageIndex, p);
    }
    const figuresByPage = new Map<number, FigureRecord[]>();
    for (const fig of figures) {
      const list = figuresByPage.get(fig.pageIndex) ?? [];
      list.push(fig);
      figuresByPage.set(fig.pageIndex, list);
    }
    return { doc, pagesMap, highlights, bookmarks, figures, figuresByPage };
  }, [docId]);

  // Load initial progress before first visible paint of reader content
  useEffect(() => {
    let active = true;
    initialScrollDoneRef.current = false;
    setProgressInitialized(false);
    setTextSettled(false);

    (async () => {
      const prog = await db.progress.get(docId);
      if (!active) return;
      if (prog) {
        setCurrentPageIndex(prog.pageIndex);
        setMode(prog.mode);
        latestPositionRef.current = {
          pageIndex: prog.pageIndex,
          blockIndex: prog.blockIndex,
          fraction: prog.fraction,
          mode: prog.mode,
        };
      }
      setProgressInitialized(true);
      window.setTimeout(
        () => {
          if (active) setTextSettled(true);
        },
        isReducedMotion ? 0 : 180
      );
    })();

    return () => {
      active = false;
    };
  }, [docId, isReducedMotion]);

  // Sync settings.readingFlow changes when currently in comfort/paged
  useEffect(() => {
    if (mode === 'original') return;
    if (settings.readingFlow === 'paged' && mode !== 'paged') {
      setMode('paged');
    } else if (settings.readingFlow === 'scroll' && mode === 'paged') {
      setMode('comfort');
    }
  }, [settings.readingFlow, mode]);

  // Start and manage ReadingSessionTracker
  useEffect(() => {
    const tracker = new ReadingSessionTracker(docId, currentPageIndex + 1, mode);
    sessionTrackerRef.current = tracker;
    tracker.start();

    const onVisOrFocus = () => {
      tracker.setVisibility(
        document.visibilityState === 'visible',
        document.hasFocus()
      );
    };
    const onUserInteract = () => {
      tracker.recordInteraction();
    };

    document.addEventListener('visibilitychange', onVisOrFocus);
    window.addEventListener('focus', onVisOrFocus);
    window.addEventListener('blur', onVisOrFocus);
    window.addEventListener('pointerdown', onUserInteract, { passive: true });
    window.addEventListener('keydown', onUserInteract, { passive: true });
    window.addEventListener('wheel', onUserInteract, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisOrFocus);
      window.removeEventListener('focus', onVisOrFocus);
      window.removeEventListener('blur', onVisOrFocus);
      window.removeEventListener('pointerdown', onUserInteract);
      window.removeEventListener('keydown', onUserInteract);
      window.removeEventListener('wheel', onUserInteract);
      void tracker.stop();
      sessionTrackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Parse pulse query params from /notes/:id or /cards jump
  useEffect(() => {
    if (!searchStr) return;
    const params = new URLSearchParams(searchStr);
    const pulseHl = params.get('pulseHighlight');
    const pulsePg = params.get('pulsePage');
    if (pulseHl) {
      setPulseTarget({ type: 'highlight', idOrPage: pulseHl });
      const t = window.setTimeout(() => setPulseTarget(null), 900);
      return () => window.clearTimeout(t);
    }
    if (pulsePg !== null) {
      const pIdx = Number(pulsePg);
      if (Number.isFinite(pIdx)) {
        setCurrentPageIndex(pIdx);
        latestPositionRef.current.pageIndex = pIdx;
        setPulseTarget({ type: 'page', idOrPage: pIdx });
        const t = window.setTimeout(() => setPulseTarget(null), 900);
        return () => window.clearTimeout(t);
      }
    }
  }, [searchStr]);

  // One PDFDocumentProxy per open reader; start text & figure extraction in background
  useEffect(() => {
    let active = true;
    const docHolder: { current: PDFDocumentProxy | null } = { current: null };

    (async () => {
      try {
        const fileRec = await db.files.get(docId);
        if (!active || !fileRec) return;
        const buf = await fileRec.blob.arrayBuffer();
        if (!active) return;
        const doc = await loadPdfDocument({ data: buf });
        if (!active) {
          await destroyPdfDocument(doc);
          return;
        }
        docHolder.current = doc;
        setPdfDoc(doc);
        await resumeBackgroundExtraction(docId);
        if (active) {
          void startOrResumeFigureDetection(docId, false);
        }
      } catch {
        // ignore
      }
    })();

    const unsubProgress = subscribeToExtractionProgress(docId, (extracted, total) => {
      if (active) {
        setExtractingProgress({ extracted, total });
      }
    });

    const unsubFigures = subscribeToFigureScanProgress(docId, (scanned, total) => {
      if (active) {
        setFigureScanProgress({ scanned, total });
      }
    });

    return () => {
      active = false;
      unsubProgress();
      unsubFigures();
      setPdfDoc(null);
      if (docHolder.current) {
        void destroyPdfDocument(docHolder.current);
        docHolder.current = null;
      }
    };
  }, [docId]);

  useEffect(() => {
    const unsub = ambienceEngine.subscribe((s) => setIsAmbiencePlaying(s.playing));
    return () => {
      unsub();
      ambienceEngine.pause();
    };
  }, []);

  const flushReadingProgress = useCallback(() => {
    const pos = latestPositionRef.current;
    void db.progress.put({
      docId,
      pageIndex: pos.pageIndex,
      blockIndex: pos.blockIndex,
      scrollOffset: scrollContainerRef.current?.scrollTop ?? 0,
      fraction: pos.fraction,
      mode: pos.mode,
      updatedAt: Date.now(),
    });
    void db.documents.update(docId, {
      lastPage: pos.pageIndex + 1,
      lastOpenedAt: Date.now(),
    });
  }, [docId]);

  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        flushReadingProgress();
      }
    };
    const onPageHide = () => {
      flushReadingProgress();
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('pagehide', onPageHide);
      if (saveProgressTimeoutRef.current) {
        window.clearTimeout(saveProgressTimeoutRef.current);
      }
      flushReadingProgress();
    };
  }, [flushReadingProgress]);

  useEffect(() => {
    if (!isDesktop) return;
    if (activeSheet !== null || selectionDraft !== null || activeHighlight !== null) {
      setChromeVisible(true);
      return;
    }

    let timerId = window.setTimeout(() => {
      setChromeVisible(false);
    }, 3000);

    const handlePointerMove = () => {
      setChromeVisible(true);
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setChromeVisible(false);
      }, 3000);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isDesktop, activeSheet, selectionDraft, activeHighlight]);

  const totalPages = liveData?.doc?.pageCount ?? 1;

  const handleActivePageChange = useCallback(
    (pageIndex: number, blockIndex: number, fraction: number) => {
      setCurrentPageIndex((prev) => (prev !== pageIndex ? pageIndex : prev));
      const scale = Math.max(0, Math.min(1, (pageIndex + fraction) / Math.max(1, totalPages)));
      progressScaleX.set(scale);

      const pageCharCount = liveData?.pagesMap.get(pageIndex)?.charCount ?? 1200;
      sessionTrackerRef.current?.onPageChange(pageIndex + 1, pageCharCount);
      prioritizeFigureScanPage(docId, pageIndex);

      latestPositionRef.current = {
        pageIndex,
        blockIndex,
        fraction,
        mode: latestPositionRef.current.mode,
      };

      if (!saveProgressTimeoutRef.current) {
        saveProgressTimeoutRef.current = window.setTimeout(() => {
          saveProgressTimeoutRef.current = null;
          flushReadingProgress();
        }, 1000);
      }
    },
    [totalPages, progressScaleX, flushReadingProgress, liveData?.pagesMap, docId]
  );

  useEffect(() => {
    const scale = Math.max(0, Math.min(1, (currentPageIndex + 0.1) / Math.max(1, totalPages)));
    progressScaleX.set(scale);
  }, [currentPageIndex, totalPages, progressScaleX]);

  const handleModeChange = useCallback(
    (nextMode: ReaderMode, targetPage?: number) => {
      const pageToKeep = typeof targetPage === 'number' ? targetPage : currentPageIndex;
      setSelectionDraft(null);
      setActiveHighlight(null);
      setAddingRegion(false);
      setCurrentPageIndex(pageToKeep);
      latestPositionRef.current.mode = nextMode;
      latestPositionRef.current.pageIndex = pageToKeep;
      initialScrollDoneRef.current = false;
      setMode(nextMode);
      sessionTrackerRef.current?.setMode(nextMode);
      if (nextMode === 'comfort' || nextMode === 'paged') {
        updateSettings({ readingFlow: nextMode === 'paged' ? 'paged' : 'scroll' });
      }
      flushReadingProgress();
    },
    [currentPageIndex, flushReadingProgress, updateSettings]
  );

  const jumpToPageInstant = useCallback(
    (targetPageIndex: number, pulse?: { type: 'page' | 'highlight'; idOrPage: string | number }) => {
      const clamped = Math.max(0, Math.min(totalPages - 1, targetPageIndex));
      setCurrentPageIndex(clamped);
      latestPositionRef.current.pageIndex = clamped;
      jumpHandlerRef.current?.(clamped);
      if (pulse) {
        setPulseTarget(pulse);
        window.setTimeout(() => setPulseTarget(null), 700);
      }
      flushReadingProgress();
    },
    [totalPages, flushReadingProgress]
  );

  const currentBookmark = useMemo(() => {
    return (
      liveData?.bookmarks.find(
        (b) => b.pageIndex === currentPageIndex && b.kind !== 'figure'
      ) ?? null
    );
  }, [liveData?.bookmarks, currentPageIndex]);

  const handleToggleBookmark = useCallback(async () => {
    if (currentBookmark) {
      await db.bookmarks.delete(currentBookmark.id);
      return;
    }

    const pageRec = liveData?.pagesMap.get(currentPageIndex);
    const firstBlock = pageRec?.blocks.find((b) => !b.isFurniture);
    const excerpt = firstBlock
      ? firstBlock.text.slice(0, 90) + (firstBlock.text.length > 90 ? '…' : '')
      : `Page ${currentPageIndex + 1}`;

    const bm: BookmarkRecord = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bm_${Date.now()}`,
      docId,
      pageIndex: currentPageIndex,
      mode,
      label: '',
      excerpt,
      createdAt: Date.now(),
      kind: 'page',
    };

    await db.bookmarks.put(bm);
    toast(`Bookmarked page ${currentPageIndex + 1}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          void db.bookmarks.delete(bm.id);
        },
      },
    });
  }, [currentBookmark, liveData?.pagesMap, currentPageIndex, docId, mode]);

  const handleCreateHighlight = useCallback(
    async (color: HighlightColor, note = '') => {
      if (!selectionDraft) return;
      const now = Date.now();
      const records: HighlightRecord[] = selectionDraft.segments.map((seg, i) => ({
        id: `hl_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        docId,
        pageIndex: seg.pageIndex,
        blockIndex: seg.blockIndex,
        start: seg.start,
        end: seg.end,
        quote: seg.quote,
        prefix: seg.prefix,
        suffix: seg.suffix,
        color,
        note: i === 0 ? note : '',
        createdAt: now + i,
      }));

      await db.highlights.bulkPut(records);
      window.getSelection()?.removeAllRanges();
      setSelectionDraft(null);
    },
    [selectionDraft, docId]
  );

  const handleUpdateHighlight = useCallback(
    async (id: string, partial: Partial<HighlightRecord>) => {
      await db.highlights.update(id, partial);
      setActiveHighlight((prev) => (prev && prev.id === id ? { ...prev, ...partial } : prev));
    },
    []
  );

  const handleDeleteHighlight = useCallback(async (hl: HighlightRecord) => {
    await db.highlights.delete(hl.id);
    setActiveHighlight(null);
    toast('Highlight deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          void db.highlights.put(hl);
        },
      },
    });
  }, []);

  const handleCopyText = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast('Copied to clipboard');
    window.getSelection()?.removeAllRanges();
    setSelectionDraft(null);
    setActiveHighlight(null);
  }, []);

  // Keyboard shortcuts on desktop: Esc close, b bookmark, m cycle mode, f figures, , settings, [ and ] font size
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        if (selectionDraft || activeHighlight) {
          setSelectionDraft(null);
          setActiveHighlight(null);
        } else if (addingRegion) {
          setAddingRegion(false);
        } else if (activeSheet) {
          setActiveSheet(null);
        }
      } else if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void handleToggleBookmark();
      } else if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const nextMode: ReaderMode =
          mode === 'comfort' ? 'paged' : mode === 'paged' ? 'original' : 'comfort';
        handleModeChange(nextMode);
      } else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveSheet((prev) => (prev === 'figures' ? null : 'figures'));
      } else if (e.key === ',' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveSheet((prev) => (prev === 'settings' ? null : 'settings'));
      } else if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) });
      } else if (e.key === ']' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        updateSettings({ fontSize: Math.min(28, settings.fontSize + 1) });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectionDraft,
    activeHighlight,
    addingRegion,
    activeSheet,
    handleToggleBookmark,
    handleModeChange,
    mode,
    updateSettings,
    settings.fontSize,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'paged') return; // PagedReader handles its own tap zones
    if (activeHighlight) {
      setActiveHighlight(null);
      return;
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }
    if (selectionDraft) {
      setSelectionDraft(null);
      return;
    }
    if (activeSheet || addingRegion) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, mark, [data-figure-inline]')) return;

    setChromeVisible((v) => !v);
  };

  if (liveData && !liveData.doc) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center space-y-4">
        <h1 className="font-display text-xl text-ink">Document not found</h1>
        <p className="text-sm text-ink-2">
          This PDF is no longer in your device library.
        </p>
        <Button variant="primary" onClick={() => setLocation('/')}>
          Back to library
        </Button>
      </div>
    );
  }

  const isDesktopPanelDocked =
    isDesktop &&
    (activeSheet === 'settings' ||
      activeSheet === 'notebook' ||
      activeSheet === 'figures');

  const figureCount = liveData?.figures.length ?? 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-bg text-ink">
      <ReaderChrome
        docId={docId}
        title={liveData?.doc?.title ?? 'Loading…'}
        hasCoverBlob={Boolean(liveData?.doc?.coverBlobId)}
        currentPage={currentPageIndex + 1}
        totalPages={totalPages}
        figureCount={figureCount}
        mode={mode}
        visible={
          chromeVisible ||
          activeSheet !== null ||
          selectionDraft !== null ||
          activeHighlight !== null
        }
        isDesktop={isDesktop}
        isBookmarked={Boolean(currentBookmark)}
        isAmbiencePlaying={isAmbiencePlaying}
        extractingProgress={extractingProgress}
        figureScanProgress={figureScanProgress}
        progressScaleX={progressScaleX}
        activeSheet={activeSheet}
        onBack={() => setLocation('/')}
        onModeChange={(m) => handleModeChange(m)}
        onScrubPage={(pageOneBased) => jumpToPageInstant(pageOneBased - 1)}
        onToggleSheet={(sheet) =>
          setActiveSheet((prev) => (prev === sheet ? null : sheet))
        }
        onToggleBookmark={() => void handleToggleBookmark()}
        onOpenCardMaker={() =>
          setCardMakerDraft({
            open: true,
            initialText: '',
            pageNumber: currentPageIndex + 1,
          })
        }
      />

      {/* Reading Canvas Wrapper */}
      <div
        ref={scrollContainerRef}
        onClick={handleCanvasClick}
        className={cn(
          'h-full w-full overscroll-y-contain transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)]',
          mode === 'paged' ? 'overflow-hidden' : 'overflow-y-auto',
          isDesktopPanelDocked && '-translate-x-[180px]'
        )}
      >
        {progressInitialized && liveData?.doc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: textSettled ? 1 : 0 }}
            transition={{ duration: MOTION_TOKENS.dur.fast }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mode === 'comfort' ? (
                <motion.div
                  key="comfort-mode"
                  initial={{ opacity: 0, y: isReducedMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: isReducedMotion ? 0 : -4 }}
                  transition={{
                    duration: MOTION_TOKENS.dur.base,
                    ease: MOTION_TOKENS.ease.out,
                  }}
                >
                  <ComfortView
                    docId={docId}
                    docTitle={liveData.doc.title}
                    fileName={liveData.doc.fileName}
                    pageCount={totalPages}
                    pagesMap={liveData.pagesMap}
                    figuresByPage={liveData.figuresByPage}
                    highlights={liveData.highlights}
                    settings={settings}
                    pdfDoc={pdfDoc}
                    scrollContainerRef={scrollContainerRef}
                    initialPageIndex={currentPageIndex}
                    initialScrollDoneRef={initialScrollDoneRef}
                    pulseTarget={pulseTarget}
                    onActivePageChange={handleActivePageChange}
                    onSwitchToOriginalPage={(pIdx) => handleModeChange('original', pIdx)}
                    onTextSelected={(draft) => {
                      setActiveHighlight(null);
                      setSelectionDraft(draft);
                    }}
                    onHighlightTapped={(hl, rect) => {
                      setSelectionDraft(null);
                      setActiveHighlight(hl);
                      setHighlightAnchorRect(rect);
                    }}
                    onSelectFigure={(fig) => setActiveLightboxFigure(fig)}
                    onMakeCardsFromSection={(sectionText, headingTitle, pageNum, bolds) => {
                      setCardMakerDraft({
                        open: true,
                        initialText: sectionText,
                        headingTitle,
                        pageNumber: pageNum,
                        boldPhrases: bolds,
                      });
                    }}
                    onUnplacedHighlightsChange={setUnplacedIds}
                    registerJumpHandler={(fn) => {
                      jumpHandlerRef.current = fn;
                    }}
                  />
                </motion.div>
              ) : mode === 'paged' ? (
                <motion.div
                  key="paged-mode"
                  initial={{ opacity: 0, y: isReducedMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: isReducedMotion ? 0 : -4 }}
                  transition={{
                    duration: MOTION_TOKENS.dur.base,
                    ease: MOTION_TOKENS.ease.out,
                  }}
                >
                  <PagedReader
                    docId={docId}
                    docTitle={liveData.doc.title}
                    pageCount={totalPages}
                    pagesMap={liveData.pagesMap}
                    figuresByPage={liveData.figuresByPage}
                    highlights={liveData.highlights}
                    settings={settings}
                    pdfDoc={pdfDoc}
                    initialPageIndex={currentPageIndex}
                    onActivePageChange={handleActivePageChange}
                    onSwitchToOriginalPage={(pIdx) => handleModeChange('original', pIdx)}
                    onTextSelected={(draft) => {
                      setActiveHighlight(null);
                      setSelectionDraft(draft);
                    }}
                    onHighlightTapped={(hl, rect) => {
                      setSelectionDraft(null);
                      setActiveHighlight(hl);
                      setHighlightAnchorRect(rect);
                    }}
                    onSelectFigure={(fig) => setActiveLightboxFigure(fig)}
                    onToggleChrome={() => setChromeVisible((v) => !v)}
                    onInteraction={() => sessionTrackerRef.current?.recordInteraction()}
                    registerJumpHandler={(fn) => {
                      jumpHandlerRef.current = fn;
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="original-mode"
                  initial={{ opacity: 0, y: isReducedMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: isReducedMotion ? 0 : -4 }}
                  transition={{
                    duration: MOTION_TOKENS.dur.base,
                    ease: MOTION_TOKENS.ease.out,
                  }}
                >
                  <OriginalView
                    docId={docId}
                    pdfDoc={pdfDoc}
                    pageCount={totalPages}
                    scrollContainerRef={scrollContainerRef}
                    initialPageIndex={currentPageIndex}
                    initialScrollDoneRef={initialScrollDoneRef}
                    pulsePageIndex={
                      pulseTarget?.type === 'page' ? Number(pulseTarget.idOrPage) : null
                    }
                    addingRegion={addingRegion}
                    onActivePageChange={(pIdx, frac) =>
                      handleActivePageChange(pIdx, 0, frac)
                    }
                    onStartAddRegion={() => setAddingRegion(true)}
                    onCancelAddRegion={() => setAddingRegion(false)}
                    onRegionCreated={(newFig) => {
                      setAddingRegion(false);
                      setActiveLightboxFigure(newFig);
                    }}
                    registerJumpHandler={(fn) => {
                      jumpHandlerRef.current = fn;
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Highlight Creation / Edit Action Bar (with 5th action: Card) */}
      <HighlightBar
        selection={selectionDraft}
        activeHighlight={activeHighlight}
        anchorRect={highlightAnchorRect}
        onCreateHighlight={(color, note) => void handleCreateHighlight(color, note)}
        onUpdateHighlight={(id, partial) => void handleUpdateHighlight(id, partial)}
        onDeleteHighlight={(hl) => void handleDeleteHighlight(hl)}
        onCopyText={handleCopyText}
        onMakeCard={(text, pageIdx, highlightId) => {
          const pageBlocks = liveData?.pagesMap.get(pageIdx)?.blocks ?? [];
          const bolds = pageBlocks.flatMap((b) => b.boldPhrases ?? []);
          window.getSelection()?.removeAllRanges();
          setSelectionDraft(null);
          setActiveHighlight(null);
          setCardMakerDraft({
            open: true,
            initialText: text,
            pageNumber: pageIdx + 1,
            boldPhrases: bolds,
            sourceHighlightId: highlightId ?? null,
          });
        }}
        onDismiss={() => {
          window.getSelection()?.removeAllRanges();
          setSelectionDraft(null);
          setActiveHighlight(null);
        }}
      />

      {/* Reading Settings Sheet / Docked Panel */}
      <ReadingSettingsSheet
        open={activeSheet === 'settings'}
        onOpenChange={(open) => setActiveSheet(open ? 'settings' : null)}
      />

      {/* Notebook Sheet / Docked Panel */}
      <Sheet
        open={activeSheet === 'notebook'}
        onOpenChange={(open) => setActiveSheet(open ? 'notebook' : null)}
        title="Notebook"
        description="Highlights, notes, bookmarks, and saved figures for this document"
        mode="docked-or-sheet"
      >
        {liveData && (
          <NotebookContent
            docId={docId}
            docTitle={liveData.doc?.title ?? 'Document'}
            currentMode={mode}
            highlights={liveData.highlights}
            bookmarks={liveData.bookmarks}
            figures={liveData.figures}
            unplacedIds={unplacedIds}
            onJumpToHighlight={(hl) => {
              if (!isDesktop) setActiveSheet(null);
              if (mode === 'original') {
                handleModeChange('comfort', hl.pageIndex);
                window.setTimeout(() => {
                  jumpToPageInstant(hl.pageIndex, {
                    type: 'highlight',
                    idOrPage: hl.id,
                  });
                }, 260);
              } else {
                jumpToPageInstant(hl.pageIndex, {
                  type: 'highlight',
                  idOrPage: hl.id,
                });
              }
            }}
            onUpdateHighlightNote={(id, note) =>
              void db.highlights.update(id, { note })
            }
            onDeleteHighlight={(hl) => void handleDeleteHighlight(hl)}
            onJumpToBookmark={(bm) => {
              if (!isDesktop) setActiveSheet(null);
              if (mode !== bm.mode) {
                handleModeChange(bm.mode, bm.pageIndex);
                window.setTimeout(() => {
                  jumpToPageInstant(bm.pageIndex, {
                    type: 'page',
                    idOrPage: bm.pageIndex,
                  });
                }, 260);
              } else {
                jumpToPageInstant(bm.pageIndex, {
                  type: 'page',
                  idOrPage: bm.pageIndex,
                });
              }
            }}
            onUpdateBookmarkLabel={(id, label) =>
              void db.bookmarks.update(id, { label })
            }
            onDeleteBookmark={(bm) => void db.bookmarks.delete(bm.id)}
            onMakeCardFromHighlight={(hl) => {
              setCardMakerDraft({
                open: true,
                initialText: hl.quote,
                pageNumber: hl.pageIndex + 1,
                sourceHighlightId: hl.id,
              });
            }}
            onSelectFigure={(fig) => setActiveLightboxFigure(fig)}
            onOpenFullScreenNotebook={() => {
              setActiveSheet(null);
              setLocation(`/notes/${docId}`);
            }}
          />
        )}
      </Sheet>

      {/* Figures Gallery Sheet / Docked Panel */}
      <FiguresSheet
        open={activeSheet === 'figures'}
        onOpenChange={(open) => setActiveSheet(open ? 'figures' : null)}
        figures={liveData?.figures ?? []}
        scanningProgress={figureScanProgress}
        onSelectFigure={(fig) => setActiveLightboxFigure(fig)}
        onRescan={() => {
          toast('Rescanning figures…');
          void startOrResumeFigureDetection(docId, true);
        }}
        onStartAddRegion={() => {
          setActiveSheet(null);
          if (mode !== 'original') {
            handleModeChange('original', currentPageIndex);
          }
          setAddingRegion(true);
        }}
      />

      {/* Full-Screen Figure Lightbox */}
      <Lightbox
        figure={activeLightboxFigure}
        allFigures={liveData?.figures ?? []}
        onClose={() => setActiveLightboxFigure(null)}
        onSelectFigure={(fig) => setActiveLightboxFigure(fig)}
        onGoToPage={(pIdx) => jumpToPageInstant(pIdx, { type: 'page', idOrPage: pIdx })}
      />

      {/* Flashcard Maker Modal */}
      <CardMaker
        open={cardMakerDraft.open}
        onClose={() => setCardMakerDraft((prev) => ({ ...prev, open: false }))}
        docId={docId}
        docTitle={liveData?.doc?.title ?? 'Document'}
        pageNumber={cardMakerDraft.pageNumber}
        initialText={cardMakerDraft.initialText}
        boldPhrases={cardMakerDraft.boldPhrases}
        headingTitle={cardMakerDraft.headingTitle}
        sourceHighlightId={cardMakerDraft.sourceHighlightId}
        onCreated={(count) => {
          toast(`Saved ${count} ${count === 1 ? 'card' : 'cards'} to deck`);
        }}
      />

      {/* Ambience Control Sheet */}
      <AmbienceControl
        open={activeSheet === 'ambience'}
        onOpenChange={(open) => setActiveSheet(open ? 'ambience' : null)}
      />
    </div>
  );
}

export default ReaderPage;

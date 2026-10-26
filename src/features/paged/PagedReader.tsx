import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, type PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  type ExtractedBlock,
  type FigureRecord,
  type HighlightRecord,
  type PageRecord,
  type ReadingSettings,
} from '../../data/db';
import { ensurePageExtractedOnDemand } from '../extract/extractionCoordinator';
import {
  resolveHighlightInPageBlocks,
  extractPrefixAndSuffix,
  type ResolvedHighlightSpan,
} from '../notes/anchoring';
import type { SelectionDraft } from '../notes/HighlightBar';
import {
  getHeadingFontCss,
  getReadingFontCss,
  isBlockDropCapEligible,
  resolveDropCapColorForTheme,
  splitLeadingInitialOrWord,
} from '../typography/styles';
import { FigureThumbImage } from '../figures/FiguresSheet';
import {
  computeCharacterAnchorFromColumn,
  resolveColumnIndexFromAnchor,
  resolveTapZoneAction,
  type PagedAnchorPosition,
} from './paginate';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

interface PagedReaderProps {
  docId: string;
  docTitle: string;
  pageCount: number;
  pagesMap: Map<number, PageRecord>;
  figuresByPage: Map<number, FigureRecord[]>;
  highlights: HighlightRecord[];
  settings: ReadingSettings;
  pdfDoc: PDFDocumentProxy | null;
  initialPageIndex: number;
  onActivePageChange: (pageIndex: number, blockIndex: number, fraction: number) => void;
  onSwitchToOriginalPage: (pageIndex: number) => void;
  onTextSelected: (draft: SelectionDraft | null) => void;
  onHighlightTapped: (
    highlight: HighlightRecord,
    rect: { top: number; left: number; width: number; bottom: number }
  ) => void;
  onSelectFigure: (fig: FigureRecord) => void;
  onToggleChrome: () => void;
  onInteraction?: () => void;
  registerJumpHandler: (fn: (pageIndex: number) => void) => void;
}

function renderTextWithHighlights(
  text: string,
  spans: ResolvedHighlightSpan[],
  onHighlightTapped: PagedReaderProps['onHighlightTapped']
): React.ReactNode {
  if (spans.length === 0) return text;
  const sorted = [...spans]
    .filter((s) => !s.unplaced && s.start >= 0 && s.end > s.start && s.end <= text.length)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue;
    if (span.start > cursor) nodes.push(text.slice(cursor, span.start));
    const hlText = text.slice(span.start, span.end);
    nodes.push(
      <mark
        key={span.highlight.id}
        data-highlight-id={span.highlight.id}
        data-color={span.highlight.color}
        tabIndex={0}
        role="button"
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          onHighlightTapped(span.highlight, {
            top: r.top,
            left: r.left,
            width: r.width,
            bottom: r.bottom,
          });
        }}
        className="hl-wash"
      >
        {hlText}
      </mark>
    );
    cursor = span.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/**
 * PagedReader (Section 5):
 * - Renders the current original page (and preloads neighbors in a 3-page sliding window)
 *   in a fixed-height CSS multi-column container (column-width = measure, column-gap = margin).
 * - Moves between columns by translating the strip with transform: translate3d.
 * - Supports three page-turn styles: Slide (default), Fade, and Flip (CSS 3D rotateY 0 -> -90deg over 320ms).
 * - Preserves (pageIndex, blockIndex, charOffset) anchor across font-size / typography changes.
 * - Shows "page X of Y in this section" locally and original folio globally ("p. 42 of 310").
 */
export function PagedReader({
  docId,
  pageCount,
  pagesMap,
  figuresByPage,
  highlights,
  settings,
  pdfDoc,
  initialPageIndex,
  onActivePageChange,
  onSwitchToOriginalPage,
  onTextSelected,
  onHighlightTapped,
  onSelectFigure,
  onToggleChrome,
  onInteraction,
  registerJumpHandler,
}: PagedReaderProps) {
  const { isReducedMotion, isLiteMode } = useAppMotion();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const [sourcePageIndex, setSourcePageIndex] = useState(initialPageIndex);
  const [columnIndex, setColumnIndex] = useState(0);
  const [totalColumns, setTotalColumns] = useState(1);
  const [viewportBox, setViewportBox] = useState({ width: 640, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [flipAnimating, setFlipAnimating] = useState<'next' | 'prev' | null>(null);
  const [fadeTransitioning, setFadeTransitioning] = useState(false);

  const anchorRef = useRef<PagedAnchorPosition>({
    pageIndex: initialPageIndex,
    blockIndex: 0,
    charOffset: 0,
  });

  // Preload 3-original-page sliding window (prev, current, next)
  useEffect(() => {
    const windowIndices = [
      sourcePageIndex,
      Math.max(0, sourcePageIndex - 1),
      Math.min(pageCount - 1, sourcePageIndex + 1),
    ];
    for (const idx of windowIndices) {
      if (!pagesMap.has(idx)) {
        void ensurePageExtractedOnDemand(docId, idx, pdfDoc);
      }
    }
  }, [sourcePageIndex, pageCount, pagesMap, docId, pdfDoc]);

  const currentPageRec = pagesMap.get(sourcePageIndex);
  const currentBlocks = useMemo(() => {
    if (!currentPageRec) return [];
    return currentPageRec.blocks.filter(
      (b) => !b.isFurniture || settings.showFurniture
    );
  }, [currentPageRec, settings.showFurniture]);

  // Measure fixed container dimensions
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportBox({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const columnGap = Math.max(16, settings.margins * 2);
  const columnWidth = Math.max(240, viewportBox.width);
  const stride = columnWidth + columnGap;

  // Measure total columns generated by CSS multi-column layout and restore saved anchor on typography change
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const raf = window.requestAnimationFrame(() => {
      const scrollW = strip.scrollWidth;
      const computedCols = Math.max(1, Math.round((scrollW + columnGap) / Math.max(1, stride)));
      setTotalColumns(computedCols);

      if (anchorRef.current.pageIndex === sourcePageIndex) {
        const restoredCol = resolveColumnIndexFromAnchor(
          currentBlocks,
          anchorRef.current,
          computedCols
        );
        setColumnIndex(Math.min(computedCols - 1, restoredCol));
      } else {
        setColumnIndex(0);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    currentBlocks,
    sourcePageIndex,
    viewportBox.width,
    viewportBox.height,
    settings.fontSize,
    settings.readingFont,
    settings.lineSpacing,
    settings.paragraphSpacing,
    settings.margins,
    settings.contentWidth,
    columnGap,
    stride,
  ]);

  // Register external jump handler (e.g. from scrubber or notebook)
  useEffect(() => {
    registerJumpHandler((targetPageIndex: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, targetPageIndex));
      anchorRef.current = { pageIndex: clamped, blockIndex: 0, charOffset: 0 };
      setSourcePageIndex(clamped);
      setColumnIndex(0);
    });
  }, [registerJumpHandler, pageCount]);

  // Update anchor & notify parent whenever sourcePageIndex or columnIndex changes
  useEffect(() => {
    const newAnchor = computeCharacterAnchorFromColumn(
      currentBlocks,
      columnIndex,
      totalColumns,
      sourcePageIndex
    );
    anchorRef.current = newAnchor;
    const frac = (columnIndex + 1) / Math.max(1, totalColumns);
    onActivePageChange(sourcePageIndex, newAnchor.blockIndex, frac);
  }, [sourcePageIndex, columnIndex, totalColumns, currentBlocks, onActivePageChange]);

  const effectiveTurnStyle =
    isReducedMotion || isLiteMode
      ? 'fade'
      : settings.pageTurn;

  const triggerTurnTransition = useCallback(
    (dir: 'next' | 'prev', applyState: () => void) => {
      onInteraction?.();
      if (effectiveTurnStyle === 'flip') {
        setFlipAnimating(dir);
        window.setTimeout(() => {
          applyState();
          setFlipAnimating(null);
        }, 320);
      } else if (effectiveTurnStyle === 'fade') {
        setFadeTransitioning(true);
        window.setTimeout(() => {
          applyState();
          setFadeTransitioning(false);
        }, isReducedMotion ? 100 : 140);
      } else {
        applyState();
      }
    },
    [effectiveTurnStyle, isReducedMotion, onInteraction]
  );

  const goNextPage = useCallback(() => {
    if (columnIndex < totalColumns - 1) {
      triggerTurnTransition('next', () => {
        setColumnIndex((c) => Math.min(totalColumns - 1, c + 1));
      });
    } else if (sourcePageIndex < pageCount - 1) {
      triggerTurnTransition('next', () => {
        const nextSrc = sourcePageIndex + 1;
        anchorRef.current = { pageIndex: nextSrc, blockIndex: 0, charOffset: 0 };
        setSourcePageIndex(nextSrc);
        setColumnIndex(0);
      });
    }
  }, [columnIndex, totalColumns, sourcePageIndex, pageCount, triggerTurnTransition]);

  const goPrevPage = useCallback(() => {
    if (columnIndex > 0) {
      triggerTurnTransition('prev', () => {
        setColumnIndex((c) => Math.max(0, c - 1));
      });
    } else if (sourcePageIndex > 0) {
      triggerTurnTransition('prev', () => {
        const prevSrc = sourcePageIndex - 1;
        anchorRef.current = { pageIndex: prevSrc, blockIndex: 9999, charOffset: 9999 };
        setSourcePageIndex(prevSrc);
      });
    }
  }, [columnIndex, sourcePageIndex, triggerTurnTransition]);

  // Keyboard navigation: Right, Space, PageDown -> next; Left, PageUp -> prev; Home / End
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrevPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        anchorRef.current = { pageIndex: 0, blockIndex: 0, charOffset: 0 };
        setSourcePageIndex(0);
        setColumnIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = Math.max(0, pageCount - 1);
        anchorRef.current = { pageIndex: last, blockIndex: 0, charOffset: 0 };
        setSourcePageIndex(last);
        setColumnIndex(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNextPage, goPrevPage, pageCount]);

  // Resolve highlights on current source page
  const pageHighlightsMap = useMemo(() => {
    const map = new Map<number, ResolvedHighlightSpan[]>();
    if (!currentPageRec) return map;
    for (const hl of highlights) {
      if (hl.pageIndex !== sourcePageIndex) continue;
      const res = resolveHighlightInPageBlocks(
        hl,
        currentPageRec.blocks,
        settings.joinSplitWords
      );
      if (!res.unplaced) {
        const arr = map.get(res.blockIndex) ?? [];
        arr.push(res);
        map.set(res.blockIndex, arr);
      }
    }
    return map;
  }, [highlights, currentPageRec, sourcePageIndex, settings.joinSplitWords]);

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setIsDragging(false);
    const snapDist = columnWidth * MOTION_TOKENS.swipe.pageSnapDistanceRatio;
    const vel = info.velocity.x;
    if (info.offset.x < -snapDist || vel < -MOTION_TOKENS.swipe.pageSnapVelocityPxPerSec) {
      goNextPage();
    } else if (info.offset.x > snapDist || vel > MOTION_TOKENS.swipe.pageSnapVelocityPxPerSec) {
      goPrevPage();
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, a, mark, [data-figure-inline]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const action = resolveTapZoneAction(
      e.clientX - rect.left,
      rect.width,
      settings.tapZones
    );
    if (action === 'next') goNextPage();
    else if (action === 'prev') goPrevPage();
    else onToggleChrome();
  };

  // Handle text selection within current column page
  const handleSelectionEnd = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const rawQuote = sel.toString().trim();
    if (!rawQuote) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const strip = stripRef.current;
    if (!strip) return;

    const blockEls = Array.from(
      strip.querySelectorAll<HTMLElement>('[data-page-index][data-block-index]')
    ).filter((el) => sel.containsNode(el, true));

    if (blockEls.length === 0) return;

    const firstEl = blockEls[0];
    const blockIndex = Number(firstEl.getAttribute('data-block-index'));
    const blockText = firstEl.textContent ?? '';
    const idx = blockText.indexOf(rawQuote);
    const start = Math.max(0, idx);
    const end = Math.min(blockText.length, start + rawQuote.length);
    const { prefix, suffix } = extractPrefixAndSuffix(blockText, start, end);

    onTextSelected({
      segments: [
        {
          pageIndex: sourcePageIndex,
          blockIndex,
          start,
          end,
          quote: rawQuote,
          prefix,
          suffix,
        },
      ],
      fullText: rawQuote,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        bottom: rect.bottom,
      },
    });
  }, [sourcePageIndex, onTextSelected]);

  const dropCapColorHex = resolveDropCapColorForTheme(
    settings.dropCapColor,
    settings.theme
  ).hex;

  const readerVars = {
    '--read-font': getReadingFontCss(settings.readingFont ?? settings.fontFamily),
    '--read-heading-font': getHeadingFontCss(
      settings.headingFont,
      settings.readingFont ?? settings.fontFamily
    ),
    '--read-size': `${settings.fontSize}px`,
    '--read-lh': String(settings.lineSpacing),
    '--read-para': `${settings.paragraphSpacing}em`,
    '--read-margin': `${settings.margins}px`,
    '--read-measure': `${settings.contentWidth}ch`,
    '--dropcap-lines': String(settings.dropCapLines),
    '--dropcap-color': dropCapColorHex,
    '--dropcap-weight': String(settings.dropCapWeight),
  } as React.CSSProperties;

  const pageFigures = figuresByPage.get(sourcePageIndex) ?? [];
  const canGoPrev = columnIndex > 0 || sourcePageIndex > 0;
  const canGoNext = columnIndex < totalColumns - 1 || sourcePageIndex < pageCount - 1;

  return (
    <section
      aria-label={`Page ${columnIndex + 1} of ${totalColumns} in this section`}
      style={readerVars}
      onClick={handleContainerClick}
      onMouseUp={handleSelectionEnd}
      onTouchEnd={() => window.setTimeout(handleSelectionEnd, 60)}
      className="reader-canvas paged-perspective relative flex h-[100dvh] w-full flex-col justify-between pt-14 pb-20 select-text overflow-hidden"
      data-justify={settings.justify ? 'true' : 'false'}
      data-heading-style={settings.headingStyle}
      data-dropcap-mode={settings.dropCapMode}
      data-dropcap-lines={String(settings.dropCapLines)}
      data-dropcap-decoration={settings.dropCapDecoration}
      data-dropcap-scope={settings.dropCapScope}
    >
      {/* Polite live region announcing flips for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Page {columnIndex + 1} of {totalColumns} in this section, original page{' '}
        {sourcePageIndex + 1} of {pageCount}
      </div>

      {/* Top section folio bar */}
      <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 select-none">
        <span className="font-folio text-xs text-ink-3">
          p. {sourcePageIndex + 1} of {pageCount}
        </span>
        <span className="font-folio text-xs text-ink-3">
          page {columnIndex + 1} of {totalColumns} in this section
        </span>
      </div>

      {/* Fixed-height CSS multi-column viewport */}
      <div
        ref={viewportRef}
        className={cn(
          'relative flex-1 w-full overflow-hidden',
          flipAnimating === 'next' && 'paged-flip-outgoing -rotate-y-90 opacity-40',
          flipAnimating === 'prev' && 'paged-flip-outgoing rotate-y-60 opacity-40',
          fadeTransitioning && 'opacity-0 transition-opacity duration-[var(--dur-fast)]'
        )}
      >
        {!currentPageRec ? (
          <div className="space-y-3 py-6">
            <div className="folio-skeleton h-4 w-11/12 rounded-[var(--radius-xs)]" />
            <div className="folio-skeleton h-4 w-full rounded-[var(--radius-xs)]" />
            <div className="folio-skeleton h-4 w-10/12 rounded-[var(--radius-xs)]" />
          </div>
        ) : (
          <motion.div
            ref={stripRef}
            drag={effectiveTurnStyle === 'slide' ? 'x' : false}
            dragConstraints={{
              left: -columnIndex * stride,
              right: -columnIndex * stride,
            }}
            dragElastic={0.22}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            animate={{
              x: -columnIndex * stride,
            }}
            transition={
              effectiveTurnStyle === 'slide' && !isReducedMotion
                ? MOTION_TOKENS.spring.sheet
                : { duration: 0 }
            }
            style={{
              height: `${viewportBox.height}px`,
              columnWidth: `${columnWidth}px`,
              columnGap: `${columnGap}px`,
              columnFill: 'auto',
              willChange: isDragging ? 'transform' : 'auto',
            }}
            className="h-full"
          >
            {!currentPageRec.quality.reliable && (
              <p className="mb-3 font-sans text-xs text-ink-3 flex items-center gap-2">
                <span>This page may read better in the original.</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwitchToOriginalPage(sourcePageIndex);
                  }}
                  className="font-medium text-accent underline underline-offset-2"
                >
                  Switch
                </button>
              </p>
            )}

            {currentBlocks.map((block, idxInArr) => {
              const rawOrJoined = settings.joinSplitWords
                ? block.text
                : block.rawText ?? block.text;
              const spans = pageHighlightsMap.get(block.index) ?? [];
              const startsSection = isBlockDropCapEligible(
                currentBlocks,
                idxInArr,
                sourcePageIndex
              );

              let contentNode: React.ReactNode = renderTextWithHighlights(
                rawOrJoined,
                spans,
                onHighlightTapped
              );

              if (
                startsSection &&
                settings.dropCapMode === 'bold-first-word' &&
                spans.length === 0
              ) {
                const { firstWordToken, restAfterFirstWord } =
                  splitLeadingInitialOrWord(rawOrJoined);
                contentNode = (
                  <>
                    <strong
                      className="font-bold"
                      style={{ color: dropCapColorHex }}
                    >
                      {firstWordToken}
                    </strong>
                    {restAfterFirstWord}
                  </>
                );
              }

              if (block.type === 'heading-1') {
                return (
                  <h2
                    key={block.index}
                    data-page-index={sourcePageIndex}
                    data-block-index={block.index}
                    className="reader-heading-1"
                  >
                    {contentNode}
                  </h2>
                );
              }
              if (block.type === 'heading-2') {
                return (
                  <h3
                    key={block.index}
                    data-page-index={sourcePageIndex}
                    data-block-index={block.index}
                    className="reader-heading-2"
                  >
                    {contentNode}
                  </h3>
                );
              }

              return (
                <p
                  key={block.index}
                  data-page-index={sourcePageIndex}
                  data-block-index={block.index}
                  className={cn(
                    'reader-paragraph',
                    startsSection && 'starts-section',
                    rawOrJoined.length >= 80 && 'eligible-paragraph'
                  )}
                >
                  {contentNode}
                </p>
              );
            })}

            {/* Inline figures if enabled */}
            {settings.figuresInline === 'on' &&
              pageFigures.map((fig) => (
                <div
                  key={fig.id}
                  data-figure-inline="true"
                  className="my-3 break-inside-avoid rounded-[var(--radius-sm)] border border-line bg-surface/60 p-2.5"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFigure(fig);
                    }}
                    className="block w-full text-left"
                  >
                    <div className="max-h-[180px] overflow-hidden rounded-[var(--radius-xs)] bg-white flex justify-center">
                      <FigureThumbImage
                        blob={fig.thumbBlob}
                        alt={fig.caption || `Figure on page ${sourcePageIndex + 1}`}
                        className="max-h-[180px] w-auto object-contain"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs font-sans">
                      <span className="text-ink-2 line-clamp-1">
                        {fig.caption || `${fig.kind} · p. ${sourcePageIndex + 1}`}
                      </span>
                      <span className="text-[11px] font-medium text-accent shrink-0">
                        Tap to enlarge
                      </span>
                    </div>
                  </button>
                </div>
              ))}
          </motion.div>
        )}
      </div>

      {/* Explicit accessible Previous / Next buttons (keyboard & touch fallback for any gesture) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-2 flex items-center justify-between border-t border-line pt-2 select-none"
      >
        <button
          type="button"
          onClick={goPrevPage}
          disabled={!canGoPrev}
          aria-label="Previous page"
          className="btn-press inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Icon icon={ChevronLeft} />
          <span>Previous</span>
        </button>

        <span className="font-folio text-xs text-ink-3">
          {columnIndex + 1} / {totalColumns}
        </span>

        <button
          type="button"
          onClick={goNextPage}
          disabled={!canGoNext}
          aria-label="Next page"
          className="btn-press inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <span>Next</span>
          <Icon icon={ChevronRight} />
        </button>
      </div>
    </section>
  );
}

export default PagedReader;

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Layers } from 'lucide-react';
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
import { OpeningSequence } from '../opening/OpeningSequence';
import { useOpeningPlayed } from '../opening/useOpeningPlayed';
import { FigureThumbImage } from '../figures/FiguresSheet';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

interface ComfortViewProps {
  docId: string;
  docTitle: string;
  fileName: string;
  pageCount: number;
  pagesMap: Map<number, PageRecord>;
  figuresByPage: Map<number, FigureRecord[]>;
  highlights: HighlightRecord[];
  settings: ReadingSettings;
  pdfDoc: PDFDocumentProxy | null;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  initialPageIndex: number;
  initialScrollDoneRef: React.MutableRefObject<boolean>;
  pulseTarget: { type: 'page' | 'highlight'; idOrPage: string | number } | null;
  onActivePageChange: (pageIndex: number, blockIndex: number, fraction: number) => void;
  onSwitchToOriginalPage: (pageIndex: number) => void;
  onTextSelected: (draft: SelectionDraft | null) => void;
  onHighlightTapped: (
    highlight: HighlightRecord,
    rect: { top: number; left: number; width: number; bottom: number }
  ) => void;
  onSelectFigure: (fig: FigureRecord) => void;
  onMakeCardsFromSection?: (
    sectionText: string,
    headingTitle: string,
    pageNumber: number,
    boldPhrases: string[]
  ) => void;
  onUnplacedHighlightsChange?: (unplacedIds: Set<string>) => void;
  registerJumpHandler: (fn: (pageIndex: number) => void) => void;
}

/**
 * Renders a single block's text with any resolved highlight spans wrapped in <mark class="hl-wash">
 */
function renderBlockWithHighlights(
  text: string,
  spans: ResolvedHighlightSpan[],
  pulseHighlightId: string | number | null,
  onHighlightTapped: ComfortViewProps['onHighlightTapped']
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
    if (span.start > cursor) {
      nodes.push(text.slice(cursor, span.start));
    }
    const hlText = text.slice(span.start, span.end);
    const isPulsing = pulseHighlightId === span.highlight.id;

    nodes.push(
      <mark
        key={span.highlight.id}
        data-highlight-id={span.highlight.id}
        data-color={span.highlight.color}
        tabIndex={0}
        role="button"
        aria-label={`${span.highlight.color} highlight: ${hlText}`}
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onHighlightTapped(span.highlight, {
              top: r.top,
              left: r.left,
              width: r.width,
              bottom: r.bottom,
            });
          }
        }}
        className={cn('hl-wash', isPulsing && 'passage-pulse')}
      >
        {hlText}
      </mark>
    );
    cursor = span.end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function ComfortView({
  docId,
  docTitle,
  fileName,
  pageCount,
  pagesMap,
  figuresByPage,
  highlights,
  settings,
  pdfDoc,
  scrollContainerRef,
  initialPageIndex,
  initialScrollDoneRef,
  pulseTarget,
  onActivePageChange,
  onSwitchToOriginalPage,
  onTextSelected,
  onHighlightTapped,
  onSelectFigure,
  onMakeCardsFromSection,
  onUnplacedHighlightsChange,
  registerJumpHandler,
}: ComfortViewProps) {
  const requestingPagesRef = useRef<Set<number>>(new Set());
  const { shouldPlayOpening, markOpeningPlayed } = useOpeningPlayed(
    docId,
    settings.openingAnimation
  );

  // Resolve highlights per page & track unplaced ones
  const { highlightsByPage, unplacedSet } = useMemo(() => {
    const byPage = new Map<number, Map<number, ResolvedHighlightSpan[]>>();
    const unplaced = new Set<string>();

    for (const hl of highlights) {
      const pageRec = pagesMap.get(hl.pageIndex);
      if (!pageRec) continue;
      const resolved = resolveHighlightInPageBlocks(
        hl,
        pageRec.blocks,
        settings.joinSplitWords
      );
      if (resolved.unplaced) {
        unplaced.add(hl.id);
      } else {
        let blockMap = byPage.get(hl.pageIndex);
        if (!blockMap) {
          blockMap = new Map();
          byPage.set(hl.pageIndex, blockMap);
        }
        const arr = blockMap.get(resolved.blockIndex) ?? [];
        arr.push(resolved);
        blockMap.set(resolved.blockIndex, arr);
      }
    }

    return { highlightsByPage: byPage, unplacedSet: unplaced };
  }, [highlights, pagesMap, settings.joinSplitWords]);

  useEffect(() => {
    onUnplacedHighlightsChange?.(unplacedSet);
  }, [unplacedSet, onUnplacedHighlightsChange]);

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 640,
    overscan: 3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Register instant jump handler
  useEffect(() => {
    registerJumpHandler((targetPageIndex: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, targetPageIndex));
      virtualizer.scrollToIndex(clamped, { align: 'start' });
    });
  }, [registerJumpHandler, virtualizer, pageCount]);

  // Restore initial scroll position before first visible paint
  useEffect(() => {
    if (!initialScrollDoneRef.current && pageCount > 0) {
      initialScrollDoneRef.current = true;
      if (initialPageIndex > 0) {
        virtualizer.scrollToIndex(initialPageIndex, { align: 'start' });
      }
    }
  }, [initialPageIndex, pageCount, virtualizer, initialScrollDoneRef]);

  // Request on-demand extraction for any visible unextracted page
  useEffect(() => {
    for (const item of virtualItems) {
      const pIdx = item.index;
      if (!pagesMap.has(pIdx) && !requestingPagesRef.current.has(pIdx)) {
        requestingPagesRef.current.add(pIdx);
        void ensurePageExtractedOnDemand(docId, pIdx, pdfDoc).finally(() => {
          requestingPagesRef.current.delete(pIdx);
        });
      }
    }
  }, [virtualItems, pagesMap, docId, pdfDoc]);

  // Track active page from scroll position passively
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollTop = el.scrollTop;
      const viewportMid = scrollTop + el.clientHeight * 0.3;
      const items = virtualizer.getVirtualItems();
      if (items.length === 0) return;

      let activeItem = items[0];
      for (const it of items) {
        if (it.start <= viewportMid) {
          activeItem = it;
        } else {
          break;
        }
      }

      const pageFraction =
        activeItem.size > 0
          ? Math.max(0, Math.min(1, (viewportMid - activeItem.start) / activeItem.size))
          : 0;
      onActivePageChange(activeItem.index, 0, pageFraction);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, virtualizer, onActivePageChange]);

  // Handle text selection inside ComfortView
  const handleSelectionEnd = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }
    const rawQuote = sel.toString().trim();
    if (!rawQuote) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const blockEls = Array.from(
      container.querySelectorAll<HTMLElement>('[data-page-index][data-block-index]')
    ).filter((el) => sel.containsNode(el, true));

    if (blockEls.length === 0) return;

    const segments: SelectionDraft['segments'] = [];

    for (const blockEl of blockEls) {
      const pageIndex = Number(blockEl.getAttribute('data-page-index'));
      const blockIndex = Number(blockEl.getAttribute('data-block-index'));
      const blockText = blockEl.textContent ?? '';
      if (!blockText) continue;

      const blockRange = document.createRange();
      blockRange.selectNodeContents(blockEl);

      if (range.compareBoundaryPoints(Range.START_TO_START, blockRange) > 0) {
        blockRange.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, blockRange) < 0) {
        blockRange.setEnd(range.endContainer, range.endOffset);
      }

      const segQuote = blockRange.toString().trim();
      if (!segQuote) continue;

      const preRange = document.createRange();
      preRange.selectNodeContents(blockEl);
      preRange.setEnd(blockRange.startContainer, blockRange.startOffset);
      const rawStart = preRange.toString().length;
      const trimLead = blockRange.toString().indexOf(segQuote);
      const start = Math.max(0, rawStart + Math.max(0, trimLead));
      const end = Math.min(blockText.length, start + segQuote.length);

      const { prefix, suffix } = extractPrefixAndSuffix(blockText, start, end);
      segments.push({
        pageIndex,
        blockIndex,
        start,
        end,
        quote: segQuote,
        prefix,
        suffix,
      });
    }

    if (segments.length > 0) {
      onTextSelected({
        segments,
        fullText: rawQuote,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          bottom: rect.bottom,
        },
      });
    }
  }, [scrollContainerRef, onTextSelected]);

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

  return (
    <article
      aria-label="Comfort reading view"
      data-justify={settings.justify ? 'true' : 'false'}
      data-heading-style={settings.headingStyle}
      data-dropcap-mode={settings.dropCapMode}
      data-dropcap-lines={String(settings.dropCapLines)}
      data-dropcap-decoration={settings.dropCapDecoration}
      data-dropcap-scope={settings.dropCapScope}
      style={readerVars}
      onMouseUp={handleSelectionEnd}
      onTouchEnd={() => {
        window.setTimeout(handleSelectionEnd, 60);
      }}
      className="reader-canvas relative w-full pt-12 pb-28"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const pageIndex = virtualRow.index;
          const pageRec = pagesMap.get(pageIndex);
          const pageHighlights = highlightsByPage.get(pageIndex);
          const pageFigures = figuresByPage.get(pageIndex) ?? [];
          const isPagePulsing =
            pulseTarget?.type === 'page' && pulseTarget.idOrPage === pageIndex;

          const visibleBlocks = pageRec
            ? pageRec.blocks.filter((b) => !b.isFurniture || settings.showFurniture)
            : [];

          return (
            <div
              key={virtualRow.key}
              data-index={pageIndex}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-6"
            >
              {/* Page 1 Opening Sequence */}
              {pageIndex === 0 && (
                <OpeningSequence
                  title={docTitle}
                  fileName={fileName}
                  pageCount={pageCount}
                  mode={settings.openingAnimation}
                  shouldAnimate={shouldPlayOpening}
                  onSkipOrComplete={markOpeningPlayed}
                />
              )}

              {/* Original page boundary hairline + marginal serif folio ("42") */}
              <div
                className={cn(
                  'mb-5 flex items-baseline justify-between border-t border-line pt-2 select-none',
                  isPagePulsing && 'passage-pulse'
                )}
              >
                <span
                  aria-label={`Page ${pageIndex + 1}`}
                  className="font-folio text-xs text-ink-3"
                >
                  {pageIndex + 1}
                </span>

                {pageRec && !pageRec.quality.reliable && (
                  <p className="font-sans text-xs text-ink-3 flex items-center gap-2">
                    <span>This page may read better in the original.</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwitchToOriginalPage(pageIndex);
                      }}
                      className="font-medium text-accent underline underline-offset-2 hover:opacity-85"
                    >
                      Switch
                    </button>
                  </p>
                )}
              </div>

              {!pageRec ? (
                <div
                  aria-label={`Extracting page ${pageIndex + 1}`}
                  className="space-y-3 py-4"
                >
                  <div className="folio-skeleton h-4 w-11/12 rounded-[var(--radius-xs)]" />
                  <div className="folio-skeleton h-4 w-full rounded-[var(--radius-xs)]" />
                  <div className="folio-skeleton h-4 w-10/12 rounded-[var(--radius-xs)]" />
                  <div className="folio-skeleton h-4 w-9/12 rounded-[var(--radius-xs)]" />
                  <div className="pt-3 folio-skeleton h-4 w-full rounded-[var(--radius-xs)]" />
                  <div className="folio-skeleton h-4 w-5/6 rounded-[var(--radius-xs)]" />
                </div>
              ) : visibleBlocks.length === 0 && pageFigures.length === 0 ? (
                <div className="py-6 text-xs text-ink-3 font-sans">
                  No text on page {pageIndex + 1}.{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchToOriginalPage(pageIndex)}
                    className="font-medium text-accent underline underline-offset-2"
                  >
                    View original page
                  </button>
                </div>
              ) : (
                <div>
                  {visibleBlocks.map((block: ExtractedBlock, idxInArr: number) => {
                    const blockText = settings.joinSplitWords
                      ? block.text
                      : block.rawText ?? block.text;
                    const blockSpans = pageHighlights?.get(block.index) ?? [];
                    const pulseHighlightId =
                      pulseTarget?.type === 'highlight' ? pulseTarget.idOrPage : null;

                    const startsSection = isBlockDropCapEligible(
                      visibleBlocks,
                      idxInArr,
                      pageIndex
                    );

                    let renderedContent: React.ReactNode = renderBlockWithHighlights(
                      blockText,
                      blockSpans,
                      pulseHighlightId,
                      onHighlightTapped
                    );

                    // Bold first word mode wraps first word in <strong> when no highlight spans conflict
                    if (
                      startsSection &&
                      settings.dropCapMode === 'bold-first-word' &&
                      blockSpans.length === 0
                    ) {
                      const { firstWordToken, restAfterFirstWord } =
                        splitLeadingInitialOrWord(blockText);
                      renderedContent = (
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

                    if (block.isFurniture) {
                      return (
                        <p
                          key={block.index}
                          data-page-index={pageIndex}
                          data-block-index={block.index}
                          className="reader-furniture"
                        >
                          {renderedContent}
                        </p>
                      );
                    }

                    if (block.type === 'heading-1' || block.type === 'heading-2') {
                      const HeadingTag = block.type === 'heading-1' ? 'h2' : 'h3';
                      const headingClass =
                        block.type === 'heading-1'
                          ? 'reader-heading-1'
                          : 'reader-heading-2';

                      return (
                        <div
                          key={block.index}
                          className="group relative flex items-baseline justify-between gap-2"
                        >
                          <HeadingTag
                            data-page-index={pageIndex}
                            data-block-index={block.index}
                            className={cn(headingClass, 'flex-1')}
                          >
                            {renderedContent}
                          </HeadingTag>

                          {onMakeCardsFromSection && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const sectionBlocks = visibleBlocks.slice(
                                  idxInArr + 1,
                                  idxInArr + 6
                                );
                                const sectionText = sectionBlocks
                                  .map((b) => b.text)
                                  .join('\n\n');
                                const bolds = sectionBlocks.flatMap(
                                  (b) => b.boldPhrases ?? []
                                );
                                onMakeCardsFromSection(
                                  sectionText || blockText,
                                  blockText,
                                  pageIndex + 1,
                                  bolds
                                );
                              }}
                              aria-label={`Make flashcards from ${blockText}`}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-flex items-center gap-1 rounded-[var(--radius-xs)] border border-line bg-surface px-2 py-0.5 text-[11px] font-sans text-ink-2 hover:text-ink shrink-0"
                            >
                              <Icon icon={Layers} className="h-3 w-3" />
                              <span>Make cards</span>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <p
                        key={block.index}
                        data-page-index={pageIndex}
                        data-block-index={block.index}
                        className={cn(
                          'reader-paragraph',
                          startsSection && 'starts-section',
                          blockText.length >= 80 && 'eligible-paragraph'
                        )}
                      >
                        {renderedContent}
                      </p>
                    );
                  })}

                  {/* Inline Figures in Comfort Mode */}
                  {settings.figuresInline === 'on' &&
                    pageFigures.map((fig) => (
                      <figure
                        key={fig.id}
                        data-figure-inline="true"
                        className="my-5 rounded-[var(--radius-sm)] border border-line bg-surface/60 p-3"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFigure(fig);
                          }}
                          className="block w-full text-left group"
                        >
                          <div className="max-h-[300px] overflow-hidden rounded-[var(--radius-xs)] bg-white flex justify-center p-2">
                            <FigureThumbImage
                              blob={fig.thumbBlob}
                              alt={fig.caption || `${fig.kind} on page ${pageIndex + 1}`}
                              className="max-h-[280px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                            />
                          </div>
                          <figcaption className="mt-2 flex items-center justify-between gap-3 font-sans text-xs">
                            <span className="text-ink-2 line-clamp-2">
                              {fig.caption || `${fig.kind} · Page ${pageIndex + 1}`}
                            </span>
                            <span className="text-[11px] font-medium text-accent shrink-0">
                              Tap to enlarge
                            </span>
                          </figcaption>
                        </button>
                      </figure>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

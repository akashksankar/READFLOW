import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ZoomIn, ZoomOut, RotateCcw, PlusSquare } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { FigureRecord } from '../../data/db';
import { AddRegionOverlay } from '../figures/AddRegion';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

interface OriginalViewProps {
  docId: string;
  pdfDoc: PDFDocumentProxy | null;
  pageCount: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  initialPageIndex: number;
  initialScrollDoneRef: React.MutableRefObject<boolean>;
  pulsePageIndex: number | null;
  addingRegion: boolean;
  onActivePageChange: (pageIndex: number, fraction: number) => void;
  onStartAddRegion: () => void;
  onCancelAddRegion: () => void;
  onRegionCreated: (fig: FigureRecord) => void;
  registerJumpHandler: (fn: (pageIndex: number) => void) => void;
}

/**
 * Single on-demand PDF Canvas Page:
 * - Renders only when mounted within the virtualizer's ~1-viewport window
 * - Caps devicePixelRatio at 2
 * - Cancels active RenderTask and zeros canvas dimensions + calls page.cleanup() on unmount
 * - Hosts AddRegionOverlay when the user is capturing a custom figure region on this page.
 */
function PdfCanvasPage({
  docId,
  pdfDoc,
  pageIndex,
  baseWidth,
  zoom,
  isPulsing,
  showAddRegion,
  onRegionCreated,
  onCancelAddRegion,
}: {
  docId: string;
  pdfDoc: PDFDocumentProxy;
  pageIndex: number;
  baseWidth: number;
  zoom: number;
  isPulsing: boolean;
  showAddRegion: boolean;
  onRegionCreated: (fig: FigureRecord) => void;
  onCancelAddRegion: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1.414);

  useEffect(() => {
    let active = true;
    let renderTask: RenderTask | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let loadedPage: any = null;
    const canvasEl = canvasRef.current;

    (async () => {
      try {
        loadedPage = await pdfDoc.getPage(pageIndex + 1);
        if (!active || !canvasEl) return;

        const unscaledVp = loadedPage.getViewport({ scale: 1 });
        if (unscaledVp.width > 0 && unscaledVp.height > 0) {
          setAspectRatio(unscaledVp.height / unscaledVp.width);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssWidth = Math.max(280, baseWidth * zoom);
        const scale = (cssWidth / Math.max(1, unscaledVp.width)) * dpr;
        const viewport = loadedPage.getViewport({ scale });

        canvasEl.width = Math.round(viewport.width);
        canvasEl.height = Math.round(viewport.height);
        canvasEl.style.width = `${Math.round(cssWidth)}px`;
        canvasEl.style.height = `${Math.round(cssWidth * (unscaledVp.height / unscaledVp.width))}px`;

        const ctx = canvasEl.getContext('2d', { alpha: false });
        if (!ctx) return;

        const task: RenderTask = loadedPage.render({
          canvasContext: ctx,
          viewport,
          canvas: canvasEl,
        });
        renderTask = task;
        await task.promise;
      } catch {
        // RenderCancelledException or unmount
      }
    })();

    return () => {
      active = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
      if (canvasEl) {
        canvasEl.width = 0;
        canvasEl.height = 0;
      }
      if (loadedPage) {
        try {
          loadedPage.cleanup();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageIndex, baseWidth, zoom]);

  const displayWidth = Math.max(280, Math.round(baseWidth * zoom));
  const displayHeight = Math.round(displayWidth * aspectRatio);

  return (
    <div
      className={cn(
        'mx-auto flex flex-col items-center py-3',
        isPulsing && 'passage-pulse'
      )}
    >
      <div
        className="mb-1.5 flex w-full max-w-full items-center justify-between px-1"
        style={{ width: `${displayWidth}px` }}
      >
        <span className="font-folio text-xs text-ink-3">Page {pageIndex + 1}</span>
      </div>
      <div
        className="relative overflow-hidden rounded-[var(--radius-xs)] border border-line bg-white shadow-[var(--shadow-1)]"
        style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
      >
        <canvas ref={canvasRef} className="block" />
        {showAddRegion && (
          <AddRegionOverlay
            docId={docId}
            pageIndex={pageIndex}
            pdfDoc={pdfDoc}
            onComplete={onRegionCreated}
            onCancel={onCancelAddRegion}
          />
        )}
      </div>
    </div>
  );
}

export function OriginalView({
  docId,
  pdfDoc,
  pageCount,
  scrollContainerRef,
  initialPageIndex,
  initialScrollDoneRef,
  pulsePageIndex,
  addingRegion,
  onActivePageChange,
  onStartAddRegion,
  onCancelAddRegion,
  onRegionCreated,
  registerJumpHandler,
}: OriginalViewProps) {
  const [zoom, setZoom] = useState(1);
  const [gestureScale, setGestureScale] = useState(1);
  const [activeVisiblePage, setActiveVisiblePage] = useState(initialPageIndex);
  const [baseWidth, setBaseWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.min(760, window.innerWidth - 32) : 640
  );

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const zoomStartRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setBaseWidth(Math.min(780, Math.max(280, w - 32)));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollContainerRef]);

  const estimatedPageHeight = Math.round(baseWidth * zoom * 1.414) + 44;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedPageHeight,
    overscan: 1,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [zoom, baseWidth, virtualizer]);

  useEffect(() => {
    registerJumpHandler((targetPageIndex: number) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, targetPageIndex));
      setActiveVisiblePage(clamped);
      virtualizer.scrollToIndex(clamped, { align: 'start' });
    });
  }, [registerJumpHandler, virtualizer, pageCount]);

  useEffect(() => {
    if (!initialScrollDoneRef.current && pageCount > 0) {
      initialScrollDoneRef.current = true;
      if (initialPageIndex > 0) {
        setActiveVisiblePage(initialPageIndex);
        virtualizer.scrollToIndex(initialPageIndex, { align: 'start' });
      }
    }
  }, [initialPageIndex, pageCount, virtualizer, initialScrollDoneRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const viewportMid = el.scrollTop + el.clientHeight * 0.35;
      const items = virtualizer.getVirtualItems();
      if (items.length === 0) return;

      let active = items[0];
      for (const it of items) {
        if (it.start <= viewportMid) active = it;
        else break;
      }
      const frac =
        active.size > 0
          ? Math.max(0, Math.min(1, (viewportMid - active.start) / active.size))
          : 0;
      setActiveVisiblePage(active.index);
      onActivePageChange(active.index, frac);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef, virtualizer, onActivePageChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (addingRegion) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        initialPinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        zoomStartRef.current = zoom;
      } else if (pointersRef.current.size === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
          setZoom((prev) => (prev > 1.05 ? 1 : 2));
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }
    },
    [zoom, addingRegion]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (addingRegion) return;
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && initialPinchDistRef.current) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const ratio = dist / Math.max(10, initialPinchDistRef.current);
        const nextZoom = Math.max(1, Math.min(4, zoomStartRef.current * ratio));
        setGestureScale(nextZoom / zoomStartRef.current);
      }
    },
    [addingRegion]
  );

  const handlePointerUpOrCancel = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2 && initialPinchDistRef.current !== null) {
        const committed = Math.max(
          1,
          Math.min(4, Number((zoomStartRef.current * gestureScale).toFixed(2)))
        );
        initialPinchDistRef.current = null;
        setGestureScale(1);
        setZoom(committed);
      }
    },
    [gestureScale]
  );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <article
      aria-label="Original PDF view"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      className="relative w-full pt-12 pb-28 overflow-x-auto"
    >
      {/* Touch alternative +/- zoom controls + Add Region safety net button */}
      <div
        role="group"
        aria-label="PDF zoom and figure region controls"
        onClick={(e) => e.stopPropagation()}
        className="fixed right-4 bottom-24 z-30 flex items-center gap-1 rounded-[var(--radius-sm)] border border-line bg-surface p-1 shadow-[var(--shadow-2)]"
      >
        <button
          type="button"
          aria-label="Add figure region on this page"
          title="Capture a figure region on this page"
          onClick={() => (addingRegion ? onCancelAddRegion() : onStartAddRegion())}
          className={cn(
            'btn-press inline-flex h-[38px] items-center gap-1 rounded-[var(--radius-xs)] px-2.5 text-xs font-medium',
            addingRegion ? 'bg-accent text-white' : 'text-ink hover:bg-bg'
          )}
        >
          <Icon icon={PlusSquare} className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add region</span>
        </button>

        <div className="h-5 w-[1px] bg-line" aria-hidden="true" />

        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
          className="btn-press inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-xs)] text-ink disabled:opacity-45"
        >
          <Icon icon={ZoomOut} />
        </button>
        <span className="font-folio px-1.5 text-xs text-ink-2">
          {Math.round(zoom * gestureScale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= 4}
          onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
          className="btn-press inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-xs)] text-ink disabled:opacity-45"
        >
          <Icon icon={ZoomIn} />
        </button>
        {zoom > 1 && (
          <button
            type="button"
            aria-label="Reset zoom to 100%"
            onClick={() => setZoom(1)}
            className="btn-press inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-xs)] text-ink-2 hover:text-ink"
          >
            <Icon icon={RotateCcw} />
          </button>
        )}
      </div>

      {!pdfDoc ? (
        <div className="py-20 text-center text-sm text-ink-3">Loading original PDF…</div>
      ) : (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: zoom > 1 ? `${Math.round(baseWidth * zoom + 32)}px` : '100%',
            position: 'relative',
            transform: gestureScale !== 1 ? `scale(${gestureScale})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const pageIndex = virtualRow.index;
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
              >
                <PdfCanvasPage
                  docId={docId}
                  pdfDoc={pdfDoc}
                  pageIndex={pageIndex}
                  baseWidth={baseWidth}
                  zoom={zoom}
                  isPulsing={pulsePageIndex === pageIndex}
                  showAddRegion={addingRegion && pageIndex === activeVisiblePage}
                  onRegionCreated={onRegionCreated}
                  onCancelAddRegion={onCancelAddRegion}
                />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

import React, { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { db, type FigureBBox, type FigureRecord } from '../../data/db';
import { renderAndCropPageFigures } from './cropFigure';
import { Button } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';

interface AddRegionOverlayProps {
  docId: string;
  pageIndex: number;
  pdfDoc: PDFDocumentProxy;
  onComplete: (newFig: FigureRecord) => void;
  onCancel: () => void;
}

/**
 * Add Region Safety-Net Tool in Original Mode:
 * The person drags a rectangle over a page and it becomes a figure with a caption they can type.
 */
export function AddRegionOverlay({
  docId,
  pageIndex,
  pdfDoc,
  onComplete,
  onCancel,
}: AddRegionOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [bboxNorm, setBboxNorm] = useState<FigureBBox | null>(null);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (bboxNorm) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragStart({ x, y });
    setDragCurrent({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart || bboxNorm) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragCurrent({ x, y });
  };

  const handlePointerUp = () => {
    if (!dragStart || !dragCurrent) return;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);
    setDragStart(null);
    setDragCurrent(null);

    if (w < 0.05 || h < 0.05) {
      toast('Drag a larger rectangle over the figure');
      return;
    }
    setBboxNorm({ x, y, w, h });
  };

  const handleSaveRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bboxNorm || saving) return;
    setSaving(true);
    try {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const cropped = await renderAndCropPageFigures(page, [
        {
          bboxNormalized: bboxNorm,
          kind: 'diagram',
          caption: caption.trim(),
        },
      ]);
      page.cleanup();

      if (cropped.length > 0) {
        const c = cropped[0];
        const newFig: FigureRecord = {
          id: `fig_manual_${docId}_${pageIndex}_${Date.now()}`,
          docId,
          pageIndex,
          bbox: c.bbox,
          kind: c.kind,
          caption: c.caption,
          thumbBlob: c.thumbBlob,
          fullBlob: c.fullBlob,
          w: c.w,
          h: c.h,
          createdAt: Date.now(),
        };
        await db.figures.put(newFig);
        const count = await db.figures.where('docId').equals(docId).count();
        await db.documents.update(docId, { figureCount: count });
        toast('Added figure to gallery');
        onComplete(newFig);
      }
    } catch {
      toast('Could not crop selected region');
    } finally {
      setSaving(false);
    }
  };

  const activeBox =
    bboxNorm ??
    (dragStart && dragCurrent
      ? {
          x: Math.min(dragStart.x, dragCurrent.x),
          y: Math.min(dragStart.y, dragCurrent.y),
          w: Math.abs(dragCurrent.x - dragStart.x),
          h: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute inset-0 z-30 cursor-crosshair select-none touch-none bg-ink/10"
    >
      {/* Top instruction banner */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-surface px-4 py-2 text-xs text-ink shadow-[var(--shadow-2)] whitespace-nowrap"
      >
        <span>
          {bboxNorm
            ? 'Name your figure and save'
            : `Drag a rectangle on page ${pageIndex + 1} to capture a figure`}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel add region"
          className="btn-press inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] text-ink-3 hover:text-ink"
        >
          <Icon icon={X} className="h-4 w-4" />
        </button>
      </div>

      {activeBox && (
        <div
          style={{
            left: `${activeBox.x * 100}%`,
            top: `${activeBox.y * 100}%`,
            width: `${activeBox.w * 100}%`,
            height: `${activeBox.h * 100}%`,
          }}
          className="absolute border-2 border-accent bg-accent/15 pointer-events-none"
        />
      )}

      {bboxNorm && (
        <form
          onSubmit={(e) => void handleSaveRegion(e)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex w-[92%] max-w-md items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface p-2.5 shadow-[var(--shadow-2)]"
        >
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional figure caption..."
            aria-label="Figure caption"
            autoFocus
            className="min-w-0 flex-1 rounded-[var(--radius-xs)] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
          <Button type="submit" variant="accent" size="sm" disabled={saving}>
            <Icon icon={Check} />
            <span>Save</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setBboxNorm(null)}
          >
            Redraw
          </Button>
        </form>
      )}
    </div>
  );
}

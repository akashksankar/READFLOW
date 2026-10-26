import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw, PlusSquare } from 'lucide-react';
import type { FigureRecord } from '../../data/db';
import { Sheet } from '../../motion/Sheet';
import { SegmentedControl, Button } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';

type FigureFilter = 'all' | 'image' | 'diagram';

interface FiguresSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  figures: FigureRecord[];
  scanningProgress: { scanned: number; total: number } | null;
  onSelectFigure: (figure: FigureRecord) => void;
  onRescan: () => void;
  onStartAddRegion?: () => void;
}

export function FigureThumbImage({
  blob,
  alt,
  className,
}: {
  blob: Blob;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  if (!url) return <div className={className} />;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}

/**
 * Figures Gallery (sheet on mobile, docked panel on desktop):
 * - Two-column masonry layout on phones, grouped under page folios with hairlines.
 * - Filter chips: All, Images, Diagrams.
 * - Each tile shows thumbnail, caption (two lines) and the folio.
 * - Bottom note: "Figures are detected automatically and may miss some" + Rescan / Add region.
 */
export function FiguresSheet({
  open,
  onOpenChange,
  figures,
  scanningProgress,
  onSelectFigure,
  onRescan,
  onStartAddRegion,
}: FiguresSheetProps) {
  const [filter, setFilter] = useState<FigureFilter>('all');

  const groupedByPage = useMemo(() => {
    const filtered =
      filter === 'all' ? figures : figures.filter((f) => f.kind === filter);
    const map = new Map<number, FigureRecord[]>();
    for (const fig of filtered) {
      const arr = map.get(fig.pageIndex) ?? [];
      arr.push(fig);
      map.set(fig.pageIndex, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [figures, filter]);

  const imageCount = useMemo(
    () => figures.filter((f) => f.kind === 'image').length,
    [figures]
  );
  const diagramCount = useMemo(
    () => figures.filter((f) => f.kind === 'diagram').length,
    [figures]
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Figures"
      description="Images, charts, and diagrams extracted from this PDF"
      mode="docked-or-sheet"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl<FigureFilter>
            ariaLabel="Filter figures"
            layoutGroupId="figures-filter-seg"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: figures.length },
              { value: 'image', label: 'Images', count: imageCount },
              { value: 'diagram', label: 'Diagrams', count: diagramCount },
            ]}
          />
        </div>

        {scanningProgress && scanningProgress.scanned < scanningProgress.total && (
          <p className="font-folio text-xs text-accent">
            Finding figures {scanningProgress.scanned} of {scanningProgress.total}…
          </p>
        )}

        {groupedByPage.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-ink-2">
              No images or diagrams found in this PDF.
            </p>
            {onStartAddRegion && (
              <Button variant="secondary" size="sm" onClick={onStartAddRegion}>
                <Icon icon={PlusSquare} />
                <span>Add region in Original mode</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByPage.map(([pageIdx, pageFigs]) => (
              <div key={pageIdx} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-line pb-1">
                  <span className="font-folio text-xs text-ink-3">
                    Page {pageIdx + 1}
                  </span>
                </div>

                {/* Two-column masonry layout */}
                <div className="columns-2 gap-3 space-y-3">
                  {pageFigs.map((fig) => (
                    <button
                      key={fig.id}
                      type="button"
                      onClick={() => onSelectFigure(fig)}
                      className="btn-press block w-full break-inside-avoid overflow-hidden rounded-[var(--radius-sm)] border border-line bg-bg p-2 text-left hover:border-ink-3"
                    >
                      <div
                        className="overflow-hidden rounded-[var(--radius-xs)] bg-white"
                        style={{
                          aspectRatio: `${Math.max(1, fig.w)} / ${Math.max(1, fig.h)}`,
                        }}
                      >
                        <FigureThumbImage
                          blob={fig.thumbBlob}
                          alt={fig.caption || `${fig.kind} on page ${fig.pageIndex + 1}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="mt-2 space-y-0.5">
                        {fig.caption ? (
                          <p className="font-sans text-xs text-ink line-clamp-2 leading-snug">
                            {fig.caption}
                          </p>
                        ) : (
                          <p className="font-sans text-[11px] text-ink-3 capitalize">
                            {fig.kind}
                          </p>
                        )}
                        <p className="font-folio text-[10px] text-ink-3">
                          p. {fig.pageIndex + 1}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Honesty note & safety-net tools at bottom of gallery */}
        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs text-ink-3">
            Figures are detected automatically and may miss some.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRescan}>
              <Icon icon={RefreshCw} />
              <span>Rescan figures</span>
            </Button>
            {onStartAddRegion && (
              <Button variant="secondary" size="sm" onClick={onStartAddRegion}>
                <Icon icon={PlusSquare} />
                <span>Add region</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

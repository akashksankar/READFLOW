import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  db,
  type BookmarkRecord,
  type FigureRecord,
  type HighlightRecord,
} from '../../data/db';
import { routeSlideUp } from '../../motion/variants';
import { useAppMotion } from '../../motion/useReducedMotion';
import { NotebookContent } from './NotebookPanel';
import { Lightbox } from '../figures/Lightbox';
import { CardMaker } from '../cards/CardMaker';
import { Button } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';

interface NotebookPageProps {
  docId: string;
}

/**
 * Full-screen Notebook route (/notes/:id):
 * Slide up 24px with fade, 240ms, --ease-out.
 */
export function NotebookPage({ docId }: NotebookPageProps) {
  const [, setLocation] = useLocation();
  const { isReducedMotion } = useAppMotion();
  const [activeFigure, setActiveFigure] = useState<FigureRecord | null>(null);
  const [cardHighlight, setCardHighlight] = useState<HighlightRecord | null>(null);

  const data = useLiveQuery(async () => {
    const [doc, highlights, bookmarks, figures] = await Promise.all([
      db.documents.get(docId),
      db.highlights.where('docId').equals(docId).toArray(),
      db.bookmarks.where('docId').equals(docId).toArray(),
      db.figures.where('docId').equals(docId).toArray(),
    ]);
    return { doc, highlights, bookmarks, figures };
  }, [docId]);

  const handleDeleteHighlight = async (hl: HighlightRecord) => {
    await db.highlights.delete(hl.id);
    toast('Highlight removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          void db.highlights.put(hl);
        },
      },
    });
  };

  const handleDeleteBookmark = async (bm: BookmarkRecord) => {
    await db.bookmarks.delete(bm.id);
  };

  const handleJumpToHighlight = async (hl: HighlightRecord) => {
    const existing = await db.progress.get(docId);
    await db.progress.put({
      docId,
      pageIndex: hl.pageIndex,
      blockIndex: hl.blockIndex,
      scrollOffset: 0,
      fraction: existing?.fraction ?? 0,
      mode: 'comfort',
      updatedAt: Date.now(),
    });
    setLocation(`/read/${docId}?pulseHighlight=${hl.id}`);
  };

  const handleJumpToBookmark = async (bm: BookmarkRecord) => {
    const existing = await db.progress.get(docId);
    await db.progress.put({
      docId,
      pageIndex: bm.pageIndex,
      blockIndex: 0,
      scrollOffset: 0,
      fraction: existing?.fraction ?? 0,
      mode: bm.mode,
      updatedAt: Date.now(),
    });
    setLocation(`/read/${docId}?pulsePage=${bm.pageIndex}`);
  };

  return (
    <motion.div
      custom={isReducedMotion}
      variants={routeSlideUp}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-[100dvh] flex flex-col bg-bg text-ink"
    >
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Back to reader"
              onClick={() => setLocation(`/read/${docId}`)}
            >
              <Icon icon={ArrowLeft} />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-medium text-ink truncate">
                {data?.doc?.title ?? 'Notebook'}
              </h1>
              <p className="folio-label">Personal Notebook</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 pb-safe">
        {data ? (
          <NotebookContent
            docId={docId}
            docTitle={data.doc?.title ?? 'Document'}
            highlights={data.highlights}
            bookmarks={data.bookmarks}
            figures={data.figures}
            onJumpToHighlight={(h) => void handleJumpToHighlight(h)}
            onUpdateHighlightNote={(id, note) =>
              void db.highlights.update(id, { note })
            }
            onDeleteHighlight={(h) => void handleDeleteHighlight(h)}
            onJumpToBookmark={(b) => void handleJumpToBookmark(b)}
            onUpdateBookmarkLabel={(id, label) =>
              void db.bookmarks.update(id, { label })
            }
            onDeleteBookmark={(b) => void handleDeleteBookmark(b)}
            onMakeCardFromHighlight={(hl) => setCardHighlight(hl)}
            onSelectFigure={(fig) => setActiveFigure(fig)}
          />
        ) : (
          <p className="py-12 text-center text-sm text-ink-3">Loading notebook…</p>
        )}
      </main>

      <Lightbox
        figure={activeFigure}
        allFigures={data?.figures ?? []}
        onClose={() => setActiveFigure(null)}
        onSelectFigure={(fig) => setActiveFigure(fig)}
        onGoToPage={(pIdx) => setLocation(`/read/${docId}?pulsePage=${pIdx}`)}
      />

      <CardMaker
        open={Boolean(cardHighlight)}
        onClose={() => setCardHighlight(null)}
        docId={docId}
        docTitle={data?.doc?.title ?? 'Document'}
        pageNumber={cardHighlight ? cardHighlight.pageIndex + 1 : null}
        initialText={cardHighlight?.quote ?? ''}
        sourceHighlightId={cardHighlight?.id ?? null}
        onCreated={(count) =>
          toast(`Saved ${count} ${count === 1 ? 'card' : 'cards'} to deck`)
        }
      />
    </motion.div>
  );
}

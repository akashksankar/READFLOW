import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Bookmark,
  Check,
  X,
  RotateCw,
  BookOpen,
} from 'lucide-react';
import { db, CardRecord, ReviewRecord } from '../../data/db';
import { scheduleCardReview, formatBoxIntervalLabel } from './scheduler';
import { getCardColorVars } from './CardMaker';
import { renderClozePrompt } from './suggestRules';

interface StudyViewProps {
  deckId: string;
  onBack: () => void;
  onOpenDocumentPage: (docId: string, pageNumber: number) => void;
}

interface UndoHistoryEntry {
  previousCard: CardRecord;
  reviewId: string;
  result: 'again' | 'got-it';
}

export const StudyView: React.FC<StudyViewProps> = ({
  deckId,
  onBack,
  onOpenDocumentPage,
}) => {
  const [queue, setQueue] = useState<CardRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gotItCount, setGotItCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [history, setHistory] = useState<UndoHistoryEntry[]>([]);

  // Pointer drag state for 60fps swipe
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loadQueue = async () => {
      const all = await db.cards.toArray();
      const now = Date.now();
      let pool = all.filter((c) => !c.suspended);

      if (deckId === 'saved') {
        pool = pool.filter((c) => c.savedAt !== null);
      } else if (deckId !== 'all') {
        pool = pool.filter((c) => c.deckId === deckId);
      }

      // Prefer due cards first, sorted by dueAt ascending; if none due, allow studying the deck anyway
      const due = pool.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
      const finalQueue = due.length > 0 ? due : pool.sort((a, b) => a.dueAt - b.dueAt);

      if (active) {
        setQueue(finalQueue);
        setCurrentIndex(0);
        setFlipped(false);
        setLoading(false);
      }
    };
    void loadQueue();
    return () => {
      active = false;
    };
  }, [deckId]);

  const currentCard = queue[currentIndex] ?? null;

  const commitReview = useCallback(
    async (result: 'again' | 'got-it', alsoSave: boolean = false) => {
      if (!currentCard) return;
      const { updatedCard, reviewRecord } = scheduleCardReview(
        currentCard,
        result,
        alsoSave
      );
      await db.cards.put(updatedCard);
      await db.reviews.put(reviewRecord);

      setHistory((prev) => [
        ...prev,
        { previousCard: currentCard, reviewId: reviewRecord.id, result },
      ]);
      if (result === 'got-it') setGotItCount((c) => c + 1);
      else setAgainCount((c) => c + 1);
      if (alsoSave && !currentCard.savedAt) setSavedCount((c) => c + 1);

      setDragOffset({ x: 0, y: 0 });
      setFlipped(false);
      setCurrentIndex((idx) => idx + 1);
    },
    [currentCard]
  );

  const handleToggleSaveOnly = useCallback(async () => {
    if (!currentCard) return;
    const now = Date.now();
    const nextSaved = currentCard.savedAt ? null : now;
    const updated: CardRecord = { ...currentCard, savedAt: nextSaved };
    await db.cards.put(updated);
    if (nextSaved) setSavedCount((c) => c + 1);
    setQueue((prev) => prev.map((c, i) => (i === currentIndex ? updated : c)));
  }, [currentCard, currentIndex]);

  const handleUndo = useCallback(async () => {
    if (history.length === 0 || currentIndex === 0) return;
    const last = history[history.length - 1];
    await db.cards.put(last.previousCard);
    await db.reviews.delete(last.reviewId);

    setHistory((prev) => prev.slice(0, -1));
    if (last.result === 'got-it') setGotItCount((c) => Math.max(0, c - 1));
    else setAgainCount((c) => Math.max(0, c - 1));

    setQueue((prev) =>
      prev.map((c, idx) => (idx === currentIndex - 1 ? last.previousCard : c))
    );
    setFlipped(false);
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  }, [history, currentIndex]);

  // Keyboard shortcuts: Space/Enter = Flip, ArrowLeft/1 = Again, ArrowRight/2 = Got it, S = Save, Z = Undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft' || e.key === '1') {
        e.preventDefault();
        void commitReview('again', false);
      } else if (e.key === 'ArrowRight' || e.key === '2') {
        e.preventDefault();
        void commitReview('got-it', false);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        void handleToggleSaveOnly();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, commitReview, handleToggleSaveOnly, handleUndo]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    setDragOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = () => {
    if (!dragStartRef.current) return;
    const { x, y } = dragOffset;
    dragStartRef.current = null;

    if (x >= 96) {
      void commitReview('got-it', false);
      return;
    }
    if (x <= -96) {
      void commitReview('again', false);
      return;
    }
    if (y <= -80) {
      void handleToggleSaveOnly();
      setDragOffset({ x: 0, y: 0 });
      return;
    }
    setDragOffset({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Preparing study deck...
        </p>
      </div>
    );
  }

  // Session complete summary
  if (!currentCard) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-6 text-center">
        <div
          className="p-8 rounded-[10px] border space-y-4"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-reading)' }}
          >
            Study Session Complete
          </h1>
          <div className="grid grid-cols-3 gap-3 py-3">
            <div className="p-3 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-xl font-semibold tabular-nums">{gotItCount}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Got it
              </div>
            </div>
            <div className="p-3 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-xl font-semibold tabular-nums">{againCount}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Review again
              </div>
            </div>
            <div className="p-3 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-xl font-semibold tabular-nums">{savedCount}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Saved
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] border text-xs"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo last card
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2 rounded-[6px] text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Back to Decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  const visibleStack = queue.slice(currentIndex, currentIndex + 3);
  const stampLabel =
    dragOffset.x > 45
      ? 'GOT IT'
      : dragOffset.x < -45
      ? 'AGAIN'
      : dragOffset.y < -45
      ? 'SAVE'
      : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 flex flex-col min-h-[82vh] justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded border"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Decks
        </button>

        <div className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          Card {currentIndex + 1} of {queue.length}
        </div>

        <button
          type="button"
          disabled={history.length === 0}
          onClick={handleUndo}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border disabled:opacity-30"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          title="Undo last review (Z)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>

      {/* 3-Card Physical Stack */}
      <div className="relative h-[360px] my-6 flex items-center justify-center select-none">
        {visibleStack
          .slice()
          .reverse()
          .map((card, revIdx) => {
            const stackIdx = visibleStack.length - 1 - revIdx;
            const isTop = stackIdx === 0;
            const vars = getCardColorVars(card.color);

            const translateX = isTop ? dragOffset.x : 0;
            const translateY = isTop ? dragOffset.y : stackIdx * 10;
            const scale = isTop ? 1 : 1 - stackIdx * 0.04;
            const rotateDeg = isTop ? Math.max(-10, Math.min(10, dragOffset.x * 0.04)) : 0;

            return (
              <div
                key={card.id}
                onPointerDown={isTop ? handlePointerDown : undefined}
                onPointerMove={isTop ? handlePointerMove : undefined}
                onPointerUp={isTop ? handlePointerUp : undefined}
                onClick={
                  isTop && Math.abs(dragOffset.x) < 6 && Math.abs(dragOffset.y) < 6
                    ? () => setFlipped((f) => !f)
                    : undefined
                }
                className="absolute inset-0 rounded-[12px] border p-7 flex flex-col justify-between cursor-pointer shadow-lg transition-transform"
                style={{
                  backgroundColor: vars.bg,
                  color: vars.fg,
                  borderColor: 'var(--border-subtle)',
                  transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotateDeg}deg)`,
                  transition: dragStartRef.current
                    ? 'none'
                    : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                  zIndex: 10 - stackIdx,
                }}
              >
                {/* Top Card Header */}
                <div className="flex items-center justify-between text-xs opacity-75">
                  <span className="uppercase tracking-wider">
                    {flipped ? 'Answer' : 'Prompt'} · Box {card.box} (
                    {formatBoxIntervalLabel(card.box)})
                  </span>
                  <div className="flex items-center gap-2">
                    {card.savedAt && <Bookmark className="w-3.5 h-3.5 fill-current" />}
                    {card.docId && card.pageNumber && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDocumentPage(card.docId!, card.pageNumber!);
                        }}
                        className="inline-flex items-center gap-1 underline"
                      >
                        <BookOpen className="w-3 h-3" />
                        p. {card.pageNumber}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stamp Overlay */}
                {isTop && stampLabel && (
                  <div
                    className="absolute top-14 right-6 px-3 py-1 rounded border-2 text-xs font-bold tracking-widest uppercase"
                    style={{ borderColor: 'currentColor' }}
                  >
                    {stampLabel}
                  </div>
                )}

                {/* Card Body */}
                <div className="my-auto py-4 text-center">
                  {!flipped ? (
                    <p
                      className="text-xl sm:text-2xl font-medium leading-relaxed"
                      style={{ fontFamily: 'var(--font-reading)' }}
                    >
                      {card.kind === 'cloze'
                        ? renderClozePrompt(card.front, false)
                        : card.front}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {card.kind === 'cloze' && (
                        <p className="text-xs opacity-75">
                          {renderClozePrompt(card.front, true)}
                        </p>
                      )}
                      <p
                        className="text-lg sm:text-xl leading-relaxed whitespace-pre-line"
                        style={{ fontFamily: 'var(--font-reading)' }}
                      >
                        {card.back}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Hint */}
                <div className="flex items-center justify-between text-[11px] opacity-70">
                  <span>Tap or press Space to flip</span>
                  <span>Swipe Left = Again · Right = Got it</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Explicit Accessible Action Controls */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => void commitReview('again', false)}
          className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-[8px] border text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-Primary)',
          }}
          aria-label="Again (Left Arrow or 1)"
        >
          <X className="w-4 h-4" />
          <span>Again</span>
        </button>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-[8px] border text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-Primary)',
          }}
          aria-label="Flip card (Space)"
        >
          <RotateCw className="w-4 h-4" />
          <span>Flip</span>
        </button>

        <button
          type="button"
          onClick={() => void handleToggleSaveOnly()}
          className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-[8px] border text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: currentCard.savedAt ? 'var(--accent-primary)' : 'var(--border-subtle)',
            color: currentCard.savedAt ? 'var(--accent-primary)' : 'var(--text-Primary)',
          }}
          aria-label="Save card (S)"
        >
          <Bookmark className="w-4 h-4" fill={currentCard.savedAt ? 'currentColor' : 'none'} />
          <span>{currentCard.savedAt ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={() => void commitReview('got-it', false)}
          className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-[8px] text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          aria-label="Got it (Right Arrow or 2)"
        >
          <Check className="w-4 h-4" />
          <span>Got it</span>
        </button>
      </div>
    </div>
  );
};

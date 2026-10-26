import React, { useEffect, useState, useCallback } from 'react';
import {
  Bookmark,
  Layers,
  Play,
  Plus,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { db, CardRecord, DeckRecord } from '../../data/db';
import { CardMaker, getCardColorVars } from './CardMaker';
import { formatBoxIntervalLabel } from './scheduler';

interface DeckListProps {
  onStartStudy: (deckId: string) => void;
  onOpenDocumentPage: (docId: string, pageNumber: number) => void;
}

export const DeckList: React.FC<DeckListProps> = ({
  onStartStudy,
  onOpenDocumentPage,
}) => {
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [makerOpen, setMakerOpen] = useState(false);

  const loadDecksAndCards = useCallback(async () => {
    const [loadedDecks, loadedCards] = await Promise.all([
      db.decks.orderBy('updatedAt').reverse().toArray(),
      db.cards.orderBy('createdAt').reverse().toArray(),
    ]);
    setDecks(loadedDecks);
    setCards(loadedCards);
  }, []);

  useEffect(() => {
    void loadDecksAndCards();
  }, [loadDecksAndCards]);

  const now = Date.now();
  const activeCards = cards.filter((c) => !c.suspended);
  const allDueCount = activeCards.filter((c) => c.dueAt <= now).length;
  const savedCards = activeCards.filter((c) => c.savedAt !== null);
  const savedDueCount = savedCards.filter((c) => c.dueAt <= now).length;

  const filteredCards = activeCards.filter((c) => {
    if (selectedDeckId === 'all') return true;
    if (selectedDeckId === 'saved') return c.savedAt !== null;
    return c.deckId === selectedDeckId;
  });

  const handleToggleSaved = async (card: CardRecord) => {
    const nextSaved = card.savedAt ? null : Date.now();
    await db.cards.update(card.id, { savedAt: nextSaved });
    await loadDecksAndCards();
  };

  const handleDeleteCard = async (cardId: string) => {
    await db.cards.delete(cardId);
    await db.reviews.where('cardId').equals(cardId).delete();
    await loadDecksAndCards();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 pb-24 space-y-6">
      <header
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-widest font-medium mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Leitner Spaced Repetition
          </p>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-reading)' }}
          >
            Flashcard Decks
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMakerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] border text-xs font-medium"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-Primary)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Card
          </button>
          {activeCards.length > 0 && (
            <button
              type="button"
              onClick={() => onStartStudy(selectedDeckId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Play className="w-3.5 h-3.5" />
              Study {selectedDeckId === 'saved' ? 'Saved' : 'Due'} (
              {selectedDeckId === 'saved' ? savedCards.length : Math.max(allDueCount, activeCards.length)}
              )
            </button>
          )}
        </div>
      </header>

      {/* Smart Decks + Document Decks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* All Due Smart Deck */}
        <div
          onClick={() => setSelectedDeckId('all')}
          className="p-5 rounded-[8px] border cursor-pointer transition-colors flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor:
              selectedDeckId === 'all' ? 'var(--accent-primary)' : 'var(--border-subtle)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-secondary)' }}>
                Smart Deck
              </span>
              <Layers className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h2 className="text-base font-semibold">All Due Cards</h2>
            <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {allDueCount} due now · {activeCards.length} total cards
            </p>
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              disabled={activeCards.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                onStartStudy('all');
              }}
              className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40"
              style={{ color: 'var(--accent-primary)' }}
            >
              <Play className="w-3.5 h-3.5" />
              Study now
            </button>
          </div>
        </div>

        {/* Saved Smart Deck */}
        <div
          onClick={() => setSelectedDeckId('saved')}
          className="p-5 rounded-[8px] border cursor-pointer transition-colors flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor:
              selectedDeckId === 'saved' ? 'var(--accent-primary)' : 'var(--border-subtle)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-secondary)' }}>
                Smart Deck
              </span>
              <Bookmark className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <h2 className="text-base font-semibold">Saved Cards</h2>
            <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {savedCards.length} saved · {savedDueCount} due
            </p>
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              disabled={savedCards.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                onStartStudy('saved');
              }}
              className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40"
              style={{ color: 'var(--accent-primary)' }}
            >
              <Play className="w-3.5 h-3.5" />
              Study Saved
            </button>
          </div>
        </div>

        {/* Document Decks */}
        {decks.map((deck) => {
          const deckCards = activeCards.filter((c) => c.deckId === deck.id);
          const deckDue = deckCards.filter((c) => c.dueAt <= now).length;
          return (
            <div
              key={deck.id}
              onClick={() => setSelectedDeckId(deck.id)}
              className="p-5 rounded-[8px] border cursor-pointer transition-colors flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor:
                  selectedDeckId === deck.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
              }}
            >
              <div>
                <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Document Deck
                </span>
                <h2 className="text-base font-semibold truncate mt-1">{deck.title}</h2>
                <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {deckDue} due · {deckCards.length} cards
                </p>
              </div>
              <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  type="button"
                  disabled={deckCards.length === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartStudy(deck.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  <Play className="w-3.5 h-3.5" />
                  Study Deck
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cards Browser */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Cards in Selection ({filteredCards.length})
          </h2>
        </div>

        {filteredCards.length === 0 ? (
          <div
            className="p-8 rounded-[8px] border text-center space-y-2"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <p className="text-sm font-medium">No cards in this view yet</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Select any text while reading a PDF and tap “Card”, or create a custom card above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCards.map((card) => {
              const vars = getCardColorVars(card.color);
              return (
                <div
                  key={card.id}
                  className="p-4 rounded-[8px] border flex flex-col justify-between gap-3"
                  style={{
                    backgroundColor: vars.bg,
                    color: vars.fg,
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] opacity-75 mb-1.5">
                      <span className="uppercase tracking-wider">
                        Box {card.box} ({formatBoxIntervalLabel(card.box)})
                      </span>
                      {card.pageNumber && card.docId && (
                        <button
                          type="button"
                          onClick={() => onOpenDocumentPage(card.docId!, card.pageNumber!)}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <BookOpen className="w-3 h-3" />
                          p. {card.pageNumber}
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug">{card.front}</p>
                    <p className="text-xs mt-1.5 opacity-90 line-clamp-3 whitespace-pre-line">
                      {card.back}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleSaved(card)}
                      className="inline-flex items-center gap-1 text-xs"
                    >
                      <Bookmark
                        className="w-3.5 h-3.5"
                        fill={card.savedAt ? 'currentColor' : 'none'}
                      />
                      <span>{card.savedAt ? 'Saved' : 'Save'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1 rounded opacity-75 hover:opacity-100"
                      aria-label="Delete card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <CardMaker
        open={makerOpen}
        onClose={() => setMakerOpen(false)}
        docId={null}
        docTitle="General Deck"
        pageNumber={null}
        onCreated={() => void loadDecksAndCards()}
      />
    </div>
  );
};

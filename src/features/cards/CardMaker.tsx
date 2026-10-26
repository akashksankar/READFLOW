import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Bookmark, Check, Sparkles } from 'lucide-react';
import { db, CardColor, CardRecord, DeckRecord } from '../../data/db';
import {
  CardSuggestion,
  suggestCardsFromText,
  renderClozePrompt,
} from './suggestRules';

export const CARD_COLORS: Array<{ id: CardColor; label: string; cssIndex: number }> = [
  { id: 'ivory', label: 'Warm Ivory', cssIndex: 1 },
  { id: 'ochre', label: 'Soft Ochre', cssIndex: 2 },
  { id: 'terracotta', label: 'Terracotta Tint', cssIndex: 3 },
  { id: 'sage', label: 'Sage Leaf', cssIndex: 4 },
  { id: 'slate', label: 'Slate Blue', cssIndex: 5 },
  { id: 'plum', label: 'Dusk Plum', cssIndex: 6 },
  { id: 'rose', label: 'Warm Rose', cssIndex: 7 },
  { id: 'charcoal', label: 'Charcoal', cssIndex: 8 },
];

export function getCardColorVars(color: CardColor): { bg: string; fg: string } {
  const entry = CARD_COLORS.find((c) => c.id === color) ?? CARD_COLORS[0];
  return {
    bg: `var(--card-${entry.cssIndex})`,
    fg: `var(--on-card-${entry.cssIndex})`,
  };
}

interface CardMakerProps {
  open: boolean;
  onClose: () => void;
  docId: string | null;
  docTitle: string;
  pageNumber: number | null;
  initialText?: string;
  boldPhrases?: string[];
  headingTitle?: string;
  sourceHighlightId?: string | null;
  sourceFigureId?: string | null;
  onCreated?: (count: number) => void;
}

export const CardMaker: React.FC<CardMakerProps> = ({
  open,
  onClose,
  docId,
  docTitle,
  pageNumber,
  initialText = '',
  boldPhrases,
  headingTitle,
  sourceHighlightId = null,
  sourceFigureId = null,
  onCreated,
}) => {
  const [tab, setTab] = useState<'single' | 'suggestions'>('single');
  const [kind, setKind] = useState<'qa' | 'cloze' | 'quote'>('qa');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [color, setColor] = useState<CardColor>('ivory');
  const [alsoSave, setAlsoSave] = useState(false);

  const suggestions = useMemo(
    () =>
      suggestCardsFromText(initialText, {
        boldPhrases,
        headingTitle,
        pageNumber: pageNumber ?? undefined,
      }),
    [initialText, boldPhrases, headingTitle, pageNumber]
  );

  // Rule-based suggestions are UNCHECKED by default so the user explicitly chooses
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, CardSuggestion>>({});

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    const map: Record<string, CardSuggestion> = {};
    for (const s of suggestions) {
      map[s.id] = { ...s };
    }
    setEditedSuggestions(map);

    if (initialText.trim()) {
      if (suggestions.length > 0) {
        setFront(suggestions[0].front);
        setBack(suggestions[0].back);
        setKind(suggestions[0].kindModel);
      } else {
        setFront(headingTitle ? `Note from ${headingTitle}` : 'Key concept');
        setBack(initialText.trim());
        setKind('qa');
      }
    } else {
      setFront('');
      setBack('');
      setKind('qa');
    }
  }, [open, initialText, headingTitle, suggestions]);

  if (!open) return null;

  const ensureDeckForDocument = async (): Promise<string> => {
    if (docId) {
      const existing = await db.decks.where('docId').equals(docId).first();
      if (existing) return existing.id;
      const deck: DeckRecord = {
        id: `deck_${docId}`,
        title: docTitle || 'Document Deck',
        docId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.decks.put(deck);
      return deck.id;
    }

    const general = await db.decks.get('deck_general');
    if (general) return general.id;
    const fresh: DeckRecord = {
      id: 'deck_general',
      title: 'General Reading Cards',
      docId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.decks.put(fresh);
    return fresh.id;
  };

  const handleWrapClozeBlank = () => {
    if (!front.includes('{{')) {
      const words = front.trim().split(/\s+/);
      if (words.length > 0) {
        const last = words[words.length - 1];
        words[words.length - 1] = `{{${last}}}`;
        setFront(words.join(' '));
        if (!back.trim()) setBack(last);
      }
    }
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    const deckId = await ensureDeckForDocument();
    const now = Date.now();
    const record: CardRecord = {
      id: `card_${now}_${Math.random().toString(36).slice(2, 7)}`,
      deckId,
      docId,
      pageNumber,
      sourceHighlightId,
      sourceFigureId,
      kind,
      front: front.trim(),
      back: back.trim(),
      color,
      savedAt: alsoSave ? now : null,
      box: 1,
      dueAt: now,
      reviewCount: 0,
      lapses: 0,
      createdAt: now,
      suspended: false,
    };
    await db.cards.put(record);
    await db.decks.update(deckId, { updatedAt: now });
    onCreated?.(1);
    onClose();
  };

  const handleSaveSelectedSuggestions = async () => {
    if (selectedIds.size === 0) return;
    const deckId = await ensureDeckForDocument();
    const now = Date.now();
    const records: CardRecord[] = [];
    let i = 0;
    for (const id of selectedIds) {
      const sug = editedSuggestions[id];
      if (!sug || !sug.front.trim() || !sug.back.trim()) continue;
      i += 1;
      records.push({
        id: `card_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        deckId,
        docId,
        pageNumber: sug.pageNumber ?? pageNumber,
        sourceHighlightId,
        sourceFigureId,
        kind: sug.kindModel,
        front: sug.front.trim(),
        back: sug.back.trim(),
        color,
        savedAt: alsoSave ? now : null,
        box: 1,
        dueAt: now,
        reviewCount: 0,
        lapses: 0,
        createdAt: now,
        suspended: false,
      });
    }
    if (records.length > 0) {
      await db.cards.bulkPut(records);
      await db.decks.update(deckId, { updatedAt: now });
      onCreated?.(records.length);
    }
    onClose();
  };

  const colorVars = getCardColorVars(color);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 14, 12, 0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Create Flashcards"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[10px] border shadow-xl p-6 space-y-5"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-Primary)',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Card Maker</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {docTitle ? `${docTitle}${pageNumber ? ` · p. ${pageNumber}` : ''}` : 'General Deck'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:opacity-80"
            aria-label="Close card maker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex p-1 rounded-[6px] border"
            style={{
              backgroundColor: 'var(--bg-Secondary)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('single')}
              className="px-3 py-1 rounded-[4px] text-xs font-medium transition-colors"
              style={{
                backgroundColor: tab === 'single' ? 'var(--bg-elevated)' : 'transparent',
                color: tab === 'single' ? 'var(--text-Primary)' : 'var(--text-secondary)',
              }}
            >
              Custom Card
            </button>
            <button
              type="button"
              onClick={() => setTab('suggestions')}
              className="px-3 py-1 rounded-[4px] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              style={{
                backgroundColor: tab === 'suggestions' ? 'var(--bg-elevated)' : 'transparent',
                color: tab === 'suggestions' ? 'var(--text-Primary)' : 'var(--text-secondary)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Rule Suggestions ({suggestions.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAlsoSave((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border text-xs transition-colors"
            style={{
              borderColor: alsoSave ? 'var(--accent-primary)' : 'var(--border-subtle)',
              color: alsoSave ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{alsoSave ? 'Saved to Saved Deck' : 'Also save to Saved'}</span>
          </button>
        </div>

        {/* 8-Color Card Swatch Picker */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Card Paper Tint
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {CARD_COLORS.map((c) => {
              const selected = c.id === color;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className="w-7 h-7 rounded-[6px] border flex items-center justify-center transition-transform"
                  style={{
                    backgroundColor: `var(--card-${c.cssIndex})`,
                    color: `var(--on-card-${c.cssIndex})`,
                    borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    transform: selected ? 'scale(1.08)' : 'scale(1)',
                  }}
                  title={c.label}
                  aria-label={c.label}
                >
                  {selected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {tab === 'single' ? (
          <form onSubmit={handleSaveSingle} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['qa', 'cloze', 'quote'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="px-2.5 py-1 rounded text-xs uppercase tracking-wider border"
                    style={{
                      borderColor: kind === k ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: kind === k ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {k === 'qa' ? 'Q & A' : k === 'cloze' ? 'Fill-in-blank' : 'Quote'}
                  </button>
                ))}
              </div>
              {kind === 'cloze' && (
                <button
                  type="button"
                  onClick={handleWrapClozeBlank}
                  className="text-xs underline"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Wrap word in {'{{blank}}'}
                </button>
              )}
            </div>

            {/* Live Card Preview */}
            <div
              className="p-4 rounded-[8px] border space-y-3"
              style={{
                backgroundColor: colorVars.bg,
                color: colorVars.fg,
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div>
                <label className="block text-[11px] uppercase tracking-wider opacity-75 mb-1">
                  Front (Prompt)
                </label>
                <textarea
                  rows={2}
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder={
                    kind === 'cloze'
                      ? 'The mitochondria is the {{powerhouse}} of the cell.'
                      : 'Enter question or prompt...'
                  }
                  className="w-full bg-transparent border rounded p-2 text-sm focus:outline-none"
                  style={{ borderColor: 'rgba(128,128,128,0.3)' }}
                  required
                />
                {kind === 'cloze' && front.includes('{{') && (
                  <p className="text-xs mt-1 opacity-80">
                    Preview: {renderClozePrompt(front, false)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider opacity-75 mb-1">
                  Back (Answer)
                </label>
                <textarea
                  rows={3}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="Enter answer or explanation..."
                  className="w-full bg-transparent border rounded p-2 text-sm focus:outline-none"
                  style={{ borderColor: 'rgba(128,128,128,0.3)' }}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Card
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Rule-extracted candidates from your text. Candidates are unchecked by default — check
              and edit the ones you want to keep:
            </p>

            {suggestions.length === 0 ? (
              <div
                className="p-4 rounded-[6px] border text-xs"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                No automatic candidates matched this passage. Switch to Custom Card to write one.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {suggestions.map((s) => {
                  const current = editedSuggestions[s.id] ?? s;
                  const checked = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-[6px] border space-y-2"
                      style={{
                        backgroundColor: checked ? colorVars.bg : 'var(--bg-Primary)',
                        color: checked ? colorVars.fg : 'var(--text-Primary)',
                        borderColor: checked ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              setSelectedIds(next);
                            }}
                          />
                          <span className="uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                            {s.label}
                          </span>
                        </label>
                      </div>

                      <input
                        type="text"
                        value={current.front}
                        onChange={(e) =>
                          setEditedSuggestions((prev) => ({
                            ...prev,
                            [s.id]: { ...current, front: e.target.value },
                          }))
                        }
                        className="w-full text-xs font-medium bg-transparent border rounded px-2 py-1"
                        style={{ borderColor: 'rgba(128,128,128,0.28)' }}
                      />
                      <textarea
                        rows={2}
                        value={current.back}
                        onChange={(e) =>
                          setEditedSuggestions((prev) => ({
                            ...prev,
                            [s.id]: { ...current, back: e.target.value },
                          }))
                        }
                        className="w-full text-xs bg-transparent border rounded px-2 py-1"
                        style={{ borderColor: 'rgba(128,128,128,0.28)' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleSaveSelectedSuggestions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Save {selectedIds.size} Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

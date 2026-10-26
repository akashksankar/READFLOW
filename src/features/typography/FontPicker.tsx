import React, { useEffect, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { HeadingFontId, ReadingFontId } from '../../data/db';
import {
  READING_FONTS,
  HEADING_FONTS,
  ensureFontLoaded,
} from './styles';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

interface FontPickerProps {
  value: ReadingFontId;
  onChange: (font: ReadingFontId) => void;
  headingFont: HeadingFontId;
  onHeadingFontChange: (headingFont: HeadingFontId) => void;
}

/**
 * FontPicker:
 * Shows each font in the picker as a live specimen line in its own face ("The quiet hour before dawn"),
 * with its name beneath in the UI font.
 * Does not render all fonts at once: renders specimens only when the picker is open,
 * and loads each font file lazily on first view.
 */
export function FontPicker({
  value,
  onChange,
  headingFont,
  onHeadingFontChange,
}: FontPickerProps) {
  const [open, setOpen] = useState(false);

  const currentFontMeta =
    READING_FONTS.find((f) => f.id === value) ?? READING_FONTS[0];

  // When picker opens, lazily load specimen fonts
  useEffect(() => {
    if (!open) return;
    for (const f of READING_FONTS) {
      void ensureFontLoaded(f.id);
    }
    void ensureFontLoaded('playfair-display');
  }, [open]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="folio-label">Body font</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn-press inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border border-line bg-bg px-3 py-1.5 text-xs font-medium text-ink min-h-[38px]"
        >
          <span>{currentFontMeta.name}</span>
          <Icon
            icon={ChevronDown}
            className={cn(
              'h-4 w-4 text-ink-3 transition-transform duration-[var(--dur-fast)]',
              open && 'rotate-180'
            )}
          />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Reading fonts"
          className="divide-y divide-line rounded-[var(--radius-sm)] border border-line bg-bg/70 max-h-[260px] overflow-y-auto overscroll-contain"
        >
          {READING_FONTS.map((f) => {
            const active = f.id === value;
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  void ensureFontLoaded(f.id);
                  onChange(f.id);
                }}
                className={cn(
                  'btn-press flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors',
                  active ? 'bg-surface' : 'hover:bg-surface/60'
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className="text-base text-ink truncate"
                    style={{ fontFamily: f.cssFamily }}
                  >
                    The quiet hour before dawn
                  </p>
                  <p className="font-sans text-[11px] text-ink-3">
                    <span className="font-medium text-ink-2">{f.name}</span> · {f.character}
                  </p>
                </div>
                {active && (
                  <span className="text-accent shrink-0">
                    <Icon icon={Check} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Heading font selector */}
      <div className="flex items-center justify-between pt-2">
        <label htmlFor="heading-font-select" className="folio-label">
          Heading font
        </label>
        <select
          id="heading-font-select"
          value={headingFont}
          onChange={(e) => {
            const next = e.target.value as HeadingFontId;
            void ensureFontLoaded(next);
            onHeadingFontChange(next);
          }}
          className="rounded-[var(--radius-xs)] border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink min-h-[38px] focus:border-accent focus:outline-none"
        >
          {HEADING_FONTS.map((hf) => (
            <option key={hf.id} value={hf.id}>
              {hf.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

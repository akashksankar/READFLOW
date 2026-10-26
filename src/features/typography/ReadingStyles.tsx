import React, { useEffect } from 'react';
import type { ReadingSettings, ReadingStyleId } from '../../data/db';
import {
  READING_STYLE_PRESETS,
  ensureFontLoaded,
  getReadingFontCss,
  resolveDropCapColorForTheme,
  resolveStylePresetToSettings,
} from './styles';
import { ThemeCornerRibbon } from '../../ui/Ribbon';
import { cn } from '../../lib/cn';

interface ReadingStylesProps {
  settings: ReadingSettings;
  onApplyPreset: (partial: Partial<ReadingSettings>) => void;
}

/**
 * Horizontally scrolling style cards at the top of Reading Settings:
 * Each card is a miniature live preview rendered with that style's real font and drop cap on a sample sentence.
 * Selecting a style applies it instantly.
 */
export function ReadingStyles({ settings, onApplyPreset }: ReadingStylesProps) {
  useEffect(() => {
    // Lazily load fonts used by style cards when settings sheet opens
    for (const preset of READING_STYLE_PRESETS) {
      if (preset.font) void ensureFontLoaded(preset.font);
      void ensureFontLoaded(preset.headingFont);
    }
  }, []);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="folio-label">Reading style</span>
        <span className="font-folio text-xs text-ink-2 capitalize">
          {settings.readingStyle === 'custom' ? 'Custom' : settings.readingStyle}
        </span>
      </div>

      {/* Horizontally scrolling row with allowed 24px edge fade */}
      <div className="relative -mx-1">
        <div
          role="group"
          aria-label="Reading style presets"
          className="flex gap-2.5 overflow-x-auto pb-2 px-1 snap-x"
        >
          {READING_STYLE_PRESETS.map((preset) => {
            const active = settings.readingStyle === preset.id;
            const fontCss = getReadingFontCss(
              preset.font ?? settings.readingFont ?? settings.fontFamily
            );
            const dropColor = resolveDropCapColorForTheme(
              preset.dropCapColor,
              settings.theme
            ).hex;

            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const updates = resolveStylePresetToSettings(
                    preset.id as Exclude<ReadingStyleId, 'custom'>,
                    settings
                  );
                  if (updates.readingFont) void ensureFontLoaded(updates.readingFont);
                  if (updates.headingFont) void ensureFontLoaded(updates.headingFont);
                  onApplyPreset(updates);
                }}
                className={cn(
                  'btn-press relative flex w-[148px] shrink-0 snap-start flex-col justify-between rounded-[var(--radius-sm)] border p-3 text-left min-h-[104px] overflow-hidden',
                  active
                    ? 'border-accent bg-bg ring-1 ring-accent'
                    : 'border-line bg-bg/60 hover:bg-bg'
                )}
              >
                {active && <ThemeCornerRibbon />}

                {/* Miniature live preview with real font & drop cap */}
                <div
                  className="text-[12px] leading-snug text-ink line-clamp-3"
                  style={{ fontFamily: fontCss }}
                >
                  {preset.dropCapMode === 'drop' ? (
                    <>
                      <span
                        className={cn(
                          'float-left mr-1.5 font-display leading-none',
                          preset.dropCapDecoration === 'underline' &&
                            'border-b-2 border-accent pb-0.5',
                          preset.dropCapDecoration === 'block' &&
                            'bg-accent text-on-accent px-1 py-0.5 rounded-[2px]'
                        )}
                        style={{
                          fontSize: preset.dropCapLines === 4 ? '24px' : '21px',
                          fontWeight: preset.dropCapWeight,
                          color:
                            preset.dropCapDecoration === 'block'
                              ? 'var(--on-accent)'
                              : dropColor,
                        }}
                      >
                        O
                      </span>
                      <span>nce upon a quiet evening, the page opened cleanly.</span>
                    </>
                  ) : preset.dropCapMode === 'bold-first-word' ? (
                    <>
                      <strong className="font-bold text-ink">Once</strong>{' '}
                      <span>upon a quiet evening, the page opened cleanly.</span>
                    </>
                  ) : (
                    <span>Once upon a quiet evening, the page opened cleanly.</span>
                  )}
                </div>

                <div className="mt-2.5 border-t border-line/70 pt-1.5">
                  <p className="font-sans text-xs font-medium text-ink leading-tight">
                    {preset.name}
                  </p>
                  <p className="font-sans text-[10px] text-ink-3 truncate">
                    {preset.feel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

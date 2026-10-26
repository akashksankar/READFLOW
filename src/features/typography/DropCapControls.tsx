import React from 'react';
import type {
  DropCapColorId,
  DropCapMode,
  DropCapWeight,
  ReadingSettings,
  ThemeId,
} from '../../data/db';
import {
  DROPCAP_COLORS,
  resolveDropCapColorForTheme,
} from './styles';
import { FolioSwitch, SegmentedControl } from '../../ui/Primitives';
import { cn } from '../../lib/cn';

interface DropCapControlsProps {
  settings: ReadingSettings;
  onChange: (partial: Partial<ReadingSettings>) => void;
}

const DROPCAP_MODES: { value: DropCapMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'drop', label: 'Drop cap' },
  { value: 'raised', label: 'Raised' },
  { value: 'bold-first-word', label: 'Bold word' },
  { value: 'small-caps', label: 'Small caps' },
];

const WEIGHTS: { value: DropCapWeight; label: string }[] = [
  { value: 400, label: 'Regular' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 900, label: 'Black' },
];

export function DropCapControls({ settings, onChange }: DropCapControlsProps) {
  const theme: ThemeId = settings.theme;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="folio-label block">Starting letter & drop cap</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Drop cap mode">
          {DROPCAP_MODES.map((m) => {
            const active = settings.dropCapMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    dropCapMode: m.value,
                    readingStyle: 'custom',
                  })
                }
                className={cn(
                  'btn-press rounded-[var(--radius-xs)] border px-2.5 py-1.5 text-xs font-medium min-h-[36px]',
                  active
                    ? 'border-ink bg-ink text-bg'
                    : 'border-line bg-bg text-ink-2 hover:text-ink'
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {settings.dropCapMode !== 'off' && (
        <>
          {/* Lines selector when in Drop cap mode */}
          {settings.dropCapMode === 'drop' && (
            <div className="flex items-center justify-between">
              <span className="folio-label">Drop cap height</span>
              <SegmentedControl<'2' | '3' | '4'>
                ariaLabel="Drop cap lines"
                layoutGroupId="dropcap-lines-seg"
                value={String(settings.dropCapLines) as '2' | '3' | '4'}
                onChange={(v) =>
                  onChange({
                    dropCapLines: Number(v) as 2 | 3 | 4,
                    readingStyle: 'custom',
                  })
                }
                options={[
                  { value: '2', label: '2 lines' },
                  { value: '3', label: '3 lines' },
                  { value: '4', label: '4 lines' },
                ]}
              />
            </div>
          )}

          {/* Color picker with 3:1 contrast check against current theme */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="folio-label">Initial letter color</span>
              <span className="text-[11px] text-ink-3 capitalize">
                {DROPCAP_COLORS.find((c) => c.id === settings.dropCapColor)?.label ??
                  settings.dropCapColor}
              </span>
            </div>
            <div
              role="group"
              aria-label="Drop cap color swatches"
              className="grid grid-cols-6 gap-2"
            >
              {DROPCAP_COLORS.map((swatch) => {
                const check = resolveDropCapColorForTheme(
                  swatch.id as DropCapColorId,
                  theme
                );
                const active = settings.dropCapColor === swatch.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    disabled={!check.passes}
                    title={
                      check.passes
                        ? `${swatch.label} (${check.contrast.toFixed(1)}:1)`
                        : check.failReason
                    }
                    aria-label={
                      check.passes
                        ? `${swatch.label} drop cap color`
                        : `${swatch.label} disabled: ${check.failReason}`
                    }
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        dropCapColor: swatch.id,
                        readingStyle: 'custom',
                      })
                    }
                    className={cn(
                      'btn-press flex h-[38px] items-center justify-center rounded-[var(--radius-xs)] border border-line bg-bg',
                      active && 'ring-2 ring-accent',
                      !check.passes && 'opacity-35 cursor-not-allowed'
                    )}
                  >
                    <span
                      className="h-5 w-5 rounded-[var(--radius-pill)] border border-ink/20"
                      style={{ backgroundColor: check.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weight selector */}
          <div className="space-y-1.5">
            <span className="folio-label block">Initial weight</span>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Drop cap weight">
              {WEIGHTS.map((w) => {
                const active = settings.dropCapWeight === w.value;
                return (
                  <button
                    key={w.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        dropCapWeight: w.value,
                        readingStyle: 'custom',
                      })
                    }
                    className={cn(
                      'btn-press rounded-[var(--radius-xs)] border py-1.5 text-xs min-h-[36px]',
                      active
                        ? 'border-ink bg-ink text-bg font-medium'
                        : 'border-line bg-bg text-ink-2 hover:text-ink'
                    )}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional "Every paragraph" small bold colored first letter */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <label htmlFor="switch-every-para-initial" className="text-xs font-medium text-ink block">
                Every paragraph initial
              </label>
              <span className="text-[11px] text-ink-3">
                Color the first letter on every paragraph (no drop)
              </span>
            </div>
            <FolioSwitch
              id="switch-every-para-initial"
              label="Every paragraph initial"
              checked={settings.dropCapScope === 'every'}
              onCheckedChange={(checked) =>
                onChange({
                  dropCapScope: checked ? 'every' : 'section',
                  readingStyle: 'custom',
                })
              }
            />
          </div>
        </>
      )}

      {/* Decorative style option: small ribbon glyph between sections */}
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-line/60">
        <div>
          <label htmlFor="switch-section-ornament" className="text-xs font-medium text-ink block">
            Section ribbon ornament
          </label>
          <span className="text-[11px] text-ink-3">
            Quiet ribbon mark before chapter headings
          </span>
        </div>
        <FolioSwitch
          id="switch-section-ornament"
          label="Section ribbon ornament"
          checked={settings.sectionOrnament}
          onCheckedChange={(checked) => onChange({ sectionOrnament: checked })}
        />
      </div>
    </div>
  );
}

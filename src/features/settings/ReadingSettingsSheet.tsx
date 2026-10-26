import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  deleteFiguresForDocument,
  getStorageQuotaEstimate,
  type FiguresInlineMode,
  type MotionPreference,
  type OpeningAnimationStyle,
  type PageTurnStyle,
  type ReadingFlowMode,
  type TapZonesMode,
  type ThemeId,
} from '../../data/db';
import { useAppSettings } from '../../app/providers';
import { Sheet } from '../../motion/Sheet';
import { ThemeCornerRibbon } from '../../ui/Ribbon';
import {
  FolioSlider,
  FolioSwitch,
  SegmentedControl,
} from '../../ui/Primitives';
import { ReadingStyles } from '../typography/ReadingStyles';
import { FontPicker } from '../typography/FontPicker';
import { DropCapControls } from '../typography/DropCapControls';
import { formatBytes } from '../../lib/format';
import { cn } from '../../lib/cn';

const THEMES: {
  id: ThemeId;
  label: string;
  bg: string;
  surface: string;
  ink: string;
  line: string;
}[] = [
  {
    id: 'paper',
    label: 'Paper & Ink',
    bg: '#F6F0E4',
    surface: '#FBF7EE',
    ink: '#1D1A16',
    line: '#D9CFBD',
  },
  {
    id: 'sepia',
    label: 'Sepia',
    bg: '#EBDDC1',
    surface: '#F2E7CF',
    ink: '#3B2E1E',
    line: '#CDB98F',
  },
  {
    id: 'forest',
    label: 'Forest',
    bg: '#16241D',
    surface: '#1D2F26',
    ink: '#E4EBDD',
    line: '#2F4539',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    bg: '#10131C',
    surface: '#171B27',
    ink: '#E7E4DC',
    line: '#262B3A',
  },
  {
    id: 'oled',
    label: 'OLED Black',
    bg: '#000000',
    surface: '#0B0B0B',
    ink: '#E8E6E1',
    line: '#1E1E1E',
  },
];

interface ReadingSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId?: string;
  figureCount?: number;
  onBeforeTypographyChange?: () => void;
  onRescanFigures?: () => void;
}

export function ReadingSettingsSheet({
  open,
  onOpenChange,
  docId,
  figureCount = 0,
  onBeforeTypographyChange,
  onRescanFigures,
}: ReadingSettingsSheetProps) {
  const { settings, updateSettings, setThemeWithReveal, resetToDefaults } = useAppSettings();
  const [storageUsed, setStorageUsed] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    void getStorageQuotaEstimate().then((est) => {
      if (est) setStorageUsed({ usage: est.usage, quota: est.quota });
    });
  }, [open]);

  const applyTypographyChange = (partial: Parameters<typeof updateSettings>[0]) => {
    onBeforeTypographyChange?.();
    updateSettings(partial);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reading settings"
      description="Customize reading style, theme, typeface, drop caps, page flow, and motion"
      mode="docked-or-sheet"
      halfHeightMobile
    >
      <div className="divide-y divide-line text-sm">
        {/* Top Style tab: horizontally scrolling style cards with real font & drop cap preview */}
        <section className="pb-4" aria-label="Reading styles">
          <ReadingStyles
            settings={settings}
            onApplyPreset={(updates) => applyTypographyChange(updates)}
          />
        </section>

        {/* 1. Theme: five swatches shown as small paper samples with the theme name; current one has a ribbon corner */}
        <section className="py-4 space-y-2.5" aria-label="Reading theme">
          <span className="folio-label block">Theme</span>
          <div className="grid grid-cols-5 gap-2">
            {THEMES.map((t) => {
              const active = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={(e) => setThemeWithReveal(t.id, e)}
                  aria-pressed={active}
                  aria-label={`${t.label} theme`}
                  className={cn(
                    'btn-press relative flex flex-col items-start justify-between rounded-[var(--radius-xs)] border p-2 text-left min-h-[62px] overflow-hidden',
                    active ? 'ring-2 ring-accent' : ''
                  )}
                  style={{
                    backgroundColor: t.bg,
                    borderColor: active ? 'var(--accent)' : t.line,
                    color: t.ink,
                  }}
                >
                  {active && <ThemeCornerRibbon />}
                  <span
                    className="font-display text-xs font-medium"
                    style={{ color: t.ink }}
                  >
                    Aa
                  </span>
                  <span
                    className="text-[11px] font-medium leading-tight line-clamp-1"
                    style={{ color: t.ink }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Reading flow (Scroll / Paged) & Page turn style (Slide / Fade / Flip) */}
        <section className="py-4 space-y-3" aria-label="Reading flow and pagination">
          <div className="flex items-center justify-between">
            <span className="folio-label">Reading flow</span>
            <SegmentedControl<ReadingFlowMode>
              ariaLabel="Reading flow"
              layoutGroupId="settings-reading-flow"
              value={settings.readingFlow}
              onChange={(flow) => applyTypographyChange({ readingFlow: flow })}
              options={[
                { value: 'scroll', label: 'Scroll' },
                { value: 'paged', label: 'Paged' },
              ]}
            />
          </div>

          {settings.readingFlow === 'paged' && (
            <>
              <div className="flex items-center justify-between pt-1">
                <span className="folio-label">Page turn</span>
                <SegmentedControl<PageTurnStyle>
                  ariaLabel="Page turn style"
                  layoutGroupId="settings-page-turn"
                  value={settings.pageTurn}
                  onChange={(turn) => updateSettings({ pageTurn: turn })}
                  options={[
                    { value: 'slide', label: 'Slide' },
                    { value: 'fade', label: 'Fade' },
                    { value: 'flip', label: 'Flip' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="folio-label">Tap zones</span>
                <SegmentedControl<TapZonesMode>
                  ariaLabel="Paged tap zones"
                  layoutGroupId="settings-tap-zones"
                  value={settings.tapZones}
                  onChange={(tz) => updateSettings({ tapZones: tz })}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'wide-center', label: 'Wide center' },
                  ]}
                />
              </div>
            </>
          )}
        </section>

        {/* 3. Customize Section: Font picker, Heading font, Text size, Drop cap controls */}
        <section className="py-4 space-y-4" aria-label="Customize font and starting letters">
          <FontPicker
            value={settings.readingFont ?? settings.fontFamily}
            onChange={(font) =>
              applyTypographyChange({
                readingFont: font,
                fontFamily: font,
                readingStyle: 'custom',
              })
            }
            headingFont={settings.headingFont}
            onHeadingFontChange={(hf) =>
              applyTypographyChange({
                headingFont: hf,
                readingStyle: 'custom',
              })
            }
          />

          {/* Text size slider */}
          <div className="space-y-1.5 pt-2 border-t border-line/60">
            <div className="flex items-center justify-between">
              <span className="folio-label">Text size</span>
              <span className="font-folio text-xs text-ink-2">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="font-display text-sm text-ink-2 select-none"
              >
                Aa
              </span>
              <FolioSlider
                value={settings.fontSize}
                min={14}
                max={28}
                step={1}
                ariaLabel="Text size"
                formatBubble={(v) => `${v}px`}
                onValueChange={(v) => applyTypographyChange({ fontSize: v })}
              />
              <span
                aria-hidden="true"
                className="font-display text-xl text-ink select-none"
              >
                Aa
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-line/60">
            <DropCapControls
              settings={settings}
              onChange={(partial) => applyTypographyChange(partial)}
            />
          </div>
        </section>

        {/* 4. Line spacing, paragraph spacing, margins, content width */}
        <section className="py-4 space-y-4" aria-label="Layout and spacing">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="folio-label">Line spacing</span>
              <span className="font-folio text-xs text-ink-2">
                {settings.lineSpacing.toFixed(2)}
              </span>
            </div>
            <FolioSlider
              value={settings.lineSpacing}
              min={1.4}
              max={2.0}
              step={0.05}
              ariaLabel="Line spacing"
              formatBubble={(v) => v.toFixed(2)}
              onValueChange={(v) =>
                applyTypographyChange({
                  lineSpacing: Number(v.toFixed(2)),
                  readingStyle: 'custom',
                })
              }
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="folio-label">Paragraph spacing</span>
              <span className="font-folio text-xs text-ink-2">
                {settings.paragraphSpacing.toFixed(1)}em
              </span>
            </div>
            <FolioSlider
              value={settings.paragraphSpacing}
              min={0.4}
              max={1.5}
              step={0.1}
              ariaLabel="Paragraph spacing"
              formatBubble={(v) => `${v.toFixed(1)}em`}
              onValueChange={(v) =>
                applyTypographyChange({
                  paragraphSpacing: Number(v.toFixed(1)),
                  readingStyle: 'custom',
                })
              }
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="folio-label">Margins</span>
              <span className="font-folio text-xs text-ink-2">{settings.margins}px</span>
            </div>
            <FolioSlider
              value={settings.margins}
              min={8}
              max={40}
              step={2}
              ariaLabel="Page margins"
              formatBubble={(v) => `${v}px`}
              onValueChange={(v) => applyTypographyChange({ margins: v })}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="folio-label">Content width</span>
              <span className="font-folio text-xs text-ink-2">
                {settings.contentWidth}ch
              </span>
            </div>
            <FolioSlider
              value={settings.contentWidth}
              min={46}
              max={72}
              step={2}
              ariaLabel="Content measure width"
              formatBubble={(v) => `${v}ch`}
              onValueChange={(v) => applyTypographyChange({ contentWidth: v })}
            />
          </div>
        </section>

        {/* 5. Figures Inline, Opening Animation & Motion */}
        <section className="py-4 space-y-4" aria-label="Figures and motion options">
          <div className="space-y-2">
            <span className="folio-label block">Show figures inline</span>
            <SegmentedControl<FiguresInlineMode>
              ariaLabel="Show figures inline"
              layoutGroupId="settings-figures-inline"
              value={settings.figuresInline}
              onChange={(v) => updateSettings({ figuresInline: v })}
              className="w-full grid grid-cols-3"
              options={[
                { value: 'on', label: 'On' },
                { value: 'gallery-only', label: 'Gallery only' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <span className="folio-label block">Opening animation</span>
            <SegmentedControl<OpeningAnimationStyle>
              ariaLabel="Opening animation style"
              layoutGroupId="settings-opening-anim"
              value={settings.openingAnimation}
              onChange={(v) => updateSettings({ openingAnimation: v })}
              className="w-full grid grid-cols-4"
              options={[
                { value: 'rise', label: 'Rise' },
                { value: 'typewriter', label: 'Typewriter' },
                { value: 'ink-fade', label: 'Ink fade' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <span className="folio-label block">Motion</span>
            <SegmentedControl<MotionPreference>
              ariaLabel="Motion preference"
              layoutGroupId="settings-motion-seg"
              value={settings.motion}
              onChange={(m) => updateSettings({ motion: m })}
              className="w-full grid grid-cols-3"
              options={[
                { value: 'system', label: 'System' },
                { value: 'reduced', label: 'Reduced' },
                { value: 'full', label: 'Full' },
              ]}
            />
          </div>
        </section>

        {/* 6. Text extraction toggles */}
        <section className="py-4 space-y-3" aria-label="Text extraction options">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="switch-join-words" className="text-sm font-medium text-ink block">
                Join split words
              </label>
              <span className="text-xs text-ink-3">
                Rejoin lowercase words hyphenated at line ends
              </span>
            </div>
            <FolioSwitch
              id="switch-join-words"
              label="Join split words"
              checked={settings.joinSplitWords}
              onCheckedChange={(v) => applyTypographyChange({ joinSplitWords: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-line/60">
            <div>
              <label htmlFor="switch-furniture" className="text-sm font-medium text-ink block">
                Show page furniture
              </label>
              <span className="text-xs text-ink-3">
                Restore repeated running headers and footers
              </span>
            </div>
            <FolioSwitch
              id="switch-furniture"
              label="Show page furniture"
              checked={settings.showFurniture}
              onCheckedChange={(v) => applyTypographyChange({ showFurniture: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-line/60">
            <div>
              <label htmlFor="switch-justify" className="text-sm font-medium text-ink block">
                Justify text
              </label>
              <span className="text-xs text-ink-3">
                Align both edges with automatic hyphenation
              </span>
            </div>
            <FolioSwitch
              id="switch-justify"
              label="Justify text"
              checked={settings.justify}
              onCheckedChange={(v) => applyTypographyChange({ justify: v })}
            />
          </div>
        </section>

        {/* Storage & Figure Management (Section 9) */}
        <section className="py-4 space-y-2.5" aria-label="Device storage">
          <div className="flex items-center justify-between">
            <span className="folio-label">Device storage used</span>
            <span className="font-folio text-xs text-ink-2">
              {storageUsed ? formatBytes(storageUsed.usage) : 'Local IndexedDB'}
            </span>
          </div>
          {docId && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {onRescanFigures && (
                <button
                  type="button"
                  onClick={onRescanFigures}
                  className="btn-press text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink min-h-[38px]"
                >
                  Rescan figures
                </button>
              )}
              {figureCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFiguresForDocument(docId);
                    toast('Deleted extracted figures for this document');
                  }}
                  className="btn-press text-xs font-medium text-state-error underline underline-offset-4 hover:opacity-85 min-h-[38px]"
                >
                  Delete figures ({figureCount})
                </button>
              )}
            </div>
          )}
        </section>

        {/* Keyboard shortcuts reference (shown on desktop) */}
        <section className="hidden lg:block py-4 space-y-2" aria-label="Keyboard shortcuts">
          <span className="folio-label block">Keyboard shortcuts</span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-2">
            <div className="flex justify-between">
              <dt>Toggle mode</dt>
              <dd className="font-mono text-ink">m</dd>
            </div>
            <div className="flex justify-between">
              <dt>Bookmark page</dt>
              <dd className="font-mono text-ink">b</dd>
            </div>
            <div className="flex justify-between">
              <dt>Settings</dt>
              <dd className="font-mono text-ink">,</dd>
            </div>
            <div className="flex justify-between">
              <dt>Text size</dt>
              <dd className="font-mono text-ink">[ / ]</dd>
            </div>
            <div className="flex justify-between">
              <dt>Paged turn</dt>
              <dd className="font-mono text-ink">← / → / Space</dd>
            </div>
            <div className="flex justify-between">
              <dt>Close panel</dt>
              <dd className="font-mono text-ink">Esc</dd>
            </div>
          </dl>
        </section>

        {/* Reset to defaults text button at the bottom */}
        <div className="pt-4 pb-2 flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              onBeforeTypographyChange?.();
              resetToDefaults();
            }}
            className="btn-press text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink min-h-[44px] px-1"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </Sheet>
  );
}

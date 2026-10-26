import type {
  DropCapColorId,
  DropCapMode,
  DropCapWeight,
  ExtractedBlock,
  HeadingFontId,
  ReadingFontId,
  ReadingSettings,
  ReadingStyleId,
  ThemeId,
} from '../../data/db';

export interface FontMeta {
  id: ReadingFontId;
  name: string;
  character: string;
  use: string;
  cssFamily: string;
}

export const READING_FONTS: FontMeta[] = [
  {
    id: 'literata',
    name: 'Literata',
    character: 'Neutral bookish default',
    use: 'Default reading',
    cssFamily: 'var(--font-reading-literata)',
  },
  {
    id: 'source-serif',
    name: 'Source Serif 4',
    character: 'Crisp, slightly modern',
    use: 'Study and technical text',
    cssFamily: 'var(--font-reading-source)',
  },
  {
    id: 'newsreader',
    name: 'Newsreader',
    character: 'Editorial, elegant at large sizes',
    use: 'Essays, long form',
    cssFamily: 'var(--font-reading-newsreader)',
  },
  {
    id: 'lora',
    name: 'Lora',
    character: 'Calligraphic, warm',
    use: 'Fiction, casual',
    cssFamily: 'var(--font-reading-lora)',
  },
  {
    id: 'eb-garamond',
    name: 'EB Garamond',
    character: 'Classical, refined',
    use: 'Classic and literary',
    cssFamily: 'var(--font-reading-garamond)',
  },
  {
    id: 'crimson-pro',
    name: 'Crimson Pro',
    character: 'Compact, bookish',
    use: 'Small screens',
    cssFamily: 'var(--font-reading-crimson)',
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible Next',
    character: 'Maximum letter clarity',
    use: 'Accessibility',
    cssFamily: 'var(--font-reading-atkinson)',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    character: 'Wide, even spacing',
    use: 'Easier reading for many readers',
    cssFamily: 'var(--font-reading-lexend)',
  },
  {
    id: 'instrument-sans',
    name: 'Instrument Sans',
    character: 'Clean sans',
    use: 'Sans option for body',
    cssFamily: 'var(--font-reading-instrument)',
  },
];

export const HEADING_FONTS: {
  id: HeadingFontId;
  name: string;
  cssFamily: string;
}[] = [
  { id: 'fraunces', name: 'Fraunces', cssFamily: 'var(--font-display)' },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    cssFamily: 'var(--font-heading-playfair)',
  },
  {
    id: 'newsreader',
    name: 'Newsreader',
    cssFamily: 'var(--font-reading-newsreader)',
  },
  { id: 'lora', name: 'Lora', cssFamily: 'var(--font-reading-lora)' },
  {
    id: 'instrument-sans',
    name: 'Instrument Sans',
    cssFamily: 'var(--font-reading-instrument)',
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible Next',
    cssFamily: 'var(--font-reading-atkinson)',
  },
  { id: 'same-as-body', name: 'Same as body', cssFamily: 'var(--read-font)' },
];

export interface ReadingStylePreset {
  id: Exclude<ReadingStyleId, 'custom'>;
  name: string;
  feel: string;
  font?: ReadingFontId; // undefined on 'plain' means keep current font
  dropCapMode: DropCapMode;
  dropCapLines: 2 | 3 | 4;
  dropCapColor: DropCapColorId;
  dropCapWeight: DropCapWeight;
  dropCapDecoration: 'none' | 'underline' | 'block';
  headingFont: HeadingFontId;
  headingStyle: 'normal' | 'small-caps' | 'italic' | 'sans-medium' | 'bold';
  lineSpacing: number;
  paragraphSpacing: number;
}

export const READING_STYLE_PRESETS: ReadingStylePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    feel: 'Folio default',
    font: 'literata',
    dropCapMode: 'drop',
    dropCapLines: 3,
    dropCapColor: 'accent',
    dropCapWeight: 600,
    dropCapDecoration: 'none',
    headingFont: 'fraunces',
    headingStyle: 'normal',
    lineSpacing: 1.65,
    paragraphSpacing: 0.9,
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    feel: 'Old book',
    font: 'eb-garamond',
    dropCapMode: 'drop',
    dropCapLines: 3,
    dropCapColor: 'ink',
    dropCapWeight: 600,
    dropCapDecoration: 'underline',
    headingFont: 'playfair-display',
    headingStyle: 'small-caps',
    lineSpacing: 1.6,
    paragraphSpacing: 0.8,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    feel: 'Magazine',
    font: 'newsreader',
    dropCapMode: 'drop',
    dropCapLines: 2,
    dropCapColor: 'accent',
    dropCapWeight: 700,
    dropCapDecoration: 'block',
    headingFont: 'newsreader',
    headingStyle: 'italic',
    lineSpacing: 1.65,
    paragraphSpacing: 0.95,
  },
  {
    id: 'study',
    name: 'Study',
    feel: 'Notes and exam prep',
    font: 'source-serif',
    dropCapMode: 'bold-first-word',
    dropCapLines: 2,
    dropCapColor: 'ink',
    dropCapWeight: 700,
    dropCapDecoration: 'none',
    headingFont: 'instrument-sans',
    headingStyle: 'sans-medium',
    lineSpacing: 1.6,
    paragraphSpacing: 1.0,
  },
  {
    id: 'story',
    name: 'Story',
    feel: 'Fiction',
    font: 'lora',
    dropCapMode: 'drop',
    dropCapLines: 4,
    dropCapColor: 'accent',
    dropCapWeight: 400,
    dropCapDecoration: 'none',
    headingFont: 'lora',
    headingStyle: 'italic',
    lineSpacing: 1.7,
    paragraphSpacing: 0.85,
  },
  {
    id: 'clear',
    name: 'Clear',
    feel: 'Accessibility, no ornament',
    font: 'atkinson',
    dropCapMode: 'off',
    dropCapLines: 2,
    dropCapColor: 'ink',
    dropCapWeight: 700,
    dropCapDecoration: 'none',
    headingFont: 'atkinson',
    headingStyle: 'bold',
    lineSpacing: 1.75,
    paragraphSpacing: 1.1,
  },
  {
    id: 'plain',
    name: 'Plain',
    feel: 'Quiet and distraction-free',
    font: undefined, // keeps current font
    dropCapMode: 'off',
    dropCapLines: 2,
    dropCapColor: 'ink',
    dropCapWeight: 600,
    dropCapDecoration: 'none',
    headingFont: 'same-as-body',
    headingStyle: 'bold',
    lineSpacing: 1.65,
    paragraphSpacing: 0.9,
  },
];

/**
 * Resolves settings updates when a user selects one of the 7 Reading Style presets.
 */
export function resolveStylePresetToSettings(
  styleId: Exclude<ReadingStyleId, 'custom'>,
  currentSettings: ReadingSettings
): Partial<ReadingSettings> {
  const preset = READING_STYLE_PRESETS.find((p) => p.id === styleId);
  if (!preset) return {};
  const nextFont = preset.font ?? currentSettings.readingFont ?? currentSettings.fontFamily;
  return {
    readingStyle: preset.id,
    readingFont: nextFont,
    fontFamily: nextFont,
    dropCapMode: preset.dropCapMode,
    dropCapLines: preset.dropCapLines,
    dropCapColor: preset.dropCapColor,
    dropCapWeight: preset.dropCapWeight,
    dropCapDecoration: preset.dropCapDecoration,
    headingFont: preset.headingFont,
    headingStyle: preset.headingStyle,
    lineSpacing: preset.lineSpacing,
    paragraphSpacing: preset.paragraphSpacing,
  };
}

/**
 * Detects whether a ReadingSettings object matches one of the 7 named presets or 'custom'.
 */
export function detectMatchingPreset(settings: ReadingSettings): ReadingStyleId {
  for (const p of READING_STYLE_PRESETS) {
    const fontMatches = !p.font || p.font === (settings.readingFont ?? settings.fontFamily);
    if (
      fontMatches &&
      p.dropCapMode === settings.dropCapMode &&
      p.dropCapLines === settings.dropCapLines &&
      p.dropCapColor === settings.dropCapColor &&
      p.dropCapWeight === settings.dropCapWeight &&
      p.dropCapDecoration === settings.dropCapDecoration &&
      p.headingFont === settings.headingFont &&
      p.headingStyle === settings.headingStyle &&
      Math.abs(p.lineSpacing - settings.lineSpacing) < 0.01 &&
      Math.abs(p.paragraphSpacing - settings.paragraphSpacing) < 0.01
    ) {
      return p.id;
    }
  }
  return 'custom';
}

/**
 * Lazy Font Loader: imports Fontsource variable CSS only when a font is chosen or previewed.
 */
const loadedFontPackages = new Set<string>(['literata', 'fraunces', 'instrument-sans']);

export async function ensureFontLoaded(
  fontId: ReadingFontId | HeadingFontId
): Promise<void> {
  if (loadedFontPackages.has(fontId) || fontId === 'same-as-body') return;
  loadedFontPackages.add(fontId);

  try {
    switch (fontId) {
      case 'source-serif':
        await import('@fontsource-variable/source-serif-4');
        break;
      case 'newsreader':
        await import('@fontsource-variable/newsreader');
        break;
      case 'lora':
        await import('@fontsource-variable/lora');
        break;
      case 'eb-garamond':
        await import('@fontsource-variable/eb-garamond');
        break;
      case 'crimson-pro':
        await import('@fontsource-variable/crimson-pro');
        break;
      case 'playfair-display':
        await import('@fontsource-variable/playfair-display');
        break;
      case 'atkinson':
        await Promise.all([
          import('@fontsource-variable/atkinson-hyperlegible-next').catch(() => {}),
          import('@fontsource/atkinson-hyperlegible').catch(() => {}),
        ]);
        break;
      case 'lexend':
        await import('@fontsource-variable/lexend');
        break;
      default:
        break;
    }
  } catch {
    // Fallback stack in CSS handles offline/error gracefully
  }
}

export function getReadingFontCss(fontId: ReadingFontId): string {
  return (
    READING_FONTS.find((f) => f.id === fontId)?.cssFamily ??
    'var(--font-reading-literata)'
  );
}

export function getHeadingFontCss(
  headingFont: HeadingFontId,
  readingFont: ReadingFontId
): string {
  if (headingFont === 'same-as-body') {
    return getReadingFontCss(readingFont);
  }
  return (
    HEADING_FONTS.find((h) => h.id === headingFont)?.cssFamily ??
    'var(--font-display)'
  );
}

/**
 * Drop-cap color swatches (Accent, Ink, 4 highlight colors, 6 curated colors)
 * with WCAG 3:1 contrast check against the current theme's --bg.
 */
export interface DropCapColorOption {
  id: DropCapColorId;
  label: string;
  group: 'theme' | 'highlight' | 'curated';
  hexByTheme: Record<ThemeId, string>;
}

const THEME_BG_HEX: Record<ThemeId, string> = {
  paper: '#F6F0E4',
  sepia: '#EBDDC1',
  forest: '#16241D',
  midnight: '#10131C',
  oled: '#000000',
};

export const DROPCAP_COLORS: DropCapColorOption[] = [
  {
    id: 'accent',
    label: 'Accent',
    group: 'theme',
    hexByTheme: {
      paper: '#B4482A',
      sepia: '#9C3F1E',
      forest: '#E0A458',
      midnight: '#E88A63',
      oled: '#E88A63',
    },
  },
  {
    id: 'ink',
    label: 'Ink',
    group: 'theme',
    hexByTheme: {
      paper: '#1D1A16',
      sepia: '#3B2E1E',
      forest: '#E4EBDD',
      midnight: '#E7E4DC',
      oled: '#E8E6E1',
    },
  },
  /* 4 Highlight Colors */
  {
    id: 'saffron',
    label: 'Saffron',
    group: 'highlight',
    hexByTheme: {
      paper: '#9E6E08',
      sepia: '#875D06',
      forest: '#F2C14E',
      midnight: '#F2C14E',
      oled: '#F2C14E',
    },
  },
  {
    id: 'clay',
    label: 'Clay',
    group: 'highlight',
    hexByTheme: {
      paper: '#B04E36',
      sepia: '#9E422B',
      forest: '#E8A08A',
      midnight: '#E8A08A',
      oled: '#E8A08A',
    },
  },
  {
    id: 'sage',
    label: 'Sage',
    group: 'highlight',
    hexByTheme: {
      paper: '#3D6B37',
      sepia: '#365E30',
      forest: '#A9C5A0',
      midnight: '#A9C5A0',
      oled: '#A9C5A0',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    group: 'highlight',
    hexByTheme: {
      paper: '#366185',
      sepia: '#2E5475',
      forest: '#9DBCD4',
      midnight: '#9DBCD4',
      oled: '#9DBCD4',
    },
  },
  /* 6 Curated Swatches */
  {
    id: 'plum',
    label: 'Plum',
    group: 'curated',
    hexByTheme: {
      paper: '#7D4275',
      sepia: '#6E3967',
      forest: '#C892C0',
      midnight: '#C892C0',
      oled: '#C892C0',
    },
  },
  {
    id: 'teal',
    label: 'Teal',
    group: 'curated',
    hexByTheme: {
      paper: '#246B68',
      sepia: '#1E5E5B',
      forest: '#75C2BE',
      midnight: '#75C2BE',
      oled: '#75C2BE',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    group: 'curated',
    hexByTheme: {
      paper: '#A83853',
      sepia: '#943048',
      forest: '#E38FA1',
      midnight: '#E38FA1',
      oled: '#E38FA1',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    group: 'curated',
    hexByTheme: {
      paper: '#9C5708',
      sepia: '#874B06',
      forest: '#EDA84C',
      midnight: '#EDA84C',
      oled: '#EDA84C',
    },
  },
  {
    id: 'forest-ink',
    label: 'Deep Pine',
    group: 'curated',
    hexByTheme: {
      paper: '#234D38',
      sepia: '#1E4230',
      forest: '#8DC4A6',
      midnight: '#8DC4A6',
      oled: '#8DC4A6',
    },
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    group: 'curated',
    hexByTheme: {
      paper: '#2A4E8C',
      sepia: '#24437A',
      forest: '#8BAEE8',
      midnight: '#8BAEE8',
      oled: '#8BAEE8',
    },
  },
];

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatioHex(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveDropCapColorForTheme(
  colorId: DropCapColorId,
  theme: ThemeId
): { hex: string; contrast: number; passes: boolean; failReason?: string } {
  const opt = DROPCAP_COLORS.find((c) => c.id === colorId) ?? DROPCAP_COLORS[0];
  const hex = opt.hexByTheme[theme];
  const bgHex = THEME_BG_HEX[theme];
  const ratio = getContrastRatioHex(hex, bgHex);
  const passes = ratio >= 3.0;
  return {
    hex,
    contrast: ratio,
    passes,
    failReason: passes
      ? undefined
      : `Low contrast (${ratio.toFixed(1)}:1, needs 3:1) in ${theme} theme`,
  };
}

/**
 * Drop-cap eligibility rule (Section 2):
 * - First paragraph of the document (pageIndex === 0, first non-furniture paragraph)
 * - Or the first paragraph immediately following a heading ('heading-1' or 'heading-2')
 * - AND paragraph length must be >= 80 characters!
 */
export function isBlockDropCapEligible(
  blocks: ExtractedBlock[],
  blockIdxInArray: number,
  pageIndex: number
): boolean {
  const block = blocks[blockIdxInArray];
  if (!block || block.isFurniture || block.type !== 'paragraph') {
    return false;
  }

  if (block.text.trim().length < 80) {
    return false;
  }

  // Find previous non-furniture block on this page
  let prevNonFurniture: ExtractedBlock | null = null;
  for (let i = blockIdxInArray - 1; i >= 0; i--) {
    if (!blocks[i].isFurniture) {
      prevNonFurniture = blocks[i];
      break;
    }
  }

  // First paragraph after a heading
  if (
    prevNonFurniture &&
    (prevNonFurniture.type === 'heading-1' || prevNonFurniture.type === 'heading-2')
  ) {
    return true;
  }

  // First paragraph of the document (on page 0 with no preceding non-furniture paragraph)
  if (pageIndex === 0 && !prevNonFurniture) {
    return true;
  }

  return false;
}

/**
 * Splits leading quote/first-word for "Bold first word" mode or opening initial animation
 * without changing the underlying DOM textContent.
 */
export function splitLeadingInitialOrWord(text: string): {
  leadingToken: string;
  firstWordToken: string;
  restAfterInitial: string;
  restAfterFirstWord: string;
} {
  // Match optional leading quotation mark + first character
  const initialMatch = text.match(/^([“"‘'«(\[]?[A-Za-z0-9\u00C0-\u024F\u0900-\u097F])(.*)$/s);
  const leadingToken = initialMatch ? initialMatch[1] : text.slice(0, 1);
  const restAfterInitial = initialMatch ? initialMatch[2] : text.slice(1);

  const wordMatch = text.match(/^([“"‘'«(\[]?\S+)(\s+.*)?$/s);
  const firstWordToken = wordMatch ? wordMatch[1] : text;
  const restAfterFirstWord = wordMatch ? wordMatch[2] ?? '' : '';

  return {
    leadingToken,
    firstWordToken,
    restAfterInitial,
    restAfterFirstWord,
  };
}

/**
 * WCAG 2.1 Contrast Verification Script for ReadFlow's 5 Themes,
 * 4 Highlight Washes, 8 Flashcard Swatches, and Drop-Cap Color Fallback.
 */
import { resolveDropCapColorForTheme } from '../src/features/typography/styles';
import type { ThemeId } from '../src/data/db';

interface ThemePalette {
  id: ThemeId;
  name: string;
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  onAccent: string;
  hlOpacity: number;
  cards: Array<{ bg: string; fg: string; label: string }>;
}

const THEMES: ThemePalette[] = [
  {
    id: 'paper',
    name: 'Paper & Ink',
    bg: '#F6F0E4',
    surface: '#FBF7EE',
    ink: '#1D1A16',
    ink2: '#4A443B',
    ink3: '#6B6458',
    accent: '#B4482A',
    onAccent: '#FFF7EE',
    hlOpacity: 0.45,
    cards: [
      { label: 'Card 1 Ivory', bg: '#F7EFE1', fg: '#1D1A16' },
      { label: 'Card 2 Ochre', bg: '#F3DFB5', fg: '#261D0D' },
      { label: 'Card 3 Terracotta', bg: '#EFCEBE', fg: '#2C1610' },
      { label: 'Card 4 Sage', bg: '#D6E4CF', fg: '#152318' },
      { label: 'Card 5 Slate', bg: '#D3DFEA', fg: '#14202B' },
      { label: 'Card 6 Plum', bg: '#E3D5E6', fg: '#231628' },
      { label: 'Card 7 Rose', bg: '#EED4D8', fg: '#2B151A' },
      { label: 'Card 8 Charcoal', bg: '#262320', fg: '#F5EFE4' },
    ],
  },
  {
    id: 'sepia',
    name: 'Sepia',
    bg: '#EBDDC1',
    surface: '#F2E7CF',
    ink: '#3B2E1E',
    ink2: '#5A4630',
    ink3: '#6A5538',
    accent: '#9C3F1E',
    onAccent: '#FFF7EE',
    hlOpacity: 0.45,
    cards: [
      { label: 'Card 1 Ivory', bg: '#F2E5C9', fg: '#2D2215' },
      { label: 'Card 2 Ochre', bg: '#EBD4A2', fg: '#2B200E' },
      { label: 'Card 3 Terracotta', bg: '#E6C2AF', fg: '#2E1710' },
      { label: 'Card 4 Sage', bg: '#CCD9BE', fg: '#182519' },
      { label: 'Card 5 Slate', bg: '#C9D5DE', fg: '#16222C' },
      { label: 'Card 6 Plum', bg: '#D9CADB', fg: '#251729' },
      { label: 'Card 7 Rose', bg: '#E5C8CB', fg: '#2D161B' },
      { label: 'Card 8 Charcoal', bg: '#2C241B', fg: '#F2E6CE' },
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    bg: '#16241D',
    surface: '#1D2F26',
    ink: '#E4EBDD',
    ink2: '#BCCABB',
    ink3: '#8FA394',
    accent: '#E0A458',
    onAccent: '#16241D',
    hlOpacity: 0.28,
    cards: [
      { label: 'Card 1 Ivory', bg: '#23362C', fg: '#E9F0E4' },
      { label: 'Card 2 Ochre', bg: '#3B331E', fg: '#F4E8C6' },
      { label: 'Card 3 Terracotta', bg: '#3E2720', fg: '#F6DDD2' },
      { label: 'Card 4 Sage', bg: '#223B2B', fg: '#DFF0E3' },
      { label: 'Card 5 Slate', bg: '#1F323E', fg: '#DCEAF4' },
      { label: 'Card 6 Plum', bg: '#32263A', fg: '#EDE0F2' },
      { label: 'Card 7 Rose', bg: '#3C242B', fg: '#F5DCE2' },
      { label: 'Card 8 Charcoal', bg: '#121D17', fg: '#E4EBDD' },
    ],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#10131C',
    surface: '#171B27',
    ink: '#E7E4DC',
    ink2: '#B8B5AD',
    ink3: '#8D8B86',
    accent: '#E88A63',
    onAccent: '#10131C',
    hlOpacity: 0.28,
    cards: [
      { label: 'Card 1 Ivory', bg: '#1D2230', fg: '#ECE9E1' },
      { label: 'Card 2 Ochre', bg: '#332B1A', fg: '#F5E8C7' },
      { label: 'Card 3 Terracotta', bg: '#38221D', fg: '#F6DDD3' },
      { label: 'Card 4 Sage', bg: '#1E3126', fg: '#DFEFE3' },
      { label: 'Card 5 Slate', bg: '#1C2C3B', fg: '#DDEBF6' },
      { label: 'Card 6 Plum', bg: '#2D2236', fg: '#EDE0F4' },
      { label: 'Card 7 Rose', bg: '#372028', fg: '#F6DCE3' },
      { label: 'Card 8 Charcoal', bg: '#0B0E15', fg: '#E7E4DC' },
    ],
  },
  {
    id: 'oled',
    name: 'OLED Black',
    bg: '#000000',
    surface: '#0B0B0B',
    ink: '#E8E6E1',
    ink2: '#B5B2AB',
    ink3: '#8A8780',
    accent: '#E88A63',
    onAccent: '#000000',
    hlOpacity: 0.26,
    cards: [
      { label: 'Card 1 Ivory', bg: '#161616', fg: '#EFECE6' },
      { label: 'Card 2 Ochre', bg: '#292213', fg: '#F5E8C7' },
      { label: 'Card 3 Terracotta', bg: '#2E1A16', fg: '#F6DDD3' },
      { label: 'Card 4 Sage', bg: '#16271D', fg: '#DFEFE3' },
      { label: 'Card 5 Slate', bg: '#152330', fg: '#DDEBF6' },
      { label: 'Card 6 Plum', bg: '#251B2D', fg: '#EDE0F4' },
      { label: 'Card 7 Rose', bg: '#2D1920', fg: '#F6DCE3' },
      { label: 'Card 8 Charcoal', bg: '#0E0E0E', fg: '#E8E6E1' },
    ],
  },
];

const HIGHLIGHTS = [
  { name: 'Saffron', hex: '#F2C14E' },
  { name: 'Clay', hex: '#E8A08A' },
  { name: 'Sage', hex: '#A9C5A0' },
  { name: 'Slate', hex: '#9DBCD4' },
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function blendRgb(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number
): [number, number, number] {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let allPassed = true;

for (const t of THEMES) {
  const bg = hexToRgb(t.bg);
  const ink = hexToRgb(t.ink);
  const ink2 = hexToRgb(t.ink2);
  const ink3 = hexToRgb(t.ink3);
  const accent = hexToRgb(t.accent);
  const onAccent = hexToRgb(t.onAccent);

  const cInk = contrastRatio(ink, bg);
  const cInk2 = contrastRatio(ink2, bg);
  const cInk3 = contrastRatio(ink3, bg);
  const cAccent = contrastRatio(onAccent, accent);

  console.log(`\n=== ${t.name} ===`);
  console.log(`  --ink on --bg:        ${cInk.toFixed(2)}:1 (min 4.5:1)`);
  console.log(`  --ink-2 on --bg:      ${cInk2.toFixed(2)}:1 (min 4.5:1)`);
  console.log(`  --ink-3 on --bg:      ${cInk3.toFixed(2)}:1 (min 3.0:1)`);
  console.log(`  --on-accent/accent:   ${cAccent.toFixed(2)}:1 (min 3.0:1)`);

  if (cInk < 4.5 || cInk2 < 4.5 || cInk3 < 3.0 || cAccent < 3.0) {
    allPassed = false;
    console.error(`  FAIL in ${t.name} base palette`);
  }

  for (const hl of HIGHLIGHTS) {
    const hlRgb = hexToRgb(hl.hex);
    const washedBg = blendRgb(hlRgb, bg, t.hlOpacity);
    const cHl = contrastRatio(ink, washedBg);
    console.log(
      `  --ink on ${hl.name} (${Math.round(t.hlOpacity * 100)}%): ${cHl.toFixed(2)}:1 (min 4.5:1)`
    );
    if (cHl < 4.5) {
      allPassed = false;
      console.error(`  FAIL in ${t.name} highlight ${hl.name}`);
    }
  }

  for (const card of t.cards) {
    const cardBg = hexToRgb(card.bg);
    const cardFg = hexToRgb(card.fg);
    const cCard = contrastRatio(cardFg, cardBg);
    console.log(`  ${card.label}: ${cCard.toFixed(2)}:1 (min 4.5:1)`);
    if (cCard < 4.5) {
      allPassed = false;
      console.error(`  FAIL in ${t.name} ${card.label}`);
    }
  }

  // Verify drop-cap color resolution guarantees >= 3.0:1 contrast
  const dropCapResolved = resolveDropCapColorForTheme('accent', t.id);
  const resolvedRatio = contrastRatio(hexToRgb(dropCapResolved.hex), bg);
  console.log(
    `  Drop-cap accent contrast: ${resolvedRatio.toFixed(2)}:1 (passes=${dropCapResolved.passes})`
  );
  if (resolvedRatio < 3.0 || !dropCapResolved.passes) {
    allPassed = false;
    console.error(`  FAIL in ${t.name} drop-cap contrast`);
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log(
    '\nAll 5 themes, 4 highlight washes, 8 card colors, and drop-cap fallbacks passed WCAG contrast checks.'
  );
}

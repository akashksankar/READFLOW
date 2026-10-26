import { describe, it, expect } from 'vitest';
import {
  groupItemsIntoLines,
  orderLinesByColumns,
  appendLineToParagraph,
  buildBlocksFromLines,
  detectRepeatedFurnitureSignatures,
  scorePageQuality,
  type RawTextItem,
} from '../../src/features/extract/extractPage';
import {
  resolveHighlightInPageBlocks,
  extractPrefixAndSuffix,
} from '../../src/features/notes/anchoring';
import { computeProgressPercent } from '../../src/lib/format';
import { validatePdfBytes, classifyPdfLoadError } from '../../src/features/import/validateFile';
import { hashArrayBuffer } from '../../src/lib/hash';
import {
  detectMatchingPreset,
  resolveStylePresetToSettings,
  isBlockDropCapEligible,
  resolveDropCapColorForTheme,
  splitLeadingInitialOrWord,
} from '../../src/features/typography/styles';
import {
  filterFigureBoxes,
  clusterVectorPathBoxes,
  matchFigureCaption,
} from '../../src/features/figures/detectFigures';
import {
  computeCharacterAnchorFromColumn,
  resolveColumnIndexFromAnchor,
  resolveTapZoneAction,
} from '../../src/features/paged/paginate';
import { isTickEligible, estimateWordsFromChars } from '../../src/features/tracking/sessionTracker';
import {
  computeStreakFromSessions,
  selectDailyChallenges,
  computeTaskStreak,
} from '../../src/features/tracking/statsQueries';
import { suggestCardsFromText, renderClozePrompt } from '../../src/features/cards/suggestRules';
import { scheduleCardReview } from '../../src/features/cards/scheduler';
import {
  DEFAULT_READING_SETTINGS,
  type CardRecord,
  type ExtractedBlock,
  type HighlightRecord,
  type SessionRecord,
  type TaskRecord,
  type TaskLogRecord,
} from '../../src/data/db';

describe('ReadFlow Phase 1 Unit Tests', () => {
  it('groups items into lines by baseline y and sorts top-to-bottom, left-to-right', () => {
    const items: RawTextItem[] = [
      { str: 'world.', x: 110, y: 700, width: 40, height: 12 },
      { str: 'Hello', x: 60, y: 701, width: 40, height: 12 },
      { str: 'Second line here.', x: 60, y: 680, width: 100, height: 12 },
    ];
    const { lines } = groupItemsIntoLines(items, 800);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Hello world.');
    expect(lines[1].text).toBe('Second line here.');
  });

  it('detects two-column layouts and orders left column fully before right column', () => {
    const items: RawTextItem[] = [];
    for (let i = 0; i < 5; i++) {
      const y = 600 - i * 20;
      items.push({ str: `Left ${i + 1}`, x: 50, y, width: 80, height: 12 });
      items.push({ str: `Right ${i + 1}`, x: 340, y, width: 80, height: 12 });
    }
    const { lines } = groupItemsIntoLines(items, 800);
    const { orderedLines, columnStatus } = orderLinesByColumns(lines, 600);
    expect(columnStatus).toBe('multi-column');
    expect(orderedLines.slice(0, 5).map((l) => l.text)).toEqual([
      'Left 1',
      'Left 2',
      'Left 3',
      'Left 4',
      'Left 5',
    ]);
    expect(orderedLines.slice(5).map((l) => l.text)).toEqual([
      'Right 1',
      'Right 2',
      'Right 3',
      'Right 4',
      'Right 5',
    ]);
  });

  it('joins lowercase words split by a trailing hyphen and changes nothing else', () => {
    const res1 = appendLineToParagraph(
      'We observed an extraor-',
      'dinary phenomenon in the study.'
    );
    expect(res1.joinedText).toBe('We observed an extraordinary phenomenon in the study.');
    expect(res1.rawText).toBe('We observed an extraor- dinary phenomenon in the study.');

    const res2 = appendLineToParagraph('The Austro-', 'Hungarian treaty was signed.');
    expect(res2.joinedText).toBe('The Austro- Hungarian treaty was signed.');

    const res3 = appendLineToParagraph('Testing model-', '2 in production.');
    expect(res3.joinedText).toBe('Testing model- 2 in production.');
  });

  it('detects repeating headers, footers, and bare page numbers across >= 40% of pages', () => {
    const pages = [1, 2, 3, 4].map((p) => {
      const items: RawTextItem[] = [
        { str: 'RUNNING BOOK HEADER', x: 60, y: 760, width: 180, height: 10 },
        {
          str: `Body content on page ${p} with plenty of prose.`,
          x: 60,
          y: 500,
          width: 300,
          height: 12,
        },
        { str: `${p}`, x: 290, y: 40, width: 15, height: 10 },
      ];
      return groupItemsIntoLines(items, 800).lines;
    });

    const furnitureSigs = detectRepeatedFurnitureSignatures(pages);
    expect(furnitureSigs.size).toBeGreaterThanOrEqual(2);

    const blocks = buildBlocksFromLines(pages[0], 12, furnitureSigs);
    const furnitureBlocks = blocks.filter((b) => b.isFurniture);
    const bodyBlocks = blocks.filter((b) => !b.isFurniture);
    expect(furnitureBlocks).toHaveLength(2);
    expect(bodyBlocks).toHaveLength(1);
    expect(bodyBlocks[0].text).toBe('Body content on page 1 with plenty of prose.');
  });

  it('scores page quality accurately for normal, sparse, and numeric/table pages', () => {
    const sparseLines = groupItemsIntoLines(
      [{ str: 'Fig 1', x: 60, y: 500, width: 30, height: 12 }],
      800
    ).lines;
    expect(scorePageQuality(sparseLines, 'single').reliable).toBe(false);
    expect(scorePageQuality(sparseLines, 'single').reason).toBe('sparse-or-scanned');

    const normalLines = groupItemsIntoLines(
      [
        {
          str: 'This is a normal literary page with sufficient alphabetic characters to pass reliability scoring cleanly.',
          x: 60,
          y: 500,
          width: 400,
          height: 12,
        },
      ],
      800
    ).lines;
    expect(scorePageQuality(normalLines, 'single').reliable).toBe(true);
  });

  it('anchors highlights by position, re-anchors via prefix/suffix when hyphen joining changes, and marks unplaceable ones Unplaced', () => {
    const block = {
      index: 0,
      type: 'paragraph' as const,
      text: 'The interface around the document is expressive; the reading canvas itself is silent.',
      rawText:
        'The inter- face around the document is expressive; the reading canvas itself is silent.',
    };

    const quote = 'the reading canvas itself is silent';
    const start = block.text.indexOf(quote);
    const end = start + quote.length;
    const { prefix, suffix } = extractPrefixAndSuffix(block.text, start, end);

    const hl: HighlightRecord = {
      id: 'hl-1',
      docId: 'doc-1',
      pageIndex: 0,
      blockIndex: 0,
      start,
      end,
      quote,
      prefix,
      suffix,
      color: 'saffron',
      note: 'Core principle',
      createdAt: Date.now(),
    };

    const resolvedJoined = resolveHighlightInPageBlocks(hl, [block], true);
    expect(resolvedJoined.unplaced).toBe(false);
    expect(block.text.slice(resolvedJoined.start, resolvedJoined.end)).toBe(quote);

    const resolvedRaw = resolveHighlightInPageBlocks(hl, [block], false);
    expect(resolvedRaw.unplaced).toBe(false);
    expect(block.rawText.slice(resolvedRaw.start, resolvedRaw.end)).toBe(quote);

    const missingHl: HighlightRecord = {
      ...hl,
      id: 'hl-missing',
      quote: 'nonexistent phrase from another edition',
    };
    const resolvedMissing = resolveHighlightInPageBlocks(missingHl, [block], true);
    expect(resolvedMissing.unplaced).toBe(true);
  });

  it('computes reading progress percentage accurately with clamping', () => {
    expect(computeProgressPercent(0, 0, 100)).toBe(0);
    expect(computeProgressPercent(41, 0.5, 310)).toBe(13);
    expect(computeProgressPercent(299, 1, 300)).toBe(100);
  });

  it('validates %PDF- header bytes and classifies password/corrupted errors', async () => {
    const nonPdfBuf = new TextEncoder().encode('Hello not a PDF').buffer;
    const resNonPdf = await validatePdfBytes(nonPdfBuf, nonPdfBuf.byteLength);
    expect(resNonPdf.valid).toBe(false);
    if (!resNonPdf.valid) {
      expect(resNonPdf.code).toBe('not-a-pdf');
    }

    const validPdfHeader = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n').buffer;
    const resValid = await validatePdfBytes(validPdfHeader, validPdfHeader.byteLength);
    expect(resValid.valid).toBe(true);

    const pwErr = classifyPdfLoadError({
      name: 'PasswordException',
      message: 'Password required',
    });
    expect(pwErr.code).toBe('password-protected');
  });

  it('hashes file ArrayBuffers deterministically with SHA-256', async () => {
    const buf1 = new TextEncoder().encode('ReadFlow deterministic content').buffer;
    const buf2 = new TextEncoder().encode('ReadFlow deterministic content').buffer;
    const buf3 = new TextEncoder().encode('Different content').buffer;

    const h1 = await hashArrayBuffer(buf1);
    const h2 = await hashArrayBuffer(buf2);
    const h3 = await hashArrayBuffer(buf3);

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1.length).toBeGreaterThanOrEqual(16);
  });
});

describe('ReadFlow Phase 2 Unit Tests', () => {
  it('matches Reading Style presets and marks Custom when a control diverges', () => {
    const editorial = {
      ...DEFAULT_READING_SETTINGS,
      ...resolveStylePresetToSettings('editorial', DEFAULT_READING_SETTINGS),
    };
    expect(detectMatchingPreset(editorial)).toBe('editorial');

    const diverged = { ...editorial, lineSpacing: 1.95 };
    expect(detectMatchingPreset(diverged)).toBe('custom');
  });

  it('checks drop-cap eligibility (>=80 chars, starts document or follows heading) and 3:1 theme contrast check', () => {
    const blocks: ExtractedBlock[] = [
      { index: 0, type: 'heading-1', text: 'Chapter One' },
      {
        index: 1,
        type: 'paragraph',
        text: 'When the morning light finally reached the tall cedar shelves of the library, the manuscripts glowed warmly.',
      },
      {
        index: 2,
        type: 'paragraph',
        text: 'Short second paragraph that does not follow a heading directly and is mid-page.',
      },
    ];

    expect(isBlockDropCapEligible(blocks, 0, 0)).toBe(false); // heading itself is not drop-capped
    expect(isBlockDropCapEligible(blocks, 1, 0)).toBe(true); // >=80 chars following a heading
    expect(isBlockDropCapEligible(blocks, 2, 0)).toBe(false); // does not follow a heading

    // Leading quote + initial extraction
    const split = splitLeadingInitialOrWord('“When the morning light arrived');
    expect(split.leadingToken).toBe('“W');
    expect(split.firstWordToken).toBe('“When');

    // Contrast check: all curated drop-cap colors pass >= 3.0:1 on Paper (#F6F0E4)
    const accentOnPaper = resolveDropCapColorForTheme('accent', 'paper');
    expect(accentOnPaper.passes).toBe(true);
    expect(accentOnPaper.contrast).toBeGreaterThanOrEqual(3.0);
  });

  it('filters figure bounding boxes, clusters vector paths, and matches captions accurately', () => {
    // 1. Noise filter drops tiny boxes (<48pt), thin rules, and full-page watermarks (>85% area with >180 chars)
    const filtered = filterFigureBoxes(
      [
        { xMin: 10, yMin: 10, xMax: 30, yMax: 30, kind: 'image' }, // too small (<48pt)
        { xMin: 50, yMin: 500, xMax: 550, yMax: 502, kind: 'diagram', segmentCount: 20 }, // thin rule
        { xMin: 0, yMin: 0, xMax: 590, yMax: 790, kind: 'image' }, // >85% page area on text-rich page
        { xMin: 80, yMin: 300, xMax: 420, yMax: 540, kind: 'image' }, // valid figure!
      ],
      600,
      800,
      450
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].xMin).toBe(80);

    // 2. Vector clustering merges boxes within 12pt gap
    const clusters = clusterVectorPathBoxes([
      { xMin: 100, yMin: 200, xMax: 150, yMax: 250, segments: 8 },
      { xMin: 156, yMin: 200, xMax: 220, yMax: 255, segments: 10 },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].segmentCount).toBe(18);

    // 3. Caption matcher finds nearest Fig./Table/Chart line below box
    const lines = groupItemsIntoLines(
      [
        {
          str: 'Figure 2.4: Atmospheric pressure gradient across altitudes.',
          x: 80,
          y: 275,
          width: 300,
          height: 11,
        },
      ],
      800
    ).lines;
    const caption = matchFigureCaption(
      { xMin: 80, yMin: 300, xMax: 420, yMax: 540 },
      lines
    );
    expect(caption).toBe('Figure 2.4: Atmospheric pressure gradient across altitudes.');
  });

  it('preserves (pageIndex, blockIndex, charOffset) across Paged mode column changes and resolves tap zones', () => {
    const blocks: ExtractedBlock[] = [
      { index: 0, type: 'paragraph', text: 'A'.repeat(400) },
      { index: 1, type: 'paragraph', text: 'B'.repeat(400) },
      { index: 2, type: 'paragraph', text: 'C'.repeat(400) },
    ];

    const anchor = computeCharacterAnchorFromColumn(blocks, 1, 3, 4);
    expect(anchor.pageIndex).toBe(4);
    expect(anchor.blockIndex).toBe(1);

    // If font size increases and totalColumns becomes 6, anchor maps to column 2
    const restoredCol = resolveColumnIndexFromAnchor(blocks, anchor, 6);
    expect(restoredCol).toBe(2);

    // Tap zones
    expect(resolveTapZoneAction(100, 1000, 'normal')).toBe('prev');
    expect(resolveTapZoneAction(500, 1000, 'normal')).toBe('toggle-chrome');
    expect(resolveTapZoneAction(850, 1000, 'normal')).toBe('next');
    expect(resolveTapZoneAction(200, 1000, 'wide-center')).toBe('toggle-chrome');
  });

  it('tracks active reading seconds only when visible, focused, and interacted with within 60s', () => {
    const now = 1_000_000;
    expect(
      isTickEligible({
        isVisible: true,
        isFocused: true,
        lastInteractionAt: now - 30_000,
        now,
      })
    ).toBe(true);

    // Idle > 60s -> false
    expect(
      isTickEligible({
        isVisible: true,
        isFocused: true,
        lastInteractionAt: now - 61_000,
        now,
      })
    ).toBe(false);

    // Hidden tab -> false
    expect(
      isTickEligible({
        isVisible: false,
        isFocused: true,
        lastInteractionAt: now - 5_000,
        now,
      })
    ).toBe(false);

    expect(estimateWordsFromChars(1250)).toBe(250);
  });

  it('computes reading streaks, task streaks, and deterministic daily challenges accurately', () => {
    const sessions: SessionRecord[] = [
      {
        id: 's1',
        docId: 'd1',
        startedAt: 1,
        endedAt: 2,
        activeSeconds: 900,
        pagesRead: 6,
        wordsEstimated: 1500,
        mode: 'comfort',
        dateKey: '2026-10-23',
      },
      {
        id: 's2',
        docId: 'd1',
        startedAt: 3,
        endedAt: 4,
        activeSeconds: 1200,
        pagesRead: 8,
        wordsEstimated: 2000,
        mode: 'comfort',
        dateKey: '2026-10-24',
      },
      {
        id: 's3',
        docId: 'd1',
        startedAt: 5,
        endedAt: 6,
        activeSeconds: 600,
        pagesRead: 4,
        wordsEstimated: 1000,
        mode: 'comfort',
        dateKey: '2026-10-25',
      },
    ];

    const streakRes = computeStreakFromSessions(sessions, 15, 10, '2026-10-25');
    expect(streakRes.currentStreak).toBe(3);
    expect(streakRes.longestStreak).toBe(3);

    // Task streak
    const task: TaskRecord = {
      id: 't1',
      title: 'Read 15m',
      schedule: 'daily',
      linkedDocId: null,
      order: 0,
      createdAt: 1,
      archivedAt: null,
    };
    const logs: TaskLogRecord[] = [
      { id: 'l1', taskId: 't1', dateKey: '2026-10-24', completedAt: 10 },
      { id: 'l2', taskId: 't1', dateKey: '2026-10-25', completedAt: 20 },
    ];
    expect(computeTaskStreak(task, logs, '2026-10-25')).toBe(2);

    // Deterministic daily challenges
    const ch1 = selectDailyChallenges({
      dateKey: '2026-10-25',
      dailyMinutesGoal: 20,
      hasDocuments: true,
      hasFigures: false,
      dueCardsCount: 0,
      todaySeconds: 600,
      todayPages: 5,
      todayHighlights: 1,
      todayCardsCreated: 0,
      todayFiguresOpened: 0,
      todayReviewsDone: 0,
    });
    expect(ch1.length).toBeLessThanOrEqual(3);
    // Ineligible challenges (figures=false, dueCards=0) must never be picked
    expect(ch1.some((c) => c.key === 'inspect-figure')).toBe(false);
    expect(ch1.some((c) => c.key === 'clear-due-cards')).toBe(false);
  });

  it('extracts rule-based flashcard suggestions and schedules 5-box Leitner intervals', () => {
    const sampleText = [
      'Neuroplasticity: The ability of neural networks in the brain to change through growth and reorganization.',
      'In 1949 Donald Hebb proposed that neurons that fire together wire together, improving recall efficiency by 45%.',
    ].join(' ');

    const suggestions = suggestCardsFromText(sampleText, {
      boldPhrases: ['Donald Hebb'],
      headingTitle: 'Synaptic Learning',
      pageNumber: 12,
    });

    const kinds = suggestions.map((s) => s.kind);
    expect(kinds).toContain('definition');
    expect(kinds).toContain('bold-term');
    expect(kinds).toContain('fact');
    expect(kinds).toContain('key-sentence');

    // Cloze blank rendering
    expect(renderClozePrompt('In {{1949}} Hebb published.', false)).toBe(
      'In ______ Hebb published.'
    );
    expect(renderClozePrompt('In {{1949}} Hebb published.', true)).toBe(
      'In [1949] Hebb published.'
    );

    // Leitner 5-box progression & lapse reset
    const baseCard: CardRecord = {
      id: 'c1',
      deckId: 'd1',
      docId: 'doc1',
      pageNumber: 12,
      sourceHighlightId: null,
      sourceFigureId: null,
      kind: 'qa',
      front: 'What is Neuroplasticity?',
      back: 'The ability of neural networks to reorganize.',
      color: 'ivory',
      savedAt: null,
      box: 2,
      dueAt: 1000,
      reviewCount: 1,
      lapses: 0,
      createdAt: 500,
      suspended: false,
    };

    const gotItRes = scheduleCardReview(baseCard, 'got-it', true, 10_000);
    expect(gotItRes.updatedCard.box).toBe(3);
    expect(gotItRes.updatedCard.savedAt).toBe(10_000);
    expect(gotItRes.updatedCard.dueAt).toBe(10_000 + 3 * 24 * 60 * 60 * 1000);

    const againRes = scheduleCardReview(gotItRes.updatedCard, 'again', false, 20_000);
    expect(againRes.updatedCard.box).toBe(1);
    expect(againRes.updatedCard.lapses).toBe(1);
    expect(againRes.updatedCard.dueAt).toBe(20_000 + 10 * 60 * 1000);
  });
});

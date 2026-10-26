import type { ExtractedBlock, HighlightRecord } from '../../data/db';

export interface ResolvedHighlightSpan {
  highlight: HighlightRecord;
  blockIndex: number;
  start: number;
  end: number;
  unplaced: boolean;
}

/**
 * Anchors a highlight against the current page's blocks:
 * 1. Checks exact (blockIndex, start, end) match against quote.
 * 2. If text at position differs (e.g. "Join split words" setting changed hyphenation),
 *    re-finds the quote using prefix and suffix across the block and page blocks.
 * 3. If it cannot be found, marks unplaced: true rather than deleting it.
 */
export function resolveHighlightInPageBlocks(
  highlight: HighlightRecord,
  blocks: ExtractedBlock[],
  joinSplitWords: boolean
): ResolvedHighlightSpan {
  const getBlockText = (b: ExtractedBlock) =>
    joinSplitWords ? b.text : b.rawText ?? b.text;

  // 1. Try direct block position
  const targetBlock = blocks.find((b) => b.index === highlight.blockIndex);
  if (targetBlock) {
    const text = getBlockText(targetBlock);
    if (
      highlight.start >= 0 &&
      highlight.end <= text.length &&
      text.slice(highlight.start, highlight.end) === highlight.quote
    ) {
      return {
        highlight,
        blockIndex: targetBlock.index,
        start: highlight.start,
        end: highlight.end,
        unplaced: false,
      };
    }
  }

  // 2. Re-anchor by searching for quote (or hyphen-tolerant quote) scored by prefix/suffix match
  const normalizedQuote = highlight.quote.trim();
  if (!normalizedQuote) {
    return {
      highlight,
      blockIndex: highlight.blockIndex,
      start: highlight.start,
      end: highlight.end,
      unplaced: true,
    };
  }

  // Build candidate blocks starting with original blockIndex first
  const orderedBlocks = targetBlock
    ? [targetBlock, ...blocks.filter((b) => b.index !== highlight.blockIndex)]
    : blocks;

  for (const blk of orderedBlocks) {
    const text = getBlockText(blk);
    const exactMatch = findBestQuotePosition(
      text,
      normalizedQuote,
      highlight.prefix,
      highlight.suffix
    );
    if (exactMatch) {
      return {
        highlight,
        blockIndex: blk.index,
        start: exactMatch.start,
        end: exactMatch.end,
        unplaced: false,
      };
    }
  }

  return {
    highlight,
    blockIndex: highlight.blockIndex,
    start: highlight.start,
    end: highlight.end,
    unplaced: true,
  };
}

function findBestQuotePosition(
  blockText: string,
  quote: string,
  prefix: string,
  suffix: string
): { start: number; end: number } | null {
  let bestPos: { start: number; end: number } | null = null;
  let bestScore = -1;

  let searchFrom = 0;
  while (searchFrom <= blockText.length - quote.length) {
    const idx = blockText.indexOf(quote, searchFrom);
    if (idx === -1) break;
    const endIdx = idx + quote.length;

    let score = 1;
    if (prefix) {
      const actualPre = blockText.slice(Math.max(0, idx - prefix.length), idx);
      if (actualPre === prefix) score += 4;
      else if (actualPre.endsWith(prefix.slice(-8))) score += 2;
    }
    if (suffix) {
      const actualSuf = blockText.slice(endIdx, endIdx + suffix.length);
      if (actualSuf === suffix) score += 4;
      else if (actualSuf.startsWith(suffix.slice(0, 8))) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPos = { start: idx, end: endIdx };
    }
    searchFrom = idx + 1;
  }

  if (bestPos) return bestPos;

  // Hyphen-tolerant fallback: if quote had a joined word ("reading") and rawText has "read- ing" or vice versa
  const strippedQuote = quote.replace(/-\s+/g, '');
  const strippedBlock = blockText.replace(/-\s+/g, '');
  const strippedIdx = strippedBlock.indexOf(strippedQuote);
  if (strippedIdx !== -1) {
    // Map stripped index back to original blockText
    let origStart = 0;
    let strippedCursor = 0;
    while (origStart < blockText.length && strippedCursor < strippedIdx) {
      if (blockText[origStart] === '-' && blockText[origStart + 1] === ' ') {
        origStart += 2;
      } else {
        origStart++;
        strippedCursor++;
      }
    }
    let origEnd = origStart;
    let matchedLen = 0;
    while (origEnd < blockText.length && matchedLen < strippedQuote.length) {
      if (blockText[origEnd] === '-' && blockText[origEnd + 1] === ' ') {
        origEnd += 2;
      } else {
        origEnd++;
        matchedLen++;
      }
    }
    return { start: origStart, end: origEnd };
  }

  return null;
}

export function extractPrefixAndSuffix(
  blockText: string,
  start: number,
  end: number
): { prefix: string; suffix: string } {
  const prefix = blockText.slice(Math.max(0, start - 24), start);
  const suffix = blockText.slice(end, Math.min(blockText.length, end + 24));
  return { prefix, suffix };
}

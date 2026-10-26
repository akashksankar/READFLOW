import type { ExtractedBlock, PageQualityInfo } from '../../data/db';

export interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

export interface GroupedLine {
  y: number; // PDF coordinate (larger y is higher on page)
  xStart: number;
  xEnd: number;
  fontSize: number;
  text: string;
  positionZone: 'top' | 'bottom' | 'middle';
  normalizedSignature: string;
  boldPhrases?: string[];
  pageHeight?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalizeFurnitureLine(text: string): string {
  const trimmed = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^(?:page\s+|p\.\s*)?\d+(?:\s+of\s+\d+)?$/i.test(trimmed)) {
    return '__bare_page_number__';
  }
  if (/^[ivxlcdm]+$/i.test(trimmed) && trimmed.length <= 6) {
    return '__bare_page_number__';
  }
  return trimmed.replace(/\b\d+\b/g, '#');
}

/**
 * Rule 1: Group getTextContent() items into lines by baseline y
 * (tolerance ~0.3 of median font height), sort lines top to bottom and items left to right.
 */
export function groupItemsIntoLines(
  items: RawTextItem[],
  pageHeight = 800
): { lines: GroupedLine[]; medianFontSize: number } {
  const nonEmpty = items.filter((item) => item.str && item.str.trim().length > 0);
  if (nonEmpty.length === 0) {
    return { lines: [], medianFontSize: 12 };
  }

  const heights = nonEmpty.map((i) => (i.height > 0 ? i.height : 12));
  const medFont = median(heights) || 12;
  const tolerance = Math.max(2, medFont * 0.32);

  const sorted = [...nonEmpty].sort((a, b) => {
    if (Math.abs(b.y - a.y) > tolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lineClusters: { ySum: number; items: RawTextItem[] }[] = [];

  for (const item of sorted) {
    let bestCluster: { ySum: number; items: RawTextItem[] } | null = null;
    let bestDiff = Infinity;
    for (const cluster of lineClusters) {
      const meanY = cluster.ySum / cluster.items.length;
      const diff = Math.abs(item.y - meanY);
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff;
        bestCluster = cluster;
      }
    }
    if (bestCluster) {
      bestCluster.items.push(item);
      bestCluster.ySum += item.y;
    } else {
      lineClusters.push({ ySum: item.y, items: [item] });
    }
  }

  lineClusters.sort(
    (a, b) => b.ySum / b.items.length - a.ySum / a.items.length
  );

  const lines: GroupedLine[] = [];

  for (const cluster of lineClusters) {
    const lineItems = cluster.items.sort((a, b) => a.x - b.x);
    const columnGapThreshold = Math.max(36, medFont * 3.5);

    const segments: RawTextItem[][] = [];
    let currentSeg: RawTextItem[] = [];
    let prevEnd = -Infinity;

    for (const it of lineItems) {
      if (prevEnd !== -Infinity && it.x - prevEnd > columnGapThreshold) {
        if (currentSeg.length > 0) segments.push(currentSeg);
        currentSeg = [it];
      } else {
        currentSeg.push(it);
      }
      prevEnd = it.x + Math.max(it.width, it.str.length * medFont * 0.45);
    }
    if (currentSeg.length > 0) segments.push(currentSeg);

    for (const seg of segments) {
      let lineText = '';
      let segPrevEnd = -Infinity;
      let ySum = 0;
      const boldPhrases: string[] = [];

      for (const it of seg) {
        ySum += it.y;
        const piece = it.str;
        if (segPrevEnd !== -Infinity) {
          const gap = it.x - segPrevEnd;
          const spaceThreshold = medFont * 0.18;
          if (gap > spaceThreshold && !lineText.endsWith(' ') && !piece.startsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += piece;
        if (it.fontName && /bold|black|heavy|demi/i.test(it.fontName)) {
          const cleaned = piece.trim().replace(/[:.—-]+$/, '').trim();
          if (cleaned.length >= 2 && cleaned.length <= 48) {
            boldPhrases.push(cleaned);
          }
        }
        segPrevEnd = it.x + Math.max(it.width, piece.length * medFont * 0.45);
      }

      const cleanText = lineText.replace(/\s+/g, ' ').trim();
      if (!cleanText) continue;

      const meanY = ySum / seg.length;
      const xStart = seg[0].x;
      const last = seg[seg.length - 1];
      const xEnd = last.x + Math.max(last.width, last.str.length * medFont * 0.45);
      const fontSize = median(seg.map((i) => (i.height > 0 ? i.height : medFont)));

      const relY = pageHeight > 0 ? meanY / pageHeight : 0.5;
      const positionZone: 'top' | 'bottom' | 'middle' =
        relY >= 0.86 ? 'top' : relY <= 0.14 ? 'bottom' : 'middle';

      lines.push({
        y: meanY,
        xStart,
        xEnd,
        fontSize,
        text: cleanText,
        positionZone,
        normalizedSignature: `${positionZone}:${normalizeFurnitureLine(cleanText)}`,
        boldPhrases: boldPhrases.length > 0 ? boldPhrases : undefined,
        pageHeight,
      });
    }
  }

  return { lines, medianFontSize: medFont };
}

export function orderLinesByColumns(
  lines: GroupedLine[],
  pageWidth = 600
): {
  orderedLines: GroupedLine[];
  columnStatus: 'single' | 'multi-column' | 'uncertain-columns';
} {
  const bodyLines = lines.filter((l) => l.positionZone === 'middle');
  if (bodyLines.length < 6) {
    return { orderedLines: lines, columnStatus: 'single' };
  }

  const midX = pageWidth * 0.46;
  const leftLines: GroupedLine[] = [];
  const rightLines: GroupedLine[] = [];
  const spanningLines: GroupedLine[] = [];

  for (const l of bodyLines) {
    if (l.xStart < midX && l.xEnd > pageWidth * 0.62) {
      spanningLines.push(l);
    } else if (l.xStart >= midX) {
      rightLines.push(l);
    } else {
      leftLines.push(l);
    }
  }

  if (
    leftLines.length >= 3 &&
    rightLines.length >= 3 &&
    spanningLines.length <= bodyLines.length * 0.2
  ) {
    const topLines = lines.filter((l) => l.positionZone === 'top');
    const bottomLines = lines.filter((l) => l.positionZone === 'bottom');
    const orderedLeft = [...leftLines, ...spanningLines].sort((a, b) => b.y - a.y);
    const orderedRight = [...rightLines].sort((a, b) => b.y - a.y);
    return {
      orderedLines: [...topLines, ...orderedLeft, ...orderedRight, ...bottomLines],
      columnStatus: 'multi-column',
    };
  }

  if (rightLines.length >= 2 && spanningLines.length > bodyLines.length * 0.2) {
    return {
      orderedLines: lines,
      columnStatus: 'uncertain-columns',
    };
  }

  return { orderedLines: lines, columnStatus: 'single' };
}

export function appendLineToParagraph(
  currentText: string,
  nextLineText: string
): { joinedText: string; rawText: string } {
  if (!currentText) {
    return { joinedText: nextLineText, rawText: nextLineText };
  }

  const rawCombined = `${currentText} ${nextLineText}`;

  const hyphenMatch = currentText.match(/^(.*\s)?([a-z]+)-$/);
  const nextWordMatch = nextLineText.match(/^([a-z]+)(\s.*|[^a-zA-Z].*)?$/);

  if (hyphenMatch && nextWordMatch) {
    const prefix = hyphenMatch[1] ?? '';
    const firstFrag = hyphenMatch[2];
    const secondFrag = nextWordMatch[1];
    const rest = nextWordMatch[2] ?? '';
    const joinedWord = `${firstFrag}${secondFrag}`;
    if (/^[a-z]+$/.test(joinedWord) && joinedWord === joinedWord.toLowerCase()) {
      return {
        joinedText: `${prefix}${joinedWord}${rest}`,
        rawText: rawCombined,
      };
    }
  }

  return {
    joinedText: rawCombined,
    rawText: rawCombined,
  };
}

export function buildBlocksFromLines(
  lines: GroupedLine[],
  medianFontSize: number,
  furnitureSignatures?: Set<string>
): ExtractedBlock[] {
  if (lines.length === 0) return [];

  const pageHeight = lines[0]?.pageHeight || 800;
  const toNormTop = (pdfY: number) =>
    Math.max(0, Math.min(1, 1 - pdfY / Math.max(1, pageHeight)));

  const blocks: ExtractedBlock[] = [];
  let blockIdx = 0;

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1].y - lines[i].y);
    if (gap > 0 && gap < medianFontSize * 5) {
      gaps.push(gap);
    }
  }
  const medianGap = median(gaps) || medianFontSize * 1.35;
  const xStarts = lines.map((l) => l.xStart);
  const bodyLeftX = median(xStarts);
  const maxRightX = Math.max(...lines.map((l) => l.xEnd), bodyLeftX + 200);
  const bodyLineWidth = Math.max(120, maxRightX - bodyLeftX);

  let currentText = '';
  let currentRawText = '';
  let currentYTop = 0;
  let currentYBottom = 0;
  let currentBoldPhrases: string[] = [];
  let prevLine: GroupedLine | null = null;

  const flushParagraph = () => {
    if (currentText.trim()) {
      blocks.push({
        index: blockIdx++,
        type: 'paragraph',
        text: currentText.trim(),
        rawText: currentRawText.trim(),
        isFurniture: false,
        yTop: currentYTop,
        yBottom: currentYBottom,
        boldPhrases: currentBoldPhrases.length > 0 ? [...currentBoldPhrases] : undefined,
      });
    }
    currentText = '';
    currentRawText = '';
    currentBoldPhrases = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNormY = toNormTop(line.y);
    const isAutoBareNumber =
      (line.positionZone === 'top' || line.positionZone === 'bottom') &&
      line.normalizedSignature.endsWith(':__bare_page_number__');
    const isRepeatedFurniture =
      isAutoBareNumber || Boolean(furnitureSignatures?.has(line.normalizedSignature));

    if (isRepeatedFurniture) {
      flushParagraph();
      blocks.push({
        index: blockIdx++,
        type: 'furniture',
        text: line.text,
        rawText: line.text,
        isFurniture: true,
        yTop: lineNormY,
        yBottom: lineNormY,
      });
      prevLine = null;
      continue;
    }

    const isHeading1 = line.fontSize >= medianFontSize * 1.28 && line.text.length <= 120;
    const isHeading2 =
      !isHeading1 && line.fontSize >= medianFontSize * 1.12 && line.text.length <= 120;

    if (isHeading1 || isHeading2) {
      flushParagraph();
      blocks.push({
        index: blockIdx++,
        type: isHeading1 ? 'heading-1' : 'heading-2',
        text: line.text,
        rawText: line.text,
        isFurniture: false,
        yTop: lineNormY,
        yBottom: lineNormY,
      });
      prevLine = null;
      continue;
    }

    if (!prevLine) {
      currentText = line.text;
      currentRawText = line.text;
      currentYTop = lineNormY;
      currentYBottom = lineNormY;
      currentBoldPhrases = line.boldPhrases ? [...line.boldPhrases] : [];
      prevLine = line;
      continue;
    }

    const verticalGap = Math.abs(prevLine.y - line.y);
    const isLargeGap = verticalGap > medianGap * 1.42;
    const isColumnJump = line.y > prevLine.y + medianFontSize * 2;
    const isIndented = line.xStart - bodyLeftX > medianFontSize * 1.1;
    const prevLineWidth = prevLine.xEnd - prevLine.xStart;
    const prevEndedShortSentence =
      /[.!?]["'”’)]?$/.test(prevLine.text) && prevLineWidth < bodyLineWidth * 0.78;

    if (isLargeGap || isColumnJump || isIndented || prevEndedShortSentence) {
      flushParagraph();
      currentText = line.text;
      currentRawText = line.text;
      currentYTop = lineNormY;
      currentYBottom = lineNormY;
      currentBoldPhrases = line.boldPhrases ? [...line.boldPhrases] : [];
    } else {
      const joined = appendLineToParagraph(currentText, line.text);
      const rawJoined = `${currentRawText} ${line.text}`;
      currentText = joined.joinedText;
      currentRawText = rawJoined;
      currentYBottom = Math.max(currentYBottom, lineNormY);
      if (line.boldPhrases) {
        currentBoldPhrases.push(...line.boldPhrases);
      }
    }

    prevLine = line;
  }

  flushParagraph();
  return blocks;
}

export function detectRepeatedFurnitureSignatures(
  allPageLines: GroupedLine[][]
): Set<string> {
  const totalPages = allPageLines.length;
  const repeated = new Set<string>();
  if (totalPages < 3) return repeated;

  const counts = new Map<string, number>();
  for (const pageLines of allPageLines) {
    const seenOnPage = new Set<string>();
    for (const line of pageLines) {
      if (line.positionZone === 'top' || line.positionZone === 'bottom') {
        seenOnPage.add(line.normalizedSignature);
      }
    }
    for (const sig of seenOnPage) {
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
  }

  const threshold = Math.ceil(totalPages * 0.4);
  for (const [sig, count] of counts.entries()) {
    if (count >= threshold) {
      repeated.add(sig);
    }
  }
  return repeated;
}

export function scorePageQuality(
  lines: GroupedLine[],
  columnStatus: 'single' | 'multi-column' | 'uncertain-columns'
): PageQualityInfo {
  const bodyLines = lines.filter((l) => l.positionZone === 'middle');
  const fullText = bodyLines.map((l) => l.text).join(' ');
  const charCount = fullText.length;

  if (charCount < 30) {
    return {
      score: 0.2,
      reliable: false,
      reason: 'sparse-or-scanned',
      charCount,
    };
  }

  if (columnStatus === 'multi-column') {
    return {
      score: 0.55,
      reliable: false,
      reason: 'multi-column',
      charCount,
    };
  }

  if (columnStatus === 'uncertain-columns') {
    return {
      score: 0.5,
      reliable: false,
      reason: 'uncertain-columns',
      charCount,
    };
  }

  const nonSpaceChars = fullText.replace(/\s+/g, '');
  const alphaChars = (nonSpaceChars.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
  const nonAlphaRatio =
    nonSpaceChars.length > 0 ? 1 - alphaChars / nonSpaceChars.length : 0;

  const shortLines = bodyLines.filter((l) => l.text.length < 22).length;
  const shortLineRatio = bodyLines.length > 0 ? shortLines / bodyLines.length : 0;

  if (nonAlphaRatio > 0.38 || (bodyLines.length >= 6 && shortLineRatio > 0.65)) {
    return {
      score: 0.45,
      reliable: false,
      reason: 'tables-or-numeric',
      charCount,
    };
  }

  return {
    score: 0.95,
    reliable: true,
    charCount,
  };
}

export async function extractSinglePdfPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  furnitureSignatures?: Set<string>
): Promise<{
  lines: GroupedLine[];
  blocks: ExtractedBlock[];
  quality: PageQualityInfo;
  charCount: number;
  medianFontSize: number;
}> {
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const styles = textContent.styles || {};

  const rawItems: RawTextItem[] = [];
  for (const item of textContent.items) {
    if ('str' in item && typeof item.str === 'string') {
      const tx = item.transform;
      const x = Array.isArray(tx) ? tx[4] : 0;
      const y = Array.isArray(tx) ? tx[5] : 0;
      const fontHeight =
        item.height && item.height > 0
          ? item.height
          : Array.isArray(tx)
            ? Math.hypot(tx[0], tx[1])
            : 12;
      const styleObj = item.fontName ? styles[item.fontName] : undefined;
      const fontDescriptor = [item.fontName, styleObj?.fontFamily]
        .filter(Boolean)
        .join(' ');

      rawItems.push({
        str: item.str,
        x,
        y,
        width: item.width || 0,
        height: fontHeight || 12,
        fontName: fontDescriptor,
      });
    }
  }

  const { lines, medianFontSize } = groupItemsIntoLines(rawItems, viewport.height || 800);
  const { orderedLines, columnStatus } = orderLinesByColumns(lines, viewport.width || 600);
  const blocks = buildBlocksFromLines(orderedLines, medianFontSize, furnitureSignatures);
  const quality = scorePageQuality(orderedLines, columnStatus);

  return {
    lines: orderedLines,
    blocks,
    quality,
    charCount: quality.charCount,
    medianFontSize,
  };
}

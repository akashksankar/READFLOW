import type { ExtractedBlock, TapZonesMode } from '../../data/db';

export interface PagedAnchorPosition {
  pageIndex: number;
  blockIndex: number;
  charOffset: number;
}

/**
 * Pure position-mapping helpers for Paged mode so a reader's place
 * survives font-size and measure changes.
 */
export function computeCharacterAnchorFromColumn(
  blocks: ExtractedBlock[],
  columnIndex: number,
  totalColumns: number,
  pageIndex: number
): PagedAnchorPosition {
  if (blocks.length === 0 || totalColumns <= 1) {
    return { pageIndex, blockIndex: 0, charOffset: 0 };
  }

  const totalChars = blocks.reduce((acc, b) => acc + b.text.length, 0);
  const targetRatio = Math.max(0, Math.min(1, columnIndex / Math.max(1, totalColumns)));
  const targetGlobalChar = Math.floor(totalChars * targetRatio);

  let running = 0;
  for (const b of blocks) {
    if (running + b.text.length > targetGlobalChar) {
      return {
        pageIndex,
        blockIndex: b.index,
        charOffset: Math.max(0, targetGlobalChar - running),
      };
    }
    running += b.text.length;
  }

  const last = blocks[blocks.length - 1];
  return {
    pageIndex,
    blockIndex: last.index,
    charOffset: 0,
  };
}

export function resolveColumnIndexFromAnchor(
  blocks: ExtractedBlock[],
  anchor: PagedAnchorPosition,
  totalColumns: number
): number {
  if (totalColumns <= 1 || blocks.length === 0) return 0;

  let totalChars = 0;
  let anchorCharPos = 0;
  let found = false;

  for (const b of blocks) {
    if (!found) {
      if (b.index === anchor.blockIndex) {
        anchorCharPos = totalChars + Math.min(b.text.length, Math.max(0, anchor.charOffset));
        found = true;
      } else if (b.index > anchor.blockIndex) {
        anchorCharPos = totalChars;
        found = true;
      }
    }
    totalChars += b.text.length;
  }

  if (!found || totalChars === 0) return 0;
  const ratio = anchorCharPos / totalChars;
  return Math.max(0, Math.min(totalColumns - 1, Math.floor(ratio * totalColumns)));
}

export function resolveTapZoneAction(
  clientX: number,
  containerWidth: number,
  mode: TapZonesMode
): 'prev' | 'toggle-chrome' | 'next' {
  if (containerWidth <= 0) return 'toggle-chrome';
  const ratio = clientX / containerWidth;
  const edgeRatio = mode === 'wide-center' ? 0.2 : 0.28;

  if (ratio < edgeRatio) return 'prev';
  if (ratio > 1 - edgeRatio) return 'next';
  return 'toggle-chrome';
}


import { useState, useCallback } from 'react';
import { useAppMotion } from '../../motion/useReducedMotion';

/**
 * Tracks opening sequence & chapter opener playback per session:
 * - Opening sequence plays only for the first open of a document in a session
 *   (opening the same document again within 5 minutes skips the sequence).
 * - Chapter openers play once per session when a detected chapter heading enters the viewport
 *   naturally (never repeated on scroll back, never for headings reached by jumping).
 */

const DOC_OPEN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const docLastOpenedMap = new Map<string, number>();
const playedChaptersSet = new Set<string>();

export function shouldPlayOpeningForDoc(
  docId: string,
  initialPageIndex: number,
  isReducedMotion: boolean,
  isLiteMode: boolean,
  openingSetting: string
): boolean {
  if (isReducedMotion || isLiteMode || openingSetting === 'off') {
    return false;
  }
  if (initialPageIndex > 0) {
    return false;
  }
  const now = Date.now();
  const last = docLastOpenedMap.get(docId);
  if (last && now - last < DOC_OPEN_COOLDOWN_MS) {
    docLastOpenedMap.set(docId, now);
    return false;
  }
  docLastOpenedMap.set(docId, now);
  return true;
}

export function useOpeningPlayed(
  docId: string,
  openingSetting: string,
  initialPageIndex = 0
): {
  shouldPlayOpening: boolean;
  markOpeningPlayed: () => void;
} {
  const { isReducedMotion, isLiteMode } = useAppMotion();
  const [shouldPlayOpening, setShouldPlayOpening] = useState(() =>
    shouldPlayOpeningForDoc(
      docId,
      initialPageIndex,
      isReducedMotion,
      isLiteMode,
      openingSetting
    )
  );

  const markOpeningPlayed = useCallback(() => {
    docLastOpenedMap.set(docId, Date.now());
    setShouldPlayOpening(false);
  }, [docId]);

  return { shouldPlayOpening, markOpeningPlayed };
}

export function hasChapterOpenerPlayed(docId: string, pageIndex: number, blockIndex: number): boolean {
  return playedChaptersSet.has(`${docId}:${pageIndex}:${blockIndex}`);
}

export function markChapterOpenerPlayed(docId: string, pageIndex: number, blockIndex: number): void {
  playedChaptersSet.add(`${docId}:${pageIndex}:${blockIndex}`);
}

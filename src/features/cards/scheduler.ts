import { CardRecord, ReviewRecord } from '../../data/db';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const LEITNER_INTERVALS_MS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 10 * MINUTE_MS, // Same session / +10 min
  2: 1 * DAY_MS, // +1 day
  3: 3 * DAY_MS, // +3 days
  4: 7 * DAY_MS, // +7 days
  5: 21 * DAY_MS, // +21 days
};

export interface ScheduleResult {
  updatedCard: CardRecord;
  reviewRecord: ReviewRecord;
}

/**
 * Pure 5-box Leitner spaced repetition scheduler.
 * - 'got-it': advances box by 1 (max 5) and schedules next due date.
 * - 'again': resets box to 1 and schedules due in +10 minutes.
 */
export function scheduleCardReview(
  card: CardRecord,
  result: 'again' | 'got-it',
  alsoSaveToSavedDeck: boolean = false,
  now: number = Date.now()
): ScheduleResult {
  const prevBox = card.box;
  const nextBox: 1 | 2 | 3 | 4 | 5 =
    result === 'got-it' ? (Math.min(5, prevBox + 1) as 1 | 2 | 3 | 4 | 5) : 1;

  const intervalMs = LEITNER_INTERVALS_MS[nextBox];
  const dueAt = now + intervalMs;

  const updatedCard: CardRecord = {
    ...card,
    box: nextBox,
    dueAt,
    reviewCount: card.reviewCount + 1,
    lapses: result === 'again' ? card.lapses + 1 : card.lapses,
    savedAt: alsoSaveToSavedDeck ? (card.savedAt ?? now) : card.savedAt,
  };

  const reviewRecord: ReviewRecord = {
    id: `rev_${card.id}_${now}_${Math.random().toString(36).slice(2, 6)}`,
    cardId: card.id,
    reviewedAt: now,
    result,
    prevBox,
    nextBox,
  };

  return { updatedCard, reviewRecord };
}

export function formatBoxIntervalLabel(box: 1 | 2 | 3 | 4 | 5): string {
  switch (box) {
    case 1:
      return '10m';
    case 2:
      return '1d';
    case 3:
      return '3d';
    case 4:
      return '7d';
    case 5:
      return '21d';
  }
}

import {
  db,
  SessionRecord,
  GoalRecord,
  TaskRecord,
  TaskLogRecord,
  ChallengeLogRecord,
} from '../../data/db';
import { formatLocalDateKey } from './sessionTracker';

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return formatLocalDateKey(dt.getTime());
}

export function getDayOfWeekLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return labels[dt.getDay()];
}

export function isWeekdayDateKey(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day >= 1 && day <= 5;
}

export interface DailyAggregate {
  dateKey: string;
  activeSeconds: number;
  minutes: number;
  pagesRead: number;
  wordsEstimated: number;
  goalMet: boolean;
}

export function computeStreakFromSessions(
  sessions: SessionRecord[],
  dailyMinutesGoal: number,
  dailyPagesGoal: number | null,
  todayKey: string = formatLocalDateKey()
): { currentStreak: number; longestStreak: number; byDate: Map<string, DailyAggregate> } {
  const byDate = new Map<string, DailyAggregate>();

  for (const s of sessions) {
    const existing = byDate.get(s.dateKey) || {
      dateKey: s.dateKey,
      activeSeconds: 0,
      minutes: 0,
      pagesRead: 0,
      wordsEstimated: 0,
      goalMet: false,
    };
    existing.activeSeconds += s.activeSeconds;
    existing.pagesRead += s.pagesRead;
    existing.wordsEstimated += s.wordsEstimated;
    existing.minutes = Math.floor(existing.activeSeconds / 60);
    const minGoalMet = existing.activeSeconds >= dailyMinutesGoal * 60;
    const pageGoalMet = dailyPagesGoal ? existing.pagesRead >= dailyPagesGoal : false;
    existing.goalMet = minGoalMet || pageGoalMet || existing.activeSeconds >= 60;
    byDate.set(s.dateKey, existing);
  }

  // Compute current streak ending today or yesterday
  let currentStreak = 0;
  const todayAgg = byDate.get(todayKey);
  let cursor = todayAgg && todayAgg.activeSeconds >= 60 ? todayKey : shiftDateKey(todayKey, -1);

  while (true) {
    const agg = byDate.get(cursor);
    if (agg && agg.activeSeconds >= 60) {
      currentStreak += 1;
      cursor = shiftDateKey(cursor, -1);
    } else {
      break;
    }
  }

  // Compute longest streak across all recorded dates
  const sortedDates = Array.from(byDate.keys())
    .filter((k) => (byDate.get(k)?.activeSeconds ?? 0) >= 60)
    .sort();
  let longestStreak = 0;
  let running = 0;
  let prevKey: string | null = null;

  for (const key of sortedDates) {
    if (!prevKey || shiftDateKey(prevKey, 1) === key) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreak) longestStreak = running;
    prevKey = key;
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak), byDate };
}

export interface ChallengeTemplate {
  key: string;
  title: string;
  description: string;
  target: number;
  unit: string;
}

export interface ActiveChallenge extends ChallengeTemplate {
  progress: number;
  completedAt: number | null;
}

export function hashDateSeed(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function selectDailyChallenges(params: {
  dateKey: string;
  dailyMinutesGoal: number;
  hasDocuments: boolean;
  hasFigures: boolean;
  dueCardsCount: number;
  todaySeconds: number;
  todayPages: number;
  todayHighlights: number;
  todayCardsCreated: number;
  todayFiguresOpened: number;
  todayReviewsDone: number;
}): ActiveChallenge[] {
  const candidates: Array<{
    template: ChallengeTemplate;
    progress: number;
    eligible: boolean;
  }> = [
    {
      template: {
        key: 'steady-pages',
        title: 'Steady pages',
        description: 'Read 5 pages in any document today',
        target: 5,
        unit: 'pages',
      },
      progress: params.todayPages,
      eligible: params.hasDocuments,
    },
    {
      template: {
        key: 'ten-quiet-minutes',
        title: 'Ten quiet minutes',
        description: 'Spend 10 active minutes reading today',
        target: 10,
        unit: 'min',
      },
      progress: Math.floor(params.todaySeconds / 60),
      eligible: true,
    },
    {
      template: {
        key: 'daily-goal',
        title: 'Daily reading goal',
        description: `Reach your ${params.dailyMinutesGoal}-minute daily goal`,
        target: params.dailyMinutesGoal,
        unit: 'min',
      },
      progress: Math.floor(params.todaySeconds / 60),
      eligible: true,
    },
    {
      template: {
        key: 'capture-idea',
        title: 'Capture an idea',
        description: 'Save 1 highlight or margin note while reading',
        target: 1,
        unit: 'highlight',
      },
      progress: params.todayHighlights,
      eligible: params.hasDocuments,
    },
    {
      template: {
        key: 'make-2-cards',
        title: 'Make 2 cards',
        description: 'Create 2 flashcards from your reading',
        target: 2,
        unit: 'cards',
      },
      progress: params.todayCardsCreated,
      eligible: params.hasDocuments,
    },
    {
      template: {
        key: 'clear-due-cards',
        title: 'Clear due cards',
        description: `Review ${Math.min(10, Math.max(1, params.dueCardsCount))} due cards`,
        target: Math.min(10, Math.max(1, params.dueCardsCount)),
        unit: 'reviews',
      },
      progress: params.todayReviewsDone,
      eligible: params.dueCardsCount > 0,
    },
    {
      template: {
        key: 'inspect-figure',
        title: 'Inspect a figure',
        description: 'Open 1 figure or diagram in the viewer',
        target: 1,
        unit: 'figure',
      },
      progress: params.todayFiguresOpened,
      eligible: params.hasFigures,
    },
  ];

  const eligibleList = candidates.filter((c) => c.eligible);
  const seed = hashDateSeed(params.dateKey);

  // Deterministic shuffle of eligible candidates using dateKey seed
  const pool = [...eligibleList];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (seed + i * 31) % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, 3).map((item) => {
    const clampedProgress = Math.min(item.template.target, item.progress);
    const isDone = clampedProgress >= item.template.target;
    return {
      ...item.template,
      progress: clampedProgress,
      completedAt: isDone ? Date.now() : null,
    };
  });
}

export function computeTaskStreak(
  task: TaskRecord,
  logs: TaskLogRecord[],
  todayKey: string = formatLocalDateKey()
): number {
  if (task.schedule === 'once') {
    const anyDone = logs.some((l) => l.taskId === task.id && l.completedAt !== null);
    return anyDone ? 1 : 0;
  }

  const completedDates = new Set(
    logs.filter((l) => l.taskId === task.id && l.completedAt !== null).map((l) => l.dateKey)
  );

  let streak = 0;
  let cursor = completedDates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);

  for (let safety = 0; safety < 366; safety++) {
    if (task.schedule === 'weekdays' && !isWeekdayDateKey(cursor)) {
      cursor = shiftDateKey(cursor, -1);
      continue;
    }
    if (completedDates.has(cursor)) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getOrCreateGoal(): Promise<GoalRecord> {
  const existing = await db.goals.get('default');
  if (existing) return existing;
  const fresh: GoalRecord = {
    id: 'default',
    dailyMinutes: 20,
    dailyPages: 10,
    updatedAt: Date.now(),
  };
  await db.goals.put(fresh);
  return fresh;
}

export async function syncChallengeLogs(
  dateKey: string,
  challenges: ActiveChallenge[]
): Promise<ChallengeLogRecord[]> {
  const existing = await db.challengeLog.where('dateKey').equals(dateKey).toArray();
  const byKey = new Map(existing.map((e) => [e.challengeKey, e]));
  const result: ChallengeLogRecord[] = [];

  for (const ch of challenges) {
    const prev = byKey.get(ch.key);
    const isComplete = ch.progress >= ch.target;
    const record: ChallengeLogRecord = {
      id: prev?.id ?? `ch_${dateKey}_${ch.key}`,
      dateKey,
      challengeKey: ch.key,
      target: ch.target,
      progress: ch.progress,
      completedAt: isComplete ? (prev?.completedAt ?? Date.now()) : null,
    };
    await db.challengeLog.put(record);
    result.push(record);
  }
  return result;
}

import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Clock, FileText, Layers, Sparkles } from 'lucide-react';
import {
  db,
  DocumentRecord,
  SessionRecord,
  GoalRecord,
  TaskRecord,
  TaskLogRecord,
} from '../../data/db';
import { formatLocalDateKey } from '../tracking/sessionTracker';
import {
  computeStreakFromSessions,
  DailyAggregate,
  getOrCreateGoal,
  selectDailyChallenges,
  shiftDateKey,
  syncChallengeLogs,
  ActiveChallenge,
} from '../tracking/statsQueries';
import { GoalArc } from './GoalArc';
import { WeekRibbons } from './WeekRibbons';
import { HeatMap } from './HeatMap';
import { Challenges } from './Challenges';
import { Tasks } from './Tasks';

interface TodayPageProps {
  onOpenDocument: (docId: string) => void;
  onNavigateCards: () => void;
}

export const TodayPage: React.FC<TodayPageProps> = ({
  onOpenDocument,
  onNavigateCards,
}) => {
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<GoalRecord>({
    id: 'default',
    dailyMinutes: 20,
    dailyPages: 10,
    updatedAt: Date.now(),
  });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLogRecord[]>([]);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [dueCardsCount, setDueCardsCount] = useState(0);

  const todayKey = formatLocalDateKey();

  const loadData = useCallback(async () => {
    const [
      loadedGoal,
      loadedSessions,
      loadedDocs,
      loadedTasks,
      loadedTaskLogs,
      figuresCount,
      allCards,
      allHighlights,
      allReviews,
    ] = await Promise.all([
      getOrCreateGoal(),
      db.sessions.toArray(),
      db.documents.orderBy('lastOpenedAt').reverse().toArray(),
      db.tasks.toArray(),
      db.taskLog.toArray(),
      db.figures.count(),
      db.cards.toArray(),
      db.highlights.toArray(),
      db.reviews.toArray(),
    ]);

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStartMs = startOfToday.getTime();

    const activeCards = allCards.filter((c) => !c.suspended);
    const dueCount = activeCards.filter((c) => c.dueAt <= now).length;

    const todaySessions = loadedSessions.filter((s) => s.dateKey === todayKey);
    const todaySeconds = todaySessions.reduce((acc, s) => acc + s.activeSeconds, 0);
    const todayPages = todaySessions.reduce((acc, s) => acc + s.pagesRead, 0);
    const todayHighlights = allHighlights.filter((h) => h.createdAt >= todayStartMs).length;
    const todayCardsCreated = allCards.filter((c) => c.createdAt >= todayStartMs).length;
    const todayReviewsDone = allReviews.filter((r) => r.reviewedAt >= todayStartMs).length;

    const activeChallenges = selectDailyChallenges({
      dateKey: todayKey,
      dailyMinutesGoal: loadedGoal.dailyMinutes,
      hasDocuments: loadedDocs.length > 0,
      hasFigures: figuresCount > 0,
      dueCardsCount: dueCount,
      todaySeconds,
      todayPages,
      todayHighlights,
      todayCardsCreated,
      todayFiguresOpened: 0,
      todayReviewsDone,
    });

    await syncChallengeLogs(todayKey, activeChallenges);

    setGoal(loadedGoal);
    setSessions(loadedSessions);
    setDocuments(loadedDocs);
    setTasks(loadedTasks);
    setTaskLogs(loadedTaskLogs);
    setChallenges(activeChallenges);
    setDueCardsCount(dueCount);
    setLoading(false);
  }, [todayKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { currentStreak, longestStreak, byDate } = computeStreakFromSessions(
    sessions,
    goal.dailyMinutes,
    goal.dailyPages,
    todayKey
  );

  const todayAgg = byDate.get(todayKey) ?? {
    dateKey: todayKey,
    activeSeconds: 0,
    minutes: 0,
    pagesRead: 0,
    wordsEstimated: 0,
    goalMet: false,
  };

  const past7Days: DailyAggregate[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDateKey(todayKey, -i);
    past7Days.push(
      byDate.get(key) ?? {
        dateKey: key,
        activeSeconds: 0,
        minutes: 0,
        pagesRead: 0,
        wordsEstimated: 0,
        goalMet: false,
      }
    );
  }

  const totalSeconds = sessions.reduce((acc, s) => acc + s.activeSeconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const totalPages = sessions.reduce((acc, s) => acc + s.pagesRead, 0);
  const totalWords = sessions.reduce((acc, s) => acc + s.wordsEstimated, 0);
  const completedDocs = documents.filter(
    (d) => d.pageCount > 0 && (d.lastPage ?? 1) >= d.pageCount
  ).length;

  const currentDoc = documents[0] ?? null;
  const docSessions = currentDoc
    ? sessions.filter((s) => s.docId === currentDoc.id && s.pagesRead > 0)
    : [];
  let paceMinutesLeft: number | null = null;
  if (currentDoc && docSessions.length >= 3) {
    const docSeconds = docSessions.reduce((a, s) => a + s.activeSeconds, 0);
    const docPages = docSessions.reduce((a, s) => a + s.pagesRead, 0);
    if (docPages > 0) {
      const secPerPage = docSeconds / docPages;
      const remainingPages = Math.max(0, currentDoc.pageCount - (currentDoc.lastPage ?? 1));
      paceMinutesLeft = Math.max(1, Math.round((remainingPages * secPerPage) / 60));
    }
  }

  const handleUpdateGoal = async (dailyMinutes: number, dailyPages: number | null) => {
    const updated: GoalRecord = {
      id: 'default',
      dailyMinutes,
      dailyPages,
      updatedAt: Date.now(),
    };
    await db.goals.put(updated);
    setGoal(updated);
    void loadData();
  };

  const handleCreateTask = async (
    title: string,
    schedule: 'once' | 'daily' | 'weekdays',
    linkedDocId: string | null
  ) => {
    const newTask: TaskRecord = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      schedule,
      linkedDocId,
      order: tasks.length,
      createdAt: Date.now(),
      archivedAt: null,
    };
    await db.tasks.put(newTask);
    await loadData();
  };

  const handleToggleTask = async (taskId: string, done: boolean) => {
    const logId = `tlog_${taskId}_${todayKey}`;
    if (done) {
      await db.taskLog.put({
        id: logId,
        taskId,
        dateKey: todayKey,
        completedAt: Date.now(),
      });
    } else {
      await db.taskLog.delete(logId);
    }
    await loadData();
  };

  const handleReorderTask = async (taskId: string, direction: 'up' | 'down') => {
    const active = tasks.filter((t) => !t.archivedAt).sort((a, b) => a.order - b.order);
    const idx = active.findIndex((t) => t.id === taskId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= active.length) return;
    const a = active[idx];
    const b = active[swapIdx];
    await db.tasks.update(a.id, { order: b.order });
    await db.tasks.update(b.id, { order: a.order });
    await loadData();
  };

  const handleArchiveTask = async (taskId: string) => {
    await db.tasks.update(taskId, { archivedAt: Date.now() });
    await loadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    await db.tasks.delete(taskId);
    await db.taskLog.where('taskId').equals(taskId).delete();
    await loadData();
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        <div className="h-6 w-40 rounded bg-[var(--bg-Secondary)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 pb-24 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Reading Desk · {todayKey}
          </p>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-reading)' }}
          >
            Today’s Reading
          </h1>
        </div>
        {dueCardsCount > 0 && (
          <button
            type="button"
            onClick={onNavigateCards}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] border text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--text-Primary)',
            }}
          >
            <Layers className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
            <span>{dueCardsCount} flashcards due for review</span>
          </button>
        )}
      </header>

      {/* Top Row: GoalArc + WeekRibbons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GoalArc
          todayMinutes={todayAgg.minutes}
          todaySeconds={todayAgg.activeSeconds}
          todayPages={todayAgg.pagesRead}
          dailyMinutesGoal={goal.dailyMinutes}
          dailyPagesGoal={goal.dailyPages}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          onUpdateGoal={handleUpdateGoal}
        />
        <WeekRibbons
          days={past7Days}
          todayKey={todayKey}
          dailyMinutesGoal={goal.dailyMinutes}
        />
      </div>

      {/* Currently Reading Card */}
      {currentDoc && (
        <div
          className="p-6 rounded-[8px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="space-y-1 min-w-0">
            <span
              className="text-xs uppercase tracking-wider font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Currently Reading
            </span>
            <h2
              className="text-lg font-semibold truncate"
              style={{ fontFamily: 'var(--font-reading)' }}
            >
              {currentDoc.title}
            </h2>
            <div className="flex items-center gap-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              <span>
                Page {currentDoc.lastPage ?? 1} of {currentDoc.pageCount} (
                {Math.round(((currentDoc.lastPage ?? 1) / Math.max(1, currentDoc.pageCount)) * 100)}%)
              </span>
              {paceMinutesLeft !== null && (
                <span>· ~{paceMinutesLeft} min left at your pace</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenDocument(currentDoc.id)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] text-xs font-medium text-white shrink-0"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <BookOpen className="w-4 h-4" />
            Continue reading
          </button>
        </div>
      )}

      {/* Daily Challenges */}
      <Challenges challenges={challenges} />

      {/* Personal Routine Tasks */}
      <Tasks
        tasks={tasks}
        taskLogs={taskLogs}
        documents={documents}
        todayKey={todayKey}
        onCreateTask={handleCreateTask}
        onToggleTask={handleToggleTask}
        onReorderTask={handleReorderTask}
        onArchiveTask={handleArchiveTask}
        onDeleteTask={handleDeleteTask}
        onOpenDocument={onOpenDocument}
      />

      {/* 12-Week HeatMap & Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeatMap
            byDate={byDate}
            todayKey={todayKey}
            dailyMinutesGoal={goal.dailyMinutes}
          />
        </div>
        <div
          className="p-5 rounded-[8px] border flex flex-col justify-between space-y-4"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span
            className="text-xs uppercase tracking-wider font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cumulative Totals
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3.5 h-3.5" />
                <span>Hours read</span>
              </div>
              <div className="text-xl font-semibold tabular-nums">{totalHours}h</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <FileText className="w-3.5 h-3.5" />
                <span>Pages read</span>
              </div>
              <div className="text-xl font-semibold tabular-nums">{totalPages}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Words est.</span>
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {totalWords.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Finished</span>
              </div>
              <div className="text-xl font-semibold tabular-nums">{completedDocs}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

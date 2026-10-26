import React, { useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Flame,
  Archive,
  BookOpen,
} from 'lucide-react';
import { DocumentRecord, TaskRecord, TaskLogRecord } from '../../data/db';
import { computeTaskStreak } from '../tracking/statsQueries';

interface TasksProps {
  tasks: TaskRecord[];
  taskLogs: TaskLogRecord[];
  documents: DocumentRecord[];
  todayKey: string;
  onCreateTask: (
    title: string,
    schedule: 'once' | 'daily' | 'weekdays',
    linkedDocId: string | null
  ) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onReorderTask: (taskId: string, direction: 'up' | 'down') => void;
  onArchiveTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenDocument: (docId: string) => void;
}

const STARTER_SUGGESTIONS: Array<{
  title: string;
  schedule: 'once' | 'daily' | 'weekdays';
}> = [
  { title: 'Read 15 minutes before sleep', schedule: 'daily' },
  { title: 'Review due flashcards with morning coffee', schedule: 'weekdays' },
  { title: 'Summarize one chapter in margin notes', schedule: 'daily' },
];

export const Tasks: React.FC<TasksProps> = ({
  tasks,
  taskLogs,
  documents,
  todayKey,
  onCreateTask,
  onToggleTask,
  onReorderTask,
  onArchiveTask,
  onDeleteTask,
  onOpenDocument,
}) => {
  const [title, setTitle] = useState('');
  const [schedule, setSchedule] = useState<'once' | 'daily' | 'weekdays'>('daily');
  const [linkedDocId, setLinkedDocId] = useState<string>('');

  const activeTasks = tasks
    .filter((t) => !t.archivedAt)
    .sort((a, b) => a.order - b.order);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateTask(trimmed, schedule, linkedDocId || null);
    setTitle('');
    setLinkedDocId('');
  };

  return (
    <div
      className="p-6 rounded-[8px] border"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Personal Reading Routine</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Recurring reading habits & checklist items stored locally
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a reading habit or task..."
          className="flex-1 px-3 py-2 rounded-[6px] border text-sm focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-Primary)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-Primary)',
          }}
        />
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as 'once' | 'daily' | 'weekdays')}
          aria-label="Task schedule"
          className="px-3 py-2 rounded-[6px] border text-xs"
          style={{
            backgroundColor: 'var(--bg-Primary)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-Primary)',
          }}
        >
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="once">Once</option>
        </select>
        {documents.length > 0 && (
          <select
            value={linkedDocId}
            onChange={(e) => setLinkedDocId(e.target.value)}
            aria-label="Link document (optional)"
            className="px-3 py-2 rounded-[6px] border text-xs max-w-[180px] truncate"
            style={{
              backgroundColor: 'var(--bg-Primary)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-Primary)',
            }}
          >
            <option value="">Any document</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-medium text-white shrink-0"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </form>

      {activeTasks.length === 0 ? (
        <div
          className="p-4 rounded-[6px] border border-dashed"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs mb-2.5" style={{ color: 'var(--text-secondary)' }}>
            No routine tasks yet. Tap a starter habit to add it:
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTER_SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => onCreateTask(s.title, s.schedule, null)}
                className="px-3 py-1.5 rounded-[4px] border text-xs transition-colors hover:opacity-90"
                style={{
                  backgroundColor: 'var(--bg-Primary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-Primary)',
                }}
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {activeTasks.map((task, idx) => {
            const isDoneToday = taskLogs.some(
              (l) =>
                l.taskId === task.id &&
                (task.schedule === 'once' || l.dateKey === todayKey) &&
                l.completedAt !== null
            );
            const streak = computeTaskStreak(task, taskLogs, todayKey);
            const linkedDoc = task.linkedDocId
              ? documents.find((d) => d.id === task.linkedDocId)
              : undefined;

            return (
              <li
                key={task.id}
                className="p-3 rounded-[6px] border flex items-center justify-between gap-3"
                style={{
                  backgroundColor: 'var(--bg-Primary)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDoneToday}
                    onClick={() => onToggleTask(task.id, !isDoneToday)}
                    className="w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: isDoneToday ? 'var(--accent-primary)' : 'transparent',
                      borderColor: isDoneToday
                        ? 'var(--accent-primary)'
                        : 'var(--border-strong)',
                      color: '#fff',
                    }}
                  >
                    {isDoneToday && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm ${isDoneToday ? 'line-through opacity-60' : ''}`}
                      >
                        {task.title}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] border"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {task.schedule}
                      </span>
                      {streak > 0 && task.schedule !== 'once' && (
                        <span
                          className="inline-flex items-center gap-0.5 text-xs tabular-nums"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          <Flame className="w-3 h-3" />
                          {streak}d
                        </span>
                      )}
                    </div>
                    {linkedDoc && (
                      <button
                        type="button"
                        onClick={() => onOpenDocument(linkedDoc.id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs hover:underline"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <BookOpen className="w-3 h-3" />
                        <span className="truncate max-w-[220px]">{linkedDoc.title}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onReorderTask(task.id, 'up')}
                    className="p-1.5 rounded disabled:opacity-30"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Move task up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === activeTasks.length - 1}
                    onClick={() => onReorderTask(task.id, 'down')}
                    className="p-1.5 rounded disabled:opacity-30"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Move task down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchiveTask(task.id)}
                    className="p-1.5 rounded"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Archive task"
                    title="Archive task"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 rounded"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="Delete task"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Flame, SlidersHorizontal, Check } from 'lucide-react';

interface GoalArcProps {
  todayMinutes: number;
  todaySeconds: number;
  todayPages: number;
  dailyMinutesGoal: number;
  dailyPagesGoal: number | null;
  currentStreak: number;
  longestStreak: number;
  onUpdateGoal: (minutes: number, pages: number | null) => void;
}

export const GoalArc: React.FC<GoalArcProps> = ({
  todayMinutes,
  todaySeconds,
  todayPages,
  dailyMinutesGoal,
  dailyPagesGoal,
  currentStreak,
  longestStreak,
  onUpdateGoal,
}) => {
  const [editing, setEditing] = useState(false);
  const [minInput, setMinInput] = useState(dailyMinutesGoal);
  const [pagesInput, setPagesInput] = useState(dailyPagesGoal ?? 10);

  const exactMinutes = todaySeconds / 60;
  const progress = Math.min(1, dailyMinutesGoal > 0 ? exactMinutes / dailyMinutesGoal : 0);

  // 240-degree open arc geometry
  const size = 210;
  const strokeWidth = 10;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + 12;

  const startAngle = 150; // degrees
  const sweepAngle = 240; // degrees
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const polarToCartesian = (angleDeg: number) => ({
    x: cx + r * Math.cos(toRad(angleDeg)),
    y: cy + r * Math.sin(toRad(angleDeg)),
  });

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(startAngle + sweepAngle);
  const arcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;

  return (
    <div
      className="p-6 rounded-[8px] border flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Daily Reading Goal
        </span>
        <button
          type="button"
          onClick={() => {
            setMinInput(dailyMinutesGoal);
            setPagesInput(dailyPagesGoal ?? 10);
            setEditing((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-Secondary)',
          }}
          aria-label="Edit daily reading goal"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Goal: {dailyMinutesGoal}m</span>
        </button>
      </div>

      {editing ? (
        <div
          className="my-4 p-4 rounded-[6px] border space-y-4"
          style={{
            backgroundColor: 'var(--bg-Primary)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>Daily minutes target</span>
              <span className="tabular-nums font-medium">{minInput} min</span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={minInput}
              onChange={(e) => setMinInput(Number(e.target.value))}
              className="w-full accent-[var(--accent-primary)]"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>Daily pages target</span>
              <span className="tabular-nums font-medium">{pagesInput} pages</span>
            </div>
            <input
              type="range"
              min={2}
              max={60}
              step={2}
              value={pagesInput}
              onChange={(e) => setPagesInput(Number(e.target.value))}
              className="w-full accent-[var(--accent-primary)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateGoal(minInput, pagesInput);
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Check className="w-3.5 h-3.5" />
              Save goal
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center my-1">
          <svg
            width={size}
            height={size - 28}
            viewBox={`0 0 ${size} ${size - 20}`}
            aria-label={`${todayMinutes} of ${dailyMinutesGoal} minutes read today`}
          >
            <path
              d={arcPath}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={arcPath}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - progress}
              style={{
                transition: 'stroke-dashoffset 680ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
            <div
              className="text-3xl font-semibold tabular-nums tracking-tight"
              style={{ fontFamily: 'var(--font-reading)', color: 'var(--text-Primary)' }}
            >
              {todayMinutes}
              <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}
                / {dailyMinutesGoal}m
              </span>
            </div>
            <span className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {todayPages} {todayPages === 1 ? 'page' : 'pages'} today
            </span>
          </div>
        </div>
      )}

      <div
        className="pt-3 border-t flex items-center justify-between text-xs"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-1.5">
          <Flame
            className="w-4 h-4"
            style={{
              color: currentStreak > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          />
          <span className="font-medium tabular-nums">
            {currentStreak} {currentStreak === 1 ? 'day' : 'days'} streak
          </span>
        </div>
        <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
          Longest: {longestStreak}d
        </span>
      </div>
    </div>
  );
};

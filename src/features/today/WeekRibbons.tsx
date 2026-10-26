import React from 'react';
import { DailyAggregate, getDayOfWeekLabel } from '../tracking/statsQueries';

interface WeekRibbonsProps {
  days: DailyAggregate[];
  todayKey: string;
  dailyMinutesGoal: number;
}

export const WeekRibbons: React.FC<WeekRibbonsProps> = ({
  days,
  todayKey,
  dailyMinutesGoal,
}) => {
  const maxMinutes = Math.max(dailyMinutesGoal, ...days.map((d) => d.minutes), 15);

  return (
    <div
      className="p-6 rounded-[8px] border flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Past 7 Days
        </span>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          Target {dailyMinutesGoal}m/day
        </span>
      </div>

      <div className="grid grid-cols-7 gap-3 items-end h-40 pt-4 pb-1">
        {days.map((day, idx) => {
          const isToday = day.dateKey === todayKey;
          const heightPct =
            day.activeSeconds > 0
              ? Math.max(18, Math.min(100, Math.round((day.minutes / maxMinutes) * 100)))
              : 10;
          const goalMet = day.activeSeconds >= dailyMinutesGoal * 60;

          return (
            <div key={day.dateKey} className="flex flex-col items-center h-full justify-end">
              <span
                className="text-[11px] tabular-nums mb-1.5"
                style={{
                  color: day.minutes > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}
              >
                {day.minutes > 0 ? `${day.minutes}m` : '·'}
              </span>

              <div
                className="w-full max-w-[30px] flex-1 flex items-end justify-center rounded-t-[4px]"
                style={{ backgroundColor: 'var(--bg-Secondary)' }}
              >
                {/* Swallowtail bookmark ribbon */}
                <div
                  className="w-full rounded-t-[4px] transition-all duration-500"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: goalMet
                      ? 'var(--accent-primary)'
                      : day.activeSeconds > 0
                      ? 'color-mix(in srgb, var(--accent-primary) 55%, var(--bg-Secondary))'
                      : 'var(--border-subtle)',
                    clipPath:
                      day.activeSeconds > 0
                        ? 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 6px), 0 100%)'
                        : undefined,
                    transitionDelay: `${idx * 45}ms`,
                  }}
                  title={`${day.dateKey}: ${day.minutes} min, ${day.pagesRead} pages`}
                />
              </div>

              <span
                className="mt-2 text-xs font-medium tabular-nums"
                style={{
                  color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isToday ? 600 : 500,
                }}
              >
                {getDayOfWeekLabel(day.dateKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

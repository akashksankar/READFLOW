import React from 'react';
import { DailyAggregate, shiftDateKey } from '../tracking/statsQueries';

interface HeatMapProps {
  byDate: Map<string, DailyAggregate>;
  todayKey: string;
  dailyMinutesGoal: number;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  byDate,
  todayKey,
  dailyMinutesGoal,
}) => {
  // 12 weeks = 84 days ending today
  const weeks: Array<Array<{ dateKey: string; minutes: number; pages: number }>> = [];
  for (let w = 11; w >= 0; w--) {
    const col: Array<{ dateKey: string; minutes: number; pages: number }> = [];
    for (let d = 6; d >= 0; d--) {
      const offset = -(w * 7 + d);
      const key = shiftDateKey(todayKey, offset);
      const agg = byDate.get(key);
      col.push({
        dateKey: key,
        minutes: agg?.minutes ?? 0,
        pages: agg?.pagesRead ?? 0,
      });
    }
    weeks.push(col);
  }

  const getIntensityColor = (minutes: number): string => {
    if (minutes <= 0) return 'var(--bg-Secondary)';
    const ratio = minutes / Math.max(10, dailyMinutesGoal);
    if (ratio < 0.35) return 'color-mix(in srgb, var(--accent-primary) 28%, var(--bg-Secondary))';
    if (ratio < 0.75) return 'color-mix(in srgb, var(--accent-primary) 55%, var(--bg-Secondary))';
    if (ratio < 1.1) return 'color-mix(in srgb, var(--accent-primary) 82%, var(--bg-Secondary))';
    return 'var(--accent-primary)';
  };

  return (
    <div
      className="p-5 rounded-[8px] border"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          12-Week Reading Cadence
        </span>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>Less</span>
          {[0, 0.25, 0.6, 0.9, 1.2].map((r, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-[2px] inline-block border"
              style={{
                backgroundColor: getIntensityColor(r * dailyMinutesGoal),
                borderColor: 'var(--border-subtle)',
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1.5">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1.5">
            {week.map((cell) => (
              <div
                key={cell.dateKey}
                className="h-3.5 rounded-[2px] border transition-colors"
                style={{
                  backgroundColor: getIntensityColor(cell.minutes),
                  borderColor:
                    cell.dateKey === todayKey ? 'var(--accent-primary)' : 'var(--border-subtle)',
                }}
                title={`${cell.dateKey}: ${cell.minutes}m (${cell.pages} pages)`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

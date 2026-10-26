import React from 'react';
import { CheckCircle2, Circle, Compass } from 'lucide-react';
import { ActiveChallenge } from '../tracking/statsQueries';

interface ChallengesProps {
  challenges: ActiveChallenge[];
}

export const Challenges: React.FC<ChallengesProps> = ({ challenges }) => {
  return (
    <div
      className="p-6 rounded-[8px] border"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h2 className="text-sm font-semibold tracking-tight">Today’s Reading Challenges</h2>
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          Auto-verified from reading
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {challenges.map((ch) => {
          const isDone = ch.progress >= ch.target;
          const pct = Math.min(100, Math.round((ch.progress / Math.max(1, ch.target)) * 100));

          return (
            <div
              key={ch.key}
              className="p-4 rounded-[6px] border flex flex-col justify-between transition-colors"
              style={{
                backgroundColor: isDone
                  ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-Primary))'
                  : 'var(--bg-Primary)',
                borderColor: isDone ? 'var(--accent-primary)' : 'var(--border-subtle)',
              }}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{ch.title}</span>
                  {isDone ? (
                    <CheckCircle2
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--accent-primary)' }}
                    />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {ch.description}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[11px] tabular-nums mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span className="font-medium">
                    {ch.progress} / {ch.target} {ch.unit}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-Secondary)' }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

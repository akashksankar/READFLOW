import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Layers } from 'lucide-react';
import { db } from '../../data/db';

export type TopLevelSection = 'library' | 'today' | 'cards';

interface NavigationShellProps {
  activeSection: TopLevelSection;
  onSelectSection: (section: TopLevelSection) => void;
  children: React.ReactNode;
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeSection,
  onSelectSection,
  children,
}) => {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refreshDue = async () => {
      try {
        const all = await db.cards.toArray();
        const now = Date.now();
        const count = all.filter((c) => !c.suspended && c.dueAt <= now).length;
        if (mounted) setDueCount(count);
      } catch {
        // ignore
      }
    };
    void refreshDue();
    const id = window.setInterval(refreshDue, 5000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [activeSection]);

  const navItems: Array<{
    id: TopLevelSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'cards', label: 'Cards', icon: Layers, badge: dueCount },
  ];

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{
        backgroundColor: 'var(--bg-Primary)',
        color: 'var(--text-Primary)',
      }}
    >
      {/* Slim Left Rail on Desktop / Tablet Landscape */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex flex-col items-center py-6 px-2.5 w-20 border-r shrink-0 sticky top-0 h-screen justify-between"
        style={{
          backgroundColor: 'var(--bg-Secondary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col items-center gap-6 w-full">
          <button
            type="button"
            onClick={() => onSelectSection('library')}
            className="w-10 h-10 rounded-[8px] border flex items-center justify-center font-serif font-semibold text-base"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent-primary)',
            }}
            title="ReadFlow"
          >
            R
          </button>

          <nav className="flex flex-col gap-2 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className="relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-[6px] text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="absolute top-1.5 right-2 px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums text-white"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 pb-16 md:pb-0">{children}</div>

      {/* Bottom Navigation Bar on Phones */}
      <nav
        aria-label="Mobile primary navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-15 border-t grid grid-cols-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className="relative flex flex-col items-center justify-center gap-1 text-xs font-medium"
              style={{
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="absolute top-1.5 right-1/4 px-1.5 rounded-full text-[10px] font-semibold tabular-nums text-white"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

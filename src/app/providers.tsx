import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { MotionConfig } from 'motion/react';
import {
  db,
  DEFAULT_READING_SETTINGS,
  type ReadingSettings,
  type ThemeId,
} from '../data/db';
import { detectHardwareLiteMode, prefersReducedMotionOS } from '../lib/device';
import { ensureFontLoaded } from '../features/typography/styles';

interface AppContextValue {
  settings: ReadingSettings;
  updateSettings: (partial: Partial<ReadingSettings>) => void;
  setThemeWithReveal: (theme: ThemeId, originEvent?: React.MouseEvent | { clientX: number; clientY: number }) => void;
  resetToDefaults: () => void;
  isReducedMotion: boolean;
  isLiteMode: boolean;
  storageBlocked: boolean;
  hasPlayedIntro: boolean;
  markIntroPlayed: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const THEME_BG_HEX: Record<ThemeId, string> = {
  paper: '#F6F0E4',
  sepia: '#EBDDC1',
  forest: '#16241D',
  midnight: '#10131C',
  oled: '#000000',
};

function applyThemeToDOM(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'paper' || theme === 'sepia' ? 'light' : 'dark';
  const meta = document.getElementById('theme-color-meta');
  if (meta) {
    meta.setAttribute('content', THEME_BG_HEX[theme]);
  }
  try {
    localStorage.setItem('readflow_theme', theme);
  } catch {
    // Ignore storage block
  }
}

function getInitialSettings(): ReadingSettings {
  let initialTheme: ThemeId = DEFAULT_READING_SETTINGS.theme;
  try {
    const savedTheme = localStorage.getItem('readflow_theme') as ThemeId | null;
    if (savedTheme && savedTheme in THEME_BG_HEX) {
      initialTheme = savedTheme;
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      initialTheme = 'midnight';
    }
    const savedJson = localStorage.getItem('readflow_settings_v1');
    if (savedJson) {
      const parsed = JSON.parse(savedJson) as Partial<ReadingSettings>;
      const merged: ReadingSettings = {
        ...DEFAULT_READING_SETTINGS,
        ...parsed,
        theme: parsed.theme && parsed.theme in THEME_BG_HEX ? parsed.theme : initialTheme,
        readingFont: parsed.readingFont ?? parsed.fontFamily ?? 'literata',
      };
      return merged;
    }
  } catch {
    // Ignore
  }
  return {
    ...DEFAULT_READING_SETTINGS,
    theme: initialTheme,
  };
}

let sessionIntroPlayed = false;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReadingSettings>(getInitialSettings);
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(prefersReducedMotionOS);
  const [hardwareLite] = useState<boolean>(detectHardwareLiteMode);
  const [storageBlocked, setStorageBlocked] = useState<boolean>(false);
  const [hasPlayedIntro, setHasPlayedIntro] = useState<boolean>(sessionIntroPlayed);

  // Sync with OS prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setOsReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load persisted settings from IndexedDB on mount & check storage availability
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await db.open();
        const row = await db.settings.get('reading_settings');
        if (active && row && row.value && typeof row.value === 'object') {
          const val = row.value as Partial<ReadingSettings>;
          const loaded: ReadingSettings = {
            ...DEFAULT_READING_SETTINGS,
            ...val,
            readingFont: val.readingFont ?? val.fontFamily ?? 'literata',
          };
          setSettings(loaded);
          applyThemeToDOM(loaded.theme);
          void ensureFontLoaded(loaded.readingFont);
          void ensureFontLoaded(loaded.headingFont);
          try {
            localStorage.setItem('readflow_settings_v1', JSON.stringify(loaded));
          } catch {
            // ignore
          }
        }
      } catch {
        if (active) setStorageBlocked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Lazily load active reading & heading fonts whenever they change
  useEffect(() => {
    void ensureFontLoaded(settings.readingFont ?? settings.fontFamily);
    void ensureFontLoaded(settings.headingFont);
  }, [settings.readingFont, settings.fontFamily, settings.headingFont]);

  const isReducedMotion = useMemo(() => {
    if (settings.motion === 'reduced') return true;
    if (settings.motion === 'full') return false;
    return osReducedMotion;
  }, [settings.motion, osReducedMotion]);

  const isLiteMode = useMemo(() => {
    if (settings.motion === 'reduced') return true;
    if (settings.motion === 'full') return false;
    return hardwareLite || osReducedMotion;
  }, [settings.motion, hardwareLite, osReducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    if (isReducedMotion) {
      root.setAttribute('data-motion', 'reduced');
    } else {
      root.removeAttribute('data-motion');
    }
  }, [isReducedMotion]);

  const persistSettings = useCallback((next: ReadingSettings) => {
    try {
      localStorage.setItem('readflow_settings_v1', JSON.stringify(next));
      localStorage.setItem('readflow_theme', next.theme);
    } catch {
      // Ignore
    }
    db.settings.put({ key: 'reading_settings', value: next }).catch(() => {
      setStorageBlocked(true);
    });
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<ReadingSettings>) => {
      setSettings((prev) => {
        const next: ReadingSettings = {
          ...prev,
          ...partial,
          fontFamily: partial.readingFont ?? partial.fontFamily ?? prev.fontFamily,
          readingFont: partial.readingFont ?? partial.fontFamily ?? prev.readingFont,
        };
        if (partial.theme && partial.theme !== prev.theme) {
          applyThemeToDOM(partial.theme);
        }
        persistSettings(next);
        return next;
      });
    },
    [persistSettings]
  );

  const setThemeWithReveal = useCallback(
    (newTheme: ThemeId, originEvent?: React.MouseEvent | { clientX: number; clientY: number }) => {
      if (newTheme === settings.theme) return;

      const commitTheme = () => {
        applyThemeToDOM(newTheme);
        setSettings((prev) => {
          const next = { ...prev, theme: newTheme };
          persistSettings(next);
          return next;
        });
      };

      const docWithVT = document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      };

      if (!isReducedMotion && !isLiteMode && typeof docWithVT.startViewTransition === 'function' && originEvent) {
        const x = originEvent.clientX ?? window.innerWidth / 2;
        const y = originEvent.clientY ?? window.innerHeight / 2;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        try {
          const transition = docWithVT.startViewTransition(() => {
            commitTheme();
          });
          transition.ready
            .then(() => {
              document.documentElement.animate(
                {
                  clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                  ],
                },
                {
                  duration: 380,
                  easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
                  pseudoElement: '::view-transition-new(root)',
                }
              );
            })
            .catch(() => {
              // fallback already applied
            });
          return;
        } catch {
          // Fallback below
        }
      }

      const root = document.documentElement;
      if (!isReducedMotion) {
        root.classList.add('theme-transition');
        commitTheme();
        window.setTimeout(() => {
          root.classList.remove('theme-transition');
        }, 220);
      } else {
        commitTheme();
      }
    },
    [settings.theme, isReducedMotion, isLiteMode, persistSettings]
  );

  const resetToDefaults = useCallback(() => {
    setSettings((prev) => {
      const next: ReadingSettings = {
        ...DEFAULT_READING_SETTINGS,
        ambienceBed: prev.ambienceBed,
        ambienceVolume: prev.ambienceVolume,
      };
      applyThemeToDOM(next.theme);
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const markIntroPlayed = useCallback(() => {
    sessionIntroPlayed = true;
    setHasPlayedIntro(true);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      setThemeWithReveal,
      resetToDefaults,
      isReducedMotion,
      isLiteMode,
      storageBlocked,
      hasPlayedIntro,
      markIntroPlayed,
    }),
    [
      settings,
      updateSettings,
      setThemeWithReveal,
      resetToDefaults,
      isReducedMotion,
      isLiteMode,
      storageBlocked,
      hasPlayedIntro,
      markIntroPlayed,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      <MotionConfig reducedMotion={isReducedMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </AppContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used inside AppProviders');
  }
  return ctx;
}

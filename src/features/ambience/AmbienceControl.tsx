import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Volume2 } from 'lucide-react';
import type { SoundscapeId } from '../../data/db';
import { useAppSettings } from '../../app/providers';
import { Sheet } from '../../motion/Sheet';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { ambienceEngine } from './engine';
import { Button, FolioSlider } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

const SOUNDSCAPES: { id: SoundscapeId; label: string; desc: string }[] = [
  {
    id: 'rain',
    label: 'Rain',
    desc: 'Synthesized pink noise & soft droplets',
  },
  {
    id: 'forest',
    label: 'Forest',
    desc: 'Synthesized wind & distant bird calls',
  },
  {
    id: 'seashore',
    label: 'Seashore',
    desc: 'Synthesized brown noise & slow tide swell',
  },
];

interface AmbienceControlProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AmbienceControl({ open, onOpenChange }: AmbienceControlProps) {
  const { settings, updateSettings } = useAppSettings();
  const { isReducedMotion, isLiteMode } = useAppMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return ambienceEngine.subscribe((state) => {
      setPlaying(state.playing);
    });
  }, []);

  const handleSelectBed = (bed: SoundscapeId) => {
    updateSettings({ ambienceBed: bed });
    ambienceEngine.selectBed(bed, settings.ambienceVolume);
  };

  const handleTogglePlay = () => {
    ambienceEngine.toggle(settings.ambienceBed, settings.ambienceVolume);
  };

  const handleVolumeChange = (val: number) => {
    updateSettings({ ambienceVolume: val });
    ambienceEngine.setVolume(val);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ambience"
      description="Synthesized ambient soundscapes for focused reading"
      mode="dialog-or-sheet"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="folio-label">Synthesized soundscapes (Web Audio)</span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTogglePlay}
            aria-label={playing ? 'Pause ambience' : 'Play ambience'}
          >
            <Icon icon={playing ? Pause : Play} />
            <span>{playing ? 'Pause' : 'Play'}</span>
          </Button>
        </div>

        {/* Three large touch tiles with shared layoutId border and level meter on active one */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SOUNDSCAPES.map((item) => {
            const active = settings.ambienceBed === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectBed(item.id)}
                aria-pressed={active}
                className={cn(
                  'btn-press relative flex flex-col justify-between rounded-[var(--radius-sm)] border border-line bg-bg/60 p-3.5 text-left min-h-[84px]',
                  active && 'bg-bg'
                )}
              >
                {active && (
                  <motion.span
                    layoutId={
                      !isReducedMotion && !isLiteMode ? 'ambience-tile-border' : undefined
                    }
                    transition={{
                      duration: MOTION_TOKENS.dur.fast,
                      ease: MOTION_TOKENS.ease.out,
                    }}
                    className="pointer-events-none absolute inset-0 rounded-[var(--radius-sm)] border-2 border-accent"
                  />
                )}

                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-display text-base font-medium text-ink">
                    {item.label}
                  </span>

                  {/* Level meter: 3 CSS scaleY bars when playing (or static dot under reduced motion) */}
                  {active && playing && (
                    <div
                      aria-label="Playing"
                      className="flex h-3.5 items-end gap-[2px]"
                    >
                      {isReducedMotion ? (
                        <span className="h-2 w-2 rounded-[var(--radius-pill)] bg-accent" />
                      ) : (
                        <>
                          <span className="meter-bar-1 h-3.5 w-[2px] bg-accent" />
                          <span className="meter-bar-2 h-3.5 w-[2px] bg-accent" />
                          <span className="meter-bar-3 h-3.5 w-[2px] bg-accent" />
                        </>
                      )}
                    </div>
                  )}
                </div>

                <span className="mt-2 text-xs text-ink-3 leading-snug">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Volume slider */}
        <div className="border-t border-line pt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="folio-label inline-flex items-center gap-1.5">
              <Icon icon={Volume2} className="h-4 w-4 text-ink-3" />
              <span>Volume</span>
            </span>
            <span className="font-folio text-xs text-ink-2">
              {Math.round(settings.ambienceVolume * 100)}%
            </span>
          </div>
          <FolioSlider
            value={Math.round(settings.ambienceVolume * 100)}
            min={0}
            max={100}
            step={1}
            ariaLabel="Ambience volume"
            formatBubble={(v) => `${v}%`}
            onValueChange={(v) => handleVolumeChange(v / 100)}
          />
        </div>
      </div>
    </Sheet>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { Upload } from 'lucide-react';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { Button } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';

interface EmptyStateProps {
  onImportClick: () => void;
}

/**
 * First-use Empty State:
 * The page's main composition, not a small card.
 * Line-drawn open book with a ribbon (SVG, animated once: book strokes in over 900ms, ribbon drops with spring.tap),
 * heading "Bring a PDF. Fall into reading.",
 * one sentence ("Works best with text-based PDFs. Your files stay on this device."),
 * the Import button, a drag-and-drop zone on desktop, and two small lines explaining Comfort and Original modes.
 */
export function EmptyState({ onImportClick }: EmptyStateProps) {
  const { isReducedMotion } = useAppMotion();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-10 sm:py-16 text-center">
      {/* Line-drawn open book with dropping terracotta ribbon */}
      <div className="relative mb-7 flex items-center justify-center">
        <svg
          width="136"
          height="96"
          viewBox="0 0 136 96"
          fill="none"
          aria-hidden="true"
          className="text-ink"
        >
          {/* Left page */}
          <path
            d="M68 22C54 16 32 15 16 19V76C32 72 54 73 68 79"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-draw-once"
          />
          {/* Right page */}
          <path
            d="M68 22C82 16 104 15 120 19V76C104 72 82 73 68 79"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-draw-once"
          />
          {/* Spine & lower page edges */}
          <path
            d="M68 22V82M12 81C30 76 52 77 68 83C84 77 106 76 124 81"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="stroke-draw-once"
          />
          {/* Quiet page text rules */}
          <path
            d="M26 34H56M26 44H56M26 54H48M80 34H110M80 44H110M80 54H102"
            stroke="var(--line)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="stroke-draw-once"
          />
        </svg>

        {/* Terracotta bookmark ribbon dropping from spine */}
        <motion.svg
          width="16"
          height="42"
          viewBox="0 0 16 42"
          fill="none"
          aria-hidden="true"
          initial={isReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            isReducedMotion
              ? { duration: 0.1 }
              : { ...MOTION_TOKENS.spring.tap, delay: 0.65 }
          }
          className="absolute top-[18px] text-accent"
        >
          <path d="M3 0H13V40L8 33L3 40V0Z" fill="currentColor" />
        </motion.svg>
      </div>

      <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-ink text-balance">
        Bring a PDF. Fall into reading.
      </h1>

      <p className="mt-3 max-w-md text-sm sm:text-base text-ink-2 leading-relaxed">
        Works best with text-based PDFs. Your files stay on this device.
      </p>

      <div className="mt-7 flex flex-col items-center gap-3 w-full sm:w-auto">
        <Button
          variant="accent"
          onClick={onImportClick}
          className="w-full sm:w-auto px-6"
        >
          <Icon icon={Upload} />
          <span>Import PDF</span>
        </Button>

        {/* Desktop drag-and-drop zone */}
        <button
          type="button"
          onClick={onImportClick}
          className="hidden sm:flex mt-2 w-full min-w-[340px] flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-line bg-surface/50 px-6 py-5 text-xs text-ink-3 transition-colors duration-[var(--dur-fast)] hover:border-ink-3 hover:text-ink-2"
        >
          <span>Or drag and drop a PDF anywhere on this window</span>
        </button>
      </div>

      {/* Two small lines beneath explaining Comfort and Original modes */}
      <div className="mt-10 w-full max-w-md border-t border-line pt-5 text-left space-y-2.5 text-xs text-ink-2">
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-medium text-ink shrink-0">Comfort mode</span>
          <span className="text-right text-ink-3">
            Reflows pages into a calm, customizable book column.
          </span>
        </p>
        <div className="border-t border-line/60" />
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-medium text-ink shrink-0">Original mode</span>
          <span className="text-right text-ink-3">
            One-tap return to the exact PDF page layout and figures.
          </span>
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import { motion, type MotionValue } from 'motion/react';
import { MOTION_TOKENS } from '../motion/tokens';
import { useAppMotion } from '../motion/useReducedMotion';
import { cn } from '../lib/cn';

/**
 * The Ribbon: ReadFlow's single signature motif.
 * Used as:
 * 1. Brand mark beside wordmark
 * 2. Bookmark icon (outline when inactive, filled terracotta with downward spring.tap drop when active)
 * 3. Reading progress line (2px top edge or inline continue-reading bar)
 * 4. Active theme swatch corner
 */

export function BrandRibbonMark({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="20"
      viewBox="0 0 12 20"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0 text-accent', className)}
    >
      <path
        d="M1 0H11V19L6 14.5L1 19V0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BookmarkRibbonIcon({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const { isReducedMotion } = useAppMotion();
  return (
    <motion.svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      initial={false}
      animate={
        active && !isReducedMotion
          ? { y: [-6, 0] }
          : { y: 0 }
      }
      transition={MOTION_TOKENS.spring.tap}
      className={cn(
        'shrink-0 transition-colors duration-[var(--dur-fast)]',
        active ? 'text-accent' : 'text-ink',
        className
      )}
    >
      <path
        d="M5 2.5H15V17.5L10 13.5L5 17.5V2.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export function RibbonProgressBar({
  progress,
  motionScaleX,
  currentPage,
  totalPages,
  className,
  fixedTop = false,
}: {
  progress?: number; // 0..100
  motionScaleX?: MotionValue<number>;
  currentPage?: number;
  totalPages?: number;
  className?: string;
  fixedTop?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, progress ?? 0));
  const valueText =
    currentPage && totalPages
      ? `Page ${currentPage} of ${totalPages}`
      : `${Math.round(pct)}% complete`;

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={valueText}
      className={cn(
        'w-full h-[2px] bg-line/50 overflow-hidden',
        fixedTop && 'fixed top-0 left-0 right-0 z-50 pointer-events-none',
        className
      )}
    >
      {motionScaleX ? (
        <motion.div
          className="h-full w-full bg-accent origin-left"
          style={{ scaleX: motionScaleX }}
        />
      ) : (
        <div
          className="h-full w-full bg-accent origin-left transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      )}
    </div>
  );
}

export function ThemeCornerRibbon() {
  return (
    <svg
      width="14"
      height="18"
      viewBox="0 0 14 18"
      fill="none"
      aria-hidden="true"
      className="absolute top-0 right-2 text-accent pointer-events-none"
    >
      <path d="M2 0H12V17L7 13L2 17V0Z" fill="currentColor" />
    </svg>
  );
}

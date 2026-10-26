import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { OpeningAnimationStyle } from '../../data/db';
import { MOTION_TOKENS } from '../../motion/tokens';
import { SplitText } from './SplitText';

interface OpeningSequenceProps {
  title: string;
  fileName: string;
  pageCount: number;
  mode: OpeningAnimationStyle;
  shouldAnimate: boolean;
  onSkipOrComplete?: () => void;
}

/**
 * OpeningSequence (Page 1 title block header):
 * - Waits for document.fonts.ready (with a 300ms timeout) so no reflow occurs mid-animation.
 * - Reserves final height so nothing shifts underneath.
 * - 120..640ms: Document title reveals via SplitText
 * - 300..760ms: Hairline rule draws left-to-right (scaleX), then fileName & page count fade in
 * - 500..1100ms: Top margin ribbon drops with spring.tap
 * - Any tap ("Skip") or scroll immediately snaps to the final state.
 */
export function OpeningSequence({
  title,
  fileName,
  pageCount,
  mode,
  shouldAnimate,
  onSkipOrComplete,
}: OpeningSequenceProps) {
  const [fontsReady, setFontsReady] = useState(!shouldAnimate);
  const [skipped, setSkipped] = useState(!shouldAnimate || mode === 'off');

  useEffect(() => {
    if (!shouldAnimate || mode === 'off') {
      setFontsReady(true);
      setSkipped(true);
      return;
    }

    let resolved = false;
    const timer = window.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setFontsReady(true);
      }
    }, 300);

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!resolved) {
          resolved = true;
          window.clearTimeout(timer);
          setFontsReady(true);
        }
      });
    } else {
      setFontsReady(true);
    }

    const completeTimer = window.setTimeout(() => {
      setSkipped(true);
      onSkipOrComplete?.();
    }, 1150);

    const handleScrollOrPointer = () => {
      setSkipped(true);
      onSkipOrComplete?.();
    };

    window.addEventListener('wheel', handleScrollOrPointer, { passive: true, once: true });
    window.addEventListener('touchmove', handleScrollOrPointer, { passive: true, once: true });

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(completeTimer);
      window.removeEventListener('wheel', handleScrollOrPointer);
      window.removeEventListener('touchmove', handleScrollOrPointer);
    };
  }, [shouldAnimate, mode, onSkipOrComplete]);

  const isAnimating = shouldAnimate && !skipped && mode !== 'off';

  return (
    <header
      onClick={() => {
        if (isAnimating) {
          setSkipped(true);
          onSkipOrComplete?.();
        }
      }}
      className="relative mb-8 pt-2 pb-5 select-none"
    >
      {/* Dropping terracotta bookmark ribbon in top right margin (500 to 1100ms) */}
      <motion.svg
        width="14"
        height="34"
        viewBox="0 0 14 34"
        fill="none"
        aria-hidden="true"
        initial={isAnimating ? { opacity: 0, y: -12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={
          isAnimating
            ? { ...MOTION_TOKENS.spring.tap, delay: 0.5 }
            : { duration: 0 }
        }
        className="absolute -top-2 right-0 text-accent pointer-events-none"
      >
        <path d="M2 0H12V32L7 26L2 32V0Z" fill="currentColor" />
      </motion.svg>

      {/* Document title */}
      <h1 className="font-display text-2xl sm:text-3xl font-medium leading-tight text-ink pr-6 min-h-[2.25rem]">
        {fontsReady ? (
          <SplitText
            text={title}
            mode={mode}
            skipped={!isAnimating}
          />
        ) : (
          <span className="opacity-0">{title}</span>
        )}
      </h1>

      {/* Hairline rule draws left to right (300 to 760ms) */}
      <motion.div
        aria-hidden="true"
        initial={isAnimating ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={
          isAnimating
            ? { delay: 0.3, duration: 0.36, ease: MOTION_TOKENS.ease.out }
            : { duration: 0 }
        }
        className="mt-4 h-[1px] w-full origin-left bg-line"
      />

      {/* Metadata (file name & page count) + optional Skip button while animating */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <motion.p
          initial={isAnimating ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={
            isAnimating
              ? { delay: 0.44, duration: 0.28, ease: MOTION_TOKENS.ease.out }
              : { duration: 0 }
          }
          className="font-folio text-xs text-ink-3 truncate"
        >
          {fileName} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </motion.p>

        {isAnimating && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSkipped(true);
              onSkipOrComplete?.();
            }}
            className="text-[11px] font-sans text-ink-3 underline hover:text-ink"
          >
            Skip
          </button>
        )}
      </div>
    </header>
  );
}

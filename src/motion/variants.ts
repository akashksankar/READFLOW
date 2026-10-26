import type { Variants } from 'motion/react';
import { MOTION_TOKENS } from './tokens';

/**
 * Shared Motion variants: fadeUp, sheetUp, panelSlide, pop, listItem,
 * plus Phase 2 variants: openingLineRise, dropCapScale, weekRibbonRise, cardFlyOff.
 */

export const fadeUp: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: 0,
    y: reduced ? 0 : 8,
  }),
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_TOKENS.dur.base,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: (reduced?: boolean) => ({
    opacity: 0,
    y: reduced ? 0 : 4,
    transition: {
      duration: MOTION_TOKENS.exitDur.base,
      ease: MOTION_TOKENS.ease.in,
    },
  }),
};

export const routeSlideUp: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: 0,
    y: reduced ? 0 : 24,
  }),
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_TOKENS.dur.base,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: (reduced?: boolean) => ({
    opacity: 0,
    y: reduced ? 0 : 12,
    transition: {
      duration: MOTION_TOKENS.exitDur.base,
      ease: MOTION_TOKENS.ease.in,
    },
  }),
};

export const sheetUp: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: reduced ? 0 : 1,
    y: reduced ? 0 : '100%',
  }),
  animate: (reduced?: boolean) => ({
    opacity: 1,
    y: 0,
    transition: reduced
      ? { duration: 0.12, ease: MOTION_TOKENS.ease.out }
      : MOTION_TOKENS.spring.sheet,
  }),
  exit: (reduced?: boolean) => ({
    opacity: reduced ? 0 : 1,
    y: reduced ? 0 : '100%',
    transition: reduced
      ? { duration: 0.1, ease: MOTION_TOKENS.ease.in }
      : { duration: MOTION_TOKENS.exitDur.base, ease: MOTION_TOKENS.ease.in },
  }),
};

export const panelSlide: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: 0,
    x: reduced ? 0 : 24,
  }),
  animate: (reduced?: boolean) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: reduced ? 0.12 : MOTION_TOKENS.dur.base,
      ease: MOTION_TOKENS.ease.out,
    },
  }),
  exit: (reduced?: boolean) => ({
    opacity: 0,
    x: reduced ? 0 : 24,
    transition: {
      duration: reduced ? 0.1 : MOTION_TOKENS.exitDur.base,
      ease: MOTION_TOKENS.ease.in,
    },
  }),
};

export const pop: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: 0,
    scale: reduced ? 1 : 0.96,
    y: reduced ? 0 : 4,
  }),
  animate: (reduced?: boolean) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: reduced ? 0.1 : MOTION_TOKENS.dur.fast,
      ease: MOTION_TOKENS.ease.out,
    },
  }),
  exit: (reduced?: boolean) => ({
    opacity: 0,
    scale: reduced ? 1 : 0.98,
    y: reduced ? 0 : 4,
    transition: {
      duration: reduced ? 0.08 : MOTION_TOKENS.exitDur.fast,
      ease: MOTION_TOKENS.ease.in,
    },
  }),
};

export const listItem: Variants = {
  initial: (custom: { index?: number; reduced?: boolean } = {}) => ({
    opacity: 0,
    y: custom.reduced ? 0 : 8,
  }),
  animate: (custom: { index?: number; reduced?: boolean } = {}) => {
    const idx = custom.index ?? 0;
    const delay = custom.reduced
      ? 0
      : Math.min(idx, MOTION_TOKENS.stagger.maxItems) * MOTION_TOKENS.stagger.step;
    return {
      opacity: 1,
      y: 0,
      transition: {
        duration: custom.reduced ? 0.12 : MOTION_TOKENS.dur.base,
        ease: MOTION_TOKENS.ease.out,
        delay,
      },
    };
  },
  exit: (custom: { reduced?: boolean } = {}) => ({
    opacity: 0,
    transition: {
      duration: custom.reduced ? 0.08 : MOTION_TOKENS.exitDur.fast,
      ease: MOTION_TOKENS.ease.in,
    },
  }),
};

/**
 * Phase 2: Opening title line rise (120 to 640ms: rises 14px and fades in, 60ms stagger max 4 lines)
 */
export const openingLineRise: Variants = {
  initial: (custom: { reduced?: boolean } = {}) => ({
    opacity: custom.reduced ? 1 : 0,
    y: custom.reduced ? 0 : 14,
  }),
  animate: (custom: { index?: number; reduced?: boolean } = {}) => {
    if (custom.reduced) {
      return { opacity: 1, y: 0, transition: { duration: 0 } };
    }
    const idx = Math.min(3, custom.index ?? 0);
    return {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.12 + idx * MOTION_TOKENS.stagger.titleLine,
        duration: 0.34,
        ease: MOTION_TOKENS.ease.out,
      },
    };
  },
};

/**
 * Phase 2: Chapter opener Rise (360ms, once per session when heading enters viewport)
 */
export const chapterOpenerRise: Variants = {
  initial: (reduced?: boolean) => ({
    opacity: reduced ? 1 : 0,
    y: reduced ? 0 : 10,
  }),
  animate: (reduced?: boolean) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: reduced ? 0 : MOTION_TOKENS.dur.chapter,
      ease: MOTION_TOKENS.ease.out,
    },
  }),
};

/**
 * Phase 2: Week ribbon bar rise from baseline (30ms stagger, scaleY from bottom)
 */
export const weekRibbonRise: Variants = {
  initial: (custom: { reduced?: boolean } = {}) => ({
    scaleY: custom.reduced ? 1 : 0,
    opacity: custom.reduced ? 1 : 0.4,
  }),
  animate: (custom: { index?: number; reduced?: boolean } = {}) => ({
    scaleY: 1,
    opacity: 1,
    transition: custom.reduced
      ? { duration: 0 }
      : {
          delay: (custom.index ?? 0) * MOTION_TOKENS.stagger.step,
          duration: 0.42,
          ease: MOTION_TOKENS.ease.out,
        },
  }),
};

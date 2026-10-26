/**
 * Motion design tokens synced with src/styles/tokens.css
 * Exit animations run at ~70% of the entrance duration.
 */

export const MOTION_TOKENS = {
  dur: {
    instant: 0.08, // 80ms: press feedback, color swaps
    fast: 0.16,    // 160ms: hover, toggles, menus, tooltips, task check
    base: 0.24,    // 240ms: panels, mode switch, highlight wash, card flip
    flip: 0.32,    // 320ms: CSS 3D single-page turn in Paged mode
    chapter: 0.36, // 360ms: first-time chapter opener rise
    theme: 0.38,   // 380ms: theme reveal
    slow: 0.4,     // 400ms: library to reader, import success
    countUp: 0.6,  // 600ms: dashboard numeral count-up & typewriter title cap
    arcDraw: 0.7,  // 700ms: Today goal arc stroke-dashoffset draw
  },
  exitDur: {
    instant: 0.056,
    fast: 0.112,
    base: 0.168,
    slow: 0.28,
  },
  ease: {
    out: [0.22, 1, 0.36, 1] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
    in: [0.5, 0, 0.75, 0] as const,
  },
  spring: {
    sheet: {
      type: 'spring' as const,
      stiffness: 380,
      damping: 36,
      mass: 1,
    },
    tap: {
      type: 'spring' as const,
      stiffness: 600,
      damping: 32,
    },
  },
  stagger: {
    step: 0.03,      // 30ms step (covers, week ribbons)
    titleLine: 0.06, // 60ms step for opening title lines (max 4 lines)
    heatMapRow: 0.012, // 12ms step for heat map rows
    maxItems: 6,
  },
  swipe: {
    cardCommitDistancePx: 120,
    cardCommitVelocityPxPerSec: 500,
    cardMaxTiltDeg: 10,
    pageSnapDistanceRatio: 0.3,
    pageSnapVelocityPxPerSec: 400,
  },
} as const;

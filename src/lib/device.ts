/**
 * Device capability detection & Lite mode evaluation
 * Lite mode: if navigator.hardwareConcurrency <= 4 or navigator.deviceMemory <= 4,
 * default to reduced layout animation (no shared-element transition, no paper grain).
 */

export function detectHardwareLiteMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof cores === 'number' && cores <= 4) return true;
  if (typeof memory === 'number' && memory <= 4) return true;
  return false;
}

export function prefersReducedMotionOS(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Boolean(AudioCtx);
}

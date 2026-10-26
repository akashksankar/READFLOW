import React from 'react';
import { useAppSettings } from '../app/providers';

/**
 * Paper-grain overlay applied only to the app background (never behind reading text):
 * a 160px tiling SVG noise at 3% opacity, pointer-events: none,
 * disabled in OLED and when reduced-motion or lite mode is on.
 */
export function PaperGrain() {
  const { settings, isReducedMotion, isLiteMode } = useAppSettings();

  if (settings.theme === 'oled' || isReducedMotion || isLiteMode) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ opacity: 'var(--grain-opacity)' }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="readflow-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#readflow-paper-grain)" />
      </svg>
    </div>
  );
}

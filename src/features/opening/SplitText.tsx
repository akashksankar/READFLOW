import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { OpeningAnimationStyle } from '../../data/db';
import { openingLineRise } from '../../motion/variants';
import { MOTION_TOKENS } from '../../motion/tokens';

interface SplitTextProps {
  text: string;
  mode: OpeningAnimationStyle;
  skipped: boolean;
  className?: string;
}

/**
 * SplitText (~40-line component, no external package):
 * Wraps the original text with aria-label and a visually-hidden span so screen readers
 * read the title once and normally, while marking animated line/character spans aria-hidden="true".
 * - Rise: splits into up to 4 balanced lines that rise 14px and fade in with 60ms stagger.
 * - Typewriter: splits into characters (for titles <= 60 chars; longer falls back to Rise)
 *   animating opacity over <= 600ms with a thin caret that fades out.
 * - Ink fade: fades from 0 to 1 with 6px upward drift and 0.04em -> 0em letter-spacing settle.
 */
export function SplitText({ text, mode, skipped, className }: SplitTextProps) {
  const effectiveMode: OpeningAnimationStyle =
    skipped || mode === 'off'
      ? 'off'
      : mode === 'typewriter' && text.length > 60
        ? 'rise'
        : mode;

  const lines = useMemo(() => {
    const words = text.trim().split(/\s+/);
    if (words.length <= 4) return [text.trim()];
    const targetLines = Math.min(4, Math.ceil(text.length / 26));
    const perLine = Math.ceil(words.length / targetLines);
    const result: string[] = [];
    for (let i = 0; i < words.length; i += perLine) {
      result.push(words.slice(i, i + perLine).join(' '));
    }
    return result.slice(0, 4);
  }, [text]);

  if (effectiveMode === 'off') {
    return (
      <span aria-label={text} className={className}>
        {text}
      </span>
    );
  }

  if (effectiveMode === 'ink-fade') {
    return (
      <span aria-label={text} className={className}>
        <span className="sr-only">{text}</span>
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0, y: 6, letterSpacing: '0.04em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0em' }}
          transition={{
            delay: 0.12,
            duration: 0.48,
            ease: MOTION_TOKENS.ease.out,
          }}
          className="inline-block"
        >
          {text}
        </motion.span>
      </span>
    );
  }

  if (effectiveMode === 'typewriter') {
    const chars = Array.from(text);
    const stepDelay = Math.min(0.014, 0.52 / Math.max(1, chars.length));
    return (
      <span aria-label={text} className={className}>
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">
          {chars.map((ch, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: 0.12 + idx * stepDelay,
                duration: 0.06,
              }}
            >
              {ch}
            </motion.span>
          ))}
          <motion.span
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{
              delay: 0.15 + chars.length * stepDelay,
              duration: 0.25,
            }}
            className="ml-0.5 inline-block h-[0.9em] w-[1.5px] translate-y-[0.1em] bg-accent"
          />
        </span>
      </span>
    );
  }

  // Default: 'rise' by pre-split lines
  return (
    <span aria-label={text} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="block">
        {lines.map((line, idx) => (
          <motion.span
            key={idx}
            custom={{ index: idx, reduced: false }}
            variants={openingLineRise}
            initial="initial"
            animate="animate"
            className="block"
          >
            {line}
          </motion.span>
        ))}
      </span>
    </span>
  );
}

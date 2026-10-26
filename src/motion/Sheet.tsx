import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { sheetUp, panelSlide, pop } from './variants';
import { MOTION_TOKENS } from './tokens';
import { useAppMotion } from './useReducedMotion';
import { Icon } from '../ui/Icon';
import { cn } from '../lib/cn';

/**
 * Sheet & Docked Panel:
 * - Mobile (<640px): Bottom sheet (20px top corners only), drag on y axis with spring.sheet,
 *   dismiss on drag past 30% of height or velocity > 500px/s. Handle bar 36 by 4px + accessible close button.
 * - Tablet (640..1023px): Centered dialog up to 480px wide.
 * - Desktop (>=1024px): Either centered dialog (for Import) or 360px docked right panel (for Settings & Notebook)
 *   that slides in 24px with fade while pushing the canvas wrapper.
 */

export function useViewportTier(): 'mobile' | 'tablet' | 'desktop' {
  const [tier, setTier] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'mobile';
    if (window.innerWidth >= 1024) return 'desktop';
    if (window.innerWidth >= 640) return 'tablet';
    return 'mobile';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const w = window.innerWidth;
      setTier(w >= 1024 ? 'desktop' : w >= 640 ? 'tablet' : 'mobile');
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return tier;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  mode?: 'sheet' | 'docked-or-sheet' | 'dialog-or-sheet';
  halfHeightMobile?: boolean;
  children: React.ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  mode = 'dialog-or-sheet',
  halfHeightMobile = false,
  children,
}: SheetProps) {
  const tier = useViewportTier();
  const { isReducedMotion } = useAppMotion();

  const isDesktopDocked = tier === 'desktop' && mode === 'docked-or-sheet';
  const isCenteredDialog =
    (tier === 'tablet' && !halfHeightMobile) ||
    (tier === 'desktop' && mode === 'dialog-or-sheet');

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = window.innerHeight * 0.25;
    if (info.offset.y > threshold || info.velocity.y > 500) {
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!isDesktopDocked}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop (omitted when docked on desktop or half-height live preview on mobile so reader stays visible) */}
            {!isDesktopDocked && (
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: halfHeightMobile ? 0.14 : 0.32 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: isReducedMotion ? 0.1 : MOTION_TOKENS.dur.base,
                    ease: MOTION_TOKENS.ease.out,
                  }}
                  className="fixed inset-0 z-40 bg-black"
                />
              </DialogPrimitive.Overlay>
            )}

            <DialogPrimitive.Content asChild forceMount>
              {isDesktopDocked ? (
                <motion.aside
                  custom={isReducedMotion}
                  variants={panelSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  aria-label={title}
                  className="fixed top-0 right-0 bottom-0 z-40 flex w-[360px] flex-col border-l border-line bg-surface text-ink overscroll-contain focus:outline-none"
                >
                  <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                    <DialogPrimitive.Title className="font-display text-base font-medium text-ink">
                      {title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      {description || title}
                    </DialogPrimitive.Description>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label={`Close ${title}`}
                        className="btn-press inline-flex h-[44px] w-[44px] -mr-2 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 hover:text-ink"
                      >
                        <Icon icon={X} />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                    {children}
                  </div>
                </motion.aside>
              ) : isCenteredDialog ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                  <motion.div
                    custom={isReducedMotion}
                    variants={pop}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="pointer-events-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface text-ink shadow-[var(--shadow-2)] overscroll-contain focus:outline-none"
                  >
                    <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                      <DialogPrimitive.Title className="font-display text-base font-medium text-ink">
                        {title}
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="sr-only">
                        {description || title}
                      </DialogPrimitive.Description>
                      <DialogPrimitive.Close asChild>
                        <button
                          type="button"
                          aria-label={`Close ${title}`}
                          className="btn-press inline-flex h-[44px] w-[44px] -mr-2 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 hover:text-ink"
                        >
                          <Icon icon={X} />
                        </button>
                      </DialogPrimitive.Close>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                      {children}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  custom={isReducedMotion}
                  variants={sheetUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  drag={isReducedMotion ? false : 'y'}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0.04, bottom: 0.6 }}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[var(--radius-sheet)] border-t border-line bg-surface text-ink shadow-[var(--shadow-sheet)] pb-safe overscroll-contain focus:outline-none',
                    halfHeightMobile ? 'max-h-[54dvh]' : 'max-h-[86dvh]'
                  )}
                >
                  {/* Handle bar 36 by 4px */}
                  <div className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
                    <div
                      aria-hidden="true"
                      className="h-[4px] w-[36px] rounded-[var(--radius-pill)] bg-line"
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
                    <DialogPrimitive.Title className="font-display text-base font-medium text-ink">
                      {title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      {description || title}
                    </DialogPrimitive.Description>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label={`Close ${title}`}
                        className="btn-press inline-flex h-[44px] w-[44px] -mr-2 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 hover:text-ink"
                      >
                        <Icon icon={X} />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                    {children}
                  </div>
                </motion.div>
              )}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

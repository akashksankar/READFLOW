import React from 'react';
import { motion, type MotionValue } from 'motion/react';
import {
  ArrowLeft,
  Type,
  BookOpen,
  Headphones,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import type { ReaderMode } from '../../data/db';
import { MOTION_TOKENS } from '../../motion/tokens';
import { useAppMotion } from '../../motion/useReducedMotion';
import { isWebAudioSupported } from '../../lib/device';
import { Cover } from '../../ui/Cover';
import { BookmarkRibbonIcon, RibbonProgressBar } from '../../ui/Ribbon';
import { FolioSlider, SegmentedControl } from '../../ui/Primitives';
import { Icon } from '../../ui/Icon';
import { cn } from '../../lib/cn';

export type ActiveReaderSheet = 'settings' | 'notebook' | 'figures' | 'ambience' | null;

interface ChromeProps {
  docId: string;
  title: string;
  hasCoverBlob: boolean;
  currentPage: number; // 1-based
  totalPages: number;
  figureCount: number;
  mode: ReaderMode;
  visible: boolean;
  isDesktop: boolean;
  isBookmarked: boolean;
  isAmbiencePlaying: boolean;
  extractingProgress: { extracted: number; total: number } | null;
  figureScanProgress?: { scanned: number; total: number } | null;
  progressScaleX: MotionValue<number>;
  activeSheet: ActiveReaderSheet;
  onBack: () => void;
  onModeChange: (mode: ReaderMode) => void;
  onScrubPage: (pageOneBased: number) => void;
  onToggleSheet: (sheet: Exclude<ActiveReaderSheet, null>) => void;
  onToggleBookmark: () => void;
  onOpenCardMaker?: () => void;
}

export function ReaderChrome({
  docId,
  title,
  hasCoverBlob,
  currentPage,
  totalPages,
  figureCount,
  mode,
  visible,
  isDesktop,
  isBookmarked,
  isAmbiencePlaying,
  extractingProgress,
  figureScanProgress,
  progressScaleX,
  activeSheet,
  onBack,
  onModeChange,
  onScrubPage,
  onToggleSheet,
  onToggleBookmark,
  onOpenCardMaker,
}: ChromeProps) {
  const { isReducedMotion } = useAppMotion();
  const audioAvailable = isWebAudioSupported();

  return (
    <>
      {/* Persistent 2px ribbon progress line at the very top edge, driven by MotionValue scaleX */}
      <RibbonProgressBar
        motionScaleX={progressScaleX}
        currentPage={currentPage}
        totalPages={totalPages}
        fixedTop
      />

      {/* Top Chrome Bar */}
      <motion.header
        initial={false}
        animate={{
          opacity: visible ? 1 : 0,
          y: visible || isReducedMotion ? 0 : -8,
        }}
        transition={{
          duration: MOTION_TOKENS.dur.fast,
          ease: MOTION_TOKENS.ease.out,
        }}
        aria-hidden={!visible}
        className={cn(
          'fixed top-[2px] left-0 right-0 z-30 border-b border-line bg-surface/98 pt-safe',
          !visible && 'pointer-events-none select-none'
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 sm:px-5 h-[52px]">
          {/* Left: Back + miniature shared-element cover + single-line title + folio */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={onBack}
              aria-label="Back to library"
              className="btn-press inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink hover:bg-bg"
            >
              <Icon icon={ArrowLeft} />
            </button>

            <div className="w-6 shrink-0 hidden xs:block">
              <Cover
                docId={docId}
                title={title}
                pageCount={totalPages}
                hasCoverBlob={hasCoverBlob}
                layoutId={`cover-${docId}`}
                size="sm"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-sm font-medium text-ink truncate">
                {title}
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-ink-3">
                <span className="font-folio">
                  p. {currentPage} of {totalPages}
                </span>
                {extractingProgress && extractingProgress.extracted < extractingProgress.total ? (
                  <span className="font-folio text-accent">
                    · Extracting {extractingProgress.extracted}/{extractingProgress.total}
                  </span>
                ) : figureScanProgress && figureScanProgress.scanned < figureScanProgress.total ? (
                  <span className="font-folio text-ink-3">
                    · Finding figures {figureScanProgress.scanned} of {figureScanProgress.total}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Center/Right: Comfort / Paged / Original segmented switch */}
          <div className="flex items-center gap-2 shrink-0">
            <SegmentedControl<ReaderMode>
              ariaLabel="Reading mode"
              layoutGroupId="reader-mode-switch"
              pill
              value={mode}
              onChange={onModeChange}
              options={[
                { value: 'comfort', label: 'Comfort' },
                { value: 'paged', label: 'Paged' },
                { value: 'original', label: 'Original' },
              ]}
            />

            {/* Desktop toolbar hosts the 5 action buttons + Card Maker */}
            {isDesktop && (
              <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-line">
                <button
                  type="button"
                  tabIndex={visible ? 0 : -1}
                  onClick={() => onToggleSheet('settings')}
                  aria-label="Reading settings"
                  aria-pressed={activeSheet === 'settings'}
                  className={cn(
                    'btn-press inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)]',
                    activeSheet === 'settings' ? 'bg-ink text-bg' : 'text-ink hover:bg-bg'
                  )}
                >
                  <Icon icon={Type} />
                </button>

                <button
                  type="button"
                  tabIndex={visible ? 0 : -1}
                  onClick={() => onToggleSheet('notebook')}
                  aria-label="Notebook"
                  aria-pressed={activeSheet === 'notebook'}
                  className={cn(
                    'btn-press inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)]',
                    activeSheet === 'notebook' ? 'bg-ink text-bg' : 'text-ink hover:bg-bg'
                  )}
                >
                  <Icon icon={BookOpen} />
                </button>

                <button
                  type="button"
                  tabIndex={visible ? 0 : -1}
                  onClick={() => onToggleSheet('figures')}
                  aria-label={`Figures (${figureCount})`}
                  aria-pressed={activeSheet === 'figures'}
                  className={cn(
                    'btn-press relative inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)]',
                    activeSheet === 'figures' ? 'bg-ink text-bg' : 'text-ink hover:bg-bg'
                  )}
                >
                  <Icon icon={ImageIcon} />
                  {figureCount > 0 && (
                    <span className="font-folio absolute top-1 right-1 text-[9px] font-semibold">
                      {figureCount}
                    </span>
                  )}
                </button>

                {onOpenCardMaker && (
                  <button
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    onClick={onOpenCardMaker}
                    aria-label="Create flashcard"
                    title="Create flashcard"
                    className="btn-press inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)] text-ink hover:bg-bg"
                  >
                    <Icon icon={Layers} />
                  </button>
                )}

                {audioAvailable && (
                  <button
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    onClick={() => onToggleSheet('ambience')}
                    aria-label="Ambience"
                    aria-pressed={activeSheet === 'ambience'}
                    className={cn(
                      'btn-press relative inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)]',
                      activeSheet === 'ambience' ? 'bg-ink text-bg' : 'text-ink hover:bg-bg'
                    )}
                  >
                    <Icon icon={Headphones} />
                    {isAmbiencePlaying && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-accent"
                      />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  tabIndex={visible ? 0 : -1}
                  onClick={onToggleBookmark}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                  aria-pressed={isBookmarked}
                  className="btn-press inline-flex h-[40px] w-[40px] items-center justify-center rounded-[var(--radius-sm)] text-ink hover:bg-bg"
                >
                  <BookmarkRibbonIcon active={isBookmarked} />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Bottom Chrome Bar */}
      <motion.nav
        aria-label="Reader controls"
        initial={false}
        animate={{
          opacity: visible ? 1 : 0,
          y: visible || isReducedMotion ? 0 : 8,
        }}
        transition={{
          duration: MOTION_TOKENS.dur.fast,
          ease: MOTION_TOKENS.ease.out,
        }}
        aria-hidden={!visible}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface/98 pb-safe',
          !visible && 'pointer-events-none select-none'
        )}
      >
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-2">
          {/* Page scrubber slider with page bubble while dragging */}
          <div className="flex items-center gap-3">
            <span className="font-folio text-xs text-ink-3 w-8 text-right">
              {currentPage}
            </span>
            <FolioSlider
              value={currentPage}
              min={1}
              max={Math.max(1, totalPages)}
              step={1}
              ariaLabel="Page scrubber"
              ariaValueText={`Page ${currentPage} of ${totalPages}`}
              formatBubble={(v) => `Page ${v} of ${totalPages}`}
              onValueChange={onScrubPage}
              className="flex-1"
            />
            <span className="font-folio text-xs text-ink-3 w-8">
              {totalPages}
            </span>
          </div>

          {/* Five thumb-zone icon buttons on mobile/tablet: Aa, Notebook, Figures, Ambience, Bookmark */}
          <div className="mt-1 flex lg:hidden items-center justify-around border-t border-line/60 pt-1">
            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={() => onToggleSheet('settings')}
              aria-label="Reading settings"
              aria-pressed={activeSheet === 'settings'}
              className={cn(
                'btn-press flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs',
                activeSheet === 'settings' ? 'text-accent font-medium' : 'text-ink-2 hover:text-ink'
              )}
            >
              <Icon icon={Type} />
              <span className="text-[11px]">Aa</span>
            </button>

            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={() => onToggleSheet('notebook')}
              aria-label="Notebook"
              aria-pressed={activeSheet === 'notebook'}
              className={cn(
                'btn-press flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs',
                activeSheet === 'notebook' ? 'text-accent font-medium' : 'text-ink-2 hover:text-ink'
              )}
            >
              <Icon icon={BookOpen} />
              <span className="text-[11px]">Notebook</span>
            </button>

            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={() => onToggleSheet('figures')}
              aria-label={`Figures (${figureCount})`}
              aria-pressed={activeSheet === 'figures'}
              className={cn(
                'btn-press relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs',
                activeSheet === 'figures' ? 'text-accent font-medium' : 'text-ink-2 hover:text-ink'
              )}
            >
              <Icon icon={ImageIcon} />
              <span className="text-[11px]">
                Figures{figureCount > 0 ? ` (${figureCount})` : ''}
              </span>
            </button>

            {audioAvailable && (
              <button
                type="button"
                tabIndex={visible ? 0 : -1}
                onClick={() => onToggleSheet('ambience')}
                aria-label="Ambience"
                aria-pressed={activeSheet === 'ambience'}
                className={cn(
                  'btn-press relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs',
                  activeSheet === 'ambience' ? 'text-accent font-medium' : 'text-ink-2 hover:text-ink'
                )}
              >
                <Icon icon={Headphones} />
                <span className="text-[11px]">Ambience</span>
                {isAmbiencePlaying && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-3 h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-accent"
                  />
                )}
              </button>
            )}

            <button
              type="button"
              tabIndex={visible ? 0 : -1}
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
              aria-pressed={isBookmarked}
              className={cn(
                'btn-press flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs',
                isBookmarked ? 'text-accent font-medium' : 'text-ink-2 hover:text-ink'
              )}
            >
              <BookmarkRibbonIcon active={isBookmarked} />
              <span className="text-[11px]">Bookmark</span>
            </button>
          </div>
        </div>
      </motion.nav>
    </>
  );
}

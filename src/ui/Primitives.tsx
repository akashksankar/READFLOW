import React, { useState } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import { MOTION_TOKENS } from '../motion/tokens';
import { useAppMotion } from '../motion/useReducedMotion';
import { cn } from '../lib/cn';

/**
 * Buttons:
 * - primary = solid --ink with --bg text (not accent)
 * - accent = reserved for the single most important action per screen (Import)
 * - secondary = hairline border
 * - tertiary = text
 * - disabled = 45% opacity, no pointer events, and the reason is available as a tooltip or helper line.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'icon';
  disabledReason?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled,
      disabledReason,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'btn-press inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap shrink-0 rounded-[var(--radius-sm)] select-none min-h-[44px]';

    const variantClasses = {
      primary: 'bg-ink text-bg hover:opacity-90',
      accent: 'bg-accent text-on-accent hover:opacity-92',
      secondary: 'bg-transparent text-ink border border-line hover:bg-surface',
      tertiary: 'bg-transparent text-ink-2 hover:text-ink hover:bg-surface/60',
    }[variant];

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-[14px] min-h-[38px]',
      md: 'px-4 py-2.5 text-[14px] min-h-[44px]',
      icon: 'w-[44px] h-[44px] p-0',
    }[size];

    const buttonEl = (
      <button
        ref={ref}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          baseClasses,
          variantClasses,
          sizeClasses,
          disabled && 'opacity-45 pointer-events-none cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );

    if (disabled && disabledReason) {
      return (
        <div className="inline-flex flex-col items-start gap-1">
          {buttonEl}
          <span className="folio-label text-[11px]">{disabledReason}</span>
        </div>
      );
    }

    return buttonEl;
  }
);
Button.displayName = 'Button';

/**
 * Switch: Thumb moves on spring.tap; track color crossfades in --dur-fast.
 */
export function FolioSwitch({
  checked,
  onCheckedChange,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label?: string;
}) {
  const { isReducedMotion } = useAppMotion();
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        'btn-press relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] border border-line p-0.5 transition-colors duration-[var(--dur-fast)]',
        checked ? 'bg-ink border-ink' : 'bg-surface'
      )}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          layout={!isReducedMotion}
          transition={MOTION_TOKENS.spring.tap}
          className={cn(
            'block h-[20px] w-[20px] rounded-[var(--radius-pill)]',
            checked ? 'bg-bg ml-auto' : 'bg-ink-2 ml-0'
          )}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

/**
 * Slider: Thumb scales to 1.15 and shows a value bubble while pressed;
 * the bubble fades in --dur-instant.
 */
export function FolioSlider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onValueCommit,
  formatBubble,
  ariaLabel,
  ariaValueText,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (val: number) => void;
  onValueCommit?: (val: number) => void;
  formatBubble?: (val: number) => string;
  ariaLabel: string;
  ariaValueText?: string;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(vals) => {
        if (vals[0] !== undefined) onValueChange(vals[0]);
      }}
      onValueCommit={(vals) => {
        setPressed(false);
        if (vals[0] !== undefined && onValueCommit) onValueCommit(vals[0]);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
      aria-label={ariaLabel}
      className={cn(
        'relative flex w-full touch-none select-none items-center min-h-[44px] cursor-pointer',
        className
      )}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-[var(--radius-xs)] bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText ?? (formatBubble ? formatBubble(value) : String(value))}
        className={cn(
          'relative block h-[18px] w-[18px] rounded-[var(--radius-pill)] bg-accent border-2 border-bg shadow-[var(--shadow-1)] transition-transform duration-[var(--dur-instant)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          pressed && 'scale-[1.15]'
        )}
      >
        <AnimatePresence>
          {pressed && formatBubble && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: MOTION_TOKENS.dur.instant }}
              className="font-folio pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-xs)] border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink shadow-[var(--shadow-2)]"
            >
              {formatBubble(value)}
            </motion.span>
          )}
        </AnimatePresence>
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}

/**
 * Segmented Control with shared layoutId indicator
 * Radius: pill for mode switch indicator or 2px/6px for tabs
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutGroupId,
  pill = false,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  layoutGroupId: string;
  pill?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const { isReducedMotion, isLiteMode } = useAppMotion();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center border border-line bg-surface p-0.5',
        pill ? 'rounded-[var(--radius-pill)]' : 'rounded-[var(--radius-sm)]',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'btn-press relative z-10 inline-flex min-h-[36px] items-center justify-center gap-1.5 px-3 py-1 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-[var(--dur-fast)]',
              pill ? 'rounded-[var(--radius-pill)]' : 'rounded-[4px]',
              active ? 'text-bg' : 'text-ink-2 hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={!isReducedMotion && !isLiteMode ? layoutGroupId : undefined}
                transition={{
                  duration: MOTION_TOKENS.dur.base,
                  ease: MOTION_TOKENS.ease.out,
                }}
                className={cn(
                  'absolute inset-0 -z-10 bg-ink',
                  pill ? 'rounded-[var(--radius-pill)]' : 'rounded-[4px]'
                )}
              />
            )}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'font-folio text-[11px]',
                  active ? 'text-bg/80' : 'text-ink-3'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tooltip wrapper
 */
export function FolioTooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-[var(--shadow-2)]"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * DropdownMenu exports restyled to Folio tokens
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
}: {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[148px] overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface p-1 text-ink shadow-[var(--shadow-2)]',
          className
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive = false,
  className,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex min-h-[40px] cursor-pointer select-none items-center gap-2 rounded-[var(--radius-xs)] px-3 py-2 text-sm outline-none transition-colors duration-[var(--dur-instant)] focus:bg-bg',
        destructive ? 'text-state-error' : 'text-ink',
        className
      )}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

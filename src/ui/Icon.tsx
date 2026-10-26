import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  icon: LucideIcon;
  className?: string;
  label?: string;
}

/**
 * Single Lucide icon wrapper fixing size=20 and strokeWidth=1.5.
 * No filled icons except the active bookmark ribbon (handled by Ribbon.tsx).
 */
export function Icon({ icon: LucideComponent, className, label, ...rest }: IconProps) {
  return (
    <LucideComponent
      size={20}
      strokeWidth={1.5}
      fill="none"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('shrink-0 select-none', className)}
      {...rest}
    />
  );
}

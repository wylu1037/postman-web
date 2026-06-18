import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-stone-950 text-stone-50 hover:bg-stone-800',
        variant === 'secondary' &&
          'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100',
        variant === 'ghost' && 'text-stone-700 hover:bg-stone-100',
        className
      )}
      {...props}
    />
  );
}

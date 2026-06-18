import * as React from 'react';
import { cn } from '@/lib/utils';

export function Segmented({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid rounded-md border border-stone-300 bg-stone-100 p-1',
        className
      )}
      {...props}
    />
  );
}

export function SegmentButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'h-8 rounded px-3 text-sm transition active:translate-y-px',
        active
          ? 'bg-white text-stone-950 shadow-sm'
          : 'text-stone-600 hover:text-stone-950',
        className
      )}
      {...props}
    />
  );
}

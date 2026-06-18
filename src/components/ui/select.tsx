import * as React from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-amber-200', className)} {...props} />;
}

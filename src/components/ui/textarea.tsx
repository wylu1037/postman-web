import * as React from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-28 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-950 focus:ring-2 focus:ring-amber-200', className)} {...props} />;
}

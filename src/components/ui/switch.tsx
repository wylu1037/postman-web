'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-zinc-300/85 shadow-xs transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(24,24,27,0.22)] transition-transform duration-220 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=checked]:translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

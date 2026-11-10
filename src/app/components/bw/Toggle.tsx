import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/app/components/ui/utils';

/** Figma toggle: 52×32 track, lime with a black knob when on, white knob when off. */
export const Toggle: React.FC<React.ComponentProps<typeof SwitchPrimitive.Root>> = ({ className, ...props }) => (
  <SwitchPrimitive.Root
    className={cn(
      'inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors outline-none cursor-pointer',
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-foreground/15',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-6 rounded-full transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-black data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-white" />
  </SwitchPrimitive.Root>
);

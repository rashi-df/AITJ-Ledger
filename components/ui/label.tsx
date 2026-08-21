// Hand-rolled stand-in for the shadcn/ui Label primitive, matching
// components/ui/button.tsx's convention.
import * as React from 'react';

import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return (
    // slate-700 on white: 4.5:1+ contrast (NFR-4).
    <label
      className={cn('text-sm font-medium leading-none text-slate-700', className)}
      ref={ref}
      {...props}
    />
  );
});
Label.displayName = 'Label';

export { Label };

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StepFrameProps {
  /**
   * The person may read the setup and not change it (a role without `property.write`, or an access that reaches only some of the properties): every control of the step is
   * switched off at once. A `fieldset` does it for all of them, the buttons and the choices drawn by the design system included, so that no field of a step can be forgotten.
   */
  readOnly: boolean;
  testId: string;
  children: ReactNode;
}

/** The content of a step: a column of blocks, and read-only as a whole when the person may not change the setup. */
export function StepFrame({ readOnly, testId, children }: StepFrameProps) {
  return (
    <fieldset disabled={readOnly} data-testid={testId} data-readonly={readOnly ? 'true' : undefined} className={cn('m-0 flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6', readOnly && 'opacity-90')}>
      {children}
    </fieldset>
  );
}

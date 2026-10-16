import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** How a link looks inside a fact: the accent of the area, underlined, and a 44 px row to tap on a phone. */
export const FACT_LINK = 'inline-flex min-h-11 items-center break-all font-medium text-primary-text underline underline-offset-4 hover:no-underline md:min-h-0';

/**
 * Things a booking says, one per row, without a box around them: the name above its value on a phone, side by side from `sm`.
 * A long value (an e-mail, a name with no space) wraps instead of pushing the page sideways.
 */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('min-w-0 space-y-3', className)}>{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] sm:gap-x-6">
      <dt className="text-sm text-foreground/70 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

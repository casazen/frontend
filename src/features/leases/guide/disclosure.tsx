import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  /** The words on the line that opens it («Perché?», «Affina la stima»). */
  summary: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}

/**
 * A part that stays closed until the person asks for it: the line that opens it is at least 44 px high and says what is inside, the
 * keyboard opens it and a screen reader knows it is open. It is the `<details>` the calm screens use for «what is behind this»
 * (conventions §7bis, rule 7): the answer on top, the reasons and the details one click away.
 */
export function Disclosure({ summary, children, testId, className }: DisclosureProps) {
  return (
    <details className={cn('group min-w-0', className)} data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium text-primary-text outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        {summary}
      </summary>
      <div className="min-w-0 space-y-3 pb-2 pt-1 text-sm">{children}</div>
    </details>
  );
}

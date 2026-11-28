import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  summary: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}

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

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  'data-testid'?: string;
}

export function Disclosure({ title, count, defaultOpen = false, children, 'data-testid': testId }: DisclosureProps) {
  return (
    <details open={defaultOpen || undefined} className="group min-w-0 border-b border-border" data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 break-words text-lg font-semibold">
          {title}
          {count ? (
            <>
              {' '}
              <span className="text-sm font-semibold tabular-nums text-foreground/70">{count}</span>
            </>
          ) : null}
        </h2>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-foreground/70 transition-transform group-open:rotate-180" />
      </summary>
      <div className="min-w-0 space-y-3 pb-4">{children}</div>
    </details>
  );
}

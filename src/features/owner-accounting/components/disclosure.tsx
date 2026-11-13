import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureProps {
  /** The name of the part: the `h2` of this part of the page. */
  title: string;
  /** A number beside the title, for things that are waiting. Nothing when it is 0 or missing. */
  count?: number;
  /** Open when the page opens: only the part that holds the next step is. */
  defaultOpen?: boolean;
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * A part of a long page that opens on request: the title on one line with its arrow, and the content under it. A statement has many things to
 * read and one to do: what is read once (what changed, the payments, the linked invoices, the published file) waits here, one line each, so the
 * page keeps its one highlighted block and the lines. It is the native element: keyboard, screen reader and no script.
 */
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

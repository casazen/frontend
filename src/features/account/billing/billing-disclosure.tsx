import type { ReactNode, Ref } from 'react';
import { ChevronDown } from 'lucide-react';

interface BillingDisclosureProps {
  title: string;
  /** What the part holds right now, in a line: the person need not open it to know. */
  summary?: string;
  /** Lets the page open the part and bring it into view (the button of the plan block opens the plans). */
  detailsRef?: Ref<HTMLDetailsElement>;
  testId?: string;
  children: ReactNode;
}

/**
 * A part of the page that opens on request, for the details that do not need to be seen at first (the redesign conventions, §7bis,
 * rule 7): a title and a line under it, a hairline above, no box. It is the native `details`, so the keyboard, the screen readers and
 * "find in page" work with no code of ours.
 */
export function BillingDisclosure({ title, summary, detailsRef, testId, children }: BillingDisclosureProps) {
  return (
    <details ref={detailsRef} data-testid={testId} className="group min-w-0 scroll-mt-4 border-t border-border">
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h2 className="col-start-1 break-words text-lg font-semibold">{title}</h2>
        {summary ? <span className="col-start-1 row-start-2 break-words text-sm text-foreground/70">{summary}</span> : null}
        <ChevronDown
          aria-hidden="true"
          className="col-start-2 row-span-2 row-start-1 size-5 shrink-0 text-foreground/70 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="min-w-0 space-y-4 pb-6">{children}</div>
    </details>
  );
}

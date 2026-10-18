import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface FormSectionProps {
  title: string;
  /** What the section holds right now, in a line ("da 45 € a intervento"): the person need not open it to know. */
  summary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  testId?: string;
}

/**
 * A part of a long form that opens and closes (the page of a service has five): the title and, under it, what the part holds
 * now. It is the native `details`, so the keyboard, the screen readers and the "find in page" work with no code of ours, and
 * its fields stay in the form while it is shut. The page opens the parts that have a problem: a shut part must not hide one.
 * It has no box of its own: the page puts the parts in one box, divided by a line (no card inside a card, UI-16).
 */
export function FormSection({ title, summary, open, onOpenChange, children, testId }: FormSectionProps) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className="group min-w-0"
      data-testid={testId}
    >
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h2 className="col-start-1 break-words text-base font-semibold leading-snug">{title}</h2>
        {summary ? <span className="col-start-1 row-start-2 break-words text-sm text-foreground/70">{summary}</span> : null}
        <ChevronDown aria-hidden="true" className="col-start-2 row-span-2 row-start-1 size-5 shrink-0 text-foreground/70 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="min-w-0 space-y-5 px-4 pb-5 pt-2">{children}</div>
    </details>
  );
}

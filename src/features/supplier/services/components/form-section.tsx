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
 */
export function FormSection({ title, summary, open, onOpenChange, children, testId }: FormSectionProps) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className="group min-w-0 rounded-xl bg-card shadow-sm ring-1 ring-inset ring-border"
      data-testid={testId}
    >
      <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h2 className="col-start-1 break-words text-base font-semibold leading-snug">{title}</h2>
        {summary ? <span className="col-start-1 row-start-2 break-words text-sm text-foreground/70">{summary}</span> : null}
        <ChevronDown aria-hidden="true" className="col-start-2 row-span-2 row-start-1 size-5 shrink-0 text-foreground/70 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="min-w-0 space-y-5 border-t px-4 py-5">{children}</div>
    </details>
  );
}

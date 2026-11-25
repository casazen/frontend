import type { ReactNode } from 'react';

/** The frame of every state of a guest page of the check-in (the page of the link and the page of the door): the language switcher is always at the top, whatever the page shows below it. */
export function GuestPageFrame({ switcher, children, testId, embedded = false }: { switcher: ReactNode; children: ReactNode; testId?: string; embedded?: boolean }) {
  if (embedded) return <section className="min-w-0 space-y-5" data-testid={testId}>{children}</section>;
  return (
    <main className="min-h-dvh border-t-4 border-primary bg-muted/40 px-4 py-4 sm:py-8 [--color-muted-foreground:color-mix(in_oklab,var(--color-foreground)_72%,var(--color-background))]" data-testid={testId}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex min-w-0 justify-end">{switcher}</div>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </main>
  );
}

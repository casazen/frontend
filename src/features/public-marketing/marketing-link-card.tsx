import { useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** How the card feels: the question the person answers, the thing that was done, a link that does not work. */
export type MarketingCardTone = 'ask' | 'done' | 'broken';

const DISCS: Record<MarketingCardTone, string> = {
  ask: 'bg-primary text-primary-foreground',
  done: 'bg-success-soft text-success-foreground',
  broken: 'bg-muted text-foreground',
};

interface MarketingLinkCardProps {
  /** Where the page is now (`ask`, `done`, `expired`...): written in `data-state`; when it changes the title takes the focus. */
  state: string;
  tone: MarketingCardTone;
  icon: LucideIcon;
  title: string;
  description: string;
  testId: string;
  children?: ReactNode;
}

/**
 * The card of the pages the marketing e-mails link to (`/unsubscribe`, `/marketing/confirm`): one icon, one title, a line and what the person
 * can do, alone on the screen. The person comes from an e-mail and is not in the app: no menu, no link to an account, nothing that measures
 * the visit. Every state of a page is this card with other words, so there is always a title and never an empty screen.
 */
export function MarketingLinkCard({ state, tone, icon: Icon, title, description, testId, children }: MarketingLinkCardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(state);

  // The button the person pressed goes away with the state it belonged to: the title of the new state takes the focus, and is read, so
  // neither the keyboard nor the screen reader is left on nothing.
  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    heading.current?.focus();
  }, [state]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4" data-testid={testId} data-state={state}>
      <Card className="w-full min-w-0 max-w-md">
        <CardHeader className="text-center">
          <div className={cn('mx-auto mb-4 grid size-16 place-items-center rounded-full', DISCS[tone])}>
            <Icon aria-hidden="true" className="size-8" />
          </div>
          <h1 ref={heading} tabIndex={-1} className="break-words text-2xl font-semibold leading-tight tracking-tight outline-none">
            {title}
          </h1>
          <CardDescription className="break-words">{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent className="min-w-0 space-y-4">{children}</CardContent> : null}
      </Card>
    </main>
  );
}

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton } from './calm-action';

type PlainSectionAction =
  | { actionLabel?: undefined; href?: undefined; state?: undefined; onAction?: undefined }
  | { actionLabel: string; href: string; state?: unknown; onAction?: undefined }
  | { actionLabel: string; onAction: () => void; href?: undefined; state?: undefined };

export type PlainSectionProps = Omit<React.HTMLAttributes<HTMLElement>, 'title'> &
  PlainSectionAction & {
    /** The name of the section: the `h2` of this part of the page. */
    title: string;
    /** A number beside the title, for things that are waiting ("Da fare 3"). Nothing when it is 0 or missing. */
    count?: number;
  };

/**
 * A part of a page without a box around it: a title, one action for the whole section if it has one ("Tutti i contratti"),
 * and the content. No border, no background, no shadow: a card inside a card is the first thing the calm screens took away
 * (`CONVENZIONI.md` §7bis, rule 4). The section is a `region` named by its title.
 *
 *     <PlainSection title="Scadenze e rinnovi" actionLabel="Tutte le scadenze" href="/app/long-rent/deadlines">
 *       <DayList items={...} />
 *     </PlainSection>
 */
export function PlainSection({ title, count, actionLabel, href, state, onAction, children, className, ...props }: PlainSectionProps) {
  const titleId = React.useId();
  const action = actionLabel ? (href !== undefined ? { label: actionLabel, href, state } : { label: actionLabel, onClick: onAction as () => void }) : null;

  return (
    <section aria-labelledby={titleId} className={cn('min-w-0 space-y-2', className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="flex min-w-0 items-baseline gap-2 break-words text-lg font-semibold">
          {title}
          {count ? (
            <>
              {' '}
              <span className="text-sm font-semibold tabular-nums text-foreground/70">{count}</span>
            </>
          ) : null}
        </h2>
        {action ? (
          <CalmActionButton
            action={action}
            variant="ghost"
            size="sm"
            iconRight={<ArrowRight />}
            className="px-2 text-primary-text hover:text-primary-text"
          />
        ) : null}
      </div>
      {children}
    </section>
  );
}

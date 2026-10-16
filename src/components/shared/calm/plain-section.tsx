import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import { QUIET_ACTION } from './calm-styles';

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
    /** Tells apart two section actions that say the same ("Vedi tutto"); it must start with the label ("Vedi tutto: attività"). */
    actionAriaLabel?: string;
    actionTestId?: string;
  };

/**
 * A part of a page without a box around it: a title, one action for the whole section if it has one ("Tutti i contratti"),
 * and the content. No border, no background, no shadow: a card inside a card is the first thing the calm screens took away
 * (the redesign conventions, §7bis, rule 4). The section is a `region` named by its title.
 *
 *     <PlainSection title="Scadenze e rinnovi" actionLabel="Tutte le scadenze" href="/app/long-rent/deadlines">
 *       <DayList items={...} />
 *     </PlainSection>
 */
export function PlainSection({
  title,
  count,
  actionLabel,
  actionAriaLabel,
  actionTestId,
  href,
  state,
  onAction,
  children,
  className,
  ...props
}: PlainSectionProps) {
  const titleId = React.useId();
  const action: CalmAction | null =
    actionLabel === undefined
      ? null
      : href !== undefined
        ? { label: actionLabel, href, state, ariaLabel: actionAriaLabel, testId: actionTestId }
        : onAction !== undefined
          ? { label: actionLabel, onClick: onAction, ariaLabel: actionAriaLabel, testId: actionTestId }
          : null;

  return (
    <section {...props} aria-labelledby={titleId} className={cn('min-w-0 space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* Not a flex box: the words of the title (and of a long name in it) wrap as text does, instead of keeping their width. */}
        <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">
          {title}
          {count ? (
            <>
              {' '}
              <span className="text-sm font-semibold tabular-nums text-foreground/70">{count}</span>
            </>
          ) : null}
        </h2>
        {action ? <CalmActionButton action={action} variant="ghost" size="sm" iconRight={<ArrowRight />} className={QUIET_ACTION} /> : null}
      </div>
      {children}
    </section>
  );
}

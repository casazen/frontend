import * as React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// The title and the line under it are one control, as wide as the column and at least 44 px high (as in the rows of the Home).
const OPEN =
  'group/open flex min-h-11 min-w-0 flex-col justify-center rounded-md text-left outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways (the calm blocks' rule). */
export const ROW_BUTTON = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ComplianceRowProps {
  /** The icon of the kind of row; a row without one has no column for it. */
  icon?: LucideIcon;
  title: string;
  /** Where the title goes; without it the title is only text. */
  to?: string;
  /** Where it happens or whom it is about, under the title. */
  sub?: string;
  /** What it still lacks, in words. */
  detail?: string;
  /** The state, as a `StatusBadge`. */
  badge?: React.ReactNode;
  /** How pressing it is (a `NoteLine`): its words and icon say it, not only its color. */
  note?: React.ReactNode;
  /** The one button of the row (a link or the trigger of a dialog), built by the page. */
  action?: React.ReactNode;
  testId?: string;
  /** The `data-testid` of the title: of the link when there is one, of the plain text otherwise. */
  titleTestId?: string;
}

/**
 * A row of the pages of the adempimenti (cockpit, CIN, Alloggiati Web): what it is about, where it is and what it lacks, one
 * state, and the one button that does what it asks. On a phone it is a single column with the button under the text.
 */
export function ComplianceRow({ icon: Icon, title, to, sub, detail, badge, note, action, testId, titleTestId }: ComplianceRowProps) {
  const text = (
    <>
      <span className={cn('block break-words font-semibold', to && 'group-hover/open:underline')}>{title}</span>
      {sub ? <span className="block break-words text-sm text-foreground/70">{sub}</span> : null}
    </>
  );

  return (
    <li
      data-testid={testId}
      className={cn(
        'grid gap-x-3 gap-y-1 py-3 sm:items-center',
        Icon ? 'grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4',
      )}
    >
      {Icon ? (
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-muted text-foreground/70">
          <Icon className="size-[18px]" />
        </span>
      ) : null}

      <div className="min-w-0 space-y-0.5">
        {to ? (
          <Link to={to} className={OPEN} data-testid={titleTestId}>
            {text}
          </Link>
        ) : (
          <div className="min-w-0" data-testid={titleTestId}>
            {text}
          </div>
        )}
        {detail ? <p className="break-words text-sm text-foreground/70">{detail}</p> : null}
        {badge || note ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            {badge}
            {note}
          </div>
        ) : null}
      </div>

      {action ? (
        <div className={cn('flex flex-wrap items-center gap-2 pt-1 sm:justify-end sm:pt-0', Icon ? 'col-start-2 sm:col-start-3' : 'col-start-1 sm:col-start-2')}>{action}</div>
      ) : null}
    </li>
  );
}

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime, romeDateOf, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { QUIET_ACTION, TOUCH_TARGET } from './calm-styles';

export interface ActivityItem {
  /** Stable, for React. */
  id: string;
  /** When it happened, an ISO instant with its offset (`2026-10-16T09:30:00Z`): it orders the list and is the `datetime` of the entry. */
  at: string;
  /** The moment as the person reads it ("ieri alle 18:30"). Default: day, month and time in Europe/Rome, in the language of the app (with the year when it is not this year). */
  when?: string;
  /** What happened, as a short sentence. */
  text: string;
  /** Who did it: "Tu", "Elisa", "CasaZen". */
  actor?: string;
}

export interface ActivityListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: readonly ActivityItem[];
  /** `newest` (default) puts the latest first, as a feed does; `oldest` reads as a story, from the start. */
  order?: 'newest' | 'oldest';
  /** Show only `limit` entries, and a button that says `label` ("Mostra altro") to show the rest. */
  more?: { limit: number; label: string };
  /** The name of the list for a screen reader ("Attività recente"). Not needed when a heading above it names it. */
  label?: string;
}

const THIS_YEAR = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } as const;
const OTHER_YEAR = { ...THIS_YEAR, year: 'numeric' } as const;

function instantOf(at: string): number | null {
  const time = Date.parse(at);
  return Number.isNaN(time) ? null : time;
}

/**
 * What happened, in order: a date, a sentence and who did it, on a thin line. For the recent activity of an account and the
 * history of a contract. Entries are put in order here, so the page does not have to; one whose date cannot be read goes last.
 * With `more`, only the first entries are shown and the button shows the rest: the focus then goes to the first entry that
 * appeared, so a screen reader goes on from where the list went on. The list remembers that it was opened: when it is used for
 * another subject (the history of another contract, on the same page) give it a `key` that changes with the subject.
 * The extra props (`className`, `data-testid`, `id`) go to the box around the list and its button, `label` to the list.
 * It renders nothing when it has no entries.
 */
export function ActivityList({ items, order = 'newest', more, label, className, ...props }: ActivityListProps) {
  const { i18n } = useTranslation();
  const listId = React.useId();
  const [expanded, setExpanded] = React.useState(false);
  const firstRevealed = React.useRef<HTMLLIElement>(null);

  // Put in order only when the entries or the order change, not when the list is opened.
  const sorted = React.useMemo(() => {
    const dated = items.map((item) => ({ item, instant: instantOf(item.at) }));
    dated.sort((a, b) => {
      if (a.instant === b.instant) return 0;
      if (a.instant === null) return 1;
      if (b.instant === null) return -1;
      return order === 'newest' ? b.instant - a.instant : a.instant - b.instant;
    });
    return dated.map(({ item }) => item);
  }, [items, order]);

  React.useEffect(() => {
    if (expanded) firstRevealed.current?.focus();
  }, [expanded]);

  if (items.length === 0) return null;

  const shown = sorted.slice(0, more && !expanded ? Math.max(more.limit, 0) : sorted.length);
  // The entry that the button brought in first: the focus goes there when the button is gone.
  const revealedFrom = more && expanded ? Math.max(more.limit, 0) : -1;
  const thisYear = todayInRome().slice(0, 4);

  return (
    <div {...props} className={cn('min-w-0 space-y-2', className)}>
      <ol id={listId} role="list" aria-label={label} className="ms-1.5 space-y-4 border-s border-border">
        {shown.map((item, index) => {
          // A date that cannot be read is left out, rather than shown as an empty element of time.
          const readable = instantOf(item.at) !== null;
          const when = item.when || (readable ? formatRomeDateTime(item.at, i18n.language, romeDateOf(item.at).startsWith(thisYear) ? THIS_YEAR : OTHER_YEAR) : '');
          return (
            <li key={item.id} ref={index === revealedFrom ? firstRevealed : undefined} tabIndex={index === revealedFrom ? -1 : undefined} className="relative break-words ps-5">
              <span aria-hidden="true" className="absolute -start-[0.34375rem] top-1.5 size-2.5 rounded-full bg-foreground/30 ring-4 ring-background forced-colors:bg-[CanvasText]" />
              <p className="text-sm">{item.text}</p>
              {item.actor || when ? (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-foreground/70">
                  {item.actor ? <span className="font-medium">{item.actor}</span> : null}
                  {item.actor && when ? <span aria-hidden="true">·</span> : null}
                  {when ? readable ? <time dateTime={item.at}>{when}</time> : <span>{when}</span> : null}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {more && shown.length < sorted.length ? (
        <Button type="button" variant="ghost" size="sm" className={cn(TOUCH_TARGET, QUIET_ACTION)} aria-expanded={false} aria-controls={listId} onClick={() => setExpanded(true)}>
          {more.label}
        </Button>
      ) : null}
    </div>
  );
}

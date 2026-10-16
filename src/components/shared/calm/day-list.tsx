import * as React from 'react';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { CalmActionButton, CalmLink, type CalmAction } from './calm-action';
import { TONE_STYLES, type CalmTone } from './calm-tone';

type DayListItemOpen =
  | { href?: undefined; state?: undefined; onOpen?: undefined }
  | { href: string; state?: unknown; onOpen?: undefined }
  | { onOpen: () => void; href?: undefined; state?: undefined };

export type DayListItem = DayListItemOpen & {
  /** Stable, for React: the id of the thing the row is about. */
  id: string;
  /** The first column, as the person reads it: a time ("09:30") or a date ("12 ott"). Short: it has 3.5 rem. */
  date: string;
  /** The same moment for machines (`<time datetime>`): `2026-10-16` or `2026-10-16T09:30`. */
  dateTime?: string;
  title: string;
  /** One line under the title: who, where, how much ("Elisa Neri · Via Roma 12"). */
  subtitle?: string;
  /** A short note at the end of the row: "tra 5 giorni", "in ritardo". */
  meta?: string;
  /** Colors the note and puts the icon of the tone before it. Without it the note is plain. */
  tone?: CalmTone;
  /** The direct action of the row, one button ("Conferma", "Apri"). */
  action?: CalmAction;
};

export interface DayListProps extends React.HTMLAttributes<HTMLUListElement> {
  items: readonly DayListItem[];
}

const DATE = 'pt-0.5 text-sm font-semibold tabular-nums text-foreground/70';
const TITLE = 'block break-words text-left font-semibold';
// The title is the link (or the button) of the row and its hit area is the whole row: a `::after` that fills the `li`. The
// action sits above it (`z-10`) and is the only thing there that takes a click, so a click anywhere else on the row (the note, the
// space around the action) still reaches the title.
const TITLE_LINK = cn(
  TITLE,
  'outline-none after:absolute after:inset-0 after:content-[""] hover:underline',
  'focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring',
);

function DayRow({ item }: { item: DayListItem }) {
  const style = TONE_STYLES[item.tone ?? 'neutral'];
  const ToneIcon = item.tone && item.tone !== 'neutral' ? style.Icon : null;

  const title =
    item.href !== undefined ? (
      <CalmLink href={item.href} state={item.state} className={TITLE_LINK}>
        {item.title}
      </CalmLink>
    ) : item.onOpen ? (
      <button type="button" onClick={item.onOpen} className={TITLE_LINK}>
        {item.title}
      </button>
    ) : (
      <span className={TITLE}>{item.title}</span>
    );

  return (
    <li
      data-tone={item.tone}
      className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4"
    >
      {item.dateTime ? (
        <time dateTime={item.dateTime} className={DATE}>
          {item.date}
        </time>
      ) : (
        <span className={DATE}>{item.date}</span>
      )}
      <div className="min-w-0">
        {title}
        {item.subtitle ? <span className="block break-words text-sm text-foreground/70">{item.subtitle}</span> : null}
      </div>
      {item.meta || item.action ? (
        <div className="pointer-events-none relative z-10 col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-start-3 sm:justify-end">
          {item.meta ? (
            <span className={cn('inline-flex items-center gap-1.5 text-sm', ToneIcon ? cn('font-medium', style.accent) : 'text-foreground/70')}>
              {ToneIcon ? <ToneIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
              {item.meta}
            </span>
          ) : null}
          {item.action ? <CalmActionButton action={item.action} variant="outline" size="sm" className="pointer-events-auto" /> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Rows with a date, a title, a line under it and, if it helps, a note and a direct action: today's list, the deadlines, the
 * recent activity. The title opens the thing (`href` for a page, `onOpen` for a drawer) and the whole row is its target; the
 * action is a separate button for what is done without opening it. Without either the row is only to read.
 * It renders nothing when it has no rows: what to say then (a sentence, an empty state) is the page's to decide.
 *
 * The caller puts the rows in the order to read them, and writes the dates as people read them.
 */
export function DayList({ items, className, ...props }: DayListProps) {
  if (items.length === 0) return null;
  return (
    <ul role="list" className={cn('divide-y divide-border border-y border-border', className)} {...props}>
      {items.map((item) => (
        <DayRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

export type TodayListItem = DayListItem & {
  /** The calendar day of the row (`YYYY-MM-DD`): where it goes among today, tomorrow and later. */
  day: string;
};

export interface TodayListProps extends React.HTMLAttributes<HTMLDivElement> {
  items: readonly TodayListItem[];
  /** The names of the three groups, already translated. They are the caller's: each area says it in its own words. */
  labels: { today: string; tomorrow: string; later: string };
  /** The day taken as today (`YYYY-MM-DD`). Default: today in Europe/Rome. */
  today?: string;
}

type TodayGroupKey = keyof TodayListProps['labels'];

function TodayGroup({ label, items }: { label: string; items: readonly DayListItem[] }) {
  const headingId = React.useId();
  return (
    <div className="space-y-1">
      <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
        {label}
      </h3>
      <DayList items={items} aria-labelledby={headingId} />
    </div>
  );
}

/**
 * A `DayList` in three groups, "oggi", "domani" and "più avanti". A row of a day that is already past is still to be done, so
 * it stays with today's. Empty groups are not shown. Use it inside a `PlainSection`: the group names are `h3`.
 */
export function TodayList({ items, labels, today, className, ...props }: TodayListProps) {
  const first = today ?? todayInRome();
  const second = addDays(first, 1);
  const groupOf = (day: string): TodayGroupKey => (day <= first ? 'today' : day === second ? 'tomorrow' : 'later');

  const groups = (['today', 'tomorrow', 'later'] as const)
    .map((key) => ({ key, items: items.filter((item) => groupOf(item.day) === key) }))
    .filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className={cn('space-y-5', className)} {...props}>
      {groups.map((group) => (
        <TodayGroup key={group.key} label={labels[group.key]} items={group.items} />
      ))}
    </div>
  );
}

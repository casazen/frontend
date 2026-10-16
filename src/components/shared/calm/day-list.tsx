import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addDays, formatStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import { TONE_STYLES, type CalmTone } from './calm-tone';

type DayListItemOpen =
  | { href?: undefined; state?: undefined; onOpen?: undefined }
  | { href: string; state?: unknown; onOpen?: undefined }
  | { onOpen: () => void; href?: undefined; state?: undefined };

export type DayListItem = DayListItemOpen & {
  /** Stable, for React: the id of the thing the row is about. */
  id: string;
  /**
   * The calendar day of the row (`YYYY-MM-DD`; written with a time it is read as the day it starts with, as the date fields of
   * the API are: for an instant use `romeDateOf`). It is the machine value of the date (`<time datetime>`) and, when `date` is
   * not given, the text of the date too ("12 ott"), in the language of the app. A `TodayList` needs it to group the rows.
   */
  day?: string;
  /** The first column as the person reads it: a time ("09:30") or a short text. Default: the `day`, short ("12 ott"). */
  date?: string;
  /** The machine value of `date` when it has a time ("2026-10-16T09:30"). Default: the `day`. */
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

export interface DayListProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'children'> {
  items: readonly DayListItem[];
}

const DATE = 'min-w-0 break-words pt-0.5 text-sm font-semibold tabular-nums text-foreground/70';
// The title and the line under it are one control: a link or a button as wide as the column and at least 44 px high. It is not
// stretched over the rest of the row: on a phone the redesign makes every link and button `position: relative` and gives the
// buttons a hit area of their own (`tokens.css`), and a stretched `::after` would be anchored to the link itself.
const OPEN =
  'group/open flex min-h-11 min-w-0 flex-col justify-center rounded-md text-left outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function DayRow({ item }: { item: DayListItem }) {
  const { i18n } = useTranslation();
  const style = TONE_STYLES[item.tone ?? 'neutral'];
  const ToneIcon = item.tone && item.tone !== 'neutral' ? style.Icon : null;
  const { onOpen } = item;
  const opens = item.href !== undefined || onOpen !== undefined;

  const day = parseStayDate(item.day);
  const dateText = item.date ?? (day ? formatStayDate(day, i18n.language, { day: 'numeric', month: 'short' }) : '');
  const dateTime = item.dateTime ?? (day || undefined);

  const text = (
    <>
      <span className={cn('block break-words font-semibold', opens && 'group-hover/open:underline')}>{item.title}</span>
      {item.subtitle ? <span className="block break-words text-sm text-foreground/70">{item.subtitle}</span> : null}
    </>
  );

  return (
    <li
      data-tone={item.tone}
      className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4"
    >
      {dateTime && dateText ? (
        <time dateTime={dateTime} className={DATE}>
          {dateText}
        </time>
      ) : (
        <span className={DATE}>{dateText}</span>
      )}

      {item.href !== undefined ? (
        <Link to={item.href} state={item.state} className={OPEN}>
          {text}
        </Link>
      ) : onOpen ? (
        <button type="button" onClick={() => onOpen()} className={OPEN}>
          {text}
        </button>
      ) : (
        <div className="min-w-0">{text}</div>
      )}

      {item.meta || item.action ? (
        <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-start-3 sm:justify-end">
          {item.meta ? (
            <span className={cn('inline-flex items-center gap-1.5 text-sm', ToneIcon ? cn('font-medium', style.accent) : 'text-foreground/70')}>
              {ToneIcon ? <ToneIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
              {item.meta}
            </span>
          ) : null}
          {item.action ? <CalmActionButton action={item.action} variant="outline" size="sm" /> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Rows with a date, a title, a line under it and, if it helps, a note and a direct action: today's list, the deadlines, the
 * recent activity. The title and the line under it open the thing (`href` for a page, `onOpen` for a drawer); the action is a
 * separate button for what is done without opening it. Without either the row is only to read.
 * It renders nothing when it has no rows: what to say then (a sentence, an empty state) is the page's to decide.
 *
 * The caller puts the rows in the order to read them.
 */
export function DayList({ items, className, ...props }: DayListProps) {
  if (items.length === 0) return null;
  return (
    <ul {...props} role="list" className={cn('divide-y divide-border border-y border-border', className)}>
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

export interface TodayListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
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
 * it stays with today's; a row whose day cannot be read goes last, never with today's. Empty groups are not shown. Use it
 * inside a `PlainSection`: the group names are `h3`.
 */
export function TodayList({ items, labels, today, className, ...props }: TodayListProps) {
  const first = parseStayDate(today) || todayInRome();
  const second = addDays(first, 1);
  const groupOf = (item: TodayListItem): TodayGroupKey => {
    const day = parseStayDate(item.day);
    if (!day) return 'later';
    return day <= first ? 'today' : day === second ? 'tomorrow' : 'later';
  };

  const groups = (['today', 'tomorrow', 'later'] as const)
    .map((key) => ({ key, items: items.filter((item) => groupOf(item) === key) }))
    .filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <div {...props} className={cn('space-y-5', className)}>
      {groups.map((group) => (
        <TodayGroup key={group.key} label={labels[group.key]} items={group.items} />
      ))}
    </div>
  );
}

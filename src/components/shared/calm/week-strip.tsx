import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';

export interface WeekStripDay {
  /** The calendar day, `YYYY-MM-DD`. The caller chooses the seven days (a week from Monday, the next seven days...). */
  date: string;
  /** How many things there are that day. A day with some gets a dot; a screen reader is told the number. */
  count?: number;
}

export interface WeekStripProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange' | 'children'> {
  days: readonly WeekStripDay[];
  /** The day that is chosen, when the page decides it. Without it the strip remembers the choice itself. */
  value?: string;
  /** The day that is chosen until the person chooses one (default: today, if it is among the days). */
  defaultValue?: string;
  onValueChange?: (date: string) => void;
  /** The day taken as today (`YYYY-MM-DD`), marked on the strip. Default: today in Europe/Rome. */
  today?: string;
  /** The name of the group for a screen reader. Default: "Giorni della settimana". */
  label?: string;
}

const SHORT = { weekday: 'short' } as const;
const NUMBER = { day: 'numeric' } as const;
const FULL = { weekday: 'long', day: 'numeric', month: 'long' } as const;

/**
 * The days of a week in a row, to see which ones have something and to choose the one to look at. Each day is a radio button
 * (one is chosen, it is the one in the Tab order), and the arrow keys move the choice, as they do in any group of radio
 * buttons: Right and Down go on, Left and Up go back, Home and End go to the first and the last, and from the last it goes
 * round. A day with things in it has a dot, the day of today has a ring, the chosen day is filled: none of these is a color
 * alone (in forced-colors mode they take the colors of the system). Each day is read in full to a screen reader ("lunedì 12
 * ottobre, oggi, 3 elementi").
 *
 * It only chooses a day. What that shows, and moving to another week, is for the page.
 */
export function WeekStrip({ days, value, defaultValue, onValueChange, today, label, className, onKeyDown, ...props }: WeekStripProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const todayDate = parseStayDate(today) || todayInRome();
  // What the person chose in this strip. The choice that counts is worked out below, so that a new set of days (the next week)
  // finds its own default instead of a day that is no longer there.
  const [chosen, setChosen] = React.useState<string | undefined>(undefined);

  // What the strip says about each day is worked out when the days, the language or today change, not at every choice.
  const cells = React.useMemo(
    () =>
      days.map((day) => {
        const stay = parseStayDate(day.date);
        const count = day.count ?? 0;
        const isToday = stay !== '' && stay === todayDate;
        const name = [
          stay ? formatStayDate(stay, locale, FULL) : day.date,
          isToday ? t('calm.weekStrip.today') : '',
          count > 0 ? t('calm.weekStrip.items', { count }) : '',
        ]
          .filter(Boolean)
          .join(', ');
        return {
          date: day.date,
          count,
          isToday,
          name,
          short: stay ? formatStayDate(stay, locale, SHORT) : '',
          number: stay ? formatStayDate(stay, locale, NUMBER) : '',
        };
      }),
    [days, locale, todayDate, t],
  );

  const unreadable = days.filter((day) => !parseStayDate(day.date)).length;
  React.useEffect(() => {
    if (import.meta.env.DEV && unreadable > 0) {
      console.warn(`WeekStrip: ${unreadable} of the days are not a calendar day written YYYY-MM-DD, and are shown without a name.`);
    }
  }, [unreadable]);

  if (days.length === 0) return null;

  const known = (date: string | undefined): date is string => date !== undefined && days.some((day) => day.date === date);
  const fallback = [defaultValue, cells.find((cell) => cell.isToday)?.date].find(known);
  const selected = value ?? (known(chosen) ? chosen : fallback);
  // The Tab order enters on the chosen day, or on the first one when none of the days is chosen.
  const tabStop = known(selected) ? selected : days[0].date;

  const choose = (date: string) => {
    if (value === undefined) setChosen(date);
    onValueChange?.(date);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    // Alt, Ctrl and Cmd with an arrow, Home or End are the browser's (Back, Forward, the start and the end of the page).
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const from = (event.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    const index = from ? radios.indexOf(from) : -1;
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % radios.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + radios.length) % radios.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = radios.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    radios[next].focus();
    choose(days[next].date);
  };

  return (
    <div
      {...props}
      role="radiogroup"
      aria-label={label ?? t('calm.weekStrip.label')}
      onKeyDown={handleKeyDown}
      className={cn('grid grid-cols-7 gap-0.5', className)}
    >
      {cells.map((cell) => {
        const isSelected = cell.date === selected;
        return (
          <button
            key={cell.date}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={cell.name}
            tabIndex={cell.date === tabStop ? 0 : -1}
            data-date={cell.date}
            data-today={cell.isToday ? 'true' : undefined}
            onClick={() => choose(cell.date)}
            className={cn(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors motion-reduce:transition-none',
              'ring-offset-background focus-visible:z-10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected ? 'bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]' : 'text-foreground hover:bg-muted',
            )}
          >
            <span aria-hidden="true" className={cn('text-xs', !isSelected && 'text-foreground/70')}>
              {cell.short}
            </span>
            <span
              aria-hidden="true"
              className={cn('grid size-7 place-items-center rounded-full text-base font-semibold tabular-nums', cell.isToday && 'ring-1 ring-current forced-colors:outline forced-colors:outline-1')}
            >
              {cell.number}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                cell.count > 0 ? (isSelected ? 'bg-primary-foreground forced-colors:bg-[HighlightText]' : 'bg-primary forced-colors:bg-[CanvasText]') : 'bg-transparent',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

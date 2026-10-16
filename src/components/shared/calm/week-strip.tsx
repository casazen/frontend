import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';

export interface WeekStripDay {
  /** The calendar day, `YYYY-MM-DD`. The caller chooses the seven days (a week from Monday, the next seven days...). */
  date: string;
  /** How many things there are that day. A day with some gets a dot; a screen reader is told the number. */
  count?: number;
}

export interface WeekStripProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  days: readonly WeekStripDay[];
  /** The day that is chosen, when the page decides it. Without it the strip remembers the choice itself. */
  value?: string;
  /** The day chosen at the start (default: today, if it is among the days). */
  defaultValue?: string;
  onValueChange?: (date: string) => void;
  /** The day taken as today (`YYYY-MM-DD`), marked on the strip. Default: today in Europe/Rome. */
  today?: string;
  /** The name of the group for a screen reader. Default: "Giorni della settimana". */
  label?: string;
}

/**
 * The days of a week in a row, to see which ones have something and to choose the one to look at. Each day is a radio button
 * (one is chosen, it is the one in the Tab order), and the arrow keys move the choice, as they do in any group of radio
 * buttons: Right and Down go on, Left and Up go back, Home and End go to the first and the last, and from the last it goes
 * round. A day with things in it has a dot, the day of today has a ring, the chosen day is filled: none of these is a color
 * alone. Each day is read in full to a screen reader ("lunedì 12 ottobre, oggi, 3 elementi").
 *
 * It only chooses a day. What that shows, and moving to another week, is for the page.
 */
export function WeekStrip({ days, value, defaultValue, onValueChange, today, label, className, ...props }: WeekStripProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const todayDate = today ?? todayInRome();
  const [chosen, setChosen] = React.useState(() => defaultValue ?? (days.some((day) => day.date === todayDate) ? todayDate : undefined));
  const buttons = React.useRef(new Map<string, HTMLButtonElement>());

  if (days.length === 0) return null;

  const selected = value ?? chosen;
  // The Tab order enters on the chosen day, or on the first one when none of the days is chosen.
  const tabStop = days.some((day) => day.date === selected) ? selected : days[0].date;

  const choose = (date: string) => {
    if (value === undefined) setChosen(date);
    onValueChange?.(date);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const from = (event.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
    const index = days.findIndex((day) => day.date === from);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % days.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + days.length) % days.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = days.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const date = days[next].date;
    buttons.current.get(date)?.focus();
    choose(date);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label ?? t('calm.weekStrip.label')}
      onKeyDown={handleKeyDown}
      className={cn('grid grid-cols-7 gap-0.5', className)}
      {...props}
    >
      {days.map((day) => {
        const isSelected = day.date === selected;
        const isToday = day.date === todayDate;
        const count = day.count ?? 0;
        const name = [
          formatStayDate(day.date, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
          isToday ? t('calm.weekStrip.today') : '',
          count > 0 ? t('calm.weekStrip.items', { count }) : '',
        ]
          .filter(Boolean)
          .join(', ');

        return (
          <button
            key={day.date}
            ref={(node) => {
              if (node) buttons.current.set(day.date, node);
              else buttons.current.delete(day.date);
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={name}
            tabIndex={day.date === tabStop ? 0 : -1}
            data-date={day.date}
            data-today={isToday ? 'true' : undefined}
            onClick={() => choose(day.date)}
            className={cn(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors motion-reduce:transition-none',
              'ring-offset-background focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            <span aria-hidden="true" className={cn('text-xs', !isSelected && 'text-foreground/70')}>
              {formatStayDate(day.date, locale, { weekday: 'short' })}
            </span>
            <span aria-hidden="true" className={cn('grid size-7 place-items-center rounded-full text-base font-semibold tabular-nums', isToday && 'ring-1 ring-current')}>
              {formatStayDate(day.date, locale, { day: 'numeric' })}
            </span>
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', count > 0 ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

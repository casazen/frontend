import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { calendarDayOf } from './calm-day';

export interface WeekStripDay {
  date: string;
  count?: number;
}

export interface WeekStripProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange' | 'children'> {
  days: readonly WeekStripDay[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (date: string) => void;
  today?: string;
  label?: string;
}

const idOf = (date: string) => calendarDayOf(date) || date;

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
  const todayDate = calendarDayOf(today) || todayInRome();
  // What the person chose in this strip. The choice that counts is worked out below, so that a new set of days (the next week)
  // finds its own default instead of a day that is no longer there.
  const [chosen, setChosen] = React.useState<string | undefined>(undefined);

  const cells = React.useMemo(
    () =>
      days.map((day) => {
        const stay = calendarDayOf(day.date);
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
          id: stay || day.date,
          count,
          isToday,
          name,
          short: stay ? formatStayDate(stay, locale, SHORT) : '',
          number: stay ? formatStayDate(stay, locale, NUMBER) : '',
        };
      }),
    [days, locale, todayDate, t],
  );

  const unreadable = days.filter((day) => !calendarDayOf(day.date)).length;
  React.useEffect(() => {
    if (import.meta.env.DEV && unreadable > 0) {
      console.warn(`WeekStrip: ${unreadable} of the days are not a calendar day written YYYY-MM-DD, and are shown without a name.`);
    }
  }, [unreadable]);

  if (days.length === 0) return null;

  const known = (id: string | undefined): id is string => id !== undefined && cells.some((cell) => cell.id === id);
  const fallback = [defaultValue === undefined ? undefined : idOf(defaultValue), cells.find((cell) => cell.isToday)?.id].find(known);
  const selected = value === undefined ? (known(chosen) ? chosen : fallback) : idOf(value);
  const tabStop = known(selected) ? selected : cells[0].id;

  const choose = (id: string) => {
    if (value === undefined) setChosen(id);
    onValueChange?.(id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
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
    choose(cells[next].id);
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
        const isSelected = cell.id === selected;
        return (
          <button
            key={cell.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={cell.name}
            tabIndex={cell.id === tabStop ? 0 : -1}
            data-date={cell.id}
            data-today={cell.isToday ? 'true' : undefined}
            onClick={() => choose(cell.id)}
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
              className={cn('grid size-7 place-items-center rounded-full text-base font-semibold tabular-nums', cell.isToday && 'ring-1 ring-current forced-colors:outline-1')}
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

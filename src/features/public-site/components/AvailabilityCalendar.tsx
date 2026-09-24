import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';

export type AvailabilityStatus = 'loading' | 'error' | 'ready';

interface AvailabilityCalendarProps {
  /** Taken nights (`YYYY-MM-DD`) of the public availability; read only when `status` is `ready`. */
  bookedDates: ReadonlySet<string>;
  status: AvailabilityStatus;
  /** Why the availability could not be loaded (translated problem code, or a generic message). */
  errorMessage?: string;
  onRetry: () => void;
  /** Today in Europe/Rome (`YYYY-MM-DD`): earlier days are past. */
  today: string;
  /** End of the loaded range (`YYYY-MM-DD`, excluded): later days are unknown, never shown free. */
  rangeEnd?: string;
  /** Months that can be shown after the current one: the availability covers one year. */
  monthsAhead?: number;
}

/** 1 January 2024 was a Monday: the week starts on Monday. */
const FIRST_MONDAY = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthAt(today: string, offset: number): { year: number; month: number } {
  const [year, month] = today.split('-').map(Number);
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: index % 12 };
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/**
 * Month view of the nights already taken on the booking site (BK-05). A night is shown taken or free only once the
 * availability has loaded: while loading or after an error no day is shown free.
 */
export function AvailabilityCalendar({
  bookedDates,
  status,
  errorMessage,
  onRetry,
  today,
  rangeEnd,
  monthsAhead = 11,
}: AvailabilityCalendarProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const [offset, setOffset] = useState(0);
  const { year, month } = monthAt(today, offset);
  const locale = i18n.language;

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(Date.UTC(year, month, 1)),
      ),
    [locale, year, month],
  );

  const weekDays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(FIRST_MONDAY + index * MS_PER_DAY)));
  }, [locale]);

  const { leadingBlanks, dates } = useMemo(() => {
    const firstWeekDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
      leadingBlanks: (firstWeekDay + 6) % 7,
      dates: Array.from({ length: daysInMonth }, (_, index) => isoDate(year, month, index + 1)),
    };
  }, [year, month]);

  return (
    <section className="space-y-2" aria-labelledby={titleId} data-testid="availability-calendar">
      <div className="flex items-center justify-between gap-2">
        <h4 id={titleId} className="text-sm font-semibold">
          {t('publicBooking.availability.title')}
        </h4>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t('publicBooking.availability.previousMonth')}
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[8.5rem] text-center text-sm capitalize" aria-live="polite">
            {monthLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t('publicBooking.availability.nextMonth')}
            disabled={offset >= monthsAhead}
            onClick={() => setOffset((value) => Math.min(monthsAhead, value + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {status === 'loading' ? (
        <p role="status" className="flex items-center gap-2 text-sm text-[var(--cz-public-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('publicBooking.availability.loading')}
        </p>
      ) : null}

      {status === 'error' ? (
        <div role="alert" className="space-y-2 rounded-md border border-red-200 p-3 text-sm" data-testid="availability-error">
          <p className="flex items-start gap-2 text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage ?? t('publicBooking.availability.loadError')}</span>
          </p>
          <p className="text-[var(--cz-public-muted)]">{t('publicBooking.availability.checkedAtCheckout')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('publicBooking.availability.retry')}
          </Button>
        </div>
      ) : null}

      {status === 'ready' ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--cz-public-muted)]" aria-hidden="true">
            {weekDays.map((day, index) => (
              <span key={index}>{day}</span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1 text-center text-sm" data-testid="availability-days">
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <li key={`blank-${index}`} aria-hidden="true" />
            ))}
            {dates.map((date) => {
              // Past days and days after the loaded range have no status: never shown free.
              const known = date >= today && (!rangeEnd || date < rangeEnd);
              const booked = known && bookedDates.has(date);
              const label = formatStayDate(date, locale);
              return (
                <li
                  key={date}
                  data-date={date}
                  data-booked={known ? String(booked) : undefined}
                  aria-label={
                    known
                      ? t(booked ? 'publicBooking.availability.dayBooked' : 'publicBooking.availability.dayFree', {
                          date: label,
                        })
                      : label
                  }
                  className={cn(
                    'rounded-md py-1',
                    !known && 'text-[var(--cz-public-muted)] opacity-50',
                    booked && 'bg-red-50 text-red-700 line-through',
                    known && !booked && 'bg-emerald-50 text-emerald-800',
                  )}
                >
                  {Number(date.slice(8, 10))}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--cz-public-muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-50 ring-1 ring-emerald-200" aria-hidden="true" />
              {t('publicBooking.availability.legendFree')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-50 ring-1 ring-red-200" aria-hidden="true" />
              {t('publicBooking.availability.legendBooked')}
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}

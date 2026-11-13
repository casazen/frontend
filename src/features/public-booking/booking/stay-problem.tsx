import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, CalendarCheck } from 'lucide-react';
import { buildCalendarIndex, maxNightsAt } from '@/features/public-site/stay/stay-calendar-model';
import { formatDayMonth, formatStayRange } from '@/features/public-site/stay/stay-format';
import { useBooking, type QuoteView } from '@/features/public-booking/booking/booking-context';
import { extendToMinimum, firstFreeStay, fitGuests } from '@/features/public-booking/booking/stay-exits';
import { siteLocale } from '@/lib/site-language';
import '@/features/public-booking/booking/booking.css';

type ProblemView = Extract<QuoteView, { status: 'problem' }>;

interface StayExit {
  label: string;
  apply: () => void;
}

/**
 * A stay that cannot be had, said once and with a way out (DB-04b), never a bare error: the first free dates for as long a stay, the
 * stay stretched to the minimum that its arrival asks, the guests brought down to what the home holds, or the dates cleared to start
 * again. The ways out are worked out from the calendar of the home; what a stay costs is still only the quote of the server.
 *
 * The rules the host set on the nights (a closed arrival or departure, the most nights, the advance; E08/F05/US01, NF-36) are said in
 * their own sentence, and their way out is the first dates that break none of them (`firstFreeStay` skips what a rule refuses).
 */
export function StayProblem({ problem }: { problem: ProblemView }) {
  const { t, i18n } = useTranslation();
  const { stay, nights, calendar, property, setStay, clearDates } = useBooking();
  const locale = siteLocale(i18n.language);
  const index = useMemo(
    () => (calendar.status === 'ready' ? buildCalendarIndex(calendar.days, calendar.today, calendar.end) : null),
    [calendar.status, calendar.days, calendar.today, calendar.end],
  );

  const startAgain: StayExit = { label: t('propertyBooking.problem.clearDates'), apply: clearDates };
  /**
   * The first dates for as long a stay that respect every rule, looking from each of `starts` in turn; clearing the dates when there
   * are none. The dates the guest already has are no way out: the server refused them for a rule the calendar did not know yet.
   */
  const firstFreeExit = (...starts: string[]): StayExit => {
    for (const start of starts) {
      const next = index ? firstFreeStay(index, nights, start) : null;
      if (next && (next.checkIn !== stay.checkIn || next.checkOut !== stay.checkOut)) {
        return {
          label: t('propertyBooking.problem.firstFree', { dates: formatStayRange(next.checkIn, next.checkOut, locale) }),
          apply: () => setStay(next),
        };
      }
    }
    return startAgain;
  };

  let sentence: string;
  let exit: StayExit | null = null;

  switch (problem.problem) {
    case 'datesUnavailable':
      sentence = t('propertyBooking.problem.datesUnavailable');
      exit = firstFreeExit(stay.checkIn);
      break;
    case 'arrivalClosed':
      sentence = t('propertyBooking.problem.arrivalClosed', { date: formatDayMonth(stay.checkIn, locale) });
      exit = firstFreeExit(stay.checkIn);
      break;
    case 'departureClosed':
      sentence = t('propertyBooking.problem.departureClosed', { date: formatDayMonth(stay.checkOut, locale) });
      exit = firstFreeExit(stay.checkIn);
      break;
    case 'minNights': {
      const minimum = problem.minNights ?? property.minNights ?? 2;
      sentence = t('propertyBooking.problem.minNights', { count: minimum });
      const longer = index ? extendToMinimum(index, stay.checkIn) : null;
      exit = longer ? { label: t('propertyBooking.problem.extend', { count: minimum }), apply: () => setStay(longer) } : startAgain;
      break;
    }
    case 'maxNights': {
      // The limit of the rule of the arrival: from the quote or the calendar. Without a number the sentence does not name one.
      const maximum = problem.maxNights ?? (index ? maxNightsAt(index, stay.checkIn) : null);
      sentence = maximum ? t('propertyBooking.problem.maxNights', { count: maximum }) : t('propertyBooking.problem.maxNights');
      exit = firstFreeExit(stay.checkIn);
      break;
    }
    case 'advance':
      // Too close to the arrival or too far ahead of it: from the arrival on, and when nothing is found there (too far ahead) from today.
      sentence = t('propertyBooking.problem.advance');
      exit = firstFreeExit(stay.checkIn, '');
      break;
    case 'tooManyGuests': {
      const max = problem.maxGuests ?? property.maxGuests;
      sentence = t('propertyBooking.problem.tooManyGuests', { count: max });
      const fit = fitGuests(stay.adults, stay.children, max);
      exit = { label: t('propertyBooking.problem.reduceGuests', { count: max }), apply: () => setStay(fit) };
      break;
    }
    case 'petsNotAllowed':
      sentence = t('propertyBooking.problem.petsNotAllowed');
      exit = { label: t('propertyBooking.problem.withoutPets'), apply: () => setStay({ pets: false }) };
      break;
    case 'past':
      sentence = t('propertyBooking.problem.past');
      exit = startAgain;
      break;
    case 'invalidStay':
      sentence = t('propertyBooking.problem.invalidStay');
      exit = startAgain;
      break;
    case 'notBookable':
      sentence = t('propertyBooking.problem.notBookable');
      break;
    case 'failed':
      sentence = t('propertyBooking.quote.failed');
      break;
  }

  return (
    <div className="pp-msg pp-msg--err" data-testid="stay-problem" data-problem={problem.problem}>
      <p>
        <AlertCircle aria-hidden />
        <span>{sentence}</span>
      </p>
      {exit ? (
        <button type="button" className="pp-alt" onClick={exit.apply} data-testid="stay-problem-exit">
          <CalendarCheck aria-hidden />
          <span>{exit.label}</span>
          <ArrowRight aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

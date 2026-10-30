import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, CalendarCheck } from 'lucide-react';
import { buildCalendarIndex } from '@/features/public-site/stay/stay-calendar-model';
import { formatStayRange } from '@/features/public-site/stay/stay-format';
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
  let sentence: string;
  let exit: StayExit | null = null;

  switch (problem.problem) {
    case 'datesUnavailable': {
      sentence = t('propertyBooking.problem.datesUnavailable');
      const next = index ? firstFreeStay(index, nights, stay.checkIn) : null;
      exit = next
        ? { label: t('propertyBooking.problem.firstFree', { dates: formatStayRange(next.checkIn, next.checkOut, locale) }), apply: () => setStay(next) }
        : startAgain;
      break;
    }
    case 'minNights': {
      const minimum = problem.minNights ?? property.minNights ?? 2;
      sentence = t('propertyBooking.problem.minNights', { count: minimum });
      const longer = index ? extendToMinimum(index, stay.checkIn) : null;
      exit = longer ? { label: t('propertyBooking.problem.extend', { count: minimum }), apply: () => setStay(longer) } : startAgain;
      break;
    }
    case 'tooManyGuests': {
      const max = problem.maxGuests ?? property.maxGuests;
      sentence = t('propertyBooking.problem.tooManyGuests', { count: max });
      const fit = fitGuests(stay.adults, stay.children, max);
      exit = { label: t('propertyBooking.problem.reduceGuests', { count: max }), apply: () => setStay(fit) };
      break;
    }
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

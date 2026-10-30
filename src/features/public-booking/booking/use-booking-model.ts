import { useMemo } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { useDirectBookingQuote } from '@/queries/use-public-booking';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { usePublicPropertyCalendar } from '@/features/public-site/stay/use-public-calendar';
import { buildCalendarIndex, minNightsAt, rangeProblem } from '@/features/public-site/stay/stay-calendar-model';
import { problemOfCode, problemOfRange, type StayProblemKind } from '@/features/public-booking/booking/stay-exits';
import type { BookingModel, QuoteView } from '@/features/public-booking/booking/booking-context';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { buildPropertyCheckoutUrl } from '@/lib/booking-url';
import { nightsBetween } from '@/lib/stay-dates';
import { MINOR_MAX_AGE } from '@/lib/tourist-tax';
import type { DirectBookingQuotePayload, PublicPropertyDetailDto } from '@/types';

interface BookingModelInput {
  property: PublicPropertyDetailDto;
  orgSlug: string;
  hostLabel: string;
  contactEmail: string | null;
}

/**
 * The state behind the booking card of the property page (DB-04b), in one place so the card of the desktop, the bar and the sheet of
 * the phone, the calendar of the page and the rules that show the real dates of the cancellation all say the same thing. The stay
 * lives in the address; the calendar says which nights are free; the price is only ever the quote of the server (never added up
 * here, R-05), asked again at every change and cancelled when the stay changes again before it arrives.
 *
 * The children's ages are asked at the checkout. Until then the quote is asked with the oldest age of a minor, so that the tourist
 * tax the server shows is the highest it can be and the total can only go down: that line is called an estimate.
 */
export function useBookingModel({ property, orgSlug, hostLabel, contactEmail }: BookingModelInput): BookingModel {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const petsAllowed = property.petsPolicy ? property.petsPolicy !== 'No' : (property.amenities ?? []).includes('PetFriendly');
  const { stay, problems, guests, setStay, clearDates, linkTo } = useStayState({ maxGuests: property.maxGuests, petsAllowed });
  const calendar = usePublicPropertyCalendar(orgSlug, property.slug || property.id);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const acceptsBookings = property.acceptsBookings !== false;

  // What the calendar already says of the stay, so the server is not asked about dates that cannot be had.
  const calendarProblem = useMemo<{ problem: StayProblemKind; minNights?: number } | null>(() => {
    if (calendar.status !== 'ready' || nights <= 0) return null;
    const index = buildCalendarIndex(calendar.days, calendar.today, calendar.end);
    const problem = problemOfRange(rangeProblem(index, stay.checkIn, stay.checkOut));
    return problem ? { problem, minNights: problem === 'minNights' ? minNightsAt(index, stay.checkIn) : undefined } : null;
  }, [calendar.status, calendar.days, calendar.today, calendar.end, nights, stay.checkIn, stay.checkOut]);

  const overCapacity = problems.includes('overCapacity');
  const payload = useMemo<DirectBookingQuotePayload | null>(() => {
    if (nights <= 0 || calendarProblem || overCapacity) return null;
    return {
      propertyId: property.id,
      checkInDate: stay.checkIn,
      checkOutDate: stay.checkOut,
      numberOfAdults: stay.adults,
      numberOfChildren: stay.children,
      ...(stay.children > 0 ? { childrenAges: Array.from({ length: stay.children }, () => MINOR_MAX_AGE) } : {}),
    };
  }, [nights, calendarProblem, overCapacity, property.id, stay.checkIn, stay.checkOut, stay.adults, stay.children]);
  const query = useDirectBookingQuote(payload);

  const quote = useMemo<QuoteView>(() => {
    if (overCapacity) return { status: 'problem', problem: 'tooManyGuests', maxGuests: property.maxGuests };
    if (nights <= 0) return { status: 'none' };
    if (calendarProblem) return { status: 'problem', ...calendarProblem };
    if (query.isError) {
      const code = isAxiosError(query.error) ? getProblemCode(query.error.response?.data) : undefined;
      const problem = problemOfCode(code);
      if (problem !== 'failed') {
        return { status: 'problem', problem, minNights: property.minNights ?? undefined, maxGuests: property.maxGuests };
      }
      return {
        status: 'error',
        message: getProblemMessage(query.error, t) ?? t('propertyBooking.quote.failed'),
        retry: () => void query.refetch(),
      };
    }
    if (query.data && !query.isPlaceholderData) {
      return { status: 'ready', quote: query.data, estimatedTax: stay.children > 0 && query.data.touristTax.ageRulesApply };
    }
    return { status: 'loading', stale: query.data ?? null };
  }, [overCapacity, nights, calendarProblem, query, property.maxGuests, property.minNights, stay.children, t]);

  const fromPriceCents = useMemo(() => {
    if (calendar.status === 'ready') {
      const prices = calendar.days
        .filter((day) => day.available && day.priceCents !== null && day.date >= calendar.today)
        .map((day) => day.priceCents as number);
      if (prices.length > 0) return Math.min(...prices);
    }
    return property.nightlyRate > 0 ? Math.round(property.nightlyRate * 100) : null;
  }, [calendar.status, calendar.days, calendar.today, property.nightlyRate]);

  const canBook = quote.status === 'ready' && online && acceptsBookings;
  const checkoutHref = canBook
    ? buildPropertyCheckoutUrl(orgSlug, property, { checkIn: stay.checkIn, checkOut: stay.checkOut, guests, children: stay.children })
    : null;

  return {
    property,
    orgSlug,
    hostLabel,
    contactEmail,
    stay,
    guests,
    setStay,
    clearDates,
    calendar,
    nights,
    petsAllowed,
    quote,
    online,
    acceptsBookings,
    fromPriceCents,
    currency: quote.status === 'ready' ? quote.quote.currency : property.currency || 'EUR',
    checkoutHref,
    linkTo,
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays, nightsBetween } from '@/lib/stay-dates';
import { BookingCard } from '../booking-card';
import { BookingProvider } from '../booking-provider';
import type { DirectBookingQuote, PublicCalendarDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgPropertyCalendar: vi.fn() } }));
vi.mock('@/api/public-booking.api', () => ({ publicBookingApi: { quoteDirectBooking: vi.fn() } }));

const TODAY = '2026-10-05';
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';

const property = {
  id: PROPERTY_ID,
  slug: 'villa-mare',
  name: 'Villa Mare',
  description: 'Vista mare.',
  city: 'Napoli',
  postalCode: '80100',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 150,
  cleaningFee: 40,
  amenities: [],
  photoUrls: [],
  cinCode: null,
  cinStatus: 'Missing',
  timezone: 'Europe/Rome',
  houseRules: '',
  cancellationPolicySummary: '',
  minNights: null,
  currency: 'EUR',
  acceptsBookings: true,
} as PublicPropertyDetailDto;

const calendar: PublicCalendarDto = {
  propertyId: PROPERTY_ID,
  startDate: TODAY,
  endDate: addDays(TODAY, 90),
  today: TODAY,
  currency: 'EUR',
  generatedAt: `${TODAY}T08:00:00Z`,
  days: Array.from({ length: 90 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, nightlyPriceCents: 15000, minNights: 1 })),
};

const quote: DirectBookingQuote = {
  propertyId: PROPERTY_ID,
  checkInDate: '2026-10-16',
  checkOutDate: '2026-10-19',
  nights: 3,
  nightlyRate: 150,
  lodgingTotal: 467,
  cleaningFee: 40,
  basePrice: 507,
  touristTax: { status: 'Calculated', amount: 12.5, taxableNights: 3, ageRulesApply: false, categories: [] },
  totalPrice: 519.5,
  currency: 'EUR',
  paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
  lines: [
    { kind: 'Nights', quantity: 2, unitAmountCents: 15000, amountCents: 30000 },
    { kind: 'WeekendNights', quantity: 1, unitAmountCents: 16700, amountCents: 16700 },
    { kind: 'CleaningFee', quantity: 1, unitAmountCents: 4000, amountCents: 4000 },
    { kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: 1250 },
    { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 51950 },
  ],
};

function refusal(data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status: 422,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function calendarWith(rules: Record<string, Partial<PublicCalendarDto['days'][number]>>): PublicCalendarDto {
  return { ...calendar, days: calendar.days.map((day) => ({ ...day, ...rules[day.date] })) };
}

function renderCard(search: string, home: PublicPropertyDetailDto = property) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/book/demo/property/villa-mare${search}`]}>
        <BookingProvider property={home} orgSlug="demo" hostLabel="Giulia" contactEmail={null}>
          <BookingCard />
        </BookingProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingCard', () => {
  beforeEach(async () => {
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('BookingCard_StayChosen_ShowsTheTotalOfTheServerAndLinksToTheCheckoutWithTheStay', async () => {
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.getByTestId('booking-price')).not.toHaveTextContent('490');
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-announce')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-cta')).toHaveAttribute('href', expect.stringContaining('checkin=2026-10-16&checkout=2026-10-19&guests=2'));
    expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: PROPERTY_ID, checkInDate: '2026-10-16', checkOutDate: '2026-10-19', numberOfAdults: 2, numberOfChildren: 0 }),
      expect.anything(),
    );
  });

  it('BookingCard_HouseInSwissFrancs_WritesEveryAmountOfTheServerInFrancsNotInEuros', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue({ ...calendar, currency: 'CHF' });
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue({ ...quote, currency: 'CHF' });
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2', { ...property, currency: 'CHF' });

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.getByTestId('booking-price')).toHaveTextContent('CHF');
    expect(screen.getByTestId('booking-price')).not.toHaveTextContent('€');
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('CHF');
    expect(screen.getByTestId('price-breakdown-total')).not.toHaveTextContent('€');
  });

  it('BookingCard_NoDates_AsksNoQuoteAndOffersNoCheckout', async () => {
    renderCard('');

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('150'));
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');
  });

  it('BookingCard_ChildrenWithoutAges_AsksTheQuoteForTheOldestMinorAndCallsTheTaxAnEstimate', async () => {
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue({
      ...quote,
      touristTax: { ...quote.touristTax, ageRulesApply: true },
    });
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=3&children=1');

    await waitFor(() => expect(screen.getByTestId('tourist-tax-line')).toHaveTextContent('stimata'));
    expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(expect.objectContaining({ numberOfChildren: 1, childrenAges: [17] }), expect.anything());
  });

  it('BookingCard_PetOnAHomeThatTakesPets_CarriesThePetToTheCheckout', async () => {
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2&pets=1', { ...property, petsPolicy: 'Yes' });

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.getByTestId('booking-cta')).toHaveAttribute('href', expect.stringContaining('pets=1'));
    expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
  });

  it('BookingCard_PetOnAHomeThatTakesNone_SaysSoOffersTheWayOutAndOffersNoCheckout', async () => {
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2&pets=1', { ...property, petsPolicy: 'No' });

    const problem = await screen.findByTestId('stay-problem');
    expect(problem).toHaveAttribute('data-problem', 'petsNotAllowed');
    expect(problem).toHaveTextContent('Questa casa non ammette animali');
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');

    fireEvent.click(screen.getByTestId('stay-problem-exit'));
    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href', expect.stringContaining('pets'));
  });

  it('BookingCard_NoPetAndAHomeThatTakesNone_IsNotAProblem', async () => {
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2', { ...property, petsPolicy: 'No' });

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
  });

  /**
   * The rules the host set on the nights (E08/F05/US01, NF-36): the calendar of the home carries them, so the card says what is wrong and
   * where to go as soon as the calendar is in (what the server answered meanwhile is not shown), and when the server refuses all the same
   * it is said with its own sentence, never as «failed».
   */
  describe('the rules of the host on the nights', () => {
    it('BookingCard_ArrivalOnANightClosedToArrival_SaysSoOffersTheFirstOpenDatesAndNoCheckout', async () => {
      vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendarWith({ '2026-10-16': { closedToArrival: true } }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'arrivalClosed');
      expect(problem).toHaveTextContent('Gli arrivi sono chiusi il 16 ottobre.');
      expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');

      expect(screen.getByTestId('stay-problem-exit')).toHaveTextContent('Prime date libere');
      fireEvent.click(screen.getByTestId('stay-problem-exit'));
      await waitFor(() =>
        expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
          expect.objectContaining({ checkInDate: '2026-10-17', checkOutDate: '2026-10-20' }),
          expect.anything(),
        ),
      );
      expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    });

    it('BookingCard_DepartureOnADayClosedToDeparture_SaysSoAndOffersTheFirstOpenDates', async () => {
      vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendarWith({ '2026-10-19': { closedToDeparture: true } }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'departureClosed');
      expect(problem).toHaveTextContent('Le partenze sono chiuse il 19 ottobre.');
      expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');

      fireEvent.click(screen.getByTestId('stay-problem-exit'));
      await waitFor(() =>
        expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
          expect.objectContaining({ checkInDate: '2026-10-17', checkOutDate: '2026-10-20' }),
          expect.anything(),
        ),
      );
      expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    });

    it('BookingCard_StayLongerThanTheMaximumOfItsArrival_SaysTheMaximumAndOffersNoCheckout', async () => {
      vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendarWith({ '2026-10-16': { maxNights: 2 } }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'maxNights');
      expect(problem).toHaveTextContent('Il soggiorno massimo è di 2 notti.');
      expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');
    });

    it('BookingCard_ArrivalOutsideTheAdvanceWindow_SaysSoAndTheWayOutLooksFromToday', async () => {
      const rules = Object.fromEntries(calendar.days.map((day) => [day.date, { maxAdvanceDays: 7 }]));
      vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendarWith(rules));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'advance');
      expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');

      fireEvent.click(screen.getByTestId('stay-problem-exit'));
      await waitFor(() =>
        expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
          expect.objectContaining({ checkInDate: '2026-10-05', checkOutDate: '2026-10-08' }),
          expect.anything(),
        ),
      );
      expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    });

    it.each([
      ['direct_booking_arrival_closed', 'arrivalClosed', 'Gli arrivi sono chiusi il 16 ottobre.'],
      ['direct_booking_departure_closed', 'departureClosed', 'Le partenze sono chiuse il 19 ottobre.'],
      ['direct_booking_max_nights_exceeded', 'maxNights', 'Il soggiorno massimo è di 2 notti.'],
      ['direct_booking_advance_too_short', 'advance', 'Queste date non si possono prenotare con questo anticipo.'],
      ['direct_booking_advance_too_long', 'advance', 'Queste date non si possono prenotare con questo anticipo.'],
      ['direct_booking_min_nights_not_met', 'minNights', 'Il soggiorno minimo è di 2 notti.'],
    ])('BookingCard_QuoteRefusedWith_%s_SaysTheRuleWithAWayOutAndNeverTheGenericFailure', async (code, kind, sentence) => {
      vi.mocked(publicBookingApi.quoteDirectBooking).mockRejectedValue(refusal({ code, date: '2026-10-16', limit: 2 }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', kind);
      expect(problem).toHaveTextContent(sentence);
      expect(problem).not.toHaveTextContent(i18n.t('propertyBooking.quote.failed'));
      expect(screen.getByTestId('stay-problem-exit')).toBeInTheDocument();
      expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');
    });

    it('BookingCard_QuoteRefusedForTheMinimumOfTheArrivalDate_SaysTheNumberOfTheServerAndStretchesTheStayToIt', async () => {
      vi.mocked(publicBookingApi.quoteDirectBooking).mockImplementation(async (payload) => {
        const nights = nightsBetween(payload.checkInDate, payload.checkOutDate);
        if (nights < 5) throw refusal({ code: 'direct_booking_min_nights_not_met', limit: 5 });
        return { ...quote, checkInDate: payload.checkInDate, checkOutDate: payload.checkOutDate, nights };
      });
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      expect(await screen.findByTestId('stay-problem')).toHaveTextContent('Il soggiorno minimo è di 5 notti.');

      expect(screen.getByTestId('stay-problem-exit')).toHaveTextContent('Allunga fino a 5 notti');
      fireEvent.click(screen.getByTestId('stay-problem-exit'));
      await waitFor(() =>
        expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
          expect.objectContaining({ checkInDate: '2026-10-16', checkOutDate: '2026-10-21' }),
          expect.anything(),
        ),
      );
      await waitFor(() => expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument());
    });

    it('BookingCard_QuoteRefusedForAMinimumThatIsNotAboveTheStay_OffersNoShorterStayOnlyToClearTheDates', async () => {
      vi.mocked(publicBookingApi.quoteDirectBooking).mockRejectedValue(refusal({ code: 'direct_booking_min_nights_not_met' }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2', { ...property, minNights: 2 });

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'minNights');
      expect(problem).toHaveTextContent('Il soggiorno minimo è di 2 notti.');
      expect(screen.getByTestId('stay-problem-exit')).toHaveTextContent(i18n.t('propertyBooking.problem.clearDates'));
      expect(problem).not.toHaveTextContent('Allunga');
    });

    it('BookingCard_QuoteRefusedForTheMaximumWithoutALimit_DoesNotInventANumber', async () => {
      vi.mocked(publicBookingApi.quoteDirectBooking).mockRejectedValue(refusal({ code: 'direct_booking_max_nights_exceeded' }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      const problem = await screen.findByTestId('stay-problem');
      expect(problem).toHaveAttribute('data-problem', 'maxNights');
      expect(problem).toHaveTextContent('Il soggiorno supera il massimo consentito per questo arrivo.');
      expect(problem).not.toHaveTextContent('propertyBooking.problem');
    });

    it('BookingCard_QuoteRefusedWithACodeOfNoRule_IsStillTheGenericFailure', async () => {
      vi.mocked(publicBookingApi.quoteDirectBooking).mockRejectedValue(refusal({ code: 'something_else' }));
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      expect(await screen.findByTestId('booking-quote-error')).toHaveTextContent(i18n.t('propertyBooking.quote.failed'));
      expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    });

    it('BookingCard_CalendarWithNoRuleAtAll_BehavesAsItAlwaysDid', async () => {
      renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2');

      await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
      expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
    });
  });
});

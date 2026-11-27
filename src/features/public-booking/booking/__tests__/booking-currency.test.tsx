import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays } from '@/lib/stay-dates';
import { BookingBar } from '../booking-bar';
import { BookingCard } from '../booking-card';
import { BookingProvider } from '../booking-provider';
import { useBookingModel } from '../use-booking-model';
import type { DirectBookingQuote, PublicCalendarDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgPropertyCalendar: vi.fn() } }));
vi.mock('@/api/public-booking.api', () => ({ publicBookingApi: { quoteDirectBooking: vi.fn() } }));

/**
 * CHF-MONEY, the booking card of the property page, its price lines, the bar of the phone and the state behind them: the currency is the one the data say
 * (the quote's once it is in, the home's before), and when the data say none every amount is written with no symbol and the phrase that says the currency is
 * not available. A fixed euro was the way out of a missing currency; here it is never one, and nothing throws.
 */
const TODAY = '2026-10-05';
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const STAY = '?checkin=2026-10-16&checkout=2026-10-19&guests=2';

function property(currency: string | undefined): PublicPropertyDetailDto {
  // `currency` is a required text in the answer of the server: what these tests give it is what a malformed answer would carry.
  return {
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
    currency,
    acceptsBookings: true,
  } as PublicPropertyDetailDto;
}

function calendar(currency: string): PublicCalendarDto {
  return {
    propertyId: PROPERTY_ID,
    startDate: TODAY,
    endDate: addDays(TODAY, 90),
    today: TODAY,
    currency,
    generatedAt: `${TODAY}T08:00:00Z`,
    days: Array.from({ length: 90 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, nightlyPriceCents: 15000, minNights: 1 })),
  };
}

function quote(currency: string | undefined): DirectBookingQuote {
  return {
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
    currency: currency as string,
    paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
    lines: [
      { kind: 'Nights', quantity: 2, unitAmountCents: 15000, amountCents: 30000 },
      { kind: 'WeekendNights', quantity: 1, unitAmountCents: 16700, amountCents: 16700 },
      { kind: 'CleaningFee', quantity: 1, unitAmountCents: 4000, amountCents: 4000 },
      { kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: 1250 },
      { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 51950 },
    ],
  };
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWith(search: string, home: PublicPropertyDetailDto, ui: ReactNode) {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[`/book/demo/property/villa-mare${search}`]}>
        <BookingProvider property={home} orgSlug="demo" hostLabel="Giulia" contactEmail={null}>
          {ui}
        </BookingProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const NO_CURRENCY = [
  ['empty', ''],
  ['missing', undefined],
] as const;

describe('the booking card with no currency in the data', () => {
  beforeEach(async () => {
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar(''));
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote(''));
  });

  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it.each(NO_CURRENCY)('BookingCard_NoDatesAndHomeWithCurrency%s_WritesTheNightWithNoSymbolAndThePhrase', async (_name, currency) => {
    renderWith('', property(currency), <BookingCard />);

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('150 (valuta non disponibile)'));
    expect(screen.getByTestId('booking-card')).not.toHaveTextContent(/EUR|€/);
  });

  it.each(NO_CURRENCY)('BookingCard_StayChosenAndQuoteWithCurrency%s_WritesTheTotalTheLinesAndTheAnnouncementWithNoSymbol', async (_name, currency) => {
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote(currency));
    // The home itself says a valid currency: the quote that says none is not written in it nor in anything else (the amounts of the quote are the quote's).
    renderWith(STAY, property('EUR'), <BookingCard />);

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50 (valuta non disponibile)'));
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('519,50 (valuta non disponibile)');
    expect(screen.getByTestId('booking-announce')).toHaveTextContent('519,50 (valuta non disponibile)');
    // The line of the nights says its price the same way.
    expect(screen.getByTestId('price-breakdown')).toHaveTextContent('150 (valuta non disponibile)');
    expect(screen.getByTestId('booking-card')).not.toHaveTextContent(/EUR|€/);
  });

  it('BookingCard_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderWith(STAY, property(''), <BookingCard />);

    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519.50 (currency not available)'));
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('519.50 (currency not available)');
    expect(screen.getByTestId('booking-card')).not.toHaveTextContent(/EUR|€/);
  });

  it('BookingBar_NoCurrency_WritesThePriceOfTheBarWithNoSymbolAndThePhrase', async () => {
    renderWith('', property(''), <BookingBar />);

    await waitFor(() => expect(screen.getByTestId('mobile-booking-trigger')).toHaveTextContent('150 (valuta non disponibile)'));
    expect(screen.getByTestId('booking-bar')).not.toHaveTextContent(/EUR|€/);
  });

  it('BookingCard_CurrencyOfTheData_IsStillTheOneWritten', async () => {
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar('CHF'));
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote('CHF'));
    renderWith(STAY, property('CHF'), <BookingCard />);

    // The total of the quote is in: the night price of the calendar came first and already said francs.
    await waitFor(() => expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('CHF'));
    expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-price')).toHaveTextContent('CHF');
    expect(screen.getByTestId('booking-card')).not.toHaveTextContent('€');
    expect(screen.getByTestId('booking-card')).not.toHaveTextContent('valuta non disponibile');
  });
});

describe('the currency of the state behind the booking card', () => {
  beforeEach(async () => {
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar('CHF'));
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote('CHF'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function modelOf(home: PublicPropertyDetailDto, search = '') {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={[`/book/demo/property/villa-mare${search}`]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    return renderHook(() => useBookingModel({ property: home, orgSlug: 'demo', hostLabel: 'Giulia', contactEmail: null }), { wrapper });
  }

  it.each(NO_CURRENCY)('UseBookingModel_HomeWithCurrency%s_HasNoCurrencyAndNeverTheEuro', (_name, currency) => {
    const { result } = modelOf(property(currency));

    expect(result.current.quote.status).toBe('none');
    expect(result.current.currency).toBe(currency);
    expect(result.current.currency).not.toBe('EUR');
  });

  it('UseBookingModel_HomeInFrancs_HasFrancsBeforeAndAfterTheQuote', async () => {
    const { result } = modelOf(property('CHF'), STAY);

    expect(result.current.currency).toBe('CHF');
    await waitFor(() => expect(result.current.quote.status).toBe('ready'));
    expect(result.current.currency).toBe('CHF');
  });
});

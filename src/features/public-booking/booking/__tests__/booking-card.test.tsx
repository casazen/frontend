import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays } from '@/lib/stay-dates';
import { BookingCard } from '../booking-card';
import { BookingProvider } from '../booking-provider';
import type { DirectBookingQuote, PublicCalendarDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgPropertyCalendar: vi.fn() } }));
vi.mock('@/api/public-booking.api', () => ({ publicBookingApi: { quoteDirectBooking: vi.fn() } }));

/**
 * The booking card is money: the total it shows is the one the server worked out and the one the checkout will charge. Here the
 * server's total is NOT the sum of the nights, the cleaning and the rate shown elsewhere (it holds a tourist tax and a weekend
 * night), so a card that added things up by itself would show another number.
 */
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
    // Not 3 x 150 + 40 = 490, not the 507 of the lodging: the total is the one of the quote, to the cent.
    expect(screen.getByTestId('booking-price')).not.toHaveTextContent('490');
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-announce')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-cta')).toHaveAttribute('href', expect.stringContaining('checkin=2026-10-16&checkout=2026-10-19&guests=2'));
    expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: PROPERTY_ID, checkInDate: '2026-10-16', checkOutDate: '2026-10-19', numberOfAdults: 2, numberOfChildren: 0 }),
      expect.anything(),
    );
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
    // What the guest said travels with the stay: the checkout reads it from the address and tells the host.
    expect(screen.getByTestId('booking-cta')).toHaveAttribute('href', expect.stringContaining('pets=1'));
    expect(screen.queryByTestId('stay-problem')).not.toBeInTheDocument();
  });

  it('BookingCard_PetOnAHomeThatTakesNone_SaysSoOffersTheWayOutAndOffersNoCheckout', async () => {
    renderCard('?checkin=2026-10-16&checkout=2026-10-19&guests=2&pets=1', { ...property, petsPolicy: 'No' });

    const problem = await screen.findByTestId('stay-problem');
    expect(problem).toHaveAttribute('data-problem', 'petsNotAllowed');
    expect(problem).toHaveTextContent('Questa casa non ammette animali');
    // Not booked into a home without them as if the guest had not said it: no quote is asked and the button leads nowhere.
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');

    // The way out: the guest travels without the pet, and the stay can be booked.
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
});

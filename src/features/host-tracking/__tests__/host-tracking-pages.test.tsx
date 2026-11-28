import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicOrgApi } from '@/api/public-org.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import { CheckoutOutcomePage } from '@/features/public-booking/checkout-outcome-page';
import { CheckoutPage } from '@/features/public-booking/checkout-page';
import { PublicPropertyPage } from '@/features/public-booking/public-property-page';
import { SiteSearchPage } from '@/features/public-site/search/site-search-page';
import { SearchPage } from '@/features/search/search-page';
import i18n from '@/i18n/config';
import { CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { setHostSite, type HostSite } from '@/lib/host-site';
import { addDays } from '@/lib/stay-dates';
import { freezeClock } from '@/test/clock';
import type { CheckoutOutcome, CheckoutOutcomeState, DirectBookingQuote, PublicCalendarDto, PublicOrgDto, PublicPropertyDetailDto } from '@/types';
import type { PublicStayCard, PublicStaysResult } from '@/types/public-stays.types';
import type { DataLayerWindow } from '../gtm-loader';
import { PURCHASES_STORAGE_KEY } from '../purchase-once';

vi.mock('@/api/public-org.api', () => ({
  publicOrgApi: { getOrgProperty: vi.fn(), getOrgProperties: vi.fn(), getOrgPropertyCalendar: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { quoteDirectBooking: vi.fn(), createDirectBooking: vi.fn(), getCheckoutOutcome: vi.fn(), resumeCheckoutPayment: vi.fn() },
}));
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: {
    getPlatformStays: vi.fn(),
    getPlatformDestinations: vi.fn(),
    getPlatformCalendar: vi.fn(),
    getStays: vi.fn(),
    getDestinations: vi.fn(),
    getSiteCalendar: vi.fn(),
  },
}));
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: () => <div data-testid="stripe-element" />,
}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: unknown }) => children,
  PaymentElement: () => null,
  useStripe: () => ({ confirmPayment: vi.fn(), confirmSetup: vi.fn() }),
  useElements: () => ({}),
}));

configure({ asyncUtilTimeout: 5_000 });

/**
 * The four pages of the funnel with the hooks of the agency's analytics in them (E41/F04/US01/T01, NF-149), on the real pages with the answers of the API simulated: the rules that cost money or data
 * live where the pages hand their data to the hooks (the total of the server in major units, the search across all the sites that is never reported, the quote that is waited for, the state
 * that the backend reports), and a test of the hooks alone cannot see them.
 */
const TODAY = '2026-10-05';
const HOST: HostSite = { host: 'prenota.demo.example', slug: 'demo', displayName: 'Demo Stays', embedEnabled: true, tracking: { gtmContainerId: 'GTM-ABC123' } };
const org = { slug: 'demo', displayName: 'Demo Stays', hostName: 'Demo', contactEmail: null, marketingConsentVersion: null } as unknown as PublicOrgDto;

const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const BOOKING_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const TOKEN = 'tok_checkout';
const BOOKING_CODE = 'K7M4Q-9XP2H';
const STAY = '?checkin=2026-10-16&checkout=2026-10-19&guests=2';

const property = {
  id: PROPERTY_ID,
  slug: 'villa-mare',
  name: 'Villa Mare',
  description: '',
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

/** The `Total` line of the server is 50250 cents; the total in euros of the same quote is NOT the same number here, so that a page that read the wrong one is seen. */
const quote: DirectBookingQuote = {
  propertyId: PROPERTY_ID,
  checkInDate: '2026-10-16',
  checkOutDate: '2026-10-19',
  nights: 3,
  nightlyRate: 150,
  lodgingTotal: 450,
  cleaningFee: 40,
  basePrice: 490,
  touristTax: { status: 'Calculated', amount: 12.5, taxableNights: 3, ageRulesApply: false, categories: [] },
  totalPrice: 499,
  currency: 'EUR',
  paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
  lines: [
    { kind: 'Nights', quantity: 3, unitAmountCents: 15000, amountCents: 45000 },
    { kind: 'CleaningFee', quantity: 1, unitAmountCents: 4000, amountCents: 4000 },
    { kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: 1250 },
    { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 50250 },
  ],
};

type Message = Record<string, unknown>;
const layer = (): Message[] => ((window as DataLayerWindow).dataLayer ?? []) as Message[];
const events = (): Message[] => layer().filter((message) => typeof message.event === 'string' && message.event !== 'gtm.js');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function resetPage() {
  cleanup();
  vi.useRealTimers();
  setHostSite(null);
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');
  document.head.querySelectorAll('script[src^="https://www.googletagmanager.com/gtm.js"]').forEach((script) => script.remove());
  delete (window as DataLayerWindow).dataLayer;
}

describe('the pages of the funnel and the analytics of the agency', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetPage();
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    setHostSite(HOST);
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
    vi.mocked(publicOrgApi.getOrgProperties).mockResolvedValue([]);
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote);
  });

  afterEach(resetPage);

  describe('the checkout', () => {
    function renderCheckout() {
      return render(
        <QueryClientProvider client={newClient()}>
          <MemoryRouter initialEntries={[`/book/demo/property/villa-mare/checkout${STAY}`]}>
            <Routes>
              <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
                <Route path="property/:propertySlugOrId/checkout" element={<CheckoutPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    }

    it('CheckoutFlow_QuoteReady_ReportsBeginCheckoutWithTheTotalLineOfTheServerInMajorUnits', async () => {
      renderCheckout();

      await waitFor(() => expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('502,50'));
      await waitFor(() => expect(events()).toHaveLength(1));

      expect(events()[0]).toEqual({
        event: 'begin_checkout',
        ecommerce: { currency: 'EUR', value: 502.5, items: [{ item_id: PROPERTY_ID, item_name: 'Villa Mare', item_category: 'Napoli', price: 502.5, quantity: 1 }] },
      });
    });

    it('CheckoutFlow_QuoteNotReady_ReportsNothingYet', async () => {
      const pending = deferred<DirectBookingQuote>();
      vi.mocked(publicBookingApi.quoteDirectBooking).mockReturnValue(pending.promise);

      renderCheckout();

      await screen.findByTestId('checkout-step-stay');
      await waitFor(() => expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalled());
      expect(events()).toHaveLength(0);
    });
  });

  describe('the page of a home', () => {
    function renderProperty(search = '') {
      return render(
        <QueryClientProvider client={newClient()}>
          <MemoryRouter initialEntries={[`/book/demo/property/villa-mare${search}`]}>
            <Routes>
              <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
                <Route path="property/:propertySlugOrId" element={<PublicPropertyPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    }

    it('PublicPropertyPage_DatesInTheAddress_ReportsTheViewOnlyWhenTheQuoteIsInWithItsTotalAndCurrency', async () => {
      const pending = deferred<DirectBookingQuote>();
      vi.mocked(publicBookingApi.quoteDirectBooking).mockReturnValue(pending.promise);

      renderProperty(STAY);

      await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
      await waitFor(() => expect(publicBookingApi.quoteDirectBooking).toHaveBeenCalled());
      expect(events()).toHaveLength(0);

      await act(async () => {
        pending.resolve(quote);
      });

      await waitFor(() => expect(events()).toHaveLength(1));
      expect(events()[0]).toEqual({
        event: 'view_item',
        ecommerce: { currency: 'EUR', value: 502.5, items: [{ item_id: PROPERTY_ID, item_name: 'Villa Mare', item_category: 'Napoli', price: 502.5, quantity: 1 }] },
      });
    });

    it('PublicPropertyPage_NoDates_ReportsTheHomeAloneWithoutAnyMoney', async () => {
      renderProperty();

      await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
      await waitFor(() => expect(events()).toHaveLength(1));

      expect(events()[0]).toEqual({ event: 'view_item', ecommerce: { items: [{ item_id: PROPERTY_ID, item_name: 'Villa Mare', item_category: 'Napoli', quantity: 1 }] } });
      expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
    });
  });

  describe('the results', () => {
    function stay(id: string, overrides: Partial<PublicStayCard> = {}): PublicStayCard {
      return {
        id,
        name: `Casa ${id}`,
        comune: 'Lugano',
        latitude: 46,
        longitude: 8.95,
        photos: [],
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        amenities: [],
        tags: [],
        availability: { available: true },
        price: { currency: 'CHF', perNightCents: 24000, totalCents: 96050 },
        ...overrides,
      };
    }

    function found(items: PublicStayCard[]): PublicStaysResult {
      return {
        currency: 'CHF',
        adults: 2,
        children: 0,
        pets: false,
        totalCount: items.length,
        availableCount: items.filter((item) => item.availability.available).length,
        page: 1,
        pageSize: 24,
        items,
        alternatives: [],
        unsupportedFilters: [],
        generatedAt: '2030-06-01T08:00:00Z',
        facets: { maxGuests: 6, petsAllowed: true, tags: [], currency: 'CHF' },
      };
    }

    beforeEach(() => {
      vi.mocked(publicSiteSearchApi.getDestinations).mockResolvedValue([]);
      vi.mocked(publicSiteSearchApi.getPlatformDestinations).mockResolvedValue([]);
      const days = { from: '2030-01-01', to: '2031-01-01', today: '2030-01-01', currency: 'CHF', adults: 2, children: 0, days: [], generatedAt: '2030-01-01T00:00:00Z' };
      vi.mocked(publicSiteSearchApi.getSiteCalendar).mockResolvedValue(days);
      vi.mocked(publicSiteSearchApi.getPlatformCalendar).mockResolvedValue(days);
    });

    it('SiteSearchPage_ResultsOfTheSite_ReportTheFreeHomesAndNotTheOthers', async () => {
      vi.mocked(publicSiteSearchApi.getStays).mockResolvedValue(found([stay('home-1'), stay('home-2', { availability: { available: false, reason: 'guests' } })]));

      render(
        <QueryClientProvider client={newClient()}>
          <MemoryRouter initialEntries={['/book/demo/search']}>
            <Routes>
              <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
                <Route path="search" element={<SiteSearchPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await screen.findAllByTestId('house-card');
      await waitFor(() => expect(events()).toHaveLength(1));

      const listed = events()[0].ecommerce as { item_list_id: string; items: { item_id: string }[] };
      expect(events()[0].event).toBe('view_item_list');
      expect(listed.item_list_id).toBe('search_results');
      expect(listed.items.map((item) => item.item_id)).toEqual(['home-1']);
    });

    it('SearchPage_TheSearchAcrossAllTheSites_ReportsNothingToTheAgency', async () => {
      vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(found([stay('home-1')]));

      render(
        <QueryClientProvider client={newClient()}>
          <MemoryRouter initialEntries={['/search']}>
            <Routes>
              <Route path="/search" element={<SearchPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await screen.findAllByTestId('house-card');
      expect(events()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
    });
  });

  describe('the outcome of a checkout', () => {
    const WAITING: CheckoutOutcomeState[] = ['AwaitingPayment', 'PaymentFailed', 'AwaitingGuestEmail', 'AwaitingHostApproval'];

    function outcome(state: CheckoutOutcomeState): CheckoutOutcome {
      return {
        bookingId: BOOKING_ID,
        state,
        paymentOption: 'Immediate',
        propertyId: PROPERTY_ID,
        propertySlug: 'trastevere-suite',
        propertyName: 'Trastevere Suite',
        checkInDate: '2026-10-24',
        checkOutDate: '2026-10-27',
        numberOfAdults: 2,
        numberOfChildren: 0,
        totalPrice: 550,
        currency: 'EUR',
        expiresAt: WAITING.includes(state) ? '2026-10-05T10:30:00Z' : null,
        deferredChargeDate: null,
        bookingCode: BOOKING_CODE,
      };
    }

    function renderOutcome() {
      window.history.pushState({}, '', `/booking/${BOOKING_ID}?token=${TOKEN}`);
      return render(
        <QueryClientProvider client={newClient()}>
          <MemoryRouter initialEntries={[`/book/demo/booking/${BOOKING_ID}?token=${TOKEN}`]}>
            <Routes>
              <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
                <Route path="booking/:bookingId" element={<CheckoutOutcomePage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    }

    beforeEach(() => {
      vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue({
        ...property,
        id: PROPERTY_ID,
        slug: 'trastevere-suite',
        name: 'Trastevere Suite',
        city: 'Roma',
        zone: { it: 'Trastevere', en: 'Trastevere' },
        checkInFrom: '15:00',
        checkOutBy: '10:00',
        hostName: null,
        publicPhone: null,
      } as PublicPropertyDetailDto);
    });

    it('CheckoutOutcomePage_ConfirmedByTheBackend_ReportsOnePurchaseAndNothingThatNamesTheGuest', async () => {
      vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));

      renderOutcome();

      await screen.findByTestId('checkout-confirmation');
      await waitFor(() => expect(events()).toHaveLength(1));

      expect(events()[0]).toEqual({
        event: 'purchase',
        ecommerce: { transaction_id: BOOKING_ID, currency: 'EUR', value: 550, items: [{ item_id: PROPERTY_ID, item_name: 'Trastevere Suite', price: 550, quantity: 1 }] },
      });
      expect(JSON.stringify(layer())).not.toContain(BOOKING_CODE);
      expect(JSON.stringify(layer())).not.toContain(TOKEN);
    });

    it.each<[CheckoutOutcomeState, string]>([
      ['AwaitingHostApproval', 'checkout-outcome-awaiting-host'],
      ['PaymentProcessing', 'checkout-outcome-processing'],
      ['Expired', 'checkout-outcome-expired'],
    ])('CheckoutOutcomePage_BackendState%s_ReportsNoPurchase', async (state, testId) => {
      vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome(state));

      renderOutcome();

      await screen.findByTestId(testId);
      expect(events()).toHaveLength(0);
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });
  });
});

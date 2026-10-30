import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays } from '@/lib/stay-dates';
import { CheckoutPage } from '../checkout-page';
import type { CreateDirectBookingPayload, DirectBookingQuote, DirectBookingResponse, PublicCalendarDto, PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgProperty: vi.fn(), getOrgPropertyCalendar: vi.fn() } }));
vi.mock('@/api/public-booking.api', () => ({ publicBookingApi: { quoteDirectBooking: vi.fn(), createDirectBooking: vi.fn() } }));
// The Payment Element is Stripe's: the page only has to show it once the booking exists.
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: () => <div data-testid="stripe-element" />,
}));

configure({ asyncUtilTimeout: 5_000 });

/**
 * The checkout is money. The tests walk the three steps the way a guest does and hold the rules that cost money or data when they break:
 * one booking per press (a double tap makes one), the hold of the dates is promised only once the booking exists, the total is the one
 * of the server, and the personal data never reach the address.
 */
const TODAY = '2026-10-05';
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const org = { slug: 'demo', displayName: 'Demo Stays', contactEmail: null, marketingConsentVersion: null } as unknown as PublicOrgDto;

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
  totalPrice: 502.5,
  currency: 'EUR',
  paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
  lines: [
    { kind: 'Nights', quantity: 3, unitAmountCents: 15000, amountCents: 45000 },
    { kind: 'CleaningFee', quantity: 1, unitAmountCents: 4000, amountCents: 4000 },
    { kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: 1250 },
    { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 50250 },
  ],
};

const created: DirectBookingResponse = {
  bookingId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  clientSecret: 'pi_test_secret',
  connectedAccountPublishableContext: { publishableKey: 'pk_test', stripeAccountId: 'acct_test' },
  amount: 502.5,
  currency: 'EUR',
  touristTaxAmount: 12.5,
  basePrice: 490,
  freeRefundDeadline: '2026-10-10T00:00:00Z',
  paymentOption: 'Immediate',
  checkoutToken: 'tok_secret_checkout',
};

/** Writes the query of the address into the page, so a test can read what the checkout leaves in it. */
function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

function renderCheckout(search = '?checkin=2026-10-16&checkout=2026-10-19&guests=2') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/book/demo/property/villa-mare/checkout${search}`]}>
        <Routes>
          <Route
            path="/book/:orgSlug"
            element={
              <>
                <LocationProbe />
                <Outlet context={{ org }} />
              </>
            }
          >
            <Route path="property/:propertySlugOrId/checkout" element={<CheckoutPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return view;
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;

async function goToDetails() {
  await screen.findByTestId('checkout-step-stay');
  await waitFor(() => expect(screen.getByTestId('checkout-next')).not.toHaveAttribute('aria-disabled'));
  fireEvent.click(screen.getByTestId('checkout-next'));
  await screen.findByTestId('checkout-step-details');
}

async function fillDetailsAndGoToPayment() {
  fireEvent.change(field('firstName'), { target: { value: 'Mario' } });
  fireEvent.change(field('lastName'), { target: { value: 'Rossi' } });
  fireEvent.change(field('email'), { target: { value: 'mario.rossi@example.com' } });
  fireEvent.change(field('country'), { target: { value: 'IT' } });
  fireEvent.click(screen.getByTestId('checkout-next'));
  await screen.findByTestId('checkout-step-payment');
}

describe('CheckoutPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
    vi.mocked(publicBookingApi.quoteDirectBooking).mockResolvedValue(quote);
    vi.mocked(publicBookingApi.createDirectBooking).mockResolvedValue(created);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CheckoutPage_StayOfTheAddress_ShowsTheTotalOfTheServerInTheSummaryAndWaitsForIt', async () => {
    renderCheckout();

    await screen.findByTestId('checkout-step-stay');
    // The button waits for the quote of this very stay; the summary then shows the server's total, not 3 x 150 + 40.
    await waitFor(() => expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('502,50'));
    expect(screen.getByTestId('checkout-stay-summary')).toHaveTextContent('3 notti');
    expect(screen.getByTestId('checkout-next')).not.toHaveAttribute('aria-disabled');
  });

  it('CheckoutPage_ThreeSteps_NeverPutThePersonalDataInTheAddress', async () => {
    renderCheckout();
    await goToDetails();
    await fillDetailsAndGoToPayment();

    // The step and the stay are in the address, the guest is not.
    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('step=3');
    expect(search).toContain('checkin=2026-10-16');
    expect(search.toLowerCase()).not.toMatch(/mario|rossi|example/);
    expect(screen.getByTestId('checkout-review')).toHaveTextContent('Mario Rossi');
  });

  it('CheckoutPage_ThePressOfTheLastButton_MakesOneBookingEvenIfPressedTwice', async () => {
    renderCheckout();
    await goToDetails();
    await fillDetailsAndGoToPayment();

    // The hold of the dates is not promised before the booking exists.
    expect(screen.queryByText(/30 minuti/)).not.toBeInTheDocument();
    fireEvent.click(document.getElementById('data-consent') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('checkout-submit')).not.toHaveAttribute('aria-disabled'));

    const submit = screen.getByTestId('checkout-submit');
    fireEvent.click(submit);
    fireEvent.click(submit);

    await screen.findByTestId('checkout-payment');
    expect(publicBookingApi.createDirectBooking).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(publicBookingApi.createDirectBooking).mock.calls[0][0] as CreateDirectBookingPayload;
    expect(payload).toMatchObject({ propertyId: PROPERTY_ID, checkInDate: '2026-10-16', checkOutDate: '2026-10-19', numberOfAdults: 2, paymentOption: 'Immediate' });
    expect(payload.consent.dataProcessing).toBe(true);
    // Now the booking exists: the hold is real, the Payment Element is there, and the guest is not asked for the card twice.
    expect(screen.getByText(/30 minuti/)).toBeInTheDocument();
    expect(screen.getByTestId('stripe-element')).toBeInTheDocument();
  });

  it('CheckoutPage_WithoutTheConsent_DoesNotMakeTheBooking', async () => {
    renderCheckout();
    await goToDetails();
    await fillDetailsAndGoToPayment();

    fireEvent.click(screen.getByTestId('checkout-submit'));

    expect(screen.getByTestId('checkout-submit')).toHaveAttribute('aria-disabled', 'true');
    expect(publicBookingApi.createDirectBooking).not.toHaveBeenCalled();
  });

  it('CheckoutPage_HostThatCannotTakePayments_SaysSoInsteadOfShowingAFormThatWouldFail', async () => {
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue({ ...property, acceptsBookings: false });
    renderCheckout();

    await screen.findByTestId('checkout-payments-off');
    expect(screen.queryByTestId('checkout-step-stay')).not.toBeInTheDocument();
  });
});

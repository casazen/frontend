import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { CheckoutPage } from '../checkout-page';
import * as publicOrgQueries from '@/queries/use-public-org';
import * as publicBookingQueries from '@/queries/use-public-booking';
import { savePendingCheckout } from '@/lib/pending-checkout';
import { addDays, formatStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import type {
  DirectBookingPaymentOptions,
  DirectBookingQuote,
  DirectBookingQuotePayload,
  DirectBookingResponse,
  PublicOrgDto,
  PublicPropertyDetailDto,
  TouristTaxQuote,
} from '@/types';

vi.mock('@/queries/use-public-org');
vi.mock('@/queries/use-public-booking');

// Stripe is mocked whole: no network, no iframes, the tests drive confirmPayment / confirmSetup.
const stripe = vi.hoisted(() => ({ confirmPayment: vi.fn(), confirmSetup: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: unknown }) => children,
  PaymentElement: () => null,
  useStripe: () => stripe,
  useElements: () => ({}),
}));

// The ~250 countries of the select make every role query of the page slow in jsdom (flaky under load): two are enough
// here, the full list has its own tests.
vi.mock('@/lib/countries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/countries')>()),
  getCountryOptions: () => [
    { code: 'DE', name: 'Germania' },
    { code: 'IT', name: 'Italia' },
  ],
}));

// Explicit conditions only (no fixed waits); a generous ceiling so that a loaded machine does not fail a correct test.
configure({ asyncUtilTimeout: 5_000 });

// The Radix checkbox of the consent measures itself with ResizeObserver, missing in jsdom.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const org: PublicOrgDto = {
  slug: 'demo-casazen',
  displayName: 'Demo Casazen Stays',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
} as unknown as PublicOrgDto;

const property = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  slug: 'trastevere-suite',
  name: 'Trastevere Suite',
  description: '',
  city: 'Roma',
  postalCode: '00153',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 165,
  cleaningFee: 55,
  amenities: [],
  photoUrls: [],
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  houseRules: '',
  cancellationPolicySummary: '',
  minNights: null,
  currency: 'EUR',
} as unknown as PublicPropertyDetailDto;

const checkIn = addDays(todayInRome(), 30);
const checkOut = addDays(checkIn, 3);
const mutateAsync = vi.fn();
const quoteRefetch = vi.fn();

/**
 * Payment options like the backend (BK-07, A3-16): "Paga alla scadenza" only when its charge day (check-in − 7) is after
 * today; no free cancellation promised, the guest cannot cancel by themselves.
 */
type OptionsFor = (payload: DirectBookingQuotePayload) => DirectBookingPaymentOptions;
const backendOptions: OptionsFor = (payload) => {
  const chargeDate = addDays(payload.checkInDate, -7);
  const available = chargeDate > todayInRome();
  return {
    deferredPaymentAvailable: available,
    deferredChargeDate: available ? chargeDate : null,
    freeCancellationUntil: null,
  };
};

/** Tourist tax the mocked backend returns for a quote payload (default: 3,00 € per adult per night). */
type TaxFor = (payload: DirectBookingQuotePayload, nights: number) => TouristTaxQuote;
const fixedTax: TaxFor = (payload, nights) => ({
  status: 'Calculated',
  amount: 3 * payload.numberOfAdults * nights,
  taxableNights: nights,
  ageRulesApply: false,
  categories: [],
});

/** Mocks `useDirectBookingQuote` like the backend: lodging + cleaning of the property, tax from `taxFor`. */
function mockQuote(
  taxFor: TaxFor = fixedTax,
  state: { isError?: boolean } = {},
  optionsFor: OptionsFor = backendOptions,
) {
  vi.mocked(publicBookingQueries.useDirectBookingQuote).mockImplementation((payload) => {
    if (!payload || state.isError) {
      return {
        data: undefined,
        isPending: !state.isError,
        isFetching: false,
        isError: !!state.isError && !!payload,
        error: state.isError ? new Error('network') : null,
        refetch: quoteRefetch,
      } as unknown as ReturnType<typeof publicBookingQueries.useDirectBookingQuote>;
    }
    const nights = nightsBetween(payload.checkInDate, payload.checkOutDate);
    const touristTax = taxFor(payload, nights);
    const basePrice = 165 * nights + 55;
    const data: DirectBookingQuote = {
      propertyId: payload.propertyId,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      nights,
      nightlyRate: 165,
      lodgingTotal: 165 * nights,
      cleaningFee: 55,
      basePrice,
      touristTax,
      totalPrice: basePrice + (touristTax.status === 'Calculated' ? touristTax.amount ?? 0 : 0),
      currency: 'EUR',
      paymentOptions: optionsFor(payload),
    };
    return {
      data,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: quoteRefetch,
    } as unknown as ReturnType<typeof publicBookingQueries.useDirectBookingQuote>;
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/** Stands for the outcome page: shows what the checkout handed over in the history state. */
function OutcomeProbe() {
  const location = useLocation();
  return <output data-testid="outcome-page">{JSON.stringify(location.state ?? {})}</output>;
}

function renderCheckout(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/book/demo-casazen/property/trastevere-suite/checkout${search}`]}>
      <Routes>
        <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
          <Route path="property/:propertySlugOrId/checkout" element={<CheckoutPage />} />
          <Route path="booking/:bookingId" element={<OutcomeProbe />} />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** A created hold ("Paga subito" unless overridden) as `POST /public/bookings` answers it. */
function bookingResponse(overrides: Partial<DirectBookingResponse> = {}): DirectBookingResponse {
  return {
    bookingId: 'b1',
    clientSecret: 'pi_secret',
    connectedAccountPublishableContext: { publishableKey: 'pk_test', stripeAccountId: 'acct_test' },
    amount: 568,
    currency: 'EUR',
    touristTaxAmount: 18,
    basePrice: 550,
    freeRefundDeadline: '2026-10-01T00:00:00Z',
    paymentOption: 'Immediate',
    checkoutToken: 'tok_b1',
    ...overrides,
  };
}

async function submitCheckout(search: string, paymentOption: string | RegExp = 'Paga subito') {
  renderCheckout(search);
  fillGuest(paymentOption);
  await waitFor(() => expect(continueButton()).toBeEnabled());
  fireEvent.click(continueButton());
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continua' });
}

function fillGuest(paymentOption: string | RegExp = 'Paga subito') {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Mario' } });
  fireEvent.change(screen.getByLabelText('Cognome'), { target: { value: 'Rossi' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mario.rossi@example.com' } });
  fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '+49 30 1234567' } });
  fireEvent.change(screen.getByLabelText('Paese di residenza'), { target: { value: 'DE' } });
  fireEvent.click(screen.getByRole('button', { name: paymentOption }));
  fireEvent.click(screen.getByRole('checkbox'));
}

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('CheckoutPage', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    sessionStorage.clear();
    stripe.confirmPayment.mockReset();
    stripe.confirmSetup.mockReset();
    vi.mocked(publicOrgQueries.useOrgPublicProperty).mockReturnValue({
      data: property,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicOrgQueries.useOrgPublicProperty>);
    mutateAsync.mockReset();
    vi.mocked(publicBookingQueries.useCreateDirectBooking).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof publicBookingQueries.useCreateDirectBooking>);
    mockQuote();
  });

  afterEach(() => {
    cleanup();
  });

  it('CheckoutPage_WidgetDeepLink_PrefillsDatesAndGuestsAndEnablesContinue', async () => {
    mutateAsync.mockResolvedValue(bookingResponse());
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=3`);

    expect(screen.getByLabelText('Check-in')).toHaveValue(checkIn);
    expect(screen.getByLabelText('Check-out')).toHaveValue(checkOut);
    expect(screen.getByLabelText('Adulti')).toHaveValue(3);
    expect(screen.getByLabelText('Bambini')).toHaveValue(0);
    expect(screen.getByTestId('checkout-stay-summary')).toHaveTextContent('(3 notti)');
    expect(within(screen.getByTestId('price-breakdown')).getByText('3 notti x 165,00 €')).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();

    fillGuest();

    await waitFor(() => expect(continueButton()).toBeEnabled());
    fireEvent.click(continueButton());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfAdults: 3,
        numberOfChildren: 0,
        paymentOption: 'Immediate',
        guest: {
          firstName: 'Mario',
          lastName: 'Rossi',
          email: 'mario.rossi@example.com',
          phone: '+49 30 1234567',
          country: 'DE',
        },
      }),
    );
    expect(await screen.findByTestId('checkout-payment-step')).toBeInTheDocument();
    expect(screen.getByTestId('price-breakdown')).toHaveTextContent('568,00 €');
    expect(screen.queryByTestId('checkout-guest-step')).not.toBeInTheDocument();
  });

  it('CheckoutPage_LegacyCamelCaseLink_ReadsDatesAndChildren', () => {
    renderCheckout(`?checkIn=${checkIn}&checkOut=${checkOut}&guests=3&children=1`);

    expect(screen.getByLabelText('Check-in')).toHaveValue(checkIn);
    expect(screen.getByLabelText('Check-out')).toHaveValue(checkOut);
    expect(screen.getByLabelText('Adulti')).toHaveValue(2);
    expect(screen.getByLabelText('Bambini')).toHaveValue(1);
  });

  it('CheckoutPage_EditDatesAndGuests_UpdatesNightsAndUrl', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    const newCheckOut = addDays(checkIn, 5);

    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: newCheckOut } });
    fireEvent.change(screen.getByLabelText('Bambini'), { target: { value: '1' } });

    await waitFor(() => expect(screen.getByTestId('checkout-stay-summary')).toHaveTextContent('(5 notti)'));
    const search = new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);
    expect(search.get('checkin')).toBe(checkIn);
    expect(search.get('checkout')).toBe(newCheckOut);
    expect(search.get('guests')).toBe('3');
    expect(search.get('children')).toBe('1');
  });

  it('CheckoutPage_NoDatesInLink_ShowsEmptyDateFieldsWithoutInvalidDate', () => {
    renderCheckout('');

    expect(screen.getByLabelText('Check-in')).toHaveValue('');
    expect(screen.getByLabelText('Check-in')).toHaveAttribute('min', todayInRome());
    expect(screen.getByLabelText('Adulti')).toHaveValue(2);
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-breakdown')).not.toBeInTheDocument();
  });

  it('CheckoutPage_PastCheckIn_ShowsErrorAndKeepsContinueDisabled', async () => {
    const pastCheckIn = addDays(todayInRome(), -2);
    renderCheckout(`?checkin=${pastCheckIn}&checkout=${addDays(pastCheckIn, 3)}&guests=2`);

    expect(await screen.findByText('La data di check-in non può essere nel passato')).toBeInTheDocument();
    fillGuest();
    await waitFor(() => expect(screen.getByLabelText('Paese di residenza')).toHaveValue('DE'));
    expect(continueButton()).toBeDisabled();
  });

  it('CheckoutPage_GuestsOverCapacity_ShowsTooManyGuests', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=6`);

    expect(await screen.findByText('Il numero di ospiti supera la capienza della struttura')).toBeInTheDocument();
    expect(screen.getByText('Massimo 4 ospiti, bambini inclusi')).toBeInTheDocument();
  });

  it('CheckoutPage_InvalidEmailAfterBlur_ShowsEmailError', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    const email = screen.getByLabelText('Email');

    fireEvent.change(email, { target: { value: 'mario.rossi@' } });
    fireEvent.blur(email);

    expect(await screen.findByText('Inserisci un indirizzo email valido')).toBeInTheDocument();
  });

  it('CheckoutPage_DatesUnavailableConflict_ShowsTheMessageOfItsCode', async () => {
    mutateAsync.mockRejectedValue(
      problemError(409, { code: 'booking_dates_unavailable', detail: 'Dates not available (server text)' }),
    );

    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      "Le date scelte non sono disponibili: si sovrappongono a un'altra prenotazione o a un blocco del calendario.",
    );
    expect(screen.queryByText(/Impossibile avviare il checkout/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-resume-own-booking')).not.toBeInTheDocument();
  });

  it('CheckoutPage_ConflictWithOwnHoldOfThisTab_OffersToResumeThatBooking', async () => {
    // A3-15: back on the form after a redirect method, the guest's own hold blocks the dates (409).
    savePendingCheckout({
      bookingId: 'b-own',
      token: 'tok-own',
      orgSlug: 'demo-casazen',
      propertyId: property.id,
      checkIn,
      checkOut,
    });
    mutateAsync.mockRejectedValue(problemError(409, { code: 'booking_dates_unavailable', detail: 'x y' }));

    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    const resume = await screen.findByTestId('checkout-resume-own-booking');
    expect(within(resume).getByRole('link', { name: 'Riprendi la prenotazione' })).toHaveAttribute(
      'href',
      '/book/demo-casazen/booking/b-own?token=tok-own',
    );
  });

  it('CheckoutPage_DeferredPaymentRefused422_ShowsTheMessageOfItsCode', async () => {
    mutateAsync.mockRejectedValue(
      problemError(422, { code: 'direct_booking_deferred_payment_unavailable', detail: 'server text in english' }),
    );

    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`, /Paga più tardi/);

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      "Il pagamento alla scadenza non è disponibile per queste date: l'arrivo è troppo vicino.",
    );
  });

  it('CheckoutPage_TooManyGuests422_ShowsTheMessageOfItsCode', async () => {
    mutateAsync.mockRejectedValue(problemError(422, { code: 'booking_too_many_guests', detail: 'x y' }));

    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      "Il numero di ospiti supera la capienza massima dell'immobile.",
    );
  });

  it('CheckoutPage_ArrivalTomorrowForTenNights_DoesNotOfferPayAtTheDeadline', async () => {
    // A3-16: the option used to depend on nights > 7, with a deadline already past.
    const tomorrow = addDays(todayInRome(), 1);
    renderCheckout(`?checkin=${tomorrow}&checkout=${addDays(tomorrow, 10)}&guests=2`);

    expect(await screen.findByTestId('price-breakdown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paga subito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Paga più tardi/ })).not.toBeInTheDocument();
  });

  it('CheckoutPage_ArrivalInThirtyDays_OffersPayLaterOnTheBackendChargeDate', async () => {
    mutateAsync.mockResolvedValue(
      bookingResponse({ clientSecret: '', setupIntentClientSecret: 'seti_secret', paymentOption: 'OnCancellationDeadline' }),
    );
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    // The button says when the card is charged: the backend's date (check-in − 7 here), in Italian.
    const chargeDate = formatStayDate(addDays(checkIn, -7), 'it', { day: 'numeric', month: 'long' });
    expect(await screen.findByRole('button', { name: /Paga più tardi/ })).toHaveTextContent(
      `la carta viene salvata ora e addebitata il ${chargeDate}`,
    );
    fillGuest(/Paga più tardi/);
    await waitFor(() => expect(continueButton()).toBeEnabled());
    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-setup-step')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ paymentOption: 'OnCancellationDeadline' }));
  });

  it('CheckoutPage_GuestCannotCancelByThemselves_PromisesNoFreeCancellation', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    expect(await screen.findByTestId('price-breakdown')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-free-cancellation')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cancellazione gratuita/)).not.toBeInTheDocument();
  });

  it('CheckoutPage_BackendAllowsFreeCancellation_ShowsItsDate', async () => {
    const until = addDays(checkIn, -7);
    mockQuote(fixedTax, {}, (payload) => ({ ...backendOptions(payload), freeCancellationUntil: until }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    expect(await screen.findByTestId('checkout-free-cancellation')).toHaveTextContent('Cancellazione gratuita fino a');
  });

  it('CheckoutPage_ImmediatePaymentSucceeds_GoesToTheOutcomePageNotAConfirmation', async () => {
    // A3-15: "Prenotazione confermata!" used to be shown right after confirmPayment, before the webhook.
    mutateAsync.mockResolvedValue(bookingResponse());
    stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    fireEvent.click(await screen.findByRole('button', { name: 'Paga ora' }));

    expect(await screen.findByTestId('outcome-page')).toHaveTextContent('"clientStatus":"succeeded"');
    expect(screen.getByTestId('location')).toHaveTextContent('/book/demo-casazen/booking/b1?token=tok_b1');
    // Redirect methods come back to the same outcome page, not to window.location.href.
    expect(stripe.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/book/demo-casazen/booking/b1?token=tok_b1` },
      }),
    );
    expect(screen.queryByText('Prenotazione confermata!')).not.toBeInTheDocument();
  });

  it('CheckoutPage_CardDeclined_StaysOnThePaymentStepWithStripeMessage', async () => {
    mutateAsync.mockResolvedValue(bookingResponse());
    stripe.confirmPayment.mockResolvedValue({ error: { message: 'La tua carta è stata rifiutata.' } });
    await submitCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    fireEvent.click(await screen.findByRole('button', { name: 'Paga ora' }));

    expect(await screen.findByTestId('checkout-payment-error')).toHaveTextContent('La tua carta è stata rifiutata.');
    expect(screen.getByTestId('checkout-payment-step')).toBeInTheDocument();
    expect(screen.queryByTestId('outcome-page')).not.toBeInTheDocument();
  });

  it('CheckoutPage_ServerErrorWithoutDetails_ShowsGenericError', async () => {
    mutateAsync.mockRejectedValue(problemError(500, { error: 'Payment initialization failed' }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    fillGuest();
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      'Impossibile avviare il checkout. Verifica i dati e riprova.',
    );
  });

  it('CheckoutPage_PayOnSite_ShowsRequestWaitingForHostNotAConfirmedBooking', async () => {
    // BK-06 (D5): "pay at the property" sends a request; it is valid only once the host accepts it.
    mutateAsync.mockResolvedValue(
      bookingResponse({
        bookingId: 'bk-onsite-0001',
        clientSecret: '',
        amount: 550,
        touristTaxAmount: 0,
        freeRefundDeadline: `${addDays(checkIn, -7)}T00:00:00Z`,
        paymentOption: 'OnSite',
        emailConfirmationExpiresAt: '2026-10-01T10:15:00Z',
        checkoutToken: 'tok-onsite',
      }),
    );
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    // The option says up front that it is a request the host must accept.
    expect(screen.getByRole('button', { name: /Paga in struttura/ })).toHaveTextContent(
      "Richiesta da confermare: la prenotazione è valida solo dopo l'accettazione dell'host.",
    );
    fillGuest(/Paga in struttura/);
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    // The outcome page shows the request state read from the backend (awaiting the email, then the host).
    const outcome = await screen.findByTestId('outcome-page');
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ paymentOption: 'OnSite' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/book/demo-casazen/booking/bk-onsite-0001?token=tok-onsite');
    // The address the email went to, handed over in the history state (never in the URL).
    expect(outcome).toHaveTextContent('"guestEmail":"mario.rossi@example.com"');
    expect(screen.getByTestId('location')).not.toHaveTextContent('mario.rossi');
    expect(screen.queryByText('Prenotazione confermata!')).not.toBeInTheDocument();
  });

  it('CheckoutPage_PaymentsNotReady_ShowsTheReasonNotTheGenericError', async () => {
    // R-11: with Stripe Connect not configured the guest reads why, in their language.
    mutateAsync.mockRejectedValue(
      problemError(409, {
        code: 'direct_booking_payments_not_ready',
        detail: 'This property does not accept online bookings yet. Please contact the host directly.',
      }),
    );
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    fillGuest(/Paga in struttura/);
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      "Questa struttura non accetta ancora prenotazioni online. Contatta direttamente l'host.",
    );
    expect(screen.queryByText(/Impossibile avviare il checkout/)).not.toBeInTheDocument();
  });

  it('CheckoutPage_OnSiteStayTooLong_ShowsServerLimit', async () => {
    mutateAsync.mockRejectedValue(
      problemError(422, {
        code: 'onsite_request_too_many_nights',
        detail: 'Con il pagamento in struttura puoi richiedere al massimo 30 notti.',
      }),
    );
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    fillGuest(/Paga in struttura/);
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      'Con il pagamento in struttura puoi richiedere al massimo 30 notti.',
    );
  });

  it('CheckoutPage_PropertyNotFound_ShowsErrorState', () => {
    vi.mocked(publicOrgQueries.useOrgPublicProperty).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof publicOrgQueries.useOrgPublicProperty>);

    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}`);

    expect(screen.getByTestId('checkout-property-not-found')).toHaveTextContent('Struttura non trovata.');
    expect(screen.queryByTestId('direct-checkout-page')).not.toBeInTheDocument();
  });

  it('CheckoutPage_QuoteFromBackend_ShowsTheBackendTaxAndTotalNotAnEstimate', async () => {
    // R-05: 3 adults x 3 nights. The old hardcoded 2 € x adults x nights would have shown 18,00 €.
    mockQuote((payload, nights) => ({
      status: 'Calculated',
      amount: 6 * payload.numberOfAdults * nights,
      taxableNights: nights,
      ageRulesApply: false,
      categories: [],
    }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=3`);

    const breakdown = await screen.findByTestId('price-breakdown');
    expect(within(breakdown).getByTestId('tourist-tax-line')).toHaveTextContent('Tassa di soggiorno (inclusa nel totale)');
    expect(within(breakdown).getByTestId('tourist-tax-line')).toHaveTextContent('54,00 €');
    expect(within(breakdown).getByTestId('price-breakdown-total')).toHaveTextContent('604,00 €');
    expect(breakdown).not.toHaveTextContent('18,00 €');
    expect(publicBookingQueries.useDirectBookingQuote).toHaveBeenLastCalledWith({
      propertyId: property.id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numberOfAdults: 3,
      numberOfChildren: 0,
    });
  });

  it('CheckoutPage_RateUnavailable_ShowsExplicitStateAndDoesNotBlockTheCheckout', async () => {
    mockQuote(() => ({
      status: 'RateUnavailable',
      amount: null,
      taxableNights: 0,
      ageRulesApply: false,
      categories: [],
    }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    const breakdown = await screen.findByTestId('price-breakdown');
    expect(within(breakdown).getByTestId('tourist-tax-line')).toHaveTextContent('Tariffa non disponibile');
    expect(within(breakdown).getByTestId('tourist-tax-unavailable')).toBeInTheDocument();
    // No invented tax: the total is lodging + cleaning only.
    expect(within(breakdown).getByTestId('price-breakdown-total')).toHaveTextContent('550,00 €');

    fillGuest();
    await waitFor(() => expect(continueButton()).toBeEnabled());
  });

  it('CheckoutPage_TaxDependsOnAge_AsksTheAgesOfTheMinorsAndSendsThem', async () => {
    mutateAsync.mockResolvedValue(
      bookingResponse({ bookingId: 'b2', amount: 586, touristTaxAmount: 36, touristTaxStatus: 'Calculated' }),
    );
    mockQuote((payload, nights) =>
      payload.numberOfChildren > 0 && !payload.childrenAges
        ? { status: 'ChildAgesRequired', amount: null, taxableNights: 0, ageRulesApply: true, categories: [] }
        : { status: 'Calculated', amount: 6 * payload.numberOfAdults * nights, taxableNights: nights, ageRulesApply: true, categories: [] },
    );
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=3&children=1`);

    const ageSelect = await screen.findByLabelText('Minore 1');
    expect(screen.getByTestId('tourist-tax-line')).toHaveTextContent("Indica l'età dei minori");
    fillGuest();
    await waitFor(() => expect(screen.getByLabelText('Paese di residenza')).toHaveValue('DE'));
    expect(continueButton()).toBeDisabled();

    fireEvent.change(ageSelect, { target: { value: '8' } });

    await waitFor(() => expect(screen.getByTestId('tourist-tax-line')).toHaveTextContent('36,00 €'));
    await waitFor(() => expect(continueButton()).toBeEnabled());
    fireEvent.click(continueButton());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ numberOfAdults: 2, numberOfChildren: 1, childrenAges: [8] }),
    );
  });

  it('CheckoutPage_QuoteFails_ShowsTheErrorAndKeepsContinueDisabled', async () => {
    mockQuote(fixedTax, { isError: true });
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);

    expect(await screen.findByTestId('checkout-quote-error')).toHaveTextContent('Impossibile calcolare il prezzo');
    expect(screen.queryByTestId('price-breakdown')).not.toBeInTheDocument();
    fillGuest();
    await waitFor(() => expect(screen.getByLabelText('Paese di residenza')).toHaveValue('DE'));
    expect(continueButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(quoteRefetch).toHaveBeenCalled();
  });
});

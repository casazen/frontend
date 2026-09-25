import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicBookingApi } from '@/api/public-booking.api';
import { findPendingCheckout, savePendingCheckout } from '@/lib/pending-checkout';
import { MAX_POLL_ATTEMPTS } from '../checkout-outcome';
import { CheckoutOutcomePage } from '../checkout-outcome-page';
import type { CheckoutOutcome, CheckoutOutcomeState, PublicOrgDto } from '@/types';

vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { getCheckoutOutcome: vi.fn(), resumeCheckoutPayment: vi.fn() },
}));

// No real waiting: the backoff has its own unit test; here the next poll starts as soon as the previous one ends, and the
// tests hold the backend answers with promises they resolve themselves.
vi.mock('../checkout-outcome', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../checkout-outcome')>()),
  nextPollDelay: () => 0,
}));

const stripe = vi.hoisted(() => ({ confirmPayment: vi.fn(), confirmSetup: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: unknown }) => children,
  PaymentElement: () => null,
  useStripe: () => stripe,
  useElements: () => ({}),
}));

configure({ asyncUtilTimeout: 5_000 });

const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;
const BOOKING_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const TOKEN = 'tok_checkout';
const OUTCOME_PATH = `/book/demo-casazen/booking/${BOOKING_ID}?token=${TOKEN}`;
const WAITING_STATES: CheckoutOutcomeState[] = [
  'AwaitingPayment',
  'PaymentFailed',
  'AwaitingGuestEmail',
  'AwaitingHostApproval',
];

function outcome(state: CheckoutOutcomeState, overrides: Partial<CheckoutOutcome> = {}): CheckoutOutcome {
  return {
    bookingId: BOOKING_ID,
    state,
    paymentOption: 'Immediate',
    propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    propertySlug: 'trastevere-suite',
    propertyName: 'Trastevere Suite',
    checkInDate: '2026-10-24',
    checkOutDate: '2026-10-27',
    numberOfAdults: 2,
    numberOfChildren: 0,
    totalPrice: 550,
    currency: 'EUR',
    expiresAt: WAITING_STATES.includes(state) ? '2026-09-24T10:30:00Z' : null,
    deferredChargeDate: null,
    bookingCode: 'K7M4Q-9XP2H',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderOutcome(url: string = OUTCOME_PATH) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route path="booking/:bookingId" element={<CheckoutOutcomePage />} />
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CheckoutOutcomePage', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it.each<[CheckoutOutcomeState, string, string]>([
    ['Confirmed', 'checkout-confirmation', 'Prenotazione confermata!'],
    ['PaymentProcessing', 'checkout-outcome-processing', 'Pagamento in elaborazione'],
    ['PaymentFailed', 'checkout-outcome-failed', 'Pagamento non riuscito'],
    ['AwaitingPayment', 'checkout-outcome-awaiting-payment', 'Pagamento da completare'],
    ['AwaitingGuestEmail', 'checkout-onsite-request-sent', "Richiesta inviata: in attesa di conferma dell'host"],
    ['AwaitingHostApproval', 'checkout-outcome-awaiting-host', "Richiesta inviata all'host"],
    ['Expired', 'checkout-outcome-expired', 'Tempo scaduto'],
    ['Declined', 'checkout-outcome-declined', 'Richiesta non accettata'],
    ['DatesUnavailable', 'checkout-outcome-dates-unavailable', 'Date non più disponibili'],
    ['Cancelled', 'checkout-outcome-cancelled', 'Prenotazione annullata'],
  ])('CheckoutOutcomePage_BackendState%s_ShowsItsOwnScreen', async (state, testId, title) => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome(state));

    renderOutcome();

    const screenForState = await screen.findByTestId(testId);
    expect(within(screenForState).getByRole('heading', { level: 2 })).toHaveTextContent(title);
    expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledWith(BOOKING_ID, TOKEN);
    // A3-15: "Prenotazione confermata!" only for a booking the backend confirmed.
    if (state !== 'Confirmed') expect(screen.queryByText('Prenotazione confermata!')).not.toBeInTheDocument();
  });

  it('CheckoutOutcomePage_Confirmed_ShowsTheStayAndForgetsThePendingCheckout', async () => {
    savePendingCheckout({
      bookingId: BOOKING_ID,
      token: TOKEN,
      orgSlug: 'demo-casazen',
      propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      checkIn: '2026-10-24',
      checkOut: '2026-10-27',
    });
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(
      outcome('Confirmed', { paymentOption: 'OnCancellationDeadline', deferredChargeDate: '2026-10-17' }),
    );

    renderOutcome();

    const confirmed = await screen.findByTestId('checkout-confirmation');
    expect(confirmed).toHaveTextContent('Trastevere Suite');
    expect(confirmed).toHaveTextContent('La carta salvata verrà addebitata il 17 ottobre 2026.');
    // BK-11: the code of the confirmation email, not the booking id, with "Le mie prenotazioni" filled in with it.
    const reference = within(confirmed).getByTestId('checkout-outcome-booking-code');
    expect(reference).toHaveTextContent('K7M4Q-9XP2H');
    expect(confirmed).not.toHaveTextContent(BOOKING_ID);
    expect(within(reference).getByRole('link', { name: 'Visualizza le mie prenotazioni' })).toHaveAttribute(
      'href',
      '/book/demo-casazen/my-bookings?code=K7M4Q-9XP2H',
    );
    await waitFor(() =>
      expect(findPendingCheckout('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-10-24', '2026-10-27')).toBeNull(),
    );
  });

  it('CheckoutOutcomePage_ReturnFromRedirectSucceededWhileTheWebhookIsPending_PollsUntilConfirmed', async () => {
    const second = deferred<CheckoutOutcome>();
    vi.mocked(publicBookingApi.getCheckoutOutcome)
      .mockResolvedValueOnce(outcome('AwaitingPayment'))
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(outcome('Confirmed'));

    renderOutcome(
      `${OUTCOME_PATH}&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=succeeded`,
    );

    // Stripe said "succeeded" but the backend has not confirmed yet: being confirmed, not confirmed.
    expect(await screen.findByTestId('checkout-outcome-processing')).toHaveTextContent('Pagamento in elaborazione');
    expect(screen.queryByText('Prenotazione confermata!')).not.toBeInTheDocument();
    // The client secret does not stay in the address bar.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(OUTCOME_PATH));
    expect(screen.getByTestId('location')).not.toHaveTextContent('client_secret');

    await waitFor(() => expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledTimes(2));
    second.resolve(outcome('Confirmed'));

    expect(await screen.findByTestId('checkout-confirmation')).toHaveTextContent('Prenotazione confermata!');
  });

  it('CheckoutOutcomePage_RedirectFailed_PaysTheSameHoldAgain', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingPayment'));
    vi.mocked(publicBookingApi.resumeCheckoutPayment).mockResolvedValue({
      bookingId: BOOKING_ID,
      paymentOption: 'Immediate',
      clientSecret: 'pi_1_secret_x',
      setupIntentClientSecret: null,
      connectedAccountPublishableContext: { publishableKey: 'pk_test', stripeAccountId: 'acct_test' },
      expiresAt: '2026-09-24T10:30:00Z',
    });
    stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'processing' } });

    renderOutcome(`${OUTCOME_PATH}&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=failed`);

    const failed = await screen.findByTestId('checkout-outcome-failed');
    expect(failed).toHaveTextContent('fino a: 24 settembre alle ore 12:30 (ora italiana)');
    fireEvent.click(within(failed).getByRole('button', { name: 'Riprova il pagamento' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Paga ora' }));

    await waitFor(() => expect(stripe.confirmPayment).toHaveBeenCalledTimes(1));
    expect(publicBookingApi.resumeCheckoutPayment).toHaveBeenCalledWith(BOOKING_ID, TOKEN);
    expect(stripe.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ confirmParams: { return_url: `${window.location.origin}${OUTCOME_PATH}` } }),
    );
    // SEPA-like "processing": the page waits for the backend, it does not declare the booking confirmed.
    expect(await screen.findByTestId('checkout-outcome-processing')).toBeInTheDocument();
  });

  it('CheckoutOutcomePage_RetryAfterTheHoldExpired_ShowsTheExpiredBooking', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome)
      .mockResolvedValueOnce(outcome('PaymentFailed'))
      .mockResolvedValue(outcome('Expired'));
    vi.mocked(publicBookingApi.resumeCheckoutPayment).mockRejectedValue(
      problemError(409, { code: 'checkout_hold_expired', detail: 'x y' }),
    );

    renderOutcome();

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova il pagamento' }));

    const expired = await screen.findByTestId('checkout-outcome-expired');
    expect(expired).toHaveTextContent('Il pagamento non è stato completato in tempo e le date sono state liberate.');
    expect(within(expired).getByRole('link', { name: 'Prenota di nuovo' })).toHaveAttribute(
      'href',
      '/book/demo-casazen/property/trastevere-suite?checkin=2026-10-24&checkout=2026-10-27&guests=2',
    );
  });

  it('CheckoutOutcomePage_ResumeNotPossible_ShowsTheMessageOfItsCode', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingPayment'));
    vi.mocked(publicBookingApi.resumeCheckoutPayment).mockRejectedValue(
      problemError(409, { code: 'checkout_payment_not_resumable', detail: 'x y' }),
    );

    renderOutcome();

    fireEvent.click(await screen.findByRole('button', { name: 'Completa il pagamento' }));

    expect(await screen.findByTestId('checkout-outcome-resume-error')).toHaveTextContent(
      "Non c'è un pagamento da completare per questa prenotazione",
    );
  });

  it('CheckoutOutcomePage_ExpiredAfterTheGuestPaid_ExplainsTheLatePaymentAndKeepsChecking', async () => {
    const second = deferred<CheckoutOutcome>();
    vi.mocked(publicBookingApi.getCheckoutOutcome)
      .mockResolvedValueOnce(outcome('Expired'))
      .mockReturnValueOnce(second.promise);

    renderOutcome(`${OUTCOME_PATH}&redirect_status=succeeded`);

    expect(await screen.findByTestId('checkout-outcome-expired')).toHaveTextContent(
      "l'importo ti verrà rimborsato per intero",
    );
    // BK-04 may still confirm the booking again: the page keeps asking.
    await waitFor(() => expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledTimes(2));
    second.resolve(outcome('Confirmed'));
    expect(await screen.findByTestId('checkout-confirmation')).toBeInTheDocument();
  });

  it('CheckoutOutcomePage_HostDoesNotAnswer_StopsPollingAndOffersARefresh', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingHostApproval'));

    renderOutcome();

    const refresh = await screen.findByRole('button', { name: 'Aggiorna lo stato' });
    expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledTimes(MAX_POLL_ATTEMPTS + 1);
    expect(screen.getByTestId('checkout-outcome-awaiting-host')).toHaveTextContent(
      "La tua richiesta è stata inviata all'host, che può rispondere fino a: 24 settembre alle ore 12:30 (ora italiana).",
    );

    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));
    fireEvent.click(refresh);

    expect(await screen.findByTestId('checkout-confirmation')).toBeInTheDocument();
  });

  it('CheckoutOutcomePage_WrongLink_ShowsTheMessageOfItsCode', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockRejectedValue(
      problemError(404, { code: 'checkout_link_invalid', detail: 'x y' }),
    );

    renderOutcome();

    const error = await screen.findByTestId('checkout-outcome-error');
    expect(error).toHaveTextContent('Link della prenotazione non valido');
    expect(within(error).queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('CheckoutOutcomePage_NoToken_SaysTheLinkIsIncompleteWithoutCallingTheApi', () => {
    renderOutcome(`/book/demo-casazen/booking/${BOOKING_ID}`);

    expect(screen.getByTestId('checkout-outcome-invalid')).toHaveTextContent('Il link della prenotazione è incompleto');
    expect(publicBookingApi.getCheckoutOutcome).not.toHaveBeenCalled();
  });
});

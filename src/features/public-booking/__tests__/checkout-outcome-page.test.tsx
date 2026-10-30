import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicOrgApi } from '@/api/public-org.api';
import { findPendingCheckout, savePendingCheckout } from '@/lib/pending-checkout';
import { freezeClock } from '@/test/clock';
import { expectNoAxeViolations } from '@/test/axe';
import { MAX_POLL_ATTEMPTS } from '../checkout-outcome';
import { CheckoutOutcomePage } from '../checkout-outcome-page';
import type { CheckoutOutcome, CheckoutOutcomeState, PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { getCheckoutOutcome: vi.fn(), resumeCheckoutPayment: vi.fn() },
}));
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getOrgProperty: vi.fn() } }));

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

const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays', contactEmail: 'host@example.com' } as unknown as PublicOrgDto;
const BOOKING_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PROPERTY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TOKEN = 'tok_checkout';
const OUTCOME_PATH = `/book/demo-casazen/booking/${BOOKING_ID}?token=${TOKEN}`;
const WAITING_STATES: CheckoutOutcomeState[] = ['AwaitingPayment', 'PaymentFailed', 'AwaitingGuestEmail', 'AwaitingHostApproval'];

const property = {
  id: PROPERTY_ID,
  slug: 'trastevere-suite',
  name: 'Trastevere Suite',
  city: 'Roma',
  postalCode: '00153',
  photoUrls: ['https://cdn.example.com/trastevere.jpg'],
  zone: { it: 'Trastevere', en: 'Trastevere' },
  checkInFrom: '15:00',
  checkOutBy: '10:00',
  hostName: null,
  publicPhone: '+39 06 1234567',
} as unknown as PublicPropertyDetailDto;

function outcome(state: CheckoutOutcomeState, overrides: Partial<CheckoutOutcome> = {}): CheckoutOutcome {
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

/** What the checkout hands over in the history state of its navigation (never in the address). */
interface HandedOver {
  guestFirstName?: string;
  guestEmail?: string;
}

function renderOutcome(url: string = OUTCOME_PATH, state?: HandedOver) {
  const [pathname, search = ''] = url.split('?');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname, search: search ? `?${search}` : '', state }]}>
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

/** The public record of the house arrives after the state of the booking: its photo in the ticket is the sign that it is there. */
async function propertyShown() {
  await waitFor(() => expect(document.querySelector('.bc-ticket__media img')).toBeInTheDocument());
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

describe('CheckoutOutcomePage', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    freezeClock('2026-09-24T09:00:00Z');
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it.each<[CheckoutOutcomeState, string, string]>([
    ['Confirmed', 'checkout-confirmation', 'Prenotazione confermata!'],
    ['PaymentProcessing', 'checkout-outcome-processing', 'Pagamento in elaborazione'],
    ['PaymentFailed', 'checkout-outcome-failed', 'Pagamento non riuscito'],
    ['AwaitingPayment', 'checkout-outcome-awaiting-payment', 'Pagamento da completare'],
    ['AwaitingGuestEmail', 'checkout-onsite-request-sent', 'Ultimo passo: conferma la tua email'],
    ['AwaitingHostApproval', 'checkout-outcome-awaiting-host', 'Richiesta inviata a Demo Casazen Stays'],
    ['Expired', 'checkout-outcome-expired', 'Tempo scaduto'],
    ['Declined', 'checkout-outcome-declined', 'Richiesta non accettata'],
    ['DatesUnavailable', 'checkout-outcome-dates-unavailable', 'Date non più disponibili'],
    ['Cancelled', 'checkout-outcome-cancelled', 'Prenotazione annullata'],
  ])('CheckoutOutcomePage_BackendState%s_ShowsItsOwnScreenWithOneTitle', async (state, testId, title) => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome(state));

    renderOutcome();

    const screenForState = await screen.findByTestId(testId);
    expect(within(screenForState).getByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledWith(BOOKING_ID, TOKEN);
    // A3-15, D24: "Prenotazione confermata" only for a booking the backend confirmed.
    if (state !== 'Confirmed') expect(screen.queryByText(/Prenotazione confermata/)).not.toBeInTheDocument();
  });

  it('CheckoutOutcomePage_ConfirmedWithTheChargeOnADay_ShowsTheTicketTheCodeAndForgetsThePendingCheckout', async () => {
    savePendingCheckout({
      bookingId: BOOKING_ID,
      token: TOKEN,
      orgSlug: 'demo-casazen',
      propertyId: PROPERTY_ID,
      checkIn: '2026-10-24',
      checkOut: '2026-10-27',
    });
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(
      outcome('Confirmed', { paymentOption: 'OnCancellationDeadline', deferredChargeDate: '2026-10-17' }),
    );

    renderOutcome();

    const confirmed = await screen.findByTestId('checkout-confirmation');
    await propertyShown();
    const ticket = within(confirmed).getByTestId('checkout-outcome-summary');
    expect(ticket).toHaveTextContent('Trastevere Suite');
    expect(ticket.querySelector('.bc-ticket__zone')).toHaveTextContent('Trastevere');
    expect(ticket).toHaveTextContent('550,00');
    expect(ticket).toHaveTextContent('2 ospiti');
    expect(ticket).toHaveTextContent('Paghi il 17 ottobre 2026');
    expect(within(ticket).getByTestId('checkout-outcome-chip')).toHaveTextContent('Confermata');
    // The charge is a step of its own, with its day, between the confirmation and the arrival.
    expect(within(confirmed).getByTestId('checkout-outcome-steps')).toHaveTextContent('Addebito di 550,00');
    // BK-11: the code of the confirmation email, not the booking id, with the way to the guest area filled in with it.
    expect(within(confirmed).getByTestId('checkout-outcome-booking-code')).toHaveTextContent('K7M4Q-9XP2H');
    expect(confirmed).not.toHaveTextContent(BOOKING_ID);
    expect(within(confirmed).getByTestId('checkout-outcome-manage')).toHaveAttribute('href', '/book/demo-casazen/my-bookings?code=K7M4Q-9XP2H');
    await waitFor(() => expect(findPendingCheckout(PROPERTY_ID, '2026-10-24', '2026-10-27')).toBeNull());
  });

  it('CheckoutOutcomePage_GuestHandedOverTheirNameAndEmail_GreetsThemAndSaysWhereTheConfirmationWent', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));

    renderOutcome(OUTCOME_PATH, { guestFirstName: 'Mario', guestEmail: 'mario@example.com' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Prenotazione confermata, Mario!' })).toBeInTheDocument();
    expect(screen.getByTestId('checkout-confirmation')).toHaveTextContent('mario@example.com');
    // The name and the address came with the navigation: they are not in the address bar.
    expect(screen.getByTestId('location')).not.toHaveTextContent(/Mario|mario@/);
  });

  it('CheckoutOutcomePage_ConfirmedStay_HasTheArrivalAsTheStepThatIsHappening', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));

    renderOutcome();

    const steps = await screen.findByTestId('checkout-outcome-steps');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(document.querySelector('[aria-current="step"]')).toHaveAttribute('data-step', 'arrival');
    // The hours of the host, as the host wrote them (they come with the public record of the house).
    await propertyShown();
    expect(steps).toHaveTextContent('dalle 15:00');
    expect(steps).toHaveTextContent('entro le 10:00');
  });

  it('CheckoutOutcomePage_RequestWaitingForTheHost_IsNotABookingYetAndOffersTheHostToWriteTo', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingHostApproval', { paymentOption: 'OnSite' }));

    renderOutcome();

    const waiting = await screen.findByTestId('checkout-outcome-awaiting-host');
    expect(within(waiting).getByTestId('checkout-outcome-note')).toHaveTextContent('Richiesta, non ancora una prenotazione');
    expect(within(waiting).getByTestId('checkout-outcome-chip')).toHaveTextContent("In attesa dell'host");
    // D24: no time is promised that the system does not keep. The deadline is the one of the backend.
    expect(waiting).toHaveTextContent('fino a: 24 settembre alle ore 12:30 (ora italiana)');
    expect(waiting).not.toHaveTextContent(/entro 24 ore/);
    expect(within(waiting).getByTestId('checkout-outcome-write').getAttribute('href')).toMatch(/^mailto:host@example\.com\?subject=/);
    // The number the host published, reduced to what a `tel:` link accepts (it comes with the public record of the house).
    expect(await within(waiting).findByTestId('property-host-call')).toHaveAttribute('href', 'tel:+39061234567');
    expect(document.querySelector('[aria-current="step"]')).toHaveAttribute('data-step', 'host');
  });

  it('CheckoutOutcomePage_RequestWaitingForTheGuestEmail_SaysWhichAddressAndHasTheEmailAsTheStepThatIsHappening', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingGuestEmail', { paymentOption: 'OnSite' }));

    renderOutcome(OUTCOME_PATH, { guestEmail: 'mario@example.com' });

    const sent = await screen.findByTestId('checkout-onsite-request-sent');
    expect(sent).toHaveTextContent('mario@example.com');
    expect(within(sent).getByTestId('checkout-outcome-chip')).toHaveTextContent('Email da confermare');
    expect(within(sent).getByTestId('checkout-outcome-note')).toHaveTextContent('Richiesta, non ancora una prenotazione');
    expect(within(sent).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector('[aria-current="step"]')).toHaveAttribute('data-step', 'email');
  });

  it('CheckoutOutcomePage_AddToCalendar_OffersAFileAndTwoLinksThatNeverCarryTheBookingCode', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:calendar');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    try {
      renderOutcome();
      await screen.findByTestId('add-to-calendar');
      await propertyShown();
      fireEvent.click(screen.getByTestId('add-to-calendar'));

      const sheet = within(await screen.findByTestId('calendar-sheet'));
      for (const id of ['calendar-google', 'calendar-outlook']) {
        const link = sheet.getByTestId(id);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
        expect(link.getAttribute('href')).not.toContain('K7M4Q');
      }

      fireEvent.click(sheet.getByTestId('calendar-download'));

      const file = await readBlob(createObjectURL.mock.calls[0][0]);
      expect(file).toContain('BEGIN:VCALENDAR');
      expect(file).toContain('DTSTART;VALUE=DATE:20261024');
      expect(file).toContain('DTEND;VALUE=DATE:20261027');
      expect(file).toContain('LOCATION:Trastevere');
      expect(file).not.toContain('00153');
      expect(click).toHaveBeenCalledTimes(1);
      expect(await sheet.findByText(/File scaricato/)).toBeInTheDocument();
    } finally {
      click.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreate });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevoke });
    }
  });

  it('CheckoutOutcomePage_CopyTheCode_CopiesItAndSaysSo', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    renderOutcome();
    fireEvent.click(await screen.findByTestId('checkout-outcome-copy-code'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('K7M4Q-9XP2H'));
    expect(await screen.findByText('Codice copiato negli appunti.')).toBeInTheDocument();
  });

  it('CheckoutOutcomePage_NoClipboard_SelectsTheCodeSoThePersonCanCopyIt', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));

    renderOutcome();
    fireEvent.click(await screen.findByTestId('checkout-outcome-copy-code'));

    expect(await screen.findByText(/Codice selezionato/)).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe('K7M4Q-9XP2H');
  });

  it('CheckoutOutcomePage_ReturnFromRedirectSucceededWhileTheWebhookIsPending_PollsUntilConfirmed', async () => {
    const second = deferred<CheckoutOutcome>();
    vi.mocked(publicBookingApi.getCheckoutOutcome)
      .mockResolvedValueOnce(outcome('AwaitingPayment'))
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(outcome('Confirmed'));

    renderOutcome(`${OUTCOME_PATH}&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=succeeded`);

    // Stripe said "succeeded" but the backend has not confirmed yet: being confirmed, not confirmed.
    expect(await screen.findByTestId('checkout-outcome-processing')).toHaveTextContent('Pagamento in elaborazione');
    expect(screen.queryByText(/Prenotazione confermata/)).not.toBeInTheDocument();
    // The client secret does not stay in the address bar.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(OUTCOME_PATH));
    expect(screen.getByTestId('location')).not.toHaveTextContent('client_secret');

    await waitFor(() => expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledTimes(2));
    second.resolve(outcome('Confirmed'));

    expect(await screen.findByTestId('checkout-confirmation')).toHaveTextContent('Prenotazione confermata!');
    // The state changed: the title took the focus, so a screen reader reads the new one.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
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

  it('CheckoutOutcomePage_RetryAfterTheHoldExpired_ShowsTheExpiredBookingWithTheWayToOtherDates', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValueOnce(outcome('PaymentFailed')).mockResolvedValue(outcome('Expired'));
    vi.mocked(publicBookingApi.resumeCheckoutPayment).mockRejectedValue(problemError(409, { code: 'checkout_hold_expired', detail: 'x y' }));

    renderOutcome();

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova il pagamento' }));

    const expired = await screen.findByTestId('checkout-outcome-expired');
    expect(expired).toHaveTextContent('Il pagamento non è stato completato in tempo e le date sono state liberate.');
    expect(within(expired).getByRole('link', { name: 'Scegli altre date' })).toHaveAttribute(
      'href',
      '/book/demo-casazen/property/trastevere-suite?checkin=2026-10-24&checkout=2026-10-27&guests=2',
    );
  });

  it('CheckoutOutcomePage_ResumeNotPossible_ShowsTheMessageOfItsCode', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingPayment'));
    vi.mocked(publicBookingApi.resumeCheckoutPayment).mockRejectedValue(problemError(409, { code: 'checkout_payment_not_resumable', detail: 'x y' }));

    renderOutcome();

    fireEvent.click(await screen.findByRole('button', { name: 'Completa il pagamento' }));

    expect(await screen.findByTestId('checkout-outcome-resume-error')).toHaveTextContent(
      "Non c'è un pagamento da completare per questa prenotazione",
    );
  });

  it('CheckoutOutcomePage_ExpiredAfterTheGuestPaid_ExplainsTheLatePaymentAndKeepsChecking', async () => {
    const second = deferred<CheckoutOutcome>();
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValueOnce(outcome('Expired')).mockReturnValueOnce(second.promise);

    renderOutcome(`${OUTCOME_PATH}&redirect_status=succeeded`);

    expect(await screen.findByTestId('checkout-outcome-expired')).toHaveTextContent("l'importo ti verrà rimborsato per intero");
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
    // After about seven minutes the page says what the guest can do instead of waiting for ever.
    expect(screen.getByTestId('checkout-outcome-awaiting-host')).toHaveTextContent('controlla la tua email o cerca la prenotazione');

    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));
    fireEvent.click(refresh);

    expect(await screen.findByTestId('checkout-confirmation')).toBeInTheDocument();
  });

  it('CheckoutOutcomePage_Offline_SaysSoAndWaitsWithoutAskingAgain', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('AwaitingHostApproval'));

    try {
      renderOutcome();

      expect(await screen.findByTestId('checkout-outcome-offline')).toHaveTextContent('Sei offline');
      await new Promise((done) => setTimeout(done, 50));
      expect(publicBookingApi.getCheckoutOutcome).toHaveBeenCalledTimes(1);
    } finally {
      onLine.mockRestore();
    }
  });

  it('CheckoutOutcomePage_WrongLink_ShowsTheMessageOfItsCode', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockRejectedValue(problemError(404, { code: 'checkout_link_invalid', detail: 'x y' }));

    renderOutcome();

    const error = await screen.findByTestId('checkout-outcome-error');
    expect(error).toHaveTextContent('Link della prenotazione non valido');
    expect(within(error).queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(within(error).getByRole('link', { name: 'Cerca la tua prenotazione' })).toHaveAttribute('href', '/book/demo-casazen/my-bookings');
  });

  it('CheckoutOutcomePage_NoToken_SaysTheLinkIsIncompleteWithoutCallingTheApi', () => {
    renderOutcome(`/book/demo-casazen/booking/${BOOKING_ID}`);

    expect(screen.getByTestId('checkout-outcome-invalid')).toHaveTextContent('Il link della prenotazione è incompleto');
    expect(publicBookingApi.getCheckoutOutcome).not.toHaveBeenCalled();
  });

  it('CheckoutOutcomePage_LoadingAndConfirmed_HaveNoAccessibilityViolation', async () => {
    vi.mocked(publicBookingApi.getCheckoutOutcome).mockResolvedValue(outcome('Confirmed'));

    const { container } = renderOutcome();
    expect(screen.getByTestId('checkout-outcome-loading')).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await screen.findByTestId('checkout-confirmation');
    await expectNoAxeViolations(container);
  });
});

import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { publicCheckinApi } from '@/api/checkin.api';
import { checkInWizardApi } from '@/api/checkin-wizard.api';
import { applyNotificationsChange } from '@/features/notifications/use-notifications-realtime';
import { notificationKind } from '@/features/notifications/notification-model';
import { TOURIST_TAX_KEY } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState, StayTouristTax, TouristTaxCollection } from '@/types/checkin-wizard.types';
import type { PublicCheckInContextDto, PublicCheckInGuestPrefill, PublicTouristTax, TouristTaxPaymentIntent } from '@/types/public-checkin.types';
import { CheckInPage } from '../checkin-page';
import { ensureGuestLocale } from '../lib/guest-locale';
import { TouristTaxStep } from '../tourist-tax-step';
import type { CheckInWizardValues } from '../wizard/lib/checkin-wizard-model';
import { TaxCollection } from '../wizard/steps/tax-collection';
import { TaxStep } from '../wizard/steps/tax-step';
import {
  guestTaxAvailability,
  readPublicTouristTax,
  readTouristTaxPaymentIntent,
  refusalLeavesPaymentOpen,
  withoutPaymentReturn,
} from '../lib/tourist-tax-model';

// The Payment Element and Stripe.js are Stripe's: the page only has to open them with what the API gave, and to confirm once.
const stripe = vi.hoisted(() => ({ confirmPayment: vi.fn(), loadStripe: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: stripe.loadStripe }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: stripe.confirmPayment }),
  useElements: () => ({}),
}));
vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getContext: vi.fn(),
    submit: vi.fn(),
    searchCodes: vi.fn(),
    setLanguage: vi.fn(),
    getTouristTax: vi.fn(),
    createTouristTaxPaymentIntent: vi.fn(),
  },
}));
vi.mock('@/api/checkin-wizard.api', () => ({
  checkInWizardApi: {
    getTouristTax: vi.fn(),
    recordTouristTaxPaidAtProperty: vi.fn(),
    setExemptions: vi.fn(),
    setCollector: vi.fn(),
    getMunicipalityRate: vi.fn(),
    saveMunicipalityRate: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Explicit conditions only, no fixed waits (QA-INFRA-01): a wait ends as soon as its condition holds.
configure({ asyncUtilTimeout: 15_000 });

const TOKEN = 'tok-123';

/** Filling the guests over three steps takes a few seconds in jsdom, more on a loaded CI runner. */
const FORM_TEST_TIMEOUT_MS = 30_000;

/** The tax of a stay of two guests in a house in Switzerland: what the API sends, in francs. */
function taxView(overrides: Partial<PublicTouristTax> = {}): PublicTouristTax {
  return {
    status: 'ToCollect',
    reason: 'None',
    payable: 9,
    amountDue: 9,
    collectedAmount: 0,
    currency: 'CHF',
    guests: [
      { position: 0, taxableNights: 3, amount: 4.5, exempt: false },
      { position: 1, taxableNights: 3, amount: 4.5, exempt: false },
    ],
    requiredBeforeAccessCode: false,
    ...overrides,
  };
}

function paymentIntent(overrides: Partial<TouristTaxPaymentIntent> = {}): TouristTaxPaymentIntent {
  return {
    paymentIntentId: 'pi_test_1',
    clientSecret: 'pi_test_1_secret_abc',
    publishableKey: 'pk_test_123',
    stripeAccountId: 'acct_agency',
    amount: 9,
    currency: 'CHF',
    ...overrides,
  };
}

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function queryClientOf() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** What a new read of the tax answers: the tax as the server says it now, or the failure of the read. */
type TaxReadResult = { data?: PublicTouristTax; isError?: boolean };

function renderStep(view: PublicTouristTax | null, props: { refetch?: () => Promise<TaxReadResult | undefined>; completed?: boolean } = {}) {
  const client = queryClientOf();
  const refetch = props.refetch ?? vi.fn().mockResolvedValue(undefined);
  const element = (current: PublicTouristTax | null) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(TouristTaxStep, { token: TOKEN, view: current, refetch, fetching: false, completed: props.completed }),
    );
  const rendered = render(element(view));
  return { ...rendered, refetch, readAgain: (next: PublicTouristTax | null) => rendered.rerender(element(next)) };
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  // The page changes the language of the app for as long as it is on screen and gives it back: a test never leaves it changed.
  cleanup();
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

beforeEach(() => {
  vi.clearAllMocks();
  stripe.loadStripe.mockResolvedValue({});
  vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockResolvedValue(paymentIntent());
});

describe('TouristTaxStep: the money', () => {
  it('payable_AmountsAndCurrencyAreTheApis_NothingIsAddedUpInTheBrowser', async () => {
    // The price of the booking already included part of the tax: the API says what is paid now (3) apart from the tax of the stay (9), and the lines sum to the second.
    vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockResolvedValue(paymentIntent({ amount: 3 }));
    renderStep(taxView({ payable: 3, amountDue: 9 }));

    expect(screen.getByTestId('tourist-tax-total')).toHaveTextContent(/^3,00\s*CHF$/);
    expect(screen.getByTestId('tourist-tax-amount-due')).toHaveTextContent(/^9,00\s*CHF$/);
    expect(screen.getByTestId('tourist-tax-line-0-amount')).toHaveTextContent(/^4,50\s*CHF$/);
    // The currency is the API's, never a euro the code assumed.
    expect(screen.getByTestId('checkin-tourist-tax-step')).not.toHaveTextContent('€');
    // The guests are positions («Ospite 1 · 3 notti»), never a name.
    expect(screen.getByTestId('tourist-tax-line-0')).toHaveTextContent('Ospite 1 · 3 notti');

    // The button says what will be charged: the amount and the currency of the intent, which is on the account of the agency.
    expect(await screen.findByRole('button', { name: /^Paga 3,00\s*CHF$/ })).toBeEnabled();
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(1);
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledWith(TOKEN);
    expect(stripe.loadStripe).toHaveBeenCalledWith('pk_test_123', { stripeAccount: 'acct_agency' });
  });

  it('amountWithNoCurrency_IsShownWithoutASymbolAndTheSentenceSaysSo', async () => {
    renderStep(taxView({ currency: '' }));

    expect(screen.getByTestId('tourist-tax-total')).toHaveTextContent(/^9,00$/);
    expect(screen.getByTestId('checkin-tourist-tax-step')).not.toHaveTextContent(/[€$]|CHF|EUR/);
    expect(screen.getByTestId('tourist-tax-currency-missing')).toHaveTextContent('senza valuta');
    await screen.findByTestId('tourist-tax-payment');
  });

  it('payButton_DoubleClick_SendsOneConfirmation', async () => {
    let finish: (result: unknown) => void = () => undefined;
    stripe.confirmPayment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderStep(taxView());

    const pay = await screen.findByRole('button', { name: /^Paga 9,00\s*CHF$/ });
    fireEvent.click(pay);
    fireEvent.click(pay);

    expect(stripe.confirmPayment).toHaveBeenCalledTimes(1);
    const [options] = stripe.confirmPayment.mock.calls[0] as [{ confirmParams: { return_url: string }; redirect: string }];
    expect(options.redirect).toBe('if_required');
    // The way back of a method that redirects is the page itself, with no query: no secret and nothing of the guest in what is given besides the page.
    expect(options.confirmParams.return_url).toBe(`${window.location.origin}${window.location.pathname}`);
    // While it runs the button is disabled and says so.
    expect(await screen.findByRole('button', { name: /Pagamento in corso/ })).toBeDisabled();

    finish({ paymentIntent: { status: 'processing' } });
    await screen.findByTestId('tourist-tax-processing');
    expect(stripe.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('afterTheConfirmation_PaidIsSaidOnlyWhenTheApiSaysIt', async () => {
    stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    const step = renderStep(taxView());

    fireEvent.click(await screen.findByRole('button', { name: /^Paga 9,00\s*CHF$/ }));

    // The browser got «succeeded», but the payment is recorded by the server from what the provider says: until then the page says it is being confirmed, and shows no form.
    await screen.findByTestId('tourist-tax-processing');
    expect(screen.queryByTestId('tourist-tax-paid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();

    // The server says it: only then «pagata», with the amount of the API.
    step.readAgain(taxView({ status: 'PaidOnline', reason: 'NothingDue', payable: 0, collectedAmount: 9 }));
    expect(await screen.findByTestId('tourist-tax-paid')).toHaveTextContent(/9,00\s*CHF/);
    expect(screen.queryByTestId('tourist-tax-processing')).not.toBeInTheDocument();
  });

  it('paymentUnderWayAccordingToTheServer_ShowsNoFormAndReadsTheTaxAgain', async () => {
    vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockRejectedValue(httpError(409, { code: 'tourist_tax_payment_in_progress' }));
    const { refetch } = renderStep(taxView());

    await screen.findByTestId('tourist-tax-processing');
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('intentRefused_ShowsTheFailureWithARetryAndChargesNothing', async () => {
    vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockRejectedValueOnce(httpError(503));
    renderStep(taxView());

    await screen.findByTestId('tourist-tax-session-failed');
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    expect(stripe.confirmPayment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('tourist-tax-retry'));
    await screen.findByTestId('tourist-tax-payment');
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(2);
  });

  const NOT_PAYABLE: Array<[string, Partial<PublicTouristTax>, string]> = [
    ['channelCollects', { status: 'CollectedByChannel', reason: 'ChannelCollects', payable: 0, amountDue: 0 }, 'riscuote il portale'],
    ['included', { status: 'IncludedInBookingPayment', reason: 'AwaitingConfirmation', payable: 0 }, 'già compresa nel pagamento della prenotazione'],
    ['hostWillTell', { status: 'ToCollect', reason: 'NotComputable', payable: 0, amountDue: null, guests: [] }, "La tassa te la comunicherà l'host."],
    ['hostWillTell', { status: 'ToCollect', reason: 'CollectorUnknown', payable: 0, amountDue: null, guests: [] }, "La tassa te la comunicherà l'host."],
    ['paidAtProperty', { status: 'PaidAtProperty', reason: 'PaidAtProperty', payable: 0 }, 'già stata pagata in struttura'],
    ['nothingDue', { status: 'NotDue', reason: 'NothingDue', payable: 0, amountDue: 0 }, 'nessuna tassa di soggiorno da pagare'],
    ['atProperty', { status: 'ToCollect', reason: 'AlreadyPaidOnline', payable: 0, collectedAmount: 0 }, "la pagherai all'host in struttura"],
  ];

  it.each(NOT_PAYABLE)('notPayable_%s_OneSentenceAndNeverACharge', (outlook, overrides, sentence) => {
    renderStep(taxView(overrides));

    expect(screen.getByTestId(`tourist-tax-${outlook}`)).toHaveTextContent(sentence);
    expect(screen.getByTestId('checkin-tourist-tax-step')).toHaveAttribute('data-outlook', outlook);
    // Nothing is asked of the server and no form is drawn: the channel collects it, the price included it, the host tells it, it is paid.
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    expect(publicCheckinApi.createTouristTaxPaymentIntent).not.toHaveBeenCalled();
  });

  it('paidPartly_SaysWhatWasPaidAndNotTheRestOfTheTax', () => {
    renderStep(taxView({ status: 'ToCollect', reason: 'AlreadyPaidOnline', payable: 0, amountDue: 20, collectedAmount: 9 }));

    const notice = screen.getByTestId('tourist-tax-paidPartly');
    expect(notice).toHaveTextContent(/Hai già pagato online 9,00\s*CHF/);
    // The rest is not worked out here: no amount of it is told.
    expect(notice).not.toHaveTextContent('11,00');
    expect(publicCheckinApi.createTouristTaxPaymentIntent).not.toHaveBeenCalled();
  });

  it('completedCheckIn_SaysOnlyWhatCanStillBePaidOrWasPaid', () => {
    const channel = renderStep(taxView({ status: 'CollectedByChannel', reason: 'ChannelCollects', payable: 0 }), { completed: true });
    expect(channel.container).toBeEmptyDOMElement();
    channel.unmount();

    renderStep(taxView({ status: 'PaidOnline', reason: 'NothingDue', payable: 0, collectedAmount: 9 }), { completed: true });
    expect(screen.getByTestId('tourist-tax-paid')).toBeInTheDocument();
  });

  it('requiredBeforeTheLockCode_SaysSoNextToWhatIsToPay', async () => {
    renderStep(taxView({ requiredBeforeAccessCode: true }));

    expect(screen.getByTestId('tourist-tax-required')).toHaveTextContent('codice di accesso');
    await screen.findByTestId('tourist-tax-payment');
  });

  it('readFailed_SaysSoWithARetryAndNeverATaxOfZero', () => {
    const { refetch } = renderStep(null);

    expect(screen.getByTestId('checkin-tourist-tax-failed')).toHaveTextContent('Non riusciamo a caricare la tassa di soggiorno');
    expect(screen.queryByTestId('tourist-tax-total')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tourist-tax-load-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it.each(['de', 'fr', 'es'] as const)('payable_InTheLanguageOfThePage_%s_TheTextsAreThePagesAndTheAmountIsTheApis', async (language) => {
    // The page offers the guest five languages; the three of the subset files are loaded when the guest chooses them.
    await ensureGuestLocale(language);
    await i18n.changeLanguage(language);
    const t = i18n.getFixedT(language);
    renderStep(taxView());

    expect(t('checkin.touristTax.total')).not.toBe(i18n.getFixedT('it')('checkin.touristTax.total'));
    expect(screen.getByText(t('checkin.touristTax.total'))).toBeInTheDocument();
    expect(screen.getByTestId('tourist-tax-line-0')).toHaveTextContent(t('checkin.touristTax.guestLine', { index: 1, count: 3 }));
    expect(screen.getByTestId('tourist-tax-total')).toHaveTextContent(/9[.,]00\s*CHF/);
    await screen.findByTestId('tourist-tax-payment');
  });
});

describe('TouristTaxStep: back to what the server says after an outcome that is not sure', () => {
  const PAY = /^Paga 9,00\s*CHF$/;
  const refused = (type: string, message: string) => ({ error: { type, message } });
  const settled = async () => {
    // What `settle` does after the read of the tax (a microtask): the negative checks below look at the end of it.
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('confirmRefused_OutcomeOpen_ReadsTheTaxFirstThenAsksTheIntentAgain_NoSecondConfirmation', async () => {
    stripe.confirmPayment.mockResolvedValue(refused('api_connection_error', 'A network error occurred.'));
    const refetch = vi.fn().mockResolvedValue({ data: taxView(), isError: false });
    renderStep(taxView(), { refetch });

    fireEvent.click(await screen.findByRole('button', { name: PAY }));

    await waitFor(() => expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(2));
    expect(refetch).toHaveBeenCalledTimes(1);
    // The tax is read BEFORE the intent is asked for again, and nothing is confirmed twice.
    const readOrder = refetch.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const askedAgainOrder = vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mock.invocationCallOrder[1] ?? 0;
    expect(readOrder).toBeLessThan(askedAgainOrder);
    expect(stripe.confirmPayment).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('tourist-tax-payment')).toBeInTheDocument();
  });

  it('confirmRefused_DeclinedCard_NothingIsReadOrAskedAndTheFormStays', async () => {
    stripe.confirmPayment.mockResolvedValue(refused('card_error', 'Your card was declined.'));
    const refetch = vi.fn().mockResolvedValue({ data: taxView(), isError: false });
    renderStep(taxView(), { refetch });

    fireEvent.click(await screen.findByRole('button', { name: PAY }));

    expect(await screen.findByTestId('tourist-tax-payment-error')).toHaveTextContent('Your card was declined.');
    expect(screen.getByTestId('tourist-tax-payment')).toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('confirmRefused_TheServerNowSaysThereIsNothingToPay_NoNewIntentIsAskedFor', async () => {
    // The host recorded «Pagata in struttura»: the server cancelled the intent, so the confirmation is refused, and the tax read again is no longer payable.
    stripe.confirmPayment.mockResolvedValue(refused('invalid_request_error', 'The PaymentIntent was canceled.'));
    const refetch = vi.fn().mockResolvedValue({ data: taxView({ status: 'PaidAtProperty', reason: 'PaidAtProperty', payable: 0 }), isError: false });
    renderStep(taxView(), { refetch });

    fireEvent.click(await screen.findByRole('button', { name: PAY }));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await settled();
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('intentRefused404_ReadsTheTaxAgain', async () => {
    vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockRejectedValue(httpError(404));
    const { refetch } = renderStep(taxView());

    await screen.findByTestId('tourist-tax-session-failed');
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('retry_ReadsTheTaxFirst_AndATaxThatIsPaidGetsNoIntent', async () => {
    vi.mocked(publicCheckinApi.createTouristTaxPaymentIntent).mockRejectedValueOnce(httpError(503));
    const refetch = vi.fn().mockResolvedValue({ data: taxView({ status: 'PaidOnline', reason: 'NothingDue', payable: 0, collectedAmount: 9 }), isError: false });
    renderStep(taxView(), { refetch });

    fireEvent.click(await screen.findByTestId('tourist-tax-retry'));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await settled();
    expect(publicCheckinApi.createTouristTaxPaymentIntent).toHaveBeenCalledTimes(1);
  });
});

describe('the answers of the API', () => {
  it('refusalLeavesPaymentOpen_ADeclinedCardOrAnIncompleteFormDoNot_AnyOtherRefusalDoes', () => {
    expect(refusalLeavesPaymentOpen({ type: 'card_error', code: 'card_declined' })).toBe(false);
    expect(refusalLeavesPaymentOpen({ type: 'validation_error' })).toBe(false);
    expect(refusalLeavesPaymentOpen({ type: 'invalid_request_error', code: 'payment_intent_unexpected_state' })).toBe(true);
    expect(refusalLeavesPaymentOpen({ type: 'api_connection_error' })).toBe(true);
    expect(refusalLeavesPaymentOpen(undefined)).toBe(true);
  });

  it('readPublicTouristTax_AnAnswerThatIsNotTheTax_IsNothingAndNeverATaxOfZero', () => {
    // A catch-all answer that gave the context of the link, or the page of a misconfigured rewrite.
    expect(readPublicTouristTax({ completed: false, status: 'Inviato', sessionId: 'x', declaredGuests: 1 })).toBeNull();
    expect(readPublicTouristTax('<!doctype html>')).toBeNull();
    expect(readPublicTouristTax(null)).toBeNull();
    expect(readPublicTouristTax({ status: 'ToCollect', reason: 'None', payable: '9', guests: [], collectedAmount: 0 })).toBeNull();
  });

  it('readPublicTouristTax_TheTaxOfTheApi_KeepsEveryFigureAsTheApiWroteIt', () => {
    expect(
      readPublicTouristTax({
        status: 'ToCollect',
        reason: 'None',
        payable: 9.5,
        amountDue: null,
        collectedAmount: 0,
        currency: ' chf ',
        guests: [
          { position: 1, taxableNights: 2, amount: null, exempt: true },
          { position: 0, taxableNights: 2, amount: 4.75, exempt: false },
        ],
        requiredBeforeAccessCode: true,
      }),
    ).toEqual({
      status: 'ToCollect',
      reason: 'None',
      payable: 9.5,
      amountDue: null,
      collectedAmount: 0,
      currency: 'chf',
      guests: [
        { position: 0, taxableNights: 2, amount: 4.75, exempt: false },
        { position: 1, taxableNights: 2, amount: null, exempt: true },
      ],
      requiredBeforeAccessCode: true,
    });
  });

  it('readTouristTaxPaymentIntent_WithoutTheSecretTheKeyOrAnAmount_IsNothingAndNothingIsCharged', () => {
    expect(readTouristTaxPaymentIntent(paymentIntent())).toEqual(paymentIntent());
    expect(readTouristTaxPaymentIntent({ ...paymentIntent(), clientSecret: '' })).toBeNull();
    expect(readTouristTaxPaymentIntent({ ...paymentIntent(), publishableKey: undefined })).toBeNull();
    expect(readTouristTaxPaymentIntent({ ...paymentIntent(), stripeAccountId: '' })).toBeNull();
    expect(readTouristTaxPaymentIntent({ ...paymentIntent(), amount: 0 })).toBeNull();
  });

  it('guestTaxAvailability_A404OrA409_IsNotOfferedWhateverAnEarlierAnswerLeftInTheCache', () => {
    const read = { enabled: true, isPending: false, isError: true, hasData: true };
    expect(guestTaxAvailability({ ...read, error: httpError(404) })).toBe('unavailable');
    expect(guestTaxAvailability({ ...read, error: httpError(409, { code: 'tourist_tax_payment_not_available' }) })).toBe('unavailable');
    // A failure that may pass keeps what was read, and says it could not be read when nothing was.
    expect(guestTaxAvailability({ ...read, error: httpError(503) })).toBe('ready');
    expect(guestTaxAvailability({ ...read, hasData: false, error: httpError(503) })).toBe('failed');
    expect(guestTaxAvailability({ ...read, enabled: false, error: null })).toBe('off');
  });

  it('withoutPaymentReturn_TheSecretOfTheIntentGoesFromTheAddress_TheRestStays', () => {
    const back = new URLSearchParams('payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=succeeded&lang=de');
    expect(withoutPaymentReturn(back)?.toString()).toBe('lang=de');
    expect(withoutPaymentReturn(new URLSearchParams('lang=de'))).toBeNull();
  });
});

const booker: PublicCheckInGuestPrefill = {
  type: 'SingleGuest',
  firstName: 'Mario',
  lastName: 'Rossi',
  gender: null,
  dateOfBirth: null,
  bornInItaly: null,
  birthComuneName: '',
  birthCountryName: '',
  citizenshipName: '',
  documentNumberMasked: null,
  documentIssuePlaceName: '',
};

const openContext: PublicCheckInContextDto = {
  completed: false,
  status: 'InCompilazione',
  sessionId: '11111111-1111-1111-1111-111111111111',
  propertyName: 'Villa Demo',
  checkInDate: '2026-10-10T00:00:00Z',
  checkOutDate: '2026-10-13T00:00:00Z',
  declaredGuests: 1,
  guests: [booker],
  availableCodeTables: [],
};

function renderPage(flags: Partial<FeatureFlags> = {}) {
  const client = queryClientOf();
  return render(
    createElement(
      FeatureFlagsContext.Provider,
      { value: { flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false } },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/checkin/${TOKEN}`] },
          createElement(Routes, null, createElement(Route, { path: '/checkin/:token', element: createElement(CheckInPage) })),
        ),
      ),
    ),
  );
}

function guestCard(index: number) {
  return within(screen.getByTestId(`stay-guest-${index}`));
}

function change(scope: ReturnType<typeof within>, label: RegExp, value: string) {
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
}

/** The form is on screen AND the page has started it from the guests on file (see the same helper of the page test). */
async function formReady() {
  await screen.findByTestId('checkin-page');
  if (screen.queryByTestId('checkin-document-step')) {
    fireEvent.click(screen.getByTestId('checkin-enter-manually'));
  }
  await waitFor(() => expect(guestCard(0).getByLabelText(/^Nome/)).toHaveValue('Mario'));
}

/** One guest filled in as a guest does, then the step of the document: the way to what comes after. */
async function fillGuestAndDocument() {
  await formReady();
  const card = guestCard(0);
  change(card, /^Nome/, 'Giulia');
  change(card, /^Cognome/, 'Bianchi');
  change(card, /^Sesso/, 'Female');
  change(card, /^Data di nascita/, '1992-03-08');
  change(card, /^Luogo di nascita/, 'yes');
  change(card, /^Comune di nascita/, 'Firenze');
  change(card, /^Provincia/, 'FI');
  change(card, /^Cittadinanza/, 'Italia');
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByTestId('stay-guest-0-document');
  const document_ = within(screen.getByTestId('stay-guest-0-document'));
  change(document_, /^Tipo documento/, 'IdentityCard');
  change(document_, /^Numero documento/, 'CA12345AB');
  change(document_, /^Luogo di rilascio/, 'Firenze');
}

describe('CheckInPage and the tourist tax', () => {
  beforeEach(() => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue(openContext);
    vi.mocked(publicCheckinApi.searchCodes).mockResolvedValue([]);
    vi.mocked(publicCheckinApi.getTouristTax).mockResolvedValue(taxView());
  });

  it('flagOff_NothingAsksTheServerAboutTheTaxAndThePageHasTheStepsItAlwaysHad', async () => {
    renderPage();
    await screen.findByTestId('checkin-page');

    expect(screen.getByTestId('checkin-progress').children).toHaveLength(5);
    expect(publicCheckinApi.getTouristTax).not.toHaveBeenCalled();
    expect(screen.queryByTestId('checkin-tourist-tax-step')).not.toBeInTheDocument();
  });

  it.each([404, 409])('flagOnButTheApiAnswers%i_ThePageHasNoTaxStep', async (status) => {
    vi.mocked(publicCheckinApi.getTouristTax).mockRejectedValue(httpError(status, status === 409 ? { code: 'tourist_tax_payment_not_available' } : undefined));
    renderPage({ touristTaxOnlinePayment: true });
    await screen.findByTestId('checkin-page');
    await waitFor(() => expect(publicCheckinApi.getTouristTax).toHaveBeenCalledWith(TOKEN));

    expect(screen.getByTestId('checkin-progress').children).toHaveLength(5);
  });

  it('flagOn_TheStepComesAfterTheDocumentAndBeforeTheInvoiceAndTheConsents', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    renderPage({ touristTaxOnlinePayment: true });
    await fillGuestAndDocument();
    await waitFor(() => expect(screen.getByTestId('checkin-progress').children).toHaveLength(6));

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    const step = await screen.findByTestId('checkin-tourist-tax-step');
    expect(screen.getAllByText('Tassa di soggiorno').length).toBeGreaterThan(0);
    // The lines are positions: the guest typed a name in the step before, and it is not here.
    expect(step).not.toHaveTextContent(/Mario|Rossi|Giulia|Bianchi/);
    expect(screen.getByText('Passo 4 di 6')).toBeInTheDocument();

    // The organization did not ask for the tax before the code: the guest goes on without paying, and the invoice step and the privacy notice follow.
    fireEvent.click(screen.getByTestId('checkin-next'));
    await screen.findByTestId('checkin-invoice-step');
    fireEvent.click(screen.getByTestId('checkin-next'));
    await screen.findByTestId('checkin-privacy-notice');
  });

  it('requiredBeforeTheLockCode_TheGuestCannotLeaveTheStepUntilTheServerSaysItIsPaid', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    vi.mocked(publicCheckinApi.getTouristTax).mockResolvedValue(taxView({ requiredBeforeAccessCode: true }));
    renderPage({ touristTaxOnlinePayment: true });
    await fillGuestAndDocument();
    await waitFor(() => expect(screen.getByTestId('checkin-progress').children).toHaveLength(6));

    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
    await screen.findByTestId('checkin-tourist-tax-step');

    expect(screen.getByTestId('checkin-next')).toBeDisabled();
    fireEvent.click(screen.getByTestId('checkin-next'));
    expect(screen.getByTestId('checkin-tourist-tax-step')).toBeInTheDocument();
    // «Indietro» is always there: the guest is never shut in.
    expect(screen.getByRole('button', { name: /Indietro/ })).toBeEnabled();
  });

  it('paymentBeingConfirmed_BackAndNextWaitUntilItEnds', { timeout: FORM_TEST_TIMEOUT_MS }, async () => {
    let finish: (result: unknown) => void = () => undefined;
    stripe.confirmPayment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage({ touristTaxOnlinePayment: true });
    await fillGuestAndDocument();
    await waitFor(() => expect(screen.getByTestId('checkin-progress').children).toHaveLength(6));
    fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

    fireEvent.click(await screen.findByRole('button', { name: /^Paga 9,00\s*CHF$/ }));

    // The step is not left while the money moves.
    await waitFor(() => expect(screen.getByTestId('checkin-next')).toBeDisabled());
    expect(screen.getByRole('button', { name: /Indietro/ })).toBeDisabled();

    finish({ paymentIntent: { status: 'processing' } });
    await screen.findByTestId('tourist-tax-processing');
    await waitFor(() => expect(screen.getByTestId('checkin-next')).toBeEnabled());
    expect(screen.getByRole('button', { name: /Indietro/ })).toBeEnabled();
  });

  it('completedCheckIn_TheTaxThatCanStillBePaidIsUnderTheCard', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, completed: true, status: 'Completo' });
    renderPage({ touristTaxOnlinePayment: true });

    await screen.findByTestId('checkin-success');
    const card = await screen.findByTestId('checkin-completed-tourist-tax');
    expect(card).toHaveTextContent('Tassa di soggiorno');
    expect(await screen.findByRole('button', { name: /^Paga 9,00\s*CHF$/ })).toBeEnabled();
  });

  it('completedCheckIn_WithNothingToPayOrPaid_NoCardIsAdded', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ ...openContext, completed: true, status: 'Completo' });
    vi.mocked(publicCheckinApi.getTouristTax).mockResolvedValue(taxView({ status: 'CollectedByChannel', reason: 'ChannelCollects', payable: 0 }));
    renderPage({ touristTaxOnlinePayment: true });

    await screen.findByTestId('checkin-success');
    await waitFor(() => expect(publicCheckinApi.getTouristTax).toHaveBeenCalled());
    expect(screen.queryByTestId('checkin-completed-tourist-tax')).not.toBeInTheDocument();
  });
});

const collection: TouristTaxCollection = {
  status: 'ToCollect',
  reason: 'None',
  toCollect: 9,
  onlinePayable: 9,
  refundDue: 0,
  amountDue: 9,
  includedInBooking: 0,
  collectedAmount: 0,
  refundedAmount: 0,
  currency: 'EUR',
  collectedAt: null,
  onlinePaymentAvailable: true,
};

function renderCollection(overrides: Partial<TouristTaxCollection>, options: { canWrite?: boolean; busy?: boolean; onRecord?: () => void } = {}) {
  const workspace = {
    contexts: [],
    activeContext: 'short-rent',
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: (_context: string, permission: string) => (options.canWrite ?? true) && permission === 'payment.write',
    getDefaultRoute: vi.fn().mockReturnValue('/app/short-rent'),
  } as unknown as WorkspaceContextValue;
  return render(
    createElement(
      WorkspaceContext.Provider,
      { value: workspace },
      createElement(TaxCollection, {
        collection: { ...collection, ...overrides },
        busy: options.busy ?? false,
        recording: false,
        onRecordPaidAtProperty: options.onRecord ?? vi.fn(),
      }),
    ),
  );
}

describe('TaxCollection: the host sees the state of the collection', () => {
  it('toCollect_SaysSoWithTheAmountOfTheApiInItsCurrency', () => {
    renderCollection({ currency: 'CHF', toCollect: 12.5, onlinePayable: 12.5 });

    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Da incassare');
    expect(screen.getByTestId('tax-collection-detail')).toHaveTextContent(/12,50\s*CHF/);
    expect(screen.getByTestId('tax-collection-online')).toHaveTextContent(/12,50\s*CHF/);
    expect(screen.getByTestId('checkin-wizard-tax-collection')).not.toHaveTextContent('€');
  });

  it('paidOnline_SaysTheDayAndWhatTheGuestPaid_AndHasNoButton', () => {
    renderCollection({ status: 'PaidOnline', reason: 'NothingDue', toCollect: 0, onlinePayable: 0, collectedAmount: 9, collectedAt: '2026-11-15T09:30:00Z' });

    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Pagata online il 15 novembre 2026');
    expect(screen.getByTestId('tax-collection-detail')).toHaveTextContent(/9,00/);
    expect(screen.queryByTestId('tax-collection-paid-at-property')).not.toBeInTheDocument();
  });

  const STATES: Array<[TouristTaxCollection['status'], TouristTaxCollection['reason'], string]> = [
    ['PaidAtProperty', 'PaidAtProperty', 'Pagata in struttura'],
    ['CollectedByChannel', 'ChannelCollects', 'Incassata dal portale'],
    ['IncludedInBookingPayment', 'NothingDue', 'Compresa nel pagamento della prenotazione'],
    ['NotDue', 'NothingDue', 'Non dovuta'],
  ];

  it.each(STATES)('state_%s_IsToldInWordsAndHasNoButton', (status, reason, label) => {
    renderCollection({ status, reason, toCollect: 0, onlinePayable: 0, includedInBooking: 9 });

    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent(label);
    expect(screen.queryByTestId('tax-collection-paid-at-property')).not.toBeInTheDocument();
  });

  it('paidPartly_SaysWhatWasPaidAndWhatIsLeftToCollect', () => {
    renderCollection({ status: 'ToCollect', reason: 'AlreadyPaidOnline', collectedAmount: 9, toCollect: 6, onlinePayable: 0 });

    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Pagata online in parte');
    expect(screen.getByTestId('tax-collection-detail')).toHaveTextContent(/9,00.*6,00/);
    expect(screen.queryByTestId('tax-collection-paid-at-property')).not.toBeInTheDocument();
  });

  it('refundDue_IsToldAsWhatTheHostGivesBack_NothingIsRefundedHere', () => {
    renderCollection({ status: 'PaidOnline', reason: 'NothingDue', collectedAmount: 15, refundDue: 3, toCollect: 0, onlinePayable: 0, refundedAmount: 2 });

    expect(screen.getByTestId('tax-collection-refund-due')).toHaveTextContent(/3,00/);
    expect(screen.getByTestId('tax-collection-refunded')).toHaveTextContent(/2,00/);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('noCurrency_TheNumbersHaveNoSymbolAndASentenceSaysWhy', () => {
    renderCollection({ currency: '' });

    expect(screen.getByTestId('tax-collection-detail')).toHaveTextContent(/^Importo da incassare: 9,00\.$/);
    expect(screen.getByTestId('tax-collection-currency-missing')).toBeInTheDocument();
  });

  it('markPaidAtProperty_WithoutPaymentWrite_HasNoButton', () => {
    renderCollection({}, { canWrite: false });

    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Da incassare');
    expect(screen.queryByTestId('tax-collection-paid-at-property')).not.toBeInTheDocument();
  });

  it('markPaidAtProperty_WithPaymentWrite_RecordsOnceAndWaitsForAnyWriteOfTheCard', () => {
    const onRecord = vi.fn();
    const view = renderCollection({}, { onRecord });

    const button = screen.getByRole('button', { name: 'Segna come pagata in struttura' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onRecord).toHaveBeenCalledTimes(1);
    view.unmount();

    // Any write of the card under way (an exemption, the collector) holds the button.
    renderCollection({}, { busy: true, onRecord });
    expect(screen.getByTestId('tax-collection-paid-at-property')).toBeDisabled();
    fireEvent.click(screen.getByTestId('tax-collection-paid-at-property'));
    expect(onRecord).toHaveBeenCalledTimes(1);
  });
});

/** The tax of a stay of one guest, as the host's step reads it, with the collection block the server sends while its flag is on. */
function hostTax(collectionOverrides: Partial<TouristTaxCollection> | null = {}): StayTouristTax {
  return {
    bookingId: 'b-1',
    status: 'Calculated',
    rateSource: 'Official',
    missingRate: false,
    nights: 2,
    taxableNights: 2,
    ageRulesApply: true,
    categories: [],
    total: 4,
    amountDue: 4,
    collector: 'Host',
    collectorSource: 'Default',
    collectorNeeded: false,
    guests: [{ position: 0, nights: 2, taxableNights: 2, amount: 4, exemptionKind: 'None' }],
    reasons: [{ code: 'resident', labelKey: 'touristTax.exemption.resident' }],
    stale: false,
    ...(collectionOverrides === null ? {} : { collection: { ...collection, toCollect: 4, onlinePayable: 4, amountDue: 4, ...collectionOverrides } }),
  };
}

function HostTaxStep() {
  const form = useForm<CheckInWizardValues>({
    defaultValues: { guests: [{ firstName: 'Anna', lastName: 'Verdi', taxExemptionCode: '' }] as unknown as CheckInWizardValues['guests'] },
  });
  const state = { booking: { bookingId: 'b-1', propertyId: 'p-1', checkIn: '2026-10-10' } } as unknown as CheckInWizardState;
  return createElement(TaxStep, { bookingId: 'b-1', form, state });
}

function renderHostStep(options: { workspace?: boolean } = {}) {
  const workspace = {
    contexts: [],
    activeContext: 'short-rent',
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: (_context: string, permission: string) => permission === 'payment.write',
    getDefaultRoute: vi.fn().mockReturnValue('/app/short-rent'),
  } as unknown as WorkspaceContextValue;
  const client = queryClientOf();
  const step = createElement(QueryClientProvider, { client }, createElement(HostTaxStep));
  return render(options.workspace === false ? step : createElement(WorkspaceContext.Provider, { value: workspace }, step));
}

describe('TaxStep of the host wizard with the collection', () => {
  beforeEach(() => {
    vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(hostTax());
  });

  it('flagOff_NoCollectionBlockIsSentAndTheStepIsTheOneItAlwaysWas', async () => {
    // No workspace around the step: nothing of the collection is drawn, so nothing reads it (the step must not need it).
    vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(hostTax(null));
    renderHostStep({ workspace: false });

    expect(await screen.findByTestId('tax-guest-0')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-wizard-tax-collection')).not.toBeInTheDocument();
    // The amounts are the euro amounts they always were.
    expect(screen.getByTestId('tax-guest-0-amount')).toHaveTextContent(/4,00\s*€/);
  });

  it('collectionBlock_IsAtTheEndOfTheStepWithTheStateOfTheApi', async () => {
    renderHostStep();

    const block = await screen.findByTestId('checkin-wizard-tax-collection');
    expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Da incassare');
    expect(block).toHaveTextContent(/4,00\s*€/);
    expect(screen.getByRole('button', { name: 'Segna come pagata in struttura' })).toBeEnabled();
  });

  it('markPaidAtProperty_WhileItRuns_HoldsEveryButtonOfTheCardAndRecordsOnce_ThenTheStateIsTheServers', async () => {
    let finish: (value: TouristTaxCollection) => void = () => undefined;
    vi.mocked(checkInWizardApi.recordTouristTaxPaidAtProperty).mockReturnValue(new Promise<TouristTaxCollection>((resolve) => (finish = resolve)));
    renderHostStep();

    const button = await screen.findByTestId('tax-collection-paid-at-property');
    fireEvent.click(button);
    fireEvent.click(button);

    // The mutation starts a moment after the click, and the second click met a button already disabled: one write.
    await waitFor(() => expect(checkInWizardApi.recordTouristTaxPaidAtProperty).toHaveBeenCalledTimes(1));
    expect(checkInWizardApi.recordTouristTaxPaidAtProperty).toHaveBeenCalledWith('b-1');
    // Any write of the card holds the others: the exemption of the guest waits too.
    await waitFor(() => expect(screen.getByTestId('tax-exemption-0')).toBeDisabled());
    expect(screen.getByTestId('tax-collection-paid-at-property')).toBeDisabled();

    // The server answers: the state is what it says, and the tax is read again.
    vi.mocked(checkInWizardApi.getTouristTax).mockResolvedValue(
      hostTax({ status: 'PaidAtProperty', reason: 'PaidAtProperty', toCollect: 0, onlinePayable: 0, collectedAt: '2026-11-15T09:30:00Z' }),
    );
    finish({ ...collection, status: 'PaidAtProperty', reason: 'PaidAtProperty', toCollect: 0, onlinePayable: 0, collectedAt: '2026-11-15T09:30:00Z' });
    await waitFor(() => expect(screen.getByTestId('tax-collection-state')).toHaveTextContent('Pagata in struttura'));
    expect(screen.queryByTestId('tax-collection-paid-at-property')).not.toBeInTheDocument();
    expect(screen.getByTestId('tax-exemption-0')).toBeEnabled();
    await waitFor(() => expect(checkInWizardApi.getTouristTax).toHaveBeenCalledTimes(2));
  });

  it('markPaidAtProperty_RefusedByTheServer_SaysWhyAndTheButtonStaysForAnotherTry', async () => {
    vi.mocked(checkInWizardApi.recordTouristTaxPaidAtProperty).mockRejectedValue(httpError(409, { code: 'tourist_tax_paid_online' }));
    renderHostStep();

    fireEvent.click(await screen.findByTestId('tax-collection-paid-at-property'));

    expect(await screen.findByTestId('checkin-wizard-tax-problem')).toHaveTextContent('già pagato la tassa di soggiorno online');
    await waitFor(() => expect(screen.getByTestId('tax-collection-paid-at-property')).toBeEnabled());
  });

  it('exemptionChosen_TheAnswerHasNoCollection_TheBlockStaysAndTheTaxIsReadAgain', async () => {
    vi.mocked(checkInWizardApi.setExemptions).mockResolvedValue(hostTax(null));
    renderHostStep();
    await screen.findByTestId('checkin-wizard-tax-collection');

    fireEvent.change(screen.getByTestId('tax-exemption-0'), { target: { value: 'resident' } });

    await waitFor(() => expect(checkInWizardApi.setExemptions).toHaveBeenCalledTimes(1));
    // The answer of a write carries no collection block: the one on screen does not vanish (it would look as if the flag went off), and the tax is read again.
    await waitFor(() => expect(checkInWizardApi.getTouristTax).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('checkin-wizard-tax-collection')).toBeInTheDocument();
  });
});

describe('the live refresh of a tax paid online', () => {
  it('applyNotificationsChange_TouristTaxPaid_ReadsTheTaxOfTheBookingAgain', () => {
    const client = queryClientOf();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    applyNotificationsChange(client, { unreadCount: 1, type: 'tourist-tax-paid', entityId: 'b-1' });

    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual([TOURIST_TAX_KEY, 'b-1']);
  });

  it('applyNotificationsChange_AnotherType_DoesNotReadTheTaxAgain', () => {
    const client = queryClientOf();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    applyNotificationsChange(client, { unreadCount: 1, type: 'guest-message', entityId: 'b-1' });

    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
    expect(keys.some((key) => key[0] === TOURIST_TAX_KEY)).toBe(false);
  });

  it('notificationKind_TouristTaxPaid_HasItsOwnSentenceInBothLanguages', () => {
    expect(notificationKind('tourist-tax-paid').textKey).toBe('notifications.types.touristTaxPaid');
    expect(i18n.getFixedT('it')('notifications.types.touristTaxPaid')).toBe('Un ospite ha pagato online la tassa di soggiorno.');
    expect(i18n.getFixedT('en')('notifications.types.touristTaxPaid')).toBe('A guest paid the tourist tax online.');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { alloggiatiApi } from '@/api/alloggiati.api';
import {
  completeCheckoutWizard,
  confirmPropertyReady,
  fetchCheckoutWizard,
  saveCheckoutProgress,
  startCheckoutWizard,
} from '@/api/compliance.api';
import { fetchServiceRequests, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { NOON_UTC, freezeClock } from '@/test/clock';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';
import type { Booking } from '@/types';
import type { CheckoutWizardState } from '@/types/compliance.types';
import { CheckoutWizardPage } from '../checkout-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getById: vi.fn() } }));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));
vi.mock('@/api/compliance.api', () => ({
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
  saveCheckoutProgress: vi.fn(),
  fetchCheckoutWizard: vi.fn(),
  confirmPropertyReady: vi.fn(),
}));
vi.mock('@/api/service-requests.api', () => ({
  fetchServiceRequests: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
}));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn() }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'c0c1d2e3-0000-4000-8000-000000000008';
const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000aa';
const SUPPLIER_ID = 'c0c1d2e3-0000-4000-8000-0000000000bb';

// Clock fixed at noon of 24/09/2026 in Rome: the stay 22/09 → 24/09 departs today.
const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: BOOKING_ID,
  propertyId: PROPERTY_ID,
  userId: 'auth0|host',
  checkInDate: '2026-09-22T00:00:00Z',
  checkOutDate: '2026-09-24T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 300,
  currency: 'EUR',
  status: 'CheckedIn',
  source: 'Manual',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  ...overrides,
});

/** `checkout-wizard/start` as the API answers it (CO-17). */
function wizardState(overrides: Partial<CheckoutWizardState> = {}): CheckoutWizardState {
  return {
    bookingId: BOOKING_ID,
    bookingStatus: 'CheckedIn',
    currentStep: 'stay-summary',
    startedAt: '2026-09-24T09:00:00Z',
    completedAt: null,
    steps: [],
    stay: {
      guestName: 'Mario Rossi',
      propertyId: PROPERTY_ID,
      propertyName: 'Villa Aurora',
      propertyCity: 'Roma',
      checkInDate: '2026-09-22T00:00:00Z',
      checkOutDate: '2026-09-24T00:00:00Z',
      nights: 2,
      numberOfGuests: 2,
      numberOfAdults: 2,
      numberOfChildren: 0,
      arrivedAt: null,
      source: 'Manual',
      departureConfirmed: false,
    },
    alloggiati: {
      status: 'DaInviareManualmente',
      sent: false,
      deadlineAt: '2026-09-22T22:00:00Z',
      isOverdue: true,
      dataComplete: true,
    },
    cleaning: { choice: null, supplierOrgId: null, category: null, notes: null, requestId: null },
    touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: null },
    propertyReady: { ready: null, readyAt: null, notes: null },
    ...overrides,
  };
}

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function renderPage(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}/checkout${search}`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id/checkout', element: createElement(CheckoutWizardPage) }),
            createElement(Route, {
              path: '/app/short-rent/bookings/:id',
              element: createElement('div', { 'data-testid': 'booking-detail-stub' }),
            }),
          )))),
  );
}

const next = () => fireEvent.click(screen.getByTestId('checkout-step-next'));

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', step), WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: true } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
  vi.mocked(startCheckoutWizard).mockResolvedValue(wizardState());
  vi.mocked(saveCheckoutProgress).mockImplementation(async (_id, command) =>
    wizardState({ currentStep: command.currentStep }),
  );
  vi.mocked(completeCheckoutWizard).mockResolvedValue({
    propertyReady: true,
    bookingStatus: 'CheckedOut',
    serviceRequestId: 'sr-1',
    wizard: wizardState({ bookingStatus: 'CheckedOut' }),
  });
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'maintenance']);
  vi.mocked(fetchServiceRequests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  vi.mocked(fetchSuppliersByProperty).mockResolvedValue({
    items: [
      {
        orgId: SUPPLIER_ID,
        legalName: 'Pulizie Roma Srl',
        phone: '',
        email: 'pulizie@example.com',
        categories: ['cleaning'],
        comuni: ['Roma'],
        photoUrls: [],
      },
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CheckoutWizardPage (CO-17, A5-24)', { timeout: 30000 }, () => {
  it('CheckoutWizardPage_CheckedInStay_WalksTheFiveStepsAndCompletesWithTheAnswers', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();

    // 1. Stay summary: nothing moves on until the host confirms the departure, and the page says what is missing.
    await onStep('stay-summary');
    expect(screen.getByTestId('checkout-stay-property')).toHaveTextContent('Villa Aurora');
    expect(screen.getByTestId('checkout-step-next')).toBeEnabled();
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.errors.confirmDeparture'),
    );
    await onStep('stay-summary');
    fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
    next();

    // 2. Alloggiati: still to send, shown with the link, never blocking.
    await onStep('alloggiati');
    expect(screen.getByTestId('checkout-alloggiati-to-send')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-alloggiati-link')).toHaveAttribute(
      'href',
      `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
    );
    next();

    // 3. Cleaning: a supplier of the property's comune for the category.
    await onStep('cleaning');
    expect(await screen.findByTestId('checkout-cleaning-existing-empty', undefined, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkout-cleaning-request'));
    // A request needs its supplier: the step does not close without one.
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.errors.cleaningSupplier'),
    );
    await onStep('cleaning');
    fireEvent.change(await screen.findByTestId('checkout-cleaning-supplier', undefined, WAIT), {
      target: { value: SUPPLIER_ID },
    });
    expect(fetchSuppliersByProperty).toHaveBeenCalledWith(PROPERTY_ID, 'cleaning');
    fireEvent.change(screen.getByLabelText(i18n.t('compliance.checkout.serviceNotes')), {
      target: { value: 'Cambio biancheria' },
    });
    next();

    // 4. Tourist tax: the amount recorded with the booking, collected at the property.
    await onStep('tourist-tax');
    expect(screen.getByTestId('checkout-tourist-tax-amount')).toHaveTextContent('12,00');
    fireEvent.click(screen.getByTestId('checkout-tourist-tax-CollectedAtProperty'));
    next();

    // 5. Property ready, with notes, then the stay is closed.
    await onStep('property-ready');
    // The last button checks the step too, and what the host answered before is in the summary, each answer with its link.
    fireEvent.click(screen.getByTestId('checkout-complete-button'));
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.errors.propertyReady'),
    );
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
    const summary = screen.getByTestId('checkout-summary');
    expect(within(summary).getByText(i18n.t('compliance.checkout.summary.cleaningRequest'))).toBeInTheDocument();
    expect(within(summary).getByText(i18n.t('compliance.checkout.touristTax.collection.CollectedAtProperty'))).toBeInTheDocument();
    expect(within(summary).getAllByRole('link', { name: /^Modifica / })).toHaveLength(3);
    fireEvent.click(screen.getByTestId('checkout-property-ready-yes'));
    fireEvent.change(screen.getByTestId('checkout-property-notes'), { target: { value: 'Tutto in ordine' } });
    fireEvent.click(screen.getByTestId('checkout-complete-button'));

    await waitFor(() =>
      expect(completeCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID, {
        confirmDeparture: true,
        cleaningChoice: 'Request',
        supplierOrgId: SUPPLIER_ID,
        serviceCategory: 'cleaning',
        serviceNotes: 'Cambio biancheria',
        touristTaxCollection: 'CollectedAtProperty',
        propertyReady: true,
        propertyNotes: 'Tutto in ordine',
      }),
    );
    // Same path as the app and POST /check-out: start first, then complete.
    expect(startCheckoutWizard).toHaveBeenCalledTimes(1);
    expect(startCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID);
    expect(vi.mocked(startCheckoutWizard).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(completeCheckoutWizard).mock.invocationCallOrder[0],
    );
    // The stay is closed: the wizard says what happens now, with two ways on, and nothing is left in the draft.
    expect(
      await screen.findByRole('heading', { level: 2, name: i18n.t('compliance.checkout.done.title') }, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: i18n.t('wizard.done.whatNext') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('compliance.checkout.done.cleaningRequested'))).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}`);
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/compliance');
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', 'fatto');
    expect(sessionStorage.length).toBe(0);
  });

  it('CheckoutWizardPage_MovingBetweenSteps_SavesTheProgressOnTheServer', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();
    await onStep('stay-summary');
    fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
    next();
    await onStep('alloggiati');

    await waitFor(() =>
      expect(saveCheckoutProgress).toHaveBeenCalledWith(
        BOOKING_ID,
        expect.objectContaining({ currentStep: 'alloggiati', departureConfirmed: true, cleaningChoice: null }),
      ),
    );

    fireEvent.click(screen.getByTestId('checkout-step-back'));
    await onStep('stay-summary');
    await waitFor(() =>
      expect(saveCheckoutProgress).toHaveBeenLastCalledWith(
        BOOKING_ID,
        expect.objectContaining({ currentStep: 'stay-summary', departureConfirmed: true }),
      ),
    );
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_SavedProgress_ReopensOnTheSavedStepWithTheAnswers', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'tourist-tax',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
      }),
    );

    renderPage();

    await onStep('tourist-tax');
    // The steps behind the one on screen can be opened again; the ones ahead cannot (the answers they depend on are not given yet).
    const progress = screen.getByRole('list', { name: i18n.t('ui.stepper.label') });
    expect(within(progress).getByRole('button', { name: /Soggiorno/ })).toBeInTheDocument();
    expect(within(progress).getByRole('button', { name: /Pulizie/ })).toBeInTheDocument();
    expect(within(progress).queryByRole('button', { name: /Imposta/ })).not.toBeInTheDocument();
    expect(within(progress).queryByRole('button', { name: /Proprietà/ })).not.toBeInTheDocument();
    expect(within(progress).getByText(/Imposta/).closest('[aria-current]')).toHaveAttribute('aria-current', 'step');

    fireEvent.click(within(progress).getByRole('button', { name: /Pulizie/ }));
    await onStep('cleaning');
    expect(screen.getByTestId('checkout-cleaning-skip')).toBeChecked();
  });

  it('CheckoutWizardPage_SkipCleaningPaidOnlineNotReady_CompletesWithSkipAndPropertyNotReady', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'cleaning',
        stay: { ...wizardState().stay, departureConfirmed: true },
        touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: true, collection: null },
      }),
    );
    vi.mocked(completeCheckoutWizard).mockResolvedValue({
      propertyReady: false,
      bookingStatus: 'CheckedOut',
      serviceRequestId: null,
      wizard: wizardState({ bookingStatus: 'CheckedOut' }),
    });

    renderPage();

    await onStep('cleaning');
    fireEvent.click(screen.getByTestId('checkout-cleaning-skip'));
    next();
    // Paid online on the booking site: "online" is proposed, the host confirms it by moving on.
    await onStep('tourist-tax');
    expect(screen.getByTestId('checkout-tourist-tax-paid-online')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-tourist-tax-CollectedOnline')).toBeChecked();
    next();
    await onStep('property-ready');
    fireEvent.click(screen.getByTestId('checkout-property-ready-no'));
    fireEvent.click(screen.getByTestId('checkout-complete-button'));

    await waitFor(() =>
      expect(completeCheckoutWizard).toHaveBeenCalledWith(
        BOOKING_ID,
        expect.objectContaining({
          cleaningChoice: 'Skip',
          supplierOrgId: null,
          touristTaxCollection: 'CollectedOnline',
          propertyReady: false,
        }),
      ),
    );
    // Not ready and no cleaning asked: what is still up to the host is said, never a promise that was not made.
    expect(await screen.findByText(i18n.t('compliance.checkout.done.propertyNotReady'), undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByText(i18n.t('compliance.checkout.done.alloggiatiToSend'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('compliance.checkout.done.cleaningRequested'))).not.toBeInTheDocument();
  });

  it('CheckoutWizardPage_NoTaxAmountRecorded_SaysSoInsteadOfInventingOne', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Airbnb' }));
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'tourist-tax',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
        touristTax: { recordedAmount: null, currency: 'EUR', collectedWithOnlinePayment: false, collection: null },
      }),
    );

    renderPage();

    await onStep('tourist-tax');
    expect(screen.getByTestId('checkout-tourist-tax-unknown')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-tourist-tax-amount')).not.toBeInTheDocument();
    // The host has to say how it was collected, whatever the amount: the step does not close without it.
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.errors.taxCollection'),
    );
    await onStep('tourist-tax');
  });

  it('CheckoutWizardPage_CompleteRejected_ShowsTheTranslatedApiError', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'property-ready',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
        touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'NotDue' },
        propertyReady: { ready: true, readyAt: null, notes: null },
      }),
    );
    vi.mocked(completeCheckoutWizard).mockRejectedValue(
      axiosError(409, { status: 409, code: 'checkout_wizard_not_started', detail: 'Non avviato.' }),
    );

    renderPage();

    await onStep('property-ready');
    fireEvent.click(screen.getByTestId('checkout-complete-button'));

    expect(await screen.findByTestId('checkout-complete-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.checkoutWizardNotStarted'),
    );
    // Still on the last step, with its answers, and able to try again: no confirmation of something that did not happen.
    await onStep('property-ready');
    expect(screen.queryByRole('heading', { name: i18n.t('compliance.checkout.done.title') })).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-complete-button')).toBeEnabled();
  });

  it('CheckoutWizardPage_ProgressNotSaved_ShowsTheErrorAndKeepsTheAnswers', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(saveCheckoutProgress).mockRejectedValue(
      axiosError(409, { status: 409, code: 'booking_already_checked_out', detail: 'Già chiuso.' }),
    );

    renderPage();
    await onStep('stay-summary');
    fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
    next();

    expect(await screen.findByTestId('checkout-progress-error', undefined, WAIT)).toBeInTheDocument();
    await onStep('alloggiati');
  });

  it('CheckoutWizardPage_ConfirmedWithoutArrival_RegistersTheArrivalAndOpensTheWizard', async () => {
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(booking({ status: 'Confirmed' }))
      .mockResolvedValue(booking({ status: 'CheckedIn' }));
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: false } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);

    renderPage();

    // Not a dead end: the arrival can be confirmed here, with the missing guest data flagged but not blocking.
    expect(await screen.findByTestId('checkout-arrival-missing', undefined, WAIT)).toBeInTheDocument();
    expect(await screen.findByTestId('guest-data-incomplete', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-wizard-form')).not.toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('checkout-register-arrival'));

    await onStep('stay-summary');
    expect(startCheckoutWizard).toHaveBeenCalledTimes(1);
    expect(startCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID, { registerArrival: true });
  });

  it('CheckoutWizardPage_StartRejected_ShowsTheApiErrorAndNoForm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(startCheckoutWizard).mockRejectedValue(
      axiosError(422, { status: 422, code: 'booking_checkout_too_early', detail: 'Troppo presto.' }),
    );

    renderPage();

    expect(await screen.findByRole('alert', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingCheckoutTooEarly'),
    );
    expect(screen.queryByTestId('checkout-wizard-form')).not.toBeInTheDocument();
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_ConfirmedBookingBeforeItsCheckInDay_IsUnavailable', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: '2026-09-26T00:00:00Z', checkOutDate: '2026-09-28T00:00:00Z' }),
    );

    renderPage();

    expect(await screen.findByTestId('checkout-unavailable', undefined, WAIT)).toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_CheckedOutPropertyNotReady_DeclaresThePropertyReady', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'CheckedOut' }));
    const closed = wizardState({
      bookingStatus: 'CheckedOut',
      currentStep: 'property-ready',
      completedAt: '2026-09-24T10:00:00Z',
      cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
      touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'CollectedAtProperty' },
      propertyReady: { ready: false, readyAt: null, notes: null },
    });
    vi.mocked(fetchCheckoutWizard).mockResolvedValue(closed);
    vi.mocked(confirmPropertyReady).mockResolvedValue({
      ...closed,
      propertyReady: { ready: true, readyAt: '2026-09-24T11:00:00Z', notes: 'Pulita' },
    });

    renderPage();

    expect(await screen.findByTestId('checkout-already-done', undefined, WAIT)).toBeInTheDocument();
    expect(await screen.findByTestId('checkout-closed-cleaning', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.closed.cleaningSkipped'),
    );
    expect(screen.getByTestId('checkout-closed-tourist-tax')).toHaveTextContent(
      i18n.t('compliance.checkout.touristTax.collection.CollectedAtProperty'),
    );
    fireEvent.change(screen.getByLabelText(i18n.t('compliance.checkout.propertyReady.notes')), {
      target: { value: 'Pulita' },
    });
    fireEvent.click(screen.getByTestId('checkout-confirm-property-ready'));

    await waitFor(() => expect(confirmPropertyReady).toHaveBeenCalledWith(BOOKING_ID, 'Pulita'));
    expect(await screen.findByTestId('checkout-closed-property-ready', undefined, WAIT)).toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_CheckedOutSummaryFails_ShowsTheErrorNotAnEmptySummary', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'CheckedOut' }));
    vi.mocked(fetchCheckoutWizard).mockRejectedValue(axiosError(500, { status: 500 }));

    renderPage();

    expect(await screen.findByTestId('checkout-closed-error', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-closed-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkout-confirm-property-ready')).not.toBeInTheDocument();
  });
});

describe('CheckoutWizardPage as a WizardShell', { timeout: 30000 }, () => {
  const settleDraft = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 450))));

  it('CheckoutWizardPage_AddressWithAStep_OpensThatStepWhateverTheServerSays', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage('?step=tourist-tax');

    await onStep('tourist-tax');
    expect(screen.getByTestId('checkout-tourist-tax-amount')).toBeInTheDocument();
  });

  it('CheckoutWizardPage_Reload_GivesBackTheNotesAndOffersToResumeFromTheStepReached', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    // The host goes on to the last step and types a note...
    const first = renderPage();
    await onStep('stay-summary');
    fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
    next();
    await onStep('alloggiati');
    next();
    await onStep('cleaning');
    fireEvent.click(screen.getByTestId('checkout-cleaning-skip'));
    next();
    await onStep('tourist-tax');
    fireEvent.click(screen.getByTestId('checkout-tourist-tax-CollectedAtProperty'));
    next();
    await onStep('property-ready');
    fireEvent.change(screen.getByTestId('checkout-property-notes'), { target: { value: 'Chiavi nella cassetta' } });
    await settleDraft();
    first.unmount();

    // ...and reloads the page: the server opens the first step (it answers with its own start), the draft remembers the rest.
    renderPage();
    await onStep('stay-summary');
    const banner = await screen.findByTestId('wizard-draft-banner', undefined, WAIT);
    expect(banner).toHaveTextContent('Eri arrivato al passo 5 di 5');
    expect(screen.getByTestId('checkout-confirm-departure')).toBeChecked();

    fireEvent.click(screen.getByTestId('wizard-draft-resume'));

    await onStep('property-ready');
    expect(screen.getByTestId('checkout-property-notes')).toHaveValue('Chiavi nella cassetta');
  });

  it('CheckoutWizardPage_ServerAheadOfTheDraft_IgnoresTheOlderDraftAndKeepsTheAnswersOfTheServer', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    // The host answered the first steps on the web a while ago (draft at the second step) and went on in the app (server at the fourth).
    const owner = { userId: 'user-1', orgId: 'org-1' };
    writeWizardDraft(
      `checkout-${BOOKING_ID}`,
      owner,
      { step: 'alloggiati', values: { departureConfirmed: false, cleaningChoice: null, touristTaxCollection: null, propertyNotes: 'vecchia nota' } },
    );
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'tourist-tax',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
        propertyReady: { ready: true, readyAt: null, notes: 'nota di oggi' },
      }),
    );

    renderPage();

    await onStep('tourist-tax');
    expect(screen.queryByTestId('wizard-draft-banner')).not.toBeInTheDocument();
    // The old draft is gone, not waiting to come back.
    expect(readWizardDraft(`checkout-${BOOKING_ID}`, owner)).toBeNull();
    fireEvent.click(screen.getByTestId('checkout-tourist-tax-CollectedAtProperty'));
    next();
    await onStep('property-ready');
    // The notes and the answers are the server's, not the old draft's.
    expect(screen.getByTestId('checkout-property-notes')).toHaveValue('nota di oggi');
    expect(screen.getByTestId('checkout-property-ready-yes')).toBeChecked();
  });

  it('CheckoutWizardPage_StartOver_DropsTheDraftAndGoesBackToTheAnswersOfTheServer', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    const first = renderPage();
    await onStep('stay-summary');
    fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
    next();
    await onStep('alloggiati');
    await settleDraft();
    first.unmount();

    renderPage();
    await onStep('stay-summary');
    fireEvent.click(await screen.findByTestId('wizard-draft-restart', undefined, WAIT));

    await waitFor(() => expect(screen.queryByTestId('wizard-draft-banner')).not.toBeInTheDocument());
    expect(screen.getByTestId('checkout-confirm-departure')).not.toBeChecked();
    expect(sessionStorage.length).toBe(0);
  });

  it('CheckoutWizardPage_StayClosedHere_KeepsTheConfirmationWhenTheBookingBecomesCheckedOut', async () => {
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(booking())
      .mockResolvedValue(booking({ status: 'CheckedOut' }));
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'property-ready',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
        touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'NotDue' },
        propertyReady: { ready: true, readyAt: null, notes: null },
      }),
    );
    vi.mocked(completeCheckoutWizard).mockResolvedValue({
      propertyReady: true,
      bookingStatus: 'CheckedOut',
      serviceRequestId: null,
      wizard: wizardState({ bookingStatus: 'CheckedOut' }),
    });

    renderPage();
    await onStep('property-ready');
    fireEvent.click(screen.getByTestId('checkout-complete-button'));

    await screen.findByRole('heading', { level: 2, name: i18n.t('compliance.checkout.done.title') }, WAIT);
    // The booking is checked out now (the page read it again), and the confirmation is still there, not the "already done" card.
    await waitFor(() => expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBeGreaterThan(1), WAIT);
    expect(screen.queryByTestId('checkout-already-done')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('compliance.checkout.done.propertyReady'))).toBeInTheDocument();
    // One way back to the booking, the one of the confirmation: the page does not repeat it.
    expect(screen.getAllByRole('link', { name: i18n.t('compliance.checkout.backToBooking') })).toHaveLength(1);
  });

  it('CheckoutWizardPage_ConfirmationAddressWithoutClosingAStay_StartsOverInsteadOfConfirmingNothing', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage('?step=fatto');

    await onStep('stay-summary');
    expect(screen.queryByRole('heading', { name: i18n.t('compliance.checkout.done.title') })).not.toBeInTheDocument();
  });

  it('CheckoutWizardPage_Steps_AreNamedByTheirTitleAndPurposeAndNextNamesTheStepAfter', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();

    await onStep('stay-summary');
    expect(screen.getByRole('heading', { level: 2, name: i18n.t('compliance.checkout.steps.stay-summary.title') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('compliance.checkout.steps.stay-summary.hint'))).toBeInTheDocument();
    expect(screen.getByTestId('checkout-step-next')).toHaveTextContent(
      `Continua: ${i18n.t('compliance.checkout.steps.alloggiati.label')}`,
    );
  });
});

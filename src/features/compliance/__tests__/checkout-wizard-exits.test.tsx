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
import { completeCheckoutWizard, fetchCheckoutWizard, saveCheckoutProgress, startCheckoutWizard } from '@/api/compliance.api';
import { fetchServiceRequests, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { Booking, BookingOctorateSync } from '@/types';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';
import type { CheckoutWizardState } from '@/types/compliance.types';
import { CheckoutWizardPage } from '../checkout-wizard';

/** What the check-out wizard mounts for the guests' data: the editor of the check-in wizard, replaced by a stub that is driven through its own props. */
const guestsEditor = vi.hoisted(() => vi.fn());
vi.mock('@/features/checkin/wizard/steps/guests-step', () => ({
  GuestsEditor: (props: { bookingId: string }) => {
    guestsEditor(props);
    return createElement('div', { 'data-testid': 'guests-editor-stub' });
  },
}));

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
const BOOKING_ID = 'c0c1d2e3-0000-4000-8000-000000000009';
const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000ab';
const CHECKOUT_PATH = `/app/short-rent/bookings/${BOOKING_ID}/checkout`;

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
    alloggiati: { status: 'DaInviareManualmente', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: true, dataComplete: false },
    cleaning: { choice: null, supplierOrgId: null, category: null, notes: null, requestId: null },
    touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: null },
    propertyReady: { ready: null, readyAt: null, notes: null },
    ...overrides,
  };
}

/** `GET /bookings/:id/alloggiati/status` as the API answers it. */
function alloggiatiStatus(dataComplete: boolean): AlloggiatiStatusDto {
  return {
    bookingId: BOOKING_ID,
    status: 'DaInviareManualmente',
    confirmationNumber: null,
    errorCode: null,
    reportedAt: null,
    deadlineAt: '2026-09-22T22:00:00Z',
    isShortStay: false,
    hoursUntilDeadline: 0,
    isOverdue: true,
    dataComplete,
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

function renderPage(options: { connector?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const flags = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: options.connector ?? false };
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(FeatureFlagsContext.Provider, { value: { flags, isLoading: false } },
          createElement(MemoryRouter, { initialEntries: [CHECKOUT_PATH] },
            createElement(Routes, null,
              createElement(Route, { path: '/app/short-rent/bookings/:id/checkout', element: createElement(CheckoutWizardPage) }),
              createElement(Route, {
                path: '/app/short-rent/bookings/:id',
                element: createElement('div', { 'data-testid': 'booking-detail-stub' }),
              }),
            ))))),
  );
}

const next = () => fireEvent.click(screen.getByTestId('checkout-step-next'));
/** The props the panel gave the editor: the booking, and what the editor tells its owner (the stub has no form): something unsaved is typed, the guests were saved. */
const editorProps = () => guestsEditor.mock.lastCall![0] as { bookingId: string; onDirtyChange: (dirty: boolean) => void; onSaved: (state: unknown) => void };

/**
 * Lets React finish what it still has to do for the last render: the wizard learns which step's rules apply from an effect of the render, and a click made
 * before that effect has run is checked against the rules of the step before (the failure that `checkout-wizard.test.tsx` settles the same way).
 */
const settle = () => act(async () => undefined);

/** The wizard is on `step`, settled there, with its main button ready: only then does a click get the rules of that step. */
async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', step), WAIT);
  await settle();
  await waitFor(() => expect(screen.getByTestId(/^checkout-(step-next|complete-button)$/)).toBeEnabled(), WAIT);
}

/** Walks to the Alloggiati step with the departure confirmed. */
async function goToAlloggiati() {
  await onStep('stay-summary');
  fireEvent.click(screen.getByTestId('checkout-confirm-departure'));
  next();
  await onStep('alloggiati');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
  vi.mocked(alloggiatiApi.getStatus).mockResolvedValue(alloggiatiStatus(false));
  vi.mocked(startCheckoutWizard).mockResolvedValue(wizardState());
  vi.mocked(saveCheckoutProgress).mockImplementation(async (_id, command) => wizardState({ currentStep: command.currentStep }));
  vi.mocked(completeCheckoutWizard).mockResolvedValue({
    propertyReady: true,
    bookingStatus: 'CheckedOut',
    serviceRequestId: null,
    wizard: wizardState({ bookingStatus: 'CheckedOut' }),
  });
  vi.mocked(fetchCheckoutWizard).mockResolvedValue(wizardState());
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning']);
  vi.mocked(fetchServiceRequests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Checkout wizard without exits (E08/F04/US01)', { timeout: 30000 }, () => {
  it('CheckoutWizardPage_OpenWizard_HasNoLinkToAnotherPageAndNoBackToBooking', async () => {
    renderPage();
    await goToAlloggiati();

    // The guest-data link of the Alloggiati step is a button that opens a panel: nothing in the page goes to another address.
    expect(screen.queryByTestId('checkout-alloggiati-link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-alloggiati-complete').tagName).toBe('BUTTON');
    expect(screen.getByTestId('checkout-save-exit')).toBeInTheDocument();
  });

  it('CheckoutWizardPage_CompleteTheGuestsData_OpensAPanelOverTheWizardWithTheSharedEditor', async () => {
    renderPage();
    await goToAlloggiati();

    fireEvent.click(screen.getByTestId('checkout-alloggiati-complete'));

    const panel = await screen.findByTestId('checkout-guest-data-subflow', undefined, WAIT);
    expect(within(panel).getByTestId('guests-editor-stub')).toBeInTheDocument();
    // The guests editor of the check-in wizard, for this booking: one component, not a copy.
    expect(editorProps().bookingId).toBe(BOOKING_ID);
    // The host is still in the wizard, on the same step.
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', 'alloggiati');
  });

  it('CheckoutWizardPage_CancelThePanel_GivesBackTheSameStepWithTheAnswersIntact', async () => {
    renderPage();
    await goToAlloggiati();
    fireEvent.click(screen.getByTestId('checkout-alloggiati-complete'));
    await screen.findByTestId('checkout-guest-data-subflow', undefined, WAIT);

    fireEvent.click(screen.getByTestId('checkout-guest-data-cancel'));

    await waitFor(() => expect(screen.queryByTestId('checkout-guest-data-subflow')).not.toBeInTheDocument());
    expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', 'alloggiati');
    fireEvent.click(screen.getByTestId('checkout-step-back'));
    await onStep('stay-summary');
    expect(screen.getByTestId('checkout-confirm-departure')).toBeChecked();
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_DoneWithSomethingTypedAndNotSaved_StaysOpenAndSaysSo', async () => {
    renderPage();
    await goToAlloggiati();
    fireEvent.click(screen.getByTestId('checkout-alloggiati-complete'));
    await screen.findByTestId('checkout-guest-data-subflow', undefined, WAIT);

    act(() => editorProps().onDirtyChange(true));
    fireEvent.click(screen.getByTestId('checkout-guest-data-done'));

    expect(await screen.findByTestId('checkout-guest-data-unsaved', undefined, WAIT)).toHaveTextContent(
      i18n.t('compliance.checkout.guestData.unsaved'),
    );
    expect(screen.getByTestId('checkout-guest-data-subflow')).toBeInTheDocument();
  });

  it('CheckoutWizardPage_DoneAfterSaving_ReadsTheAlloggiatiStatusAgainAndTheStepShowsTheNewState', async () => {
    renderPage();
    await goToAlloggiati();
    // The data of the guests are incomplete as the wizard opened.
    expect(await screen.findByText(i18n.t('compliance.checkout.alloggiati.dataIncomplete'), undefined, WAIT)).toBeInTheDocument();
    const readsBefore = vi.mocked(alloggiatiApi.getStatus).mock.calls.length;

    fireEvent.click(screen.getByTestId('checkout-alloggiati-complete'));
    await screen.findByTestId('checkout-guest-data-subflow', undefined, WAIT);
    // The guests are saved through the editor (its own "Save guests"), and the server now says the data are complete.
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue(alloggiatiStatus(true));
    act(() => editorProps().onSaved({}));
    expect(await screen.findByTestId('checkout-guest-data-saved', undefined, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkout-guest-data-done'));

    await waitFor(() => expect(screen.queryByTestId('checkout-guest-data-subflow')).not.toBeInTheDocument());
    await waitFor(() => expect(vi.mocked(alloggiatiApi.getStatus).mock.calls.length).toBeGreaterThan(readsBefore), WAIT);
    await waitFor(() => expect(screen.queryByText(i18n.t('compliance.checkout.alloggiati.dataIncomplete'))).not.toBeInTheDocument(), WAIT);
    expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', 'alloggiati');
  });

  it('CheckoutWizardPage_SaveAndExit_SavesTheProgressOnTheStepAndOnlyThenLeaves', async () => {
    renderPage();
    await goToAlloggiati();
    await waitFor(() => expect(saveCheckoutProgress).toHaveBeenCalledTimes(1));
    let finishSaving: (state: CheckoutWizardState) => void = () => undefined;
    vi.mocked(saveCheckoutProgress).mockImplementationOnce(() => new Promise<CheckoutWizardState>((resolve) => { finishSaving = resolve; }));

    fireEvent.click(screen.getByTestId('checkout-save-exit'));

    // The save is on its way: the host has not left, and the button does not take a second press.
    await waitFor(() => expect(saveCheckoutProgress).toHaveBeenCalledTimes(2));
    expect(saveCheckoutProgress).toHaveBeenLastCalledWith(
      BOOKING_ID,
      expect.objectContaining({ currentStep: 'alloggiati', departureConfirmed: true }),
    );
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-save-exit')).toBeDisabled();
    // Nothing else of the wizard takes a press meanwhile.
    expect(screen.getByTestId('checkout-step-next')).toBeDisabled();

    await act(async () => finishSaving(wizardState({ currentStep: 'alloggiati' })));

    expect(await screen.findByTestId('booking-detail-stub', undefined, WAIT)).toBeInTheDocument();
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_SaveAndExitNotSaved_StaysWithTheReasonAndTheAnswers', async () => {
    renderPage();
    await goToAlloggiati();
    await waitFor(() => expect(saveCheckoutProgress).toHaveBeenCalledTimes(1));
    vi.mocked(saveCheckoutProgress).mockRejectedValueOnce(axiosError(409, { status: 409, code: 'booking_already_checked_out', detail: 'Già chiuso.' }));

    fireEvent.click(screen.getByTestId('checkout-save-exit'));

    expect(await screen.findByTestId('checkout-progress-error', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-wizard-form')).toHaveAttribute('data-step', 'alloggiati');
    expect(screen.getByTestId('checkout-save-exit')).toBeEnabled();
    expect(screen.getByTestId('checkout-step-next')).toBeEnabled();
    fireEvent.click(screen.getByTestId('checkout-step-back'));
    await onStep('stay-summary');
    expect(screen.getByTestId('checkout-confirm-departure')).toBeChecked();
  });

  it('CheckoutWizardPage_ArrivalNotRegistered_CompletesTheGuestsDataInThePanelNotOnAnotherPage', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Confirmed' }));
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: false } as AlloggiatiStatusDto);

    renderPage();

    expect(await screen.findByTestId('guest-data-incomplete', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('guest-data-complete-link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('guest-data-complete-open'));

    const panel = await screen.findByTestId('checkout-guest-data-subflow', undefined, WAIT);
    expect(within(panel).getByTestId('guests-editor-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkout-guest-data-cancel'));
    await waitFor(() => expect(screen.queryByTestId('checkout-guest-data-subflow')).not.toBeInTheDocument());
    expect(screen.getByTestId('checkout-arrival-missing')).toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();
  });
});

describe('The result of the check-out and the channel manager (E08/F04/US01)', { timeout: 30000 }, () => {
  const MIRROR: BookingOctorateSync = { state: 'Synced', lastOperation: 'Create', lastSyncedAt: '2026-09-20T08:00:00Z', errorCode: null, canRetry: false };

  /** The wizard opens on its last step with every earlier answer given: only the readiness of the property and the closing are left. */
  async function closeTheStay() {
    vi.mocked(startCheckoutWizard).mockResolvedValue(
      wizardState({
        currentStep: 'property-ready',
        stay: { ...wizardState().stay, departureConfirmed: true },
        cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
        touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'CollectedAtProperty' },
      }),
    );
    renderPage({ connector: true });
    await onStep('property-ready');
    fireEvent.click(screen.getByTestId('checkout-property-ready-yes'));
    fireEvent.click(screen.getByTestId('checkout-complete-button'));
    expect(await screen.findByText(i18n.t('compliance.checkout.done.stayClosed'), undefined, WAIT)).toBeInTheDocument();
  }

  it('CheckoutWizardPage_ClosedStayThatIsOnTheChannelManager_ResultHasTheOneNeutralLine', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: MIRROR }));

    await closeTheStay();

    expect(screen.getByText(i18n.t('compliance.checkout.done.channelManager.automatic'))).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-done-channel-manager')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /riprova|controlla di nuovo/i })).not.toBeInTheDocument();
  });

  it.each(['Pending', 'Failed', 'Conflict', 'NotAllowedByChannel'] as const)(
    'CheckoutWizardPage_ClosedStayWhoseMirrorIs%s_ResultSaysNothingAboutTheChannelManager',
    async (state) => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: { ...MIRROR, state, errorCode: 'octorate_unavailable', canRetry: true } }));

      await closeTheStay();

      expect(screen.queryByText(/channel manager/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /riprova|controlla di nuovo/i })).not.toBeInTheDocument();
    },
  );

  it('CheckoutWizardPage_ClosedStayThatIsNotOnTheChannelManager_ResultSaysNothingAboutIt', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: null }));

    await closeTheStay();

    expect(screen.queryByText(/channel manager/i)).not.toBeInTheDocument();
  });
});

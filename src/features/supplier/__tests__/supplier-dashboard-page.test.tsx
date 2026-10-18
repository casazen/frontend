import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { ActivationStatus, SupplierChecklist, SupplierDashboard, SupplierInboxCounts, SupplierOverview, SupplierToday } from '@/types/supplier';
import { SupplierDashboardPage } from '../supplier-dashboard-page';

const api = vi.hoisted(() => ({
  fetchSupplierDashboard: vi.fn(),
  fetchSupplierActivation: vi.fn(),
  fetchSupplierToday: vi.fn(),
  fetchSupplierOverview: vi.fn(),
  fetchSupplierChecklist: vi.fn(),
  fetchSupplierInboxCounts: vi.fn(),
  fetchSupplierProfile: vi.fn(),
}));
const requestsApi = vi.hoisted(() => ({ takeServiceRequest: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  ...requestsApi,
}));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { firstName: 'Marco' } }),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, primary }: { title: string; description?: string; primary?: { label: string; to?: string; testId?: string } }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      createElement('p', { 'data-testid': 'home-purpose' }, description),
      primary?.to ? createElement('a', { href: primary.to, 'data-testid': primary.testId }, primary.label) : null,
    ),
}));

const DASHBOARD: SupplierDashboard = {
  profileCompletionPercent: 100,
  status: 'Active',
  availabilityRate: 0.5,
  calendarSyncStatus: { calendarSyncType: 'None' },
  lastUpdated: '2026-10-16T08:00:00Z',
};

const ACTIVATION: ActivationStatus = {
  status: 'Active',
  currentStep: 5,
  steps: [],
  tos: { currentVersion: '2026-10-v1', acceptedVersion: '2026-10-v1', acceptedAt: '2026-10-01T08:00:00Z', reacceptanceRequired: false, blocksActions: false },
};

const NEW_REQUEST: SupplierServiceRequest = {
  id: 'r-new',
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  phase: 'to_answer',
  category: 'cleaning',
  serviceName: 'Pulizia di fondo',
  urgency: 'Normal',
  createdAt: '2026-10-15T08:00:00Z',
  updatedAt: '2026-10-15T08:00:00Z',
  city: 'Roma',
  scheduledFor: '2026-10-17',
  scheduledStart: '2026-10-17T08:00:00Z',
  scheduledEnd: '2026-10-17T10:00:00Z',
  contactDisclosed: false,
  clientName: 'Zen Stays',
  price: { amountCents: 8000 },
};

const JOB: SupplierServiceRequest = {
  ...NEW_REQUEST,
  id: 'r-job',
  status: 'PresoInCarico',
  phase: 'scheduled',
  serviceName: 'Cambio biancheria',
  propertyName: 'Casa Rossa',
  contactDisclosed: true,
  scheduledFor: '2026-10-16',
  scheduledStart: '2026-10-16T07:00:00Z',
  scheduledEnd: '2026-10-16T09:00:00Z',
};

const TODAY: SupplierToday = { date: '2026-10-16', days: 7, dateTo: '2026-10-22', jobs: [JOB], jobsTotal: 1, newRequests: [NEW_REQUEST], newRequestsTotal: 1 };
const NOTHING: SupplierToday = { date: '2026-10-16', days: 7, dateTo: '2026-10-22', jobs: [], jobsTotal: 0, newRequests: [], newRequestsTotal: 0 };

const FIGURES = { from: '2026-10-01', to: '2026-10-16', received: 10, accepted: 8, rejected: 2, acceptanceRate: 0.8, averageResponseMinutes: 45, completedJobs: 6, paidNetCents: 0 };
const OVERVIEW: SupplierOverview = {
  period: 'current-month',
  onlinePayments: false,
  current: FIGURES,
  previous: { ...FIGURES, acceptanceRate: 0.7, averageResponseMinutes: 60, completedJobs: 4 },
};

const CHECKLIST: SupplierChecklist = {
  profileCompletionPercent: 100,
  profileComplete: true,
  activeServices: 1,
  hoursConfigured: true,
  showcasePublished: true,
  firstRequestAnswered: true,
  paymentsActive: null,
};

const COUNTS: SupplierInboxCounts = { toAnswer: 1, awaitingCustomer: 0, scheduled: 1, toCollect: 0, archive: 0, paymentsLate: 0 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/supplier/dashboard']}>
          <SupplierDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SupplierDashboardPage (SP-08a)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.fetchSupplierDashboard.mockResolvedValue(DASHBOARD);
    api.fetchSupplierActivation.mockResolvedValue(ACTIVATION);
    api.fetchSupplierToday.mockResolvedValue(TODAY);
    api.fetchSupplierOverview.mockResolvedValue(OVERVIEW);
    api.fetchSupplierChecklist.mockResolvedValue(CHECKLIST);
    api.fetchSupplierInboxCounts.mockResolvedValue(COUNTS);
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Active' });
    requestsApi.takeServiceRequest.mockResolvedValue({});
    await i18n.changeLanguage('it');
  });

  it('SupplierDashboardPage_RequestAndJob_ShowsTheBlockOfTheDaysAndTakesTheRequestFromIt', async () => {
    renderPage();

    const block = within(await screen.findByTestId('supplier-today'));
    expect(await block.findByText('Pulizia di fondo')).toBeInTheDocument();
    expect(block.getByText('Casa Rossa')).toBeInTheDocument();
    expect(block.queryByTestId('take-r-job')).not.toBeInTheDocument();
    expect(api.fetchSupplierToday).toHaveBeenCalledWith(7);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Buongiorno, Marco');
    expect(screen.getByTestId('home-purpose')).toHaveTextContent('1 lavoro oggi, 1 richiesta da rispondere');
    expect(screen.getByTestId('supplier-home-urgent')).toHaveAttribute('href', '/app/supplier/inbox/r-new');

    fireEvent.click(block.getByTestId('take-r-new'));

    await waitFor(() => expect(requestsApi.takeServiceRequest).toHaveBeenCalledWith('r-new'));
  });

  it('SupplierDashboardPage_ThreeNumbers_ShowTheChangeAndAskTheServerForThePeriod', async () => {
    renderPage();

    const acceptance = await screen.findByTestId('supplier-kpi-acceptance');
    expect(acceptance).toHaveTextContent('80%');
    expect(acceptance).toHaveTextContent('+10 punti sul periodo prima');
    expect(screen.getByTestId('supplier-kpi-response')).toHaveTextContent('45 minuti');
    expect(screen.getByTestId('supplier-kpi-response')).toHaveTextContent('15 minuti più veloce del periodo prima');
    // No payments through CasaZen: the third number is the jobs completed, never "Incassi".
    expect(screen.getByTestId('supplier-kpi-third')).toHaveTextContent('Lavori completati');
    expect(screen.getByTestId('supplier-kpi-third')).toHaveTextContent('+2 sul periodo prima');
    expect(api.fetchSupplierOverview).toHaveBeenCalledWith('current-month');

    fireEvent.change(screen.getByTestId('supplier-kpi-period'), { target: { value: 'last-30-days' } });

    await waitFor(() => expect(api.fetchSupplierOverview).toHaveBeenCalledWith('last-30-days'));
  });

  it('SupplierDashboardPage_OneSectionFails_TheOthersStillShowAndItCanBeTriedAgain', async () => {
    api.fetchSupplierToday.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(TODAY);
    renderPage();

    const error = await screen.findByTestId('supplier-today-error');
    expect(await screen.findByTestId('supplier-kpi-acceptance')).toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('supplier-today')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-today-error')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_NothingToDoAndNotBegun_InvitesToSetTheAvailability', async () => {
    api.fetchSupplierToday.mockResolvedValue(NOTHING);
    api.fetchSupplierChecklist.mockResolvedValue({ ...CHECKLIST, profileComplete: false, activeServices: 0, hoursConfigured: false, showcasePublished: false, firstRequestAnswered: false });
    renderPage();

    const block = within(await screen.findByTestId('supplier-today'));
    expect(await block.findByText('Dì ai clienti quando lavori')).toBeInTheDocument();
    expect(block.getByRole('link', { name: 'Imposta la tua disponibilità' })).toHaveAttribute('href', '/app/supplier/availability');
    // The next step is the first one not done, with how far the checklist is.
    expect(await screen.findByTestId('supplier-next-step')).toHaveTextContent('0 di 5');
  });

  it('SupplierDashboardPage_NothingToDoAndBegun_SaysTheDayIsFreeAndHidesTheFinishedChecklist', async () => {
    api.fetchSupplierToday.mockResolvedValue(NOTHING);
    renderPage();

    expect(await within(await screen.findByTestId('supplier-today')).findByText('Giornata libera')).toBeInTheDocument();
    await screen.findByTestId('supplier-todo-clear');
    expect(screen.queryByTestId('supplier-next-step')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_PendingFreeEventsAndLatePayments_AreInTheListOfWhatWaits', async () => {
    api.fetchSupplierDashboard.mockResolvedValue({ ...DASHBOARD, calendarSyncStatus: { calendarSyncType: 'ICalFeed', pendingFreeEventsCount: 3 } });
    api.fetchSupplierInboxCounts.mockResolvedValue({ ...COUNTS, paymentsLate: 2 });
    renderPage();

    const events = await screen.findByTestId('supplier-todo-free-events');
    expect(events).toHaveTextContent('3 eventi del calendario da confermare');
    expect(within(events).getByRole('link')).toHaveAttribute('href', '/app/supplier/availability');
    const late = screen.getByTestId('supplier-todo-payments-late');
    expect(late).toHaveTextContent('2 pagamenti in ritardo');
    expect(within(late).getByRole('link')).toHaveAttribute('href', '/app/supplier/inbox?chip=da-incassare');
    expect(screen.queryByTestId('supplier-todo-clear')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_PendingSupplier_StillOffersTheActivation', async () => {
    api.fetchSupplierDashboard.mockResolvedValue({ ...DASHBOARD, status: 'Pending' });
    renderPage();

    const notice = await screen.findByTestId('supplier-activation-notice');
    expect(within(notice).getByRole('link', { name: i18n.t('supplier.goToActivation') })).toHaveAttribute('href', '/app/supplier/activation');
  });

  it('SupplierDashboardPage_OlderTermsAccepted_ShowsTheBlockingReacceptanceBanner', async () => {
    api.fetchSupplierActivation.mockResolvedValue({
      ...ACTIVATION,
      tos: { ...ACTIVATION.tos, acceptedVersion: '2025-01-v1', reacceptanceRequired: true, blocksActions: true },
    });
    renderPage();

    const banner = await screen.findByTestId('supplier-tos-reacceptance-banner');
    expect(banner).toHaveTextContent('Accetta la nuova versione dei Termini di Servizio');
    expect(banner).toHaveTextContent('non puoi prendere in carico, completare o rifiutare incarichi');
  });

  it('SupplierDashboardPage_TermsAcceptedBeforeVersionsWereRecorded_AsksWithoutSayingItBlocks', async () => {
    api.fetchSupplierActivation.mockResolvedValue({
      ...ACTIVATION,
      tos: { ...ACTIVATION.tos, acceptedVersion: null, reacceptanceRequired: true, blocksActions: false },
    });
    renderPage();

    const banner = await screen.findByTestId('supplier-tos-reacceptance-banner');
    expect(banner).not.toHaveTextContent('non puoi prendere in carico');
  });

  it('SupplierDashboardPage_CurrentTermsAccepted_ShowsNoBanner', async () => {
    renderPage();

    await screen.findByTestId('supplier-kpi-acceptance');
    expect(screen.queryByTestId('supplier-tos-reacceptance-banner')).not.toBeInTheDocument();
  });
});

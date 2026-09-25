import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierDashboard, SupplierKpis } from '@/types/supplier';
import { SupplierDashboardPage } from '../supplier-dashboard-page';

const api = vi.hoisted(() => ({
  fetchSupplierDashboard: vi.fn(),
  fetchSupplierKpis: vi.fn(),
}));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));

const DASHBOARD: SupplierDashboard = {
  profileCompletionPercent: 100,
  status: 'Active',
  availabilityRate: 0.5,
  calendarSyncStatus: { calendarSyncType: 'None' },
  lastUpdated: '2026-09-20T08:00:00Z',
};

const KPIS: SupplierKpis = {
  period: 'CurrentMonth',
  from: '2026-09-01',
  to: '2026-09-25',
  timeZone: 'Europe/Rome',
  completed: 5,
  rejected: 1,
  awaitingAcceptance: 2,
  upcoming: 3,
  totalRequests: 11,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SupplierDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function kpiValue(testId: string) {
  return within(screen.getByTestId(testId)).getByTestId(`${testId}-value`).textContent;
}

describe('SupplierDashboardPage (SU-11, A4-15)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.fetchSupplierDashboard.mockResolvedValue(DASHBOARD);
    api.fetchSupplierKpis.mockResolvedValue(KPIS);
    await i18n.changeLanguage('it');
  });

  it('SupplierDashboardPage_ServiceRequestKpis_ShowsTheCountsOfTheCurrentMonth', async () => {
    renderPage();

    await screen.findByTestId('supplier-kpi-completed');
    expect(kpiValue('supplier-kpi-completed')).toBe('5');
    expect(kpiValue('supplier-kpi-upcoming')).toBe('3');
    expect(kpiValue('supplier-kpi-awaiting')).toBe('2');
    expect(kpiValue('supplier-kpi-rejected')).toBe('1');
    expect(screen.getByTestId('supplier-kpis-range')).toHaveTextContent(
      'Dal 1 settembre 2026 al 25 settembre 2026 (ora italiana) · 11 richieste ricevute in totale',
    );
    expect(api.fetchSupplierKpis).toHaveBeenCalledWith('CurrentMonth');
  });

  it('SupplierDashboardPage_PeriodChanged_LoadsTheKpisOfThatPeriod', async () => {
    api.fetchSupplierKpis.mockImplementation(async (period: string) =>
      period === 'PreviousMonth'
        ? { ...KPIS, period, from: '2026-08-01', to: '2026-08-31', completed: 7, rejected: 0 }
        : KPIS,
    );
    renderPage();
    await screen.findByTestId('supplier-kpi-completed');

    fireEvent.change(screen.getByTestId('supplier-kpi-period'), { target: { value: 'PreviousMonth' } });

    await waitFor(() => expect(kpiValue('supplier-kpi-completed')).toBe('7'));
    expect(api.fetchSupplierKpis).toHaveBeenCalledWith('PreviousMonth');
    expect(kpiValue('supplier-kpi-rejected')).toBe('0');
    expect(screen.getByTestId('supplier-kpis-range')).toHaveTextContent('Dal 1 agosto 2026 al 31 agosto 2026');
  });

  it('SupplierDashboardPage_KpisLoading_ShowsSkeletonNotZeroes', async () => {
    api.fetchSupplierKpis.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByTestId('supplier-kpis-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-kpi-completed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('supplier-kpis-empty')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_KpisApiError_ShowsErrorWithRetryNotEmptyOrZeroes', async () => {
    api.fetchSupplierKpis.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(KPIS);
    renderPage();

    const error = await screen.findByTestId('supplier-kpis-error');
    expect(error).toHaveTextContent('Impossibile caricare gli indicatori degli incarichi.');
    expect(screen.queryByTestId('supplier-kpis-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('supplier-kpi-completed')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(kpiValue('supplier-kpi-completed')).toBe('5'));
  });

  it('SupplierDashboardPage_NoRequestEver_ShowsEmptyState', async () => {
    api.fetchSupplierKpis.mockResolvedValue({
      ...KPIS,
      completed: 0,
      rejected: 0,
      awaitingAcceptance: 0,
      upcoming: 0,
      totalRequests: 0,
    });
    renderPage();

    const empty = await screen.findByTestId('supplier-kpis-empty');
    expect(empty).toHaveTextContent('Non hai ancora ricevuto richieste dagli host.');
    expect(screen.queryByTestId('supplier-kpi-completed')).not.toBeInTheDocument();
    // Complete profile: no first steps to suggest.
    expect(screen.queryByTestId('supplier-getting-started')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_NoRequestAndIncompleteProfile_SuggestsTheFirstSteps', async () => {
    api.fetchSupplierDashboard.mockResolvedValue({ ...DASHBOARD, profileCompletionPercent: 40, status: 'Pending' });
    api.fetchSupplierKpis.mockResolvedValue({ ...KPIS, completed: 0, rejected: 0, awaitingAcceptance: 0, upcoming: 0, totalRequests: 0 });
    renderPage();

    expect(await screen.findByTestId('supplier-getting-started')).toHaveTextContent('Completa il profilo');
  });

  it('SupplierDashboardPage_DashboardApiError_ShowsErrorNotAnEmptyDashboard', async () => {
    api.fetchSupplierDashboard.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('supplier-dashboard-error')).toHaveTextContent(
      'Impossibile caricare la dashboard fornitore.',
    );
    expect(screen.queryByTestId('supplier-kpis')).not.toBeInTheDocument();
    expect(screen.queryByText('Attivo')).not.toBeInTheDocument();
  });

  it('SupplierDashboardPage_EnglishLocale_TranslatesTheKpis', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    await screen.findByTestId('supplier-kpi-completed');
    expect(screen.getByTestId('supplier-kpi-awaiting')).toHaveTextContent('Waiting to be taken');
    expect(screen.getByTestId('supplier-kpis-range')).toHaveTextContent('11 requests received in total');
  });
});

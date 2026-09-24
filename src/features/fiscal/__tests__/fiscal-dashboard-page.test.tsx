import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { fiscalApi, type FiscalRegimeSnapshot } from '@/api/fiscal.api';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';

vi.mock('@/api/fiscal.api', () => ({
  fiscalApi: { getRegime: vi.fn(), assignRegime: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const baseSnapshot: FiscalRegimeSnapshot = {
  taxYear: 2026,
  strPropertyCount: 1,
  requiresPartitaIva: false,
  hasPartitaIva: false,
  disclaimer: 'Raccomandazione informativa, non consulenza fiscale.',
  properties: [
    {
      propertyId: 'p-irpef',
      name: 'Casa IRPEF',
      recommendedRegime: 'CedolareSecca21',
      assignedRegime: 'IrpefOrdinaria',
      isPrimaryForCedolare: false,
      shortStayInTaxYear: true,
      taxpayerIndex: 0,
      cedolareRate: null,
      taxNote: 'irpef_ordinaria_not_computed',
    },
  ],
  maxShortStayApartmentsPerTaxpayer: 2,
  thresholdSource: 'art. 1 c. 595 L. 178/2020, modificato da art. 1 c. 17 L. 199/2025',
  taxpayers: [
    {
      index: 0,
      fiscalCodeMasked: null,
      isOrgTaxProfile: true,
      shortStayApartmentCount: 1,
      thresholdExceeded: false,
      reducedRatePropertyId: null,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(QueryClientProvider, { client }, createElement(FiscalDashboardPage)),
    ),
  );
}

describe('FiscalDashboardPage (CO-18)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('shows that IRPEF ordinaria is computed by the taxpayer or the accountant', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce(baseSnapshot);

    renderPage();

    expect(await screen.findByTestId('fiscal-tax-note-p-irpef')).toHaveTextContent(
      i18n.t('fiscal.taxNote.irpefOrdinariaNotComputed'),
    );
    expect(screen.queryByTestId('fiscal-piva-alert')).not.toBeInTheDocument();
  });

  it('warns per taxpayer with the configured threshold when one taxpayer is over it', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce({
      ...baseSnapshot,
      strPropertyCount: 3,
      requiresPartitaIva: true,
      properties: baseSnapshot.properties.map((p) => ({
        ...p,
        assignedRegime: null,
        recommendedRegime: null,
        taxNote: 'short_stay_threshold_exceeded' as const,
      })),
    });

    renderPage();

    const alert = await screen.findByTestId('fiscal-piva-alert');
    expect(alert).toHaveTextContent(i18n.t('fiscal.alert.piva', { max: 2 }));
    expect(alert).toHaveTextContent('più di 2 appartamenti');
    expect(screen.getByTestId('fiscal-tax-note-p-irpef')).toHaveTextContent(i18n.t('fiscal.taxNote.thresholdExceeded'));
  });

  it('shows the regimes with their translated labels, IRPEF ordinaria included', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce(baseSnapshot);

    renderPage();

    expect(await screen.findByTestId('fiscal-assigned-p-irpef')).toHaveTextContent(
      i18n.t('fiscal.regime.IrpefOrdinaria'),
    );
    expect(screen.getByTestId('fiscal-property-card-p-irpef')).toHaveTextContent(
      i18n.t('fiscal.regime.CedolareSecca21'),
    );
    expect(screen.queryByTestId('fiscal-choose-irpef-p-irpef')).not.toBeInTheDocument();
  });

  it('assigns IRPEF ordinaria without VAT number from the property card', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      properties: baseSnapshot.properties.map((p) => ({ ...p, assignedRegime: null, taxNote: null })),
    });
    vi.mocked(fiscalApi.assignRegime).mockResolvedValueOnce(baseSnapshot.properties[0]);

    renderPage();
    fireEvent.click(await screen.findByTestId('fiscal-choose-irpef-p-irpef'));

    await waitFor(() =>
      expect(fiscalApi.assignRegime).toHaveBeenCalledWith('p-irpef', {
        taxYear: expect.any(Number),
        regime: 'IrpefOrdinaria',
        isPrimaryForCedolare: undefined,
      }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('hides the IRPEF option over the threshold and shows the API problem when the assignment fails', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      properties: [
        ...baseSnapshot.properties.map((p) => ({
          ...p,
          assignedRegime: null,
          taxNote: 'short_stay_threshold_exceeded' as const,
        })),
        { ...baseSnapshot.properties[0], propertyId: 'p-free', name: 'Casa libera', assignedRegime: null, taxNote: null },
      ],
    });
    const problem = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { status: 409, code: 'fiscal_short_stay_threshold_exceeded', detail: 'Soglia superata per il titolare.' },
    });
    vi.mocked(fiscalApi.assignRegime).mockRejectedValueOnce(problem);

    renderPage();
    fireEvent.click(await screen.findByTestId('fiscal-choose-irpef-p-free'));

    expect(screen.queryByTestId('fiscal-choose-irpef-p-irpef')).not.toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Soglia superata per il titolare.'));
  });
});

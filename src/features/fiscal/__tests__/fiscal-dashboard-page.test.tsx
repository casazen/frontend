import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { fiscalApi, type FiscalPropertyRow, type FiscalRegimeSnapshot } from '@/api/fiscal.api';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';

vi.mock('@/api/fiscal.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal.api')>();
  return { ...actual, fiscalApi: { getRegime: vi.fn(), assignRegime: vi.fn() } };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const SHORT_RENTAL = ['CedolareSecca21', 'CedolareSecca26', 'IrpefOrdinaria'] as const;

const baseRow: FiscalPropertyRow = {
  propertyId: 'p-irpef',
  name: 'Casa IRPEF',
  recommendedRegime: 'CedolareSecca21',
  assignedRegime: 'IrpefOrdinaria',
  isPrimaryForCedolare: false,
  shortStayInTaxYear: true,
  taxpayerIndex: 0,
  cedolareRate: null,
  taxNote: 'irpef_ordinaria_not_computed',
  availableRegimes: [...SHORT_RENTAL],
};

const baseSnapshot: FiscalRegimeSnapshot = {
  taxYear: 2026,
  strPropertyCount: 1,
  requiresPartitaIva: false,
  hasPartitaIva: false,
  disclaimer: 'Raccomandazione informativa, non consulenza fiscale.',
  properties: [baseRow],
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

function problem(status: number, code: string, detail: string) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { status, code, detail },
  });
}

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

function optionOf(select: HTMLElement, value: string): HTMLOptionElement {
  return within(select).getAllByRole('option').find((o) => (o as HTMLOptionElement).value === value) as HTMLOptionElement;
}

describe('FiscalDashboardPage (CO-18, CO-19)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('FiscalDashboard_IrpefOrdinaria_ShowsThatTheTaxIsNotComputed', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce(baseSnapshot);

    renderPage();

    expect(await screen.findByTestId('fiscal-tax-note-p-irpef')).toHaveTextContent(
      i18n.t('fiscal.taxNote.irpefOrdinariaNotComputed'),
    );
    expect(screen.queryByTestId('fiscal-piva-alert')).not.toBeInTheDocument();
  });

  it('FiscalDashboard_TaxpayerOverThreshold_WarnsWithTheConfiguredMaximum', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce({
      ...baseSnapshot,
      strPropertyCount: 3,
      requiresPartitaIva: true,
      properties: [
        { ...baseRow, assignedRegime: null, recommendedRegime: null, taxNote: 'short_stay_threshold_exceeded', availableRegimes: [] },
      ],
    });

    renderPage();

    const alert = await screen.findByTestId('fiscal-piva-alert');
    expect(alert).toHaveTextContent(i18n.t('fiscal.alert.piva', { max: 2 }));
    expect(alert).toHaveTextContent('più di 2 appartamenti');
    expect(screen.getByTestId('fiscal-tax-note-p-irpef')).toHaveTextContent(i18n.t('fiscal.taxNote.thresholdExceeded'));
  });

  it('FiscalDashboard_OneProperty_OffersRegimeSelectAndThe21PercentDesignation', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      properties: [{ ...baseRow, assignedRegime: null, taxNote: null }],
    });
    vi.mocked(fiscalApi.assignRegime).mockResolvedValue({ ...baseRow, assignedRegime: 'CedolareSecca21' });

    renderPage();

    const select = await screen.findByTestId('fiscal-regime-select-p-irpef');
    expect(select).toBeEnabled();
    expect(screen.getByTestId('fiscal-assigned-p-irpef')).toHaveTextContent(i18n.t('fiscal.notAssigned'));
    // One apartment only: the 21% designation is still available (not only with exactly two properties).
    fireEvent.click(screen.getByTestId('fiscal-primary-p-irpef'));

    await waitFor(() =>
      expect(fiscalApi.assignRegime).toHaveBeenCalledWith('p-irpef', {
        taxYear: expect.any(Number),
        regime: 'CedolareSecca21',
        isPrimaryForCedolare: true,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('fiscal.assignSuccess')));
  });

  it('FiscalDashboard_SelectIrpefOrdinaria_AssignsItWithoutVatNumber', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      properties: [{ ...baseRow, assignedRegime: 'CedolareSecca26', taxNote: null }],
    });
    vi.mocked(fiscalApi.assignRegime).mockResolvedValueOnce(baseRow);

    renderPage();
    fireEvent.change(await screen.findByTestId('fiscal-regime-select-p-irpef'), { target: { value: 'IrpefOrdinaria' } });

    await waitFor(() =>
      expect(fiscalApi.assignRegime).toHaveBeenCalledWith('p-irpef', {
        taxYear: expect.any(Number),
        regime: 'IrpefOrdinaria',
        isPrimaryForCedolare: undefined,
      }),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('FiscalDashboard_WithoutVatNumber_DisablesImpresaRegimesAndLinksTheTaxProfile', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce(baseSnapshot);

    renderPage();

    const select = await screen.findByTestId('fiscal-regime-select-p-irpef');
    expect(optionOf(select, 'RegimeOrdinario')).toBeDisabled();
    expect(optionOf(select, 'RegimeForfettario')).toBeDisabled();
    expect(optionOf(select, 'RegimeOrdinario')).toHaveTextContent(i18n.t('fiscal.unavailable.partitaIva'));
    expect(optionOf(select, 'CedolareSecca26')).toBeEnabled();
    expect(screen.getByTestId('fiscal-piva-required-p-irpef')).toHaveTextContent(
      i18n.t('fiscal.unavailable.partitaIvaHint'),
    );
  });

  it('FiscalDashboard_WithVatNumber_AssignsTheForfettarioRegime', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      hasPartitaIva: true,
      properties: [
        { ...baseRow, availableRegimes: [...SHORT_RENTAL, 'RegimeOrdinario', 'RegimeForfettario'] },
      ],
    });
    vi.mocked(fiscalApi.assignRegime).mockResolvedValueOnce({ ...baseRow, assignedRegime: 'RegimeForfettario' });

    renderPage();
    const select = await screen.findByTestId('fiscal-regime-select-p-irpef');
    expect(optionOf(select, 'RegimeForfettario')).toBeEnabled();
    expect(screen.queryByTestId('fiscal-piva-required-p-irpef')).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'RegimeForfettario' } });

    await waitFor(() =>
      expect(fiscalApi.assignRegime).toHaveBeenCalledWith('p-irpef', {
        taxYear: expect.any(Number),
        regime: 'RegimeForfettario',
        isPrimaryForCedolare: undefined,
      }),
    );
  });

  it('FiscalDashboard_AnotherUnitIsAt21Percent_WarnsThatItMovesTo26', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce({
      ...baseSnapshot,
      strPropertyCount: 2,
      properties: [
        { ...baseRow, propertyId: 'p-a', name: 'Casa A', assignedRegime: 'CedolareSecca21', taxNote: null },
        { ...baseRow, propertyId: 'p-b', name: 'Casa B', assignedRegime: 'CedolareSecca26', taxNote: null },
      ],
      taxpayers: [{ ...baseSnapshot.taxpayers[0], shortStayApartmentCount: 2, reducedRatePropertyId: 'p-a' }],
    });

    renderPage();

    expect(await screen.findByTestId('fiscal-primary-p-b')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-primary-moves-p-b')).toHaveTextContent(i18n.t('fiscal.primaryMoves'));
    expect(screen.queryByTestId('fiscal-primary-p-a')).not.toBeInTheDocument();
  });

  it('FiscalDashboard_OverThreshold_OnlyImpresaRegimesAndApiProblemOnFailure', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValue({
      ...baseSnapshot,
      hasPartitaIva: true,
      properties: [
        {
          ...baseRow,
          assignedRegime: null,
          taxNote: 'short_stay_threshold_exceeded',
          availableRegimes: ['RegimeOrdinario', 'RegimeForfettario'],
        },
      ],
    });
    vi.mocked(fiscalApi.assignRegime).mockRejectedValueOnce(
      problem(422, 'fiscal_partita_iva_required', 'Registra prima la partita IVA.'),
    );

    renderPage();
    const select = await screen.findByTestId('fiscal-regime-select-p-irpef');
    expect(optionOf(select, 'CedolareSecca21')).toBeDisabled();
    expect(optionOf(select, 'IrpefOrdinaria')).toHaveTextContent(i18n.t('fiscal.unavailable.threshold'));
    expect(screen.queryByTestId('fiscal-primary-p-irpef')).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'RegimeOrdinario' } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Registra prima la partita IVA.'));
  });

  it('FiscalDashboard_ApiError_ShowsTheErrorAndRetriesNeverAnEmptyList', async () => {
    vi.mocked(fiscalApi.getRegime)
      .mockRejectedValueOnce(problem(400, 'fiscal_tax_year_invalid', 'Anno non valido.'))
      .mockResolvedValueOnce(baseSnapshot);

    renderPage();

    const error = await screen.findByTestId('fiscal-dashboard-error');
    expect(error).toHaveTextContent('Anno non valido.');
    expect(screen.queryByTestId('fiscal-dashboard-empty')).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('fiscal.retry') }));
    expect(await screen.findByTestId('fiscal-property-card-p-irpef')).toBeInTheDocument();
  });

  it('FiscalDashboard_NoProperties_ShowsTheEmptyStateWithAddPropertyLink', async () => {
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce({ ...baseSnapshot, strPropertyCount: 0, properties: [], taxpayers: [] });

    renderPage();

    const empty = await screen.findByTestId('fiscal-dashboard-empty');
    expect(empty).toHaveTextContent(i18n.t('fiscal.empty.title'));
    expect(within(empty).getByRole('link', { name: i18n.t('fiscal.empty.action') })).toHaveAttribute(
      'href',
      '/app/short-rent/properties/create',
    );
  });

  it('FiscalDashboard_English_ShowsTranslatedRegimesAndDisclaimer', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(fiscalApi.getRegime).mockResolvedValueOnce(baseSnapshot);

    renderPage();

    expect(await screen.findByTestId('fiscal-assigned-p-irpef')).toHaveTextContent('Ordinary IRPEF without a VAT number');
    expect(screen.getByTestId('fiscal-disclaimer')).toHaveTextContent('not tax advice');
  });
});

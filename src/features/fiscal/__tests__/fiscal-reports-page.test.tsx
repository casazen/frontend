import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import {
  fiscalApi,
  type AnnualIncomeReport,
  type FiscalReportRules,
  type TouristTaxReport,
  type WithholdingReport,
} from '@/api/fiscal.api';
import { saveBlobAs } from '@/lib/file-download';
import { FiscalReportsPage } from '../fiscal-reports-page';

vi.mock('@/api/fiscal.api', () => ({
  fiscalApi: {
    getAnnual: vi.fn(),
    getWithholding: vi.fn(),
    getTouristTax: vi.fn(),
    downloadReport: vi.fn(),
  },
}));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const rules: FiscalReportRules = {
  cedolareRate: 0.26,
  cedolareReducedRate: 0.21,
  cedolareSource: 'art. 1 c. 63 L. 213/2023',
  otaWithholdingRate: 0.21,
  otaWithholdingSource: 'art. 4 c. 5 D.L. 50/2017',
  maxApartmentsPerTaxpayer: 2,
  thresholdSource: 'art. 1 c. 595 L. 178/2020',
};

const yearPeriod = { from: '2026-01-01', to: '2026-12-31' };

const annualReport: AnnualIncomeReport = {
  taxYear: 2026,
  packLabel: 'Pacchetto dati per il commercialista',
  disclaimer: 'Raccomandazione informativa',
  properties: [
    {
      propertyId: 'p-1',
      name: 'Casa Uno',
      regime: 'CedolareSecca21',
      grossIncome: 1100,
      withholding: 0,
      net: 1100,
      touristTax: 100,
      rentalIncome: 1000,
      commissions: null,
      taxableIncome: 1000,
      taxRate: 0.21,
      estimatedTax: 210,
      taxNote: null,
      taxpayerIndex: 0,
    },
    {
      propertyId: 'p-2',
      name: 'Casa Due',
      regime: 'IrpefOrdinaria',
      grossIncome: 500,
      withholding: 105,
      net: 395,
      touristTax: 0,
      rentalIncome: 500,
      commissions: null,
      taxableIncome: null,
      taxRate: null,
      estimatedTax: null,
      taxNote: 'irpef_ordinaria_not_computed',
      taxpayerIndex: 0,
    },
  ],
  totals: {
    grossIncome: 1600,
    withholding: 105,
    net: 1495,
    touristTax: 100,
    rentalIncome: 1500,
    taxableIncome: 1000,
    estimatedTax: 210,
    linesWithoutEstimate: 1,
  },
  period: yearPeriod,
  orgName: 'Host',
  generatedOn: '2026-09-25',
  taxpayers: [
    {
      index: 0,
      fiscalCodeMasked: null,
      isOrgTaxProfile: true,
      thresholdExceeded: false,
      properties: 2,
      rentalIncome: 1500,
      withholding: 105,
      estimatedTax: 210,
    },
  ],
  rules,
};

const withholdingReport: WithholdingReport = {
  taxYear: 2026,
  packLabel: 'Pacchetto dati per il commercialista',
  byOta: [{ source: 'BookingCom', gross: 500, withholding: 105, net: 395, payoutCount: 1 }],
  lines: [
    {
      paymentId: 'pay-1',
      propertyId: 'p-2',
      source: 'BookingCom',
      paidAt: '2026-03-10T09:00:00Z',
      gross: 500,
      withholding: 105,
      net: 395,
      propertyName: 'Casa Due',
      bookingCode: 'ABCDE-FGHJK',
      paidOn: '2026-03-10',
      withholdingSource: 'AutoOta',
    },
  ],
  period: yearPeriod,
  disclaimer: 'Raccomandazione informativa',
  orgName: 'Host',
  generatedOn: '2026-09-25',
  totals: { gross: 500, withholding: 105, net: 395, payoutCount: 1 },
  rules,
};

const touristTaxReport: TouristTaxReport = {
  period: yearPeriod,
  disclaimer: 'Riepilogo per il versamento',
  orgName: 'Host',
  generatedOn: '2026-09-25',
  rows: [
    { comune: 'Milano', year: 2026, month: 3, stays: 2, nights: 5, guests: 4, amount: 95, staysWithoutAmount: 1 },
  ],
  byComune: [{ comune: 'Milano', stays: 2, nights: 5, guests: 4, amount: 95, staysWithoutAmount: 1 }],
  stays: [],
  totals: { stays: 2, nights: 5, guests: 4, amount: 95, staysWithoutAmount: 1 },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(QueryClientProvider, { client }, createElement(FiscalReportsPage)),
    ),
  );
}

describe('FiscalReportsPage (CO-19)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Fixed clock: the default tax year is the current year in Europe/Rome.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T10:00:00Z'));
    await i18n.changeLanguage('it');
    vi.mocked(fiscalApi.getAnnual).mockResolvedValue(annualReport);
    vi.mocked(fiscalApi.getWithholding).mockResolvedValue(withholdingReport);
    vi.mocked(fiscalApi.getTouristTax).mockResolvedValue(touristTaxReport);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('FiscalReports_KnownData_ShowsTablesWithEstimateOnlyForCedolare', async () => {
    renderPage();

    const row = await screen.findByTestId('fiscal-annual-row-p-1');
    expect(row).toHaveTextContent('Casa Uno');
    expect(row).toHaveTextContent(i18n.t('fiscal.regime.CedolareSecca21'));
    expect(row).toHaveTextContent('210,00');
    expect(row).toHaveTextContent(i18n.t('fiscal.reports.notAvailable'));
    expect(screen.getByTestId('fiscal-annual-row-p-2')).toHaveTextContent(i18n.t('fiscal.reports.estimateNote.irpef'));
    expect(screen.getByTestId('fiscal-annual-total')).toHaveTextContent('1600,00');
    expect(fiscalApi.getAnnual).toHaveBeenCalledWith(2026, yearPeriod);

    const byOta = await screen.findByTestId('fiscal-withholding-by-ota');
    expect(byOta).toHaveTextContent('Booking.com');
    expect(byOta).toHaveTextContent('105,00');
    expect(screen.getByTestId('fiscal-withholding-lines')).toHaveTextContent('ABCDE-FGHJK');

    const touristTax = await screen.findByTestId('fiscal-tourist-tax-table');
    expect(touristTax).toHaveTextContent('Milano');
    expect(touristTax).toHaveTextContent('marzo 2026');
    expect(touristTax).toHaveTextContent('95,00');
    expect(screen.getByTestId('fiscal-tourist-tax-without-amount')).toHaveTextContent(
      i18n.t('fiscal.reports.touristTax.withoutAmount', { count: 1 }),
    );
  });

  it('FiscalReports_QuarterSelected_RequestsThatPeriod', async () => {
    renderPage();
    await screen.findByTestId('fiscal-annual-table');

    fireEvent.change(screen.getByTestId('fiscal-report-period'), { target: { value: 'q2' } });

    const q2 = { from: '2026-04-01', to: '2026-06-30' };
    await waitFor(() => expect(fiscalApi.getAnnual).toHaveBeenCalledWith(2026, q2));
    expect(fiscalApi.getWithholding).toHaveBeenCalledWith(2026, q2);
    expect(fiscalApi.getTouristTax).toHaveBeenCalledWith(q2);
  });

  it('FiscalReports_DownloadPdfAndCsv_SavesTheFilesOfEachReport', async () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    const csv = new Blob(['Comune'], { type: 'text/csv' });
    vi.mocked(fiscalApi.downloadReport).mockResolvedValueOnce(pdf).mockResolvedValueOnce(csv);

    renderPage();
    await screen.findByTestId('fiscal-annual-table');
    fireEvent.click(screen.getByTestId('fiscal-export-pdf'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(pdf, 'casazen-redditi-2026-01-01-2026-12-31.pdf'));
    expect(fiscalApi.downloadReport).toHaveBeenCalledWith('annual', 2026, yearPeriod, 'pdf');

    fireEvent.click(screen.getByTestId('fiscal-tourist-tax-export-csv'));
    await waitFor(() =>
      expect(saveBlobAs).toHaveBeenCalledWith(csv, 'casazen-tassa-soggiorno-2026-01-01-2026-12-31.csv'),
    );
    expect(fiscalApi.downloadReport).toHaveBeenCalledWith('touristTax', 2026, yearPeriod, 'csv');
  });

  it('FiscalReports_WithholdingDownloadFails_ShowsTheApiProblem', async () => {
    vi.mocked(fiscalApi.downloadReport).mockRejectedValueOnce(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { status: 400, code: 'fiscal_report_period_invalid', detail: 'Periodo del report non valido.' },
      }),
    );

    renderPage();
    await screen.findByTestId('fiscal-withholding-lines');
    fireEvent.click(screen.getByTestId('fiscal-withholding-export-pdf'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Periodo del report non valido.'));
    expect(saveBlobAs).not.toHaveBeenCalled();
  });

  it('FiscalReports_EmptyPeriod_ShowsEmptyStatesAndKeepsDownloads', async () => {
    vi.mocked(fiscalApi.getAnnual).mockResolvedValue({
      ...annualReport,
      properties: [],
      taxpayers: [],
      totals: { ...annualReport.totals, grossIncome: 0 },
    });
    vi.mocked(fiscalApi.getWithholding).mockResolvedValue({ ...withholdingReport, byOta: [], lines: [] });
    vi.mocked(fiscalApi.getTouristTax).mockResolvedValue({ ...touristTaxReport, rows: [], byComune: [] });

    renderPage();

    expect(await screen.findByTestId('fiscal-report-annual-empty')).toHaveTextContent(
      i18n.t('fiscal.reports.annual.empty'),
    );
    expect(await screen.findByTestId('fiscal-report-withholding-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('fiscal-report-touristTax-empty')).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-withholding-export-csv')).toBeEnabled();
  });

  it('FiscalReports_ApiError_ShowsErrorNotEmptyAndRetries', async () => {
    vi.mocked(fiscalApi.getTouristTax)
      .mockRejectedValueOnce(
        new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
          status: 500,
          statusText: 'Server Error',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: {},
        }),
      )
      .mockResolvedValueOnce(touristTaxReport);

    renderPage();

    const error = await screen.findByTestId('fiscal-report-touristTax-error');
    expect(error).toHaveTextContent(i18n.t('fiscal.reports.loadError'));
    expect(screen.queryByTestId('fiscal-report-touristTax-empty')).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('fiscal.retry') }));
    expect(await screen.findByTestId('fiscal-tourist-tax-table')).toBeInTheDocument();
  });
});

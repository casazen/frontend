import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { TouristTaxComuneSummary, TouristTaxRemittance, TouristTaxSummary } from '@/types';
import { TouristTaxSummaryPage } from '../tourist-tax-summary-page';

const granted = vi.hoisted(() => new Set<string>());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => granted.has(`${context}:${permission}`) }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const get = vi.mocked(axios.get);

const THIS_YEAR = { from: '2026-01-01', to: '2026-12-31' };

const REMITTANCE: TouristTaxRemittance = {
  id: 'r-1',
  comune: 'Milano',
  periodFrom: '2026-07-01',
  periodTo: '2026-09-30',
  amount: 18,
  amountCents: 1800,
  paidOn: '2026-10-05',
  reference: 'RAV 0042',
  notes: null,
  hasReceipt: true,
};

const MILANO: TouristTaxComuneSummary = {
  comune: 'Milano',
  stays: 4,
  nights: 9,
  guests: 8,
  owed: 30,
  owedCents: 3000,
  staysWithoutAmount: 0,
  paid: 18,
  paidCents: 1800,
  balance: 12,
  balanceCents: 1200,
  status: 'ToPay',
  remittances: [REMITTANCE],
};

function fullSummary(period = THIS_YEAR): TouristTaxSummary {
  return {
    title: 'Tassa di soggiorno per comune',
    basis: 'recorded',
    currency: 'EUR',
    paymentsHidden: false,
    period,
    comuni: [MILANO],
    total: {
      stays: 4,
      nights: 9,
      guests: 8,
      owed: 30,
      owedCents: 3000,
      staysWithoutAmount: 0,
      paid: 18,
      paidCents: 1800,
      balance: 12,
      balanceCents: 1200,
    },
  };
}

function partialSummary(period = THIS_YEAR): TouristTaxSummary {
  const full = fullSummary(period);
  return {
    ...full,
    paymentsHidden: true,
    comuni: [{ ...MILANO, paid: null, paidCents: null, balance: null, balanceCents: null, status: null, remittances: null }],
    total: { ...full.total, paid: null, paidCents: null, balance: null, balanceCents: null },
  };
}

function withoutStays(summary: TouristTaxSummary): TouristTaxSummary {
  return { ...summary, comuni: [], total: { ...summary.total, stays: 0, nights: 0, guests: 0, owed: 0, owedCents: 0, staysWithoutAmount: 0 } };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TouristTaxSummaryPage />
    </QueryClientProvider>,
  );
}

describe('TouristTaxSummaryPage (NF-100)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    granted.clear();
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    { name: 'WriterOfPayments', write: true, hidden: false, record: 1, remove: 1, payments: 1, notice: 0 },
    { name: 'ReaderOfPayments', write: false, hidden: false, record: 0, remove: 0, payments: 1, notice: 0 },
    { name: 'WriterWhoReachesSomePropertiesOnly', write: true, hidden: true, record: 0, remove: 0, payments: 0, notice: 1 },
    { name: 'ReaderWhoReachesSomePropertiesOnly', write: false, hidden: true, record: 0, remove: 0, payments: 0, notice: 1 },
  ])('Page_OffersOnlyWhatTheCallerMayDo_$name', async ({ write, hidden, record, remove, payments, notice }) => {
    if (write) granted.add('short-rent:payment.write');
    get.mockResolvedValue({ data: hidden ? partialSummary() : fullSummary() });

    renderPage();

    await screen.findByTestId('tourist-tax-results');
    expect(screen.queryAllByTestId('tourist-tax-record')).toHaveLength(record);
    expect(screen.queryAllByTestId('tourist-tax-delete')).toHaveLength(remove);
    expect(screen.queryAllByTestId('tourist-tax-remittance')).toHaveLength(payments);
    expect(screen.queryAllByTestId('tourist-tax-payments-hidden')).toHaveLength(notice);
  });

  it.each([
    { name: 'CallerWhoReachesEveryProperty_IsToldAboutPayments', hidden: false, empty: 'reports.touristTax.empty', basis: 'reports.touristTax.basis' },
    {
      name: 'CallerWhoReachesSomePropertiesOnly_IsToldAboutTheStaysAndNoPayment',
      hidden: true,
      empty: 'reports.touristTax.emptyHidden',
      basis: 'reports.touristTax.basisHidden',
    },
  ])('EmptyPeriod_$name', async ({ hidden, empty, basis }) => {
    get.mockResolvedValue({ data: withoutStays(hidden ? partialSummary() : fullSummary()) });

    renderPage();

    const emptyState = await screen.findByTestId('tourist-tax-empty');
    expect(emptyState).toHaveTextContent(i18n.t(empty));
    expect(screen.getByTestId('tourist-tax-basis')).toHaveTextContent(i18n.t(basis));
    if (hidden) {
      expect(emptyState).not.toHaveTextContent(/versament/i);
      expect(screen.getByTestId('tourist-tax-basis')).not.toHaveTextContent(/versat|versament|saldo/i);
    }
  });

  it('RecordPayment_WhileAnotherPeriodLoads_StartsFromTheDaysOfTheSummaryShown', async () => {
    granted.add('short-rent:payment.write');
    get.mockImplementation((_url: string, config?: { params?: { from?: string } }) =>
      config?.params?.from === THIS_YEAR.from ? Promise.resolve({ data: fullSummary() }) : new Promise(() => undefined),
    );
    renderPage();
    await screen.findByTestId('tourist-tax-results');

    fireEvent.change(screen.getByTestId('tourist-tax-period'), { target: { value: 'lastYear' } });
    expect(screen.getByTestId('tourist-tax-results')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('tourist-tax-range')).toHaveTextContent('2025');

    fireEvent.click(screen.getByRole('button', { name: 'Registra versamento: Milano' }));

    expect(screen.getByTestId('record-payment-from')).toHaveValue(THIS_YEAR.from);
    expect(screen.getByTestId('record-payment-to')).toHaveValue(THIS_YEAR.to);
  });
});

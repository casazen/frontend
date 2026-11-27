import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { AccountantPackagePage } from '../accountant-package-page';
import { mixedSummary } from './accountant-package-fixtures';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/hooks/use-feature-flags', async () => {
  const { DEFAULT_FEATURE_FLAGS: defaults } = await import('@/config/feature-flags');
  return { useFeatureFlags: () => ({ flags: { ...defaults, accountantPackage: true }, isLoading: false }) };
});
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const get = vi.mocked(axios.get);

const plain = (value: string | null) => (value ?? '').replace(/[\u00a0\u202f]/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));
const figure = (amount: number) => plain(new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: ['/app/short-rent/accountant'] }, createElement(AccountantPackagePage))));
}

const serve = (summary: ReturnType<typeof mixedSummary>) => get.mockResolvedValue({ status: 200, data: summary } as never);

const rows = (testId: string) => within(screen.getByTestId(`${testId}-table`)).getAllByTestId(`${testId}-table-row`).map((row) => plain(row.textContent));
const text = (testId: string) => plain(screen.getByTestId(testId).textContent);

describe('the agency summary keeps every currency apart (E15/F02/US01/T01)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('AgencySummary_FrancsAndEurosInOnePeriod_AreEachWrittenInTheirOwnCurrencyAndNeverAddedTogether', async () => {
    serve(mixedSummary());
    renderPage();
    await screen.findByTestId('accountant-summary');

    const documents = rows('accountant-guest-documents');
    expect(documents).toHaveLength(3);
    for (const amount of [1000, 38, 1038]) expect(documents[0]).toContain(money(amount, 'CHF'));
    for (const amount of [-100, -3.8, -103.8]) expect(documents[1]).toContain(money(amount, 'CHF'));
    for (const amount of [500, 50, 550]) expect(documents[2]).toContain(money(amount, 'EUR'));
    expect(documents[0]).not.toContain('€');
    expect(documents[2]).not.toContain('CHF');

    const margin = rows('accountant-margin');
    expect(margin).toHaveLength(2);
    for (const amount of [200, 50, 25, 225]) expect(margin[0]).toContain(money(amount, 'CHF'));
    for (const amount of [120, 40, 160]) expect(margin[1]).toContain(money(amount, 'EUR'));
    expect(margin[0]).not.toContain('€');
    expect(margin[1]).not.toContain('CHF');

    const payouts = rows('accountant-payouts');
    expect(payouts).toHaveLength(2);
    expect(payouts[0]).toContain(money(5000, 'CHF'));
    expect(payouts[1]).toContain(money(1580, 'EUR'));
    expect(payouts[1]).toContain(money(420, 'EUR'));

    const commissions = rows('accountant-commissions');
    expect(commissions).toHaveLength(2);
    expect(commissions[0]).toContain(money(300.25, 'CHF'));
    expect(commissions[1]).toContain(money(205.2, 'EUR'));
    expect(rows('accountant-to-collect')).toEqual([expect.stringContaining(money(300, 'CHF')), expect.stringContaining(money(150, 'EUR'))]);
    expect(text('accountant-tourist-tax-switzerland')).toContain(money(36, 'CHF'));

    expect(document.querySelectorAll('tfoot')).toHaveLength(0);
    const page = plain(screen.getByTestId('accountant-summary').textContent);
    for (const sum of [1500, 88, 1588, 900, 320, 385, 450, 505.45, 6580, 7000]) {
      expect(page, `the sum ${sum} is written`).not.toContain(figure(sum));
    }
  });

  it('AgencySummary_FiguresWithNoCurrency_AreWrittenWithoutASymbolWithASentenceThatSaysSoAndNoTotalOfThem', async () => {
    serve(mixedSummary());
    renderPage();
    await screen.findByTestId('accountant-summary');

    expect(text('accountant-stays-table')).toContain(figure(2500.5));
    expect(text('accountant-stays-table')).toContain(figure(61));
    expect(text('accountant-collected-table')).toContain(figure(4321.5));
    expect(text('accountant-tourist-tax-italy-table')).toContain(figure(80));
    expect(text('accountant-owner-performance-table')).toContain(figure(1700.5));
    for (const id of ['accountant-stays-table', 'accountant-collected-table', 'accountant-tourist-tax-italy-table', 'accountant-portal-costs-table', 'accountant-owner-performance-table']) {
      expect(text(id), id).not.toMatch(/€|CHF|EUR/);
    }
    expect(screen.getByTestId('accountant-stays-currency-note')).toHaveTextContent(i18n.t('accountantPackage.currencyNotGiven'));
    expect(screen.getByTestId('accountant-owner-performance-note')).toHaveTextContent(i18n.t('accountantPackage.currencyNotGiven'));

    const costs = rows('accountant-portal-costs');
    expect(costs).toHaveLength(2);
    expect(text('accountant-portal-costs-table')).not.toContain(figure(2500));
    expect(costs[1]).toContain(i18n.t('accountantPackage.notAvailable'));
  });

  it('AgencySummary_ARowThatNamesNoCurrency_IsWrittenWithoutASymbolAndItsTableSaysSo', async () => {
    const summary = mixedSummary();
    summary.guestDocuments[2] = { ...summary.guestDocuments[2]!, currency: '' };
    serve(summary);
    renderPage();
    await screen.findByTestId('accountant-summary');

    const documents = rows('accountant-guest-documents');
    expect(documents[2]).toContain(figure(550));
    expect(documents[2]).not.toMatch(/€|CHF|EUR/);
    expect(documents[0]).toContain(money(1038, 'CHF'));
    expect(screen.getByTestId('accountant-guest-documents-note')).toHaveTextContent(i18n.t('accountantPackage.currencyMissing'));
  });
});

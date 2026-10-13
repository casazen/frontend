import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fiscalApi } from '@/api/fiscal.api';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';
import { FiscalReportsPage } from '../fiscal-reports-page';

// The tax year is read once, when the pages are loaded, from `currentFiscalYear`/`fiscalYears`
// (fiscal-format.ts), both Europe/Rome (QA-CLOCK-FE). 23:30 UTC of 31 December 2026 is already
// 00:30 of 1 January 2027 in Rome: the pages must request 2027, not the UTC year 2026 (CO-19: the
// year now reaches the report hooks via `fiscal-format.ts`, not a module-level UTC constant).
vi.mock('@/api/fiscal.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal.api')>();
  return {
    ...actual,
    fiscalApi: {
      getRegime: vi.fn(() => new Promise(() => {})),
      assignRegime: vi.fn(() => new Promise(() => {})),
      getAnnual: vi.fn(() => new Promise(() => {})),
      getWithholding: vi.fn(() => new Promise(() => {})),
      getTouristTax: vi.fn(() => new Promise(() => {})),
      downloadReport: vi.fn(() => new Promise(() => {})),
    },
  };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: () => null,
}));

function renderPage(Page: () => ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(Page)),
    ),
  );
}

describe('fiscal pages tax year (QA-CLOCK-FE, CO-19)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('FiscalDashboardPage_NewYearsNightInRome_RequestsTheRomeYear', () => {
    renderPage(FiscalDashboardPage);

    expect(fiscalApi.getRegime).toHaveBeenCalledWith(2027);
  });

  it('FiscalReportsPage_NewYearsNightInRome_RequestsTheRomeYear', () => {
    renderPage(FiscalReportsPage);

    const yearPeriod = { from: '2027-01-01', to: '2027-12-31' };
    expect(fiscalApi.getAnnual).toHaveBeenCalledWith(2027, yearPeriod);
    expect(fiscalApi.getWithholding).toHaveBeenCalledWith(2027, yearPeriod);
  });
});

import { afterAll, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  useAssignFiscalRegime,
  useFiscalAnnualReport,
  useFiscalRegime,
  useFiscalWithholdingReport,
} from '@/queries/use-fiscal';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';
import { FiscalReportsPage } from '../fiscal-reports-page';
import { FiscalWizardPage } from '../fiscal-wizard-page';

// The tax year is read once, when the pages are loaded: the clock is fixed before the imports. 23:30 UTC of
// 31 December 2026 is already 00:30 of 1 January 2027 in Rome.
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
});

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/queries/use-fiscal', () => ({
  useFiscalRegime: vi.fn(() => ({ data: undefined, isLoading: true })),
  useAssignFiscalRegime: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateFiscalTaxProfile: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useFiscalAnnualReport: vi.fn(() => ({ data: undefined })),
  useFiscalWithholdingReport: vi.fn(() => ({ data: undefined })),
}));

function renderPage(page: () => ReactNode) {
  render(createElement(MemoryRouter, null, createElement(page)));
}

describe('fiscal pages tax year (QA-CLOCK-FE)', () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it('FiscalDashboardPage_NewYearsNightInRome_UsesTheNewYear', () => {
    renderPage(FiscalDashboardPage);

    expect(useFiscalRegime).toHaveBeenCalledWith(2027);
    expect(useAssignFiscalRegime).toHaveBeenCalledWith(2027);
  });

  it('FiscalReportsPage_NewYearsNightInRome_UsesTheNewYear', () => {
    renderPage(FiscalReportsPage);

    expect(useFiscalAnnualReport).toHaveBeenCalledWith(2027);
    expect(useFiscalWithholdingReport).toHaveBeenCalledWith(2027);
  });

  it('FiscalWizardPage_NewYearsNightInRome_UsesTheNewYear', () => {
    renderPage(FiscalWizardPage);

    expect(useFiscalRegime).toHaveBeenCalledWith(2027);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { fiscalApi, type FiscalRegimeSnapshot } from '@/api/fiscal.api';
import { BILLING_SETUP_PATH } from '../billing-wizard/billing-wizard-ids';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';

const permissions = vi.hoisted(() => ({ canWrite: true }));

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
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permission !== 'property.write' || permissions.canWrite }),
}));

const noProperties: FiscalRegimeSnapshot = {
  taxYear: 2026,
  strPropertyCount: 0,
  requiresPartitaIva: false,
  hasPartitaIva: false,
  disclaimer: 'Raccomandazione informativa, non consulenza fiscale.',
  properties: [],
  maxShortStayApartmentsPerTaxpayer: 2,
  thresholdSource: 'art. 1 c. 595 L. 178/2020',
  taxpayers: [],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(FiscalDashboardPage))));
}

describe('FiscalDashboardPage: the card «Fatturazione» (E11/F02/US01/T01)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    permissions.canWrite = true;
    await i18n.changeLanguage('it');
    vi.mocked(fiscalApi.getRegime).mockResolvedValue(noProperties);
  });

  it('FiscalDashboard_BillingCard_LeadsToTheWizardAndIsAQuietSectionNotASecondHighlightedBlock', async () => {
    renderPage();

    const card = await screen.findByTestId('fiscal-billing-card');
    expect(within(card).getByRole('heading', { level: 2, name: i18n.t('billingWizard.card.title') })).toBeInTheDocument();
    expect(within(card).getByText(i18n.t('billingWizard.card.description'))).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-billing-card-cta')).toHaveAttribute('href', BILLING_SETUP_PATH);
    expect(screen.getByTestId('fiscal-billing-card-cta')).toHaveTextContent(i18n.t('billingWizard.card.action'));
    // The one highlighted block of the page stays the one that was there.
    expect(await screen.findByTestId('fiscal-dashboard-empty')).toBeInTheDocument();
  });

  it('FiscalDashboard_BillingCard_WhoMayNotWriteHasNoButtonToTheWizard', async () => {
    permissions.canWrite = false;
    renderPage();

    expect(await screen.findByTestId('fiscal-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-billing-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-billing-card-cta')).not.toBeInTheDocument();
  });

  it('FiscalDashboard_BillingCard_IsInEnglishToo', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Invoicing' })).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-billing-card-cta')).toHaveTextContent('Set up invoicing');
  });
});

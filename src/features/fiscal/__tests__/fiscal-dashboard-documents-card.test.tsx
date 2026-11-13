import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { fiscalApi, type FiscalRegimeSnapshot } from '@/api/fiscal.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FISCAL_DOCUMENTS_PATH } from '../documents/document-paths';
import { FiscalDashboardPage } from '../fiscal-dashboard-page';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

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
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => env.permissions.has(permission) }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
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

describe('FiscalDashboardPage: the card of the fiscal documents (E06/F03/US04/T01)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    env.permissions = new Set(['property.read', 'property.write', 'payment.read']);
    env.flags = {};
    await i18n.changeLanguage('it');
    vi.mocked(fiscalApi.getRegime).mockResolvedValue(noProperties);
  });

  // Flag rule: with the flags off (the default of the backend) the page is as it was.
  it('FiscalDashboard_DocumentsCard_WithBothFlagsOffIsNotThere', async () => {
    renderPage();

    expect(await screen.findByTestId('fiscal-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-card-cta')).not.toBeInTheDocument();
    // The other card of the page is where it was.
    expect(screen.getByTestId('fiscal-issuer-card')).toBeInTheDocument();
  });

  it.each([
    ['CasaZen issues', { fiscalDocumentIssuance: true }],
    ['the documents of the channel manager are imported', { octorateDocumentImport: true }],
  ])('FiscalDashboard_DocumentsCard_When_%s_LeadsToTheListAsAQuietSection', async (_case, flags) => {
    env.flags = flags;
    renderPage();

    const card = await screen.findByTestId('fiscal-documents-card');
    expect(within(card).getByRole('heading', { level: 2, name: i18n.t('fiscalDocuments.list.title') })).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-documents-card-cta')).toHaveAttribute('href', FISCAL_DOCUMENTS_PATH);
    expect(screen.getByTestId('fiscal-documents-card-cta')).toHaveTextContent(i18n.t('fiscalDocuments.list.card.action'));
    // The one highlighted block of the page stays the one that was there.
    expect(await screen.findByTestId('fiscal-dashboard-empty')).toBeInTheDocument();
  });

  // Permission rule: a link is never drawn to a page the person would be turned away from.
  it.each([
    ['payment.read', ['property.read', 'property.write']],
    ['property.read', ['payment.read', 'property.write']],
  ])('FiscalDashboard_DocumentsCard_WithoutThePermission_%s_IsNotThere', async (_missing, permissions) => {
    env.flags = { fiscalDocumentIssuance: true };
    env.permissions = new Set(permissions);
    renderPage();

    expect(await screen.findByTestId('fiscal-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-documents-card')).not.toBeInTheDocument();
  });

  it('FiscalDashboard_DocumentsCard_IsInEnglishToo', async () => {
    await i18n.changeLanguage('en');
    env.flags = { fiscalDocumentIssuance: true };
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Fiscal documents' })).toBeInTheDocument();
    expect(screen.getByTestId('fiscal-documents-card-cta')).toHaveTextContent('Open the list');
  });
});

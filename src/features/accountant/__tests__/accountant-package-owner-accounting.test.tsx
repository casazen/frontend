import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { AccountantPackagePage } from '../accountant-package-page';
import { mixedSummary, OWNER_ACCOUNTING_TABLES } from './accountant-package-fixtures';

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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: ['/app/short-rent/accountant'] }, createElement(AccountantPackagePage))));
}

describe('the owner accounting of the summary (E15/F01/US01/T01 contract, E15/F02/US01/T01)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('AgencySummary_OwnerAccountingNotIncluded_DrawsNoOwnerFigureAndSaysTheFoldersAreNotInThePackage', async () => {
    get.mockResolvedValue({ status: 200, data: mixedSummary({ ownerAccountingIncluded: false }) } as never);
    renderPage();
    await screen.findByTestId('accountant-summary');

    for (const id of OWNER_ACCOUNTING_TABLES) expect(screen.queryByTestId(id), id).toBeNull();
    expect(screen.queryByTestId('accountant-owners')).toBeNull();
    expect(document.body.textContent).not.toContain('Marta Rossi');
    expect(document.body.textContent).not.toContain('Luca Bianchi');

    expect(screen.getByTestId('accountant-guest-documents')).toBeInTheDocument();
    expect(screen.getByTestId('accountant-stays')).toBeInTheDocument();

    expect(screen.getByTestId('accountant-owner-omitted')).toHaveTextContent(i18n.t('accountantPackage.focus.ownerOmitted'));
  });

  it('AgencySummary_OwnerAccountingIncluded_DrawsEveryOwnerTableAndSaysNothingIsOmitted', async () => {
    get.mockResolvedValue({ status: 200, data: mixedSummary() } as never);
    renderPage();
    await screen.findByTestId('accountant-summary');

    for (const id of OWNER_ACCOUNTING_TABLES) expect(screen.getByTestId(id), id).toBeInTheDocument();
    expect(screen.getByTestId('accountant-commissions')).toHaveTextContent('Marta Rossi');
    expect(screen.queryByTestId('accountant-owner-omitted')).toBeNull();
  });
});

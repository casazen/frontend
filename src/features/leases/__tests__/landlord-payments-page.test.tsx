import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { LandlordPaymentsPage } from '../landlord-payments-page';

const permissions = vi.hoisted(() => new Set<string>());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: [
      {
        contextKey: 'long-rent',
        displayName: 'Affitti lunghi',
        roleKey: 'viewer',
        permissions: [...permissions],
        defaultRoute: '/app/long-rent',
      },
    ],
    activeContext: 'long-rent',
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: (_context: string, permission: string) => permissions.has(permission),
    getDefaultRoute: () => '/app/long-rent',
  }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);
const PATH = '/app/long-rent/payments';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const entry = ROUTE_MANIFEST.find((route) => route.path === PATH);
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [PATH] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: PATH,
            element: createElement(
              ContextRouteGuard,
              { contextKey: 'long-rent', requiredPermissions: entry?.requiredPermissions ?? [] },
              createElement(LandlordPaymentsPage),
            ),
          }),
        ),
      ),
    ),
  );
}

describe('Pagamenti of the long-term landlord', () => {
  beforeEach(async () => {
    permissions.clear();
    get.mockReset();
    get.mockResolvedValue({ data: { linked: false } });
    await i18n.changeLanguage('it');
  });

  it('requires lease.create and lease.read, and lives in the settings as Conto SEPA', () => {
    expect(ROUTE_MANIFEST.find((route) => route.path === PATH)?.requiredPermissions).toEqual(['lease.read', 'lease.create']);
  });

  it('does not let a viewer open the page or click Collega il conto', () => {
    permissions.add('lease.read');

    renderPage();

    expect(screen.getByTestId('reserved-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collega il conto' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('condominium-bank-link')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('shows the Italian euro link before signature to who can create a lease', async () => {
    permissions.add('lease.read');
    permissions.add('lease.create');

    renderPage();

    expect(await screen.findByTestId('condominium-bank-link')).toHaveTextContent('euro');
    expect(screen.getByRole('button', { name: 'Collega il conto' })).toBeInTheDocument();
    expect(screen.getByTestId('stripe-manual-stays')).toBeInTheDocument();
    expect(screen.queryByTestId('reserved-page')).not.toBeInTheDocument();
  });
});

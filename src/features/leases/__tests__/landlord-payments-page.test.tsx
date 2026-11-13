import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    vi.mocked(axios.post).mockReset();
    get.mockResolvedValue({ data: [] });
    await i18n.changeLanguage('it');
  });

  it('manages a vacant apartment without requesting contracts', async () => {
    permissions.add('property.read'); permissions.add('property.write');
    get.mockImplementation(async (url) => ({ data: String(url).endsWith('/properties') ? [{ propertyId: 'property-1', propertyName: 'Appartamento sfitto', books: [] }] : [] }));
    renderPage();
    fireEvent.change(await screen.findByLabelText('Appartamento'), { target: { value: 'property-1' } });
    fireEvent.click(await screen.findByRole('button', { name: /Imposta manualmente/ }));
    expect(await screen.findByRole('button', { name: 'Attiva gestione condominiale' })).toBeInTheDocument();
    expect(screen.queryByText('Apri i contratti')).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).includes('/leases'))).toBe(false);
  });

  it('requires property.read to list manual condominium dues', () => {
    expect(ROUTE_MANIFEST.find((route) => route.path === PATH)?.requiredPermissions).toEqual(['property.read']);
  });

  it('does not let a viewer open the page or click Collega il conto', () => {
    permissions.add('lease.read');

    renderPage();

    expect(screen.getByTestId('reserved-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collega il conto' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('condominium-bank-link')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('records only a confirmed home banking payment and never starts Stripe', async () => {
    permissions.add('lease.read'); permissions.add('lease.create'); permissions.add('property.write'); permissions.add('property.read');
    get.mockImplementation(async (url) => ({ data: String(url).endsWith('/properties') ? [] : [{ id: 'due-1', name: 'Via Roma', label: 'Novembre', dueDate: '2026-11-30', amount: 150, paid: false }] }));
    vi.mocked(axios.post).mockResolvedValue({ data: null });
    renderPage();
    fireEvent.click(await screen.findByText('Scadenze di tutti gli appartamenti'));
    fireEvent.click(await screen.findByRole('button', { name: 'Segna come pagato' }));
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByText(/già pagato 150,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma pagamento effettuato' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/long-rent/condominiums/manual-payments/due-1/mark-paid', {}, undefined));
    expect(screen.queryByRole('button', { name: 'Collega il conto' })).not.toBeInTheDocument();
  });
});

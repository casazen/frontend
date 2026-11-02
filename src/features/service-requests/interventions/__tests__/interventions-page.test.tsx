import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { fetchInterventionCounts, fetchInterventions } from '@/api/service-requests.api';
import type { Property } from '@/types';
import type { ServiceRequest } from '@/types/service-request';
import { InterventionsPage } from '../interventions-page';

const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'user-1', context: 'short-rent' }) }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    activeContext: 'short-rent',
    hasPermission: (context: string, permission: string) => workspace.permissions.has(`${context}:${permission}`),
  }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn() }));
vi.mock('@/api/service-requests.api', () => ({ fetchInterventions: vi.fn(), fetchInterventionCounts: vi.fn() }));

const WAIT = { timeout: 5000 };

function request(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: 'sr-1',
    orgId: 'org-1',
    propertyId: 'prop-1',
    propertyName: 'Casa Mare',
    propertyCity: 'Rimini',
    supplierOrgId: 'sup-1',
    supplierName: 'Idraulica Rossi',
    serviceName: 'Riparazione perdita',
    category: 'plumbing',
    urgency: 'Normal',
    status: 'Completato',
    chargeToGuest: false,
    createdAt: '2026-10-20T08:00:00Z',
    updatedAt: '2026-10-22T08:00:00Z',
    price: { amountCents: 12000, basis: 'final' },
    availableActions: [],
    ...overrides,
  };
}

const payOnline = request({ id: 'sr-pay', serviceName: 'Riparazione perdita', paymentMode: 'Online', hostAction: { kind: 'pay' } });
const markPaid = request({ id: 'sr-paid', serviceName: 'Controllo caldaia', paymentMode: 'Manual', hostAction: { kind: 'markPaid' } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: ['/app/short-rent/interventions'] },
          createElement(Routes, null, createElement(Route, { path: '/app/short-rent/interventions', element: createElement(InterventionsPage) }))))),
  );
}

describe('InterventionsPage (SR-08)', { timeout: 20000 }, () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    await i18n.changeLanguage('it');
    vi.mocked(propertiesApi.getAll).mockResolvedValue([{ id: 'prop-1', name: 'Casa Mare', city: 'Rimini' } as Property]);
    vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'plumbing']);
    vi.mocked(fetchInterventions).mockResolvedValue({ items: [payOnline, markPaid], total: 2, page: 1, pageSize: 20 });
    vi.mocked(fetchInterventionCounts).mockResolvedValue({ all: 2, pending: 0, active: 0, toPay: 2, done: 0, needsAction: 2 });
  });

  it('InterventionsPage_Manager_SeesTheActionTheServerNamesOnEachRowAndTheNumberOfWhatAsksForPayment', async () => {
    workspace.permissions = new Set(['short-rent:property.read', 'short-rent:property.write', 'short-rent:servicerequest.write']);
    renderPage();

    expect((await screen.findAllByTestId('intervention-row-pay', undefined, WAIT)).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('intervention-row-mark-paid').length).toBeGreaterThan(0);
    expect(screen.getByTestId('list-chip-topay')).toHaveTextContent('2');
    // The server filters, counts and orders: the page asks it for the plain list, the ones that wait for the host first.
    expect(fetchInterventions).toHaveBeenCalledWith(expect.objectContaining({ view: 'all', sort: 'status:asc', page: 1, pageSize: 20 }));
  });

  it('InterventionsPage_CollaboratorWithoutPropertyWrite_HasNoPayButtonButMayMarkPaid', async () => {
    workspace.permissions = new Set(['short-rent:property.read', 'short-rent:servicerequest.write']);
    renderPage();

    expect((await screen.findAllByTestId('intervention-row-mark-paid', undefined, WAIT)).length).toBeGreaterThan(0);
    // The rows are there, the money step of the property is not offered.
    expect(screen.getAllByText('Riparazione perdita').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('intervention-row-pay')).toHaveLength(0);
  });
});

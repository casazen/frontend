import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ServiceRequest } from '@/types/service-request';
import { MarketplacePage } from '../marketplace-page';

const api = vi.hoisted(() => ({
  fetchServiceRequests: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  markServiceRequestPaid: vi.fn(),
  fetchServiceCategories: vi.fn(),
  getProperties: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The shell (sidebar, header, navigation) is not what these tests are about.
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  fetchServiceRequests: api.fetchServiceRequests,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
  markServiceRequestPaid: api.markServiceRequestPaid,
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: api.getProperties } }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (context: string, permission: string) => workspace.permissions.has(`${context}:${permission}`),
  }),
}));

const REJECTED: ServiceRequest = {
  id: 'sr-rejected',
  orgId: 'org-1',
  bookingId: 'b-1',
  rentalContext: 'ShortRent',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  supplierOrgId: 'sup-1',
  supplierName: 'Pulizie Express Srl',
  category: 'cleaning',
  urgency: 'Normal',
  status: 'Rifiutato',
  rejectionReason: 'Siamo chiusi per ferie',
  chargeToGuest: false,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-21T10:00:00Z',
  history: [
    { status: 'Richiesto', at: '2026-09-20T08:00:00Z', actor: 'Host' },
    { status: 'Rifiutato', at: '2026-09-21T10:00:00Z', actor: 'Supplier', reason: 'Siamo chiusi per ferie' },
  ],
};

const COMPLETED: ServiceRequest = {
  ...REJECTED,
  id: 'sr-completed',
  status: 'Completato',
  rejectionReason: null,
  completedAt: '2026-09-26T10:15:00Z',
  history: [
    { status: 'Richiesto', at: '2026-09-20T08:00:00Z', actor: 'Host' },
    { status: 'PresoInCarico', at: '2026-09-24T10:00:00Z', actor: 'Supplier' },
    { status: 'Completato', at: '2026-09-26T10:15:00Z', actor: 'Supplier' },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MarketplacePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('MarketplacePage requests (SU-09, A4-28)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = new Set(['short-rent:property.read', 'short-rent:property.write']);
    api.getProperties.mockResolvedValue([]);
    api.fetchSuppliersByProperty.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
    api.fetchServiceCategories.mockResolvedValue(['cleaning']);
    api.fetchServiceRequests.mockResolvedValue({ items: [REJECTED, COMPLETED], total: 2, page: 1, pageSize: 50 });
    api.markServiceRequestPaid.mockResolvedValue({ ...COMPLETED, status: 'Pagato' });
    await i18n.changeLanguage('it');
  });

  it('MarketplacePage_Requests_ShowTheRealTimelineWithTheRejectionReasonAndTheStayLink', async () => {
    renderPage();

    const rejected = await screen.findByTestId('service-request-sr-rejected');
    expect(rejected).toHaveTextContent('Villa Rosa');
    expect(within(rejected).getByTestId('service-request-rejection-sr-rejected')).toHaveTextContent('Siamo chiusi per ferie');
    expect(within(rejected).getByTestId('request-other-supplier-sr-rejected')).toBeInTheDocument();
    expect(within(rejected).getByTestId('service-request-stay-sr-rejected')).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(within(screen.getByTestId('service-request-sr-completed')).getByTestId('mark-paid-sr-completed')).toBeInTheDocument();
  });

  it('MarketplacePage_MarkPaid_AsksForConfirmationFirst', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('mark-paid-sr-completed'));

    expect(api.markServiceRequestPaid).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('mark-paid-confirm'));
    await waitFor(() => expect(api.markServiceRequestPaid).toHaveBeenCalledWith('sr-completed'));
  });

  it('MarketplacePage_WithoutPropertyWrite_ShowsTheRequestsButNoActions', async () => {
    workspace.permissions = new Set(['short-rent:property.read']);

    renderPage();

    expect(await screen.findByTestId('service-request-sr-rejected')).toBeInTheDocument();
    expect(screen.queryByTestId('mark-paid-sr-completed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-other-supplier-sr-rejected')).not.toBeInTheDocument();
  });

  it('MarketplacePage_RequestsLoadFails_ShowsAnErrorWithRetryNotAnEmptyList', async () => {
    api.fetchServiceRequests.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ items: [REJECTED], total: 1, page: 1, pageSize: 50 });
    renderPage();

    expect(await screen.findByTestId('marketplace-requests-error')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('marketplace.noRequests'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('service-request-sr-rejected')).toBeInTheDocument();
  });

  it('MarketplacePage_NoRequests_ShowsTheEmptyState', async () => {
    api.fetchServiceRequests.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    renderPage();

    expect(await screen.findByText(i18n.t('marketplace.noRequests'))).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-requests-list')).not.toBeInTheDocument();
  });
});

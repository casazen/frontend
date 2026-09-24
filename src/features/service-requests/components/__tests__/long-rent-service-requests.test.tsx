import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ServiceRequest } from '@/types/service-request';
import { LongRentServiceRequests } from '../long-rent-service-requests';

const api = vi.hoisted(() => ({
  fetchLongRentServiceRequests: vi.fn(),
  markLongRentServiceRequestPaid: vi.fn(),
  markServiceRequestPaid: vi.fn(),
  fetchLongRentSuppliers: vi.fn(),
  createLongRentServiceRequest: vi.fn(),
  fetchServiceCategories: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/service-requests.api', () => api);
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (context: string, permission: string) => workspace.permissions.has(`${context}:${permission}`),
  }),
}));

const REQUEST: ServiceRequest = {
  id: 'sr-lease',
  orgId: 'org-1',
  bookingId: null,
  rentalContext: 'LongRent',
  propertyId: 'prop-1',
  supplierOrgId: 'sup-1',
  supplierName: 'Idraulica Rossi',
  category: 'plumbing',
  urgency: 'High',
  status: 'Completato',
  chargeToGuest: false,
  createdAt: '2026-09-20T08:00:00Z',
  completedAt: '2026-09-22T08:00:00Z',
  updatedAt: '2026-09-22T08:00:00Z',
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <LongRentServiceRequests propertyId="prop-1" />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('LongRentServiceRequests (SU-07, D2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = new Set(['long-rent:property.read', 'long-rent:property.write']);
    api.fetchLongRentServiceRequests.mockResolvedValue({ items: [REQUEST], total: 1, page: 1, pageSize: 50 });
    api.markLongRentServiceRequestPaid.mockResolvedValue({ ...REQUEST, status: 'Pagato' });
    api.fetchServiceCategories.mockResolvedValue(['cleaning', 'plumbing']);
    await i18n.changeLanguage('it');
  });

  it('LongRentServiceRequests_Property_ListsThePropertyRequestsThroughTheLongRentApi', async () => {
    renderSection();

    expect(await screen.findByTestId('service-request-sr-lease')).toHaveTextContent('Idraulica Rossi');
    expect(api.fetchLongRentServiceRequests).toHaveBeenCalledWith({ propertyId: 'prop-1', pageSize: 50 });
    // A property-level request: no stay link.
    expect(screen.queryByTestId('service-request-stay-sr-lease')).not.toBeInTheDocument();
  });

  it('LongRentServiceRequests_CompletedRequest_IsMarkedPaidThroughTheLongRentApi', async () => {
    renderSection();

    fireEvent.click(await screen.findByTestId('mark-paid-sr-lease'));

    await waitFor(() => expect(api.markLongRentServiceRequestPaid).toHaveBeenCalledWith('sr-lease'));
    expect(api.markServiceRequestPaid).not.toHaveBeenCalled();
  });

  it('LongRentServiceRequests_LoadFails_ShowsTheErrorNotAnEmptyList', async () => {
    api.fetchLongRentServiceRequests.mockRejectedValue(new Error('network'));

    renderSection();

    expect(await screen.findByTestId('service-requests-error')).toHaveTextContent(i18n.t('serviceRequest.listLoadError'));
    expect(screen.queryByTestId('service-requests-empty')).not.toBeInTheDocument();
  });

  it('LongRentServiceRequests_NoRequests_SaysSoAndOffersTheRequest', async () => {
    api.fetchLongRentServiceRequests.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

    renderSection();

    expect(await screen.findByTestId('service-requests-empty')).toHaveTextContent(i18n.t('serviceRequest.emptyForProperty'));
    expect(screen.getByTestId('request-supplier-btn')).toBeInTheDocument();
  });

  it('LongRentServiceRequests_WithoutLongRentWrite_DoesNotOfferTheRequest', async () => {
    workspace.permissions = new Set(['long-rent:property.read', 'short-rent:property.write']);

    renderSection();

    expect(await screen.findByTestId('service-request-sr-lease')).toBeInTheDocument();
    expect(screen.queryByTestId('request-supplier-btn')).not.toBeInTheDocument();
  });
});

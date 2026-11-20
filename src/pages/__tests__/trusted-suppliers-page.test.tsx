import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { trustedSuppliersApi } from '@/api/trusted-suppliers.api';
import { propertiesApi } from '@/api/properties.api';
import { TrustedSuppliersPage } from '../TrustedSuppliersPage';

vi.mock('@/api/trusted-suppliers.api', () => ({
  trustedSuppliersApi: { getAll: vi.fn(), invite: vi.fn(), updateVisibility: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));

const COMO = { id: 'p-como', name: 'Casa Como' };
const LUGANO = { id: 'p-lugano', name: 'Casa Lugano' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TrustedSuppliersPage />
    </QueryClientProvider>,
  );
}

describe('TrustedSuppliersPage invite (bug #977)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(trustedSuppliersApi.getAll).mockResolvedValue([
      {
        id: 'ts-1',
        supplierOrgId: 'org-1',
        assignedPropertyIds: [COMO.id],
        priority: 0,
        visibleInMarketplace: false,
        createdAt: '2026-11-19T10:00:00Z',
      },
    ]);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([COMO, LUGANO] as never);
    vi.mocked(trustedSuppliersApi.invite).mockResolvedValue(undefined);
  });

  it('sends the email and the properties picked by name, never typed ids', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('invite-supplier-button'));
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: ' fornitore@example.com ' } });
    fireEvent.click(await screen.findByLabelText(LUGANO.name));
    fireEvent.click(screen.getByTestId('invite-submit-button'));

    await waitFor(() =>
      expect(trustedSuppliersApi.invite).toHaveBeenCalledWith({ email: 'fornitore@example.com', propertyIds: [LUGANO.id] }),
    );
  });

  it('shows the assigned properties by name', async () => {
    renderPage();

    expect(await screen.findByTestId(`property-${COMO.id}`)).toHaveTextContent(COMO.name);
  });
});

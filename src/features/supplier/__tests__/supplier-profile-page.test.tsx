import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Comune } from '@/types/comune.types';
import type { SupplierProfile } from '@/types/supplier';
import { SupplierProfilePage } from '../supplier-profile-page';

const api = vi.hoisted(() => ({ getStatus: vi.fn(), search: vi.fn(), getByIstatCode: vi.fn() }));
const supplier = vi.hoisted(() => ({
  profile: undefined as unknown,
  updateProfile: vi.fn(),
  uploadPhotos: vi.fn(),
}));

vi.mock('@/api/comuni.api', () => ({ COMUNE_SEARCH_MIN_LENGTH: 2, ComuniApi: api }));
vi.mock('@/queries/use-supplier', () => ({
  useSupplierProfile: () => ({ data: supplier.profile, isLoading: false }),
  useUpdateSupplierProfile: () => ({ mutateAsync: supplier.updateProfile, isPending: false }),
  useUploadSupplierPhotos: () => ({ mutateAsync: supplier.uploadPhotos, isPending: false }),
}));
vi.mock('@/queries/use-service-categories', () => ({ useServiceCategories: () => ({ data: undefined }) }));
vi.mock('@/features/service-requests/components/service-category-picker', () => ({
  ServiceCategoryPicker: () => null,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// A row of the official ISTAT list (ISTAT, 21/02/2026).
const COMO: Comune = {
  istatCode: '013075',
  cadastralCode: 'C933',
  name: 'Como',
  displayName: 'Como',
  provinceCode: 'CO',
  regionCode: 'LOM',
  regionIstatCode: '03',
  regionName: 'Lombardia',
  isActive: true,
};

function profile(patch: Partial<SupplierProfile> = {}): SupplierProfile {
  return {
    orgId: 'org-1',
    status: 'Active',
    legalName: 'Idraulica Rossi',
    vatNumber: 'IT01234567890',
    phone: '+390312345678',
    email: 'rossi@example.com',
    categories: [],
    comuni: ['Roma'],
    comuneIstatCodes: ['013075'],
    operatingComuni: [COMO],
    bio: '',
    photoUrls: [],
    ...patch,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <SupplierProfilePage />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getStatus.mockResolvedValue({ datasetAvailable: true });
  api.search.mockResolvedValue({ datasetAvailable: true, items: [] });
  supplier.profile = profile();
  supplier.updateProfile.mockResolvedValue({});
});

describe('SupplierProfilePage comuni', () => {
  it('shows the chosen comuni by name, province and region, and what was written as text apart', () => {
    renderPage();

    const comuni = screen.getByTestId('supplier-profile-comuni');
    expect(comuni).toHaveTextContent('Como (CO)');
    expect(comuni).toHaveTextContent('Roma');
  });

  it('saves the ISTAT codes of the chosen comuni and the text left, once the list is available', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Modifica profilo/ }));
    expect(await screen.findByTestId('supplier-comune-chip-013075')).toBeInTheDocument();
    // Roma was written as text and is not covered by a code: the supplier can drop it.
    fireEvent.click(await screen.findByRole('button', { name: 'Rimuovi Roma' }));
    fireEvent.click(screen.getByRole('button', { name: /Salva profilo/ }));

    await waitFor(() => expect(supplier.updateProfile).toHaveBeenCalledTimes(1));
    expect(supplier.updateProfile.mock.calls[0][0]).toMatchObject({ comuni: [], comuneIstatCodes: ['013075'] });
  });

  it('while the list is not imported leaves the stored ISTAT codes alone: they are not sent', async () => {
    api.getStatus.mockResolvedValue({ datasetAvailable: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Modifica profilo/ }));
    await screen.findByTestId('comune-picker-unavailable');
    fireEvent.change(screen.getByTestId('supplier-comuni-text'), { target: { value: 'Roma, Milano' } });
    fireEvent.click(screen.getByRole('button', { name: /Salva profilo/ }));

    await waitFor(() => expect(supplier.updateProfile).toHaveBeenCalledTimes(1));
    const payload = supplier.updateProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.comuni).toEqual(['Roma', 'Milano']);
    expect(payload).not.toHaveProperty('comuneIstatCodes');
  });
});

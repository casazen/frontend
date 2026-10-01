import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Comune } from '@/types/comune.types';
import { AdminSupplierInvitePage } from '../admin-supplier-invite-page';

const api = vi.hoisted(() => ({ getStatus: vi.fn(), search: vi.fn(), getByIstatCode: vi.fn() }));
const invite = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@/api/comuni.api', () => ({ COMUNE_SEARCH_MIN_LENGTH: 2, ComuniApi: api }));
vi.mock('@/queries/use-supplier', () => ({
  useInviteSupplier: () => ({ mutateAsync: invite.mutateAsync, isPending: false }),
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
const MILANO: Comune = {
  istatCode: '015146',
  cadastralCode: 'F205',
  name: 'Milano',
  displayName: 'Milano',
  provinceCode: 'MI',
  regionCode: 'LOM',
  regionIstatCode: '03',
  regionName: 'Lombardia',
  isActive: true,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <AdminSupplierInvitePage />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getStatus.mockResolvedValue({ datasetAvailable: true });
  api.search.mockResolvedValue({ datasetAvailable: true, items: [MILANO] });
  invite.mutateAsync.mockResolvedValue({ expiresAt: '2026-10-15T00:00:00Z' });
});

describe('AdminSupplierInvitePage', () => {
  it('invites the supplier for the comune picked from the official list, by its ISTAT code', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'idraulico@example.com' } });
    expect(screen.getByTestId('invite-submit-btn')).toBeDisabled();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'mila' } });
    fireEvent.mouseDown(await screen.findByTestId('comune-option-015146'));

    await waitFor(() => expect(screen.getByTestId('invite-submit-btn')).toBeEnabled());
    fireEvent.click(screen.getByTestId('invite-submit-btn'));

    await waitFor(() => expect(invite.mutateAsync).toHaveBeenCalledTimes(1));
    expect(invite.mutateAsync.mock.calls[0][0]).toMatchObject({ email: 'idraulico@example.com', comuneCode: '015146' });
    // The text field of old is only the fallback.
    expect(screen.queryByTestId('invite-comune-input')).not.toBeInTheDocument();
  });

  it('without the imported list asks for the code as text, as before, and says the list is not available', async () => {
    api.getStatus.mockResolvedValue({ datasetAvailable: false });
    renderPage();

    expect(await screen.findByTestId('comune-picker-unavailable')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'idraulico@example.com' } });
    fireEvent.change(screen.getByTestId('invite-comune-input'), { target: { value: '015146' } });
    fireEvent.click(screen.getByTestId('invite-submit-btn'));

    await waitFor(() => expect(invite.mutateAsync).toHaveBeenCalledTimes(1));
    expect(invite.mutateAsync.mock.calls[0][0]).toMatchObject({ comuneCode: '015146' });
  });
});

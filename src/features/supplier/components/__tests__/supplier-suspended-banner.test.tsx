import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { SupplierSuspendedBanner } from '../supplier-suspended-banner';

const api = vi.hoisted(() => ({ fetchSupplierProfile: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SupplierSuspendedBanner />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SupplierSuspendedBanner (SU-12, A4-29)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('SupplierSuspendedBanner_SuspendedSupplier_ExplainsTheSuspensionWithoutTheInternalReason', async () => {
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Suspended', suspensionReason: 'Nota interna' });
    renderBanner();

    const banner = await screen.findByTestId('supplier-suspended-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent('Account fornitore sospeso');
    expect(banner).toHaveTextContent('Contatta il supporto CasaZen');
    expect(banner).not.toHaveTextContent('Nota interna');
  });

  it('SupplierSuspendedBanner_SuspendedSupplierEnglish_IsTranslated', async () => {
    await i18n.changeLanguage('en');
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Suspended' });
    renderBanner();

    expect(await screen.findByTestId('supplier-suspended-banner')).toHaveTextContent('Supplier account suspended');
  });

  it.each(['Active', 'Pending'])('SupplierSuspendedBanner_%sSupplier_ShowsNothing', async (status) => {
    api.fetchSupplierProfile.mockResolvedValue({ status });
    renderBanner();

    await waitFor(() => expect(api.fetchSupplierProfile).toHaveBeenCalled());
    expect(screen.queryByTestId('supplier-suspended-banner')).not.toBeInTheDocument();
  });

  it('SupplierSuspendedBanner_ProfileFails_ShowsNothingAndDoesNotBlockThePage', async () => {
    api.fetchSupplierProfile.mockRejectedValue(new Error('boom'));
    renderBanner();

    await waitFor(() => expect(api.fetchSupplierProfile).toHaveBeenCalled());
    expect(screen.queryByTestId('supplier-suspended-banner')).not.toBeInTheDocument();
  });
});

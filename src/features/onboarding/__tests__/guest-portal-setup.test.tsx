import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { GuestPortalSetupEntry } from '../components/guest-portal-setup';

vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ isPending: false, isError: false, data: [{ id: 'p1', name: 'Casa Oliva' }] }),
}));

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: () => true }),
}));

it('resumes the server-persisted step and requires a deliberate supplier choice', async () => {
  await i18n.changeLanguage('it');
  const view = {
    brand: { name: 'Casa Oliva', logoUrl: null, primaryColor: null },
    hasGuide: true,
    complete: false,
    setup: {
      brandConfirmed: true, guideConfirmed: true, extrasConfirmed: true, regionalSuppliers: null as boolean | null,
      chatConfirmed: false, reviewsEnabled: null, otaRulesAcknowledged: false, hidePaidServicesOnAirbnb: false,
    },
  };
  const get = vi.spyOn(ApiClient, 'get').mockImplementation(async (url) => url.endsWith('guest-house-guide') ? {} : view);
  const put = vi.spyOn(ApiClient, 'put').mockImplementation(async () => {
    view.setup.regionalSuppliers = false;
    return { ...view, setup: { ...view.setup } };
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <I18nextProvider i18n={i18n}>
        <FeatureFlagsContext.Provider value={{ flags: DEFAULT_FEATURE_FLAGS, isLoading: false }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <GuestPortalSetupEntry />
            </MemoryRouter>
          </QueryClientProvider>
        </FeatureFlagsContext.Provider>
      </I18nextProvider>,
    );

    const open = screen.getByRole('button', { name: 'Configura' });
    fireEvent.click(open);
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByRole('heading', { name: 'Fornitori' });
    expect(dialog.getByRole('button', { name: 'Salva il passaggio' })).toBeDisabled();

    fireEvent.click(dialog.getByRole('button', { name: 'No', exact: true }));
    fireEvent.click(dialog.getByRole('button', { name: 'Salva il passaggio' }));
    await dialog.findByRole('heading', { name: 'Chat' });
    expect(put).toHaveBeenCalledWith('/properties/p1/guest-portal-setup/suppliers', { choice: false });
    expect(dialog.queryByText('Configurazione del portale completata.')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(open);
    expect(await screen.findByRole('heading', { name: 'Chat' })).toBeVisible();
  } finally {
    get.mockRestore();
    put.mockRestore();
  }
});

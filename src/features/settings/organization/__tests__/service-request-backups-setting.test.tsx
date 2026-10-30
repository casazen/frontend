import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { OrgsApi } from '@/api/orgs.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ServiceRequestBackupsSetting } from '../service-request-backups-setting';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({
  OrgsApi: { getServiceRequestSettings: vi.fn(), updateServiceRequestSettings: vi.fn() },
}));

function renderSetting(supplierRequestBackups: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, supplierRequestBackups }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <ServiceRequestBackupsSetting />
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

describe('the org switch for backup suppliers (SP-BKP)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(OrgsApi.getServiceRequestSettings).mockResolvedValue({ useBackupSuppliers: true });
    vi.mocked(OrgsApi.updateServiceRequestSettings).mockImplementation(async (settings) => settings);
    await i18n.changeLanguage('it');
  });

  it('ServiceRequestBackupsSetting_RuleOffOnTheServer_ShowsNothingAndAsksNothing', () => {
    renderSetting(false);

    expect(screen.queryByTestId('org-backups-section')).not.toBeInTheDocument();
    expect(OrgsApi.getServiceRequestSettings).not.toHaveBeenCalled();
  });

  it('ServiceRequestBackupsSetting_RuleOn_ShowsTheChoiceOfTheOrg_AndSavesWhenItIsMoved', async () => {
    renderSetting(true);

    const toggle = await screen.findByTestId('org-backups-switch');
    expect(screen.getByText('Invia le richieste anche a fornitori di riserva')).toBeInTheDocument();
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => expect(OrgsApi.updateServiceRequestSettings).toHaveBeenCalledWith({ useBackupSuppliers: false }));
    await waitFor(() => expect(screen.getByTestId('org-backups-switch')).not.toBeChecked());
  });
});

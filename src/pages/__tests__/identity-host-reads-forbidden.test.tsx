import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { BiometricSettingsCard } from '@/features/settings/components/biometric-settings-card';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { contextOf } from '@/test/org-contexts';
import type { BiometricSettings } from '@/types/biometric-settings.types';
import { PropertyQrCodePage } from '../PropertyQrCode';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

configure({ asyncUtilTimeout: 5_000 });

const PROPERTY = 'property-1';

const settings: BiometricSettings = {
  enabled: true,
  acceptThreshold: 0.85,
  escalateThreshold: 0.7,
  maxAttempts: 3,
  provisional: true,
  calibratedAt: null,
  isDefault: false,
};

type Reply = { status: number; data?: unknown };

let replies: Record<string, Reply> = {};
const onForbidden = vi.fn();

const adapter: AxiosAdapter = async (config) => {
  const { status, data } = replies[config.url ?? ''] ?? { status: 200, data: {} };
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

function renderWithRealApi(page: React.ReactNode, contexts: ContextBootstrapDto[] = [contextOf('short-rent')]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: true }, isLoading: false }}>
        <WorkspaceContext.Provider
          value={{
            contexts,
            activeContext: 'short-rent',
            isReady: true,
            setActiveContext: vi.fn(),
            hasPermission: () => true,
            getDefaultRoute: () => '/app/short-rent',
          }}
        >
          <MemoryRouter initialEntries={[`/app/short-rent/properties/${PROPERTY}/qr`]}>
            <Routes>
              <Route path="/app/short-rent/properties/:propertyId/qr" element={page} />
            </Routes>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  replies = {};
  axiosInstance.defaults.adapter = adapter;
  setApiAuthHandlers({ getAccessToken: async () => 'token' });
  setApiForbiddenHandler(onForbidden);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
});

describe('the host reads of the identity verification, with the real interceptor (post-merge review of E22/F02/US01)', () => {
  it('PropertyQrCodePage_TheServerAnswers403_SaysThePermissionIsMissingAndTheAppStaysWhereItIs', async () => {
    replies[`/properties/${PROPERTY}/door-qr`] = { status: 403 };

    renderWithRealApi(<PropertyQrCodePage />);

    expect(await screen.findByTestId('property-door-qr-message')).toHaveTextContent(i18n.t('property.qr.door.needsWrite'));
    expect(screen.queryByTestId('property-qr-code')).not.toBeInTheDocument();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_TheModelsAnswer403_SaysTheyCannotBeReadAndTheSettingsStayWhereTheyAre', async () => {
    replies['/settings/biometrics'] = { status: 200, data: settings };
    replies['/admin/biometrics/status'] = { status: 403 };

    renderWithRealApi(<BiometricSettingsCard />, [contextOf('short-rent'), contextOf('admin')]);

    expect(await screen.findByTestId('biometric-models-error')).toBeInTheDocument();
    expect(await screen.findByTestId('biometric-settings-form')).toBeInTheDocument();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('BiometricSettingsCard_TheSettingsAnswer403_SaysTheyCannotBeReadAndTheAppStaysWhereItIs', async () => {
    replies['/settings/biometrics'] = { status: 403 };

    renderWithRealApi(<BiometricSettingsCard />);

    expect(await screen.findByTestId('biometric-settings-error')).toBeInTheDocument();
    expect(screen.queryByTestId('biometric-settings-form')).not.toBeInTheDocument();
    expect(onForbidden).not.toHaveBeenCalled();
  });
});

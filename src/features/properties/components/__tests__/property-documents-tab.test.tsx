import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { OWNER } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { PropertyDetailDto } from '@/types';
import { PropertyDocumentsTab } from '../property-documents-tab';

vi.mock('@/api/questura-credentials.api', () => ({ questuraCredentialsApi: { getStatus: vi.fn(), set: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/onboarding-assist.api', () => ({
  onboardingAssistApi: { getIstatCredentialsStatus: vi.fn(), setIstatCredentials: vi.fn(), removeIstatCredentials: vi.fn(), reopenRequest: vi.fn() },
}));
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listPanelSteps: vi.fn(), listAssistRequests: vi.fn(), requestAssist: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The documents and the badge of the CIN are not what is asked here: the tab is, and what it draws and asks under them.
vi.mock('../property-documents-section', () => ({ PropertyDocumentsSection: () => null }));
vi.mock('../property-cin-badge', () => ({ PropertyCinBadge: () => null }));

const session = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: session.flags, isLoading: false }) }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts }) }));

const PROPERTY_ID = 'pppppppp-pppp-pppp-pppp-pppppppppppp';

function renderTab(country: 'IT' | 'CH' = 'IT', canWrite = true) {
  const property = { id: PROPERTY_ID, country, cinStatus: 'Missing', cinCode: null, documents: [] } as unknown as PropertyDetailDto;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PropertyDocumentsTab property={property} canWrite={canWrite} onEditCin={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  session.flags = { octorateOnboarding: false };
  session.contexts = OWNER;
  vi.mocked(questuraCredentialsApi.getStatus).mockReset().mockResolvedValue({ configured: false, configuredAt: null });
  vi.mocked(onboardingAssistApi.getIstatCredentialsStatus).mockReset().mockResolvedValue({ configured: false, configuredAt: null });
  vi.mocked(onboardingApi.listPanelSteps).mockReset().mockResolvedValue([]);
  vi.mocked(onboardingApi.listAssistRequests).mockReset().mockResolvedValue([]);
});

afterEach(cleanup);

// E20/F03/US02/T01: the regional ISTAT credentials are under the police ones while the activation of the channel manager is on, for a property in Italy, and nothing of them is drawn or asked otherwise.
describe('PropertyDocumentsTab, the credentials of the portals under the documents', () => {
  it('PropertyDocumentsTab_ActivationOnAndAPropertyInItaly_DrawsTheIstatCardUnderThePoliceOneAndReadsItsStatus', async () => {
    session.flags = { octorateOnboarding: true };
    const { container } = renderTab();

    await screen.findByTestId('istat-credentials-card');
    // Under the police credentials, not before them.
    const cards = Array.from(container.querySelectorAll('[data-testid$="-credentials-card"]')).map((card) => card.getAttribute('data-testid'));
    expect(cards).toEqual(['questura-credentials-card', 'istat-credentials-card']);
    await waitFor(() => expect(onboardingAssistApi.getIstatCredentialsStatus).toHaveBeenCalledWith(PROPERTY_ID));
    // The caller may write the property: the form is there, empty.
    expect(await screen.findByTestId('istat-credentials-form')).toBeInTheDocument();
  });

  it('PropertyDocumentsTab_ActivationOff_DrawsNoIstatCardAndAsksNothingOfTheirEndpoints', async () => {
    session.flags = { octorateOnboarding: false };
    renderTab();

    // The police credentials are the ones that were always there: the tab is the same, and the ISTAT ones are neither drawn nor asked (their endpoints answer 404 while the flag is off).
    expect(await screen.findByTestId('questura-credentials-card')).toBeInTheDocument();
    await waitFor(() => expect(questuraCredentialsApi.getStatus).toHaveBeenCalledWith(PROPERTY_ID));
    expect(screen.queryByTestId('istat-credentials-card')).not.toBeInTheDocument();
    expect(onboardingAssistApi.getIstatCredentialsStatus).not.toHaveBeenCalled();
    expect(onboardingApi.listPanelSteps).not.toHaveBeenCalled();
    expect(onboardingApi.listAssistRequests).not.toHaveBeenCalled();
  });

  it('PropertyDocumentsTab_APropertyInSwitzerland_DrawsNoIstatCardEvenWithTheActivationOn', async () => {
    session.flags = { octorateOnboarding: true };
    renderTab('CH');

    // The ISTAT is the Italian statistics of the stays: a Swiss property has no such credentials.
    expect(await screen.findByTestId('questura-credentials-card')).toBeInTheDocument();
    await waitFor(() => expect(questuraCredentialsApi.getStatus).toHaveBeenCalledWith(PROPERTY_ID));
    expect(screen.queryByTestId('istat-credentials-card')).not.toBeInTheDocument();
    expect(onboardingAssistApi.getIstatCredentialsStatus).not.toHaveBeenCalled();
    expect(onboardingApi.listPanelSteps).not.toHaveBeenCalled();
    expect(onboardingApi.listAssistRequests).not.toHaveBeenCalled();
  });

  it('PropertyDocumentsTab_WithoutThePermissionToWrite_ShowsTheStatusOfTheIstatCredentialsWithoutTheForm', async () => {
    session.flags = { octorateOnboarding: true };
    renderTab('IT', false);

    // `canWrite` is what the card gets as `canEdit`: the status is read, the credentials cannot be set, replaced or removed.
    expect(await screen.findByTestId('istat-credentials-status')).toBeInTheDocument();
    expect(screen.queryByTestId('istat-credentials-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('questura-credentials-form')).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
import { TICINO_LAYER_KIND } from '@/features/compliance/ticino/ticino-layer-address';
import { settleDrawer } from '@/test/drawer';
import { onboardingApi } from '@/api/onboarding.api';
import { guestRegistrationApi } from '@/api/guest-registration.api';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { propertiesApi } from '@/api/properties.api';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { OWNER } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { PropertyDetailDto } from '@/types';
import { PropertyDocumentsTab } from '../property-documents-tab';
import { card } from './guest-registration-fixtures';

vi.mock('@/api/questura-credentials.api', () => ({ questuraCredentialsApi: { getStatus: vi.fn(), set: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/guest-registration.api', () => ({ guestRegistrationApi: { get: vi.fn(), setOverride: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getDetail: vi.fn(), update: vi.fn() } }));
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
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts, hasPermission: () => true }) }));

const PROPERTY_ID = 'pppppppp-pppp-pppp-pppp-pppppppppppp';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function renderTab(country: 'IT' | 'CH' = 'IT', canWrite = true, extra: Partial<PropertyDetailDto> = {}, withDrawer = false) {
  const property = { id: PROPERTY_ID, country, cinStatus: 'Missing', cinCode: null, documents: [], ...extra } as unknown as PropertyDetailDto;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/short-rent/properties/p1?section=documents']}>
          <PropertyDocumentsTab property={property} canWrite={canWrite} onEditCin={vi.fn()} />
          {withDrawer ? <DetailDrawerHost /> : null}
          <Where />
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
  vi.mocked(guestRegistrationApi.get).mockReset().mockResolvedValue(card({ identifierMissing: ['ticino_structure_id_missing'] }));
  vi.mocked(propertiesApi.getDetail).mockReset().mockResolvedValue({ id: PROPERTY_ID, isInTicino: true, ticinoStructureId: null } as never);
});

afterEach(cleanup);

// E20/F03/US02/T01: the regional ISTAT credentials are under the police ones while the activation of the channel manager is on, for a property in Italy, and nothing of them is drawn or asked otherwise.
describe('PropertyDocumentsTab, the credentials of the portals under the documents', () => {
  it('PropertyDocumentsTab_ActivationOnAndAPropertyInItaly_DrawsTheIstatCardUnderThePoliceOneAndReadsItsStatus', async () => {
    session.flags = { octorateOnboarding: true };
    const { container } = renderTab();

    await screen.findByTestId('istat-credentials-card');
    const cards = Array.from(container.querySelectorAll('[data-testid$="-credentials-card"]')).map((card) => card.getAttribute('data-testid'));
    expect(cards).toEqual(['questura-credentials-card', 'istat-credentials-card']);
    await waitFor(() => expect(onboardingAssistApi.getIstatCredentialsStatus).toHaveBeenCalledWith(PROPERTY_ID));
    expect(await screen.findByTestId('istat-credentials-form')).toBeInTheDocument();
  });

  it('opens the sender for this property and the municipal portal for Como', () => {
    renderTab('IT', true, { comuneIstatCode: '013075' });
    expect(screen.getByRole('link', { name: 'Configura mittente e invio' })).toHaveAttribute('href', `/app/short-rent/compliance/sender?property=${PROPERTY_ID}`);
    expect(screen.getByRole('link', { name: 'Accedi a StayTour Como' })).toHaveAttribute('href', 'https://imposta-soggiorno.org/como/index_op.php');
  });

  it('uses the registered municipality before the free-text city', () => {
    renderTab('IT', false, { comuneIstatCode: '013030', city: 'Como' });
    expect(screen.queryByRole('link', { name: 'Accedi a StayTour Como' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Configura mittente e invio' })).toBeNull();
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

  it('PropertyDocumentsTab_APropertyInSwitzerland_AsksForNoItalianPoliceOrIstatCredentials', () => {
    session.flags = { octorateOnboarding: true };
    renderTab('CH');

    expect(screen.queryByTestId('questura-credentials-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('istat-credentials-card')).not.toBeInTheDocument();
    expect(questuraCredentialsApi.getStatus).not.toHaveBeenCalled();
    expect(onboardingAssistApi.getIstatCredentialsStatus).not.toHaveBeenCalled();
    expect(onboardingApi.listPanelSteps).not.toHaveBeenCalled();
    expect(onboardingApi.listAssistRequests).not.toHaveBeenCalled();
  });

  it('PropertyDocumentsTab_WithoutThePermissionToWrite_ShowsTheStatusOfTheIstatCredentialsWithoutTheForm', async () => {
    session.flags = { octorateOnboarding: true };
    renderTab('IT', false);

    expect(await screen.findByTestId('istat-credentials-status')).toBeInTheDocument();
    expect(screen.queryByTestId('istat-credentials-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('questura-credentials-form')).not.toBeInTheDocument();
  });
});

describe('PropertyDocumentsTab, the notification of the guests of a property in Switzerland', () => {
  const TICINO = { isInTicino: true, ticinoStructureId: null } as Partial<PropertyDetailDto>;

  it('PropertyDocumentsTab_SwissPropertyWithTheRegimesOn_ShowsTheCardInThePlaceOfTheGuidanceAndAsksTheStructureNumberOnce', async () => {
    session.flags = { guestRegistrationRegimes: true };
    renderTab('CH', true, TICINO);

    expect(await screen.findByTestId('guest-registration-summary')).toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-card')).toHaveAttribute('data-variant', 'page');
    expect(guestRegistrationApi.get).toHaveBeenCalledWith(PROPERTY_ID);
    expect(screen.queryByText(i18n.t('property.swissRegistration.title'))).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-registration-portal-link')).toHaveAttribute('target', '_blank');
    expect(await screen.findAllByTestId('ticino-structure-id-form')).toHaveLength(1);
    expect(screen.getByTestId('guest-registration-missing')).toHaveTextContent(i18n.t('guestRegistration.missing.ticino_structure_id_missing'));
    expect(screen.getByTestId('ticino-police-link')).toBeInTheDocument();
  });

  it('PropertyDocumentsTab_SwissPropertyWithTheRegimesOff_IsTheTabItAlwaysWasAndAsksNothingOfTheRegimes', async () => {
    session.flags = { guestRegistrationRegimes: false };
    renderTab('CH', true, TICINO);

    expect(await screen.findByText(i18n.t('property.swissRegistration.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-card')).not.toBeInTheDocument();
    expect(await screen.findAllByTestId('ticino-structure-id-form')).toHaveLength(1);
    expect(screen.getByTestId('ticino-police-link')).toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });

  it('PropertyDocumentsTab_ReaderOfASwissProperty_SeesTheCardWithNoFieldAndNoButtonToWrite', async () => {
    session.flags = { guestRegistrationRegimes: true };
    renderTab('CH', false, { isInTicino: true, ticinoStructureId: 'NL-555' });

    expect(await screen.findByTestId('guest-registration-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('ticino-structure-id-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-fix-municipality')).not.toBeInTheDocument();
  });

  it('PropertyDocumentsTab_PropertyInItalyWithTheRegimesOn_IsUntouched_NoCardAndNoCall', async () => {
    session.flags = { guestRegistrationRegimes: true };
    renderTab('IT');

    expect(await screen.findByTestId('questura-credentials-card')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-registration-card')).not.toBeInTheDocument();
    expect(guestRegistrationApi.get).not.toHaveBeenCalled();
  });
});

describe('PropertyDocumentsTab, the guided notification of a property in Ticino', () => {
  const ticino = { isInTicino: true, ticinoStructureId: 'NL-12345678' } as Partial<PropertyDetailDto>;

  it('PropertyDocumentsTab_PropertyInTicino_TheLinkIsTheAddressOfTheLayerOverTheCockpit', () => {
    renderTab('CH', false, ticino);

    expect(screen.getByTestId('ticino-police-link')).toHaveAttribute('href', `/app/short-rent/compliance?detail=ticino:${PROPERTY_ID}`);
  });

  it('PropertyDocumentsTab_APropertyNotInTicino_HasNoLinkToTheNotification', () => {
    renderTab('CH', false, { isInTicino: false } as Partial<PropertyDetailDto>);

    expect(screen.queryByTestId('ticino-police-link')).not.toBeInTheDocument();
  });

  it('PropertyDocumentsTab_PageWithTheDrawer_TheLinkOpensTheLayerInPlaceAndTheAddressKeepsTheOtherParameters', async () => {
    const unregister = registerDetail(TICINO_LAYER_KIND, { title: 'swiss.layer.title', Content: () => <p>layer</p> });
    renderTab('CH', false, ticino, true);

    fireEvent.click(screen.getByTestId('ticino-police-link'));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/properties/p1?section=documents&detail=ticino:${PROPERTY_ID}`));
    expect(await screen.findByRole('dialog', { name: 'Notifica alla polizia (Ticino)' })).toBeInTheDocument();
    unregister();
    cleanup();
    await settleDrawer();
  });
});

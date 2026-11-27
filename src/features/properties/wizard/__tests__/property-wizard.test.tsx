import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { Property } from '@/types';
import type { ComplianceActivationResult } from '@/types/compliance.types';
import { PropertyWizard } from '../property-wizard';
import type { WizardListingSeed } from '../property-wizard-model';

const { flags, createMock, saveMock, saveTextsMock, ownerReadinessMock, entitlement, org, workspace, activation, toast, ADOPTED } = vi.hoisted(() => ({
  flags: { octorateConnector: false, octorateOnboarding: true },
  createMock: vi.fn(),
  ownerReadinessMock: vi.fn(),
  entitlement: { data: undefined as { isAgency: boolean } | undefined },
  org: { id: 'o1', isAgency: false, planTier: 'Pro' },
  workspace: { contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] },
  activation: { data: undefined as ComplianceActivationResult | undefined },
  saveMock: vi.fn(),
  saveTextsMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  ADOPTED: {
    property: { listingTitle: 'Trullo con piscina', description: 'Descrizione presa dal canale', houseRules: 'Regole prese dal canale' },
    siteProfile: { translations: { en: { title: 'Trullo with pool', description: 'Description taken from the channel' } } },
  },
}));

vi.mock('@/api/owner-onboarding.api', () => ({ ownerOnboardingApi: { getReadiness: ownerReadinessMock } }));
vi.mock('../steps/owner-step', () => ({ OwnerStep: ({ canAssign }: { canAssign: boolean }) => <div>{canAssign ? 'Owner assignment' : 'Owner check'}</div> }));
vi.mock('../steps/finish-step', () => ({ FinishStep: () => null }));
vi.mock('../property-wizard-done', () => ({ PropertyWizardDone: () => <div>Draft saved</div> }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags, isLoading: false }) }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, org }),
  useEntitlement: (enabled = true) => enabled ? entitlement : { data: undefined },
}));
vi.mock('@/queries/use-properties', () => ({
  usePlanUsage: () => ({ data: { used: 0, max: null, unlimited: true, canAdd: true } }),
  useCancellationPolicies: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('../use-wizard-property', () => ({
  useWizardCreateProperty: () => ({ mutateAsync: createMock }),
  useWizardSaveProperty: () => ({ mutateAsync: saveMock }),
}));
vi.mock('@/queries/use-listing-data', () => ({
  useSavePropertyRooms: () => ({ mutateAsync: vi.fn() }),
  useSaveStayDiscounts: () => ({ mutateAsync: vi.fn() }),
  usePropertyRooms: () => ({ data: undefined }),
}));
vi.mock('@/queries/use-site-profile', () => ({
  useSaveListingTexts: () => ({ mutateAsync: saveTextsMock }),
  useSavePhotoMeta: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/features/compliance/use-compliance', () => ({
  useComplianceActivation: () => ({ data: activation.data, isError: false, refetch: vi.fn() }),
  useCompleteComplianceActivation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));
vi.mock('../steps/channels-step', () => ({
  ChannelsStep: (props: { onAdopted?: (adopted: unknown) => void; goTo: (stepId: string) => void }) => (
    <div>
      <button type="button" data-testid="stub-take" onClick={() => props.onAdopted?.(ADOPTED)}>
        take
      </button>
      <button type="button" data-testid="stub-to-texts" onClick={() => props.goTo('descriptions')}>
        texts
      </button>
    </div>
  ),
}));
vi.mock('../steps/descriptions-step', () => ({ DescriptionsStep: () => null }));
vi.mock('../steps/rules-step', () => ({ RulesStep: () => null }));
vi.mock('../steps/prices-step', () => ({ PricesStep: () => null }));

const PROPERTY = {
  id: 'p1',
  name: 'Trullo dei Mandorli',
  address: 'Via Roma 1',
  city: 'Como',
  comuneIstatCode: '013075',
  maxGuests: 4,
  bedrooms: 1,
  beds: 2,
  bathrooms: 1,
  amenities: [],
  photoUrls: [],
  listingTitle: 'Trullo dei Mandorli',
  description: 'Descrizione vecchia scritta in CasaZen',
  houseRules: 'Regole vecchie scritte in CasaZen',
  nightlyRate: 100,
  cleaningFee: 0,
} as unknown as Property;

const SEED: WizardListingSeed = {
  rooms: [],
  stayDiscounts: [],
  photoMeta: [],
  siteProfile: { translations: { en: { title: 'Old title', description: 'Old description written in CasaZen' } } } as unknown as WizardListingSeed['siteProfile'],
};

const inventoryWorkspace: WorkspaceContextValue = {
  contexts: [], activeContext: 'short-rent', isReady: true, setActiveContext: () => undefined,
  hasPermission: () => true, getDefaultRoute: () => '/app/short-rent',
};

function PlanLocation() {
  return <p data-testid="plan-arrival">{useLocation().hash}</p>;
}

function open(search = '') {
  return render(
    <WorkspaceContext.Provider value={inventoryWorkspace}>
      <MemoryRouter initialEntries={[`/app/short-rent/properties/create${search}`]}>
      <Routes>
        <Route path="/app/short-rent/properties/create" element={<PropertyWizard />} />
        <Route path="/app/short-rent/properties" element={<p>Elenco immobili</p>} />
        <Route path="/app/short-rent/onboarding" element={<PlanLocation />} />
      </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

function openOnTheChannels() {
  window.history.replaceState({}, '', '/app/short-rent/properties/create?propertyId=p1&step=channels');
  return render(
    <MemoryRouter initialEntries={['/app/short-rent/properties/create?propertyId=p1&step=channels']}>
      <Routes>
        <Route path="/app/short-rent/properties/create" element={<PropertyWizard property={PROPERTY} listing={SEED} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const step = () => screen.getByTestId('property-wizard').getAttribute('data-step');

describe('PropertyWizard (E02/F03/US01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    createMock.mockReset();
    saveMock.mockReset();
    saveMock.mockResolvedValue(undefined);
    saveTextsMock.mockReset();
    saveTextsMock.mockResolvedValue(undefined);
    toast.success.mockReset();
    flags.octorateConnector = false;
    entitlement.data = undefined;
    org.isAgency = false;
    org.planTier = 'Pro';
    workspace.contexts[0].roleKey = 'org_owner';
    activation.data = undefined;
    ownerReadinessMock.mockReset();
  });

  it.each([
    ['an administrator', 'org_owner', 'Owner assignment'],
    ['a property manager without the billing entitlement', 'org_manager', 'Owner check'],
  ])('requires an owner for %s and verifies the persisted assignment', async (_, roleKey, ownerStepText) => {
    workspace.contexts[0].roleKey = roleKey;
    org.isAgency = true;
    org.planTier = 'Agency';
    if (roleKey === 'org_owner') entitlement.data = { isAgency: true };
    ownerReadinessMock.mockResolvedValue({ summary: { owners: 0, properties: 1 }, properties: [], truncated: false });
    window.history.replaceState({}, '', '/app/short-rent/properties/create?propertyId=p1&step=owner');
    render(<MemoryRouter initialEntries={['/app/short-rent/properties/create?propertyId=p1&step=owner']}>
      <PropertyWizard property={PROPERTY} onlySteps={['finish']} />
    </MemoryRouter>);
    expect(screen.getByText(ownerStepText)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(ownerReadinessMock).toHaveBeenCalledOnce());
    expect(await screen.findByText(i18n.t('propertyWizard.errors.saveFailed'))).toBeInTheDocument();
    expect(step()).toBe('owner');
  });

  it('allows an agency to leave an incomplete property in draft without declaring its owner', async () => {
    entitlement.data = { isAgency: true };
    activation.data = { complianceStatus: 'Pending', steps: [{ id: 'cin', label: 'CIN', status: 'pending', blocker: true }] };
    const path = '/app/short-rent/properties/create?propertyId=p1&step=finish';
    window.history.replaceState({}, '', path);
    render(<MemoryRouter initialEntries={[path]}>
      <PropertyWizard property={PROPERTY} onlySteps={['finish']} />
    </MemoryRouter>);
    fireEvent.click(screen.getByTestId('property-wizard-finish'));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    expect(ownerReadinessMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('returns to the exact inventory task when the property wizard was opened from the plan', () => {
    open('?planPart=listings');
    fireEvent.click(screen.getByTestId('property-wizard-save-close'));
    expect(screen.getByTestId('plan-arrival')).toHaveTextContent('#passo-listings');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('firstStep_SaveAndExitIsThereToo_NothingIsSavedSoItOnlyExits', () => {
    open();

    expect(screen.getByTestId('property-wizard')).toHaveAttribute('data-step', 'base');
    fireEvent.click(screen.getByTestId('property-wizard-save-close'));

    expect(screen.getByText('Elenco immobili')).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Le risposte del primo passo restano qui'));
  });

  it('steps_TheChannelsStepIsThereOnlyWhereTheChannelManagerIsConnected', () => {
    const { unmount } = open();
    for (const label of ['Dati base', 'Foto', 'Dotazioni', 'Testi', 'Regole', 'Prezzi', 'Attivazione']) {
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
    }
    expect(screen.queryAllByText('Canali')).toHaveLength(0);
    unmount();

    flags.octorateConnector = true;
    open();
    expect(screen.getAllByText('Canali').length).toBeGreaterThan(0);
  });

  it('descriptions_TheTextsAreRequiredOnlyWhereTheChannelManagerIsConnected', () => {
    const { unmount } = open('?step=descriptions');
    expect(step()).toBe('descriptions');
    expect(screen.getByTestId('wizard-skip')).toBeInTheDocument();
    unmount();

    flags.octorateConnector = true;
    open('?step=descriptions');
    expect(step()).toBe('descriptions');
    expect(screen.queryByTestId('wizard-skip')).not.toBeInTheDocument();
  });

  it('descriptionsEmpty_WithTheChannelManagerOff_AvantiAsksNothing_WithItOnItNamesWhatIsMissing', async () => {
    const empty = { ...PROPERTY, listingTitle: null, description: '', houseRules: null } as unknown as Property;
    window.history.replaceState({}, '', '/app/short-rent/properties/create?propertyId=p1&step=descriptions');
    const reopen = () =>
      render(
        <MemoryRouter initialEntries={['/app/short-rent/properties/create?propertyId=p1&step=descriptions']}>
          <Routes>
            <Route path="/app/short-rent/properties/create" element={<PropertyWizard property={empty} />} />
          </Routes>
        </MemoryRouter>,
      );

    const { unmount } = reopen();
    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(step()).toBe('rules'));
    expect(saveMock).toHaveBeenCalledWith({ id: 'p1', data: { listingTitle: null, description: '' } });
    unmount();

    flags.octorateConnector = true;
    reopen();
    fireEvent.click(screen.getByTestId('property-wizard-next'));
    expect(await screen.findByTestId('wizard-error-summary')).toHaveTextContent('Scrivi il titolo in italiano.');
    expect(step()).toBe('descriptions');
  });

  it('afterTheHostTookTheChannelsTexts_TheTextsAndTheRulesStepsDoNotSendTheOldOnesBack', async () => {
    flags.octorateConnector = true;
    openOnTheChannels();
    expect(step()).toBe('channels');

    fireEvent.click(screen.getByTestId('stub-take'));
    fireEvent.click(screen.getByTestId('stub-to-texts'));
    await waitFor(() => expect(step()).toBe('descriptions'));

    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(step()).toBe('rules'));
    expect(saveMock).toHaveBeenCalledWith({ id: 'p1', data: { listingTitle: 'Trullo con piscina', description: 'Descrizione presa dal canale' } });
    expect(saveTextsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(step()).toBe('prices'));
    expect(saveMock).toHaveBeenCalledWith({ id: 'p1', data: expect.objectContaining({ houseRules: 'Regole prese dal canale' }) });

    for (const [request] of saveMock.mock.calls as Array<[{ data: Record<string, unknown> }]>) {
      expect(request.data.description).not.toBe('Descrizione vecchia scritta in CasaZen');
      expect(request.data.houseRules).not.toBe('Regole vecchie scritte in CasaZen');
    }
  });

  it('withoutTheChoice_TheTextsOfTheFormAreTheHostsOwn_AndAreSavedAsTheyAre', async () => {
    flags.octorateConnector = true;
    openOnTheChannels();

    fireEvent.click(screen.getByTestId('stub-to-texts'));
    await waitFor(() => expect(step()).toBe('descriptions'));
    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(step()).toBe('rules'));

    expect(saveMock).toHaveBeenCalledWith({ id: 'p1', data: { listingTitle: 'Trullo dei Mandorli', description: 'Descrizione vecchia scritta in CasaZen' } });
  });
});

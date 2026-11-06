import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { Property } from '@/types';
import { PropertyWizard } from '../property-wizard';
import type { WizardListingSeed } from '../property-wizard-model';

const { flags, createMock, saveMock, saveTextsMock, toast, ADOPTED } = vi.hoisted(() => ({
  flags: { octorateConnector: false },
  createMock: vi.fn(),
  saveMock: vi.fn(),
  saveTextsMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  // What the server holds after the host took the descriptions of the channel manager («Prendi la nuova versione»).
  ADOPTED: {
    property: { listingTitle: 'Trullo con piscina', description: 'Descrizione presa dal canale', houseRules: 'Regole prese dal canale' },
    siteProfile: { translations: { en: { title: 'Trullo with pool', description: 'Description taken from the channel' } } },
  },
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags, isLoading: false }) }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, org: { id: 'o1' } }),
  useEntitlement: () => ({ data: undefined }),
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
  useComplianceActivation: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
  useCompleteComplianceActivation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));
// The steps that talk about the texts are not under test here, only what the wizard keeps of them between one step and the next: the
// channels step stands in for the choice about a change made outside CasaZen, the other two have no fields (the form holds the values).
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

function open(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/app/short-rent/properties/create${search}`]}>
      <Routes>
        <Route path="/app/short-rent/properties/create" element={<PropertyWizard />} />
        <Route path="/app/short-rent/properties" element={<p>Elenco immobili</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The wizard reopened on a property that is already on the channels, at the step of the channels. */
function openOnTheChannels() {
  // The wizard keeps the property in the address of the browser (not the router's): in a test they must say the same, or `?step=` is dropped.
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
  });

  it('firstStep_SaveAndExitIsThereToo_NothingIsSavedSoItOnlyExits', () => {
    open();

    expect(screen.getByTestId('property-wizard')).toHaveAttribute('data-step', 'base');
    fireEvent.click(screen.getByTestId('property-wizard-save-close'));

    expect(screen.getByText('Elenco immobili')).toBeInTheDocument();
    // Nothing is created by leaving, and the host is not told that something was saved.
    expect(createMock).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Le risposte del primo passo restano qui'));
  });

  it('steps_TheChannelsStepIsThereOnlyWhereTheChannelManagerIsConnected', () => {
    const { unmount } = open();
    // Not connected (the production default): the wizard has the steps it always had, plus the texts.
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
    // Not connected (the production default): the step can be left out, as the title and the description of the photos step always could.
    const { unmount } = open('?step=descriptions');
    expect(step()).toBe('descriptions');
    expect(screen.getByTestId('wizard-skip')).toBeInTheDocument();
    unmount();

    // Connected: the channels take no listing without them, so the step cannot be skipped.
    flags.octorateConnector = true;
    open('?step=descriptions');
    expect(step()).toBe('descriptions');
    expect(screen.queryByTestId('wizard-skip')).not.toBeInTheDocument();
  });

  it('descriptionsEmpty_WithTheChannelManagerOff_AvantiAsksNothing_WithItOnItNamesWhatIsMissing', async () => {
    // The wizard reopened on a property with no title and no description at all, at the step of the texts.
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
    // Nothing was asked for, and the host's empty texts are saved as they are (the listing then uses the name).
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

    // «Prendi la nuova versione»: the server now holds the texts of the channel manager; then the host goes back to read them.
    fireEvent.click(screen.getByTestId('stub-take'));
    fireEvent.click(screen.getByTestId('stub-to-texts'));
    await waitFor(() => expect(step()).toBe('descriptions'));

    fireEvent.click(screen.getByTestId('property-wizard-next'));
    await waitFor(() => expect(step()).toBe('rules'));
    expect(saveMock).toHaveBeenCalledWith({ id: 'p1', data: { listingTitle: 'Trullo con piscina', description: 'Descrizione presa dal canale' } });
    // The texts of the other languages are the ones the server holds as well: nothing to send.
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

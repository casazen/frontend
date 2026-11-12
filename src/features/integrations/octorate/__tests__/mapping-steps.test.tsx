import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { octorateApi } from '@/api/octorate.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { expectNoAxeViolations } from '@/test/axe';
import { writeWizardDraft } from '@/lib/wizard-draft';
import type { PropertyIcalFeed } from '@/types/property-ical';
import type { MappingDecision } from '../mapping-model';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';
import {
  SCOPE,
  WAIT,
  WIZARD_DRAFT_ID,
  axiosError,
  connection,
  linkedListing,
  listing,
  newListing,
  onStep,
  property,
  renderWizard,
} from './octorate-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/octorate.api', () => ({
  octorateApi: {
    getConnectionStatus: vi.fn(),
    startConnect: vi.fn(),
    completeConnect: vi.fn(),
    disconnect: vi.fn(),
    getFoundListings: vi.fn(),
    refreshListings: vi.fn(),
    confirmMapping: vi.fn(),
    setMappingRoom: vi.fn(),
    rejectMapping: vi.fn(),
    importListing: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getFeeds: vi.fn() } }));
// The draft of the wizard is also kept on the server (ADR-024): nothing is stored there in these tests, the browser copy is what they read.
vi.mock('@/api/wizard-draft.api', () => ({
  WIZARD_DRAFTS_KEY: ['wizard-drafts'],
  wizardDraftApi: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ status: 'saved', version: 1, lastSavedAt: '2026-11-10T10:00:00Z' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

// A whole wizard is rendered in these tests (and checked with axe): the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const TWO_ROOMS = [
  { id: 'room-1', name: 'Doppia', maxGuests: 2 },
  { id: 'room-2', name: 'Suite', maxGuests: 4 },
];

const nextButton = () => screen.getByTestId('octorate-connect-next');
const finishButton = () => screen.getByTestId('octorate-connect-finish');
const wizardText = () => screen.getByTestId('octorate-connect-wizard').textContent ?? '';
const radio = (choice: string, listingId = 'acc-1') => screen.getByTestId(`octorate-mapping-${choice}-${listingId}`);

/** A decision of the host, as the wizard keeps it in its draft. */
function decision(overrides: Partial<MappingDecision> = {}): MappingDecision {
  return { listingId: 'acc-1', action: 'confirm', propertyId: 'prop-1', other: false, needsRoom: false, roomId: '', ...overrides };
}

/** The wizard opened on a step, with the first answer and the decisions already in its draft (the host left it there). */
function renderAt(step: string, decisions: MappingDecision[] = []) {
  writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step, values: { scenario: 'onOctorate', decisions } });
  return renderWizard(`${OCTORATE_CONNECT_PATH}?step=${step}`);
}

function feed(overrides: Partial<PropertyIcalFeed> = {}): PropertyIcalFeed {
  return { id: 'feed-1', channel: 'Airbnb', createdAt: '2026-10-01T08:00:00Z', blockCount: 2, ...overrides };
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Connected' }));
  vi.mocked(octorateApi.getFoundListings).mockResolvedValue([]);
  vi.mocked(octorateApi.refreshListings).mockResolvedValue([]);
  vi.mocked(octorateApi.confirmMapping).mockResolvedValue(undefined);
  vi.mocked(octorateApi.setMappingRoom).mockResolvedValue(undefined);
  vi.mocked(octorateApi.rejectMapping).mockResolvedValue(undefined);
  vi.mocked(octorateApi.importListing).mockResolvedValue({ propertyId: 'prop-9' });
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
  vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('channels found: what the channel manager holds (NF-28)', () => {
  it('OctorateChannelsFound_EachListing_ShowsItsOneStateInSimpleWordsAndItsChannelsWithTheirState', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu', status: 'Ambiguous', proposedProperty: null }),
      newListing(),
      linkedListing({
        octorateAccommodationId: 'acc-3',
        name: 'Attico',
        channels: [
          { channelId: '4', externalId: 'expedia-1', state: 'Connected' },
          { channelId: '999', externalId: 'other-1', state: 'Pending' },
        ],
      }),
      linkedListing({ octorateAccommodationId: 'acc-5', name: 'Villa Mare' }),
    ]);
    renderAt('channels');

    expect(await screen.findByTestId('octorate-channels-count', undefined, WAIT)).toHaveTextContent(
      i18n.t('octorate.connect.channelsFound.count', { count: 5 }),
    );

    const proposed = within(screen.getByTestId('octorate-channels-listing-acc-1'));
    expect(proposed.getByTestId('octorate-listing-state-toConfirm')).toHaveTextContent(i18n.t('octorate.connect.channelsFound.state.toConfirm.label'));
    const ambiguous = within(screen.getByTestId('octorate-channels-listing-acc-2'));
    expect(ambiguous.getByTestId('octorate-listing-state-toChoose')).toBeInTheDocument();
    expect(within(screen.getByTestId('octorate-channels-listing-acc-new')).getByTestId('octorate-listing-state-new')).toBeInTheDocument();
    const linked = within(screen.getByTestId('octorate-channels-listing-acc-3'));
    expect(linked.getByTestId('octorate-listing-state-linked')).toBeInTheDocument();
    expect(linked.getByTestId('octorate-channel-4')).toHaveTextContent('Expedia');
    // A channel CasaZen cannot name is shown by its code, and a state the channel manager reports that CasaZen does not know is "to check".
    expect(linked.getByTestId('octorate-channel-999')).toHaveTextContent(i18n.t('octorate.connect.channelsFound.channels.other', { code: '999' }));
    expect(linked.getByTestId('octorate-channel-999')).toHaveTextContent(i18n.t('octorate.connect.channelsFound.onChannel.other'));
    // The channels the server read when the listing was linked, each with its state.
    const both = within(screen.getByTestId('octorate-channels-listing-acc-5'));
    expect(both.getByTestId('octorate-channel-142')).toHaveTextContent('Booking.com');
    expect(both.getByTestId('octorate-channel-142')).toHaveTextContent(i18n.t('octorate.connect.channelsFound.onChannel.connected'));
    expect(both.getByTestId('octorate-channel-274')).toHaveTextContent('Airbnb');
    // The channel manager is "your channel manager", never named (NF-12); nothing is sent by looking.
    expect(wizardText()).not.toMatch(/octorate/i);
    expect(octorateApi.refreshListings).not.toHaveBeenCalled();
  });

  it('OctorateChannelsFound_ListingNotLinkedYet_NeverSaysItIsOnNoChannelBecauseTheServerHasNotReadThemYet', async () => {
    // The server reads the channels of a listing when a person confirms or imports it: until then the list is empty for every listing
    // found, and "no channel" would be a claim nobody has checked.
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu', status: 'Ambiguous', proposedProperty: null }),
      newListing(),
      listing({ octorateAccommodationId: 'acc-4', name: 'Casa Gialla', status: 'Rejected', proposedProperty: null }),
      linkedListing({ octorateAccommodationId: 'acc-6', name: 'Mansarda', channels: [] }),
    ]);
    renderAt('channels');
    await screen.findByTestId('octorate-channels-count', undefined, WAIT);

    const never = i18n.t('octorate.connect.channelsFound.noChannels');
    const later = i18n.t('octorate.connect.channelsFound.channelsAfterLink');
    for (const id of ['acc-1', 'acc-2', 'acc-new']) {
      const card = within(screen.getByTestId(`octorate-channels-listing-${id}`));
      expect(card.getByText(later)).toBeInTheDocument();
      expect(card.queryByText(never)).not.toBeInTheDocument();
      expect(card.queryByTestId('octorate-channel-142')).not.toBeInTheDocument();
    }
    // A listing the host excluded is not going to be linked: nothing about channels.
    const excluded = within(screen.getByTestId('octorate-channels-listing-acc-4'));
    expect(excluded.getByTestId('octorate-listing-state-excluded')).toBeInTheDocument();
    expect(excluded.queryByText(later)).not.toBeInTheDocument();
    expect(excluded.queryByText(never)).not.toBeInTheDocument();
    // Only a listing that is linked, and read, with no channel is on none.
    const linked = within(screen.getByTestId('octorate-channels-listing-acc-6'));
    expect(linked.getByText(never)).toBeInTheDocument();
    expect(linked.queryByText(later)).not.toBeInTheDocument();
    expect(screen.getAllByText(never)).toHaveLength(1);
  });

  it('OctorateChannelsFound_ProposalThatIsNotAShortRentProperty_IsNotNamedAndTheListingReadsAsNew', async () => {
    // The next step does not offer a long-rent property: this one does not name it either.
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({ proposedProperty: { id: 'prop-long', name: 'Casa Lunga', address: 'Via Po 9', city: 'Torino' } }),
    ]);
    renderAt('channels');

    const card = within(await screen.findByTestId('octorate-channels-listing-acc-1', undefined, WAIT));
    expect(card.getByTestId('octorate-listing-state-new')).toBeInTheDocument();
    expect(card.queryByText(/Casa Lunga/)).not.toBeInTheDocument();
  });

  it('OctorateChannelsFound_NothingStoredYet_ReadsTheChannelManagerOnceWithoutBeingAsked', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValueOnce([]).mockResolvedValue([listing()]);
    vi.mocked(octorateApi.refreshListings).mockResolvedValue([listing()]);
    renderAt('channels');

    expect(await screen.findByTestId('octorate-channels-listing-acc-1', undefined, WAIT)).toBeInTheDocument();

    expect(octorateApi.refreshListings).toHaveBeenCalledTimes(1);
  });

  it('OctorateChannelsFound_RefreshButton_ReadsTheChannelManagerAgain', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    vi.mocked(octorateApi.refreshListings).mockResolvedValue([listing()]);
    renderAt('channels');
    fireEvent.click(await screen.findByTestId('octorate-channels-refresh', undefined, WAIT));

    await waitFor(() => expect(octorateApi.refreshListings).toHaveBeenCalledTimes(1), WAIT);
    expect(await screen.findByTestId('octorate-channels-listing-acc-1', undefined, WAIT)).toBeInTheDocument();
  });

  it('OctorateChannelsFound_ReadThatFails_SaysSoInTheWordsOfTheApp', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    vi.mocked(octorateApi.refreshListings).mockRejectedValue(axiosError(409, { code: 'octorate_not_connected' }));
    renderAt('channels');
    fireEvent.click(await screen.findByTestId('octorate-channels-refresh', undefined, WAIT));

    expect(await screen.findByTestId('octorate-channels-read-failed', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.octorateNotConnected'));
    // What was found stays on the screen.
    expect(screen.getByTestId('octorate-channels-listing-acc-1')).toBeInTheDocument();
  });

  it('OctorateChannelsFound_ChannelManagerNotConnected_SaysSoAndLeadsBackToTheConsent', async () => {
    vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection());
    renderAt('channels');

    expect(await screen.findByTestId('octorate-channels-not-connected', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.getFoundListings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('octorate.connect.channelsFound.notConnected.action') }));

    await onStep('consent');
  });
});

describe('mapping: which CasaZen property each listing is (NF-28, NF-04)', () => {
  it('OctorateMapping_ProposedListing_ShowsTheProposalAndLetsTheHostConfirmChooseAnotherOrImport', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    renderAt('mapping');

    const proposal = await screen.findByTestId('octorate-mapping-proposal-acc-1', undefined, WAIT);
    expect(proposal).toHaveTextContent('Casa Rosa');
    expect(proposal).toHaveTextContent('Via Roma 12');
    // The capacity of the property comes from the host's own properties.
    await waitFor(() => expect(proposal).toHaveTextContent(i18n.t('octorate.connect.channelsFound.capacity', { count: 4 })), WAIT);

    // Four answers, and nobody has confirmed anything: "later" is where a listing stays until a person decides.
    for (const choice of ['confirm', 'other', 'import', 'later']) expect(radio(choice)).toBeInTheDocument();
    expect(radio('later')).toBeChecked();
    expect(radio('confirm')).not.toBeChecked();
    fireEvent.click(radio('confirm'));
    await waitFor(() => expect(radio('confirm')).toBeChecked(), WAIT);
    expect(radio('later')).not.toBeChecked();
    // A listing with one room asks nothing about rooms.
    expect(screen.queryByTestId('octorate-mapping-room-acc-1')).not.toBeInTheDocument();
    // Nothing is sent from this step.
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
    expect(wizardText()).not.toMatch(/octorate/i);
  });

  it('OctorateMapping_AmbiguousListing_CanBeLeftForLaterAndSaysThatWritesStayBlocked', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({
        octorateAccommodationId: 'acc-2',
        name: 'Casa Blu',
        status: 'Ambiguous',
        proposedProperty: null,
        candidates: [
          { id: 'prop-1', name: 'Casa Rosa', address: 'Via Roma 12', city: 'Milano' },
          { id: 'prop-2', name: 'Casa Rossa', address: 'Via Roma 14', city: 'Milano' },
        ],
      }),
    ]);
    renderAt('mapping');

    await screen.findByTestId('octorate-mapping-row-acc-2', undefined, WAIT);
    // Close candidates and no proposal: the host chooses, or leaves it for later and it stays to do.
    expect(screen.queryByTestId('octorate-mapping-confirm-acc-2')).not.toBeInTheDocument();
    expect(radio('later', 'acc-2')).toBeChecked();
    expect(screen.getByText(i18n.t('octorate.connect.mapping.choice.laterBlocked'))).toBeInTheDocument();

    // Leaving it for later does not stop the host from going on.
    fireEvent.click(nextButton());
    await onStep('summary');
    expect(screen.queryByTestId('wizard-error-summary')).not.toBeInTheDocument();
  });

  it('OctorateMapping_ChooseAnotherProperty_OffersTheHostsPropertiesAndNotTheOnesAlreadyLinked', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      linkedListing({
        octorateAccommodationId: 'acc-9',
        name: 'Altra villa',
        proposedProperty: { id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' },
      }),
    ]);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([
      property(),
      property({ id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino', maxGuests: 2 }),
      property({ id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' }),
    ]);
    renderAt('mapping');
    await screen.findByTestId('octorate-mapping-row-acc-1', undefined, WAIT);

    fireEvent.click(radio('other'));
    const select = await screen.findByTestId('octorate-mapping-property-acc-1', undefined, WAIT);
    await waitFor(() => expect(within(select).getByRole('option', { name: /Casa Blu/ })).toBeEnabled(), WAIT);

    // A property confirmed to another listing cannot be picked: the server would answer 409.
    expect(within(select).getByRole('option', { name: /Casa Verde/ })).toBeDisabled();
    fireEvent.change(select, { target: { value: 'prop-2' } });
    await waitFor(() => expect(select).toHaveValue('prop-2'), WAIT);

    fireEvent.click(nextButton());
    await onStep('summary');
    expect(
      await screen.findByText(i18n.t('octorate.connect.summary.linkedLine', { listing: 'Villa Rosa', property: 'Casa Blu' }), undefined, WAIT),
    ).toBeInTheDocument();
  });

  it('OctorateMapping_ChooseAnotherPropertyWithoutPickingOne_DoesNotMoveOnAndSaysWhy', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    renderAt('mapping');
    await screen.findByTestId('octorate-mapping-row-acc-1', undefined, WAIT);

    fireEvent.click(radio('other'));
    await screen.findByTestId('octorate-mapping-property-acc-1', undefined, WAIT);
    fireEvent.click(nextButton());

    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(
      i18n.t('octorate.connect.mapping.errors.propertyRequired'),
    );
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'mapping');
    expect(screen.getByTestId('octorate-mapping-property-acc-1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('OctorateMapping_ListingWithSeveralRooms_AsksWhichRoomIsThePropertyAndSendsItOnConfirm', async () => {
    let confirmed = false;
    vi.mocked(octorateApi.getFoundListings).mockImplementation(async () => [
      confirmed ? linkedListing({ rooms: TWO_ROOMS, octorateProductId: 'room-2' }) : listing({ rooms: TWO_ROOMS }),
    ]);
    vi.mocked(octorateApi.confirmMapping).mockImplementation(async () => {
      confirmed = true;
    });
    renderAt('mapping');
    await screen.findByTestId('octorate-mapping-row-acc-1', undefined, WAIT);

    // The question comes with the answer that needs it: a property is one unit.
    expect(screen.queryByTestId('octorate-mapping-room-acc-1')).not.toBeInTheDocument();
    fireEvent.click(radio('confirm'));
    const rooms = await screen.findByTestId('octorate-mapping-room-acc-1', undefined, WAIT);
    expect(screen.getByText(i18n.t('octorate.connect.mapping.room.question'))).toBeInTheDocument();
    expect(within(rooms).getAllByRole('option')).toHaveLength(3);

    fireEvent.click(nextButton());
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.mapping.errors.roomRequired'));
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'mapping');

    fireEvent.change(screen.getByTestId('octorate-mapping-room-acc-1'), { target: { value: 'room-2' } });
    await waitFor(() => expect(screen.getByTestId('octorate-mapping-room-acc-1')).toHaveValue('room-2'), WAIT);
    fireEvent.click(nextButton());
    await onStep('summary');
    fireEvent.click(finishButton());

    await waitFor(() => expect(octorateApi.confirmMapping).toHaveBeenCalledWith('acc-1', 'prop-1', 'room-2'), WAIT);
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
  });

  it('OctorateMapping_ListingConfirmedBeforeWithSeveralRoomsAndNoneChosen_AsksForTheRoomOnly', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([linkedListing({ rooms: TWO_ROOMS, octorateProductId: null })]);
    renderAt('mapping');

    const rooms = await screen.findByTestId('octorate-mapping-room-acc-1', undefined, WAIT);
    // It is linked already: there is nothing to decide about the property, only the room.
    expect(screen.queryByTestId('octorate-mapping-confirm-acc-1')).not.toBeInTheDocument();
    fireEvent.change(rooms, { target: { value: 'room-1' } });
    await waitFor(() => expect(rooms).toHaveValue('room-1'), WAIT);
    fireEvent.click(nextButton());
    await onStep('summary');
    fireEvent.click(finishButton());

    await waitFor(() => expect(octorateApi.setMappingRoom).toHaveBeenCalledWith('acc-1', 'room-1'), WAIT);
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
  });

  it('OctorateMapping_ClearProposals_AreConfirmedTogetherAndAmbiguousOnesAreLeftAlone', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu', proposedProperty: { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' } }),
      listing({ octorateAccommodationId: 'acc-3', name: 'Casa Verde', status: 'Ambiguous', proposedProperty: null }),
    ]);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([property(), property({ id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino', maxGuests: 2 })]);
    renderAt('mapping');

    fireEvent.click(await screen.findByTestId('octorate-mapping-confirm-all', undefined, WAIT));

    await waitFor(() => expect(radio('confirm', 'acc-1')).toBeChecked(), WAIT);
    expect(radio('confirm', 'acc-2')).toBeChecked();
    expect(radio('later', 'acc-3')).toBeChecked();
    expect(screen.queryByTestId('octorate-mapping-confirm-all')).not.toBeInTheDocument();
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
  });

  it('OctorateMapping_PropertyConfirmedForTwoListings_IsRefusedBeforeAnythingIsSent', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing(), listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu' })]);
    renderAt('mapping', [decision(), decision({ listingId: 'acc-2' })]);
    await screen.findByTestId('octorate-mapping-row-acc-2', undefined, WAIT);

    fireEvent.click(nextButton());

    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.mapping.errors.propertyTwice'));
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
  });

  it('OctorateMapping_ProposalChangedSinceTheAnswer_DoesNotKeepTheOldAnswerUnderTheNewProposal', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({ proposedProperty: { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' } }),
    ]);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([property(), property({ id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino', maxGuests: 2 })]);
    // The host confirmed Casa Rosa (prop-1) earlier; the server proposes Casa Blu now.
    renderAt('mapping', [decision()]);

    expect(await screen.findByTestId('octorate-mapping-proposal-acc-1', undefined, WAIT)).toHaveTextContent('Casa Blu');
    // The answer was about another property: it is dropped, and the listing waits for a new answer.
    await waitFor(() => expect(radio('later')).toBeChecked(), WAIT);
    expect(radio('confirm')).not.toBeChecked();

    // Going on confirms nothing the host did not see.
    fireEvent.click(nextButton());
    await onStep('summary');
    fireEvent.click(finishButton());
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-1')).toHaveAttribute('data-result', 'later'), WAIT);
  });

  it('OctorateMapping_ProposalOrCandidateThatIsNotAShortRentProperty_IsNeverOffered', async () => {
    // The server proposes and shortlists among every property of the org, a long-rent one included. The host's list is the short-rent
    // one (mode=short), which does not hold Casa Lunga: it is not on offer, because a long-rent property is never on a channel manager.
    const longRent = { id: 'prop-long', name: 'Casa Lunga', address: 'Via Po 9', city: 'Torino' };
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({ proposedProperty: longRent }),
      listing({
        octorateAccommodationId: 'acc-2',
        name: 'Casa Blu',
        status: 'Ambiguous',
        proposedProperty: null,
        candidates: [longRent, { id: 'prop-1', name: 'Casa Rosa', address: 'Via Roma 12', city: 'Milano' }],
      }),
    ]);
    renderAt('mapping');
    await screen.findByTestId('octorate-mapping-row-acc-1', undefined, WAIT);

    // No proposal to confirm: the host can still import the listing or pick one of their own properties.
    expect(propertiesApi.getAll).toHaveBeenCalledWith({ mode: 'short' });
    expect(screen.queryByTestId('octorate-mapping-proposal-acc-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('octorate-mapping-confirm-acc-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('octorate-mapping-confirm-all')).not.toBeInTheDocument();
    expect(radio('import')).toBeInTheDocument();
    expect(radio('other')).toBeInTheDocument();
    // The likely matches of the ambiguous listing are the short-rent ones only.
    fireEvent.click(radio('other', 'acc-2'));
    const select = await screen.findByTestId('octorate-mapping-property-acc-2', undefined, WAIT);
    expect(within(select).getByRole('option', { name: /Casa Rosa/ })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /Casa Lunga/ })).not.toBeInTheDocument();
    expect(wizardText()).not.toContain('Casa Lunga');
  });
});

describe('summary: what will happen, before the import (NF-05)', () => {
  it('OctorateSummary_Decisions_AreToldInPlainWordsAndNothingIsSentBeforeTheLastButton', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      newListing(),
      listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu', status: 'Ambiguous', proposedProperty: null }),
    ]);
    renderAt('summary', [decision(), decision({ listingId: 'acc-new', action: 'import', propertyId: '' })]);
    await onStep('summary');

    expect(await screen.findByText(i18n.t('octorate.connect.summary.linkedLine', { listing: 'Villa Rosa', property: 'Casa Rosa' }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.summary.groups.linked.label'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.summary.groups.imported.label'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.summary.groups.later.label'))).toBeInTheDocument();
    // What, where and when; the listing left for later says that writes stay blocked; an import creates nothing on the channel manager.
    const explain = screen.getByTestId('octorate-summary-explain');
    expect(explain).toHaveTextContent(i18n.t('octorate.connect.summary.explain.where'));
    expect(explain).toHaveTextContent(i18n.t('octorate.connect.summary.explain.when'));
    expect(explain).toHaveTextContent(i18n.t('octorate.connect.summary.explain.imported'));
    expect(explain).toHaveTextContent(i18n.t('octorate.connect.summary.explain.later'));
    expect(explain).toHaveTextContent(i18n.t('octorate.connect.summary.explain.ical'));
    // "Modifica" goes back to the step of the answers.
    expect(screen.getAllByRole('link', { name: /./ }).some((link) => link.getAttribute('href')?.includes('step=mapping'))).toBe(true);
    expect(wizardText()).not.toMatch(/octorate/i);
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
    expect(octorateApi.importListing).not.toHaveBeenCalled();
    expect(finishButton()).toHaveTextContent(i18n.t('octorate.connect.finishLabel'));
  });

  it('OctorateSummary_NoDecision_SaysThereIsNothingToDoAndSendsNothing', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    renderAt('summary');

    expect(await screen.findByTestId('octorate-summary-nothing', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.summary.nothing'));
    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
    expect(octorateApi.importListing).not.toHaveBeenCalled();
    expect(octorateApi.rejectMapping).not.toHaveBeenCalled();
    // The listing was left for later: the result says so, and that its property stays blocked.
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-1')).toHaveAttribute('data-result', 'later'), WAIT);
    expect(screen.getByTestId('octorate-result-acc-1')).toHaveTextContent(i18n.t('octorate.connect.summary.result.later.blocked'));
  });

  it('OctorateSummary_ChannelManagerNotConnected_SaysSoAndTheLastButtonWaits', async () => {
    vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection());
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    // A draft taken up again at the summary after the channel manager was disconnected, which is also what the address of the step gives.
    renderAt('summary', [decision()]);

    expect(await screen.findByTestId('octorate-summary-not-connected', undefined, WAIT)).toHaveTextContent(
      i18n.t('octorate.connect.summary.notConnected.title'),
    );
    // Nothing can be concluded: no read, no call, no "Collegamento completato".
    expect(finishButton()).toBeDisabled();
    fireEvent.click(finishButton());
    expect(octorateApi.getFoundListings).not.toHaveBeenCalled();
    expect(octorateApi.confirmMapping).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'summary');
    expect(wizardText()).not.toMatch(/octorate/i);

    // The way on is the consent.
    fireEvent.click(screen.getByTestId('octorate-summary-reconnect'));
    await onStep('consent');
  });

  it('OctorateSummary_ExcludeAnswerOfAListingExcludedAlready_IsNotListedAndNotSentAgain', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({ octorateAccommodationId: 'acc-3', name: 'Casa Verde', status: 'Rejected', proposedProperty: null }),
    ]);
    // The run before excluded the listing and left its answer in the draft of the wizard.
    renderAt('summary', [decision({ listingId: 'acc-3', action: 'reject', propertyId: '' })]);

    expect(await screen.findByTestId('octorate-summary-nothing', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('octorate.connect.summary.groups.excluded.label'))).not.toBeInTheDocument();
    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.rejectMapping).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-3')).toHaveAttribute('data-result', 'excluded'), WAIT);
  });

  it('OctorateSummary_Finish_ConfirmsImportsAndExcludesAndEndsInOneRowPerListing', async () => {
    const after = new Map<string, ReturnType<typeof listing>>();
    vi.mocked(octorateApi.getFoundListings).mockImplementation(async () => [
      after.get('acc-1') ?? listing(),
      after.get('acc-new') ?? newListing({ rooms: TWO_ROOMS }),
      after.get('acc-3') ?? listing({ octorateAccommodationId: 'acc-3', name: 'Casa Verde', proposedProperty: null, status: 'Ambiguous' }),
      listing({ octorateAccommodationId: 'acc-4', name: 'Casa Gialla', proposedProperty: null, status: 'Ambiguous' }),
    ]);
    vi.mocked(octorateApi.confirmMapping).mockImplementation(async (id) => {
      after.set(id, linkedListing());
    });
    vi.mocked(octorateApi.importListing).mockImplementation(async (id) => {
      after.set(id, linkedListing({ octorateAccommodationId: id, name: 'Casa Nuova', proposedProperty: { id: 'prop-9', name: 'Casa Nuova', address: '', city: '' }, rooms: TWO_ROOMS }));
      return { propertyId: 'prop-9' };
    });
    vi.mocked(octorateApi.rejectMapping).mockImplementation(async (id) => {
      after.set(id, listing({ octorateAccommodationId: id, name: 'Casa Verde', status: 'Rejected', proposedProperty: null }));
    });
    renderAt('summary', [
      decision(),
      decision({ listingId: 'acc-new', action: 'import', propertyId: '', needsRoom: true, roomId: 'room-2' }),
      decision({ listingId: 'acc-3', action: 'reject', propertyId: '' }),
    ]);
    await screen.findByTestId('octorate-summary-step', undefined, WAIT);

    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.done.checkImported'));
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-1')).toHaveAttribute('data-result', 'linked'), WAIT);
    expect(screen.getByTestId('octorate-result-acc-new')).toHaveAttribute('data-result', 'imported');
    expect(screen.getByTestId('octorate-result-acc-3')).toHaveAttribute('data-result', 'excluded');
    // Left for later, with no decision: no call at all for it.
    expect(screen.getByTestId('octorate-result-acc-4')).toHaveAttribute('data-result', 'later');
    expect(octorateApi.confirmMapping).toHaveBeenCalledTimes(1);
    expect(octorateApi.confirmMapping).toHaveBeenCalledWith('acc-1', 'prop-1', undefined);
    expect(octorateApi.importListing).toHaveBeenCalledWith('acc-new');
    expect(octorateApi.setMappingRoom).toHaveBeenCalledWith('acc-new', 'room-2');
    expect(octorateApi.rejectMapping).toHaveBeenCalledWith('acc-3');
    // The new property is inactive and to check: the result says so.
    expect(screen.getByText(i18n.t('octorate.connect.done.imported'))).toBeInTheDocument();
  });

  it('OctorateSummary_PropertyAlreadyConfirmedElsewhere_ShowsTheConflictAsAClearMessageAndStaysOnTheSummary', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing(), listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu', proposedProperty: { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' } })]);
    vi.mocked(octorateApi.confirmMapping).mockImplementation(async (id) => {
      if (id === 'acc-1') throw axiosError(409, { code: 'octorate_mapping_property_taken' });
    });
    renderAt('summary', [decision(), decision({ listingId: 'acc-2', propertyId: 'prop-2' })]);
    await screen.findByTestId('octorate-summary-step', undefined, WAIT);

    fireEvent.click(finishButton());

    // The listing that failed says why, in the words of the app; the one that went through does not stop it.
    const failed = await screen.findByTestId('octorate-summary-failed-acc-1', undefined, WAIT);
    expect(failed).toHaveTextContent(i18n.t('apiErrors.codes.octorateMappingPropertyTaken'));
    expect(octorateApi.confirmMapping).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('octorate-summary-failed-acc-2')).not.toBeInTheDocument();
    expect(await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('octorate.connect.summary.failed.generic'),
    );
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'summary');
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();

    // "Correggi" goes back to the step of the answers.
    fireEvent.click(screen.getByTestId('octorate-summary-fix'));
    await onStep('mapping');
  });

  it('OctorateSummary_SecondRunAfterAFailure_DoesOnlyWhatIsLeft', async () => {
    let linked = false;
    vi.mocked(octorateApi.getFoundListings).mockImplementation(async () => [linked ? linkedListing() : listing()]);
    vi.mocked(octorateApi.confirmMapping)
      .mockRejectedValueOnce(axiosError(409, { code: 'octorate_mapping_property_taken' }))
      .mockImplementation(async () => {
        linked = true;
      });
    renderAt('summary', [decision()]);
    await screen.findByTestId('octorate-summary-step', undefined, WAIT);

    fireEvent.click(finishButton());
    await screen.findByTestId('octorate-summary-failed-acc-1', undefined, WAIT);
    // The button is free again when the run has ended with its error.
    await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT);
    await waitFor(() => expect(finishButton()).not.toHaveAttribute('aria-busy'), WAIT);
    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.confirmMapping).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-1')).toHaveAttribute('data-result', 'linked'), WAIT);
  });

  it('OctorateSummary_ListingThatFailedThenLeftForLater_IsNotReportedAsFailedInTheResult', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([listing()]);
    vi.mocked(octorateApi.confirmMapping).mockRejectedValue(axiosError(409, { code: 'octorate_mapping_property_taken' }));
    renderAt('summary', [decision()]);
    await screen.findByTestId('octorate-summary-step', undefined, WAIT);

    fireEvent.click(finishButton());
    await screen.findByTestId('octorate-summary-failed-acc-1', undefined, WAIT);
    await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT);

    // The host goes back and leaves the listing for later: the plan has nothing to do for it any more.
    fireEvent.click(screen.getByTestId('octorate-summary-fix'));
    await onStep('mapping');
    fireEvent.click(await screen.findByTestId('octorate-mapping-later-acc-1', undefined, WAIT));
    await waitFor(() => expect(radio('later')).toBeChecked(), WAIT);
    fireEvent.click(nextButton());
    await onStep('summary');
    fireEvent.click(finishButton());

    // The old error is not the last word about it: the result says it is left for later, as it is.
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('octorate-result-acc-1')).toHaveAttribute('data-result', 'later'), WAIT);
    expect(octorateApi.confirmMapping).toHaveBeenCalledTimes(1);
  });
});

describe('result: what became of each listing and of the iCal calendars (NF-05)', () => {
  it('OctorateResult_PropertyWithICalFeeds_SaysPerChannelWhatHappensToEachCalendar', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([linkedListing(), listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu' })]);
    vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([
      feed({ id: 'feed-air', channel: 'Airbnb', deprecated: true, deprecatedAt: '2026-11-05T10:00:00Z' }),
      feed({ id: 'feed-booking', channel: 'BookingCom', deprecated: false }),
      feed({ id: 'feed-other', channel: 'Other', label: 'Casa Vacanze', deprecated: false }),
    ]);
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);

    const notice = await screen.findByTestId('octorate-ical-notice', undefined, WAIT);
    const since = formatRomeDateTime('2026-11-05T10:00:00Z', i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
    // Replaced by the channel manager since a date: the host removes CasaZen's iCal link on that channel.
    expect(notice).toHaveTextContent(i18n.t('octorate.connect.summary.ical.replaced', { channel: 'Airbnb', date: since }));
    // Not replaced yet: CasaZen keeps reading it until the channel manager has read the calendar once.
    expect(notice).toHaveTextContent(i18n.t('octorate.connect.summary.ical.keeps', { channel: 'Booking.com' }));
    expect(notice).toHaveTextContent(i18n.t('octorate.connect.summary.ical.keeps', { channel: 'Casa Vacanze' }));
    expect(notice).toHaveTextContent(i18n.t('octorate.connect.summary.ical.benefit'));
    expect(within(notice).getByTestId('octorate-ical-property-prop-1')).toBeInTheDocument();
    // Only the properties that are confirmed are asked about.
    expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(1);
    expect(propertyIcalApi.getFeeds).toHaveBeenCalledWith('prop-1');
    expect(wizardText()).not.toMatch(/octorate/i);
  });

  it('OctorateResult_FeedOfAChannelReplacedWithoutADate_StillSaysItIsReplaced', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([linkedListing()]);
    vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([feed({ deprecated: true, deprecatedAt: null })]);
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);

    expect(await screen.findByTestId('octorate-ical-notice', undefined, WAIT)).toHaveTextContent(
      i18n.t('octorate.connect.summary.ical.replacedNoDate', { channel: 'Airbnb' }),
    );
  });

  it('OctorateResult_PropertiesWithoutFeeds_HaveNoICalNotice', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([linkedListing()]);
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);

    expect(await screen.findByTestId('octorate-result-acc-1', undefined, WAIT)).toHaveAttribute('data-result', 'linked');
    await waitFor(() => expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(1), WAIT);
    expect(screen.queryByTestId('octorate-ical-notice')).not.toBeInTheDocument();
  });
});

describe('accessibility of the steps after the consent (NF-14)', () => {
  it('OctorateChannelsFoundAndMapping_HaveNoViolationThatAxeCanFindWithoutABrowser', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing({ rooms: TWO_ROOMS }),
      newListing(),
      linkedListing({
        octorateAccommodationId: 'acc-3',
        name: 'Attico',
        rooms: TWO_ROOMS,
        octorateProductId: null,
        proposedProperty: { id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' },
      }),
    ]);
    const { container } = renderAt('channels');
    await screen.findByTestId('octorate-channels-count', undefined, WAIT);
    await expectNoAxeViolations(container);

    fireEvent.click(nextButton());
    await onStep('mapping');
    await screen.findByTestId('octorate-mapping-row-acc-1', undefined, WAIT);
    fireEvent.click(radio('confirm'));
    await screen.findByTestId('octorate-mapping-room-acc-1', undefined, WAIT);
    fireEvent.click(radio('other', 'acc-new'));
    await screen.findByTestId('octorate-mapping-property-acc-new', undefined, WAIT);
    await expectNoAxeViolations(container);
  });

  it('OctorateSummaryAndResult_HaveNoViolationThatAxeCanFindWithoutABrowser', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
      listing(),
      linkedListing({
        octorateAccommodationId: 'acc-3',
        name: 'Attico',
        proposedProperty: { id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' },
      }),
    ]);
    vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([feed({ deprecated: true, deprecatedAt: '2026-11-05T10:00:00Z' })]);
    const summary = renderAt('summary', [decision()]);
    await screen.findByText(i18n.t('octorate.connect.summary.groups.linked.label'), undefined, WAIT);
    await expectNoAxeViolations(summary.container);
    summary.unmount();

    const result = renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);
    await screen.findByTestId('octorate-ical-notice', undefined, WAIT);
    await expectNoAxeViolations(result.container);
  });
});

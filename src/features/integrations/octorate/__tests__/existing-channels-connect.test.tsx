import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { octorateApi } from '@/api/octorate.api';
import { onboardingApi } from '@/api/onboarding.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { getMarketplaceCatalog } from '@/api/marketplace.api';
import { expectNoAxeViolations } from '@/test/axe';
import { writeWizardDraft } from '@/lib/wizard-draft';
import type { ExistingInventoryBatch, ExistingInventoryChannel, MarketplaceCatalogEntry } from '@/types';
import type { AssistRequest } from '@/types/onboarding.types';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';
import { SCOPE, WAIT, WIZARD_DRAFT_ID, axiosError, connection, listing, onStep, property, renderWizard } from './octorate-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/octorate.api', () => ({
  octorateApi: {
    getConnectionStatus: vi.fn(),
    getFoundListings: vi.fn(),
    refreshListings: vi.fn(),
    createExistingInventoryBatch: vi.fn(),
    getExistingInventoryBatch: vi.fn(),
    startChannelAccess: vi.fn(),
    confirmChannelAccess: vi.fn(),
    connectChannel: vi.fn(),
    runExistingInventoryBatch: vi.fn(),
    getInventoryIntents: vi.fn(),
    setInventoryIntents: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getFeeds: vi.fn() } }));
vi.mock('@/api/marketplace.api', () => ({ getMarketplaceCatalog: vi.fn(), getMarketplaceEntry: vi.fn(), getMarketplaceActive: vi.fn() }));
vi.mock('@/api/wizard-draft.api', () => ({
  WIZARD_DRAFTS_KEY: ['wizard-drafts'],
  wizardDraftApi: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ status: 'saved', version: 1, lastSavedAt: '2026-11-10T10:00:00Z' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

// «Fallo per me» belongs to the organization administrator and to the flag `octorateOnboarding`.
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listAssistRequests: vi.fn(), requestAssist: vi.fn() } }));
const session = vi.hoisted(() => ({
  contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }],
  flags: { octorateOnboarding: true },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: session.flags, isLoading: false }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const PANEL_URL = 'https://panel.channel-manager.test/';

/** The codes the channel manager gives its portals: the catalog says which of them are connected by the id of each structure. */
const BOOKING = '142';
const EXPEDIA = '4';
const AIRBNB = '274';
const VRBO = '235';
const AGODA = '271';
const OTHER = '999';

const CATALOG: MarketplaceCatalogEntry[] = [
  entry(BOOKING, 'Booking.com', true),
  entry(AIRBNB, 'Airbnb'),
  entry(EXPEDIA, 'Expedia', true),
  entry(VRBO, 'Vrbo'),
  entry(AGODA, 'Agoda', true),
  entry(OTHER, 'Portale X'),
];

function entry(code: string, name: string, connectByPropertyId?: boolean): MarketplaceCatalogEntry {
  return {
    kind: 'Channel',
    code,
    name,
    logoUrl: null,
    benefit: '',
    cost: { text: null, invoicedBy: 'Unknown' },
    status: 'NotActive',
    statusScope: 'Org',
    canActivate: true,
    reason: null,
    ...(connectByPropertyId === undefined ? {} : { connectByPropertyId }),
  };
}

function channel(overrides: Partial<ExistingInventoryChannel> = {}): ExistingInventoryChannel {
  return {
    channelCode: BOOKING,
    status: 'Draft',
    errorCode: null,
    accessState: 'NotStarted',
    accessCompletedAt: null,
    roomsImportedAt: null,
    completedAt: null,
    counts: { found: 0, roomsImported: 0, confirmed: 0, pending: 0, leftForLater: 0, rejected: 0, outOfScope: 0, reservationsImported: 0, calendarImported: 0, connected: 0, failed: 0 },
    capabilities: { importRooms: true, importReservations: true, importCalendar: true, markConnected: true },
    items: [],
    ...overrides,
  };
}

function batch(channels: ExistingInventoryChannel[]): ExistingInventoryBatch {
  return {
    id: 'batch-1',
    scenario: 'onOtas',
    scopeKind: 'AllInventory',
    group: null,
    propertyIds: [],
    status: 'AwaitingChannelAccess',
    errorCode: null,
    createdAt: '2026-11-14T10:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
    completedAt: null,
    channels,
  };
}

function assistRequest(overrides: Partial<AssistRequest> = {}): AssistRequest {
  return {
    id: 'r1',
    part: 'channels',
    propertyId: null,
    context: 'panelChannelAccess',
    status: 'Requested',
    requestedAt: '2026-11-14T10:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
    completedAt: null,
    staffNote: null,
    activityId: 'a1',
    ...overrides,
  };
}

/** The secondary window of the panel: its address is written and never read. */
function fakeWindow() {
  const navigated: string[] = [];
  const win = {
    closed: false,
    opener: {} as unknown,
    focus: vi.fn(),
    close: vi.fn(),
    location: {
      set href(value: string) {
        navigated.push(value);
      },
    },
  };
  return { win, navigated };
}

/** What the server holds: the batch as it moves along (the connect changes it, and every read gives it). */
let server: ExistingInventoryBatch;

const row = (code: string) => screen.getByTestId(`existing-channel-${code}`);

/** The step of the channels, with the portals chosen and the batch the server holds for them. */
async function toTheChannels(channels: ExistingInventoryChannel[]) {
  server = batch(channels);
  writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: channels.map((item) => item.channelCode), batchId: 'batch-1' } });
  const rendered = renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
  await onStep('existing-channels');
  return rendered;
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  session.flags = { octorateOnboarding: true };
  vi.mocked(octorateApi.connectChannel).mockReset();
  vi.mocked(octorateApi.startChannelAccess).mockReset();
  vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([]);
  vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Connected' }));
  vi.mocked(octorateApi.getExistingInventoryBatch).mockImplementation(async () => server);
  vi.mocked(octorateApi.getFoundListings).mockResolvedValue([
    listing({ octorateAccommodationId: 'acc-1', name: 'Villa Rosa' }),
    listing({ octorateAccommodationId: 'acc-2', name: 'Casa Blu' }),
  ]);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
  vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([]);
  vi.mocked(getMarketplaceCatalog).mockResolvedValue({ octorate: { enabled: true, connected: true }, groups: [{ id: 'salesChannels', unchangedFlow: false, entries: CATALOG }] });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('a portal that needs only the id of each structure: «Collega» from CasaZen', () => {
  it('ExistingChannels_PortalConnectedById_AsksTheIdOfEachStructureAndSendsOnlyTheOnesWritten', async () => {
    vi.mocked(octorateApi.connectChannel).mockImplementation(async () => {
      server = batch([channel({ accessState: 'Waiting', status: 'AwaitingChannelAccess', connectedAccommodationIds: ['acc-1'] })]);
      return server;
    });
    const { container } = await toTheChannels([channel()]);

    // One field for each structure the channel manager holds, labelled by the portal and under the name of the structure: the panel is not the way here.
    const first = await screen.findByTestId(`existing-channel-${BOOKING}-id-acc-1`, undefined, WAIT);
    const second = screen.getByTestId(`existing-channel-${BOOKING}-id-acc-2`);
    expect(within(row(BOOKING)).getAllByRole('textbox')).toHaveLength(2);
    expect(within(row(BOOKING)).getByRole('group', { name: 'Villa Rosa' })).toContainElement(first);
    expect(within(row(BOOKING)).getByRole('group', { name: 'Casa Blu' })).toContainElement(second);
    expect(first).toHaveAccessibleName(i18n.t('octorate.connect.existing.channels.byId.idLabel', { name: 'Booking.com' }));
    expect(screen.queryByTestId(`existing-channel-${BOOKING}-open`)).not.toBeInTheDocument();
    await expectNoAxeViolations(container);

    // Only the structure that has an id is sent, the id trimmed: the one left empty is not on the portal.
    fireEvent.change(first, { target: { value: '  12345678  ' } });
    fireEvent.click(screen.getByTestId(`existing-channel-${BOOKING}-connect`));

    await waitFor(() => expect(octorateApi.connectChannel).toHaveBeenCalledTimes(1), WAIT);
    expect(octorateApi.connectChannel).toHaveBeenCalledWith('batch-1', BOOKING, { accommodations: [{ accommodationId: 'acc-1', hotelId: '12345678' }] });
    // The last step is on the portal itself, with its link; the panel is never opened, and CasaZen says it sees the approval by itself.
    const last = await screen.findByTestId(`existing-channel-${BOOKING}-last-step`, undefined, WAIT);
    expect(last).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.lastStep.title', { name: 'Booking.com' }));
    expect(last).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.lastStep.booking'));
    expect(within(last).getByTestId(`existing-channel-${BOOKING}-waiting`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.lastStep.watching', { name: 'Booking.com' }));
    const link = within(last).getByRole('link', { name: new RegExp(i18n.t('octorate.connect.existing.channels.byId.lastStep.bookingLink')) });
    expect(link).toHaveAttribute('href', 'https://admin.booking.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByTestId(`existing-channel-${BOOKING}-ids`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`existing-channel-${BOOKING}-open`)).not.toBeInTheDocument();
    expect(octorateApi.startChannelAccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');
  });

  it('ExistingChannels_PortalConnectedById_FieldsAreIdentifiersNotCredentials', async () => {
    await toTheChannels([channel()]);

    const field = await screen.findByTestId(`existing-channel-${BOOKING}-id-acc-1`, undefined, WAIT);

    // The id of a property is read in the account on the portal and is no credential: no password or token field, nothing remembered by the browser.
    const credential = /pass(word)?|token|secret|username|login|cookie|credential/i;
    expect((field as HTMLInputElement).type).toBe('text');
    expect(field).toHaveAttribute('autocomplete', 'off');
    expect(`${field.getAttribute('name') ?? ''} ${field.id}`).not.toMatch(credential);
    expect(row(BOOKING).querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByTestId('existing-channels-credentials-note')).toHaveTextContent(i18n.t('octorate.connect.existing.channels.credentials'));
  });

  it('ExistingChannels_NothingWrittenOrAnIdThatIsNotValid_SaysSoAndSendsNothing_AndEnterNeverMovesTheWizardOn', async () => {
    await toTheChannels([channel()]);
    const field = await screen.findByTestId(`existing-channel-${BOOKING}-id-acc-1`, undefined, WAIT);

    // Nothing written: one id at least is asked for.
    fireEvent.click(screen.getByTestId(`existing-channel-${BOOKING}-connect`));
    expect(await screen.findByTestId(`existing-channel-${BOOKING}-need-one`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.needOne'));

    // An id with a character a portal does not have: the field says so, and Enter in it asks the same thing as the button, never the next step.
    fireEvent.change(field, { target: { value: 'ab cd' } });
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
    await waitFor(() => expect(field).toBeInvalid());
    expect(within(row(BOOKING)).getByText(i18n.t('octorate.connect.existing.channels.byId.idInvalid'))).toBeInTheDocument();
    expect(octorateApi.connectChannel).not.toHaveBeenCalled();
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');
  });

  it('ExistingChannels_TheServerRefusesAnId_SaysWhyInTheWordsOfTheAppUnderTheFieldsAndKeepsTheForm', async () => {
    vi.mocked(octorateApi.connectChannel).mockRejectedValue(axiosError(422, { code: 'existing_inventory_hotel_id_invalid' }));
    await toTheChannels([channel()]);
    const field = await screen.findByTestId(`existing-channel-${BOOKING}-id-acc-1`, undefined, WAIT);

    fireEvent.change(field, { target: { value: 'abc-123' } });
    fireEvent.click(screen.getByTestId(`existing-channel-${BOOKING}-connect`));

    expect(await screen.findByTestId(`existing-channel-${BOOKING}-connect-problem`, undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.existingInventoryHotelIdInvalid'));
    // The host corrects the id and asks again: the form is still there, with what was written.
    expect(field).toHaveValue('abc-123');
    expect(screen.queryByTestId(`existing-channel-${BOOKING}-last-step`)).not.toBeInTheDocument();
  });

  it.each([
    [BOOKING, 'Booking.com', 'octorate.connect.existing.channels.byId.lastStep.booking', 'https://admin.booking.com/'],
    [EXPEDIA, 'Expedia', 'octorate.connect.existing.channels.byId.lastStep.expedia', 'https://www.expediapartnercentral.com/'],
    [AGODA, 'Agoda', 'octorate.connect.existing.channels.byId.lastStep.other', null],
  ])('ExistingChannels_IdsAlreadyWithTheChannelManager_%s_ShowsTheLastStepOnThePortalAndNoForm', async (code, name, sentence, address) => {
    await toTheChannels([channel({ channelCode: code, accessState: 'Waiting', status: 'AwaitingChannelAccess', connectedAccommodationIds: ['acc-1'] })]);

    const last = await screen.findByTestId(`existing-channel-${code}-last-step`, undefined, WAIT);

    expect(last).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.lastStep.title', { name }));
    expect(last).toHaveTextContent(i18n.t(sentence, { name }));
    if (address) expect(within(last).getByTestId(`existing-channel-${code}-extranet`)).toHaveAttribute('href', address);
    else expect(within(last).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`existing-channel-${code}-ids`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`existing-channel-${code}-open`)).not.toBeInTheDocument();
    // No wording of the panel: what is left is on the portal.
    expect(screen.getByTestId(`existing-channel-${code}`)).toHaveAttribute('data-state', 'waiting');
    expect(screen.queryByText(i18n.t('octorate.connect.existing.channels.waiting'))).not.toBeInTheDocument();
  });

  it('ExistingChannels_PortalConnectedByIdWithNoStructure_SaysSoAndKeepsThePanelAsTheWay', async () => {
    vi.mocked(octorateApi.getFoundListings).mockResolvedValue([]);
    await toTheChannels([channel()]);

    expect(await screen.findByTestId(`existing-channel-${BOOKING}-no-structures`, undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.byId.noStructures'));

    expect(screen.getByTestId(`existing-channel-${BOOKING}-open`)).toBeInTheDocument();
    expect(within(row(BOOKING)).queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByTestId(`existing-channel-${BOOKING}-hint`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.panelHint.other', { name: 'Booking.com' }));
  });
});

describe('a portal that goes through the panel: the button and what to do there', () => {
  it('ExistingChannels_PortalNotConnectedById_OpensThePanelAndSaysExactlyWhatToDoThere', async () => {
    const { win, navigated } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: AIRBNB, alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    await toTheChannels([channel({ channelCode: AIRBNB }), channel({ channelCode: VRBO }), channel({ channelCode: OTHER })]);

    // The words of each portal under its button: Airbnb authorises with its own account, Vrbo is activated by the support of the channel manager, the rest is searched by name.
    await screen.findByTestId(`existing-channel-${AIRBNB}-hint`, undefined, WAIT);
    expect(screen.getByTestId(`existing-channel-${AIRBNB}-hint`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.panelHint.airbnb'));
    expect(screen.getByTestId(`existing-channel-${VRBO}-hint`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.panelHint.vrbo'));
    expect(screen.getByTestId(`existing-channel-${OTHER}-hint`)).toHaveTextContent(i18n.t('octorate.connect.existing.channels.panelHint.other', { name: 'Portale X' }));
    for (const code of [AIRBNB, VRBO, OTHER]) expect(within(row(code)).queryAllByRole('textbox')).toHaveLength(0);

    // The button is the one that opens the panel, in the window CasaZen controls, as before.
    fireEvent.click(screen.getByTestId(`existing-channel-${AIRBNB}-open`));

    await waitFor(() => expect(octorateApi.startChannelAccess).toHaveBeenCalledWith('batch-1', AIRBNB), WAIT);
    await waitFor(() => expect(navigated).toEqual([PANEL_URL]), WAIT);
    expect(octorateApi.connectChannel).not.toHaveBeenCalled();
  });
});

describe('«Fallo per me» of a row: the request of one portal is not the request of another', () => {
  it('ExistingChannels_OpenRequestOfOnePortal_ShowsOnThatRowOnlyAndTheOthersCanStillAsk', async () => {
    vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ channelCode: AIRBNB })]);
    await toTheChannels([channel({ channelCode: BOOKING }), channel({ channelCode: AIRBNB })]);

    expect(await within(await screen.findByTestId(`existing-channel-${AIRBNB}`, undefined, WAIT)).findByTestId('assist-request-status', undefined, WAIT)).toHaveAttribute('data-status', 'Requested');

    // Nothing of that request on the row of Booking.com: it still has its own button, and the status of the other row says nothing about it.
    expect(within(row(BOOKING)).getByTestId('assist-request-button')).toBeInTheDocument();
    expect(within(row(BOOKING)).queryByTestId('assist-request-status')).not.toBeInTheDocument();
    expect(within(row(AIRBNB)).queryByTestId('assist-request-button')).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { octorateApi } from '@/api/octorate.api';
import { onboardingApi } from '@/api/onboarding.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { listingStatusApi } from '@/api/listing-status.api';
import { getMarketplaceCatalog } from '@/api/marketplace.api';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { expectNoAxeViolations } from '@/test/axe';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';
import type { ExistingInventoryBatch, ExistingInventoryChannel, ExistingInventoryCounts, OctorateListing } from '@/types';
import {
  INVENTORY_SCENARIOS,
  MIXED_GROUP_NAMES,
  SCENARIO_STEP_SCHEMA,
  assignmentsOf,
  assignPortfolio,
  readGroups,
  routeForScenario,
  type InventoryScenario,
  type PortfolioGroup,
} from '../inventory-scenario';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';
import { SCOPE, WAIT, WIZARD_DRAFT_ID, axiosError, connection, currentLocation, linkedListing, listing, newListing, onStep, property, renderWizard } from './octorate-fixtures';

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
    createExistingInventoryBatch: vi.fn(),
    getExistingInventoryBatch: vi.fn(),
    startChannelAccess: vi.fn(),
    confirmChannelAccess: vi.fn(),
    runExistingInventoryBatch: vi.fn(),
    continueExistingInventoryBatch: vi.fn(),
    getInventoryIntents: vi.fn(),
    setInventoryIntents: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn(), create: vi.fn() } }));
vi.mock('@/api/listing-status.api', () => ({ listingStatusApi: { publish: vi.fn() } }));
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

// «Fallo per me» belongs to the organization administrator and to the flag `octorateOnboarding`: who is asking and which flags are on are set by each test.
vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listAssistRequests: vi.fn(), requestAssist: vi.fn() } }));
const session = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  flags: { octorateOnboarding: true },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: session.contexts }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: session.flags, isLoading: false }) }));

// A whole wizard is rendered in these tests (and checked with axe): the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

/** The owner of the organization (the administrator of the steps of the activation) and a property manager, who opens the wizard with `ota.write` and is not one. */
const OWNER = [{ contextKey: 'short-rent', roleKey: 'property_owner' }];
const PROPERTY_MANAGER = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];

const PANEL_URL = 'https://panel.channel-manager.test/';

/** When the rooms of the channel came in. */
const ROOMS_IN = '2026-11-10T10:05:00Z';

/** The counts of the listings of a channel: nothing, but what a test says. */
function counts(overrides: Partial<ExistingInventoryCounts> = {}): ExistingInventoryCounts {
  return { found: 0, roomsImported: 0, confirmed: 0, pending: 0, leftForLater: 0, rejected: 0, outOfScope: 0, reservationsImported: 0, calendarImported: 0, connected: 0, failed: 0, ...overrides };
}

/** An answer of the server that takes a little (the import is asked for and answered after the screen shows that it works). */
const later = (milliseconds = 30) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const choose = (scenario: InventoryScenario) => fireEvent.click(screen.getByTestId(`octorate-scenario-${scenario}`));
const next = () => fireEvent.click(screen.getByTestId('octorate-connect-next'));

function channel(overrides: Partial<ExistingInventoryChannel> = {}): ExistingInventoryChannel {
  return {
    channelCode: 'booking_xml',
    status: 'AwaitingChannelAccess',
    errorCode: null,
    accessState: 'Waiting',
    accessCompletedAt: null,
    roomsImportedAt: null,
    completedAt: null,
    counts: { found: 0, roomsImported: 0, confirmed: 0, pending: 0, leftForLater: 0, rejected: 0, outOfScope: 0, reservationsImported: 0, calendarImported: 0, connected: 0, failed: 0 },
    capabilities: { importRooms: true, importReservations: true, importCalendar: true, markConnected: true },
    items: [],
    ...overrides,
  };
}

function batch(channels: ExistingInventoryChannel[], overrides: Partial<ExistingInventoryBatch> = {}): ExistingInventoryBatch {
  return {
    id: 'batch-1',
    scenario: 'onOtas',
    scopeKind: 'AllInventory',
    group: null,
    propertyIds: [],
    status: 'AwaitingChannelAccess',
    errorCode: null,
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    completedAt: null,
    channels,
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
      get href(): string {
        throw new Error('The address of a page of another origin is never read');
      },
    },
  };
  return { win, navigated };
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  session.contexts = OWNER;
  session.flags = { octorateOnboarding: true };
  vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([]);
  vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Connected' }));
  vi.mocked(octorateApi.getFoundListings).mockResolvedValue([]);
  vi.mocked(octorateApi.refreshListings).mockResolvedValue([]);
  vi.mocked(octorateApi.setInventoryIntents).mockResolvedValue([]);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property({ id: 'p1', name: 'Casa Rosa' }), property({ id: 'p2', name: 'Casa Blu' })]);
  vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([]);
  vi.mocked(getMarketplaceCatalog).mockResolvedValue({
    octorate: { enabled: true, connected: true },
    groups: [
      {
        id: 'salesChannels',
        unchangedFlow: false,
        entries: [
          { kind: 'Channel', code: 'booking_xml', name: 'Booking.com', logoUrl: null, benefit: '', cost: { text: null, invoicedBy: 'Unknown' }, status: 'NotActive', statusScope: 'Org', canActivate: true, reason: null },
          { kind: 'Channel', code: 'airbnb_xml', name: 'Airbnb', logoUrl: null, benefit: '', cost: { text: null, invoicedBy: 'Unknown' }, status: 'NotActive', statusScope: 'Org', canActivate: true, reason: null },
        ],
      },
    ],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

/** Nothing of the connection is asked for or written by the first question: only the consent does it. */
function expectNoConnectionWrite() {
  expect(octorateApi.startConnect).not.toHaveBeenCalled();
  expect(octorateApi.completeConnect).not.toHaveBeenCalled();
  expect(octorateApi.disconnect).not.toHaveBeenCalled();
}

/** From the first question to the step where the OTAs are chosen, on a connected channel manager. */
async function toTheOtaChannels() {
  renderWizard();
  await onStep('scenario');
  choose('onOtas');
  next();
  await onStep('why');
  next();
  await onStep('consent');
  await waitFor(() => expect(screen.getByTestId('octorate-connect-next')).toBeEnabled(), WAIT);
  await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
  next();
  await onStep('existing-channels');
}

describe('the answers to the first question (E02/F01/US01/T04, E02/F01/US03/T02, D6)', () => {
  it('routeForScenario_EachAnswer_HasItsOwnKindOfPath', () => {
    expect(routeForScenario('onOctorate')).toMatchObject({ kind: 'consent', available: true });
    expect(routeForScenario('onOtas')).toMatchObject({ kind: 'import', available: true });
    expect(routeForScenario('newInventory')).toMatchObject({ kind: 'listing', available: true, path: PROPERTY_CREATE_PATH });
    // Three answers, three kinds: no path is shared.
    expect(new Set(INVENTORY_SCENARIOS.map((scenario) => routeForScenario(scenario).kind)).size).toBe(INVENTORY_SCENARIOS.length);
  });

  it('routeForScenario_AnswerAlreadyOnTheOtas_NeverLeadsToTheCreationOfAListing', () => {
    const route = routeForScenario('onOtas');

    expect(route.kind).toBe('import');
    expect(route.kind).not.toBe('listing');
    expect(route.path).toBeUndefined();
    expect(route.available).toBe(true);
  });

  it('routeForScenario_AnswerNotPublishedYet_NeverLeadsToAnImport', () => {
    const route = routeForScenario('newInventory');

    expect(route.kind).not.toBe('import');
    expect(route.path).toBe(PROPERTY_CREATE_PATH);
  });

  it('assignPortfolio_AMixedPortfolio_GivesEveryGroupTheRouteOfItsOwnAnswerOnly', () => {
    const groups: PortfolioGroup[] = [
      { id: 'milan', scenario: 'onOctorate', members: ['p1', 'p2'] },
      { id: 'rome', scenario: 'onOtas', members: ['p3'] },
      { id: 'turin', scenario: 'newInventory', members: ['p4', 'p5'] },
    ];

    const { routes, conflicts } = assignPortfolio(groups);

    expect(routes.map(({ groupId, route }) => [groupId, route.kind])).toEqual([
      ['milan', 'consent'],
      ['rome', 'import'],
      ['turin', 'listing'],
    ]);
    // The group that imports never gets the path that creates, and the one that creates never gets an import.
    expect(routes.find(({ groupId }) => groupId === 'rome')?.route.path).toBeUndefined();
    expect(routes.find(({ groupId }) => groupId === 'turin')?.route.kind).not.toBe('import');
    expect(conflicts).toEqual([]);
  });

  it('assignPortfolio_APropertyInGroupsWithDifferentAnswers_IsAConflict', () => {
    const { conflicts } = assignPortfolio([
      { id: 'imported', scenario: 'onOtas', members: ['p1', 'p2'] },
      { id: 'created', scenario: 'newInventory', members: ['p2', 'p3'] },
      { id: 'again', scenario: 'newInventory', members: ['p3'] },
    ]);

    // p2 would be imported and created; p3 is in two groups with the same answer, which is not incompatible.
    expect(conflicts).toEqual([{ member: 'p2', groupIds: ['imported', 'created'] }]);
  });

  it('assignmentsOf_AMixedPortfolio_DeclaresEachPropertyAndTheGroupsThatHaveNone', () => {
    const groups = readGroups([
      { scenario: 'onOtas', propertyIds: ['p1', 'p2'] },
      { scenario: 'newInventory', propertyIds: [] },
      { scenario: 'onOtas', propertyIds: ['p9'] },
      { scenario: 'somethingElse', propertyIds: ['p8'] },
      null,
    ]);

    // One group for each situation, once; one assignment for each property, and one for a group that has no property yet.
    expect(groups).toEqual([
      { scenario: 'onOtas', propertyIds: ['p1', 'p2'] },
      { scenario: 'newInventory', propertyIds: [] },
    ]);
    expect(assignmentsOf(groups)).toEqual([
      { propertyId: 'p1', scenario: 'onOtas', group: MIXED_GROUP_NAMES.onOtas },
      { propertyId: 'p2', scenario: 'onOtas', group: MIXED_GROUP_NAMES.onOtas },
      { scenario: 'newInventory', group: MIXED_GROUP_NAMES.newInventory },
    ]);
  });
});

describe('the first step of the wizard "Collega i tuoi canali"', () => {
  it('OctorateConnectWizard_FirstStep_AsksWhereTheListingsAreWithExactlyThreeAnswersAndTheMixedOne', async () => {
    renderWizard();

    await onStep('scenario');
    expect(screen.getByRole('heading', { level: 2, name: i18n.t('octorate.connect.steps.scenario.title') })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText(i18n.t('octorate.connect.scenario.onOctorate.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.scenario.onOtas.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.scenario.newInventory.title'))).toBeInTheDocument();
    expect(screen.getByTestId('octorate-scenario-mixed')).toHaveTextContent(i18n.t('octorate.connect.scenario.mixed.title'));
    // "Save and exit" is there from the first step (NF-06).
    expect(screen.getByTestId('octorate-connect-save-exit')).toBeInTheDocument();
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_EachAnswer_IsAvailableAndSaysWhatCasaZenWillDoWithIt', async () => {
    renderWizard();
    await onStep('scenario');

    for (const scenario of INVENTORY_SCENARIOS) expect(screen.getByTestId(`octorate-scenario-${scenario}`)).toBeEnabled();
    expect(screen.queryByTestId('octorate-scenario-confirm')).not.toBeInTheDocument();

    // «On the OTAs»: imports and keeps the ids, publishes nothing. «New»: says out loud that CasaZen creates.
    choose('onOtas');
    expect(screen.getByTestId('octorate-scenario-confirm')).toHaveTextContent(i18n.t('octorate.connect.scenario.confirm.onOtas'));
    expect(screen.getByTestId('octorate-scenario-confirm').textContent).toMatch(/importer/i);
    expect(screen.getByTestId('octorate-scenario-confirm').textContent).toMatch(/non pubblicher/i);
    choose('newInventory');
    expect(screen.getByTestId('octorate-scenario-confirm')).toHaveTextContent(i18n.t('octorate.connect.scenario.confirm.newInventory'));
    expect(screen.getByTestId('octorate-scenario-confirm').textContent).toMatch(/creer/i);
    fireEvent.click(screen.getByTestId('octorate-scenario-mixed'));
    expect(screen.getByTestId('octorate-scenario-confirm')).toHaveAttribute('data-scenario', 'mixed');
    expect(screen.queryAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0);
  });

  it('SCENARIO_STEP_SCHEMA_EachAnswer_IsCheckedBeforeTheStepMovesOn', () => {
    const messages = (values: unknown) => SCENARIO_STEP_SCHEMA.safeParse(values).error?.issues.map((issue) => issue.message) ?? [];

    for (const scenario of [...INVENTORY_SCENARIOS, 'mixed']) expect(SCENARIO_STEP_SCHEMA.safeParse({ scenario }).success, scenario).toBe(true);
    // No answer is an answer to give.
    expect(messages({ scenario: null })).toEqual(['octorate.connect.errors.scenarioRequired']);
    expect(messages({ scenario: 'somethingElse' })).toEqual(['octorate.connect.errors.scenarioRequired']);
  });

  it('SCENARIO_STEP_SCHEMA_ChangeToNewFromAnAnswerThatLedSomewhere_NeedsTheWarningAndIsRefusedOnceAnImportStarted', () => {
    const messages = (values: unknown) => SCENARIO_STEP_SCHEMA.safeParse(values).error?.issues.map((issue) => issue.message) ?? [];

    // Nothing was answered before: «new» is a plain answer.
    expect(SCENARIO_STEP_SCHEMA.safeParse({ scenario: 'newInventory', committedScenario: null }).success).toBe(true);
    // An answer that led somewhere becomes «new» only after the warning is read.
    expect(messages({ scenario: 'newInventory', committedScenario: 'onOctorate', acknowledgeNew: false })).toEqual(['octorate.connect.errors.scenarioChangeConfirm']);
    expect(SCENARIO_STEP_SCHEMA.safeParse({ scenario: 'newInventory', committedScenario: 'onOtas', acknowledgeNew: true }).success).toBe(true);
    // With an import batch it is refused, warning or not: it is never a way to recover from an import.
    expect(messages({ scenario: 'newInventory', committedScenario: 'onOtas', acknowledgeNew: true, batchId: 'batch-1' })).toEqual(['octorate.connect.errors.scenarioChangeRefused']);
  });

  it('OctorateConnectWizard_NoAnswer_DoesNotMoveOnAndSaysWhy', async () => {
    renderWizard();
    await onStep('scenario');

    next();

    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.errors.scenarioRequired'));
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'scenario');
    expect(currentLocation()).toBe(OCTORATE_CONNECT_PATH);
  });
});

describe('where each answer goes', () => {
  it('OctorateConnectWizard_AnswerOnTheChannelManager_GoesToWhyConnectAndThenToTheConsent', async () => {
    renderWizard();
    await onStep('scenario');

    choose('onOctorate');
    next();
    await onStep('why');
    expect(screen.getByRole('heading', { level: 2, name: i18n.t('octorate.connect.whyConnect') })).toBeInTheDocument();
    next();
    await onStep('consent');

    expect(await screen.findByTestId('octorate-consent-step', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
    // The consent starts only when the host presses its button.
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_AnswerNotPublishedYet_GoesToTheListingWizardAndNeverToAConsent', async () => {
    renderWizard();
    await onStep('scenario');

    choose('newInventory');
    next();
    await onStep('why');
    next();

    expect(await screen.findByTestId('listing-wizard', undefined, WAIT)).toBeInTheDocument();
    expect(currentLocation()).toBe(PROPERTY_CREATE_PATH);
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_AnswerOnTheOtas_ContinuesToTheChannelsAndNeverToTheListingWizard', async () => {
    renderWizard();
    await onStep('scenario');

    choose('onOtas');
    next();
    await onStep('why');
    next();
    await onStep('consent');
    await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
    next();
    await onStep('existing-channels');

    expect(screen.getByRole('heading', { level: 2, name: i18n.t('octorate.connect.steps.existingChannels.title') })).toBeInTheDocument();
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
    expect(currentLocation()).not.toBe(PROPERTY_CREATE_PATH);
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_AnswerAskedForInTheAddress_IsTheAnswerAndTheQuestionIsNotAskedAgain', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=onOtas`);

    await onStep('why');
    expect(screen.queryByTestId('octorate-scenario-step')).not.toBeInTheDocument();
    next();
    await onStep('consent');
  });

  it('OctorateConnectWizard_MixedAnswerAskedForInTheAddress_OpensTheGroupsAndNeverTheListingWizard', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=mixed`);

    await onStep('mixed');

    expect(await screen.findByTestId('mixed-portfolio-step', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_NewAskedForInTheAddress_StartsOnTheQuestionSoTheGuardOfTheAnswerRuns', async () => {
    // The address is never a way round the rule that an answer that led somewhere is warned about and refused once an import started.
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=newInventory`);

    await onStep('scenario');
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
    expect(screen.getByTestId('octorate-scenario-newInventory')).toBeChecked();
  });

  it('OctorateConnectWizard_ADraftWithTheAnswerOnTheOtas_ResumesTheSameRoadAfterAReload', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);

    await onStep('existing-channels');

    // The choice, the channels and the import are the draft: the same step opens with the channel and the batch the host left.
    const row = await screen.findByTestId('existing-channel-booking_xml', undefined, WAIT);
    await waitFor(() => expect(row).toHaveAttribute('data-state', 'waiting'));
    expect(octorateApi.getExistingInventoryBatch).toHaveBeenCalledWith('batch-1');
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_ADraftWithTheAnswerNotPublishedYet_NeverStartsAConsentOnTheConsentStep', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'consent', values: { scenario: 'newInventory' } });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=consent`);

    // «New» has no consent: the wizard opens on the question and starts nothing, whatever the address says.
    await onStep('scenario');
    expect(screen.queryByTestId('octorate-consent-step')).not.toBeInTheDocument();
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_SaveAndExit_LeavesFromEveryStepKeepingTheAnswer', async () => {
    renderWizard();
    await onStep('scenario');
    choose('onOctorate');
    next();
    await onStep('why');
    expect(screen.getByTestId('octorate-connect-save-exit')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('octorate-connect-save-exit'));

    expect(await screen.findByTestId('properties-list', undefined, WAIT)).toBeInTheDocument();
    // What was answered is the draft of the wizard: it is written as the page goes away.
    await waitFor(() => {
      const draft = readWizardDraft(WIZARD_DRAFT_ID, SCOPE);
      expect(draft?.step).toBe('why');
      // The answer, the one the host left the first step with, and the decisions about the listings (none yet): all travel with the draft.
      expect(draft?.values).toMatchObject({ scenario: 'onOctorate', committedScenario: 'onOctorate', decisions: [] });
    }, WAIT);
  });
});

describe('changing an answer to «new» (E02/F01/US03/T02)', () => {
  it('OctorateConnectWizard_ChangeFromAnExistingAnswerToNew_AsksToReadTheWarningFirst', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'scenario', values: { scenario: 'newInventory', committedScenario: 'onOctorate' } });
    renderWizard();
    await onStep('scenario');

    expect(await screen.findByTestId('octorate-scenario-change-warning', undefined, WAIT)).toBeInTheDocument();
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.errors.scenarioChangeConfirm'));
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'scenario');

    fireEvent.click(screen.getByTestId('octorate-scenario-change-ack'));
    next();
    await onStep('why');
  });

  it('OctorateConnectWizard_ChangeToNewAfterAnImportStarted_IsRefusedNotRecovered', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'scenario', values: { scenario: 'newInventory', committedScenario: 'onOtas', batchId: 'batch-1', acknowledgeNew: true } });
    renderWizard();
    await onStep('scenario');

    expect(await screen.findByTestId('octorate-scenario-change-refused', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.scenario.change.refused'));
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.errors.scenarioChangeRefused'));
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'scenario');
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
  });
});

describe('the mixed portfolio', () => {
  it('OctorateConnectWizard_MixedGroups_ShowCountsAndStopAPropertyThatWouldBeImportedAndCreated', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=mixed`);
    await onStep('mixed');

    fireEvent.click(await screen.findByTestId('mixed-group-onOtas-toggle'));
    fireEvent.click(screen.getByTestId('mixed-group-newInventory-toggle'));
    fireEvent.click(await screen.findByTestId('mixed-group-onOtas-property-p1'));
    fireEvent.click(await screen.findByTestId('mixed-group-newInventory-property-p1'));

    // Counts, and the conflict: the same property imported and created.
    expect(screen.getByTestId('mixed-portfolio-counts')).toHaveTextContent(i18n.t('octorate.connect.mixed.counts', { groups: 2, properties: 1 }));
    expect(screen.getByTestId('mixed-portfolio-conflicts')).toHaveTextContent('Casa Rosa');
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.errors.mixedConflict'));
    expect(octorateApi.setInventoryIntents).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_MixedGroups_AreDeclaredPropertyByPropertyAndEachGroupFollowsItsOwnRoad', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=mixed`);
    await onStep('mixed');

    fireEvent.click(await screen.findByTestId('mixed-group-onOtas-toggle'));
    fireEvent.click(screen.getByTestId('mixed-group-newInventory-toggle'));
    fireEvent.click(await screen.findByTestId('mixed-group-onOtas-property-p1'));
    fireEvent.click(await screen.findByTestId('mixed-group-newInventory-property-p2'));
    next();

    // The server keeps what the host declared: each property with its situation and its group.
    await waitFor(() => expect(octorateApi.setInventoryIntents).toHaveBeenCalledTimes(1), WAIT);
    expect(octorateApi.setInventoryIntents).toHaveBeenCalledWith([
      { propertyId: 'p1', scenario: 'onOtas', group: MIXED_GROUP_NAMES.onOtas },
      { propertyId: 'p2', scenario: 'newInventory', group: MIXED_GROUP_NAMES.newInventory },
    ]);
    // The group that imports has its consent and its channels; the group that is new waits for the host's word and never starts by itself.
    await onStep('consent');
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_MixedWithOneSituation_AsksForASecondOne', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?scenario=mixed`);
    await onStep('mixed');

    fireEvent.click(await screen.findByTestId('mixed-group-onOtas-toggle'));
    next();

    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.errors.mixedTwoSituations'));
    expect(octorateApi.setInventoryIntents).not.toHaveBeenCalled();
  });
});

describe('the existing listings: the access to the channels (E02/F01/US03/T02, D6)', () => {
  it('OctorateConnectWizard_ExistingChannels_ListTheOtasWithTheirStateAndStartTheAccessInAControlledWindow', async () => {
    const { win, navigated } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    vi.mocked(octorateApi.createExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NotStarted', status: 'Draft' })]));
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: 'booking_xml', alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    await toTheOtaChannels();

    // The OTAs of the catalog; the host says where the listings are, and presses the button of the channel.
    fireEvent.click(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT));
    expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'notStarted');
    expect(screen.getByTestId('existing-channel-booking_xml-state')).toHaveTextContent(i18n.t('octorate.connect.existing.channels.state.notStarted'));
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));

    // Stored first, opened after: the batch, the handoff, then the exact address in the controlled window; the step stays on screen.
    await waitFor(() => expect(octorateApi.startChannelAccess).toHaveBeenCalledWith('batch-1', 'booking_xml'), WAIT);
    expect(octorateApi.createExistingInventoryBatch).toHaveBeenCalledWith({ channels: ['booking_xml'] });
    await waitFor(() => expect(navigated).toEqual([PANEL_URL]), WAIT);
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'waiting'), WAIT);
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');
    expect(screen.queryByTestId(`existing-channel-booking_xml-confirm-box`)).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_ExistingChannelsWithAnEmptyList_SaysTheListIsBeingLoadedAndNeverThatNoPortalHasItsAccess', async () => {
    // The cache of the channel manager's catalog is filled a moment after the first start of an environment: until then the sales channels come back empty.
    const full = await getMarketplaceCatalog(undefined, 'it');
    vi.mocked(getMarketplaceCatalog).mockResolvedValue({ ...full, groups: [{ id: 'salesChannels', unchangedFlow: false, entries: [] }] });
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: [] } });
    const { container } = renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');

    // The step says the list is being loaded and to try again in a few minutes; it shows no card to choose and no request to choose one.
    const notice = await screen.findByTestId('existing-channels-empty', undefined, WAIT);
    expect(notice).toHaveTextContent(i18n.t('octorate.connect.existing.channels.empty'));
    expect(notice).toHaveTextContent(/qualche minuto/);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByTestId('existing-channels-none')).not.toBeInTheDocument();
    // There is nothing to go on with, so the main button waits: it cannot end in «Nessun portale ha ancora l'accesso».
    await waitFor(() => expect(screen.getByTestId('octorate-connect-next')).toBeDisabled(), WAIT);
    expect(screen.queryByText(i18n.t('octorate.connect.existing.errors.accessPending'))).not.toBeInTheDocument();
    expect(octorateApi.getExistingInventoryBatch).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);

    // The cache fills: the button reads the list again (and it is not the one of the wizard: pressing it moves nothing), the portals appear, the main button is back.
    vi.mocked(getMarketplaceCatalog).mockResolvedValue(full);
    fireEvent.click(screen.getByTestId('existing-channels-empty-retry'));
    expect(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('existing-channels-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');
    expect(screen.getByTestId('existing-channels-none')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('octorate-connect-next')).toBeEnabled(), WAIT);
  });

  it('OctorateConnectWizard_ExistingChannelsWithAnEmptyList_ThenInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    const full = await getMarketplaceCatalog(undefined, 'en');
    vi.mocked(getMarketplaceCatalog).mockResolvedValue({ ...full, groups: [{ id: 'salesChannels', unchangedFlow: false, entries: [] }] });
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: [] } });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');

    const notice = await screen.findByTestId('existing-channels-empty', undefined, WAIT);
    expect(notice).toHaveTextContent('The list of portals is still being loaded. Try again in a few minutes');
    expect(within(notice).getByTestId('existing-channels-empty-retry')).toHaveTextContent('Try again');
  });

  it('OctorateConnectWizard_ExistingChannelsChosenBeforeAndAnEmptyList_KeepTheirRowsAndTheMainButton', async () => {
    // Portals chosen in an earlier visit (the draft) are never hidden by a list that came back empty: their rows, and the way on, stay.
    const full = await getMarketplaceCatalog(undefined, 'it');
    vi.mocked(getMarketplaceCatalog).mockResolvedValue({ ...full, groups: [{ id: 'salesChannels', unchangedFlow: false, entries: [] }] });
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');

    expect(await screen.findByTestId('existing-channel-booking_xml', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('existing-channels-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('octorate-connect-next')).toBeEnabled();
  });

  it('OctorateConnectWizard_ExistingChannelsWithNoPortalChosen_AsksToChooseOneNeverThatNoPortalHasItsAccess', async () => {
    await toTheOtaChannels();
    await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT);
    expect(screen.queryByTestId('existing-channels-empty')).not.toBeInTheDocument();

    next();

    // The portals are there and none was chosen: the answer is to choose one, not that «no portal has its access yet».
    const problem = await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT);
    expect(problem).toHaveTextContent(i18n.t('octorate.connect.existing.channels.none'));
    expect(problem).not.toHaveTextContent(i18n.t('octorate.connect.existing.errors.accessPending'));
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');
  });

  it('OctorateConnectWizard_ExistingChannels_GoOnByThemselvesWhenTheAccessIsSeenAndNeverBefore', async () => {
    const { win } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    vi.mocked(octorateApi.createExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NotStarted', status: 'Draft' })]));
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: 'booking_xml', alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    vi.mocked(octorateApi.runExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Verified', status: 'AwaitingMapping' })]));
    await toTheOtaChannels();
    fireEvent.click(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT));
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'waiting'), WAIT);
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-channels');

    // The person comes back to the tab (no `blur` is sent: the one of the click came before the step was followed): one check, and CasaZen has seen the access. Nothing is pressed.
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Verified', status: 'ImportingRooms' })]));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await onStep('existing-import');
    expect(octorateApi.confirmChannelAccess).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_ExistingChannels_ConfirmationIsOfferedOnlyAfterACheckThatCouldNotTell', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    vi.mocked(octorateApi.confirmChannelAccess).mockResolvedValue(batch([channel({ accessState: 'Confirmed', status: 'ImportingRooms' })]));
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'waiting'), WAIT);

    // While CasaZen is still looking, there is nothing to confirm.
    expect(screen.queryByTestId('existing-channel-booking_xml-confirm')).not.toBeInTheDocument();

    // The person comes back to the tab and the check could not tell: only now the host is asked, and the word is theirs.
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NeedsConfirmation' })]));
    // (A page that was reloaded did not open the window: it saw the person leave and come back, so both events are sent.)
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    fireEvent.click(await screen.findByTestId('existing-channel-booking_xml-confirm', undefined, WAIT));

    await waitFor(() => expect(octorateApi.confirmChannelAccess).toHaveBeenCalledWith('batch-1', 'booking_xml'), WAIT);
  });

  it('OctorateConnectWizard_ExistingChannels_TheChecksRunOutBeforeThePersonIsBack_TheQuestionComesWhenTheyAre', async () => {
    const { win } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    vi.mocked(octorateApi.createExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NotStarted', status: 'Draft' })]));
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: 'booking_xml', alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    vi.mocked(octorateApi.confirmChannelAccess).mockResolvedValue(batch([channel({ accessState: 'Confirmed', status: 'ImportingRooms' })]));
    await toTheOtaChannels();
    fireEvent.click(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT));
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'waiting'), WAIT);

    // The server runs out of checks while the person is still on the panel (the step reads the batch by itself while it waits): the state comes first.
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NeedsConfirmation' })]));
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'needsConfirmation'), { timeout: 10_000 });
    // The person has not come back: nothing is asked of them yet.
    expect(screen.queryByTestId('existing-channel-booking_xml-confirm')).not.toBeInTheDocument();

    // They come back, after the state: now the question is there (the tab coming to the front is still watched), and the word is theirs.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    fireEvent.click(await screen.findByTestId('existing-channel-booking_xml-confirm', undefined, WAIT));
    await waitFor(() => expect(octorateApi.confirmChannelAccess).toHaveBeenCalledWith('batch-1', 'booking_xml'), WAIT);
  });

  it('OctorateConnectWizard_ChannelThatFailed_SaysWhyAndTheOthersAreNotHidden', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: ['booking_xml', 'airbnb_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(
      batch([
        channel({ channelCode: 'booking_xml', accessState: 'Verified', status: 'AwaitingMapping' }),
        channel({ channelCode: 'airbnb_xml', accessState: 'NotValid', status: 'NeedsAttention', errorCode: 'channel_access_not_valid' }),
      ]),
    );
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');

    await waitFor(() => expect(screen.getByTestId('existing-channel-airbnb_xml')).toHaveAttribute('data-state', 'error'), WAIT);
    expect(screen.getByTestId('existing-channel-airbnb_xml-error')).toHaveTextContent(i18n.t('apiErrors.codes.channelAccessNotValid'));
    // The channel that worked stays connected, and «Fallo per me» is there for the one that did not.
    expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'connected');
    expect(within(screen.getByTestId('existing-channel-airbnb_xml')).getByTestId('assist-request-button')).toBeInTheDocument();
  });

  it('ExistingInventoryWizard_NeverCollectsOtaCredentials_Test', async () => {
    const { win } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    vi.mocked(octorateApi.createExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NotStarted', status: 'Draft' })]));
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: 'booking_xml', alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Waiting' })]));
    await toTheOtaChannels();
    fireEvent.click(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT));
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));
    await waitFor(() => expect(octorateApi.startChannelAccess).toHaveBeenCalled(), WAIT);

    // The credentials of an OTA are given on the panel of the channel manager or on the OTA, never here: there is no field that could take one.
    const credential = /pass(word)?|token|secret|username|login|cookie|credential/i;
    const wizard = screen.getByTestId('octorate-connect-wizard');
    expect(wizard.querySelector('input[type="password"]')).toBeNull();
    for (const input of Array.from(wizard.querySelectorAll('input, textarea'))) {
      expect(['checkbox', 'radio']).toContain((input as HTMLInputElement).type);
      expect(`${input.getAttribute('name') ?? ''} ${input.id}`).not.toMatch(credential);
    }
    expect(screen.getByTestId('existing-channels-credentials-note')).toHaveTextContent(i18n.t('octorate.connect.existing.channels.credentials'));

    // No request carries one: the batch names channels, the access names a batch and a channel, nothing else.
    const bodies = [
      ...vi.mocked(octorateApi.createExistingInventoryBatch).mock.calls.map(([request]) => request),
      ...vi.mocked(octorateApi.startChannelAccess).mock.calls,
    ];
    expect(bodies.length).toBeGreaterThan(0);
    expect(JSON.stringify(bodies)).not.toMatch(credential);
    // And the draft, which is what is saved on the server and in the tab, holds only ids and codes.
    await waitFor(() => expect(readWizardDraft(WIZARD_DRAFT_ID, SCOPE)?.values).toMatchObject({ channels: ['booking_xml'], batchId: 'batch-1' }), WAIT);
    expect(JSON.stringify(readWizardDraft(WIZARD_DRAFT_ID, SCOPE)?.values)).not.toMatch(credential);
  });

  it('ExistingInventoryWizard_OnOtasNeverCallsCreate_Test', async () => {
    const { win } = fakeWindow();
    vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
    // What the server holds, as it moves along the whole road: the batch (the access, the rooms, the end) and the listings (what the host decided).
    let current = batch([channel({ accessState: 'Waiting' })]);
    const decided = new Map<string, OctorateListing>();
    vi.mocked(octorateApi.getExistingInventoryBatch).mockImplementation(async () => current);
    vi.mocked(octorateApi.createExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'NotStarted', status: 'Draft' })]));
    vi.mocked(octorateApi.startChannelAccess).mockResolvedValue({ channelCode: 'booking_xml', alreadyComplete: false, handoffMode: 'managedWindow', panelUrl: PANEL_URL });
    vi.mocked(octorateApi.confirmChannelAccess).mockImplementation(async () => {
      current = batch([channel({ accessState: 'Confirmed', status: 'AwaitingChannelAccess' })]);
      return current;
    });
    vi.mocked(octorateApi.runExistingInventoryBatch).mockImplementation(async () => {
      await later();
      current = batch([channel({ accessState: 'Confirmed', status: 'AwaitingMapping', roomsImportedAt: ROOMS_IN, counts: counts({ found: 3, roomsImported: 3, pending: 3 }) })]);
      return current;
    });
    vi.mocked(octorateApi.continueExistingInventoryBatch).mockImplementation(async () => {
      current = batch(
        [channel({ accessState: 'Confirmed', status: 'Completed', roomsImportedAt: ROOMS_IN, completedAt: ROOMS_IN, counts: counts({ found: 3, roomsImported: 3, confirmed: 2, leftForLater: 1, reservationsImported: 2, calendarImported: 2, connected: 2 }) })],
        { status: 'Completed', completedAt: ROOMS_IN },
      );
      return current;
    });
    vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
    vi.mocked(octorateApi.getFoundListings).mockImplementation(async () => [
      decided.get('acc-1') ?? listing(),
      decided.get('acc-new') ?? newListing(),
      listing({ octorateAccommodationId: 'acc-4', name: 'Casa Gialla', proposedProperty: null, status: 'Ambiguous' }),
    ]);
    vi.mocked(octorateApi.confirmMapping).mockImplementation(async (id) => {
      decided.set(id, linkedListing());
    });
    vi.mocked(octorateApi.importListing).mockImplementation(async (id) => {
      decided.set(id, linkedListing({ octorateAccommodationId: id, name: 'Casa Nuova', proposedProperty: { id: 'prop-9', name: 'Casa Nuova', address: '', city: '' } }));
      return { propertyId: 'prop-9' };
    });

    // The channel: the panel opens in its own window and the step stays on screen.
    await toTheOtaChannels();
    fireEvent.click(await screen.findByTestId('existing-channel-choice-booking_xml', undefined, WAIT));
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));
    await waitFor(() => expect(octorateApi.startChannelAccess).toHaveBeenCalled(), WAIT);
    await waitFor(() => expect(screen.getByTestId('existing-channel-booking_xml')).toHaveAttribute('data-state', 'waiting'), WAIT);

    // Every recovery path of the step: the panel again, the window closed, the confirmation after a check that could not tell.
    fireEvent.click(screen.getByTestId('existing-channel-booking_xml-open'));
    await waitFor(() => expect(octorateApi.startChannelAccess).toHaveBeenCalledTimes(2), WAIT);
    current = batch([channel({ accessState: 'NeedsConfirmation' })]);
    act(() => {
      win.closed = true;
    });
    fireEvent.click(await screen.findByTestId('existing-channel-booking_xml-confirm', undefined, WAIT));
    await waitFor(() => expect(octorateApi.confirmChannelAccess).toHaveBeenCalledWith('batch-1', 'booking_xml'), WAIT);

    // The import: it starts by itself once the access is given, stops at the mapping, and the wizard goes on.
    await onStep('mapping');
    expect(octorateApi.runExistingInventoryBatch).toHaveBeenCalledTimes(1);

    // The mapping: one listing confirmed to its property, one imported as a record of CasaZen (the server creates nothing on the channel manager for it), one left for later.
    fireEvent.click(await screen.findByTestId('octorate-mapping-confirm-acc-1', undefined, WAIT));
    fireEvent.click(screen.getByTestId('octorate-mapping-import-acc-new'));
    fireEvent.click(screen.getByTestId('octorate-connect-next'));
    await onStep('summary');
    fireEvent.click(screen.getByTestId('octorate-connect-finish'));

    // The end: what the host decided is done listing by listing, and the import goes on for the confirmed ones, naming the listing left for later (it stays write-blocked).
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(octorateApi.confirmMapping).toHaveBeenCalledWith('acc-1', 'prop-1', undefined);
    expect(octorateApi.continueExistingInventoryBatch).toHaveBeenCalledTimes(1);
    expect(octorateApi.continueExistingInventoryBatch).toHaveBeenCalledWith('batch-1', expect.objectContaining({ leaveForLater: ['acc-4'] }));
    // The result of the import, channel by channel, from what the server says.
    const result = await screen.findByTestId('existing-import-result', undefined, WAIT);
    await waitFor(() => expect(within(result).getByTestId('existing-result-booking_xml')).toHaveAttribute('data-status', 'Completed'), WAIT);
    expect(within(result).getByTestId('existing-result-booking_xml-counts')).toHaveTextContent(
      i18n.t('octorate.connect.existing.result.counts', { connected: 2, leftForLater: 1, failed: 0 }),
    );

    // No UI or request of the whole road creates or publishes a listing: the listing wizard is never mounted and its calls are never made; the only record of CasaZen
    // that was made is the import of the one listing the host chose (and the server says it creates nothing on the channel manager).
    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
    expect(currentLocation()).not.toContain(PROPERTY_CREATE_PATH);
    expect(propertiesApi.create).not.toHaveBeenCalled();
    expect(listingStatusApi.publish).not.toHaveBeenCalled();
    expect(octorateApi.importListing).toHaveBeenCalledTimes(1);
    expect(octorateApi.importListing).toHaveBeenCalledWith('acc-new');
  });
});

describe('«Fallo per me» in the wizard: for the administrator and with the flag (E10/F03/US02/T01, E02/F01/US03/T02)', () => {
  /** The step of the channels with one channel waiting for its access and one that stopped: where the button is, for whoever may have it. */
  async function toTheChannelsAndOneThatStopped() {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-channels', values: { scenario: 'onOtas', channels: ['booking_xml', 'airbnb_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(
      batch([
        channel({ channelCode: 'booking_xml', accessState: 'Waiting' }),
        channel({ channelCode: 'airbnb_xml', accessState: 'NotValid', status: 'NeedsAttention', errorCode: 'channel_access_not_valid' }),
      ]),
    );
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-channels`);
    await onStep('existing-channels');
    await waitFor(() => expect(screen.getByTestId('existing-channel-airbnb_xml')).toHaveAttribute('data-state', 'error'), WAIT);
  }

  /** The wizard works as ever; what is not there is the button, and with it the endpoint that answers 403 to anyone but the administrator (a read: the app would send the person to the no-access page). */
  function expectNothingOfTheAssistIsAskedNorShown() {
    expect(screen.getByTestId('existing-channel-booking_xml-open')).toBeInTheDocument();
    expect(screen.getByTestId('existing-channel-airbnb_xml-open')).toBeInTheDocument();
    expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
    expect(onboardingApi.listAssistRequests).not.toHaveBeenCalled();
    expect(onboardingApi.requestAssist).not.toHaveBeenCalled();
  }

  it('OctorateConnectWizard_Administrator_HasForMeOnEveryChannelThatIsNotConnected', async () => {
    await toTheChannelsAndOneThatStopped();

    expect(within(screen.getByTestId('existing-channel-booking_xml')).getByTestId('assist-request-button')).toBeInTheDocument();
    expect(within(screen.getByTestId('existing-channel-airbnb_xml')).getByTestId('assist-request-button')).toBeInTheDocument();
    await waitFor(() => expect(onboardingApi.listAssistRequests).toHaveBeenCalled(), WAIT);
  });

  it('OctorateConnectWizard_PropertyManagerWithOtaWrite_HasNoForMeAndNothingIsReadOrWrittenForIt', async () => {
    session.contexts = PROPERTY_MANAGER;
    await toTheChannelsAndOneThatStopped();

    expectNothingOfTheAssistIsAskedNorShown();
  });

  it('OctorateConnectWizard_FlagOnboardingOff_IsAsItWasAndNothingOfTheAssistIsAsked', async () => {
    session.flags = { octorateOnboarding: false };
    await toTheChannelsAndOneThatStopped();

    expectNothingOfTheAssistIsAskedNorShown();
  });
});

describe('the existing listings: the progress of the import (E02/F01/US03/T02, D6)', () => {
  /** The step of the import with one channel whose access is given and whose rooms are not in yet: the step starts the import by itself. */
  async function toTheImport() {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-import', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Verified', status: 'AwaitingChannelAccess' })]));
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-import`);
    await onStep('existing-import');
  }

  it('OctorateConnectWizard_ImportThatFailsToStart_SaysWhyAndRiprovaAsksAgainOnceNeverInALoop', async () => {
    vi.mocked(octorateApi.runExistingInventoryBatch)
      .mockRejectedValueOnce(axiosError(409, { code: 'existing_inventory_access_pending' }))
      .mockImplementation(async () => {
        await later();
        return batch([channel({ accessState: 'Verified', status: 'AwaitingMapping' })]);
      });
    await toTheImport();

    // The start the step makes by itself fails: the person is told why and has «Riprova» (no dead end), and the step does not ask again by itself.
    expect(await screen.findByTestId('existing-progress-run-error', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.existingInventoryAccessPending'));
    expect(screen.getByTestId('existing-progress-run-retry')).toHaveTextContent(i18n.t('octorate.connect.existing.progress.retry'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(octorateApi.runExistingInventoryBatch).toHaveBeenCalledTimes(1);

    // «Riprova» asks once more: the import gets to the mapping and the wizard goes on by itself.
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(batch([channel({ accessState: 'Verified', status: 'AwaitingMapping' })]));
    fireEvent.click(screen.getByTestId('existing-progress-run-retry'));
    await waitFor(() => expect(octorateApi.runExistingInventoryBatch).toHaveBeenCalledTimes(2), WAIT);
    await onStep('mapping');
    expect(octorateApi.runExistingInventoryBatch).toHaveBeenCalledTimes(2);
  });

  /** The state of the last step of the sequence of a channel on screen: `done`, `current`, `pending` or `attention`. */
  const lastStep = (row: HTMLElement) => row.querySelector('[data-step="connected"]')?.getAttribute('data-state');

  it('OctorateConnectWizard_ImportThatIsNotCompleted_ShowsTheStepsBeforeDoneAndNeverTheCompletion', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-import', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    // Everything is counted as brought in, and the server is still marking the listings as connected: it is not completed.
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(
      batch(
        [channel({ accessState: 'Confirmed', status: 'MarkingConnected', roomsImportedAt: ROOMS_IN, counts: counts({ found: 2, roomsImported: 2, confirmed: 2, reservationsImported: 2, calendarImported: 2 }) })],
        { status: 'MarkingConnected' },
      ),
    );
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-import`);
    await onStep('existing-import');

    const row = await screen.findByTestId('existing-progress-booking_xml', undefined, WAIT);
    // The sequence in the words of the wizard, each step with its state; the last one is the one that works.
    for (const step of ['rooms', 'mapping', 'reservations', 'calendar']) expect(row.querySelector(`[data-step="${step}"]`)).toHaveAttribute('data-state', 'done');
    expect(lastStep(row)).toBe('current');
    expect(within(row).getByText(i18n.t('octorate.connect.existing.progress.steps.connected'))).toBeInTheDocument();
    // No word of completion, and the wizard does not go on to the mapping.
    expect(screen.queryByTestId('existing-progress-completed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('existing-progress-at-mapping')).not.toBeInTheDocument();
    expect(screen.getByTestId('octorate-connect-wizard')).toHaveAttribute('data-step', 'existing-import');
  });

  it('OctorateConnectWizard_ImportThatTheServerSaysIsCompleted_ShowsEveryStepDoneAndTheCompletion', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-import', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(
      batch(
        [channel({ accessState: 'Confirmed', status: 'Completed', roomsImportedAt: ROOMS_IN, completedAt: ROOMS_IN, counts: counts({ found: 2, roomsImported: 2, confirmed: 2, reservationsImported: 2, calendarImported: 2, connected: 2 }) })],
        { status: 'Completed', completedAt: ROOMS_IN },
      ),
    );
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-import`);
    await onStep('existing-import');

    const row = await screen.findByTestId('existing-progress-booking_xml', undefined, WAIT);
    for (const step of ['rooms', 'mapping', 'reservations', 'calendar', 'connected']) expect(row.querySelector(`[data-step="${step}"]`)).toHaveAttribute('data-state', 'done');
    expect(await screen.findByTestId('existing-progress-completed')).toHaveTextContent(i18n.t('octorate.connect.existing.progress.completed'));
  });

  it('OctorateConnectWizard_ChannelThatStoppedInTheImport_SaysWhyAndRiprovaAsksForThatChannelAgain', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'existing-import', values: { scenario: 'onOtas', channels: ['booking_xml'], batchId: 'batch-1' } });
    vi.mocked(octorateApi.getExistingInventoryBatch).mockResolvedValue(
      batch([channel({ accessState: 'Confirmed', status: 'NeedsAttention', errorCode: 'channel_connection_not_found', roomsImportedAt: null })], { status: 'NeedsAttention' }),
    );
    vi.mocked(octorateApi.runExistingInventoryBatch).mockImplementation(async () => {
      await later();
      return batch([channel({ accessState: 'Confirmed', status: 'ImportingRooms' })]);
    });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=existing-import`);
    await onStep('existing-import');

    // A channel that stopped is not run again by itself; it says why, in the words of the app, and the host asks again.
    const stopped = await screen.findByTestId('existing-progress-booking_xml-stopped', undefined, WAIT);
    expect(stopped).toHaveTextContent(i18n.t('apiErrors.codes.channelConnectionNotFound'));
    expect(octorateApi.runExistingInventoryBatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('existing-progress-booking_xml-retry'));
    await waitFor(() => expect(octorateApi.runExistingInventoryBatch).toHaveBeenCalledWith('batch-1', undefined), WAIT);
  });
});

describe('accessibility of the first two steps (NF-14)', () => {
  it('OctorateConnectWizard_FirstTwoSteps_HaveNoViolationThatAxeCanFindWithoutABrowser', async () => {
    const { container } = renderWizard();
    await onStep('scenario');
    await expectNoAxeViolations(container);

    choose('onOctorate');
    next();
    await onStep('why');
    await expectNoAxeViolations(container);
  });
});

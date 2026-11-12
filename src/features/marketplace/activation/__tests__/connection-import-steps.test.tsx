import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { getActivation, getActivationMapping, getActivationPlan, importActivation, startActivation } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import { writeWizardDraft } from '@/lib/wizard-draft';
import {
  ACTIVATION_PATH,
  SCOPE,
  WAIT,
  WIZARD_DRAFT_ID,
  axiosError,
  channelRoom,
  mapping,
  onStep,
  plan,
  primaryButton,
  property,
  renderActivation,
  state,
} from './activation-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
  startActivation: vi.fn(),
  getActivation: vi.fn(),
  importActivation: vi.fn(),
  getActivationMapping: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true } }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const ROSA = property('prop-1', 'Casa Rosa');
const AZZURRA = property('prop-2', 'Casa Azzurra');
const ACTIVATION_IDS: Record<string, string> = { 'prop-1': 'act-1', 'prop-2': 'act-2' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

interface Host {
  properties?: ReturnType<typeof property>[];
  requirements?: string[];
  /** The properties that already have their activation (and so their connection). */
  connected?: string[];
}

/** The host's properties, and what the channel manager says: the plan of each, the state of the activations that exist. */
function givenTheHost({ properties = [ROSA], requirements = [], connected = [] }: Host = {}) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue(properties);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) =>
    plan({
      propertyId,
      requirements,
      activationId: connected.includes(propertyId) ? ACTIVATION_IDS[propertyId] : null,
      activationStatus: connected.includes(propertyId) ? 'Pending' : null,
    }),
  );
  vi.mocked(getActivation).mockImplementation(async (id) => state({ activationId: id, propertyId: id === 'act-2' ? 'prop-2' : 'prop-1' }));
  vi.mocked(startActivation).mockImplementation(async (request) =>
    state({ activationId: ACTIVATION_IDS[request.propertyId], propertyId: request.propertyId }),
  );
  vi.mocked(importActivation).mockImplementation(async (id) => state({ activationId: id }));
  vi.mocked(getActivationMapping).mockImplementation(async (id) => mapping([channelRoom()], id));
}

/** The person chose both properties (the draft of the wizard says it) and is on `step`. */
function bothChosenOn(step: string) {
  writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step, values: { propertyIds: ['prop-1', 'prop-2'], hotelIds: {} } });
}

const row = (propertyId: string) => screen.getByTestId(`activation-connection-${propertyId}`);

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the connection step: it creates the connection once', () => {
  it('ConnectionStep_FirstPass_CreatesTheConnectionOnceWithOnlyWhatThePortalAsksForAndForgetsTheAccessData', async () => {
    givenTheHost({ requirements: ['hotelId', 'credentials'] });
    // The import that follows is not what is looked at here: it never ends.
    vi.mocked(importActivation).mockReturnValue(new Promise(() => undefined));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=access`);

    fireEvent.change(await screen.findByTestId('activation-hotel-id-prop-1', {}, WAIT), { target: { value: ' 5551234 ' } });
    fireEvent.change(screen.getByTestId('activation-username'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByTestId('activation-password'), { target: { value: 'pw-1' } });
    fireEvent.click(primaryButton());

    // The connection is made, and the wizard goes on by itself to the import.
    await onStep('import');
    expect(startActivation).toHaveBeenCalledTimes(1);
    expect(startActivation).toHaveBeenCalledWith({ kind: 'Channel', code: '142', propertyId: 'prop-1', hotelId: '5551234', username: 'ana', password: 'pw-1' });

    // Going back shows the connection as made, creates nothing, and the access data was forgotten once it was used.
    fireEvent.click(screen.getByTestId('activation-back'));
    await onStep('connection');
    await waitFor(() => expect(row('prop-1')).toHaveAttribute('data-state', 'done'), WAIT);
    expect(startActivation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('activation-back'));
    await onStep('access');
    expect(screen.getByTestId('activation-username')).toHaveValue('');
    expect(screen.getByTestId('activation-password')).toHaveValue('');
  });

  it('ConnectionStep_PropertyThatHasItsActivation_IsReadAndASecondConnectionIsNeverCreated', async () => {
    givenTheHost({ connected: ['prop-1'] });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=connection`);

    await waitFor(() => expect(row('prop-1')).toHaveAttribute('data-state', 'done'), WAIT);
    expect(startActivation).not.toHaveBeenCalled();
    expect(getActivation).toHaveBeenCalledWith('act-1');
    // A visit that finds the connection made shows it and leaves «Continua» to the person: it does not go on by itself.
    await onStep('connection');
    fireEvent.click(primaryButton());
    await onStep('import');
  });

  it('ConnectionStep_SeveralProperties_AreConnectedOneAfterTheOther', async () => {
    givenTheHost({ properties: [ROSA, AZZURRA] });
    const first = deferred<ReturnType<typeof state>>();
    vi.mocked(startActivation).mockImplementation((request) =>
      request.propertyId === 'prop-1' ? first.promise : Promise.resolve(state({ activationId: 'act-2', propertyId: 'prop-2' })),
    );
    vi.mocked(importActivation).mockReturnValue(new Promise(() => undefined));
    // Both are chosen; the portal asks for nothing, so the access step is not there and the connection starts at once.
    bothChosenOn('connection');
    renderActivation(`${ACTIVATION_PATH}?step=connection`);
    await waitFor(() => expect(startActivation).toHaveBeenCalledTimes(1), WAIT);
    expect(vi.mocked(startActivation).mock.calls[0][0].propertyId).toBe('prop-1');
    expect(row('prop-1')).toHaveAttribute('data-state', 'running');

    // The second property waits for the first: nothing is asked for it before the first has ended.
    expect(startActivation).toHaveBeenCalledTimes(1);
    first.resolve(state({ activationId: 'act-1', propertyId: 'prop-1' }));
    await waitFor(() => expect(startActivation).toHaveBeenCalledTimes(2), WAIT);
    expect(vi.mocked(startActivation).mock.calls[1][0].propertyId).toBe('prop-2');
    await waitFor(() => expect(row('prop-2')).toHaveAttribute('data-state', 'done'), WAIT);
  });
});

describe('the connection step: what goes wrong', () => {
  it('ConnectionStep_ChannelRefuses_IsToldAsARefusalWithTheReasonAndFixLeadsBackToTheAccess', async () => {
    givenTheHost({ requirements: ['credentials'] });
    vi.mocked(startActivation).mockRejectedValue(axiosError(502, { code: 'octorate_partner_failed' }));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=access`);

    fireEvent.change(await screen.findByTestId('activation-username', {}, WAIT), { target: { value: 'ana' } });
    fireEvent.change(screen.getByTestId('activation-password'), { target: { value: 'wrong' } });
    fireEvent.click(primaryButton());

    const problem = await screen.findByTestId('activation-connection-prop-1-problem', {}, WAIT);
    // «The channel refused the connection», with the reason it gave: never an error of CasaZen.
    expect(problem).toHaveTextContent(i18n.t('marketplace.activation.connection.failed.refused', { name: 'Booking.com' }));
    expect(problem).toHaveTextContent(i18n.t('apiErrors.codes.octoratePartnerFailed'));
    expect(screen.queryByTestId('activation-connection-prop-1-retry')).not.toBeInTheDocument();
    // It is not asked again by itself.
    expect(startActivation).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('activation-connection-prop-1-fix'));

    await onStep('access');
    // The access data is still there to be corrected (it is forgotten only once the connection is made).
    expect(screen.getByTestId('activation-username')).toHaveValue('ana');
  });

  it('ConnectionStep_PropertyWithoutItsAccessData_AsksForItAgainInsteadOfCallingTheServer', async () => {
    // A reload on the connection step: the login the person typed is gone with the page.
    givenTheHost({ requirements: ['credentials'] });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=connection`);

    await waitFor(() => expect(row('prop-1')).toHaveAttribute('data-state', 'needsAccess'), WAIT);
    expect(startActivation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('activation-connection-prop-1-fix'));
    await onStep('access');
  });

  it('ConnectionStep_ContinueBeforeEveryPropertyIsConnected_IsRefusedAndSaysWhy', async () => {
    givenTheHost({ requirements: ['credentials'] });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=connection`);
    await waitFor(() => expect(row('prop-1')).toHaveAttribute('data-state', 'needsAccess'), WAIT);

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('activation-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.activation.errors.connectionNotReady'));
    await onStep('connection');
  });

  it('ConnectionStep_ChannelManagerDoesNotShowTheConnectionYet_IsSaidAndCanBeTriedAgainNeverWaitedForInSilence', async () => {
    givenTheHost();
    vi.mocked(startActivation).mockResolvedValueOnce(state({ connectionFound: false, connectionStatus: null }));
    vi.mocked(importActivation).mockReturnValue(new Promise(() => undefined));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=connection`);

    expect(await screen.findByTestId('activation-connection-prop-1-unconfirmed', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.activation.connection.unconfirmed'));
    expect(row('prop-1')).toHaveAttribute('data-state', 'unconfirmed');
    // It is not asked again by itself, and the wizard does not go on.
    expect(startActivation).toHaveBeenCalledTimes(1);
    await onStep('connection');

    fireEvent.click(screen.getByTestId('activation-connection-prop-1-retry'));
    await onStep('import');
    expect(startActivation).toHaveBeenCalledTimes(2);
  });

  it('ConnectionStep_FailureOfTheServerThatIsNotARefusal_CanBeTriedAgain', async () => {
    givenTheHost();
    vi.mocked(startActivation).mockRejectedValueOnce(axiosError(502, { code: 'octorate_unavailable' }));
    vi.mocked(importActivation).mockReturnValue(new Promise(() => undefined));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=connection`);

    fireEvent.click(await screen.findByTestId('activation-connection-prop-1-retry', {}, WAIT));

    await onStep('import');
    expect(startActivation).toHaveBeenCalledTimes(2);
  });
});

describe('the import step', () => {
  it('ImportStep_ConnectedProperty_AsksForTheImportOnceAndGoesOnWhenTheRoomsAreIn', async () => {
    givenTheHost({ connected: ['prop-1'] });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=import`);

    // The rooms arrive while this visit watches: the wizard goes on by itself to the mapping.
    await onStep('mapping');
    expect(importActivation).toHaveBeenCalledTimes(1);
    expect(importActivation).toHaveBeenCalledWith('act-1');

    // Back to the import: it is read, not asked again, and the wizard does not jump forward by itself.
    fireEvent.click(screen.getByTestId('activation-back'));
    await onStep('import');
    await waitFor(() => expect(screen.getByTestId('activation-import-prop-1')).toHaveAttribute('data-rooms', 'in'), WAIT);
    expect(importActivation).toHaveBeenCalledTimes(1);
    await onStep('import');
  });

  it('ImportStep_RoomsArrived_AreDoneButTheReservationsAndTheCalendarAreOnlyAskedNeverFinished', async () => {
    givenTheHost({ connected: ['prop-1'] });
    // The rooms arrive, and the person stays to read: the step is opened again, after the import was asked.
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=import`);
    await onStep('mapping');
    fireEvent.click(screen.getByTestId('activation-back'));
    await onStep('import');

    const list = await screen.findByTestId('activation-import-prop-1', {}, WAIT);
    await waitFor(() => expect(list).toHaveAttribute('data-rooms', 'in'), WAIT);
    expect(list.querySelector('[data-item="rooms"]')).toHaveAttribute('data-state', 'done');
    expect(list.querySelector('[data-item="reservations"]')).toHaveAttribute('data-state', 'requested');
    expect(list.querySelector('[data-item="calendar"]')).toHaveAttribute('data-state', 'requested');
  });

  it('ImportStep_RoomsNotInYet_ShowsTheWaitAndContinueIsRefusedUntilTheyAre', async () => {
    givenTheHost({ connected: ['prop-1'] });
    vi.mocked(getActivationMapping).mockResolvedValue(mapping([]));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=import`);

    const list = await screen.findByTestId('activation-import-prop-1', {}, WAIT);
    await waitFor(() => expect(list.querySelector('[data-item="rooms"]')).toHaveAttribute('data-state', 'waiting'), WAIT);
    expect(screen.getByTestId('activation-import-leave')).toHaveTextContent(i18n.t('marketplace.activation.import.leave'));

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('activation-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.activation.errors.roomsNotIn'));
    await onStep('import');
  });

  it('ImportStep_PanelAccessNotGivenYet_IsToldAndFixLeadsBackToTheAccess', async () => {
    givenTheHost({ connected: ['prop-1'], requirements: ['hotelId'] });
    vi.mocked(importActivation).mockRejectedValue(axiosError(409, { code: 'marketplace_panel_access_pending' }));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=import`);

    const problem = await screen.findByTestId('activation-import-prop-1-problem', {}, WAIT);
    expect(problem).toHaveTextContent(i18n.t('apiErrors.codes.marketplacePanelAccessPending'));
    fireEvent.click(screen.getByTestId('activation-import-prop-1-fix'));

    await onStep('access');
    // It was asked once and not again by itself.
    expect(importActivation).toHaveBeenCalledTimes(1);
  });

  it('ImportStep_ImportRefusedForOneProperty_DoesNotStopTheNext', async () => {
    givenTheHost({ properties: [ROSA, AZZURRA], connected: ['prop-1', 'prop-2'] });
    vi.mocked(importActivation).mockImplementation(async (id) => {
      if (id === 'act-1') throw axiosError(502, { code: 'octorate_unavailable' });
      return state({ activationId: id, propertyId: 'prop-2' });
    });
    bothChosenOn('import');
    renderActivation(`${ACTIVATION_PATH}?step=import`);

    await waitFor(() => expect(importActivation).toHaveBeenCalledWith('act-2'), WAIT);
    expect(vi.mocked(importActivation).mock.calls.map(([id]) => id)).toEqual(['act-1', 'act-2']);
    expect(await screen.findByTestId('activation-import-prop-1-problem', {}, WAIT)).toBeInTheDocument();
  });
});

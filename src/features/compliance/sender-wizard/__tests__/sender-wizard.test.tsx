import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertySenderApi } from '@/api/property-sender.api';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { wizardDraftApi } from '@/api/wizard-draft.api';
import type { PropertySender, SenderConnectionTest } from '@/types';
import { SenderWizardPage } from '../sender-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/property-sender.api', () => ({ propertySenderApi: { get: vi.fn(), switch: vi.fn(), testConnection: vi.fn(), declareActivated: vi.fn() } }));
vi.mock('@/api/questura-credentials.api', () => ({ questuraCredentialsApi: { getStatus: vi.fn(), set: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/wizard-draft.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/wizard-draft.api')>()),
  wizardDraftApi: { get: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));
const workspace = vi.hoisted(() => ({ permissions: ['property.read', 'property.write'] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (context: string, permission: string) => context === 'short-rent' && workspace.permissions.includes(permission),
    contexts: [],
    getDefaultRoute: () => '/app/short-rent',
  }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };
const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const ADDRESS = `/app/short-rent/compliance/sender?property=${PROPERTY_ID}`;
const VERSION = '2026-11-v1';
const SECRET = 'S3cretPassw0rd!';

function senderOf(change: Partial<PropertySender> = {}): PropertySender {
  return {
    propertyId: PROPERTY_ID,
    sender: 'Manual',
    istatSender: 'Manual',
    source: 'DefaultNotConnected',
    applies: true,
    state: 'NotConfigured',
    verification: 'NotApplicable',
    reason: null,
    guidance: null,
    policeAccountValid: null,
    policeAutorun: null,
    policeLastCron: null,
    questuraCredentialsConfigured: false,
    channelManagerAvailable: true,
    availableSenders: ['ChannelManager', 'Manual'],
    delegationAccepted: false,
    delegationTextVersion: VERSION,
    declaredAt: null,
    lastChangedAt: null,
    ...change,
  };
}

function testOf(change: Partial<SenderConnectionTest> = {}): SenderConnectionTest {
  return { sender: 'ChannelManager', outcome: 'Verified', reason: null, guidance: null, policeAccountValid: true, policeAutorun: true, policeLastCron: null, checkedAt: '2026-11-13T10:00:00Z', ...change };
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

/** What the server holds: the sender and the answer of the test. The fake applies the same rules as the endpoints it stands for (the sender in effect is the one set, `Active` only when the test verified). */
let server: PropertySender;
let testResult: SenderConnectionTest;

function installServer() {
  vi.mocked(propertySenderApi.get).mockImplementation(async () => ({ ...server }));
  vi.mocked(propertySenderApi.switch).mockImplementation(async (_id, request) => {
    server = {
      ...server,
      sender: request.sender,
      istatSender: request.sender,
      source: 'Stored',
      delegationAccepted: server.delegationAccepted || request.delegationConsent,
      state: request.sender === 'Manual' ? 'NotConfigured' : 'Unverified',
      verification: request.sender === 'Manual' ? 'NotApplicable' : 'Unverifiable',
    };
    return { ...server };
  });
  vi.mocked(propertySenderApi.testConnection).mockImplementation(async () => {
    if (testResult.outcome === 'Verified') server = { ...server, state: 'Active', verification: 'Verified', policeAccountValid: true, policeAutorun: true };
    return testResult;
  });
  vi.mocked(propertySenderApi.declareActivated).mockImplementation(async () => {
    server = { ...server, state: 'Declared', verification: 'UserDeclared', declaredAt: '2026-11-13T10:05:00Z' };
    return { ...server };
  });
  vi.mocked(questuraCredentialsApi.set).mockResolvedValue({ configured: true, configuredAt: '2026-11-13T10:06:00Z' });
  vi.mocked(wizardDraftApi.get).mockResolvedValue(null);
  vi.mocked(wizardDraftApi.save).mockResolvedValue({ status: 'saved', version: 1, lastSavedAt: '2026-11-13T10:00:00Z' });
  vi.mocked(wizardDraftApi.remove).mockResolvedValue(undefined);
}

function LocationProbe() {
  const location = useLocation();
  return createElement('div', { 'data-testid': 'location' }, `${location.pathname}${location.search}`);
}

function renderWizard(url: string = ADDRESS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(LocationProbe),
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/app/short-rent/compliance/sender', element: createElement(SenderWizardPage) }),
          createElement(Route, { path: '/app/short-rent/properties/:id', element: createElement('div', { 'data-testid': 'property-page' }) }),
        ),
      ),
    ),
  );
  return { client, ...view };
}

const wizard = () => screen.getByTestId('sender-wizard');
const click = (testId: string) => fireEvent.click(screen.getByTestId(testId));
const primary = () => screen.queryByTestId('sender-next') ?? screen.getByTestId('sender-finish');
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

async function open(url?: string) {
  const view = renderWizard(url);
  // The shell shows a spinner under its own test id until the draft of the server is read: the wizard is open when its first step is.
  await screen.findByTestId('sender-choice-step', undefined, WAIT);
  return view;
}

/** From the first step to the test of a channel manager that was not the sender: the consent, the confirmation of the change, the credentials left out and the panel passed. */
async function toTheTest() {
  click('sender-option-ChannelManager');
  await waitFor(() => expect(screen.getByTestId('sender-delegation-consent')).toBeInTheDocument(), WAIT);
  click('sender-delegation-consent');
  fireEvent.click(primary());
  await onStep('summary');
  click('sender-switch-confirmed');
  fireEvent.click(primary());
  await onStep('credentials');
  click('wizard-skip');
  await onStep('panel');
  fireEvent.click(primary());
  await onStep('test');
}

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = ['property.read', 'property.write'];
  server = senderOf();
  testResult = testOf();
  installServer();
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

// E03/F01/US02/T02 (NF-42, NF-49, NF-04, NF-05).
describe('SenderWizardPage: the way into the wizard', () => {
  it('SenderWizardPage_PersonWhoMayNotWriteTheProperties_AsksNothingOfTheServerAndSaysSo', async () => {
    workspace.permissions = ['property.read'];
    renderWizard();

    expect(await screen.findByText(text('compliance.sender.noPermission.title'))).toBeInTheDocument();
    expect(propertySenderApi.get).not.toHaveBeenCalled();
    expect(wizardDraftApi.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sender-wizard')).not.toBeInTheDocument();
  });

  it('SenderWizardPage_PropertyThatIsNotFound_IsSaidNotFoundAndNeverAWizard', async () => {
    vi.mocked(propertySenderApi.get).mockRejectedValue(problem(404, { code: 'property_not_found' }));
    renderWizard();

    expect(await screen.findByText(text('compliance.sender.notFound.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('sender-wizard')).not.toBeInTheDocument();
  });

  it('SenderWizardPage_ReadThatFailed_IsAnErrorWithARetryAndNeverAWizardThatLooksFine', async () => {
    vi.mocked(propertySenderApi.get).mockRejectedValue(problem(500, {}));
    renderWizard();

    expect(await screen.findByTestId('sender-wizard-error')).toBeInTheDocument();
    expect(screen.queryByTestId('sender-wizard')).not.toBeInTheDocument();
  });

  it('SenderWizardPage_PropertyOutsideItaly_HasNoSenderToChoose', async () => {
    server = senderOf({ applies: false, availableSenders: [], state: 'NotConfigured', source: 'NotApplicable' });
    renderWizard();

    expect(await screen.findByText(text('compliance.sender.notApplicable.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('sender-wizard')).not.toBeInTheDocument();
  });

  it('SenderWizardPage_AddressWithoutAProperty_AsksWhichOneAndAddressWithANonIdIsNeverSentToTheServer', async () => {
    renderWizard('/app/short-rent/compliance/sender?property=../../admin');

    expect(await screen.findByTestId('sender-wizard-properties-loading')).toBeInTheDocument();
    expect(propertySenderApi.get).not.toHaveBeenCalled();
  });
});

describe('SenderWizardPage: who sends (NF-42, NF-49)', () => {
  it('SenderWizardPage_PropertyWithoutAChannelManager_OffersOnlyTheOtherWaysWithCasaZenNotAvailable', async () => {
    server = senderOf({ channelManagerAvailable: false, availableSenders: ['Manual'] });
    await open();

    expect(screen.queryByTestId('sender-option-ChannelManager')).not.toBeInTheDocument();
    expect(screen.getByTestId('sender-option-CasaZen')).toBeDisabled();
    expect(screen.getByTestId('sender-option-Manual')).toBeChecked();
    expect(screen.getByTestId('sender-option-Manual').closest('label')).toHaveTextContent(text('compliance.sender.choice.options.Manual.title'));
    // CasaZen says why it cannot be chosen, and nothing in the wizard names the channel manager's supplier.
    expect(screen.getByTestId('sender-choice-step')).toHaveTextContent(text('compliance.sender.choice.notAvailable'));
    expect(wizard().textContent ?? '').not.toMatch(/octorate/i);
    // The same wizard: the choice and the summary, and no panel to pass through.
    expect(screen.queryByTestId('sender-delegation')).not.toBeInTheDocument();
  });

  it('SenderWizardPage_ConnectedProperty_StartsFromItsChannelManagerAsTheDefault', async () => {
    server = senderOf({ sender: 'ChannelManager', source: 'DefaultConnected', state: 'Unverified', verification: 'Unverifiable' });
    await open();

    expect(screen.getByTestId('sender-option-ChannelManager')).toBeChecked();
    // What is true now is told on the first step, and it is not «Attivo».
    expect(screen.getByTestId('sender-current-state')).toHaveAttribute('data-state', 'unverified');
  });

  it('SenderWizardPage_ChannelManagerWithoutTheConsentToTheDelegation_StaysOnTheChoiceAndSaysWhy', async () => {
    await open();
    click('sender-option-ChannelManager');
    await waitFor(() => expect(screen.getByTestId('sender-delegation-text')).toBeInTheDocument(), WAIT);

    fireEvent.click(primary());

    expect(await screen.findByTestId('wizard-error-summary')).toHaveTextContent(text('compliance.sender.errors.consentRequired'));
    expect(wizard()).toHaveAttribute('data-step', 'choice');
    expect(propertySenderApi.switch).not.toHaveBeenCalled();
  });

  it('SenderWizardPage_TextOfTheDelegationThisPageCannotShow_IsNeverConsentedTo', async () => {
    server = senderOf({ delegationTextVersion: '2099-01-v9' });
    await open();

    click('sender-option-ChannelManager');

    expect(await screen.findByTestId('sender-delegation-unknown')).toBeInTheDocument();
    expect(screen.queryByTestId('sender-delegation-consent')).not.toBeInTheDocument();
    fireEvent.click(primary());
    await waitFor(() => expect(screen.getByTestId('wizard-error-summary')).toBeInTheDocument(), WAIT);
    expect(wizard()).toHaveAttribute('data-step', 'choice');
  });

  it('SenderWizardPage_OrganizationThatAlreadyAcceptedTheDelegation_IsNotAskedForItAgain', async () => {
    server = senderOf({ delegationAccepted: true });
    await open();

    click('sender-option-ChannelManager');

    expect(await screen.findByTestId('sender-delegation-accepted')).toBeInTheDocument();
    expect(screen.queryByTestId('sender-delegation-consent')).not.toBeInTheDocument();
  });
});

describe('SenderWizardPage: the change of the sender (NF-05)', () => {
  it('SenderWizardPage_ChangeToManual_AsksTheConfirmationFirstAndSendsItWithTheChange', async () => {
    server = senderOf({ sender: 'ChannelManager', source: 'DefaultConnected', state: 'Unverified', verification: 'Unverifiable', delegationAccepted: true });
    await open();
    click('sender-option-Manual');
    fireEvent.click(primary());
    await onStep('summary');

    // The summary says what goes off and asks the host to confirm it; nothing is sent before.
    expect(screen.getByTestId('sender-switch-confirmation')).toHaveTextContent(text('compliance.sender.summary.switch.toManual'));
    fireEvent.click(primary());
    expect(await screen.findByTestId('wizard-error-summary')).toHaveTextContent(text('compliance.sender.errors.confirmRequired'));
    expect(propertySenderApi.switch).not.toHaveBeenCalled();

    click('sender-switch-confirmed');
    fireEvent.click(primary());

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    // The host's own send needs no consent: none is sent, and no version of a text with it.
    expect(propertySenderApi.switch).toHaveBeenCalledWith(PROPERTY_ID, { sender: 'Manual', confirmed: true, delegationConsent: false });
    const done = await screen.findByTestId('sender-wizard-done');
    expect(done).toHaveAttribute('data-outcome', 'manual');
  });

  it('SenderWizardPage_ConsentAndChange_AreSentTogetherWithTheVersionOfTheTextTheHostRead', async () => {
    await open();
    await toTheTest();

    expect(propertySenderApi.switch).toHaveBeenCalledTimes(1);
    expect(propertySenderApi.switch).toHaveBeenCalledWith(PROPERTY_ID, { sender: 'ChannelManager', confirmed: true, delegationConsent: true, delegationTextVersion: VERSION });
  });

  it('SenderWizardPage_ServerSaysTheSenderChangedMeanwhile_StaysOnTheSummaryWithTheWordsOfTheKindAndChangesNothing', async () => {
    vi.mocked(propertySenderApi.switch).mockRejectedValue(problem(409, { code: 'sender_switch_confirmation_required', currentSender: 'CasaZen', newSender: 'Manual' }));
    server = senderOf({ sender: 'ChannelManager', source: 'DefaultConnected', state: 'Unverified', verification: 'Unverifiable', delegationAccepted: true });
    await open();
    click('sender-option-Manual');
    fireEvent.click(primary());
    await onStep('summary');
    click('sender-switch-confirmed');
    fireEvent.click(primary());

    const message = await screen.findByTestId('sender-finish-error');
    expect(message).toHaveTextContent(text('compliance.sender.errors.confirmationRequired'));
    expect(wizard()).toHaveAttribute('data-step', 'summary');
    expect(screen.queryByTestId('sender-wizard-done')).not.toBeInTheDocument();
  });
});

describe('SenderWizardPage: the test and «Attivo» (NF-42)', () => {
  it('SenderWizardPage_TestThatVerifies_IsTheOnlyWayToAttivoAndTheResultSaysSo', async () => {
    await open();
    await toTheTest();

    // Before the test nothing is «Attivo» and there is nothing to conclude.
    expect(screen.getByTestId('sender-test-state')).not.toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('sender-finish')).toBeDisabled();

    click('sender-test-run');
    await waitFor(() => expect(screen.getByTestId('sender-test-state')).toHaveAttribute('data-state', 'active'), WAIT);
    expect(screen.getByTestId('sender-test-detail')).toHaveTextContent(text('compliance.sender.test.outcome.active'));
    fireEvent.click(screen.getByTestId('sender-finish'));

    const done = await screen.findByTestId('sender-wizard-done');
    expect(done).toHaveAttribute('data-outcome', 'active');
    expect(screen.getByTestId('sender-done-title')).toHaveTextContent(text('compliance.sender.done.active.title'));
  });

  it('SenderWizardPage_TestThatCannotTell_AsksAndAYesIsADeclarationNeverAVerification', async () => {
    testResult = testOf({ outcome: 'Unverifiable', reason: 'octorate_police_not_exposed', policeAccountValid: null, policeAutorun: null });
    await open();
    await toTheTest();

    click('sender-test-run');
    expect(await screen.findByTestId('sender-declare')).toHaveTextContent(text('compliance.sender.test.ask.title'));
    expect(screen.getByTestId('sender-test-state')).toHaveAttribute('data-state', 'unverified');

    click('sender-declare-yes');

    await waitFor(() => expect(propertySenderApi.declareActivated).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.getByTestId('sender-test-state')).toHaveAttribute('data-state', 'declared'), WAIT);
    expect(screen.getByTestId('sender-test-state')).toHaveTextContent(text('compliance.sender.state.declared'));
    expect(screen.queryByTestId('sender-declare')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sender-finish'));

    // The result is the host's word, with the tone of what is not complete: «Dichiarato attivo», never the green «Attivo».
    const done = await screen.findByTestId('sender-wizard-done');
    expect(done).toHaveAttribute('data-outcome', 'declared');
    expect(screen.getByTestId('sender-done-title')).toHaveTextContent(text('compliance.sender.done.declared.title'));
    expect(done.textContent ?? '').not.toContain(text('compliance.sender.done.active.title'));
  });

  it('SenderWizardPage_TestThatCannotTellAndTheAnswerNo_GoesBackToThePanelAndDeclaresNothing', async () => {
    testResult = testOf({ outcome: 'Unverifiable', reason: 'octorate_police_not_exposed' });
    await open();
    await toTheTest();
    click('sender-test-run');
    await screen.findByTestId('sender-declare');

    click('sender-declare-no');

    await onStep('panel');
    expect(propertySenderApi.declareActivated).not.toHaveBeenCalled();
  });

  it('SenderWizardPage_TestThatFindsTheSendOff_SaysWhatToFixWithAButtonToTheStepWhereItIsFixed', async () => {
    testResult = testOf({ outcome: 'Inactive', reason: 'octorate_police_autorun_off', policeAutorun: false });
    await open();
    await toTheTest();

    click('sender-test-run');

    await waitFor(() => expect(screen.getByTestId('sender-test-state')).toHaveAttribute('data-state', 'inactive'), WAIT);
    expect(screen.getByTestId('sender-test-guidance')).toHaveTextContent(text('compliance.sender.test.reason.octorate_police_autorun_off'));
    click('sender-test-fix');
    await onStep('panel');
  });

  it('SenderWizardPage_TestThatFailsToRun_IsAFailureAndNeverAStateAndTheHostCannotConclude', async () => {
    vi.mocked(propertySenderApi.testConnection).mockRejectedValue(problem(500, {}));
    await open();
    await toTheTest();

    click('sender-test-run');

    expect(await screen.findByTestId('sender-test-error')).toHaveTextContent(text('compliance.sender.test.error'));
    expect(screen.getByTestId('sender-test-state')).not.toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('sender-finish')).toBeDisabled();
  });

  it('SenderWizardPage_RequestInFlight_LocksEveryButtonOfTheCardUntilItEnds', async () => {
    let release: (value: SenderConnectionTest) => void = () => undefined;
    vi.mocked(propertySenderApi.testConnection).mockImplementation(
      () =>
        new Promise<SenderConnectionTest>((resolve) => {
          release = resolve;
        }),
    );
    await open();
    await toTheTest();

    click('sender-test-run');

    await waitFor(() => expect(screen.getByTestId('sender-test-run')).toBeDisabled(), WAIT);
    // The way between the steps is shut too: a request that must not meet a change of step is on its way.
    expect(screen.getByTestId('sender-back')).toBeDisabled();
    expect(screen.getByTestId('sender-finish')).toBeDisabled();
    release(testOf());
    await waitFor(() => expect(screen.getByTestId('sender-test-run')).not.toBeDisabled(), WAIT);
  });
});

describe('SenderWizardPage: the credentials of the portal never stay anywhere', () => {
  it('SenderWizardPage_CredentialsSaved_LeaveTheFieldsTheCacheTheStorageAndTheDraftAndAreNeverShownAgain', async () => {
    const { client } = await open();
    click('sender-option-ChannelManager');
    await screen.findByTestId('sender-delegation-consent');
    click('sender-delegation-consent');
    fireEvent.click(primary());
    await onStep('summary');
    click('sender-switch-confirmed');
    fireEvent.click(primary());
    await onStep('credentials');

    // The fields are fields of a password, and nothing offers to remember them.
    const password = screen.getByLabelText(text('questuraCredentials.fields.password'));
    const key = screen.getByLabelText(text('questuraCredentials.fields.wsKey'));
    expect(password).toHaveAttribute('type', 'password');
    expect(key).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'off');
    expect(key).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(text('questuraCredentials.fields.username'))).toHaveAttribute('autocomplete', 'off');
    fireEvent.change(screen.getByLabelText(text('questuraCredentials.fields.username')), { target: { value: 'host@example.com' } });
    fireEvent.change(password, { target: { value: SECRET } });
    fireEvent.change(key, { target: { value: 'ws-key-123' } });
    // Typed and not yet saved: they are in no draft either.
    await new Promise((resolve) => setTimeout(resolve, 500));

    click('sender-credentials-save');

    await waitFor(() => expect(questuraCredentialsApi.set).toHaveBeenCalledWith(PROPERTY_ID, { username: 'host@example.com', password: SECRET, wsKey: 'ws-key-123' }), WAIT);
    await waitFor(() => expect(screen.getByLabelText(text('questuraCredentials.fields.password'))).toHaveValue(''), WAIT);
    expect(screen.getByLabelText(text('questuraCredentials.fields.wsKey'))).toHaveValue('');
    expect(screen.getByLabelText(text('questuraCredentials.fields.username'))).toHaveValue('');

    // The mutation is dropped (`gcTime: 0`) and keeps no variables; neither storage of the browser nor any draft sent to the server holds the values.
    await waitFor(() => expect(client.getMutationCache().getAll().filter((mutation) => JSON.stringify(mutation.state.variables ?? null).includes(SECRET))).toEqual([]), WAIT);
    const stored = [...Array(localStorage.length).keys()].map((index) => localStorage.getItem(localStorage.key(index) ?? '')).concat([...Array(sessionStorage.length).keys()].map((index) => sessionStorage.getItem(sessionStorage.key(index) ?? '')));
    expect(JSON.stringify(stored)).not.toContain(SECRET);
    expect(JSON.stringify(vi.mocked(wizardDraftApi.save).mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(vi.mocked(wizardDraftApi.save).mock.calls)).not.toContain('host@example.com');
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('SenderWizardPage_CredentialsRefused_AreNotKeptInTheErrorOfTheRequest', async () => {
    vi.mocked(questuraCredentialsApi.set).mockRejectedValue(
      Object.assign(problem(422, { code: 'questura_credentials_invalid' }), { config: { headers: new AxiosHeaders(), data: JSON.stringify({ password: SECRET }) } }),
    );
    const { client } = await open();
    click('sender-option-ChannelManager');
    await screen.findByTestId('sender-delegation-consent');
    click('sender-delegation-consent');
    fireEvent.click(primary());
    await onStep('summary');
    click('sender-switch-confirmed');
    fireEvent.click(primary());
    await onStep('credentials');
    fireEvent.change(screen.getByLabelText(text('questuraCredentials.fields.username')), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByLabelText(text('questuraCredentials.fields.password')), { target: { value: SECRET } });
    fireEvent.change(screen.getByLabelText(text('questuraCredentials.fields.wsKey')), { target: { value: 'ws-key-123' } });

    click('sender-credentials-save');

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), WAIT);
    const errors = client
      .getMutationCache()
      .getAll()
      .map((mutation) => mutation.state.error as AxiosError | null)
      .filter((error): error is AxiosError => error !== null);
    // What a failure keeps is its answer: the request that was sent (which holds the body) is not in it.
    for (const error of errors) expect(JSON.stringify(error.config?.data ?? null)).not.toContain(SECRET);
  });
});

describe('SenderWizardPage: leaving and coming back (NF-04, NF-06)', () => {
  it('SenderWizardPage_SaveAndExit_LeavesToThePropertyAndKeepsTheAnswersAsTheDraftOfThePropertyWithoutTheConfirmation', async () => {
    await open();
    click('sender-option-ChannelManager');
    await screen.findByTestId('sender-delegation-consent');
    click('sender-delegation-consent');
    fireEvent.click(primary());
    await onStep('summary');
    click('sender-switch-confirmed');

    click('sender-wizard-save-exit');

    await waitFor(() => expect(screen.getByTestId('property-page')).toBeInTheDocument(), WAIT);
    expect(screen.getByTestId('location')).toHaveTextContent(`/app/short-rent/properties/${PROPERTY_ID}?section=connection-health`);
    expect(toast.success).toHaveBeenCalledWith(text('compliance.sender.exit.saved'));
    // Nothing was changed by leaving; the draft is the property's, and the confirmation of a change is not part of it.
    expect(propertySenderApi.switch).not.toHaveBeenCalled();
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalled(), WAIT);
    const [type, body] = vi.mocked(wizardDraftApi.save).mock.calls.at(-1)!;
    expect(type).toBe('ComplianceSender');
    expect(body.entityId).toBe(PROPERTY_ID);
    expect(Object.keys((body.data as { values: Record<string, unknown> }).values)).not.toContain('switchConfirmed');
    expect((body.data as { values: Record<string, unknown> }).values.sender).toBe('ChannelManager');
  });

  it('SenderWizardPage_Help_IsOnEveryStepAndOpensOverTheWizardWithoutLeavingIt', async () => {
    await open();

    click('sender-wizard-help');

    const dialog = await screen.findByTestId('sender-wizard-help-dialog');
    expect(within(dialog).getByText(text('compliance.sender.help.choice'))).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(ADDRESS);
  });
});

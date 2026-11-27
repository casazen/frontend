import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { propertySenderApi } from '@/api/property-sender.api';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { wizardDraftApi } from '@/api/wizard-draft.api';
import { PROPERTY_SENDER_KEY } from '@/queries/use-property-sender';
import type { Property, PropertySender } from '@/types';
import { SENDER_DRAFT_EXCLUDE, SENDER_WIZARD_DEFAULTS, autoSendRefused, toSwitchRequest, type SenderWizardValues } from '../sender-wizard-model';
import { SenderWizardPage } from '../sender-wizard';
import { SenderWizardDone } from '../sender-wizard-done';
import { SenderSummaryStep } from '../steps/sender-summary-step';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/properties.api')>();
  return { ...original, propertiesApi: { ...original.propertiesApi, getAll: vi.fn(), getById: vi.fn() } };
});
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

vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };
const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const OTHER_PROPERTY_ID = '7a1c9d20-3b4e-4f5a-8c6d-0e1f2a3b4c5d';
const ADDRESS = `/app/short-rent/compliance/sender?property=${PROPERTY_ID}`;
const VERSION = '2026-11-v1';
const ADMIN = 'org.billing.admin';

function senderOf(change: Partial<PropertySender> = {}): PropertySender {
  return {
    propertyId: PROPERTY_ID,
    sender: 'ChannelManager',
    istatSender: 'ChannelManager',
    source: 'Stored',
    applies: true,
    state: 'Unverified',
    verification: 'Unverifiable',
    reason: null,
    guidance: null,
    policeAccountValid: null,
    policeAutorun: null,
    policeLastCron: null,
    questuraCredentialsConfigured: false,
    channelManagerAvailable: true,
    availableSenders: ['ChannelManager', 'Manual'],
    delegationAccepted: true,
    delegationTextVersion: VERSION,
    declaredAt: null,
    lastChangedAt: null,
    autoSendGuestsToOctorate: false,
    ...change,
  };
}

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

const values = (change: Partial<SenderWizardValues> = {}): SenderWizardValues => ({ ...SENDER_WIZARD_DEFAULTS, sender: 'ChannelManager', ...change });

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = ['property.read', 'property.write'];
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('the request that carries the automatic send of the guests', () => {
  it('toSwitchRequest_AdministratorChangesTheSetting_CarriesItWithTheChannelManager', () => {
    const request = toSwitchRequest(values({ autoSendGuests: true }), senderOf(), { canChangeAutoSend: true });

    expect(request).toEqual({ sender: 'ChannelManager', confirmed: false, delegationConsent: false, autoSendGuestsToOctorate: true });
  });

  it('toSwitchRequest_AdministratorSwitchesItOff_CarriesFalseNotNothing', () => {
    const request = toSwitchRequest(values({ autoSendGuests: false }), senderOf({ autoSendGuestsToOctorate: true }), { canChangeAutoSend: true });

    expect(request.autoSendGuestsToOctorate).toBe(false);
  });

  it('toSwitchRequest_SettingNotChanged_IsNotSent', () => {
    expect('autoSendGuestsToOctorate' in toSwitchRequest(values({ autoSendGuests: true }), senderOf({ autoSendGuestsToOctorate: true }), { canChangeAutoSend: true })).toBe(false);
    expect('autoSendGuestsToOctorate' in toSwitchRequest(values({ autoSendGuests: false }), senderOf(), { canChangeAutoSend: true })).toBe(false);
  });

  it('toSwitchRequest_PersonWhoIsNotTheAdministrator_NeverSendsTheSettingWhateverTheFormHolds_Test', () => {
    const asked = values({ autoSendGuests: true });

    expect('autoSendGuestsToOctorate' in toSwitchRequest(asked, senderOf())).toBe(false);
    expect('autoSendGuestsToOctorate' in toSwitchRequest(asked, senderOf(), { canChangeAutoSend: false })).toBe(false);
  });

  // The setting is the organization's: another page, property or person may have turned it on since this one was read. A switch nobody touched never sends a value.
  it('toSwitchRequest_SwitchNeverTouched_NeverSendsTheSettingWhateverTheServerHolds', () => {
    expect('autoSendGuestsToOctorate' in toSwitchRequest(values(), senderOf({ autoSendGuestsToOctorate: true }), { canChangeAutoSend: true })).toBe(false);
    expect('autoSendGuestsToOctorate' in toSwitchRequest(values({ autoSendGuests: null }), senderOf({ autoSendGuestsToOctorate: false }), { canChangeAutoSend: true })).toBe(false);
  });

  it('toSwitchRequest_SenderThatIsNotTheChannelManager_HasNoSettingToChange', () => {
    const request = toSwitchRequest(values({ sender: 'Manual', autoSendGuests: true }), senderOf({ sender: 'Manual' }), { canChangeAutoSend: true });

    expect('autoSendGuestsToOctorate' in request).toBe(false);
  });

  it('SENDER_DRAFT_EXCLUDE_TheSetting_IsNeverKeptInADraftSoItStartsFromWhatTheServerSaysNow', () => {
    expect(SENDER_DRAFT_EXCLUDE).toContain('autoSendGuests');
  });

  it('autoSendRefused_Only403OfARequestThatCarriedTheSettingAndNotTheCodesOfTheDelegation', () => {
    const carried = { autoSendGuestsToOctorate: true };

    expect(autoSendRefused(problem(403, {}), carried)).toBe(true);
    expect(autoSendRefused(problem(403, { code: 'alloggiati_delegation_required' }), carried)).toBe(false);
    expect(autoSendRefused(problem(403, {}), {})).toBe(false);
    expect(autoSendRefused(problem(409, {}), carried)).toBe(false);
    expect(autoSendRefused(new Error('x'), carried)).toBe(false);
  });
});

describe('SenderSummaryStep: the setting «Invia gli ospiti da solo…»', () => {
  function Harness({ initial, read, canChange }: { initial: Partial<SenderWizardValues>; read: PropertySender; canChange: boolean }) {
    const form = useForm<SenderWizardValues>({ defaultValues: values(initial) });
    const held = useWatch({ control: form.control, name: 'autoSendGuests' });
    return createElement(
      FormProvider,
      form as never,
      createElement(SenderSummaryStep, { read, canChangeAutoSend: canChange }),
      createElement('output', { 'data-testid': 'held' }, String(held)),
    );
  }

  function renderStep(props: { initial?: Partial<SenderWizardValues>; read?: PropertySender; canChange: boolean }) {
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, name: 'Casa Como' } as Property);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(Harness, { initial: props.initial ?? {}, read: props.read ?? senderOf(), canChange: props.canChange })),
      ),
    );
  }

  it('summaryStep_Administrator_SeesTheSwitchWithItsLabelAndOneSentenceOfConsequenceThatFollowsIt', () => {
    renderStep({ canChange: true });

    const toggle = screen.getByRole('switch', { name: "Invia gli ospiti da solo quando i dati sono completi e l'identità è verificata" });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('sender-auto-send-consequence')).toHaveTextContent('solo quando confermi tu il check-in');
    expect(screen.getByTestId('sender-switch-none')).toHaveTextContent('non cambia nulla');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('held')).toHaveTextContent('true');
    expect(screen.getByTestId('sender-auto-send-consequence')).toHaveTextContent('senza che tu confermi il check-in');
    expect(screen.getByTestId('sender-switch-none')).toHaveTextContent('cambia solo questa impostazione');
    expect(screen.getByTestId('sender-switch-none').textContent ?? '').not.toMatch(/non cambia nulla/);
    expect(screen.getByTestId('sender-auto-send').textContent ?? '').not.toMatch(/octorate/i);
  });

  it('summaryStep_PersonWhoIsNotTheAdministrator_IsToldTheSettingAndIsOfferedNoSwitch_Test', () => {
    renderStep({ canChange: false, initial: { autoSendGuests: true }, read: senderOf({ autoSendGuestsToOctorate: true }) });

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('sender-auto-send-readonly')).toHaveTextContent("L'invio automatico degli ospiti è acceso.");
    expect(screen.getByTestId('sender-auto-send')).toHaveTextContent("Solo il titolare o un amministratore dell'organizzazione può cambiarlo.");
  });

  it('summaryStep_SwitchNeverTouched_ShowsWhatTheServerHoldsNowAndNothingChanges', () => {
    renderStep({ canChange: true, read: senderOf({ autoSendGuestsToOctorate: true }) });

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('held')).toHaveTextContent('null');
    expect(screen.getByTestId('sender-switch-none')).toHaveTextContent('non cambia nulla');
  });

  it('summaryStep_SenderThatIsNotTheChannelManager_HasNoSettingAtAll', () => {
    renderStep({ canChange: true, initial: { sender: 'Manual' }, read: senderOf({ sender: 'Manual' }) });

    expect(screen.queryByTestId('sender-auto-send')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

describe('SenderWizardDone: the line about the automatic send', () => {
  function renderDone(sender: PropertySender) {
    vi.mocked(propertySenderApi.get).mockResolvedValue(sender);
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, name: 'Casa Como' } as Property);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SenderWizardDone, { propertyId: PROPERTY_ID }))));
  }

  it('done_SenderTheServerVerified_PutsTheGreenCheckOnTheLine', async () => {
    renderDone(senderOf({ state: 'Active', verification: 'Verified', autoSendGuestsToOctorate: true }));

    const line = await screen.findByTestId('sender-done-auto-send', undefined, WAIT);
    expect(line).toHaveAttribute('data-tone', 'done');
    expect(line).toHaveTextContent('senza che tu confermi il check-in');
    expect(line.querySelector('svg')?.getAttribute('class') ?? '').toMatch(/text-success-foreground/);
  });

  it.each([
    ['the host word', senderOf({ state: 'Declared', verification: 'UserDeclared', autoSendGuestsToOctorate: true })],
    ['a sender that cannot be told', senderOf({ state: 'Unverified', verification: 'Unverifiable', autoSendGuestsToOctorate: false })],
    ['a sender that does not send', senderOf({ state: 'Inactive', verification: 'Unverifiable', autoSendGuestsToOctorate: true })],
  ])('done_ResultThatIsNotComplete_%s_NeverGivesTheLineTheGreenCheck', async (_name, sender) => {
    renderDone(sender);

    const line = await screen.findByTestId('sender-done-auto-send', undefined, WAIT);
    expect(line).not.toHaveAttribute('data-tone', 'done');
    const sign = line.querySelector('svg')?.getAttribute('class') ?? '';
    expect(sign).not.toMatch(/success/);
    expect(sign).toMatch(/text-muted-foreground/);
  });
});

describe('SenderWizardPage: the setting is saved with the summary and the wizard stays', () => {
  let server: PropertySender;

  function installServer() {
    vi.mocked(propertySenderApi.get).mockImplementation(async () => ({ ...server }));
    vi.mocked(propertySenderApi.switch).mockImplementation(async (_id, request) => {
      server = { ...server, sender: request.sender, autoSendGuestsToOctorate: request.autoSendGuestsToOctorate ?? server.autoSendGuestsToOctorate };
      return { ...server };
    });
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, name: 'Casa Como' } as Property);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([]);
    vi.mocked(questuraCredentialsApi.set).mockResolvedValue({ configured: true, configuredAt: '2026-11-15T10:06:00Z' });
    vi.mocked(wizardDraftApi.get).mockResolvedValue(null);
    vi.mocked(wizardDraftApi.save).mockResolvedValue({ status: 'saved', version: 1, lastSavedAt: '2026-11-15T10:00:00Z' });
    vi.mocked(wizardDraftApi.remove).mockResolvedValue(undefined);
  }

  function LocationProbe() {
    const location = useLocation();
    return createElement('div', { 'data-testid': 'location' }, `${location.pathname}${location.search}`);
  }

  const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  function renderWizard(client: QueryClient = newClient()) {
    return render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [ADDRESS] },
          createElement(LocationProbe),
          createElement(Routes, null, createElement(Route, { path: '/app/short-rent/compliance/sender', element: createElement(SenderWizardPage) })),
        ),
      ),
    );
  }

  const wizard = () => screen.getByTestId('sender-wizard');
  const next = () => fireEvent.click(screen.getByTestId('sender-next'));

  async function toTheSummary(client?: QueryClient) {
    renderWizard(client);
    await screen.findByTestId('sender-choice-step', undefined, WAIT);
    next();
    await waitFor(() => expect(wizard()).toHaveAttribute('data-step', 'summary'), WAIT);
  }

  beforeEach(() => {
    server = senderOf();
    installServer();
  });

  it('SenderWizardPage_AdministratorTurnsItOn_SendsItWithTheSummaryTellsTheResultAndStaysInTheWizard', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    await toTheSummary();

    fireEvent.click(screen.getByRole('switch'));
    next();

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    expect(propertySenderApi.switch).toHaveBeenCalledWith(PROPERTY_ID, { sender: 'ChannelManager', confirmed: false, delegationConsent: false, autoSendGuestsToOctorate: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('compliance.sender.autoSend.saved.on')), WAIT);
    await waitFor(() => expect(wizard()).toHaveAttribute('data-step', 'credentials'), WAIT);
    expect(screen.getByTestId('location')).toHaveTextContent(ADDRESS);
  });

  it('SenderWizardPage_SettingOnItsWay_KeepsTheSwitchOffUntilTheServerAnswers', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    let answer: (sender: PropertySender) => void = () => undefined;
    vi.mocked(propertySenderApi.switch).mockReturnValue(new Promise<PropertySender>((resolve) => (answer = resolve)));
    await toTheSummary();

    fireEvent.click(screen.getByRole('switch'));
    next();

    await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled(), WAIT);
    expect(propertySenderApi.switch).toHaveBeenCalledTimes(1);

    answer({ ...server, autoSendGuestsToOctorate: true });
    await waitFor(() => expect(wizard()).toHaveAttribute('data-step', 'credentials'), WAIT);
  });

  it('SenderWizardPage_AdministratorLeavesItAsItWas_SendsNothingAboutIt', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    await toTheSummary();

    next();

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    expect(propertySenderApi.switch).toHaveBeenCalledWith(PROPERTY_ID, { sender: 'ChannelManager', confirmed: false, delegationConsent: false });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SenderWizardPage_PersonWhoIsNotTheAdministrator_HasNoSwitchAndTheRequestCarriesNothingAboutIt_Test', async () => {
    await toTheSummary();

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByTestId('sender-auto-send-readonly')).toBeInTheDocument();
    next();

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    expect(Object.keys(vi.mocked(propertySenderApi.switch).mock.calls[0][1])).not.toContain('autoSendGuestsToOctorate');
  });

  it('SenderWizardPage_ServerRefusesTheSetting_StaysOnTheSummaryWithTheWordsAndChangesNothing', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    vi.mocked(propertySenderApi.switch).mockRejectedValue(problem(403, {}));
    await toTheSummary();

    fireEvent.click(screen.getByRole('switch'));
    next();

    const message = await screen.findByTestId('sender-finish-error', undefined, WAIT);
    expect(message).toHaveTextContent(i18n.t('compliance.sender.errors.autoSendNotAllowed'));
    expect(wizard()).toHaveAttribute('data-step', 'summary');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SenderWizardPage_SettingOfTheOrganization_StartsFromWhatTheServerSaysNow', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    server = senderOf({ autoSendGuestsToOctorate: true });
    await toTheSummary();

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  // The page opens with what an older visit cached (the setting off) while the server holds it on since another property's wizard turned it on: a switch nobody touched shows what
  // the server says and never puts the old value back.
  it('SenderWizardPage_SenderCachedBeforeTheSettingWasTurnedOnElsewhere_NeverPutsItBackWithoutTheSwitchBeingTouched', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    server = senderOf({ autoSendGuestsToOctorate: true });
    const client = newClient();
    client.setQueryData([PROPERTY_SENDER_KEY, PROPERTY_ID], senderOf({ autoSendGuestsToOctorate: false }));
    await toTheSummary(client);

    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'), WAIT);
    next();

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    expect(Object.keys(vi.mocked(propertySenderApi.switch).mock.calls[0][1])).not.toContain('autoSendGuestsToOctorate');
    expect(server.autoSendGuestsToOctorate).toBe(true);
  });

  it('SenderWizardPage_SettingChanged_ReadsAgainTheSenderOfEveryPropertyOfTheOrganization', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    const client = newClient();
    const other = [PROPERTY_SENDER_KEY, OTHER_PROPERTY_ID] as const;
    client.setQueryData(other, senderOf({ propertyId: OTHER_PROPERTY_ID }));
    await toTheSummary(client);

    fireEvent.click(screen.getByRole('switch'));
    next();

    await waitFor(() => expect(propertySenderApi.switch).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(client.getQueryState(other)?.isInvalidated).toBe(true), WAIT);
  });

  it('SenderWizardPage_SaveAndExit_NeverKeepsTheSettingInTheDraftSoItAlwaysStartsFromTheServerNextTime', async () => {
    workspace.permissions = ['property.read', 'property.write', ADMIN];
    await toTheSummary();
    fireEvent.click(screen.getByRole('switch'));

    fireEvent.click(screen.getByTestId('sender-wizard-save-exit'));

    expect(propertySenderApi.switch).not.toHaveBeenCalled();
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalled(), WAIT);
    const [, body] = vi.mocked(wizardDraftApi.save).mock.calls.at(-1)!;
    const stored = (body.data as { values: Record<string, unknown> }).values;
    expect(Object.keys(stored)).not.toContain('autoSendGuests');
    expect(stored.sender).toBe('ChannelManager');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers } from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import { wireTransport, type WireReply, type WireRequest } from '@/pages/__tests__/wire-transport';
import type { BillingSetup, ChannelCommissionRuleSet, PortalAccountHolder } from '@/types';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { item, previewOf, section, setupOf, swissSetup } from './billing-fixtures';

// These tests use the REAL client of the app (its interceptors, its API modules, its hooks): only the transport is replaced, by a server that follows the rule of the waiver of the recharge
// of the backend (FIX/BE-V2-NO-RECHARGE). What they prove is what the wizard sends: the first write of a save never carries the acknowledgement of the waiver, the 422 `recharge_waiver_not_acknowledged`
// opens the confirmation, a no saves nothing, and only a yes sends the write again, once, with the acknowledgement.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Casa Lugano SA' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
const env = vi.hoisted(() => ({
  contexts: [{ contextKey: 'account', roleKey: 'org_owner' }],
  properties: [
    { id: 'p1', name: 'Casa 1', city: 'Milano' },
    { id: 'p2', name: 'Casa 2', city: 'Roma' },
  ],
  flags: undefined as Record<string, boolean> | undefined,
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: env.contexts, getDefaultRoute: (contextKey: string) => `/app/${contextKey}`, hasPermission: () => true }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => {
    env.flags ??= { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, agencyTier: true, ownerInvoicing: true };
    return { flags: env.flags, isLoading: false };
  },
}));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ data: env.properties, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

const SETTINGS = '/billing-setup/channels';
const HOLDERS = '/billing-setup/channel-account-holders';
const RULES_PATH = '/owner-accounting/channel-commission-rules';
const ISSUER = '/billing-setup/issuer';

const RULES: ChannelCommissionRuleSet = {
  rules: [],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', isDefault: true },
  ],
};

interface HolderRow {
  propertyId: string;
  channel: string;
  holder: PortalAccountHolder;
}

const server: { holder: PortalAccountHolder; recharge: boolean; overrides: HolderRow[] } = { holder: 'Owner', recharge: true, overrides: [] };
let requests: WireRequest[];
let failure: WireReply | null;

const agencyHoldsAnAccount = (holder: PortalAccountHolder, overrides: readonly HolderRow[]) => holder === 'Agency' || overrides.some((row) => row.holder === 'Agency');
const waiverIn = (recharge: boolean, holder: PortalAccountHolder, overrides: readonly HolderRow[]) => !recharge && agencyHoldsAnAccount(holder, overrides);

const NOT_ACKNOWLEDGED: WireReply = {
  status: 422,
  data: { status: 422, code: 'recharge_waiver_not_acknowledged', detail: 'Senza riaddebito le commissioni dei portali restano a carico dell’agenzia: conferma la rinuncia per salvare.' },
};

function agencySetup(): BillingSetup {
  return setupOf(
    swissSetup().sections.map((entry) => {
      if (entry.section === 'channels') {
        return section('channels', { portalAccountHolder: server.holder, rechargePortalCommissions: server.recharge }, [item('channel_commissions_unconfirmed', 'channels', 'unconfirmed')]);
      }
      if (entry.section === 'mandates') return section('mandates', {}, [item('owners_without_mandate', 'mandates', 'required', 3)]);
      return entry;
    }),
  );
}

function answer(request: WireRequest): WireReply {
  requests.push(request);
  const [path, query] = request.path.split('?');
  const method = request.method;

  if (method === 'GET' && path === '/billing-setup') return { status: 200, data: agencySetup() };
  if (method === 'PUT' && path === ISSUER) return { status: 200, data: section('issuer', {}) };
  if (method === 'GET' && path === '/fiscal/documents/issuer-preview') return { status: 200, data: previewOf(undefined) };
  if (path === RULES_PATH) return { status: 200, data: RULES };
  if (method === 'GET' && path === HOLDERS) {
    return { status: 200, data: server.overrides.map((row) => ({ ...row, propertyName: row.propertyId === 'p1' ? 'Casa 1' : 'Casa 2', updatedAt: '2026-11-20T09:00:00Z' })) };
  }

  if (method === 'PUT' && path === SETTINGS) {
    if (failure) return failure;
    const body = request.body as { portalAccountHolder?: PortalAccountHolder; rechargePortalCommissions?: boolean; acknowledgeRechargeWaiver?: boolean };
    const holder = body.portalAccountHolder ?? server.holder;
    const recharge = body.rechargePortalCommissions ?? server.recharge;
    const starts = waiverIn(recharge, holder, server.overrides) && !waiverIn(server.recharge, server.holder, server.overrides);
    if (starts && body.acknowledgeRechargeWaiver !== true) return NOT_ACKNOWLEDGED;
    server.holder = holder;
    server.recharge = recharge;
    return { status: 200, data: section('channels', { portalAccountHolder: server.holder, rechargePortalCommissions: server.recharge }) };
  }

  if (method === 'PUT' && path === HOLDERS) {
    const rows = request.body as Array<{ propertyId: string; channel: string; holder: PortalAccountHolder | null }>;
    const next = [
      ...server.overrides.filter((current) => !rows.some((row) => row.propertyId === current.propertyId && row.channel === current.channel)),
      ...rows.flatMap((row): HolderRow[] => (row.holder === null ? [] : [{ propertyId: row.propertyId, channel: row.channel, holder: row.holder }])),
    ];
    const starts = waiverIn(server.recharge, server.holder, next) && !waiverIn(server.recharge, server.holder, server.overrides);
    if (starts && query !== 'acknowledgeRechargeWaiver=true') return NOT_ACKNOWLEDGED;
    server.overrides = next;
    return { status: 200, data: next.map((row) => ({ ...row, propertyName: 'Casa 1', updatedAt: '2026-11-20T09:00:00Z' })) };
  }

  return { status: 404, data: { code: 'not_found' } };
}

const transport = wireTransport(answer);
const realAdapter = axiosInstance.defaults.adapter;

const writes = (path: string) => requests.filter((request) => request.method === 'PUT' && request.path.split('?')[0] === path);
const carriesTheAcknowledgement = (request: WireRequest) =>
  request.path.includes('acknowledgeRechargeWaiver') || (typeof request.body === 'object' && request.body !== null && 'acknowledgeRechargeWaiver' in request.body);

function renderWizard(step: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=${step}`] },
        createElement(Routes, null, createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) })),
      ),
    ),
  );
}

const wizard = () => screen.getByTestId('fiscal-billing-wizard');

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

async function next() {
  await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('fiscal-billing-next'));
}

async function onTheChannelsStep() {
  await onStep('channels');
  await screen.findByTestId('billing-holders-table', undefined, WAIT);
  await screen.findByTestId('billing-commissions', undefined, WAIT);
}

async function theDialog() {
  return screen.findByRole('dialog', undefined, WAIT);
}

async function answerTheDialog(dialog: HTMLElement, button: string) {
  const target = within(dialog).getByRole('button', { name: button });
  await waitFor(() => expect(target).toBeEnabled(), WAIT);
  fireEvent.click(target);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  failure = null;
  server.holder = 'Owner';
  server.recharge = true;
  server.overrides = [];
  axiosInstance.defaults.adapter = transport;
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  await i18n.changeLanguage('it');
  vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() });
});

afterEach(() => {
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
});

describe('turning the recharge off asks for the explicit confirmation of the waiver (permission rule, through the real client)', () => {
  it('BillingWizard_TurningTheRechargeOff_TheFirstWriteNeverCarriesTheAcknowledgement_The422OpensTheDialog_ANoSavesNothing_AYesSendsItOnceWithIt', async () => {
    server.holder = 'Agency';
    server.recharge = true;
    renderWizard('channels');
    await onTheChannelsStep();

    fireEvent.click(screen.getByTestId('billing-recharge'));
    expect(screen.getByTestId('billing-recharge')).not.toBeChecked();
    await next();

    const dialog = await theDialog();
    expect(dialog).toHaveTextContent(i18n.t('billingWizard.channels.waiver.title'));
    expect(dialog).toHaveTextContent(i18n.t('billingWizard.channels.waiver.description'));
    expect(dialog).toHaveTextContent(i18n.t('billingWizard.channels.waiver.mandate'));
    expect(dialog).toHaveTextContent(i18n.t('billingWizard.channels.waiver.notRetroactive'));
    expect(dialog).toHaveTextContent(i18n.t('billingWizard.channels.waiver.recorded'));
    expect(writes(SETTINGS)).toHaveLength(1);
    expect(writes(SETTINGS)[0].body).toEqual({ portalAccountHolder: 'Agency', rechargePortalCommissions: false });
    expect(carriesTheAcknowledgement(writes(SETTINGS)[0])).toBe(false);
    expect(server.recharge).toBe(true);

    await answerTheDialog(dialog, i18n.t('shared.cancel'));
    expect(await screen.findByTestId('fiscal-billing-finish-error', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.rechargeWaiverNotAcknowledged'));
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(writes(SETTINGS)).toHaveLength(1);
    expect(server.recharge).toBe(true);
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);

    await next();
    const again = await theDialog();
    await answerTheDialog(again, i18n.t('billingWizard.channels.waiver.confirm'));
    await onStep('mandate');

    expect(writes(SETTINGS).map(carriesTheAcknowledgement)).toEqual([false, false, true]);
    expect(writes(SETTINGS)[2].body).toEqual({ portalAccountHolder: 'Agency', rechargePortalCommissions: false, acknowledgeRechargeWaiver: true });
    expect(server.recharge).toBe(false);
    expect(requests.filter(carriesTheAcknowledgement)).toHaveLength(1);
  });

  it('BillingWizard_TheFirstListingOfTheAgencyWhileTheRechargeIsOff_IsTheSameQuestion_AndTheAcknowledgementIsTheQueryParameterOfTheBulkWrite', async () => {
    server.holder = 'Owner';
    server.recharge = false;
    renderWizard('channels');
    await onTheChannelsStep();

    fireEvent.change(screen.getByTestId('billing-holder-p1-Airbnb'), { target: { value: 'Agency' } });
    await next();

    const dialog = await theDialog();
    expect(writes(SETTINGS).map((request) => request.body)).toEqual([{ portalAccountHolder: 'Owner', rechargePortalCommissions: false }]);
    expect(writes(HOLDERS).map((request) => request.path)).toEqual([HOLDERS]);
    expect(server.overrides).toEqual([]);

    await answerTheDialog(dialog, i18n.t('billingWizard.channels.waiver.confirm'));
    await onStep('mandate');

    const rows = [{ propertyId: 'p1', channel: 'Airbnb', holder: 'Agency' }];
    expect(writes(HOLDERS).map((request) => request.path)).toEqual([HOLDERS, `${HOLDERS}?acknowledgeRechargeWaiver=true`]);
    expect(writes(HOLDERS).map((request) => request.body)).toEqual([rows, rows]);
    expect(server.overrides).toEqual(rows);
    expect(writes(SETTINGS).some(carriesTheAcknowledgement)).toBe(false);
  });

  it('BillingWizard_TheFirstListingOfTheAgency_ANo_WritesNoHolder_AndTheWizardStaysOnTheStepSayingItWasNotSaved', async () => {
    server.holder = 'Owner';
    server.recharge = false;
    renderWizard('channels');
    await onTheChannelsStep();
    fireEvent.change(screen.getByTestId('billing-holder-p1-Airbnb'), { target: { value: 'Agency' } });
    await next();

    await answerTheDialog(await theDialog(), i18n.t('shared.cancel'));

    expect(await screen.findByTestId('fiscal-billing-finish-error', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.rechargeWaiverNotAcknowledged'));
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(server.overrides).toEqual([]);
    expect(writes(HOLDERS)).toHaveLength(1);
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);
  });

  it('BillingWizard_AWriteThatStartsNoWaiver_IsNeverAskedAbout_AndNothingEverCarriesTheAcknowledgement', async () => {
    server.holder = 'Owner';
    server.recharge = true;
    renderWizard('channels');
    await onTheChannelsStep();
    fireEvent.change(screen.getByTestId('billing-holder-p1-Airbnb'), { target: { value: 'Agency' } });

    await next();
    await onStep('mandate');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writes(SETTINGS)).toHaveLength(1);
    expect(writes(HOLDERS)).toHaveLength(1);
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);
    expect(server.overrides).toEqual([{ propertyId: 'p1', channel: 'Airbnb', holder: 'Agency' }]);
  });

  it('BillingWizard_SaveAndExit_ANoToTheWaiver_SavesNothing_AndTellsItInAToast_AYesSavesWithTheAcknowledgement', async () => {
    server.holder = 'Agency';
    server.recharge = true;
    renderWizard('channels');
    await onTheChannelsStep();
    fireEvent.click(screen.getByTestId('billing-recharge'));

    await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('billing-save-exit'));
    await answerTheDialog(await theDialog(), i18n.t('shared.cancel'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.rechargeWaiverNotAcknowledged')), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(server.recharge).toBe(true);
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(screen.getByTestId('billing-recharge')).not.toBeChecked();
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);

    await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('billing-save-exit'));
    await answerTheDialog(await theDialog(), i18n.t('billingWizard.channels.waiver.confirm'));

    await waitFor(() => expect(server.recharge).toBe(false), WAIT);
    expect(writes(SETTINGS).map(carriesTheAcknowledgement)).toEqual([false, false, true]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe('a refusal that is not the question of the waiver never opens it (permission rule, through the real client)', () => {
  const OTHER_FAILURES: ReadonlyArray<{ name: string; reply: WireReply; stepMessage: string; exitMessage: string }> = [
    {
      name: 'AnotherUnprocessableEntity',
      reply: { status: 422, data: { status: 422, code: 'billing_channels_invalid', detail: 'I dati sugli account dei portali non sono validi.' } },
      stepMessage: 'apiErrors.codes.billingChannelsInvalid',
      exitMessage: 'apiErrors.codes.billingChannelsInvalid',
    },
    { name: 'AServerError', reply: { status: 500, data: {} }, stepMessage: 'billingWizard.saveFailed', exitMessage: 'billingWizard.exit.failed' },
  ];

  it.each(OTHER_FAILURES)('BillingWizard_TheFirstWriteFailsWithAnotherError_NoDialog_OneWrite_NoAcknowledgement_AndTheFailureIsSaid_OnContinueAndOnSaveAndExit_$name', async ({ reply, stepMessage, exitMessage }) => {
    server.holder = 'Agency';
    server.recharge = true;
    failure = reply;
    renderWizard('channels');
    await onTheChannelsStep();

    fireEvent.click(screen.getByTestId('billing-recharge'));
    await next();

    await waitFor(() => expect(screen.queryByTestId('fiscal-billing-finish-error') ?? screen.queryByRole('dialog')).not.toBeNull(), WAIT);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('fiscal-billing-finish-error')).toHaveTextContent(i18n.t(stepMessage));
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(writes(SETTINGS)).toHaveLength(1);
    expect(carriesTheAcknowledgement(writes(SETTINGS)[0])).toBe(false);
    expect(server.recharge).toBe(true);

    await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('billing-save-exit'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t(exitMessage)), WAIT);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(writes(SETTINGS)).toHaveLength(2);
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);
    expect(server.recharge).toBe(true);
  });
});

describe('the texts of this change (the same idea in two languages, never the same words, and no supplier named)', () => {
  const KEYS = [
    'billingWizard.channels.waiver.title',
    'billingWizard.channels.waiver.description',
    'billingWizard.channels.waiver.mandate',
    'billingWizard.channels.waiver.notRetroactive',
    'billingWizard.channels.waiver.recorded',
    'billingWizard.channels.waiver.confirm',
    'apiErrors.codes.rechargeWaiverNotAcknowledged',
    'account.activity.rechargeWaiver',
    'ownerAccounting.line.informational',
    'ownerAccounting.line.type.ChannelFeeBorneByAgency',
    'ownerAccounting.line.formula.ChannelFeeBorneByAgency',
    'ownerAccounting.line.steps.informationalOriginal',
    'ownerAccounting.line.steps.informationalResult',
    'ownerAccounting.summary.informational.label',
    'ownerAccounting.summary.informational.note_one',
    'ownerAccounting.summary.informational.note_other',
    'ownerPortal.accounting.line.borneByAgency',
    'ownerPortal.accounting.line.chargedOnAgencyAccount',
    'ownerPortal.accounting.line.informational',
  ];

  it.each(KEYS)('%s_ExistsInBothLanguagesWithDifferentWords_AndNamesNoSupplier', (key) => {
    const it_ = i18n.getResource('it', 'translation', key) as string | undefined;
    const en = i18n.getResource('en', 'translation', key) as string | undefined;

    expect(typeof it_).toBe('string');
    expect(typeof en).toBe('string');
    expect(it_).not.toBe(en);
    expect(`${it_} ${en}`).not.toMatch(/airbnb|booking\.com|expedia|vrbo|octorate|concordato/i);
  });
});

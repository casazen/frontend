import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import { wireTransport, type WireReply, type WireRequest } from '@/pages/__tests__/wire-transport';
import type { BillingSetup, BillingSetupSection, ChannelCommissionRuleSet, PortalAccountHolder } from '@/types';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { italianSetup, item, previewOf, section, setupOf } from './billing-fixtures';

// The two requests of the wizard that ask a person something live in ONE page: the portals that collect the tourist tax of an Italian issuer (an answer of its own, saved at once) and the
// waiver of the recharge of the portal commissions (the write of the step «Commissioni dei canali» that the server refuses until the person confirms). These tests use the REAL client of the
// app and the real wizard page, with an agency that is Italian: only the transport is replaced. What they prove is that the two compose: a request of one never starts, answers or carries
// anything of the other (the acknowledgement of the waiver goes out once, after the yes of the dialog and nowhere else); while a request is on its way nothing of the wizard takes a second
// press, the way between the steps included; and a refusal of the reach turns the whole wizard read-only, whichever request met it.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Agenzia Milano' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
// What the hooks of the app answer is the same object at every render, as the real ones are: the administrator of an organization on the agency plan, the flags of the agency and of the
// invoicing to the owners on, and the two listings of the agency (with the ISTAT codes of their comuni).
const env = vi.hoisted(() => ({
  contexts: [{ contextKey: 'account', roleKey: 'org_owner' }],
  properties: [
    { id: 'p1', name: 'Casa Duomo', city: 'Milano', comuneIstatCode: '015146' },
    { id: 'p2', name: 'Casa Arno', city: 'Firenze', comuneIstatCode: '048017' },
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

vi.setConfig({ testTimeout: 60_000 });

const WAIT = { timeout: 10_000 };

const SETTINGS = '/billing-setup/channels';
const HOLDERS = '/billing-setup/channel-account-holders';
const RULES_PATH = '/owner-accounting/channel-commission-rules';
const ISSUER = '/billing-setup/issuer';
const PORTAL_COMUNI = '/billing-setup/touristTax/portal-comuni';

const RULES: ChannelCommissionRuleSet = {
  rules: [],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', isDefault: true },
  ],
};

interface Pair {
  channel: string;
  comuneIstat: string;
}

const MILANO = { comuneIstat: '015146', comune: 'Milano', channel: 'Airbnb', status: 'to_confirm' };
const FIRENZE = { comuneIstat: '048017', comune: 'Firenze', channel: 'Airbnb', status: 'to_confirm' };
const PROPOSALS = [MILANO, FIRENZE];
const pair = (proposal: Pair): Pair => ({ channel: proposal.channel, comuneIstat: proposal.comuneIstat });

const server: { holder: PortalAccountHolder; recharge: boolean; confirmed: Pair[] } = { holder: 'Agency', recharge: true, confirmed: [] };
let requests: WireRequest[];
/** How the write that carries the acknowledgement is answered instead of saving it (a refusal); `null` saves it. */
let afterTheYes: WireReply | null;
let held: Promise<void> | null;
let release: (() => void) | null;

const onForbidden = vi.fn();

const NOT_ACKNOWLEDGED: WireReply = {
  status: 422,
  data: { status: 422, code: 'recharge_waiver_not_acknowledged', detail: 'Senza riaddebito le commissioni dei portali restano a carico dell’agenzia: conferma la rinuncia per salvare.' },
};

function touristTaxOf(): BillingSetupSection {
  return section(
    'touristTax',
    {
      defaultPlatformCollectedTouristTaxChannels: [],
      italianPortalProposals: PROPOSALS.filter((proposal) => !server.confirmed.some((known) => known.channel === proposal.channel && known.comuneIstat === proposal.comuneIstat)),
      confirmedPortalTouristTaxComuni: server.confirmed,
      portalTouristTaxConflict: false,
    },
    [],
    false,
  );
}

function agencySetup(): BillingSetup {
  return setupOf(
    italianSetup().sections.map((entry) => {
      if (entry.section === 'touristTax') return touristTaxOf();
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
  const { method, path } = request;

  if (method === 'GET' && path === '/billing-setup') return { status: 200, data: agencySetup() };
  if (method === 'PUT' && path === ISSUER) return { status: 200, data: section('issuer', {}) };
  if (method === 'GET' && path === '/tourist-tax-rates') return { status: 200, data: [] };
  if (method === 'GET' && path === '/fiscal/documents/issuer-preview') return { status: 200, data: previewOf(undefined) };
  if (path === RULES_PATH) return { status: 200, data: RULES };
  if (method === 'GET' && path === HOLDERS) return { status: 200, data: [] };

  if (method === 'PUT' && path === PORTAL_COMUNI) {
    server.confirmed = (request.body as { comuni: Pair[] }).comuni;
    return { status: 200, data: touristTaxOf() };
  }

  if (method === 'PUT' && path === SETTINGS) {
    const body = request.body as { portalAccountHolder?: PortalAccountHolder; rechargePortalCommissions?: boolean; acknowledgeRechargeWaiver?: boolean };
    const holder = body.portalAccountHolder ?? server.holder;
    const recharge = body.rechargePortalCommissions ?? server.recharge;
    const starts = holder === 'Agency' && !recharge && server.recharge;
    if (starts && body.acknowledgeRechargeWaiver !== true) return NOT_ACKNOWLEDGED;
    if (body.acknowledgeRechargeWaiver === true && afterTheYes) return afterTheYes;
    server.holder = holder;
    server.recharge = recharge;
    return { status: 200, data: section('channels', { portalAccountHolder: server.holder, rechargePortalCommissions: server.recharge }) };
  }

  return { status: 404, data: { code: 'not_found' } };
}

const transport = wireTransport(answer);
const realAdapter = axiosInstance.defaults.adapter;

const writes = (path: string) => requests.filter((request) => request.method === 'PUT' && request.path === path);
const carriesTheAcknowledgement = (request: WireRequest) => typeof request.body === 'object' && request.body !== null && 'acknowledgeRechargeWaiver' in request.body;

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

async function press(testId: string) {
  const button = await screen.findByTestId(testId, undefined, WAIT);
  await waitFor(() => expect(button).toBeEnabled(), WAIT);
  fireEvent.click(button);
}

async function onTheChannelsStep() {
  await onStep('channels');
  await screen.findByTestId('billing-holders-table', undefined, WAIT);
  await screen.findByTestId('billing-commissions', undefined, WAIT);
}

async function theDialog() {
  return screen.findByRole('dialog', undefined, WAIT);
}

async function sayYes(dialog: HTMLElement) {
  const target = within(dialog).getByRole('button', { name: i18n.t('billingWizard.channels.waiver.confirm') });
  await waitFor(() => expect(target).toBeEnabled(), WAIT);
  fireEvent.click(target);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  afterTheYes = null;
  held = null;
  release = null;
  server.holder = 'Agency';
  server.recharge = true;
  server.confirmed = [];
  axiosInstance.defaults.adapter = (config) =>
    held && config.method === 'put' && config.url === SETTINGS && typeof config.data === 'string' && config.data.includes('acknowledgeRechargeWaiver') ? held.then(() => transport(config)) : transport(config);
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  await i18n.changeLanguage('it');
  vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() });
});

afterEach(() => {
  release?.();
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
});

describe('the portals of the tourist tax and the waiver of the recharge in one wizard (permission and data rules, through the real client)', () => {
  it('BillingWizard_AConfirmationOfAPortalNeverCarriesNorOpensTheWaiver_TheYesSendsTheAcknowledgementOnce_AndWhileItIsOnItsWayTheWayBetweenTheStepsIsShut', async () => {
    held = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderWizard('tourist-tax');
    await onStep('tourist-tax');

    await press('billing-portal-confirm-Airbnb-015146');
    expect(await screen.findByTestId('billing-portal-done', undefined, WAIT)).toHaveTextContent('Confermato per Milano.');
    expect(writes(PORTAL_COMUNI)).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);

    await press('fiscal-billing-next');
    await onTheChannelsStep();
    fireEvent.click(screen.getByTestId('billing-recharge'));
    await press('fiscal-billing-next');
    const dialog = await theDialog();
    expect(writes(SETTINGS)).toHaveLength(1);
    expect(carriesTheAcknowledgement(writes(SETTINGS)[0])).toBe(false);
    expect(server.recharge).toBe(true);
    expect(requests.some(carriesTheAcknowledgement)).toBe(false);

    await sayYes(dialog);
    await waitFor(() => expect(screen.getByTestId('fiscal-billing-back')).toBeDisabled(), WAIT);
    expect(screen.getByTestId('fiscal-billing-next')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('billing-save-exit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('fiscal-billing-back'));
    fireEvent.click(screen.getByTestId('fiscal-billing-next'));
    fireEvent.click(screen.getByTestId('billing-save-exit'));
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(server.recharge).toBe(true);

    release?.();
    await onStep('mandate');
    expect(server.recharge).toBe(false);
    expect(writes(SETTINGS).map(carriesTheAcknowledgement)).toEqual([false, true]);
    expect(requests.filter(carriesTheAcknowledgement)).toHaveLength(1);
    expect(writes(PORTAL_COMUNI)).toHaveLength(1);
  });

  it('BillingWizard_A403OfTheWholeOrganizationAfterTheYes_TurnsTheWizardReadOnly_AndTheQuestionsOfThePortalsAreNotOfferedAnyMore', async () => {
    server.confirmed = [pair(FIRENZE)];
    afterTheYes = { status: 403, data: { code: 'fiscal_settings_need_whole_org' } };
    renderWizard('tourist-tax');
    await onStep('tourist-tax');
    expect(await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT)).toHaveLength(1);

    await press('fiscal-billing-next');
    await onTheChannelsStep();
    fireEvent.click(screen.getByTestId('billing-recharge'));
    await press('fiscal-billing-next');
    await sayYes(await theDialog());

    expect(await screen.findByTestId('billing-read-only', undefined, WAIT)).toHaveTextContent(i18n.t('billingWizard.readOnly.partialScope'));
    expect(wizard()).toHaveAttribute('data-step', 'channels');
    expect(server.recharge).toBe(true);
    expect(onForbidden).not.toHaveBeenCalled();
    expect(writes(SETTINGS).map(carriesTheAcknowledgement)).toEqual([false, true]);

    await press('fiscal-billing-back');
    await onStep('tourist-tax');
    expect(await screen.findByTestId('billing-portal-confirmed-item', undefined, WAIT)).toHaveAttribute('data-comune', '048017');
    expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();
    expect(screen.getByTestId('billing-portal-remove-Airbnb-048017')).toBeDisabled();
    expect(writes(PORTAL_COMUNI)).toHaveLength(0);
  });
});

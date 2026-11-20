import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAccountInactiveHandler, setApiAuthHandlers, setApiForbiddenHandler, setApiOnboardingRequiredHandler } from '@/lib/axios';
import { wireTransport, type WireReply, type WireRequest } from '@/pages/__tests__/wire-transport';
import type { BillingSetup, BillingSetupSection } from '@/types';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { italianSetup, previewOf, section, setupOf } from './billing-fixtures';

// These tests use the real client of the app (its interceptors, its handlers of the 403) and the real billing setup API, with the real wizard page: only the transport is replaced, by a server
// that keeps the confirmations it is given, as the real one does. What they prove is what the step «Tassa di soggiorno» of an Italian issuer does with the proposals of the server for the
// portals that collect the tourist tax (FIX/BE-IT-TOURISTTAX-DEFAULTS, S058): a question per comune that nobody has answered, a confirmation that sends the WHOLE list, a refusal and a
// failure each told in their own words, and nothing at all for a server that does not send the members.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Casa Milano' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 60_000 });

const WAIT = { timeout: 10_000 };
const PORTAL_COMUNI = '/billing-setup/touristTax/portal-comuni';
const PROBE = 'PUT /billing-setup/issuer';

interface Pair {
  channel: string;
  comuneIstat: string;
}

/** The proposals the server makes for an organization with a flat in Milano and one in Firenze: Airbnb collects it, to be confirmed. */
const MILANO = { comuneIstat: '015146', comune: 'Milano', channel: 'Airbnb', status: 'to_confirm' };
const FIRENZE = { comuneIstat: '048017', comune: 'Firenze', channel: 'Airbnb', status: 'to_confirm' };
const PROPOSALS = [MILANO, FIRENZE];
const pair = (proposal: Pair): Pair => ({ channel: proposal.channel, comuneIstat: proposal.comuneIstat });
/** A comune that is confirmed and has no property and no proposal: nothing names it. */
const ROMA: Pair = { channel: 'Airbnb', comuneIstat: '058091' };

const PROPERTIES = [
  { id: 'p1', name: 'Casa Duomo', city: 'Milano', comuneIstatCode: '015146' },
  { id: 'p2', name: 'Casa Arno', city: 'Firenze', comuneIstatCode: '048017' },
];

/** The server: what it has confirmed, whether it sends the members at all (an older one does not), the reach of the caller and how it answers the confirmation. */
interface Server {
  confirmed: Pair[];
  conflict: boolean;
  members: boolean;
  reach: 'whole' | 'some';
  /** How the next confirmations are answered instead of saving them (a refusal, a failure, a body that is no section); `undefined` saves them. */
  reply?: (body: unknown) => WireReply;
  /** How the next reads of the setup are answered instead of telling what the server holds (a failure, a body that is no setup, a section that cannot be read); `undefined` tells it. */
  setup?: () => WireReply;
}

let server: Server;
let requests: string[];
let confirmations: unknown[];
let release: (() => void) | null;
let held: Promise<void> | null;

const onForbidden = vi.fn();
const onAccountInactive = vi.fn();
const onOnboardingRequired = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The section `touristTax` as the server writes it for an Italian issuer: the three members for a caller who reaches the whole organization, none for anyone else (or for an older server). */
function touristTaxOf(state: Server): BillingSetupSection {
  const sendsMembers = state.members && state.reach === 'whole';
  const values = sendsMembers
    ? {
        defaultPlatformCollectedTouristTaxChannels: [],
        italianPortalProposals: PROPOSALS.filter((proposal) => !state.confirmed.some((known) => known.channel === proposal.channel && known.comuneIstat === proposal.comuneIstat)),
        confirmedPortalTouristTaxComuni: state.confirmed,
        portalTouristTaxConflict: state.conflict,
      }
    : {};
  return section('touristTax', values, [], false);
}

function setupOfServer(state: Server): BillingSetup {
  return setupOf(italianSetup().sections.map((entry) => (entry.section === 'touristTax' ? touristTaxOf(state) : entry)));
}

/** The setup of an Italian issuer whose section `touristTax` carries exactly the given values (what a reading that is not the usual one says). */
function setupWith(values: Record<string, unknown>): BillingSetup {
  return setupOf(italianSetup().sections.map((entry) => (entry.section === 'touristTax' ? section('touristTax', values, [], false) : entry)));
}

/** The answers of the server: the setup, the probe of the reach, the lists the Italian step reads and the confirmation. */
function answer({ method, path, body }: WireRequest): WireReply {
  if (method === 'GET' && path === '/billing-setup') return server.setup ? server.setup() : { status: 200, data: setupOfServer(server) };
  if (method === 'PUT' && path === '/billing-setup/issuer') {
    return server.reach === 'some' ? { status: 403, data: { code: 'fiscal_settings_need_whole_org' } } : { status: 200, data: section('issuer', {}) };
  }
  if (method === 'GET' && path === '/properties') return { status: 200, data: PROPERTIES };
  if (method === 'GET' && path === '/tourist-tax-rates') return { status: 200, data: [] };
  if (method === 'GET' && path === '/fiscal/documents/issuer-preview') return { status: 200, data: previewOf(undefined) };
  if (method === 'PUT' && path === PORTAL_COMUNI) {
    confirmations.push(body);
    if (server.reply) return server.reply(body);
    server.confirmed = (body as { comuni: Pair[] }).comuni;
    return { status: 200, data: touristTaxOf(server) };
  }
  return { status: 404, data: { code: 'not_found' } };
}

const transport = wireTransport(answer, (line) => requests.push(line));

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=tourist-tax`] },
        createElement(Routes, null, createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) })),
      ),
    ),
  );
}

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const wizard = () => screen.getByTestId('fiscal-billing-wizard');

async function onTheStep() {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', 'tourist-tax'), WAIT);
}

/** The writes the person caused: every PUT but the probe of the reach that the wizard makes by itself when it opens. */
const writes = () => requests.filter((line) => line.startsWith('PUT ') && line !== PROBE);

/** Clicks a button once it is there and enabled: a click on a button that is still switched off does nothing, and the test would then wait for an answer that never comes. */
async function press(testId: string) {
  const button = await screen.findByTestId(testId, undefined, WAIT);
  await waitFor(() => expect(button).toBeEnabled(), WAIT);
  fireEvent.click(button);
}

const PAIRS = (...pairs: Pair[]) => ({ comuni: pairs });

beforeEach(async () => {
  vi.clearAllMocks();
  server = { confirmed: [], conflict: false, members: true, reach: 'whole' };
  requests = [];
  confirmations = [];
  held = null;
  release = null;
  // A confirmation can be held in flight: the test releases it when it has looked at the page that waits for it.
  axiosInstance.defaults.adapter = (config) => (held && config.method === 'put' && config.url === PORTAL_COMUNI ? held.then(() => transport(config)) : transport(config));
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  setApiAccountInactiveHandler(onAccountInactive);
  setApiOnboardingRequiredHandler(onOnboardingRequired);
  workspace.contexts = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];
  workspace.hasPermission = () => true;
  await i18n.changeLanguage('it');
});

afterEach(() => {
  release?.();
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
  setApiAccountInactiveHandler(null);
  setApiOnboardingRequiredHandler(null);
});

describe('the proposals for the portals that collect the tourist tax are questions, never answers (data rule: nothing is confirmed unless a person says so)', () => {
  it('ItalianStep_ProposalsOfTheServer_AreOneQuestionPerComuneNothingIsConfirmedByDefault_AndNotNowSendsNothing', async () => {
    renderWizard();
    await onTheStep();

    const cards = await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT);
    expect(cards.map((card) => card.getAttribute('data-comune'))).toEqual(['015146', '048017']);
    // The question in plain words, where to check it, what the answer changes, and the two answers.
    expect(cards[0]).toHaveTextContent('Airbnb incassa e versa l’imposta di soggiorno a Milano?');
    expect(cards[0]).toHaveTextContent('Controllalo nel tuo annuncio su Airbnb, sezione Tasse, voce «Tasse locali riscosse e versate da Airbnb».');
    expect(cards[0]).toHaveTextContent('il documento per l’ospite dice che l’imposta è stata incassata dal portale');
    expect(cards[0]).toHaveTextContent('«da pagare in struttura»');
    expect(within(cards[0]).getByTestId('billing-portal-confirm-Airbnb-015146')).toHaveTextContent('Sì, confermo per Milano');
    expect(within(cards[0]).getByTestId('billing-portal-not-now-Airbnb-015146')).toHaveTextContent('Non ora');
    expect(cards[1]).toHaveTextContent('Airbnb incassa e versa l’imposta di soggiorno a Firenze?');
    // The step does not say «here you set nothing» while it asks something.
    expect(within(screen.getByTestId('billing-step-tourist-tax')).getByText(text('billingWizard.touristTax.italy.introPortals'))).toBeInTheDocument();
    // Never preselected: nothing is confirmed, nothing is said as done, nothing was sent.
    expect(screen.queryByTestId('billing-portal-confirmed')).toBeNull();
    expect(screen.queryByTestId('billing-portal-confirmed-item')).toBeNull();
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(confirmations).toEqual([]);

    // «Non ora»: the question for Milano gives way to a quiet line, the other one stays, and still nothing is sent.
    await press('billing-portal-not-now-Airbnb-015146');
    expect(await screen.findByTestId('billing-portal-deferred')).toHaveAttribute('data-comune', '015146');
    expect(screen.getAllByTestId('billing-portal-proposal').map((card) => card.getAttribute('data-comune'))).toEqual(['048017']);
    expect(screen.queryByTestId('billing-portal-confirmed')).toBeNull();
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(confirmations).toEqual([]);
    expect(writes()).toEqual([]);

    // It can be answered after all: the question comes back, and it is still unanswered.
    await press('billing-portal-answer-Airbnb-015146');
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-proposal')).toHaveLength(2), WAIT);
    expect(screen.queryByTestId('billing-portal-deferred')).toBeNull();
    expect(writes()).toEqual([]);
  });

  it('ItalianStep_AServerThatSendsNoMembers_ShowsExactlyWhatTheStepShowedBefore_AndSendsNothing', async () => {
    // An older server: the section of the tourist tax of an Italian issuer is empty, as it always was.
    server.members = false;
    renderWizard();
    await onTheStep();

    const step = await screen.findByTestId('billing-step-tourist-tax', undefined, WAIT);
    await screen.findByTestId('billing-tourist-tax-italy-todo', undefined, WAIT);
    // The same blocks in the same order, the old words of the intro, and nothing of the portals.
    expect(Array.from(step.children).map((child) => `${child.tagName.toLowerCase()}${child.getAttribute('data-testid') ? `#${child.getAttribute('data-testid')}` : ''}`)).toEqual([
      'p',
      'ul#billing-tourist-tax-italy',
      'div#billing-tourist-tax-italy-todo',
    ]);
    expect(step.querySelector('p')).toHaveTextContent('le tiene CasaZen e qui non devi impostare niente.');
    expect(screen.queryByTestId('billing-portal-tax')).toBeNull();
    expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();
    expect(screen.queryByTestId('billing-portal-failure')).toBeNull();
    expect(writes()).toEqual([]);
  });

  it('ItalianStep_ACallerWhoReachesOnlySomeOfThePropertiesReadsNoMember_SoNothingIsShownAndNeverAnError', async () => {
    // «Solo alcuni»: the server answers the setup without the three members (they sum up all the properties), and refuses the probe of the reach.
    server.reach = 'some';
    server.confirmed = [pair(MILANO)];
    renderWizard();
    await onTheStep();

    await screen.findByTestId('billing-read-only', undefined, WAIT);
    await screen.findByTestId('billing-tourist-tax-italy-todo', undefined, WAIT);
    expect(screen.queryByTestId('billing-portal-tax')).toBeNull();
    expect(screen.queryByTestId('billing-portal-failure')).toBeNull();
    expect(screen.queryByText(text('billingWizard.touristTax.italy.portals.title'))).toBeNull();
    // No error screen and no no-access page: the person reads the step as it is, in read-only.
    expect(screen.queryByTestId('fiscal-billing-error')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(confirmations).toEqual([]);
  });
});

describe('the confirmation sends the WHOLE list of the pairs, and a removal the list without that pair (data rule: the server replaces what it had)', () => {
  it('ItalianStep_AConfirmation_SendsTheWholeListWithThePairsAlreadyConfirmed_AndTheAnswerIsOnScreen', async () => {
    // Milano and Rome are already confirmed; Firenze is the question that is left.
    server.confirmed = [pair(MILANO), ROMA];
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT)).toHaveLength(1);

    await press('billing-portal-confirm-Airbnb-048017');

    // The body is the pairs already confirmed, in their order, and the new one: nothing taken away.
    await waitFor(() => expect(confirmations).toHaveLength(1), WAIT);
    expect(confirmations[0]).toEqual(PAIRS(pair(MILANO), ROMA, pair(FIRENZE)));
    // The answer of the server is on screen: the question left, the three pairs are listed, each with its comune (the properties name Milano, the proposal named Firenze, and Rome, which nothing names, is its code).
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(3), WAIT);
    expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();
    expect(screen.getAllByTestId('billing-portal-confirmed-item').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Airbnb incassa e versa l’imposta di soggiorno a Milano'),
      expect.stringContaining('Airbnb incassa e versa l’imposta di soggiorno a 058091'),
      expect.stringContaining('Airbnb incassa e versa l’imposta di soggiorno a Firenze'),
    ]);
    expect(screen.getByTestId('billing-portal-done')).toHaveTextContent('Confermato per Firenze.');
    expect(screen.queryByTestId('billing-portal-failure')).toBeNull();
    // The whole answer is one request, and the intro stops saying that something is asked.
    expect(writes()).toEqual([`PUT ${PORTAL_COMUNI}`]);
    expect(within(screen.getByTestId('billing-step-tourist-tax')).getByText(text('billingWizard.touristTax.italy.intro'))).toBeInTheDocument();
  });

  it('ItalianStep_ARemoval_SendsTheListWithoutThatPair_AndTheLastOneSendsAnEmptyList', async () => {
    server.confirmed = [pair(MILANO), pair(FIRENZE)];
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-confirmed-item', undefined, WAIT)).toHaveLength(2);
    expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();

    // Milano goes: the body is the list without it, never an empty one.
    await press('billing-portal-remove-Airbnb-015146');
    await waitFor(() => expect(confirmations).toHaveLength(1), WAIT);
    expect(confirmations[0]).toEqual(PAIRS(pair(FIRENZE)));
    // The proposal for Milano is a question again (nobody confirms it any more), and Firenze is still confirmed.
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-proposal').map((card) => card.getAttribute('data-comune'))).toEqual(['015146']), WAIT);
    expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(1);
    expect(screen.getByTestId('billing-portal-done')).toHaveTextContent('Conferma tolta per Milano.');

    // The last confirmation goes: an empty list, which takes every confirmation away and never means «every comune».
    await press('billing-portal-remove-Airbnb-048017');
    await waitFor(() => expect(confirmations).toHaveLength(2), WAIT);
    expect(confirmations[1]).toEqual(PAIRS());
    await waitFor(() => expect(screen.queryByTestId('billing-portal-confirmed')).toBeNull(), WAIT);
    expect(screen.getAllByTestId('billing-portal-proposal')).toHaveLength(2);
    expect(server.confirmed).toEqual([]);
  });

  it('ItalianStep_WhileAConfirmationIsOnItsWay_EveryButtonOfTheStepWaitsAndNothingIsSentTwice', async () => {
    held = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderWizard();
    await onTheStep();

    const confirmButton = await screen.findByTestId('billing-portal-confirm-Airbnb-015146', undefined, WAIT);
    await waitFor(() => expect(confirmButton).toBeEnabled(), WAIT);
    fireEvent.click(confirmButton);

    // The button that sent it says it works; every other button of the card, and the ways out of the step, are switched off.
    await waitFor(() => expect(confirmButton).toHaveAttribute('aria-busy', 'true'), WAIT);
    expect(screen.getByTestId('billing-portal-not-now-Airbnb-015146')).toBeDisabled();
    expect(screen.getByTestId('billing-portal-confirm-Airbnb-048017')).toBeDisabled();
    expect(screen.getByTestId('billing-portal-not-now-Airbnb-048017')).toBeDisabled();
    expect(screen.getByTestId('fiscal-billing-next')).toBeDisabled();
    expect(screen.getByTestId('fiscal-billing-back')).toBeDisabled();
    expect(screen.getByTestId('billing-save-exit')).toBeDisabled();
    // A second press on the button that is working, and on another one, sends nothing.
    fireEvent.click(confirmButton);
    fireEvent.click(screen.getByTestId('billing-portal-confirm-Airbnb-048017'));

    release?.();
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(1), WAIT);
    expect(confirmations).toEqual([PAIRS(pair(MILANO))]);
    await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
    expect(screen.getByTestId('fiscal-billing-back')).toBeEnabled();
    expect(screen.getByTestId('billing-save-exit')).toBeEnabled();
    expect(screen.getByTestId('billing-portal-confirm-Airbnb-048017')).toBeEnabled();
  });
});

describe('a refusal and a failure are each told in their own words, and nothing is claimed as saved (permission and data rules)', () => {
  // The 403 of the reach turns the wizard read-only, as any other save does; the other refusals leave the question where it was.
  it.each([
    {
      name: '403FiscalSettingsNeedWholeOrg',
      reply: { status: 403, data: { code: 'fiscal_settings_need_whole_org' } },
      failure: 'wholeOrg',
      stillAsked: false,
    },
    { name: '403OfTheRole', reply: { status: 403, data: '' }, failure: 'forbidden', stillAsked: true },
    {
      name: '422IssuerFieldInvalid',
      reply: { status: 422, data: { code: 'issuer_field_invalid', field: 'portalTouristTaxComuni', errors: [{ field: 'portalTouristTaxComuni', code: 'issuer_field_invalid' }] } },
      failure: 'invalid',
      stillAsked: true,
    },
    { name: '422IssuerProfileIncomplete', reply: { status: 422, data: { code: 'issuer_profile_incomplete' } }, failure: 'profile', stillAsked: true },
  ])('ItalianStep_ShowsItsOwnWords_NeverTheNoAccessPage_AndNothingIsConfirmed ($name)', async ({ reply, failure, stillAsked }) => {
    server.reply = () => reply;
    renderWizard();
    await onTheStep();

    await press('billing-portal-confirm-Airbnb-015146');

    const alert = await screen.findByTestId('billing-portal-failure', undefined, WAIT);
    expect(alert).toHaveAttribute('data-failure', failure);
    expect(alert).toHaveTextContent(text(`billingWizard.touristTax.italy.portals.failure.${failure}`));
    // A refusal on a write keeps the person on the page: not the no-access page, not the handler of the account, and not a failure of the whole step.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(onAccountInactive).not.toHaveBeenCalled();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-billing-error')).toBeNull();
    // Nothing is claimed: no «confirmed», no pair listed, and a refusal has no retry (asking again would be refused again).
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(screen.queryByTestId('billing-portal-confirmed')).toBeNull();
    expect(screen.queryByTestId('billing-portal-retry')).toBeNull();
    expect(confirmations).toHaveLength(1);
    if (stillAsked) {
      expect(screen.getAllByTestId('billing-portal-proposal')).toHaveLength(2);
      expect(screen.queryByTestId('billing-read-only')).toBeNull();
    } else {
      // The person reaches only some of the properties after all: the wizard says so and does not offer the questions any more.
      expect(await screen.findByTestId('billing-read-only')).toHaveTextContent(text('billingWizard.readOnly.partialScope'));
      expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();
    }
  });

  it('ItalianStep_EveryRefusalAndFailureHasItsOwnText_InBothLanguages_AndNoneClaimsNothingChangedForACallWhoseOutcomeIsNotKnown', async () => {
    for (const language of ['it', 'en']) {
      await i18n.changeLanguage(language);
      const failures = ['wholeOrg', 'forbidden', 'invalid', 'profile', 'notSent', 'failed'].map((kind) => text(`billingWizard.touristTax.italy.portals.failure.${kind}`));
      expect(new Set(failures).size).toBe(6);
      // A call that timed out, lost its answer or got an unreadable one may have been saved: it never says that nothing changed.
      expect(text('billingWizard.touristTax.italy.portals.failure.failed')).not.toMatch(/non è cambiato niente|nothing has changed/i);
    }
    // And the two languages do not say the same thing.
    await i18n.changeLanguage('it');
    const italian = text('billingWizard.touristTax.italy.portals.proposal.question', { portal: 'Airbnb', comune: 'Milano' });
    await i18n.changeLanguage('en');
    expect(text('billingWizard.touristTax.italy.portals.proposal.question', { portal: 'Airbnb', comune: 'Milano' })).not.toBe(italian);
  });

  it('ItalianStep_AFailedCall_IsToldWithRetry_AndTheRetrySendsTheSameConfirmationAgain', async () => {
    let failing = true;
    server.reply = (body) => {
      if (failing) return { status: 500, data: {} };
      server.confirmed = (body as { comuni: Pair[] }).comuni;
      return { status: 200, data: touristTaxOf(server) };
    };
    server.confirmed = [pair(MILANO)];
    renderWizard();
    await onTheStep();

    await press('billing-portal-confirm-Airbnb-048017');
    const alert = await screen.findByTestId('billing-portal-failure', undefined, WAIT);
    expect(alert).toHaveAttribute('data-failure', 'failed');
    expect(alert).toHaveTextContent(text('billingWizard.touristTax.italy.portals.failure.failed'));
    expect(within(alert).getByTestId('billing-portal-retry')).toHaveTextContent('Riprova');
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(1);

    // «Riprova» sends the very same whole list, and this time the server takes it.
    failing = false;
    await press('billing-portal-retry');
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(2), WAIT);
    expect(confirmations).toEqual([PAIRS(pair(MILANO), pair(FIRENZE)), PAIRS(pair(MILANO), pair(FIRENZE))]);
    expect(screen.queryByTestId('billing-portal-failure')).toBeNull();
    expect(screen.getByTestId('billing-portal-done')).toHaveTextContent('Confermato per Firenze.');
  });

  // A 200 whose body is not the section (the `index.html` of the SPA behind a wrong rewrite, or a section that does not carry the list as saved) is a failure, never a success.
  it.each([
    { name: 'APageOfHtml', body: '<!doctype html><html><body>index</body></html>' },
    { name: 'ASectionWithoutTheListAsSaved', body: section('touristTax', {}, [], false) },
    { name: 'TheSectionOfAnotherStep', body: section('issuer', { confirmedPortalTouristTaxComuni: [] }) },
  ])('ItalianStep_AnAnswerThatIsNotTheSection_IsAFailureAndNeverASuccess ($name)', async ({ body }) => {
    server.reply = () => ({ status: 200, data: body });
    renderWizard();
    await onTheStep();

    await press('billing-portal-confirm-Airbnb-015146');

    const alert = await screen.findByTestId('billing-portal-failure', undefined, WAIT);
    expect(alert).toHaveAttribute('data-failure', 'failed');
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(screen.queryByTestId('billing-portal-confirmed')).toBeNull();
    expect(screen.getAllByTestId('billing-portal-proposal')).toHaveLength(2);
    expect(onForbidden).not.toHaveBeenCalled();
  });
});

describe('the list that replaces the one of the server is made from a reading made just before it, never from what the page kept (data rule: another window, another person or a lost answer may have changed it)', () => {
  it('ItalianStep_AConfirmation_IsMadeFromTheServerAsItIsNow_NotFromWhatThePageKept', async () => {
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT)).toHaveLength(2);

    // Another window confirmed Rome and Milano after this page was read: the page still asks both questions and knows nothing of them.
    server.confirmed = [ROMA, pair(MILANO)];
    expect(screen.getAllByTestId('billing-portal-proposal')).toHaveLength(2);
    await press('billing-portal-confirm-Airbnb-048017');

    // The body holds what the server has now plus the new pair: nothing that another window confirmed is taken away.
    await waitFor(() => expect(confirmations).toHaveLength(1), WAIT);
    expect(confirmations[0]).toEqual(PAIRS(ROMA, pair(MILANO), pair(FIRENZE)));
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(3), WAIT);
    expect(server.confirmed).toEqual([ROMA, pair(MILANO), pair(FIRENZE)]);
  });

  it('ItalianStep_ARemoval_IsMadeFromTheServerAsItIsNow_NotFromWhatThePageKept', async () => {
    server.confirmed = [pair(MILANO), pair(FIRENZE)];
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-confirmed-item', undefined, WAIT)).toHaveLength(2);

    // Another window confirmed Rome after this page was read: the page lists two pairs and knows nothing of it.
    server.confirmed = [pair(MILANO), pair(FIRENZE), ROMA];
    expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(2);
    await press('billing-portal-remove-Airbnb-015146');

    await waitFor(() => expect(confirmations).toHaveLength(1), WAIT);
    expect(confirmations[0]).toEqual(PAIRS(pair(FIRENZE), ROMA));
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item')).toHaveLength(2), WAIT);
    expect(server.confirmed).toEqual([pair(FIRENZE), ROMA]);
  });

  // A call that timed out, lost its answer or got an unreadable one may have been saved: it is not told as «nothing changed», and the page reads the setup again, so it never offers a list that is old.
  it.each([
    { name: '504AfterTheServerSavedIt', outcome: { status: 504, data: '' } },
    { name: 'AnUnreadableAnswerAfterTheServerSavedIt', outcome: { status: 200, data: '<!doctype html><html><body>index</body></html>' } },
  ])('ItalianStep_ACallWhoseOutcomeIsNotKnown_IsReadAgain_AndTheListOnScreenIsNotOld ($name)', async ({ outcome }) => {
    server.reply = (body) => {
      server.confirmed = (body as { comuni: Pair[] }).comuni;
      return outcome;
    };
    renderWizard();
    await onTheStep();

    await press('billing-portal-confirm-Airbnb-048017');

    const alert = await screen.findByTestId('billing-portal-failure', undefined, WAIT);
    expect(alert).toHaveAttribute('data-failure', 'failed');
    expect(alert).toHaveTextContent(text('billingWizard.touristTax.italy.portals.failure.failed'));
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    // The page reads the setup again and shows what the server holds: Firenze is confirmed and no longer a question, so the person can check it.
    await waitFor(() => expect(screen.getAllByTestId('billing-portal-confirmed-item').map((item) => item.getAttribute('data-comune'))).toEqual(['048017']), WAIT);
    expect(screen.getAllByTestId('billing-portal-proposal').map((card) => card.getAttribute('data-comune'))).toEqual(['015146']);
    expect(confirmations).toHaveLength(1);
  });

  // The list is made from the reading, so a reading that fails or cannot be read in full sends NOTHING: a list made from less would take confirmations away. «Riprova» reads again.
  it.each([
    { name: 'TheReadingFails', setup: () => ({ status: 500, data: {} }) },
    { name: 'TheReadingIsNotTheSetup', setup: () => ({ status: 200, data: '<!doctype html><html><body>index</body></html>' }) },
    {
      name: 'TheConfirmedPortalsCannotBeReadInFull',
      setup: () => ({ status: 200, data: setupWith({ italianPortalProposals: PROPOSALS, confirmedPortalTouristTaxComuni: 'Airbnb', portalTouristTaxConflict: false }) }),
    },
  ])('ItalianStep_AReadingThatCannotBeUsed_SendsNothing_AndRetryReadsAgain ($name)', async ({ setup }) => {
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT)).toHaveLength(2);

    server.setup = setup;
    await press('billing-portal-confirm-Airbnb-015146');

    const alert = await screen.findByTestId('billing-portal-failure', undefined, WAIT);
    expect(alert).toHaveAttribute('data-failure', 'notSent');
    expect(alert).toHaveTextContent(text('billingWizard.touristTax.italy.portals.failure.notSent'));
    // Nothing was sent, nothing is claimed as saved, and the person can try again.
    expect(confirmations).toEqual([]);
    expect(writes()).toEqual([]);
    expect(screen.queryByTestId('billing-portal-done')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();

    // The server can be read again: «Riprova» reads it, makes the list from that reading and sends it.
    server.setup = undefined;
    await press('billing-portal-retry');
    await waitFor(() => expect(screen.getByTestId('billing-portal-done')).toHaveTextContent('Confermato per Milano.'), WAIT);
    expect(confirmations).toEqual([PAIRS(pair(MILANO))]);
    expect(screen.queryByTestId('billing-portal-failure')).toBeNull();
  });

  it('ItalianStep_AReadingWithoutTheMembers_SendsNothing_AndTheBlockGoesAwayAsForAServerThatSendsNone', async () => {
    renderWizard();
    await onTheStep();
    expect(await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT)).toHaveLength(2);

    // The person no longer reaches the whole organization (or the issuer is no longer Italian): the server leaves the members out, and there is no list to build on.
    server.setup = () => ({ status: 200, data: setupWith({}) });
    await press('billing-portal-confirm-Airbnb-015146');

    await waitFor(() => expect(screen.queryByTestId('billing-portal-tax')).toBeNull(), WAIT);
    expect(confirmations).toEqual([]);
    expect(writes()).toEqual([]);
    expect(screen.queryByTestId('fiscal-billing-error')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
  });
});

describe('the hint about the records of the stays, and who may answer', () => {
  it('ItalianStep_TheServerSaysTheRecordsContradictTheRule_ShowsOneCalmHintAboveTheQuestions_AndOtherwiseNothing', async () => {
    server.conflict = true;
    renderWizard();
    await onTheStep();

    const hint = await screen.findByTestId('billing-portal-tax-conflict', undefined, WAIT);
    expect(hint).toHaveTextContent('I dati dei soggiorni da portale contraddicono la regola dell’imposta di soggiorno: controlla qui sotto.');
    // Once, and calm: a plain line, not an alert and not a notice that is read out, and no «Da fare» of its own.
    expect(screen.getAllByText(text('billingWizard.touristTax.italy.portals.hint'))).toHaveLength(1);
    expect(hint.tagName).toBe('P');
    expect(hint.closest('[role="alert"], [role="status"]')).toBeNull();
    expect(within(screen.getByTestId('billing-portal-tax')).queryByText(text('billingWizard.touristTax.italy.toDoTitle'))).toBeNull();
    // It points below: the questions come after it.
    expect(hint.compareDocumentPosition(screen.getAllByTestId('billing-portal-proposal')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ItalianStep_TheServerSaysNothingContradicts_ShowsNoHint', async () => {
    renderWizard();
    await onTheStep();

    await screen.findAllByTestId('billing-portal-proposal', undefined, WAIT);
    expect(screen.queryByTestId('billing-portal-tax-conflict')).toBeNull();
  });

  it('ItalianStep_APersonWhoMayNotChangeTheSetup_ReadsWhatWasConfirmedAndIsOfferedNothing', async () => {
    // The whole organization is theirs to read, but not to change (no `property.write`): the server sends the members, and the step offers no question and no way to change a confirmation.
    workspace.hasPermission = (_context, permission) => permission !== 'property.write';
    server.confirmed = [pair(MILANO)];
    renderWizard();
    await onTheStep();

    const item = await screen.findByTestId('billing-portal-confirmed-item', undefined, WAIT);
    expect(item).toHaveTextContent('Airbnb incassa e versa l’imposta di soggiorno a Milano');
    expect(screen.queryByTestId('billing-portal-proposal')).toBeNull();
    expect(screen.getByTestId('billing-portal-remove-Airbnb-015146')).toBeDisabled();
    expect(screen.getByTestId('billing-step-tourist-tax')).toHaveAttribute('data-readonly', 'true');
    expect(confirmations).toEqual([]);
    expect(writes()).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { expectNoAxeViolations } from '@/test/axe';
import {
  ONBOARDING_FLOW_KEYS,
  type BulkProgress,
  type FlowPropertyStatus,
  type FlowSummary,
  type OnboardingFlowKey,
  type OnboardingStatus,
  type PagedFlowProperties,
} from '@/types/onboarding.types';
import { OnboardingSummaryPage } from '../onboarding-summary-page';
import { COLLABORATOR, OWNER, problemError } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getStatus: vi.fn(), getFlowProperties: vi.fn(), bulkProgress: vi.fn(), activateFlow: vi.fn(), runTest: vi.fn() },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const P1 = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const P2 = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';

function row(flow: OnboardingFlowKey, propertyId: string, name: string, overrides: Partial<FlowPropertyStatus> = {}): FlowPropertyStatus {
  return { propertyId, name, city: 'Rimini', flow, state: 'active', reason: null, action: null, prerequisites: [], ...overrides };
}

/** What the server answers for each flow: the same two properties, the first connected and the second still missing things. */
function answer(flow: OnboardingFlowKey, state?: string): PagedFlowProperties {
  const byFlow: Record<OnboardingFlowKey, FlowPropertyStatus[]> = {
    Listings: [row('Listings', P1, 'Casa del Mare'), row('Listings', P2, 'Villa Rosa', { state: 'toComplete', reason: 'channel_content_to_fix', action: 'fixListing' })],
    Bookings: [
      row('Bookings', P1, 'Casa del Mare', { state: 'toComplete', reason: 'flow_not_activated', action: 'activate' }),
      row('Bookings', P2, 'Villa Rosa', { state: 'toComplete', reason: 'mapping_unconfirmed', action: 'confirmMapping' }),
    ],
    CheckInCompliance: [
      row('CheckInCompliance', P1, 'Casa del Mare', { state: 'toComplete', reason: 'sender_missing', action: 'chooseSender' }),
      row('CheckInCompliance', P2, 'Villa Rosa', { state: 'notAvailable', reason: 'property_inactive' }),
    ],
    Messages: [row('Messages', P1, 'Casa del Mare', { state: 'notAvailable', reason: 'not_provided' }), row('Messages', P2, 'Villa Rosa', { state: 'notAvailable', reason: 'not_provided' })],
    Documents: [row('Documents', P1, 'Casa del Mare', { state: 'notAvailable', reason: 'content_managed_on_channel' }), row('Documents', P2, 'Villa Rosa', { state: 'notAvailable', reason: 'not_provided' })],
    Reports: [row('Reports', P1, 'Casa del Mare'), row('Reports', P2, 'Villa Rosa')],
  };
  const items = byFlow[flow].filter((item) => !state || item.state === state);
  return { items, totalCount: items.length, page: 1, pageSize: 20 };
}

function summary(flow: OnboardingFlowKey, active: number, toComplete: number, notAvailable: number): FlowSummary {
  return { flow, active, toComplete, notAvailable, total: active + toComplete + notAvailable };
}

const STATUS = {
  roleChosen: true,
  orgProvisioned: true,
  consentsAccepted: true,
  propertyCreated: true,
  sitePublished: false,
  firstBookingTaken: false,
  activated: false,
  steps: [],
  flows: [summary('Listings', 1, 1, 0), summary('Bookings', 0, 2, 0), summary('CheckInCompliance', 0, 1, 1), summary('Messages', 0, 0, 2), summary('Documents', 0, 0, 2), summary('Reports', 2, 0, 0)],
} as OnboardingStatus;

function progress(ready: Partial<Record<OnboardingFlowKey, number>>): BulkProgress {
  return {
    total: 2,
    ready: 1,
    notReady: 1,
    flows: ONBOARDING_FLOW_KEYS.map((flow) => ({ flow, active: 0, ready: ready[flow] ?? 0, toComplete: 1, notAvailable: 0 })),
    pilot: { members: [], size: 0, recommendedMin: 5, maxSize: 10, belowRecommended: true, flows: [] },
  };
}

function renderPage(entry = '/app/short-rent/onboarding/summary') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/app/short-rent/onboarding/summary" element={<OnboardingSummaryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  workspace.hasPermission = () => true;
  vi.mocked(onboardingApi.getStatus).mockReset().mockResolvedValue(STATUS);
  vi.mocked(onboardingApi.getFlowProperties)
    .mockReset()
    .mockImplementation((flow, query) => Promise.resolve(answer(flow, query?.state)));
  vi.mocked(onboardingApi.bulkProgress).mockReset().mockResolvedValue(progress({ Bookings: 1 }));
  vi.mocked(onboardingApi.activateFlow).mockReset();
  vi.mocked(onboardingApi.runTest).mockReset();
});

afterEach(() => {
  cleanup();
});

const cell = (propertyId: string, flow: OnboardingFlowKey) => screen.getByTestId(`flow-cell-${propertyId}-${flow}`);

describe('OnboardingSummaryPage, the traffic light, the final test and the activation (E10/F03/US02/T03)', () => {
  describe('the table', () => {
    it('FlowStatusTable_SixFlowsForEachProperty_ShowTheStateInColourIconAndWordsWithTheReasonAndAFaiOra', async () => {
      renderPage();

      const table = await screen.findByTestId('flow-table');
      expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
        i18n.t('onboardingPlan.summary.table.property'),
        ...ONBOARDING_FLOW_KEYS.map((flow) => i18n.t(`onboardingPlan.flows.names.${flow}`)),
      ]);
      // Active: a word, no reason, no button.
      expect(within(cell(P1, 'Listings')).getByTestId('flow-state')).toHaveTextContent(i18n.t('onboardingPlan.flows.states.active'));
      expect(within(cell(P1, 'Listings')).queryByRole('link')).not.toBeInTheDocument();
      // To complete: the reason in plain words and «Fai ora», which is the page that fixes it for THAT property.
      expect(within(cell(P2, 'Bookings')).getByTestId('flow-state')).toHaveAttribute('data-state', 'toComplete');
      expect(cell(P2, 'Bookings')).toHaveTextContent(i18n.t('onboardingPlan.reasons.property.mapping_unconfirmed'));
      expect(screen.getByTestId(`flow-cell-${P2}-Bookings-do`)).toHaveAttribute('href', '/app/short-rent/integrations/octorate?step=mapping');
      expect(screen.getByTestId(`flow-cell-${P2}-Listings-do`)).toHaveAttribute('href', `/app/short-rent/properties/${P2}/edit`);
      // The action «activate» is done on this very page: for the administrator a button, not a link to the page they are on.
      expect(screen.queryByTestId(`flow-cell-${P1}-Bookings-do`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`flow-cell-${P1}-Bookings-activate`).tagName).toBe('BUTTON');
      // Not available: the why, no button.
      expect(cell(P1, 'Documents')).toHaveTextContent(i18n.t('onboardingPlan.reasons.property.content_managed_on_channel'));
      expect(within(cell(P1, 'Documents')).queryByRole('link')).not.toBeInTheDocument();
      expect(within(cell(P1, 'Documents')).getByTestId('flow-state')).toHaveTextContent(i18n.t('onboardingPlan.flows.states.notAvailable'));
    });

    it('FlowStatusTable_ActionWhoseTargetHasNoPageForThePerson_SaysNotAvailableYetNeverADeadLink', async () => {
      // A reader of the properties cannot open the page of the activation of a property: the cell says so, with no link.
      workspace.hasPermission = (...args) => args[1] === 'property.read';
      renderPage();

      expect(await screen.findByTestId(`flow-cell-${P2}-Listings-unavailable`)).toHaveTextContent(i18n.t('onboardingPlan.launch.unavailable.title'));
      expect(screen.queryByTestId(`flow-cell-${P2}-Listings-do`)).not.toBeInTheDocument();
    });

    it('FlowStatusTable_PropertyThatWaitsOnlyForTheActivation_OpensTheActivationDialogForTheAdministrator', async () => {
      renderPage();
      await screen.findByTestId('flow-table');
      expect(screen.queryByTestId('activation-dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId(`flow-cell-${P1}-Bookings-activate`));

      // The dialog of the activation, as from the button of the page: the summary before the action, nothing done yet.
      const dialog = await screen.findByTestId('activation-dialog');
      expect(within(dialog).getByTestId('activation-confirm')).toBeInTheDocument();
      expect(onboardingApi.activateFlow).not.toHaveBeenCalled();
    });

    it('FlowStatusTable_PropertyThatWaitsOnlyForTheActivation_HasNoButtonForWhoIsNotTheAdministrator', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();

      await screen.findByTestId('flow-table');
      // The reason is told, and who activates is told below the table; nothing to press, and no link to the page the person is on.
      expect(cell(P1, 'Bookings')).toHaveTextContent(i18n.t('onboardingPlan.reasons.property.flow_not_activated'));
      expect(screen.queryByTestId(`flow-cell-${P1}-Bookings-activate`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`flow-cell-${P1}-Bookings-do`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`flow-cell-${P1}-Bookings-unavailable`)).not.toBeInTheDocument();
      expect(screen.getByTestId('summary-admin-only')).toBeInTheDocument();
    });

    it('FlowStatusTable_Strip_ShowsTheCountsOfEachFlowAndNarrowsTheTableToThatFlow', async () => {
      renderPage();
      await screen.findByTestId('flow-table');

      expect(screen.getByTestId('flow-strip-CheckInCompliance-counts')).toHaveTextContent(i18n.t('onboardingPlan.summary.strip.counts', { active: 0, toComplete: 1, notAvailable: 1 }));
      fireEvent.click(screen.getByTestId('flow-strip-CheckInCompliance'));

      await waitFor(() => expect(within(screen.getByTestId('flow-table')).getAllByRole('columnheader')).toHaveLength(2));
      expect(screen.getByTestId('flow-column-CheckInCompliance')).toBeInTheDocument();
      expect(screen.getByTestId('flow-strip-CheckInCompliance')).toHaveAttribute('aria-pressed', 'true');
      // The state filter belongs to a flow: now it can be used.
      expect(screen.getByTestId('flow-filter-state')).toBeEnabled();
      fireEvent.change(screen.getByTestId('flow-filter-state'), { target: { value: 'toComplete' } });
      await waitFor(() => expect(onboardingApi.getFlowProperties).toHaveBeenCalledWith('CheckInCompliance', expect.objectContaining({ state: 'toComplete' })));
      await waitFor(() => expect(screen.queryByTestId(`flow-row-${P2}`)).not.toBeInTheDocument());
      expect(screen.getByTestId(`flow-row-${P1}`)).toBeInTheDocument();
    });

    it('FlowStatusTable_PageOfProperties_IsAskedForAtATimeNeverAllOfThem', async () => {
      renderPage();
      await screen.findByTestId('flow-table');

      // One read for each flow, the same page of twenty: 250 properties never load at once (the choice of the property of the test reads at most a hundred).
      const asked = vi.mocked(onboardingApi.getFlowProperties).mock.calls;
      expect(asked.filter(([, query]) => query?.pageSize === 20)).toHaveLength(ONBOARDING_FLOW_KEYS.length);
      for (const flow of ONBOARDING_FLOW_KEYS) expect(onboardingApi.getFlowProperties).toHaveBeenCalledWith(flow, { page: 1, pageSize: 20, search: undefined });
      expect(Math.max(...asked.map(([, query]) => query?.pageSize ?? 0))).toBeLessThanOrEqual(100);
    });

    it('OnboardingSummaryPage_FlowInTheAddress_OpensTheTableOnThatFlowsPropertiesStillToComplete', async () => {
      renderPage('/app/short-rent/onboarding/summary?flow=bookings');

      await screen.findByTestId('flow-table');
      expect(onboardingApi.getFlowProperties).toHaveBeenCalledWith('Bookings', expect.objectContaining({ state: 'toComplete' }));
      expect(screen.getByTestId('flow-filter-flow')).toHaveValue('Bookings');
      expect(screen.getByTestId('flow-filter-state')).toHaveValue('toComplete');
    });
  });

  describe('who may do what', () => {
    it('OnboardingSummaryPage_NotTheOrganizationAdministrator_ReadsTheTableAndIsToldWhoActivatesWithNoTestAndNoButton', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();

      expect(await screen.findByTestId('flow-table')).toBeInTheDocument();
      expect(screen.getByTestId('summary-admin-only')).toHaveTextContent(i18n.t('onboardingPlan.summary.adminOnly'));
      expect(screen.queryByTestId('summary-activate')).not.toBeInTheDocument();
      expect(screen.queryByTestId('final-test-panel')).not.toBeInTheDocument();
      expect(onboardingApi.runTest).not.toHaveBeenCalled();
      expect(onboardingApi.bulkProgress).not.toHaveBeenCalled();
    });
  });

  describe('the final test', () => {
    it('FinalTestPanel_Run_ShowsOneLinePerFlowWithPlainReasonsAndAlwaysSaysNothingIsSent', async () => {
      vi.mocked(onboardingApi.runTest).mockResolvedValue({
        propertyId: P1,
        bookingId: 'b1',
        checks: [
          { flow: 'Listings', outcome: 'pass', reasons: [] },
          { flow: 'CheckInCompliance', outcome: 'fail', reasons: ['sender_missing'] },
          { flow: 'Messages', outcome: 'skipped', reasons: ['not_provided'] },
          { flow: 'Documents', outcome: 'pass', reasons: ['guest_data_missing'] },
        ],
      });
      renderPage();
      await screen.findByTestId('final-test-panel');
      // Before the test and after it: nothing is sent.
      expect(screen.getByTestId('test-no-effect')).toHaveTextContent('Nessun effetto: non viene inviato nulla');

      await waitFor(() => expect(screen.getByTestId('test-property')).toHaveValue(P1));
      fireEvent.click(screen.getByTestId('test-run'));

      const result = await screen.findByTestId('test-result');
      expect(onboardingApi.runTest).toHaveBeenCalledWith(P1, undefined);
      expect(within(result).getByTestId('test-check-Listings')).toHaveAttribute('data-outcome', 'pass');
      expect(within(result).getByTestId('test-check-CheckInCompliance')).toHaveTextContent(i18n.t('onboardingPlan.test.reasons.sender_missing'));
      expect(within(result).getByTestId('test-check-CheckInCompliance')).toHaveAttribute('data-outcome', 'fail');
      expect(within(result).getByTestId('test-check-Messages')).toHaveAttribute('data-outcome', 'skipped');
      // A pass can carry information: the guest data are often given at the check-in.
      expect(within(result).getByTestId('test-check-Documents')).toHaveTextContent(i18n.t('onboardingPlan.test.reasons.guest_data_missing'));
      expect(screen.getByTestId('test-no-effect')).toBeInTheDocument();
    });

    it('FinalTestPanel_PropertyWithNoImportedBooking_SaysSoInsteadOfAnError', async () => {
      vi.mocked(onboardingApi.runTest).mockRejectedValue(problemError(404, { code: 'test_booking_not_found', detail: 'Nessuna prenotazione.' }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('test-property')).toHaveValue(P1));

      fireEvent.click(screen.getByTestId('test-run'));

      expect(await screen.findByTestId('test-no-booking')).toHaveTextContent(i18n.t('onboardingPlan.test.noBooking'));
      expect(screen.queryByTestId('test-error')).not.toBeInTheDocument();
    });
  });

  describe('the activation', () => {
    it('ActivationDialog_Opened_SaysBeforeActingForHowManyPropertiesAndWhatStaysInTodoAndModificaChangesNothing', async () => {
      renderPage();
      await screen.findByTestId('flow-table');

      fireEvent.click(screen.getByTestId('summary-activate'));

      const dialog = await screen.findByTestId('activation-dialog');
      // By default the flows with something ready are ticked, and the dialog says it before it does it (UX-05).
      await waitFor(() => expect(within(dialog).getByTestId('activation-flow-Bookings')).toBeChecked());
      expect(within(dialog).getByTestId('activation-flow-Listings')).not.toBeChecked();
      expect(within(dialog).getByTestId('activation-summary')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.willActivate', { count: 1 }));
      expect(within(dialog).getByTestId('activation-summary')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.stayInTodo', { count: 1 }));
      fireEvent.click(within(dialog).getByTestId('activation-edit'));

      await waitFor(() => expect(screen.queryByTestId('activation-dialog')).not.toBeInTheDocument());
      expect(onboardingApi.activateFlow).not.toHaveBeenCalled();
    });

    it('ActivationDialog_Confirm_ActivatesTheReadyPropertiesAndListsWhatWasNotWithWhatItLacks', async () => {
      vi.mocked(onboardingApi.bulkProgress).mockResolvedValue(progress({ Bookings: 2 }));
      vi.mocked(onboardingApi.activateFlow).mockResolvedValue({
        flow: 'Bookings',
        outcomes: [
          { propertyId: P1, outcome: 'activated', unmetPrerequisites: [], reason: null },
          { propertyId: P2, outcome: 'prerequisitesNotMet', unmetPrerequisites: ['singleSender'], reason: 'sender_missing' },
        ],
      });
      // Both properties of the flow wait only for the activation when the dialog reads them.
      vi.mocked(onboardingApi.getFlowProperties).mockImplementation((flow, query) => {
        if (flow === 'Bookings' && query?.state === 'toComplete' && query.pageSize === 100) {
          return Promise.resolve({
            items: [row('Bookings', P1, 'Casa del Mare', { state: 'toComplete', reason: 'flow_not_activated', action: 'activate' }), row('Bookings', P2, 'Villa Rosa', { state: 'toComplete', reason: 'flow_not_activated', action: 'activate' })],
            totalCount: 2,
            page: 1,
            pageSize: 100,
          });
        }
        return Promise.resolve(answer(flow, query?.state));
      });
      renderPage();
      await screen.findByTestId('flow-table');
      fireEvent.click(screen.getByTestId('summary-activate'));
      const dialog = await screen.findByTestId('activation-dialog');
      await waitFor(() => expect(within(dialog).getByTestId('activation-confirm')).toBeEnabled());

      fireEvent.click(within(dialog).getByTestId('activation-confirm'));

      const result = await within(dialog).findByTestId('activation-result');
      // The server was asked for the properties that were read, by name and in one call; the flows that were not ticked were not called.
      expect(onboardingApi.activateFlow).toHaveBeenCalledTimes(1);
      expect(onboardingApi.activateFlow).toHaveBeenCalledWith('Bookings', [P1, P2]);
      expect(within(result).getByTestId('activation-result-Bookings')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.activated', { count: 1 }));
      // What was not activated, and what it lacks, in plain words; and the one next step.
      expect(within(result).getByTestId(`activation-not-Bookings-${P2}`)).toHaveTextContent('Villa Rosa');
      expect(within(result).getByTestId(`activation-not-Bookings-${P2}`)).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.singleSender'));
      expect(within(result).getByTestId('activation-next-step')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.nextTodo'));
      expect(within(result).getByTestId('activation-next-link')).toHaveAttribute('href', '/app/short-rent/activities');
    });

    it('ActivationDialog_AFlowThatFailsMidWay_KeepsWhatTheOthersSwitchedOnAndSaysWhichOneStoppedAndWhy', async () => {
      vi.mocked(onboardingApi.bulkProgress).mockResolvedValue(progress({ Listings: 1, Bookings: 1 }));
      // Both flows have a property that waits only for the activation when the dialog reads them.
      vi.mocked(onboardingApi.getFlowProperties).mockImplementation((flow, query) => {
        if ((flow === 'Listings' || flow === 'Bookings') && query?.state === 'toComplete' && query.pageSize === 100) {
          return Promise.resolve({ items: [row(flow, P1, 'Casa del Mare', { state: 'toComplete', reason: 'flow_not_activated', action: 'activate' })], totalCount: 1, page: 1, pageSize: 100 });
        }
        return Promise.resolve(answer(flow, query?.state));
      });
      // The first flow goes through and is switched on on the server; the next one is refused.
      vi.mocked(onboardingApi.activateFlow).mockImplementation((flow) =>
        flow === 'Listings'
          ? Promise.resolve({ flow, outcomes: [{ propertyId: P1, outcome: 'activated', unmetPrerequisites: [], reason: null }] })
          : Promise.reject(problemError(409, { detail: 'Il servizio ha rifiutato la richiesta.' })),
      );
      renderPage();
      await screen.findByTestId('flow-table');
      fireEvent.click(screen.getByTestId('summary-activate'));
      const dialog = await screen.findByTestId('activation-dialog');
      await waitFor(() => expect(within(dialog).getByTestId('activation-confirm')).toBeEnabled());

      fireEvent.click(within(dialog).getByTestId('activation-confirm'));

      const result = await within(dialog).findByTestId('activation-result');
      // What the flow before it switched on is in the result: an error does not hide it.
      expect(onboardingApi.activateFlow).toHaveBeenCalledTimes(2);
      expect(within(result).getByTestId('activation-result-Listings')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.activated', { count: 1 }));
      expect(within(result).queryByTestId('activation-failed-Listings')).not.toBeInTheDocument();
      // The flow that stopped says so, with the reason the server gave, and nothing of it is counted as done.
      expect(within(result).getByTestId('activation-result-Bookings')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.activated', { count: 0 }));
      expect(within(result).getByTestId('activation-failed-Bookings')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.flowFailed'));
      expect(within(result).getByTestId('activation-failed-Bookings')).toHaveTextContent('Il servizio ha rifiutato la richiesta.');
      expect(within(result).getByTestId('activation-next-step')).toHaveTextContent(i18n.t('onboardingPlan.summary.activation.nextRetry'));
      expect(within(dialog).queryByTestId('activation-error')).not.toBeInTheDocument();
    });
  });

  it('OnboardingSummaryPage_Page_HasNoViolationThatAxeCanFindWithoutABrowser', async () => {
    const { container } = renderPage();
    await screen.findByTestId('flow-table');

    await expectNoAxeViolations(container);
  });
});

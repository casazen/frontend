import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { propertiesApi } from '@/api/properties.api';
import {
  ONBOARDING_FLOW_KEYS,
  type BulkApplyItem,
  type BulkApplyResult,
  type BulkProgress,
  type OnboardingFlowKey,
  type PilotGroup,
} from '@/types/onboarding.types';
import { OnboardingBulkPage } from '../onboarding-bulk-page';
import { COLLABORATOR, OWNER, problemError } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { bulkProgress: vi.fn(), bulkPreview: vi.fn(), bulkApply: vi.fn(), bulkActivate: vi.fn(), getPilot: vi.fn(), setPilot: vi.fn(), importPropertyData: vi.fn(), getStatus: vi.fn(), getFlowProperties: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
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
const P3 = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';

function progress(overrides: Partial<BulkProgress> = {}): BulkProgress {
  return {
    total: 250,
    ready: 142,
    notReady: 108,
    flows: ONBOARDING_FLOW_KEYS.map((flow) => ({ flow, active: 10, ready: flow === 'Bookings' ? 132 : 20, toComplete: 100, notAvailable: 120 })),
    pilot: pilot(),
    ...overrides,
  };
}

function pilot(overrides: Partial<PilotGroup> = {}): PilotGroup {
  return { members: [], size: 0, recommendedMin: 5, maxSize: 10, belowRecommended: true, flows: [], ...overrides };
}

function item(propertyId: string, name: string, outcome: BulkApplyItem['outcome'], reason: string | null = null): BulkApplyItem {
  return { propertyId, name, city: 'Rimini', outcome, reason };
}

function applyResult(dryRun: boolean, items: BulkApplyItem[]): BulkApplyResult {
  const count = (outcome: string) => items.filter((candidate) => candidate.outcome === outcome).length;
  return {
    dryRun,
    complianceSender: 'Manual',
    summary: { applied: count('applied'), unchanged: count('unchanged'), refused: count('refused'), wouldChange: count('wouldChange') },
    items,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/short-rent/onboarding/bulk']}>
          <OnboardingBulkPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** The sender and the scope the person chooses, as a person does it. */
function choose(scope: 'all' | 'filter', sender?: 'ChannelManager' | 'CasaZen' | 'Manual') {
  fireEvent.click(screen.getByTestId(`bulk-scope-${scope}`));
  if (sender) fireEvent.click(screen.getByTestId(`bulk-sender-${sender}`));
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  workspace.hasPermission = () => true;
  vi.mocked(onboardingApi.bulkProgress).mockReset().mockResolvedValue(progress());
  vi.mocked(onboardingApi.getPilot).mockReset().mockResolvedValue(pilot());
  vi.mocked(onboardingApi.bulkPreview).mockReset();
  vi.mocked(onboardingApi.bulkApply).mockReset();
  vi.mocked(onboardingApi.bulkActivate).mockReset();
  vi.mocked(onboardingApi.setPilot).mockReset();
  vi.mocked(onboardingApi.importPropertyData).mockReset();
  vi.mocked(propertiesApi.getAll)
    .mockReset()
    .mockResolvedValue([
      { id: P1, name: 'Casa del Mare', city: 'Rimini', isActive: true },
      { id: P2, name: 'Villa Rosa', city: 'Riccione', isActive: true },
      { id: P3, name: 'Chiusa', city: 'Cesena', isActive: false },
    ] as never);
});

afterEach(() => {
  cleanup();
});

describe('OnboardingBulkPage, the bulk configuration (E10/F03/US03/T02)', () => {
  describe('who sees it and the progress', () => {
    it('OnboardingBulkPage_NotAnOrganizationAdministrator_ReadsWhoManagesItAndSendsNoRequest', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();

      expect(await screen.findByTestId('bulk-admin-only')).toHaveTextContent(i18n.t('onboardingPlan.bulk.adminOnly'));
      expect(screen.queryByTestId('bulk-selection')).not.toBeInTheDocument();
      for (const call of [onboardingApi.bulkProgress, onboardingApi.getPilot, onboardingApi.bulkPreview, onboardingApi.bulkApply, onboardingApi.bulkActivate, onboardingApi.setPilot, propertiesApi.getAll]) {
        expect(call).not.toHaveBeenCalled();
      }
    });

    it('BulkProgressCard_ReadyOfTotal_ShowsTheBarAndTheCountsOfEachFlowAtTheTopOfThePage', async () => {
      renderPage();

      expect(await screen.findByTestId('bulk-progress-summary')).toHaveTextContent(i18n.t('onboardingPlan.bulk.progress.ready', { ready: 142, count: 250 }));
      expect(screen.getByTestId('bulk-progress-bar')).toHaveAttribute('aria-valuenow', '57');
      for (const flow of ONBOARDING_FLOW_KEYS) expect(screen.getByTestId(`bulk-progress-flow-${flow}`)).toBeInTheDocument();
      expect(screen.getByTestId('bulk-progress-flow-Bookings')).toHaveTextContent('132');
      // The card comes first on the page.
      const page = screen.getByTestId('onboarding-bulk-page');
      expect(page.querySelector('section')).toBe(screen.getByTestId('bulk-progress'));
    });

    it('BulkProgressCard_TheReadFails_SaysItFailedNeverThatAllAreReadyAndAProgressThatIsNotThere_ShowsNoZeroOfZero', async () => {
      vi.mocked(onboardingApi.bulkProgress).mockRejectedValueOnce(problemError(500, {}));
      renderPage();

      expect(await screen.findByTestId('bulk-progress-error')).toHaveTextContent(i18n.t('onboardingPlan.bulk.progress.loadError'));
      expect(screen.queryByTestId('bulk-progress-summary')).not.toBeInTheDocument();
      cleanup();

      vi.mocked(onboardingApi.bulkProgress).mockResolvedValue(progress({ total: 0, ready: 0, notReady: 0, flows: [] }));
      renderPage();
      expect(await screen.findByTestId('bulk-progress-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('bulk-progress-summary')).not.toBeInTheDocument();
    });

    it('BulkProgressCard_A404_IsNotFoundAndNotTheFiguresOfTheCache', async () => {
      vi.mocked(onboardingApi.bulkProgress).mockRejectedValue(problemError(404, {}));
      renderPage();

      expect(await screen.findByTestId('bulk-progress-error')).toHaveTextContent(i18n.t('onboardingPlan.bulk.progress.notFound'));
    });
  });

  describe('the selection and the choice', () => {
    it('BulkSelectionPanel_AtTheStart_NothingIsChosenAndEveryActionIsOffNeverMeaningAll', async () => {
      renderPage();
      await screen.findByTestId('bulk-selection');

      expect(screen.getByTestId('bulk-scope-all')).not.toBeChecked();
      expect(screen.getByTestId('bulk-scope-filter')).not.toBeChecked();
      for (const sender of ['ChannelManager', 'CasaZen', 'Manual']) expect(screen.getByTestId(`bulk-sender-${sender}`)).not.toBeChecked();
      for (const action of ['bulk-preview', 'bulk-check', 'bulk-apply']) expect(screen.getByTestId(action), action).toBeDisabled();
      expect(screen.getByTestId('bulk-nothing-chosen')).toBeInTheDocument();
      // A scope without a sender (or a sender without a scope) is still nothing to check.
      choose('all');
      expect(screen.getByTestId('bulk-check')).toBeDisabled();
      expect(screen.getByTestId('bulk-preview')).toBeEnabled();
      expect(onboardingApi.bulkApply).not.toHaveBeenCalled();
      expect(onboardingApi.bulkPreview).not.toHaveBeenCalled();
    });

    it('BulkSelectionPanel_AFilterWithNoCriterionOrAWrongCode_IsNoSelectionAndSaysWhy', async () => {
      renderPage();
      await screen.findByTestId('bulk-selection');

      choose('filter', 'Manual');
      expect(screen.getByTestId('bulk-filter-none')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-preview')).toBeDisabled();
      expect(screen.getByTestId('bulk-check')).toBeDisabled();

      fireEvent.change(screen.getByTestId('bulk-filter-comuni'), { target: { value: '4701' } });
      expect(screen.getByTestId('bulk-filter-comuni')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('bulk-check')).toBeDisabled();

      // A flow without its state is half a criterion, not a selection.
      fireEvent.change(screen.getByTestId('bulk-filter-comuni'), { target: { value: '' } });
      fireEvent.change(screen.getByTestId('bulk-filter-flow'), { target: { value: 'Bookings' } });
      expect(screen.getByTestId('bulk-check')).toBeDisabled();
      expect(onboardingApi.bulkPreview).not.toHaveBeenCalled();
    });

    it('BulkSelectionPanel_VediLaSelezione_SendsExactlyTheFilterAndShowsTheTotalAndTheSample', async () => {
      vi.mocked(onboardingApi.bulkPreview).mockResolvedValue({
        total: 230,
        sample: [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini' }],
        notFound: 0,
        exceedsLimit: false,
        maxPropertiesPerCall: 500,
      });
      renderPage();
      await screen.findByTestId('bulk-selection');

      choose('filter');
      fireEvent.change(screen.getByTestId('bulk-filter-comuni'), { target: { value: '099014, 099015' } });
      fireEvent.change(screen.getByTestId('bulk-filter-regions'), { target: { value: 'emr' } });
      fireEvent.click(screen.getByTestId('bulk-preview'));

      expect(await screen.findByTestId('bulk-preview-total')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.total', { count: 230 }));
      expect(onboardingApi.bulkPreview).toHaveBeenCalledWith({ kind: 'filter', filter: { comuneIstatCodes: ['099014', '099015'], regionCodes: ['EMR'] } });
      expect(screen.getByTestId('bulk-preview-sample')).toHaveTextContent('Casa del Mare');
    });

    it('BulkSelectionPanel_TheCheckWritesNothing_ShowsWhoWouldChangeAndTheRefusalsInWordsAndThePressOfApplyIsConfirmedAfterIt', async () => {
      vi.mocked(onboardingApi.bulkApply)
        .mockResolvedValueOnce(applyResult(true, [item(P1, 'Casa del Mare', 'wouldChange'), item(P2, 'Villa Rosa', 'unchanged'), item(P3, 'Chiusa', 'refused', 'sender_not_applicable')]))
        .mockResolvedValueOnce(applyResult(false, [item(P1, 'Casa del Mare', 'applied'), item(P2, 'Villa Rosa', 'unchanged'), item(P3, 'Chiusa', 'refused', 'sender_not_applicable')]));
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'Manual');

      fireEvent.click(screen.getByTestId('bulk-check'));

      // The check: a dry run, nothing confirmed. Each property is told, one by one, with the reason of a refusal in plain words.
      await screen.findByTestId('bulk-check-result');
      expect(onboardingApi.bulkApply).toHaveBeenCalledWith({ selection: { kind: 'all' }, choice: { complianceSender: 'Manual' }, dryRun: true, confirmed: false });
      expect(screen.getByTestId('bulk-check-would-change')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.summary.wouldChange', { count: 1 }));
      expect(screen.getByTestId(`bulk-item-${P1}`)).toHaveAttribute('data-outcome', 'wouldChange');
      expect(screen.getByTestId(`bulk-item-${P3}-reason`)).toHaveTextContent(i18n.t('onboardingPlan.bulk.reasons.sender_not_applicable'));
      expect(screen.getByTestId('bulk-apply')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.apply', { count: 1 }));

      // The press: a confirmation that says exactly what will happen, which properties and to what; nothing is written before it.
      fireEvent.click(screen.getByTestId('bulk-apply'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByTestId('bulk-confirm-properties')).toHaveTextContent('Casa del Mare');
      expect(within(dialog).getByTestId('bulk-confirm-properties')).not.toHaveTextContent('Villa Rosa');
      expect(dialog).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.confirmDescription', { sender: i18n.t('onboardingPlan.bulk.selection.senders.Manual') }));
      expect(onboardingApi.bulkApply).toHaveBeenCalledTimes(1);

      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('onboardingPlan.bulk.selection.confirmAction', { count: 1 }) }));

      await screen.findByTestId('bulk-applied');
      expect(onboardingApi.bulkApply).toHaveBeenLastCalledWith({ selection: { kind: 'all' }, choice: { complianceSender: 'Manual' }, dryRun: false, confirmed: true });
      // One refusal: it is not told as a success, and it says so as a warning.
      expect(screen.getByTestId('bulk-applied-summary')).toHaveAttribute('data-complete', 'false');
      expect(screen.getByTestId('bulk-applied-summary')).toHaveAttribute('role', 'alert');
      expect(screen.getByTestId('bulk-applied-summary')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.appliedPartly'));
      expect(screen.getByTestId('bulk-applied-refused')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.summary.refused', { count: 1 }));
      // Nothing goes twice: the press is off until a new check.
      await waitFor(() => expect(screen.getByTestId('bulk-apply')).toBeDisabled());
    });

    it('BulkSelectionPanel_ChangingTheChoiceAfterTheCheck_DropsTheCheckAndTheApplyIsOffUntilItIsChecked', async () => {
      vi.mocked(onboardingApi.bulkApply).mockResolvedValue(applyResult(true, [item(P1, 'Casa del Mare', 'wouldChange')]));
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'Manual');
      fireEvent.click(screen.getByTestId('bulk-check'));
      await screen.findByTestId('bulk-check-result');
      expect(screen.getByTestId('bulk-apply')).toBeEnabled();

      fireEvent.click(screen.getByTestId('bulk-sender-ChannelManager'));

      expect(screen.queryByTestId('bulk-check-result')).not.toBeInTheDocument();
      expect(screen.getByTestId('bulk-apply')).toBeDisabled();
      expect(onboardingApi.bulkApply).toHaveBeenCalledTimes(1);
    });

    it('BulkSelectionPanel_TheConfirmedCallFails_SaysSomeMayHaveChangedAndIsNeverToldAsDone', async () => {
      vi.mocked(onboardingApi.bulkApply)
        .mockResolvedValueOnce(applyResult(true, [item(P1, 'Casa del Mare', 'wouldChange')]))
        .mockRejectedValueOnce(problemError(500, {}));
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'CasaZen');
      fireEvent.click(screen.getByTestId('bulk-check'));
      await screen.findByTestId('bulk-check-result');
      fireEvent.click(screen.getByTestId('bulk-apply'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('onboardingPlan.bulk.selection.confirmAction', { count: 1 }) }));

      expect(await screen.findByTestId('bulk-uncertain')).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.uncertain'));
      expect(screen.queryByTestId('bulk-applied')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bulk-check-result')).not.toBeInTheDocument();
      expect(screen.getByTestId('bulk-apply')).toBeDisabled();
    });

    it('BulkSelectionPanel_ASecondPressOnTheConfirmationWhileTheCallIsOnItsWay_SendsItOnlyOnce', async () => {
      let finish: (value: BulkApplyResult) => void = () => undefined;
      vi.mocked(onboardingApi.bulkApply)
        .mockResolvedValueOnce(applyResult(true, [item(P1, 'Casa del Mare', 'wouldChange')]))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'Manual');
      fireEvent.click(screen.getByTestId('bulk-check'));
      await screen.findByTestId('bulk-check-result');
      fireEvent.click(screen.getByTestId('bulk-apply'));
      const confirm = within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('onboardingPlan.bulk.selection.confirmAction', { count: 1 }) });

      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      await waitFor(() => expect(onboardingApi.bulkApply).toHaveBeenCalledTimes(2));
      // Every button of the card is off while the call is on its way.
      expect(screen.getByTestId('bulk-check')).toBeDisabled();
      expect(screen.getByTestId('bulk-preview')).toBeDisabled();
      expect(screen.getByTestId('bulk-apply')).toBeDisabled();
      finish(applyResult(false, [item(P1, 'Casa del Mare', 'applied')]));
      await screen.findByTestId('bulk-applied');
      expect(onboardingApi.bulkApply).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('bulk-applied-summary')).toHaveAttribute('data-complete', 'true');
    });

    it('BulkSelectionPanel_AnApplyThatChangedNothing_IsNeverToldAsASuccess', async () => {
      vi.mocked(onboardingApi.bulkApply)
        .mockResolvedValueOnce(applyResult(true, [item(P1, 'Casa del Mare', 'wouldChange')]))
        .mockResolvedValueOnce(applyResult(false, [item(P1, 'Casa del Mare', 'unchanged')]));
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'Manual');
      fireEvent.click(screen.getByTestId('bulk-check'));
      await screen.findByTestId('bulk-check-result');
      fireEvent.click(screen.getByTestId('bulk-apply'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('onboardingPlan.bulk.selection.confirmAction', { count: 1 }) }));

      const summary = await screen.findByTestId('bulk-applied-summary');
      expect(summary).toHaveAttribute('data-complete', 'false');
      expect(summary).toHaveTextContent(i18n.t('onboardingPlan.bulk.selection.appliedNone'));
    });

    it('BulkSelectionPanel_AResultOfManyProperties_IsDrawnFiftyAtATime', async () => {
      const items = Array.from({ length: 120 }, (_, index) => item(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, `Casa ${index}`, 'wouldChange'));
      vi.mocked(onboardingApi.bulkApply).mockResolvedValue(applyResult(true, items));
      renderPage();
      await screen.findByTestId('bulk-selection');
      choose('all', 'Manual');
      fireEvent.click(screen.getByTestId('bulk-check'));

      const table = await screen.findByTestId('bulk-check-items');
      expect(within(table).getAllByRole('row')).toHaveLength(51);
      expect(screen.getByTestId('bulk-check-items-pager-status')).toHaveTextContent(i18n.t('onboardingPlan.bulk.pager.status', { page: 1, pages: 3, total: 120 }));
    });
  });

  describe('the pilot group', () => {
    it('PilotGroupPanel_FewerThanFive_ShowsTheHintWithoutBlockingAndSavesTheChosenOnes', async () => {
      vi.mocked(onboardingApi.setPilot).mockResolvedValue(pilot({ members: [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini', addedAt: '2026-11-10T08:00:00Z' }], size: 1 }));
      renderPage();

      expect(await screen.findByTestId('pilot-hint')).toHaveTextContent(i18n.t('onboardingPlan.bulk.pilot.hint', { min: 5, max: 10 }));
      // Only the properties that are active are offered.
      expect(await screen.findByTestId(`pilot-candidate-${P1}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`pilot-candidate-${P3}`)).not.toBeInTheDocument();
      expect(screen.getByTestId('pilot-save')).toBeDisabled();

      fireEvent.click(screen.getByTestId(`pilot-candidate-${P1}`));
      expect(screen.getByTestId('pilot-save')).toBeEnabled();
      fireEvent.click(screen.getByTestId('pilot-save'));

      await waitFor(() => expect(onboardingApi.setPilot).toHaveBeenCalledWith([P1]));
      // The recommendation does not block: one property was enough to save.
      expect(screen.getByTestId('pilot-hint')).toBeInTheDocument();
    });

    it('PilotGroupPanel_TheOthersWaitForThePilot_StayOffWithTheReasonUntilThePilotIsActiveInTheFlowsChosen', async () => {
      const members = [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini', addedAt: '2026-11-10T08:00:00Z' }];
      vi.mocked(onboardingApi.getPilot).mockResolvedValue(pilot({ members, size: 1, flows: [{ flow: 'Bookings', available: 1, active: 0, isActive: false }] }));
      renderPage();
      await screen.findByTestId('pilot-activation');

      // Nothing is ticked at the start, and the others stay off with the reason.
      for (const flow of ONBOARDING_FLOW_KEYS) expect(screen.getByTestId(`pilot-flow-${flow}`), flow).not.toBeChecked();
      expect(screen.getByTestId('pilot-activate')).toBeDisabled();
      expect(screen.getByTestId('pilot-activate-rest')).toBeDisabled();
      expect(screen.getByTestId('pilot-rest-note')).toHaveTextContent(i18n.t('onboardingPlan.bulk.pilot.restNote'));

      fireEvent.click(screen.getByTestId('pilot-flow-Bookings'));
      expect(screen.getByTestId('pilot-activate')).toBeEnabled();
      // The pilot is not active in the flow chosen: the others stay off.
      expect(screen.getByTestId('pilot-activate-rest')).toBeDisabled();
      expect(onboardingApi.bulkActivate).not.toHaveBeenCalled();
    });

    it('PilotGroupPanel_ThePilotIsActive_ActivatesTheOthersAndReportsThePropertiesWhosePrerequisitesAreNotMet', async () => {
      const members = [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini', addedAt: '2026-11-10T08:00:00Z' }];
      vi.mocked(onboardingApi.getPilot).mockResolvedValue(pilot({ members, size: 1, flows: [{ flow: 'Bookings', available: 1, active: 1, isActive: true }] }));
      vi.mocked(onboardingApi.bulkActivate).mockResolvedValue({
        cohort: 'rest',
        flows: [
          {
            flow: 'Bookings',
            outcomes: [
              { propertyId: P2, outcome: 'activated', unmetPrerequisites: [], reason: null },
              { propertyId: P3, outcome: 'prerequisitesNotMet', unmetPrerequisites: ['singleSender', 'issuer', 'brandNewKey' as never], reason: null },
            ],
          },
        ],
      });
      renderPage();
      await screen.findByTestId('pilot-activation');
      fireEvent.click(screen.getByTestId('pilot-flow-Bookings'));
      await waitFor(() => expect(screen.getByTestId('pilot-activate-rest')).toBeEnabled());
      expect(screen.queryByTestId('pilot-rest-note')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('pilot-activate-rest'));
      const dialog = await screen.findByRole('dialog');
      expect(onboardingApi.bulkActivate).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('onboardingPlan.bulk.pilot.activateRest') }));

      await screen.findByTestId('pilot-report');
      expect(onboardingApi.bulkActivate).toHaveBeenCalledTimes(1);
      expect(onboardingApi.bulkActivate).toHaveBeenCalledWith({ cohort: 'rest', flows: ['Bookings'] });
      // One property was not ready: told as a part, never as done, with what it lacks (and a prerequisite the app does not know as a neutral phrase).
      expect(screen.getByTestId('pilot-report-summary')).toHaveAttribute('data-complete', 'false');
      const left = screen.getByTestId(`pilot-left-Bookings-${P3}`);
      expect(left).toHaveTextContent('Chiusa');
      expect(left).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.singleSender'));
      expect(left).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.issuer'));
      expect(left).toHaveTextContent(i18n.t('onboardingPlan.summary.prerequisites.unknown'));
      expect(left.textContent).not.toContain('onboardingPlan.');
    });

    it('PilotGroupPanel_TheServerRefusesTheOthers_SaysWhyAndNothingIsToldAsDone', async () => {
      const members = [{ propertyId: P1, name: 'Casa del Mare', city: 'Rimini', addedAt: '2026-11-10T08:00:00Z' }];
      vi.mocked(onboardingApi.getPilot).mockResolvedValue(pilot({ members, size: 1, flows: [{ flow: 'Bookings', available: 1, active: 1, isActive: true }] }));
      vi.mocked(onboardingApi.bulkActivate).mockRejectedValue(problemError(409, { code: 'pilot_group_not_active', detail: 'Il gruppo pilota non è ancora attivo.' }));
      renderPage();
      await screen.findByTestId('pilot-activation');
      fireEvent.click(screen.getByTestId('pilot-flow-Bookings'));
      await waitFor(() => expect(screen.getByTestId('pilot-activate-rest')).toBeEnabled());
      fireEvent.click(screen.getByTestId('pilot-activate-rest'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('onboardingPlan.bulk.pilot.activateRest') }));

      expect(await screen.findByTestId('pilot-activate-error')).toHaveTextContent('Il gruppo pilota non è ancora attivo.');
      expect(screen.queryByTestId('pilot-report')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pilot-uncertain')).not.toBeInTheDocument();
    });
  });
});

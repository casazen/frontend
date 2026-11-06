import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { octorateApi } from '@/api/octorate.api';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { expectNoAxeViolations } from '@/test/axe';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';
import {
  INVENTORY_SCENARIOS,
  SCENARIO_STEP_SCHEMA,
  assignPortfolio,
  routeForScenario,
  type InventoryScenario,
  type PortfolioGroup,
} from '../inventory-scenario';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';
import { SCOPE, WAIT, WIZARD_DRAFT_ID, connection, currentLocation, onStep, renderWizard } from './octorate-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/octorate.api', () => ({
  octorateApi: { getConnectionStatus: vi.fn(), startConnect: vi.fn(), completeConnect: vi.fn(), disconnect: vi.fn() },
}));

// A whole wizard is rendered in these tests (and checked with axe): the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const choose = (scenario: InventoryScenario) => fireEvent.click(screen.getByTestId(`octorate-scenario-${scenario}`));
const next = () => fireEvent.click(screen.getByTestId('octorate-connect-next'));

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection());
});

afterEach(() => {
  cleanup();
});

/** Nothing of the connection is asked for or written by the first question: only the consent does it. */
function expectNoConnectionWrite() {
  expect(octorateApi.startConnect).not.toHaveBeenCalled();
  expect(octorateApi.completeConnect).not.toHaveBeenCalled();
  expect(octorateApi.disconnect).not.toHaveBeenCalled();
}

describe('the answers to the first question (E02/F01/US01/T04, D6)', () => {
  it('routeForScenario_EachAnswer_HasItsOwnKindOfPath', () => {
    expect(routeForScenario('onOctorate')).toMatchObject({ kind: 'consent', available: true });
    expect(routeForScenario('onOtas')).toMatchObject({ kind: 'import' });
    expect(routeForScenario('newInventory')).toMatchObject({ kind: 'listing', available: true, path: PROPERTY_CREATE_PATH });
    // Three answers, three kinds: no path is shared.
    expect(new Set(INVENTORY_SCENARIOS.map((scenario) => routeForScenario(scenario).kind)).size).toBe(INVENTORY_SCENARIOS.length);
  });

  it('routeForScenario_AnswerAlreadyOnTheOtas_NeverLeadsToTheCreationOfAListing', () => {
    const route = routeForScenario('onOtas');

    expect(route.kind).not.toBe('listing');
    expect(route.path).toBeUndefined();
    // The import is built by E02/F01/US03: until then the answer exists and cannot be given.
    expect(route.available).toBe(false);
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
});

describe('the first step of the wizard "Collega i tuoi canali"', () => {
  it('OctorateConnectWizard_FirstStep_AsksWhereTheListingsAreWithExactlyThreeAnswers', async () => {
    renderWizard();

    await onStep('scenario');
    expect(screen.getByRole('heading', { level: 2, name: i18n.t('octorate.connect.steps.scenario.title') })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText(i18n.t('octorate.connect.scenario.onOctorate.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.scenario.onOtas.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.scenario.newInventory.title'))).toBeInTheDocument();
    // "Save and exit" is there from the first step (NF-06).
    expect(screen.getByTestId('octorate-connect-save-exit')).toBeInTheDocument();
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_AnswerOnTheOtas_IsShownAndBlockedUntilTheImportExists', async () => {
    renderWizard();
    await onStep('scenario');

    expect(screen.getByTestId('octorate-scenario-onOtas')).toBeDisabled();
    expect(screen.getByText(i18n.t('octorate.connect.scenario.onOtas.soon'))).toBeInTheDocument();
    expect(screen.getByTestId('octorate-scenario-onOctorate')).toBeEnabled();
    expect(screen.getByTestId('octorate-scenario-newInventory')).toBeEnabled();
    expect(screen.getByTestId('octorate-scenario-onOtas')).not.toBeChecked();
    expectNoConnectionWrite();
  });

  it('SCENARIO_STEP_SCHEMA_EachAnswer_IsCheckedBeforeTheStepMovesOn', () => {
    const messages = (scenario: unknown) =>
      SCENARIO_STEP_SCHEMA.safeParse({ scenario }).error?.issues.map((issue) => issue.message) ?? [];

    expect(SCENARIO_STEP_SCHEMA.safeParse({ scenario: 'onOctorate' }).success).toBe(true);
    expect(SCENARIO_STEP_SCHEMA.safeParse({ scenario: 'newInventory' }).success).toBe(true);
    // No answer is an answer to give; the one whose path does not exist yet is refused even when it comes from a draft.
    expect(messages(null)).toEqual(['octorate.connect.errors.scenarioRequired']);
    expect(messages('somethingElse')).toEqual(['octorate.connect.errors.scenarioRequired']);
    expect(messages('onOtas')).toEqual(['octorate.connect.errors.scenarioUnavailable']);
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

    expect(await screen.findByTestId('octorate-consent-explanation', undefined, WAIT)).toBeInTheDocument();
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

  it('OctorateConnectWizard_ADraftWithTheAnswerOnTheOtas_GoesBackToTheQuestionAndCreatesNothing', async () => {
    // The answer cannot be given today, but a draft is just data in the tab: it must not take the host anywhere.
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'consent', values: { scenario: 'onOtas' } });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=consent`);

    await onStep('scenario');

    expect(screen.queryByTestId('listing-wizard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('octorate-consent-step')).not.toBeInTheDocument();
    expectNoConnectionWrite();
  });

  it('OctorateConnectWizard_ADraftWithTheAnswerNotPublishedYet_NeverStartsAConsentOnTheConsentStep', async () => {
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'consent', values: { scenario: 'newInventory' } });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=consent`);

    expect(await screen.findByTestId('listing-wizard', undefined, WAIT)).toBeInTheDocument();
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
      // The answer, and the decisions about the listings (none yet): both travel with the draft.
      expect(draft?.values).toEqual({ scenario: 'onOctorate', decisions: [] });
    }, WAIT);
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

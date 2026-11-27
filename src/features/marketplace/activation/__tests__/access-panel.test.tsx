import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { getActivation, getActivationPlan, importActivation } from '@/api/marketplace.api';
import { onboardingApi } from '@/api/onboarding.api';
import { propertiesApi } from '@/api/properties.api';
import type { PanelStep } from '@/types/onboarding.types';
import { ACTIVATION_PATH, WAIT, axiosError, onStep, plan, primaryButton, property, renderActivation, state } from './activation-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn(), getById: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
  getActivation: vi.fn(),
  importActivation: vi.fn(),
}));
vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: {
    listPanelSteps: vi.fn(),
    startPanelStep: vi.fn(),
    getPanelStepStatus: vi.fn(),
    verifyPanelStep: vi.fn(),
    confirmPanelStep: vi.fn(),
    completePanelStepCallback: vi.fn(),
    listAssistRequests: vi.fn(),
    requestAssist: vi.fn(),
  },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true } }) }));

vi.setConfig({ testTimeout: 30_000 });

const ACCESS_STEP_URL = `${ACTIVATION_PATH}?propertyId=prop-1&step=access`;

let panelAccessDone = false;

function confirmedStep(): PanelStep {
  return {
    id: 'step-1',
    kind: 'channelAccess',
    status: 'confirmed',
    handoffMode: 'managedWindow',
    propertyId: 'prop-1',
    channelCode: '142',
    instructionsKey: 'panelChannelAccess',
    activityId: null,
    nextCheckAt: null,
    lastVerificationOutcome: 'unverifiable',
    canConfirm: false,
    resume: { wizardType: 'OnboardingActivation', draftEntityId: null, stepCode: 'marketplaceActivationChannel' },
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function givenAPortalThatNeedsThePanel({ activationId = 'act-1' as string | null, steps = [confirmedStep()] }: { activationId?: string | null; steps?: PanelStep[] } = {}) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) =>
    plan({ propertyId, requirements: ['panelAccess'], activationId, activationStatus: activationId ? 'Pending' : null }),
  );
  vi.mocked(getActivation).mockImplementation(async (id) => state({ activationId: id, panelAccessDone }));
  vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue(steps);
  vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([]);
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  panelAccessDone = false;
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the access step of a portal that asks for the access on the panel of the channel manager', () => {
  it('AccessStep_StepConfirmedByThePersonButTheChannelManagerDoesNotShowTheAccess_IsNotDoneAndOffersCheckAgainAndHelp', async () => {
    givenAPortalThatNeedsThePanel();
    renderActivation(ACCESS_STEP_URL);

    const notice = await screen.findByTestId('activation-panel-not-given', {}, WAIT);
    expect(notice).toHaveTextContent(i18n.t('marketplace.activation.access.panel.notGiven', { property: 'Casa Rosa', name: 'Booking.com' }));
    expect(getActivation).toHaveBeenCalledWith('act-1');
    expect(screen.queryByTestId('activation-panel-all-done')).not.toBeInTheDocument();
    expect(primaryButton()).toBeDisabled();
    expect(screen.getByTestId('activation-panel-recheck')).toHaveTextContent(i18n.t('marketplace.activation.access.panel.recheck'));
    expect(await screen.findByTestId('assist-request-help', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('activation-panel-save-exit')).toBeInTheDocument();
  });

  it('AccessStep_CheckAgainAndTheChannelManagerNowShowsTheAccess_IsDoneAndTheStepCanGoOn', async () => {
    givenAPortalThatNeedsThePanel();
    renderActivation(ACCESS_STEP_URL);
    await screen.findByTestId('activation-panel-not-given', {}, WAIT);
    expect(getActivation).toHaveBeenCalledTimes(1);

    panelAccessDone = true;
    fireEvent.click(screen.getByTestId('activation-panel-recheck'));

    expect(await screen.findByTestId('activation-panel-all-done', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-panel-not-given')).not.toBeInTheDocument();
    expect(getActivation).toHaveBeenCalledTimes(2);
    expect(primaryButton()).toBeEnabled();
  });

  it('AccessStep_ChannelManagerShowsTheAccess_IsDoneEvenWhenTheGuidedStepIsNot', async () => {
    panelAccessDone = true;
    givenAPortalThatNeedsThePanel({ steps: [] });
    renderActivation(ACCESS_STEP_URL);

    expect(await screen.findByTestId('activation-panel-all-done', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-panel-not-given')).not.toBeInTheDocument();
    expect(primaryButton()).toBeEnabled();
  });

  it('AccessStep_NoActivationYet_TheGuidedStepIsTheProofOfTheFirstPassAndTheChannelManagerIsNotAsked', async () => {
    givenAPortalThatNeedsThePanel({ activationId: null });
    renderActivation(ACCESS_STEP_URL);

    expect(await screen.findByTestId('activation-panel-all-done', {}, WAIT)).toBeInTheDocument();
    expect(getActivation).not.toHaveBeenCalled();
    expect(primaryButton()).toBeEnabled();
  });
});

describe('the way back from the import to the access on the panel', () => {
  it('ImportStep_PanelAccessPendingOnAPortalThatNeedsThePanel_FixLeadsToAnAccessStepThatIsNotShownAsDone', async () => {
    givenAPortalThatNeedsThePanel();
    vi.mocked(importActivation).mockRejectedValue(axiosError(409, { code: 'marketplace_panel_access_pending' }));
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-1&step=import`);

    expect(await screen.findByTestId('activation-import-prop-1-problem', {}, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.marketplacePanelAccessPending'));
    fireEvent.click(screen.getByTestId('activation-import-prop-1-fix'));

    // The person said the step was done and the channel manager says the access is not there: the step says so, with a way on, instead of «consent given».
    await onStep('access');
    expect(await screen.findByTestId('activation-panel-not-given', {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-panel-all-done')).not.toBeInTheDocument();
    expect(primaryButton()).toBeDisabled();
  });
});

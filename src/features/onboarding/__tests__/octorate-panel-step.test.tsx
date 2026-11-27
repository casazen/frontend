import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { applyNotificationsChange } from '@/features/notifications/use-notifications-realtime';
import { partPath } from '@/lib/onboarding-parts';
import { expectNoAxeViolations } from '@/test/axe';
import type { AssistRequest, PanelStep, StartedPanelStep } from '@/types/onboarding.types';
import { OnboardingPanelResumePage, OnboardingPanelStepPage } from '../onboarding-panel-step-page';
import { COLLABORATOR, OWNER, problemError } from './onboarding-fixtures';

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
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null, action),
}));
vi.mock('@/queries/use-properties', () => ({ useProperty: () => ({ data: { name: 'Casa del Mare' } }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true }, isLoading: false }) }));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const STEP_ID = '5b0c8b8e-6f1d-4a43-9b62-0f6f7d2f8a11';
const PROPERTY_ID = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const PANEL_URL = 'https://panel.channel-manager.test/';

let server: PanelStep;

function panelStep(overrides: Partial<PanelStep> = {}): PanelStep {
  return {
    id: STEP_ID,
    kind: 'policeConnection',
    status: 'started',
    handoffMode: 'managedWindow',
    propertyId: PROPERTY_ID,
    channelCode: null,
    instructionsKey: 'panelPolice',
    activityId: 'a1',
    nextCheckAt: null,
    lastVerificationOutcome: null,
    canConfirm: false,
    resume: { wizardType: null, draftEntityId: null, stepCode: null },
    startedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

const events: string[] = [];

function fakeWindow() {
  const navigated: string[] = [];
  const win = {
    closed: false,
    opener: {} as unknown,
    focus: vi.fn(),
    close: vi.fn(() => {
      win.closed = true;
    }),
    location: {
      set href(value: string) {
        events.push('navigate');
        navigated.push(value);
      },
      get href(): string {
        throw new Error('The address of a page of another origin is never read');
      },
    },
  };
  return { win, navigated };
}

function Arrived() {
  const location = useLocation();
  return <p data-testid="arrived">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(entry = `/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY_ID}`, { kindPage = true }: { kindPage?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/app/short-rent/onboarding/panel/:kind" element={kindPage ? <OnboardingPanelStepPage /> : <Arrived />} />
            <Route path="/app/short-rent/onboarding/panel" element={<OnboardingPanelResumePage />} />
            <Route path="*" element={<Arrived />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { ...view, client };
}

const phase = () => screen.getByTestId('panel-step').getAttribute('data-phase');
const press = (testId: string) => fireEvent.click(screen.getByTestId(testId));

function assistRequest(overrides: Partial<AssistRequest> = {}): AssistRequest {
  return {
    id: 'r1',
    part: 'compliance',
    propertyId: PROPERTY_ID,
    context: 'panelPolice',
    status: 'Requested',
    requestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    staffNote: null,
    activityId: 'a2',
    ...overrides,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  events.length = 0;
  server = panelStep();
  vi.mocked(onboardingApi.listPanelSteps).mockReset().mockResolvedValue([]);
  vi.mocked(onboardingApi.getPanelStepStatus)
    .mockReset()
    .mockImplementation(() => Promise.resolve(server));
  vi.mocked(onboardingApi.verifyPanelStep)
    .mockReset()
    .mockImplementation(() => Promise.resolve(server));
  vi.mocked(onboardingApi.confirmPanelStep)
    .mockReset()
    .mockImplementation(() => {
      server = { ...server, status: 'confirmed', canConfirm: false, completedAt: new Date().toISOString() };
      return Promise.resolve(server);
    });
  vi.mocked(onboardingApi.completePanelStepCallback).mockReset();
  vi.mocked(onboardingApi.startPanelStep)
    .mockReset()
    .mockImplementation(() => {
      events.push('start');
      const started: StartedPanelStep = { ...server, panelUrl: PANEL_URL, callbackUrl: null };
      return Promise.resolve(started);
    });
  vi.mocked(onboardingApi.listAssistRequests).mockReset().mockResolvedValue([]);
  vi.mocked(onboardingApi.requestAssist).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

async function openPanel() {
  const { win, navigated } = fakeWindow();
  vi.spyOn(window, 'open').mockImplementation(() => {
    events.push('open');
    return win as unknown as Window;
  });
  const { client } = renderPage();
  await screen.findByTestId('panel-step-open');
  press('panel-step-open');
  await waitFor(() => expect(phase()).toBe('waiting'));
  return { win, navigated, client };
}

describe('OctoratePanelStep, the guided passage to the panel of the channel manager (NF-107)', () => {
  describe('the first screen', () => {
    it('OctoratePanelStep_FirstVisit_ExplainsWhatHappensWithNumberedInstructionsAndOneAction', async () => {
      renderPage();

      const step = await screen.findByTestId('panel-step');

      expect(step).toHaveAttribute('data-phase', 'explain');
      expect(within(step).getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.panel.state.explain.title'));
      expect(step).toHaveTextContent(i18n.t('onboardingPlan.panel.state.explain.body'));
      expect(screen.getByTestId('panel-step-need')).toHaveTextContent(i18n.t('onboardingPlan.needs.alloggiatiCredentials'));
      expect(within(screen.getByTestId('panel-step-instructions')).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.getByTestId('panel-step-instruction-1')).toHaveTextContent(i18n.t('onboardingPlan.panel.police.steps.1'));
      expect(screen.queryAllByRole('img')).toHaveLength(0);
      // The credentials are typed on the panel only; the channel manager is never named; «Fallo per me» is there from the start.
      expect(screen.getByTestId('panel-step-credentials-note')).toHaveTextContent(i18n.t('onboardingPlan.panel.explain.credentialsNote'));
      expect(step.textContent ?? '').not.toMatch(/octorate/i);
      expect(screen.getByTestId('assist-request-button')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.action.doItForMe'));
      expect(screen.getByTestId('panel-step-save-exit')).toBeInTheDocument();
      expect(onboardingApi.startPanelStep).not.toHaveBeenCalled();
    });

    it('OctoratePanelStep_FirstScreen_HasNoViolationThatAxeCanFindWithoutABrowser', async () => {
      const { container } = renderPage();
      await screen.findByTestId('panel-step');

      await expectNoAxeViolations(container);
    });

    it('OctoratePanelStep_NotTheOrganizationAdministrator_IsToldWhoDoesTheStepAndAsksNothingOfTheServer', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();

      expect(await screen.findByTestId('panel-step-admin-only')).toHaveTextContent(i18n.t('onboardingPlan.panel.adminOnly'));
      expect(screen.queryByTestId('panel-step')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(onboardingApi.listPanelSteps).not.toHaveBeenCalled();
      expect(onboardingApi.startPanelStep).not.toHaveBeenCalled();
    });

    it('OnboardingPanelStepPage_UnknownKind_LeadsBackToThePlan', async () => {
      renderPage('/app/short-rent/onboarding/panel/telepathy');

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding');
    });
  });

  describe('the passage to the panel', () => {
    it('OctoratePanelStep_ManagedHandoffNeverLosesWizard_Test', async () => {
      const { win, navigated } = await openPanel();

      expect(events).toEqual(['open', 'start', 'navigate']);
      expect(navigated).toEqual([PANEL_URL]);
      expect(onboardingApi.startPanelStep).toHaveBeenCalledWith(expect.objectContaining({ kind: 'policeConnection', propertyId: PROPERTY_ID }));

      expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.waiting.title'));
      expect(screen.getByTestId('panel-step-context')).toHaveTextContent('Casa del Mare');
      expect(screen.getByTestId('panel-step-open')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.reopen'));
      expect(screen.getByTestId('panel-step-save-exit')).toBeInTheDocument();
      expect(screen.getByTestId('assist-request-button')).toBeInTheDocument();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();

      server = panelStep({ lastVerificationOutcome: null, canConfirm: false });
      act(() => {
        win.closed = true;
      });
      await waitFor(() => expect(onboardingApi.verifyPanelStep).toHaveBeenCalledTimes(1), { timeout: 4000 });
      expect(phase()).toBe('waiting');
      expect(screen.queryByTestId('panel-step-confirm')).not.toBeInTheDocument();
    });

    it('OctoratePanelStep_VerifiedStatusAfterTheTabComesBack_AdvancesByItselfAndClosesTheWindow', async () => {
      const { win } = await openPanel();

      server = panelStep({ status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString(), activityId: null });
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(onboardingApi.verifyPanelStep).toHaveBeenCalledTimes(1);
      expect(win.close).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
      expect(onboardingApi.confirmPanelStep).not.toHaveBeenCalled();
    });

    it('OctoratePanelStep_AccessToAChannelStartedByTheWizard_GoesBackToTheStepOfTheWizardAndNotToThePart', async () => {
      server = panelStep({
        kind: 'channelAccess',
        propertyId: null,
        channelCode: 'booking_xml',
        instructionsKey: 'panelChannelAccess',
        resume: { wizardType: 'OnboardingActivation', draftEntityId: 'batch-1', stepCode: 'existingInventoryAccess' },
      });
      const { win } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      renderPage('/app/short-rent/onboarding/panel/channel-access?channelCode=booking_xml');
      await screen.findByTestId('panel-step-open');
      press('panel-step-open');
      await waitFor(() => expect(phase()).toBe('waiting'));

      server = { ...server, status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString(), activityId: null };
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/integrations/octorate?step=existing-channels');
      expect(screen.getByTestId('arrived')).not.toHaveTextContent(partPath('channels'));
    });

    it('OctoratePanelStep_AccessToAChannelStartedByTheActivationWizardOfTheMarketplace_GoesBackToItsAccessStepForThePropertyAndTheChannel', async () => {
      server = panelStep({
        kind: 'channelAccess',
        propertyId: PROPERTY_ID,
        channelCode: '142',
        instructionsKey: 'panelChannelAccess',
        resume: { wizardType: 'OnboardingActivation', draftEntityId: null, stepCode: 'marketplaceActivationChannel' },
      });
      const { win } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      renderPage(`/app/short-rent/onboarding/panel/channel-access?propertyId=${PROPERTY_ID}&channelCode=142`);
      await screen.findByTestId('panel-step-open');
      press('panel-step-open');
      await waitFor(() => expect(phase()).toBe('waiting'));

      server = { ...server, status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString(), activityId: null };
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await screen.findByTestId('arrived')).toHaveTextContent(`/app/short-rent/marketplace/activate/channel/142?propertyId=${PROPERTY_ID}&step=access`);
      expect(screen.getByTestId('arrived')).not.toHaveTextContent(partPath('channels'));
    });

    it('OctoratePanelStep_PoliceConnectionStartedByTheSenderWizard_GoesBackToTheStepOfTheWizardForTheSameProperty', async () => {
      server = panelStep({
        kind: 'policeConnection',
        propertyId: PROPERTY_ID,
        channelCode: null,
        instructionsKey: 'panelPolice',
        resume: { wizardType: 'ComplianceSender', draftEntityId: PROPERTY_ID, stepCode: 'panel' },
      });
      const { win } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      renderPage(`/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY_ID}`);
      await screen.findByTestId('panel-step-open');
      press('panel-step-open');
      await waitFor(() => expect(phase()).toBe('waiting'));

      server = { ...server, status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString(), activityId: null };
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await screen.findByTestId('arrived')).toHaveTextContent(`/app/short-rent/compliance/sender?property=${PROPERTY_ID}&step=panel`);
      expect(screen.getByTestId('arrived')).not.toHaveTextContent(partPath('compliance'));
    });

    it('OctoratePanelStep_ResultCasaZenCannotTell_AsksTheQuestionOnlyAfterTheWindowClosedAndNeverBefore', async () => {
      const { win } = await openPanel();

      server = panelStep({ lastVerificationOutcome: 'unverifiable', canConfirm: true });
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
      });
      expect(phase()).toBe('waiting');
      expect(screen.queryByTestId('panel-step-confirm')).not.toBeInTheDocument();

      act(() => {
        win.closed = true;
      });
      await waitFor(() => expect(phase()).toBe('unverifiable'), { timeout: 4000 });
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.panel.state.unverifiable.title'));
      expect(screen.getByTestId('panel-step-confirm')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.confirmYes'));
      expect(screen.getByTestId('panel-step-no-reopen')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.confirmNo'));
      expect(screen.getByTestId('assist-request-help')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.action.needHelp'));
      expect(onboardingApi.confirmPanelStep).not.toHaveBeenCalled();

      press('panel-step-confirm');
      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(onboardingApi.confirmPanelStep).toHaveBeenCalledWith(STEP_ID);
    });

    it('OctoratePanelStep_ConfirmationTheServerRefuses_SaysWhyAndStaysOnTheQuestion', async () => {
      server = panelStep({ lastVerificationOutcome: 'unverifiable', canConfirm: true });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.confirmPanelStep).mockRejectedValue(problemError(409, { code: 'panel_step_assist_open', detail: 'Il supporto se ne sta occupando.' }));
      renderPage();

      await waitFor(() => expect(phase()).toBe('unverifiable'));
      press('panel-step-confirm');

      expect(await screen.findByTestId('panel-step-confirm-error')).toBeInTheDocument();
      expect(phase()).toBe('unverifiable');
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
    });

    it('OctoratePanelStep_ResultNotValid_SaysWhatToCheckAndOffersThePanelAgain', async () => {
      server = panelStep({ status: 'notValid', lastVerificationOutcome: 'notValid' });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      renderPage();

      await waitFor(() => expect(phase()).toBe('notValid'));
      expect(screen.getByTestId('panel-step-not-valid')).toHaveTextContent(i18n.t('onboardingPlan.panel.police.notValid'));
      expect(screen.getByTestId('panel-step-open')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.reopen'));
      expect(screen.queryByTestId('panel-step-confirm')).not.toBeInTheDocument();
    });

    it('OctoratePanelStep_BrowserBlocksTheWindow_StaysOnTheStoredStepAndAsksToAllowItNeverOnADeadPage', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      renderPage();

      press('panel-step-open');

      await waitFor(() => expect(phase()).toBe('started'));
      expect(open).toHaveBeenCalledTimes(1);
      expect(onboardingApi.startPanelStep).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['start']);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.panel.state.started.title'));
      expect(screen.getByTestId('panel-step-blocked')).toHaveTextContent(i18n.t('onboardingPlan.panel.started.alert'));
      expect(screen.getByTestId('panel-step-open')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.retryOpen'));
    });

    it('OctoratePanelStep_StartRefused_ClosesTheBlankWindowAndSaysWhy', async () => {
      const { win } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      vi.mocked(onboardingApi.startPanelStep).mockRejectedValue(problemError(409, { code: 'octorate_panel_url_missing', detail: 'L\'indirizzo del pannello non è configurato.' }));
      renderPage();

      press('panel-step-open');

      expect(await screen.findByTestId('panel-step-error')).toBeInTheDocument();
      expect(win.close).toHaveBeenCalled();
      expect(phase()).toBe('explain');
    });

    it('OctoratePanelStep_PanelThatSendsThePersonBack_GoesTheSameTabAndNeverOpensAWindowForGood', async () => {
      const { win } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      const assign = vi.fn();
      vi.stubGlobal('location', { ...window.location, assign });
      vi.mocked(onboardingApi.startPanelStep).mockImplementation(() => {
        events.push('start');
        return Promise.resolve({ ...server, handoffMode: 'redirectCallback', panelUrl: PANEL_URL, callbackUrl: 'https://app.casazen.test/cb?step=x&state=y' });
      });
      renderPage();

      press('panel-step-open');

      await waitFor(() => expect(assign).toHaveBeenCalledWith(PANEL_URL));
      expect(win.close).toHaveBeenCalled();
    });
  });

  describe('OctoratePanelStep_OpensPanelWithoutQueryData_Test', () => {
    it('OctoratePanelStep_OpensPanelWithoutQueryData_Test', async () => {
      const { win, navigated } = await openPanel();

      expect(navigated).toEqual([PANEL_URL]);
      expect(navigated[0]).not.toContain('?');
      expect(navigated[0]).not.toContain(PROPERTY_ID);
      expect(navigated[0]).not.toContain(STEP_ID);
      expect(vi.mocked(window.open).mock.calls[0]?.[0]).toBe('');
      expect(win.opener).toBeNull();
      expect(win.focus).toHaveBeenCalled();
    });

    it('OctoratePanelStep_AddressThatIsNotHttps_IsNeverFollowed', async () => {
      const { win, navigated } = fakeWindow();
      vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window);
      vi.mocked(onboardingApi.startPanelStep).mockResolvedValue({ ...server, panelUrl: 'javascript:alert(1)', callbackUrl: null });
      renderPage();

      press('panel-step-open');

      expect(await screen.findByTestId('panel-step-error')).toBeInTheDocument();
      expect(navigated).toEqual([]);
      expect(win.close).toHaveBeenCalled();
    });
  });

  describe('the return from a panel that sends the person back', () => {
    it('OnboardingPanelStepPage_CallbackInTheAddress_UsesTheStateOnceInTheBodyAndGoesOnByItself', async () => {
      server = panelStep();
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.completePanelStepCallback).mockImplementation(() => {
        server = panelStep({ status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString() });
        return Promise.resolve(server);
      });
      renderPage(`/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY_ID}&step=${STEP_ID}&state=one-time-state`);

      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(onboardingApi.completePanelStepCallback).toHaveBeenCalledTimes(1);
      expect(onboardingApi.completePanelStepCallback).toHaveBeenCalledWith(STEP_ID, 'one-time-state');
    });

    it('OnboardingPanelStepPage_CallbackTheServerRefuses_SaysItAndOffersThePanelAgain', async () => {
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.completePanelStepCallback).mockRejectedValue(problemError(422, { code: 'panel_step_state_invalid', detail: 'Il ritorno dal pannello non è valido.' }));
      renderPage(`/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY_ID}&step=${STEP_ID}&state=old`);

      expect(await screen.findByTestId('panel-step-callback-error')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('panel-step-open')).toBeInTheDocument());
    });

    it('OnboardingPanelResumePage_StepOfTheTodo_OpensThePageOfItsKindWithItsPropertyAndChannel', async () => {
      const channelStep = panelStep({ kind: 'channelAccess', channelCode: 'airbnb_xml', propertyId: null, instructionsKey: 'panelChannelAccess' });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([channelStep]);

      renderPage(`/app/short-rent/onboarding/panel?step=${STEP_ID}`, { kindPage: false });

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding/panel/channel-access?channelCode=airbnb_xml');
    });

    it('OnboardingPanelResumePage_StepThatNoLongerExists_LeadsBackToThePlan', async () => {
      renderPage(`/app/short-rent/onboarding/panel?step=${STEP_ID}`);

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding');
    });
  });

  describe('«Fallo per me»', () => {
    it('AssistRequestButton_Pressed_AsksSupportForThePartAndThePropertyAndShowsWhereTheRequestStands', async () => {
      vi.mocked(onboardingApi.requestAssist).mockImplementation(() => {
        const created = assistRequest();
        vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([created]);
        return Promise.resolve(created);
      });
      renderPage();

      press('assist-request-button');

      await waitFor(() => expect(screen.getByTestId('assist-request-status')).toHaveAttribute('data-status', 'Requested'));
      expect(onboardingApi.requestAssist).toHaveBeenCalledWith({ part: 'compliance', context: 'panelPolice', propertyId: PROPERTY_ID, channelCode: undefined });
      expect(screen.getByTestId('assist-request-status')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.status.Requested'));
      expect(screen.getByTestId('assist-request-todo-link')).toHaveAttribute('href', '/app/short-rent/activities');
      // The request is shown instead of the button: a second one cannot be sent from here.
      expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
    });

    it('AssistRequestButton_RequestAlreadyOpen_IsShownAsTheExistingOneNeverAsAFailure', async () => {
      vi.mocked(onboardingApi.requestAssist).mockImplementation(() => {
        vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'InProgress' })]);
        return Promise.reject(problemError(409, { code: 'assist_request_already_open', detail: 'Hai già una richiesta aperta.' }));
      });
      renderPage();

      press('assist-request-button');

      await waitFor(() => expect(screen.getByTestId('assist-request-status')).toHaveAttribute('data-status', 'InProgress'));
      expect(screen.queryByTestId('assist-request-error')).not.toBeInTheDocument();
    });

    it('AssistRequestButton_OpenRequestFromAnotherVisit_IsShownFromTheStart', async () => {
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'InProgress' })]);
      renderPage();

      expect(await screen.findByTestId('assist-request-status')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.status.InProgress'));
      expect(screen.queryByTestId('assist-request-button')).not.toBeInTheDocument();
    });
  });

  describe('the outcome of a request support closed', () => {
    const doneAt = '2026-11-13T09:00:00Z';

    it('OctoratePanelStep_StepDoneBecauseSupportDeclaredIt_SaysWhoseWordItIsAndNeverThatCasaZenChecked', async () => {
      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'declared' })]);
      renderPage();

      const outcome = await screen.findByTestId('assist-outcome');
      await waitFor(() => expect(phase()).toBe('recovered'));

      // The step is done by the word of the support: the state says so, instead of «CasaZen ha verificato il collegamento».
      const step = screen.getByTestId('panel-step');
      expect(step).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.title'));
      expect(step).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.body'));
      expect(step).not.toHaveTextContent(i18n.t('onboardingPlan.panel.state.recovered.title'));
      expect(step.textContent ?? '').not.toMatch(/octorate/i);
      expect(outcome).toHaveAttribute('data-outcome', 'declared');
      expect(outcome).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.outcome.declared.title'));
      expect(within(outcome).getByTestId('assist-reopen')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.notWorking.action'));
    });

    it('OctoratePanelStep_StepDoneBecauseCasaZenReadItOnThePanel_IsToldVerified', async () => {
      server = panelStep({ status: 'verified', lastVerificationOutcome: 'verified', completedAt: doneAt });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'verified' })]);
      renderPage();

      const outcome = await screen.findByTestId('assist-outcome');
      await waitFor(() => expect(phase()).toBe('recovered'));

      expect(outcome).toHaveAttribute('data-outcome', 'verified');
      expect(outcome).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.outcome.verified.title'));
      expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recovered.title'));
      expect(screen.getByTestId('panel-step')).not.toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.title'));
    });

    it('OctoratePanelStep_ConfirmedByThePersonWithNoRequestOfSupport_KeepsItsOwnWordsAndShowsNoOutcome', async () => {
      server = panelStep({ status: 'confirmed', completedAt: doneAt });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      renderPage();

      await waitFor(() => expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recovered.title')));

      expect(phase()).toBe('recovered');
      expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
    });

    // The live notice reads the steps and the requests at the same time, and the page stays open while support closes the request.
    it('OctoratePanelStep_SupportDeclaresTheStepWhileThePageIsOpen_PopUpSaysItIsTheWordOfSupportAndThePageDoesNotGoOnByItself', async () => {
      const { win, client } = await openPanel();

      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt, activityId: null });
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'declared' })]);
      act(() => applyNotificationsChange(client, { unreadCount: 1, type: 'assist-declared', entityId: 'r1' }));

      const outcome = await screen.findByTestId('assist-outcome');
      await waitFor(() => expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.title')));
      expect(phase()).toBe('recovered');
      expect(outcome).toHaveAttribute('data-outcome', 'declared');
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recoveredDeclared.toast')));
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
      expect(win.close).toHaveBeenCalled();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
      expect(within(outcome).getByTestId('assist-reopen')).toBeInTheDocument();
      press('panel-step-continue');
      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
    });

    it('OctoratePanelStep_TheStepArrivesBeforeTheRequestSupportClosed_SaysNothingOfHowItWasClosedAndSaysNoPopUpUntilTheRequestIsRead', async () => {
      const { client } = await openPanel();
      const releases: Array<(requests: AssistRequest[]) => void> = [];
      vi.mocked(onboardingApi.listAssistRequests).mockImplementation(
        () =>
          new Promise<AssistRequest[]>((resolve) => {
            releases.push(resolve);
          }),
      );
      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt, activityId: null });
      act(() => applyNotificationsChange(client, { unreadCount: 1, type: 'assist-declared', entityId: 'r1' }));

      await waitFor(() => expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredUnknown.title')));
      expect(phase()).toBe('recovered');
      expect(screen.getByTestId('panel-step')).not.toHaveTextContent(i18n.t('onboardingPlan.panel.state.recovered.title'));
      expect(screen.getByTestId('panel-step')).not.toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.title'));
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();

      act(() => {
        for (const release of releases) release([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'declared' })]);
      });
      await waitFor(() => expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredDeclared.title')));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recoveredDeclared.toast')));
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
    });

    it('OctoratePanelStep_TheRequestsCannotBeRead_AStepSomebodyConfirmedIsToldNeitherCheckedNorDeclaredAndTheWindowIsNotLeftByItself', async () => {
      const { client } = await openPanel();
      vi.mocked(onboardingApi.listAssistRequests).mockRejectedValue(problemError(500, {}));
      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt, activityId: null });
      act(() => applyNotificationsChange(client, { unreadCount: 1, type: 'assist-declared', entityId: 'r1' }));

      await waitFor(() => expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.recoveredUnknown.title')));
      expect(screen.getByTestId('panel-step')).not.toHaveTextContent(i18n.t('onboardingPlan.panel.state.recovered.title'));
      expect(screen.getByTestId('panel-step-continue')).toBeEnabled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
    });

    it('OctoratePanelStep_AStepSupportDeclaredIsReopenedAndThenVerified_IsToldAndFollowedAgainAndGoesOnByItself', async () => {
      const { client } = await openPanel();
      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt, activityId: null });
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'declared' })]);
      act(() => applyNotificationsChange(client, { unreadCount: 1, type: 'assist-declared', entityId: 'r1' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recoveredDeclared.toast')));

      server = panelStep({ status: 'assistRequested', lastVerificationOutcome: 'unverifiable', activityId: 'a1' });
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Requested', hostNote: 'Il portale dice ancora che manca il collegamento.', reopenedAt: doneAt })]);
      act(() => {
        void client.invalidateQueries({ queryKey: ['onboarding'] });
      });
      await waitFor(() => expect(phase()).toBe('assist'));

      server = panelStep({ status: 'verified', lastVerificationOutcome: 'verified', completedAt: doneAt, activityId: null });
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'verified' })]);
      act(() => applyNotificationsChange(client, { unreadCount: 2, type: 'assist-verified', entityId: 'r1' }));

      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
    });

    it('OctoratePanelStep_ConfirmedByThePersonWhileThePageIsOpen_GoesOnByItselfWithTheWordsOfACheckOnceTheRequestsAreRead', async () => {
      const { win } = await openPanel();

      server = panelStep({ status: 'confirmed', lastVerificationOutcome: 'unverifiable', completedAt: doneAt, activityId: null });
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(win.close).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
      expect(toast.success).not.toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recoveredDeclared.toast'));
    });

    it('AssistRequestButton_RequestClosedForAStepThatIsNotDoneAnyMore_TellsNothingOfThePast', async () => {
      server = panelStep({ status: 'started' });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Done', completedAt: doneAt, outcome: 'verified' })]);
      renderPage();

      expect(await screen.findByTestId('assist-request-button')).toBeInTheDocument();
      expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
    });

    it('AssistRequestButton_RequestCancelledForADoneStep_IsNoOutcome', async () => {
      server = panelStep({ status: 'confirmed', completedAt: doneAt });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.listAssistRequests).mockResolvedValue([assistRequest({ status: 'Cancelled', completedAt: doneAt })]);
      renderPage();

      await waitFor(() => expect(phase()).toBe('recovered'));
      expect(screen.queryByTestId('assist-outcome')).not.toBeInTheDocument();
    });
  });
});

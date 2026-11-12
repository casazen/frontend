import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
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
// The page is behind the flag: «Fallo per me» is there while it is on.
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true }, isLoading: false }) }));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const STEP_ID = '5b0c8b8e-6f1d-4a43-9b62-0f6f7d2f8a11';
const PROPERTY_ID = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const PANEL_URL = 'https://panel.channel-manager.test/';

/** The state of the step as the server holds it: the mocks answer from it, a test changes it to say what the server found. */
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

/** What happened, in order: the window opened, the step stored, the window sent to the panel. */
const events: string[] = [];

/** The secondary window: its address is written and never read, as for a page of another origin. */
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
  return render(
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

/** Opens the panel from the first screen and waits for the waiting state: what the person does first. */
async function openPanel() {
  const { win, navigated } = fakeWindow();
  vi.spyOn(window, 'open').mockImplementation(() => {
    events.push('open');
    return win as unknown as Window;
  });
  renderPage();
  await screen.findByTestId('panel-step-open');
  press('panel-step-open');
  await waitFor(() => expect(phase()).toBe('waiting'));
  return { win, navigated };
}

describe('OctoratePanelStep, the guided passage to the panel of the channel manager (NF-107)', () => {
  describe('the first screen', () => {
    it('OctoratePanelStep_FirstVisit_ExplainsWhatHappensWithNumberedInstructionsAndOneAction', async () => {
      renderPage();

      const step = await screen.findByTestId('panel-step');

      expect(step).toHaveAttribute('data-phase', 'explain');
      expect(within(step).getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.panel.state.explain.title'));
      expect(step).toHaveTextContent(i18n.t('onboardingPlan.panel.state.explain.body'));
      // What to have at hand, and the instructions: brief, numbered, one sentence each.
      expect(screen.getByTestId('panel-step-need')).toHaveTextContent(i18n.t('onboardingPlan.needs.alloggiatiCredentials'));
      expect(within(screen.getByTestId('panel-step-instructions')).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.getByTestId('panel-step-instruction-1')).toHaveTextContent(i18n.t('onboardingPlan.panel.police.steps.1'));
      // No picture is supplied yet: the numbered text stands alone and there is no broken image.
      expect(screen.queryAllByRole('img')).toHaveLength(0);
      // The credentials are typed on the panel only; the channel manager is never named; «Fallo per me» is there from the start.
      expect(screen.getByTestId('panel-step-credentials-note')).toHaveTextContent(i18n.t('onboardingPlan.panel.explain.credentialsNote'));
      expect(step.textContent ?? '').not.toMatch(/octorate/i);
      expect(screen.getByTestId('assist-request-button')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.action.doItForMe'));
      expect(screen.getByTestId('panel-step-save-exit')).toBeInTheDocument();
      // Nothing was stored or opened before the person asked.
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

      // Stored first, opened after: the window was opened blank from the click, the step was stored, then the window was sent to the panel.
      expect(events).toEqual(['open', 'start', 'navigate']);
      expect(navigated).toEqual([PANEL_URL]);
      expect(onboardingApi.startPanelStep).toHaveBeenCalledWith(expect.objectContaining({ kind: 'policeConnection', propertyId: PROPERTY_ID }));

      // CasaZen stays on the waiting step, with where it is, and offers the ways out: reopen, save and exit, do it for me.
      expect(screen.getByTestId('panel-step')).toHaveTextContent(i18n.t('onboardingPlan.panel.state.waiting.title'));
      expect(screen.getByTestId('panel-step-context')).toHaveTextContent('Casa del Mare');
      expect(screen.getByTestId('panel-step-open')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.reopen'));
      expect(screen.getByTestId('panel-step-save-exit')).toBeInTheDocument();
      expect(screen.getByTestId('assist-request-button')).toBeInTheDocument();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();

      // Back in the tab with the check still saying nothing: no manual confirmation, whatever the window did.
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

      // The person is on the panel from the moment the window is sent to it (the `blur` of the click came before the step was followed, and is not waited
      // for); they come back to the tab: one check is asked, and the server has seen the connection.
      server = panelStep({ status: 'verified', lastVerificationOutcome: 'verified', completedAt: new Date().toISOString(), activityId: null });
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // No «Controlla ora» is pressed: the page goes to the part the step belongs to.
      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(onboardingApi.verifyPanelStep).toHaveBeenCalledTimes(1);
      expect(win.close).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.panel.state.recovered.toast'));
      expect(onboardingApi.confirmPanelStep).not.toHaveBeenCalled();
    });

    it('OctoratePanelStep_ResultCasaZenCannotTell_AsksTheQuestionOnlyAfterTheWindowClosedAndNeverBefore', async () => {
      const { win } = await openPanel();

      // While the person is still on the panel an «unverifiable» answer exposes nothing to press.
      server = panelStep({ lastVerificationOutcome: 'unverifiable', canConfirm: true });
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
      });
      expect(phase()).toBe('waiting');
      expect(screen.queryByTestId('panel-step-confirm')).not.toBeInTheDocument();

      // The window closes: now the check can say it cannot tell, and the person is asked.
      act(() => {
        win.closed = true;
      });
      await waitFor(() => expect(phase()).toBe('unverifiable'), { timeout: 4000 });
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.panel.state.unverifiable.title'));
      expect(screen.getByTestId('panel-step-confirm')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.confirmYes'));
      expect(screen.getByTestId('panel-step-no-reopen')).toHaveTextContent(i18n.t('onboardingPlan.panel.actions.confirmNo'));
      expect(screen.getByTestId('assist-request-help')).toHaveTextContent(i18n.t('onboardingPlan.panel.assist.action.needHelp'));
      expect(onboardingApi.confirmPanelStep).not.toHaveBeenCalled();

      // «Sì, continua» is the person's word, and it takes them to the part.
      press('panel-step-confirm');
      expect(await screen.findByTestId('arrived')).toHaveTextContent(partPath('compliance'));
      expect(onboardingApi.confirmPanelStep).toHaveBeenCalledWith(STEP_ID);
    });

    it('OctoratePanelStep_ConfirmationTheServerRefuses_SaysWhyAndStaysOnTheQuestion', async () => {
      server = panelStep({ lastVerificationOutcome: 'unverifiable', canConfirm: true });
      vi.mocked(onboardingApi.listPanelSteps).mockResolvedValue([server]);
      vi.mocked(onboardingApi.confirmPanelStep).mockRejectedValue(problemError(409, { code: 'panel_step_assist_open', detail: 'Il supporto se ne sta occupando.' }));
      renderPage();

      // A step that was started on another visit and cannot be read by CasaZen: the person is asked at once.
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
      // The step is stored all the same, and nothing external was reached.
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
      // The blank window of the click is not needed: it is closed, and the stored step leaves with the person.
      expect(win.close).toHaveBeenCalled();
    });
  });

  describe('OctoratePanelStep_OpensPanelWithoutQueryData_Test', () => {
    it('OctoratePanelStep_OpensPanelWithoutQueryData_Test', async () => {
      const { win, navigated } = await openPanel();

      // Exactly the address the server returned: nothing appended, so no organization, property or person travels to the panel.
      expect(navigated).toEqual([PANEL_URL]);
      expect(navigated[0]).not.toContain('?');
      expect(navigated[0]).not.toContain(PROPERTY_ID);
      expect(navigated[0]).not.toContain(STEP_ID);
      // The window of the click is blank (nothing of CasaZen in its address) and cannot reach back to CasaZen.
      expect(vi.mocked(window.open).mock.calls[0]?.[0]).toBe('');
      expect(win.opener).toBeNull();
      // The page of the panel is never read: its address is written, never read (the getter of the fake throws), and nothing else of it is touched.
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
      // The state travels in the body and only once.
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
});

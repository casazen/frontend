import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { ONBOARDING_PART_KEYS, type OnboardingPart, type OnboardingPartKey } from '@/types/onboarding.types';
import { partPath, partTitleKey } from '@/lib/onboarding-parts';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock } from '@/test/clock';
import { OnboardingPlanPage } from '../onboarding-plan-page';
import { COLLABORATOR, OWNER, part, plan, problemError } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getPlan: vi.fn(), deferPart: vi.fn(), exitPart: vi.fn(), resumePart: vi.fn(), getStatus: vi.fn(), getPath: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
// The header is the shell's: the page hands it its title, its line and the two buttons that are always on screen.
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', { 'data-testid': 'page-description' }, description) : null, action),
}));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const support = vi.hoisted(() => ({ email: 'aiuto@casazen.test' as string | null }));
vi.mock('@/config/support.config', () => ({
  supportConfig: {
    get email() {
      return support.email;
    },
  },
}));

function Arrived() {
  return <p data-testid="arrived">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/short-rent/onboarding']}>
          <Routes>
            <Route path="/app/short-rent/onboarding" element={<OnboardingPlanPage />} />
            <Route path="*" element={<Arrived />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

async function rows(): Promise<HTMLElement[]> {
  const list = await screen.findByTestId('onboarding-plan-parts');
  return Array.from(list.children) as HTMLElement[];
}

const row = (code: OnboardingPartKey) => screen.getByTestId(`onboarding-part-${code}`);

describe('OnboardingPlanPage, the plan «Inizia con CasaZen» (NF-104)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    support.email = 'aiuto@casazen.test';
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    vi.mocked(onboardingApi.deferPart).mockReset();
    vi.mocked(onboardingApi.exitPart).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('what it shows', () => {
    it('OnboardingPlan_LoadedPlan_ListsTheElevenPartsInOrderWithTheirTitle', async () => {
      renderPage();

      const list = await rows();

      expect(list.map((item) => item.dataset.testid)).toEqual(ONBOARDING_PART_KEYS.map((code) => `onboarding-part-${code}`));
      expect(list.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual(
        ONBOARDING_PART_KEYS.map((code) => i18n.t(partTitleKey(code))),
      );
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('onboardingPlan.title'));
      expect(screen.getByTestId('page-description')).toHaveTextContent(i18n.t('onboardingPlan.description'));
    });

    it('OnboardingPlan_Part_ShowsItsStateInWordsWithProgressAndTheReasonInPlainWords', async () => {
      renderPage();
      await rows();

      const properties = row('properties');
      expect(within(properties).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.open'));
      expect(within(properties).getByTestId('onboarding-part-progress')).toHaveTextContent(i18n.t('onboardingPlan.progress', { done: 1, total: 3 }));
      expect(within(properties).getByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.mapping_unconfirmed'));

      expect(within(row('octorateConnection')).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.done'));
      // A part that is done has nothing left to say: no reason, no button.
      expect(within(row('octorateConnection')).queryByTestId('onboarding-part-reason')).not.toBeInTheDocument();
      expect(within(row('octorateConnection')).queryByRole('link')).not.toBeInTheDocument();
      expect(within(row('octorateConnection')).queryByRole('button')).not.toBeInTheDocument();
    });

    it('OnboardingPlan_Needs_ListsTheFiveThingsTheHostShouldHaveAtHand', async () => {
      renderPage();
      await rows();

      const needs = screen.getByTestId('onboarding-needs');

      expect(within(needs).getByRole('heading', { level: 2 })).toHaveTextContent(i18n.t('onboardingPlan.needsPanel.title'));
      expect(within(needs).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
        ['alloggiatiCredentials', 'istatCredentials', 'fiscalData', 'otaAccess', 'lockCode'].map((code) => i18n.t(`onboardingPlan.needs.${code}`)),
      );
    });

    it('OnboardingPlan_FirstOpenPart_IsTheOneHighlightedBlockAndNoOtherIs', async () => {
      renderPage();
      const list = await rows();

      const highlighted = list.filter((item) => item.dataset.highlighted === 'true');

      expect(highlighted.map((item) => item.dataset.testid)).toEqual(['onboarding-part-properties']);
    });

    it('OnboardingPlan_NoOpenPart_HighlightsNothing', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ properties: { state: 'done' }, identification: { state: 'deferred' } }));
      renderPage();
      const list = await rows();

      expect(list.some((item) => item.dataset.highlighted === 'true')).toBe(false);
    });

    it('OnboardingPlan_PartWithAnUnknownCode_IsLeftOutAndNeverShownAsABareKey', async () => {
      const unknown = { ...part('partners'), code: 'quantumLedger' as OnboardingPartKey, order: 12 };
      vi.mocked(onboardingApi.getPlan).mockResolvedValue({ ...plan(), parts: [...plan().parts, unknown] });
      renderPage();

      const list = await rows();

      expect(list).toHaveLength(11);
      expect(document.body.textContent).not.toContain('quantumLedger');
    });

    it('OnboardingPlan_UnknownStateAndReason_FallBackToANeutralTextNotToTheCode', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(
        plan({ identification: { state: 'inProgress' as OnboardingPart['state'], reason: 'something_new' as OnboardingPart['reason'] } }),
      );
      renderPage();
      await rows();

      const identification = row('identification');

      expect(within(identification).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.open'));
      expect(within(identification).getByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.unknown'));
      expect(identification.textContent).not.toContain('something_new');
      expect(identification.textContent).not.toContain('inProgress');
    });
  });

  describe('the actions of a part', () => {
    it('OnboardingPlan_OpenPart_OffersDoItNowAsALinkToItsPage', async () => {
      renderPage();
      await rows();

      const identification = row('identification');
      const link = within(identification).getByRole('link', { name: new RegExp(`^${i18n.t('onboardingPlan.actions.doNow')}`) });

      expect(link).toHaveAttribute('href', partPath('identification'));
      expect(link).toHaveAttribute('href', '/app/short-rent/onboarding/parts/identification');
      expect(within(identification).getByRole('button', { name: new RegExp(`^${i18n.t('onboardingPlan.actions.later')}`) })).toBeEnabled();
    });

    it('OnboardingPlan_PartAlreadyStartedOrPutOff_OffersResumeInsteadOfDoItNow', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(
        plan({ identification: { state: 'deferred', remindAt: '2026-11-13T08:00:00Z', done: 0, total: 2 } }),
      );
      renderPage();
      await rows();

      // Started («1 di 3»): resume.
      expect(within(row('properties')).getByRole('link')).toHaveTextContent(i18n.t('onboardingPlan.actions.resume'));
      // Put off: resume, says until when (on the clock of Rome), and has nothing left to put off.
      const identification = row('identification');
      expect(within(identification).getByRole('link')).toHaveTextContent(i18n.t('onboardingPlan.actions.resume'));
      expect(within(identification).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.deferredUntil', { date: '13 novembre' }));
      expect(within(identification).queryByRole('button')).not.toBeInTheDocument();
    });

    it('OnboardingPlan_PartPutOffThatStillWaitsForAnotherPart_NamesItAndOffersNoWayIn', async () => {
      // The server gives «rimandato» precedence over «in attesa»: the listings were put off before the channels, which they need, were done.
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(
        plan({ listings: { state: 'deferred', reason: 'channel_content_to_fix', remindAt: '2026-11-13T08:00:00Z', done: 0, total: 2 } }),
      );
      renderPage();
      await rows();

      const listings = row('listings');

      expect(within(listings).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.deferredUntil', { date: '13 novembre' }));
      expect(within(listings).getByTestId('onboarding-part-reason')).toHaveTextContent(
        i18n.t('onboardingPlan.reasons.required_part_not_done', { parts: i18n.t(partTitleKey('channels')) }),
      );
      // Not «Riprendi»: it would lead to a part that cannot be done yet, as for a part that is blocked.
      expect(within(listings).queryByRole('link')).not.toBeInTheDocument();
      expect(within(listings).queryByRole('button')).not.toBeInTheDocument();
    });

    it('OnboardingPlan_PartPutOffWhoseRequiredPartsAreDone_OffersResumeAndKeepsItsOwnReason', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(
        plan({
          properties: { state: 'done' },
          channels: { state: 'done' },
          listings: { state: 'deferred', reason: 'channel_content_to_fix', remindAt: '2026-11-13T08:00:00Z', done: 0, total: 2 },
        }),
      );
      renderPage();
      await rows();

      const listings = row('listings');

      expect(within(listings).getByRole('link')).toHaveTextContent(i18n.t('onboardingPlan.actions.resume'));
      expect(within(listings).getByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.channel_content_to_fix'));
    });

    it('OnboardingPlan_PartNotAvailable_ShowsWhyAndNoButton', async () => {
      renderPage();
      await rows();

      const messages = row('messagesAi');

      expect(within(messages).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.notAvailable'));
      expect(within(messages).getByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.not_provided'));
      expect(within(messages).queryByRole('link')).not.toBeInTheDocument();
      expect(within(messages).queryByRole('button')).not.toBeInTheDocument();
    });

    it('OnboardingPlan_BlockedPart_NamesThePartsItWaitsForAndOffersNoWayIn', async () => {
      renderPage();
      await rows();

      // Activation waits for the two parts it requires that are not done: the connection is done, so only the properties.
      const activation = row('activation');
      expect(within(activation).getByTestId('onboarding-part-state')).toHaveTextContent(i18n.t('onboardingPlan.states.blocked'));
      expect(within(activation).getByTestId('onboarding-part-reason')).toHaveTextContent(
        i18n.t('onboardingPlan.reasons.required_part_not_done', { parts: i18n.t(partTitleKey('properties')) }),
      );
      expect(within(activation).queryByRole('link')).not.toBeInTheDocument();
    });

    it('OnboardingPlan_PartAnotherPartNeeds_DisablesLaterWithTheSentenceThatSaysWhy', async () => {
      renderPage();
      await rows();

      const properties = row('properties');
      const later = within(properties).getByRole('button', { name: new RegExp(`^${i18n.t('onboardingPlan.actions.later')}`) });

      expect(later).toBeDisabled();
      expect(within(properties).getByTestId('onboarding-part-properties-later-note')).toHaveTextContent(i18n.t('onboardingPlan.defer.notDeferrable'));
      expect(later).toHaveAccessibleDescription(i18n.t('onboardingPlan.defer.notDeferrable'));
    });
  });

  describe('«Lo faccio dopo»', () => {
    const later = () => within(row('identification')).getByRole('button', { name: new RegExp(`^${i18n.t('onboardingPlan.actions.later')}`) });

    it('Defer_Choices_AreThisEveningTomorrowAndInAWeekOnTheClockOfRome', async () => {
      // 11:00 in Rome (CET, UTC+1).
      freezeClock('2026-11-12T10:00:00Z');
      renderPage();
      await rows();

      fireEvent.click(later());

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('radio', { name: i18n.t('onboardingPlan.defer.options.evening') })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: i18n.t('onboardingPlan.defer.options.tomorrow') })).toBeChecked();
      expect(within(dialog).getByRole('radio', { name: i18n.t('onboardingPlan.defer.options.nextWeek') })).toBeInTheDocument();
    });

    it('Defer_Confirm_SendsTheChosenMomentToTheServerSaysWhereItWentAndClosesTheWindow', async () => {
      freezeClock('2026-11-12T10:00:00Z');
      vi.mocked(onboardingApi.deferPart).mockResolvedValue({ code: 'identification', state: 'deferred', remindAt: '2026-11-19T08:00:00Z', todoId: 'todo-1' });
      renderPage();
      await rows();

      fireEvent.click(later());
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('radio', { name: i18n.t('onboardingPlan.defer.options.nextWeek') }));
      fireEvent.click(within(dialog).getByTestId('onboarding-defer-confirm'));

      // In a week at 09:00 in Rome is 08:00 UTC in November.
      await waitFor(() => expect(onboardingApi.deferPart).toHaveBeenCalledWith('identification', '2026-11-19T08:00:00.000Z'));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.defer.toast')));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('Defer_ByDefault_RemindsTomorrowAtNineInRome', async () => {
      freezeClock('2026-11-12T10:00:00Z');
      vi.mocked(onboardingApi.deferPart).mockResolvedValue({ code: 'identification', state: 'deferred', remindAt: '2026-11-13T08:00:00Z', todoId: 'todo-1' });
      renderPage();
      await rows();

      fireEvent.click(later());
      fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('onboarding-defer-confirm'));

      await waitFor(() => expect(onboardingApi.deferPart).toHaveBeenCalledWith('identification', '2026-11-13T08:00:00.000Z'));
    });

    it('Defer_AfterEightInTheEvening_DoesNotOfferThisEveningBecauseTheServerRefusesAReminderInThePast', async () => {
      // 20:30 in Rome.
      freezeClock('2026-11-12T19:30:00Z');
      renderPage();
      await rows();

      fireEvent.click(later());

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByRole('radio', { name: i18n.t('onboardingPlan.defer.options.evening') })).not.toBeInTheDocument();
      expect(within(dialog).getAllByRole('radio')).toHaveLength(2);
    });

    it('Defer_ServerRefuses_KeepsTheWindowOpenAndTellsWhyInTheWordsOfTheServer', async () => {
      freezeClock('2026-11-12T10:00:00Z');
      vi.mocked(onboardingApi.deferPart).mockRejectedValue(
        problemError(422, { code: 'onboarding_part_not_open', detail: 'Il passo è già completato: non c’è niente da rimandare.' }),
      );
      renderPage();
      await rows();

      fireEvent.click(later());
      fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('onboarding-defer-confirm'));

      expect(await screen.findByTestId('onboarding-defer-error')).toHaveTextContent('Il passo è già completato');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('Defer_NotAnOrganizationAdministrator_IsDisabledWithTheReasonInsteadOfFailingWith403', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();
      await rows();

      const note = screen.getByTestId('onboarding-plan-admin-note');
      expect(note).toHaveTextContent(i18n.t('onboardingPlan.defer.adminOnly'));
      expect(later()).toBeDisabled();
      expect(later()).toHaveAccessibleDescription(i18n.t('onboardingPlan.defer.adminOnly'));
      // The plan is still read: the way into each part stays.
      expect(within(row('identification')).getByRole('link')).toHaveAttribute('href', partPath('identification'));
      expect(onboardingApi.deferPart).not.toHaveBeenCalled();
    });

    it('Defer_OrganizationAdministrator_SeesNoSentenceAboutTheAdministrator', async () => {
      renderPage();
      await rows();

      expect(screen.queryByTestId('onboarding-plan-admin-note')).not.toBeInTheDocument();
    });
  });

  describe('«Salva ed esci» and «Aiuto»', () => {
    const exitButton = () => screen.getByRole('button', { name: i18n.t('onboardingPlan.exit.action') });

    it('SaveAndExit_Administrator_LeavesWhatRemainsInTheTodoListThroughTheFirstOpenPartThenGoesHome', async () => {
      vi.mocked(onboardingApi.exitPart).mockResolvedValue({ code: 'properties', state: 'open', remindAt: '2026-11-13T08:00:00Z', todoId: 'todo-2' });
      renderPage();
      await rows();

      fireEvent.click(exitButton());

      await waitFor(() => expect(onboardingApi.exitPart).toHaveBeenCalledTimes(1));
      expect(onboardingApi.exitPart).toHaveBeenCalledWith('properties');
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.exit.saved')));
      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent');
    });

    it('SaveAndExit_NotAnOrganizationAdministrator_OnlyGoesHomeWithoutCallingTheServer', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();
      await rows();

      fireEvent.click(exitButton());

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent');
      expect(onboardingApi.exitPart).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('SaveAndExit_NoPartIsOpen_OnlyGoesHomeBecauseNothingRemainsToBeKept', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ properties: { state: 'done' }, identification: { state: 'deferred' } }));
      renderPage();
      await rows();

      fireEvent.click(exitButton());

      expect(await screen.findByTestId('arrived')).toBeInTheDocument();
      expect(onboardingApi.exitPart).not.toHaveBeenCalled();
    });

    it('SaveAndExit_ServerFails_KeepsThePersonOnThePageAndTellsInsteadOfLettingWhatRemainsVanish', async () => {
      vi.mocked(onboardingApi.exitPart).mockRejectedValue(problemError(500, { code: 'internal_error' }));
      renderPage();
      await rows();

      fireEvent.click(exitButton());

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('onboardingPlan.exit.error')));
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('Help_IsAMailtoLinkToTheSupportAddressAndIsHiddenWhenNoneIsConfigured', async () => {
      renderPage();
      await rows();

      expect(screen.getByTestId('onboarding-plan-help')).toHaveAttribute('href', 'mailto:aiuto@casazen.test');

      cleanup();
      support.email = null;
      renderPage();
      await rows();

      expect(screen.queryByTestId('onboarding-plan-help')).not.toBeInTheDocument();
      // «Salva ed esci» is there all the same.
      expect(exitButton()).toBeInTheDocument();
    });

    it('SaveAndExitAndHelp_WhileLoadingAndOnError_AreStillOnScreen', async () => {
      vi.mocked(onboardingApi.getPlan).mockReturnValue(new Promise(() => undefined));
      renderPage();

      expect(await screen.findByTestId('onboarding-plan-loading')).toBeInTheDocument();
      expect(exitButton()).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-plan-help')).toBeInTheDocument();

      cleanup();
      vi.mocked(onboardingApi.getPlan).mockRejectedValue(problemError(500, { code: 'internal_error' }));
      renderPage();

      expect(await screen.findByTestId('onboarding-plan-error')).toBeInTheDocument();
      expect(exitButton()).toBeInTheDocument();
      expect(screen.getByTestId('onboarding-plan-help')).toBeInTheDocument();
    });
  });

  describe('loading and error', () => {
    it('Loading_WhileThePlanComes_ShowsSkeletonRowsAnnouncedToAScreenReader', async () => {
      vi.mocked(onboardingApi.getPlan).mockReturnValue(new Promise(() => undefined));
      renderPage();

      const loading = await screen.findByTestId('onboarding-plan-loading');

      expect(loading).toHaveAttribute('role', 'status');
      expect(loading).toHaveAttribute('aria-busy', 'true');
      expect(loading).toHaveTextContent(i18n.t('onboardingPlan.loading'));
    });

    it('Error_PlanCannotBeLoaded_IsAnAlertWithARetryThatReadsItAgain', async () => {
      vi.mocked(onboardingApi.getPlan).mockRejectedValueOnce(problemError(500, { code: 'internal_error' })).mockResolvedValue(plan());
      renderPage();

      const alert = await screen.findByTestId('onboarding-plan-error');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent(i18n.t('onboardingPlan.loadError'));

      fireEvent.click(within(alert).getByRole('button', { name: i18n.t('shared.errorState.retry') }));

      expect(await screen.findByTestId('onboarding-plan-parts')).toBeInTheDocument();
      expect(onboardingApi.getPlan).toHaveBeenCalledTimes(2);
    });

    it('EmptyPlan_NothingTheAppKnows_SaysSoInsteadOfDrawingAnEmptyList', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue({ ...plan(), parts: [] });
      renderPage();

      expect(await screen.findByTestId('onboarding-plan-empty')).toHaveTextContent(i18n.t('onboardingPlan.empty'));
      expect(screen.queryByTestId('onboarding-plan-parts')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('Page_Loaded_HasNoAccessibilityViolationAxeCanFind', async () => {
      const { container } = renderPage();
      await rows();

      await expectNoAxeViolations(container);
    });

    it('Page_English_SpeaksEnglishWithoutShowingAKey', async () => {
      await i18n.changeLanguage('en');
      renderPage();
      await rows();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Start with CasaZen');
      expect(within(row('properties')).getByRole('link')).toHaveTextContent('Resume');
      expect(document.body.textContent).not.toMatch(/onboardingPlan\./);
    });
  });
});

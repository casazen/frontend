import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ONBOARDING_PATH_STEP_CODES, type OnboardingPartKey, type OnboardingPathStepCode } from '@/types/onboarding.types';
import { expectNoAxeViolations } from '@/test/axe';
import { COLLABORATOR, OWNER, path, plan, problemError } from '../../__tests__/onboarding-fixtures';
import { WizardNextStep } from '../wizard-next-step';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getPath: vi.fn(), getPlan: vi.fn(), getStatus: vi.fn(), deferPart: vi.fn(), exitPart: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const workspace = vi.hoisted(() => ({ contexts: [] as Array<{ contextKey: string; roleKey: string }> }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const flags = vi.hoisted(() => ({ octorateOnboarding: true }));

function renderSuggestion(currentPart: OnboardingPartKey = 'listings') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: flags.octorateOnboarding }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <WizardNextStep currentPart={currentPart} />
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
  return { ...view, client };
}

/** Every request has been answered and what it says is on the screen: a test that expects nothing there is not passing only because it looked too soon. */
async function settled(client: QueryClient) {
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

const done = (...codes: OnboardingPathStepCode[]) => Object.fromEntries(codes.map((code) => [code, 'done'])) as Parameters<typeof path>[0];
const ALL_DONE = done(...ONBOARDING_PATH_STEP_CODES);

const stepTitle = (code: OnboardingPathStepCode) => i18n.t(`onboardingPlan.path.steps.${code}.title`);

describe('WizardNextStep, the next step at the end of a wizard (UX-10, AC-NF10-2)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    flags.octorateOnboarding = true;
    // The host has just finished the listings (the step «Controlla gli annunci»); the connection is done, the prices are next.
    vi.mocked(onboardingApi.getPath).mockReset().mockResolvedValue(path(done('connectChannels')));
    vi.mocked(onboardingApi.getPlan)
      .mockReset()
      .mockResolvedValue(plan({ properties: { state: 'done' }, channels: { state: 'done' }, listings: { state: 'open' }, pricesRules: { state: 'open' } }));
    vi.mocked(onboardingApi.deferPart).mockReset().mockResolvedValue({ code: 'pricesRules', state: 'deferred', remindAt: '2026-11-13T08:00:00Z', todoId: 'todo-1' });
    vi.mocked(onboardingApi.exitPart).mockReset().mockResolvedValue({ code: 'properties', state: 'open', remindAt: '2026-11-13T08:00:00Z', todoId: 'todo-2' });
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  afterEach(() => cleanup());

  describe('the suggestion', () => {
    it('Suggestion_AtTheEndOfTheListings_IsOneCardWithTheNextStepItsWhyAndTwoButtons', async () => {
      renderSuggestion('listings');

      const card = await screen.findByTestId('wizard-next-step');

      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(stepTitle('pricesCalendar'));
      expect(within(card).getByText(i18n.t('onboardingPlan.nextStep.why.pricesCalendar'))).toBeInTheDocument();
      expect(within(card).getAllByRole('link')).toHaveLength(1);
      expect(within(card).getAllByRole('button')).toHaveLength(1);
      expect(within(card).getByRole('link', { name: i18n.t('onboardingPlan.nextStep.continue') })).toHaveAttribute('href', '/app/short-rent/onboarding/parts/pricesRules');
      expect(within(card).getByRole('button', { name: i18n.t('onboardingPlan.nextStep.later') })).toBeEnabled();
      expect(screen.getAllByTestId('wizard-next-step')).toHaveLength(1);
    });

    it('Suggestion_NeverIsTheStepTheHostHasJustBeenThrough_EvenWhenItIsNotDoneYet', async () => {
      // The listings are not complete yet: the path still names «Controlla gli annunci» as the next step.
      renderSuggestion('listings');

      const card = await screen.findByTestId('wizard-next-step');

      expect(card.textContent).not.toContain(stepTitle('checkListings'));
    });

    it('Suggestion_StepMadeOfSeveralParts_OpensThePartThatIsLeft', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path());
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan());
      renderSuggestion('identification');

      const card = await screen.findByTestId('wizard-next-step');

      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(stepTitle('connectChannels'));
      expect(within(card).getByTestId('wizard-next-step-continue')).toHaveAttribute('href', '/app/short-rent/onboarding/parts/properties');
    });

    it('Suggestion_ButtonsAreOfAtLeast44PxAndTheCardHasNoAccessibilityViolation', async () => {
      const { container } = renderSuggestion('listings');

      const card = await screen.findByTestId('wizard-next-step');

      expect(within(card).getByRole('link').className).toContain('min-h-11');
      expect(within(card).getByRole('button').className).toContain('min-h-11');
      await expectNoAxeViolations(container);
    });

    it('Suggestion_English_SpeaksEnglishWithoutShowingAKey', async () => {
      await i18n.changeLanguage('en');
      renderSuggestion('listings');

      const card = await screen.findByTestId('wizard-next-step');

      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('Prices and calendar');
      expect(within(card).getByRole('button', { name: 'Later' })).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/onboardingPlan\./);
    });
  });

  describe('«Più tardi»', () => {
    it('Later_PutsThePartOfTheStepInTodoWithTheDefaultReminderSaysWhereItWentAndSuggestsNothingElse', async () => {
      renderSuggestion('listings');

      fireEvent.click(await screen.findByRole('button', { name: i18n.t('onboardingPlan.nextStep.later') }));

      // The part of the step, put off with no moment of its own: the server reminds tomorrow at 09:00 in Rome.
      await waitFor(() => expect(onboardingApi.deferPart).toHaveBeenCalledTimes(1));
      expect(vi.mocked(onboardingApi.deferPart).mock.calls[0]).toEqual(['pricesRules']);
      expect(onboardingApi.exitPart).not.toHaveBeenCalled();
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.nextStep.laterToast')));
      expect(i18n.t('onboardingPlan.nextStep.laterToast')).toBe('Lo trovi in Da fare');

      const confirmation = await screen.findByTestId('wizard-next-step-later');
      expect(confirmation).toHaveTextContent(i18n.t('onboardingPlan.nextStep.laterDone'));
      expect(confirmation).toHaveFocus();
      // Nothing else is suggested, not even after the path is read again: the card, its buttons and the next step are gone.
      expect(screen.queryByTestId('wizard-next-step')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('Later_PartThatAnotherPartNeeds_IsLeftWithExitBecauseItCannotBeDeferred', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path());
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan());
      renderSuggestion('identification');

      fireEvent.click(await screen.findByRole('button', { name: i18n.t('onboardingPlan.nextStep.later') }));

      // The properties are what the channels, the prices and the compliance wait for: «Lo faccio dopo» is refused for them, «Salva ed esci» is not.
      await waitFor(() => expect(onboardingApi.exitPart).toHaveBeenCalledWith('properties'));
      expect(onboardingApi.deferPart).not.toHaveBeenCalled();
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.nextStep.laterToast')));
    });

    it('Later_ServerRefuses_TellsAndKeepsTheCardSoTheHostCanTryAgainOrContinue', async () => {
      vi.mocked(onboardingApi.deferPart).mockRejectedValue(problemError(500, { code: 'internal_error' }));
      renderSuggestion('listings');

      fireEvent.click(await screen.findByRole('button', { name: i18n.t('onboardingPlan.nextStep.later') }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('onboardingPlan.nextStep.laterError')));
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.getByTestId('wizard-next-step')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-next-step-later')).not.toBeInTheDocument();
    });

    it('Later_ReadsThePathPlanAndTodoListAgainSoTheyShowWhatWasPutOff', async () => {
      const { client } = renderSuggestion('listings');
      await screen.findByTestId('wizard-next-step');
      const invalidate = vi.spyOn(client, 'invalidateQueries');

      fireEvent.click(screen.getByRole('button', { name: i18n.t('onboardingPlan.nextStep.later') }));

      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['onboarding', 'path'] }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['onboarding', 'plan'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['onboarding', 'status'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['internal-activities'] });
    });
  });

  describe('when it shows nothing', () => {
    it('Suggestion_FlagOff_RendersNothingAndNeverAsksTheServer', async () => {
      flags.octorateOnboarding = false;
      const { container, client } = renderSuggestion('listings');

      await settled(client);

      expect(container).toBeEmptyDOMElement();
      expect(onboardingApi.getPath).not.toHaveBeenCalled();
      expect(onboardingApi.getPlan).not.toHaveBeenCalled();
    });

    it('Suggestion_NotAnOrganizationAdministrator_RendersNothingBecauseDeferringIsTheirs', async () => {
      workspace.contexts = COLLABORATOR;
      const { container, client } = renderSuggestion('listings');

      await settled(client);

      expect(container).toBeEmptyDOMElement();
      expect(onboardingApi.getPath).not.toHaveBeenCalled();
    });

    it('Suggestion_PathComplete_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path(ALL_DONE));
      const { container, client } = renderSuggestion('listings');

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
      expect(onboardingApi.getPlan).not.toHaveBeenCalled();
    });

    it('Suggestion_NothingIsLeftButTheStepOfTheWizardItself_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path({ ...ALL_DONE, checkListings: 'open' }));
      const { container, client } = renderSuggestion('listings');

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
    });

    it('Suggestion_EverythingElseIsPutOff_RendersNothingBecauseItIsNotProposedAgainAtOnce', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(
        path({ connectChannels: 'done', checkListings: 'open', pricesCalendar: 'deferred', checkInCompliance: 'deferred', messagesAi: 'deferred', fiscalDocuments: 'deferred' }, null),
      );
      const { container, client } = renderSuggestion('listings');

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
    });

    it('Suggestion_WhileLoading_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockReturnValue(new Promise(() => undefined));
      const { container } = renderSuggestion('listings');

      await Promise.resolve();

      expect(container).toBeEmptyDOMElement();
    });

    it('Suggestion_PlanThatCannotBeRead_RendersNothingRatherThanGuessWhetherTheStepCanBePutOff', async () => {
      vi.mocked(onboardingApi.getPlan).mockRejectedValue(problemError(500, { code: 'internal_error' }));
      const { container, client } = renderSuggestion('listings');

      await waitFor(() => expect(onboardingApi.getPlan).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ONBOARDING_PATH_STEP_CODES, type OnboardingPathStepCode } from '@/types/onboarding.types';
import { expectNoAxeViolations } from '@/test/axe';
import { COLLABORATOR, OWNER, path, plan, problemError } from '../../__tests__/onboarding-fixtures';
import { OnboardingPathCard } from '../onboarding-path-card';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getPath: vi.fn(), getPlan: vi.fn(), getStatus: vi.fn() },
}));

const workspace = vi.hoisted(() => ({ contexts: [] as Array<{ contextKey: string; roleKey: string }> }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const flags = vi.hoisted(() => ({ octorateOnboarding: true }));

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: flags.octorateOnboarding }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <OnboardingPathCard />
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

describe('OnboardingPathCard, the path «Inizia con CasaZen» on the home (UX-10, NF-10)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    flags.octorateOnboarding = true;
    vi.mocked(onboardingApi.getPath).mockReset().mockResolvedValue(path(done('connectChannels')));
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan({ properties: { state: 'done' }, channels: { state: 'done' }, listings: { state: 'open' } }));
  });

  afterEach(() => cleanup());

  describe('what it shows while the path is incomplete', () => {
    it('Card_IncompletePath_IsTheCompactChecklistWithTheTitleTheProgressAndTheNextStep', async () => {
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(`${i18n.t('onboardingPlan.path.title')} 1 di 6`);
      expect(within(card).getByText(`Prossimo: ${i18n.t('onboardingPlan.path.steps.checkListings.title')}`)).toBeInTheDocument();
      expect(i18n.t('onboardingPlan.path.steps.checkListings.title')).toBe('Controlla gli annunci');
    });

    it('Card_Progress_IsTheValueOfTheBarForAScreenReader', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path(done('connectChannels', 'checkListings')));
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');
      const bar = within(card).getByRole('progressbar');

      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('2 di 6');
      expect(bar).toHaveAttribute('aria-valuetext', '2 di 6');
      expect(bar).toHaveAccessibleName(i18n.t('onboardingPlan.path.progressLabel'));
    });

    it('Card_Continue_OpensThePartOfTheNextStepThatIsStillToDoAndAllTheStepsOpensThePlan', async () => {
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).getByRole('link', { name: i18n.t('onboardingPlan.path.continue') })).toHaveAttribute('href', '/app/short-rent/onboarding/parts/listings');
      expect(within(card).getByRole('link', { name: i18n.t('onboardingPlan.path.all') })).toHaveAttribute('href', '/app/short-rent/onboarding');
    });

    it('Card_NextStepMadeOfSeveralParts_OpensTheFirstOneThatIsNotDone', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path());
      vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan());
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      // The connection is done, the properties are not: not the first part of the step, the one that is left.
      expect(within(card).getByTestId('onboarding-path-continue')).toHaveAttribute('href', '/app/short-rent/onboarding/parts/properties');
    });

    it('Card_PlanThatCannotBeRead_StillOpensTheFirstPartOfTheStep', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path());
      vi.mocked(onboardingApi.getPlan).mockRejectedValue(problemError(500, { code: 'internal_error' }));
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).getByTestId('onboarding-path-continue')).toHaveAttribute('href', '/app/short-rent/onboarding/parts/octorateConnection');
    });

    it('Card_StepsNobodyProvidesYet_AreNotCountedSoTheBarCanReachItsEnd', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path({ connectChannels: 'done', messagesAi: 'notAvailable', fiscalDocuments: 'notAvailable' }));
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('1 di 4');
    });

    it('Card_EveryStepThatIsLeftIsPutOff_ShowsTheProgressAndTheWayToThePlanButNoContinue', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(
        path({ connectChannels: 'done', ...Object.fromEntries(ONBOARDING_PATH_STEP_CODES.slice(1).map((code) => [code, 'deferred'])) }, null),
      );
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).queryByTestId('onboarding-path-continue')).not.toBeInTheDocument();
      expect(within(card).queryByText(/^Prossimo/)).not.toBeInTheDocument();
      expect(within(card).getByTestId('onboarding-path-all')).toBeInTheDocument();
    });

    it('Card_ActionsAreLinksOfAtLeast44PxThatAKeyboardReaches_AndHaveNoAccessibilityViolation', async () => {
      const { container } = renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      for (const link of within(card).getAllByRole('link')) expect(link.className).toContain('min-h-11');
      await expectNoAxeViolations(container);
    });

    it('Card_English_SpeaksEnglishWithoutShowingAKey', async () => {
      await i18n.changeLanguage('en');
      renderCard();

      const card = await screen.findByTestId('onboarding-path-card');

      expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Start with CasaZen 1 of 6');
      expect(within(card).getByText('Next: Check your listings')).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/onboardingPlan\./);
    });
  });

  describe('when it shows nothing', () => {
    it('Card_FlagOff_RendersNothingAndNeverAsksTheServer', async () => {
      flags.octorateOnboarding = false;
      const { client } = renderCard();

      await settled(client);

      expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
      expect(onboardingApi.getPath).not.toHaveBeenCalled();
      expect(onboardingApi.getPlan).not.toHaveBeenCalled();
    });

    it('Card_NotAnOrganizationAdministrator_RendersNothingBecauseDeferringIsTheirs', async () => {
      workspace.contexts = COLLABORATOR;
      const { client } = renderCard();

      await settled(client);

      expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
      expect(onboardingApi.getPath).not.toHaveBeenCalled();
    });

    it('Card_PathComplete_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path(ALL_DONE));
      const { client } = renderCard();

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
    });

    it('Card_PathComplete_ButForAStepNobodyProvides_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue(path({ ...ALL_DONE, fiscalDocuments: 'notAvailable' }));
      const { client } = renderCard();

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
    });

    it('Card_WhileLoading_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockReturnValue(new Promise(() => undefined));
      const { container } = renderCard();

      await Promise.resolve();

      expect(container).toBeEmptyDOMElement();
    });

    it('Card_PathThatCannotBeRead_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockRejectedValue(problemError(404, { code: 'not_found' }));
      const { container, client } = renderCard();

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
    });

    it('Card_PathWithOnlyStepsThisVersionDoesNotKnow_RendersNothing', async () => {
      vi.mocked(onboardingApi.getPath).mockResolvedValue({ code: 'start-with-casazen', steps: [], next: null });
      const { container, client } = renderCard();

      await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
      await settled(client);

      expect(container).toBeEmptyDOMElement();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ONBOARDING_PATH_STEP_CODES, type ActivationStep, type OnboardingStatus } from '@/types/onboarding.types';
import { COLLABORATOR, OWNER, path, plan, problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { HomeNextStep } from '../components/home-next-step';

/**
 * The home tells the setup once (UX-10, the redesign conventions §7bis): the path «Inizia con CasaZen» (`ChecklistCompact`) while it is incomplete,
 * and otherwise the next step of the activation checklist (`NextStepCard`), never both. With the flag off this is the component it always was.
 */
vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getStatus: vi.fn(), getPath: vi.fn(), getPlan: vi.fn() },
}));

const workspace = vi.hoisted(() => ({ contexts: [] as Array<{ contextKey: string; roleKey: string }> }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: workspace.contexts, hasPermission: () => true }),
}));

const flags = vi.hoisted(() => ({ octorateOnboarding: true }));

const STEPS: ActivationStep[] = [
  { key: 'account', state: 'done', reason: null },
  { key: 'organization', state: 'todo', reason: 'org_profile_incomplete' },
  { key: 'property', state: 'todo', reason: 'no_property' },
  { key: 'cin', state: 'blocked', reason: 'no_property' },
  { key: 'payments', state: 'todo', reason: 'connect_not_started' },
  { key: 'sitePublished', state: 'blocked', reason: 'no_property' },
  { key: 'firstBooking', state: 'blocked', reason: 'site_not_published' },
];

const STATUS: OnboardingStatus = {
  roleChosen: true,
  orgProvisioned: true,
  consentsAccepted: true,
  propertyCreated: false,
  sitePublished: false,
  firstBookingTaken: false,
  activated: false,
  publicBookingUrl: null,
  steps: STEPS,
};

const ALL_DONE = Object.fromEntries(ONBOARDING_PATH_STEP_CODES.map((code) => [code, 'done'])) as Parameters<typeof path>[0];

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: flags.octorateOnboarding }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <HomeNextStep />
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
  return { ...view, client };
}

async function settled(client: QueryClient) {
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

describe('HomeNextStep: the path or the next step of the checklist, never both (UX-10)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    flags.octorateOnboarding = true;
    vi.mocked(onboardingApi.getStatus).mockReset().mockResolvedValue(STATUS);
    vi.mocked(onboardingApi.getPath).mockReset().mockResolvedValue(path({ connectChannels: 'done' }));
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
  });

  afterEach(() => cleanup());

  it('PathIncomplete_ShowsThePathCardInsteadOfTheNextStepCardSoTheTwoAreNeverOnScreenTogether', async () => {
    renderHome();

    expect(await screen.findByTestId('onboarding-path-card')).toBeInTheDocument();

    expect(screen.queryByTestId('activation-next-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-next-step-all')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-next-step')).toContainElement(screen.getByTestId('onboarding-path-card'));
  });

  it('FlagOff_IsTheNextStepOfTheChecklistAsItAlwaysWasAndTheServerIsNotAskedAboutThePath', async () => {
    flags.octorateOnboarding = false;
    renderHome();

    expect(await screen.findByTestId('activation-next-step')).toBeInTheDocument();

    expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-next-step-all')).toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('NotAnOrganizationAdministrator_IsTheNextStepOfTheChecklist', async () => {
    workspace.contexts = COLLABORATOR;
    renderHome();

    expect(await screen.findByTestId('activation-next-step')).toBeInTheDocument();

    expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('PathComplete_GoesBackToTheNextStepOfTheChecklist', async () => {
    vi.mocked(onboardingApi.getPath).mockResolvedValue(path(ALL_DONE));
    renderHome();

    expect(await screen.findByTestId('activation-next-step')).toBeInTheDocument();

    expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
  });

  it('PathThatCannotBeRead_GoesBackToTheNextStepOfTheChecklist', async () => {
    vi.mocked(onboardingApi.getPath).mockRejectedValue(problemError(500, { code: 'internal_error' }));
    renderHome();

    expect(await screen.findByTestId('activation-next-step')).toBeInTheDocument();

    expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
  });

  it('PathWhileItLoads_ShowsNeitherSoTheHomeDoesNotSwapOneCardForTheOther', async () => {
    vi.mocked(onboardingApi.getPath).mockReturnValue(new Promise(() => undefined));
    const { container, client } = renderHome();

    // The checklist answers at once; the path never does: still nothing of either.
    await waitFor(() => expect(onboardingApi.getStatus).toHaveBeenCalled());
    await waitFor(() => expect(client.isFetching()).toBe(1));

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('activation-next-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-path-card')).not.toBeInTheDocument();
  });

  it('ChecklistDone_AndPathComplete_ShowsNothing', async () => {
    vi.mocked(onboardingApi.getPath).mockResolvedValue(path(ALL_DONE));
    vi.mocked(onboardingApi.getStatus).mockResolvedValue({ ...STATUS, steps: STEPS.map((step) => ({ ...step, state: 'done' as const, reason: null })) });
    const { container, client } = renderHome();

    await settled(client);

    expect(container).toBeEmptyDOMElement();
  });
});

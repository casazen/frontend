import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { useUiStore } from '@/store/ui-store';
import { COLLABORATOR, OWNER, path, plan } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { FirstRunWizard } from '../first-run-wizard';
import { GuideButton } from '../guide-panel';

/**
 * The guide (the answer to «non lasciare l'utente da solo… qualcosa che colleghi tutte le operazioni»): the panel of the header with the setup and
 * the «Da fare» list as roads, its button with the urgent count, and the welcome of the first access («Inizia con CasaZen» as the first wizard).
 */
vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getStatus: vi.fn(), getPath: vi.fn(), getPlan: vi.fn() },
}));
vi.mock('@/api/internal-activities.api', () => ({
  internalActivitiesApi: { getPending: vi.fn(), getUrgentCount: vi.fn() },
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'p-1', name: 'Villa del Lago' }] }) }));

const workspace = vi.hoisted(() => ({ contexts: [] as Array<{ contextKey: string; roleKey: string }> }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: workspace.contexts, hasPermission: () => true }),
}));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: { id: 'u-1', firstName: 'Luca' }, org: null }) }));

const TODO = [
  {
    id: 'one',
    activityType: 'ReceiptToRetrieve',
    action: 'UploadAlloggiatiProof',
    entityType: 'Booking',
    entityId: 'b-1',
    propertyId: 'p-1',
    dueAt: '2000-01-01T10:00:00Z',
    urgency: 'High',
    reason: null,
    createdAt: '2026-11-01T08:00:00Z',
  },
];

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderWith(node: React.ReactNode, at = '/app/short-rent') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: true }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[at]}>
            <Routes>
              <Route
                path="*"
                element={
                  <>
                    {node}
                    <Where />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

function renderButton(contextKey: AppContextKey = 'short-rent') {
  return renderWith(<GuideButton contextKey={contextKey} />);
}

describe('the guide of the header', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.localStorage.clear();
    act(() => useUiStore.setState({ guideOpen: false }));
    workspace.contexts = OWNER;
    vi.mocked(onboardingApi.getStatus).mockReset().mockResolvedValue({ steps: [] } as never);
    vi.mocked(onboardingApi.getPath).mockReset().mockResolvedValue(path());
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    vi.mocked(internalActivitiesApi.getPending).mockReset().mockResolvedValue(TODO as never);
    vi.mocked(internalActivitiesApi.getUrgentCount).mockReset().mockResolvedValue({ count: 3 } as never);
  });

  afterEach(() => cleanup());

  it('GuideButton_UrgentThingsToDo_CarriesTheirNumberAndSaysIt', async () => {
    renderButton();

    expect(await screen.findByTestId('guide-button-count')).toHaveTextContent('3');
    expect(screen.getByTestId('guide-button')).toHaveAccessibleName('Apri la guida: 3 cose urgenti da fare');
  });

  it('GuidePanel_ShortRent_TellsTheSetupAndTheToDoListAsRoadsWithTheStepToDoNow', async () => {
    renderButton();
    fireEvent.click(screen.getByTestId('guide-button'));

    const panel = await screen.findByTestId('guide-panel');
    const setup = await within(panel).findByTestId('guide-setup');
    expect(setup).toHaveTextContent('Inizia con CasaZen');
    expect(within(setup).getByRole('listitem', { current: 'step' })).toBeInTheDocument();
    expect(within(setup).getByTestId('guide-setup-all')).toHaveAttribute('href', '/app/short-rent/onboarding');

    const todo = await within(panel).findByTestId('guide-todo');
    expect(todo).toHaveTextContent('Ricevuta da recuperare');
    expect(todo).toHaveTextContent('Villa del Lago');
    expect(within(todo).getByTestId('guide-todo-all')).toHaveAttribute('href', '/app/short-rent/activities');
  });

  it('GuidePanel_OtherArea_OnlyHelpsWithTheManualOfThatArea', async () => {
    renderButton('supplier');
    fireEvent.click(screen.getByTestId('guide-button'));

    const panel = await screen.findByTestId('guide-panel');
    expect(within(panel).getByTestId('guide-help-manual')).toHaveAttribute('href', '/app/supplier/help');
    expect(within(panel).queryByTestId('guide-setup')).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('guide-todo')).not.toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('GuidePanel_LinkFollowed_ClosesItSoThePageIsThePersonsAgain', async () => {
    renderButton();
    fireEvent.click(screen.getByTestId('guide-button'));
    const panel = await screen.findByTestId('guide-panel');

    fireEvent.click(await within(panel).findByTestId('guide-todo-all'));

    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/activities');
    await waitFor(() => expect(screen.queryByTestId('guide-panel')).not.toBeInTheDocument());
  });
});

describe('the welcome of the first access («Inizia con CasaZen» as the first wizard)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.localStorage.clear();
    act(() => useUiStore.setState({ guideOpen: false }));
    workspace.contexts = OWNER;
    vi.mocked(onboardingApi.getPath).mockReset().mockResolvedValue(path());
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    vi.mocked(onboardingApi.getStatus).mockReset().mockResolvedValue({ steps: [] } as never);
  });

  afterEach(() => cleanup());

  it('FirstAccess_OpensByItselfAndLeadsFromTheWelcomeToTheRoadAndItsFirstStep', async () => {
    renderWith(<FirstRunWizard />);

    const welcome = await screen.findByTestId('first-run-welcome');
    expect(welcome).toHaveTextContent('Ciao Luca, iniziamo insieme');
    fireEvent.click(screen.getByTestId('first-run-next'));

    const road = await screen.findByTestId('first-run-path');
    expect(road).toHaveTextContent('Il tuo percorso');
    fireEvent.click(screen.getByTestId('first-run-start'));

    await waitFor(() => expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument());
    expect(screen.getByTestId('where').textContent).toMatch(/^\/app\/short-rent\/onboarding\/parts\//);
    expect(window.localStorage.getItem('casazen:welcome-seen:u-1')).toBe('1');
  });

  it('Later_ClosesItForGoodAndAddsNoOtherLayer', async () => {
    renderWith(<FirstRunWizard />);

    expect(await screen.findByTestId('first-run-welcome')).toHaveTextContent('La Guida in alto a destra');
    fireEvent.click(screen.getByTestId('first-run-later'));

    await waitFor(() => expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument());
    expect(useUiStore.getState().guideOpen).toBe(false);
    expect(window.localStorage.getItem('casazen:welcome-seen:u-1')).toBe('1');
  });

  it('AlreadySeen_DoesNotOpenAgain', async () => {
    window.localStorage.setItem('casazen:welcome-seen:u-1', '1');
    renderWith(<FirstRunWizard />);

    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('SetupComplete_HasNothingToWelcomeTo', async () => {
    const done = Object.fromEntries(
      ['connectChannels', 'checkListings', 'pricesCalendar', 'checkInCompliance', 'messagesAi', 'fiscalDocuments'].map((code) => [code, 'done']),
    );
    vi.mocked(onboardingApi.getPath).mockResolvedValue(path(done as never));
    renderWith(<FirstRunWizard />);

    await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
  });

  it('NotOnTheHome_NeverOpensOverAFormOrAWizard', async () => {
    renderWith(<FirstRunWizard />, '/app/short-rent/properties/create');

    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('NotTheOrganizationAdministrator_IsNotWelcomedToASetupThatIsNotTheirs', async () => {
    workspace.contexts = COLLABORATOR;
    renderWith(<FirstRunWizard />);

    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
  });
});

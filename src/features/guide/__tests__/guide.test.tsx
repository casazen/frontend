import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { useUiStore } from '@/store/ui-store';
import { AskContext, type AskContextValue } from '@/features/assistant/ask/ask-context';
import { savePlanResume } from '@/features/onboarding/plan-resume';
import { COLLABORATOR, OWNER, path, plan } from '@/features/onboarding/__tests__/onboarding-fixtures';
import { manualHintsFor, searchManual, type ManualHit, type ManualPageHints } from '@/lib/manual/manual-search';
import { FirstRunWizard } from '../first-run-wizard';
import { supportConfig } from '@/config/support.config';
import { GuideButton } from '../guide-panel';

/**
 * The guide: the panel of the header, which is the user manual (search, the tasks of the page that is open, the chapters), and the welcome of the
 * first access («Inizia con CasaZen» as the first wizard).
 */
vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getStatus: vi.fn(), getPath: vi.fn(), getPlan: vi.fn() },
}));
vi.mock('@/api/internal-activities.api', () => ({
  internalActivitiesApi: { getPending: vi.fn(), getUrgentCount: vi.fn() },
}));
vi.mock('@/lib/manual/manual-search', () => ({ MANUAL_BASE: '/guida/', searchManual: vi.fn(), manualHintsFor: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'p-1', name: 'Villa del Lago' }] }) }));

const workspace = vi.hoisted(() => ({ contexts: [] as Array<{ contextKey: string; roleKey: string }>, canReadProperties: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: workspace.contexts, hasPermission: (_area: string, permission: string) => permission !== 'property.read' || workspace.canReadProperties }),
}));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: { id: 'u-1', firstName: 'Luca' }, org: { id: 'org-a', name: 'Casa Demo' } }) }));

const HOWTO: ManualHit = {
  id: 'immobili.html#aggiungere',
  type: 'howto',
  title: 'Aggiungere un immobile con la procedura guidata',
  chapter: 'Immobili',
  href: '/guida/immobili.html#aggiungere',
};
const FAQ: ManualHit = {
  id: 'immobili.html#non-riesco',
  type: 'faq',
  title: 'Non riesco ad attivare la casa: cosa devo fare?',
  chapter: 'Immobili',
  href: '/guida/immobili.html#non-riesco',
};
const HINTS: ManualPageHints = {
  chapter: { id: 'immobili.html', type: 'pagina', title: 'Immobili', chapter: 'Affitti brevi', href: '/guida/immobili.html' },
  tasks: [HOWTO],
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderWith(node: React.ReactNode, at = '/app/short-rent', octorateOnboarding = true, ask: AskContextValue | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding, octorateConnector: true }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <AskContext.Provider value={ask}>
            <MemoryRouter initialEntries={[at]}>
              <Routes>
                <Route
                  path="*"
                  element={
                    <>
                      {node}
                      <Where />
                      <Link to="/app/short-rent/activities" data-testid="elsewhere">
                        elsewhere
                      </Link>
                    </>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AskContext.Provider>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

function renderButton(at = '/app/short-rent', ask: AskContextValue | null = null) {
  return renderWith(<GuideButton />, at, true, ask);
}

function openPanel() {
  fireEvent.click(screen.getByTestId('guide-button'));
  return screen.findByTestId('guide-panel');
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
    vi.mocked(searchManual).mockReset().mockResolvedValue([HOWTO, FAQ]);
    vi.mocked(manualHintsFor).mockReset().mockResolvedValue(HINTS);
  });

  afterEach(() => cleanup());

  it('GuideButton_DoesNotDuplicateTheUrgentActivityCount', async () => {
    renderButton();

    expect(screen.queryByTestId('guide-button-count')).not.toBeInTheDocument();
    expect(screen.getByTestId('guide-button')).toHaveAccessibleName('Apri la guida');
  });

  it('GuidePanel_Opened_IsTheUserManualAndNeitherTheSetupNorTheToDoList', async () => {
    renderButton();
    const panel = await openPanel();

    expect(within(panel).getByRole('searchbox', { name: 'Cerca nel manuale' })).toBeInTheDocument();
    const topics = within(panel).getByTestId('guide-topics');
    expect(within(topics).getByRole('link', { name: /Primi passi/ })).toHaveAttribute('href', '/guida/inizia-qui.html');
    expect(within(topics).getByRole('link', { name: /Come fare/ })).toHaveAttribute('href', '/guida/come-fare.html');
    expect(within(topics).getByRole('link', { name: /Domande frequenti/ })).toHaveAttribute('href', '/guida/domande-frequenti.html');
    expect(within(topics).getByRole('link', { name: /Glossario/ })).toHaveAttribute('href', '/guida/glossario.html');
    const fullManual = within(panel).getByTestId('guide-full-manual');
    expect(fullManual).toHaveAttribute('href', '/guida/');
    expect(fullManual).toHaveAttribute('target', '_blank');
    expect(fullManual).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(panel).queryByTestId('guide-setup')).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('guide-todo')).not.toBeInTheDocument();
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
  });

  it('GuidePanel_PageTheManualExplains_SuggestsItsTasksAndItsChapter', async () => {
    renderButton('/app/short-rent/properties');
    await openPanel();

    const hints = await screen.findByTestId('guide-hints');
    expect(manualHintsFor).toHaveBeenCalledWith('/app/short-rent/properties');
    const task = within(hints).getByRole('link', { name: /Aggiungere un immobile con la procedura guidata/ });
    expect(task).toHaveAttribute('href', '/guida/immobili.html#aggiungere');
    expect(task).toHaveAttribute('target', '_blank');
    expect(within(hints).getByTestId('guide-chapter')).toHaveTextContent('Apri il capitolo «Immobili»');
  });

  it('GuidePanel_PageTheManualDoesNotExplain_HasNoSuggestionsBlock', async () => {
    vi.mocked(manualHintsFor).mockResolvedValue(null);
    renderButton('/app/short-rent/anything');
    await openPanel();

    await waitFor(() => expect(manualHintsFor).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('guide-hints')).not.toBeInTheDocument();
    expect(screen.getByTestId('guide-topics')).toBeInTheDocument();
  });

  it('GuidePanel_Typing_SearchesTheManualAndListsWhatItFinds', async () => {
    renderButton();
    const panel = await openPanel();
    await within(panel).findByTestId('guide-hints');

    fireEvent.change(within(panel).getByTestId('guide-search'), { target: { value: 'attivare la casa' } });

    const results = await within(panel).findByTestId('guide-results');
    expect(searchManual).toHaveBeenCalledWith('attivare la casa');
    expect(within(results).getAllByTestId('guide-hit')).toHaveLength(2);
    expect(within(results).getByRole('link', { name: /Non riesco ad attivare la casa/ })).toHaveAttribute('href', '/guida/immobili.html#non-riesco');
    expect(within(panel).queryByTestId('guide-hints')).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('guide-topics')).not.toBeInTheDocument();
  });

  it('GuidePanel_SearchThatFindsNothing_SaysSoInsteadOfListingNothing', async () => {
    vi.mocked(searchManual).mockResolvedValue([]);
    renderButton();
    const panel = await openPanel();

    fireEvent.change(within(panel).getByTestId('guide-search'), { target: { value: 'zzzz' } });

    await waitFor(() => expect(within(panel).getByTestId('guide-results-empty')).toHaveTextContent('Nessun risultato nel manuale.'));
  });

  it('GuidePanel_ManualThatCannotBeOpened_SaysItAndOffersToTryAgain', async () => {
    vi.mocked(searchManual).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([HOWTO]);
    renderButton();
    const panel = await openPanel();

    fireEvent.change(within(panel).getByTestId('guide-search'), { target: { value: 'immobile' } });

    const failed = await within(panel).findByTestId('guide-results-failed');
    expect(failed).toHaveTextContent('Il manuale non si apre in questo momento.');
    fireEvent.click(within(failed).getByRole('button', { name: 'Riprova' }));
    expect(await within(panel).findByTestId('guide-results')).toBeInTheDocument();
  });

  it('GuidePanel_AskCasaZen_ClosesThePanelAndOpensTheQuestionWithWhatWasTyped', async () => {
    const ask: AskContextValue = { canReadArrivals: false, canPrepareDraft: false, open: vi.fn() };
    renderButton('/app/short-rent', ask);
    const panel = await openPanel();
    fireEvent.change(within(panel).getByTestId('guide-search'), { target: { value: ' come aggiungo un immobile ' } });

    fireEvent.click(within(panel).getByTestId('guide-ask'));

    expect(ask.open).toHaveBeenCalledWith('search', expect.any(HTMLElement), 'come aggiungo un immobile');
    expect(useUiStore.getState().guideOpen).toBe(false);
    await waitFor(() => expect(screen.queryByTestId('guide-panel')).not.toBeInTheDocument());
  });

  it('GuidePanel_WithoutTheAssistant_HasNoAskButton', async () => {
    renderButton();
    const panel = await openPanel();

    expect(within(panel).queryByTestId('guide-ask')).not.toBeInTheDocument();
  });

  it('GuidePanel_SupportButton_IsThereOnlyWhereAnAddressToWriteToIsSet', async () => {
    const config = supportConfig as { email: string | null };
    const original = config.email;
    try {
      config.email = 'aiuto@casazen.example';
      renderButton();
      expect(await within(await openPanel()).findByTestId('guide-help-support')).toHaveAttribute('href', 'mailto:aiuto@casazen.example');
      cleanup();
      act(() => useUiStore.setState({ guideOpen: false }));

      config.email = null;
      renderButton();
      const panel = await openPanel();
      expect(within(panel).queryByTestId('guide-help-support')).not.toBeInTheDocument();
    } finally {
      config.email = original;
    }
  });

  it('GuidePanel_PageChangedUnderIt_ClosesItSoThePageIsThePersonsAgain', async () => {
    renderButton();
    await openPanel();

    fireEvent.click(screen.getByTestId('elsewhere'));

    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/activities');
    await waitFor(() => expect(screen.queryByTestId('guide-panel')).not.toBeInTheDocument());
  });
});

describe('the welcome of the first access («Inizia con CasaZen» as the first wizard)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    window.localStorage.clear();
    window.sessionStorage.clear();
    workspace.canReadProperties = true;
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

  it('opens the organization setup plan from the welcome while the parts remain available in the preview', async () => {
    renderWith(<FirstRunWizard />);
    await screen.findByTestId('first-run-welcome');
    const start = screen.getByTestId('first-run-start');
    expect(start).toHaveAccessibleName(i18n.t('onboardingPlan.title'));
    fireEvent.click(start);
    expect(screen.getByTestId('where').textContent).toBe('/app/short-rent/onboarding');
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
  });

  it('opens the next permitted checklist task when this organization has no connected setup path', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue({ steps: [{ key: 'property', state: 'todo' }] } as never);
    renderWith(<FirstRunWizard />, '/app/short-rent', false);
    const start = await screen.findByTestId('first-run-start');
    expect(start).toHaveAccessibleName(i18n.t('activation.cta.property'));
    fireEvent.click(start);
    expect(screen.getByTestId('where').textContent).toBe('/app/short-rent/properties/create');
    expect(onboardingApi.getPath).not.toHaveBeenCalled();
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

  it('leaves the dashboard resume action visible after saving from a direct link to the plan', async () => {
    savePlanResume('u-1', 'org-a', 'properties');
    renderWith(<FirstRunWizard />);
    await waitFor(() => expect(onboardingApi.getPlan).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('casazen:welcome-seen:u-1')).toBeNull();
  });

  it('keeps the connected plan out of the welcome when property.read is missing', async () => {
    workspace.canReadProperties = false;
    renderWith(<FirstRunWizard />);
    await waitFor(() => expect(onboardingApi.getPath).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('first-run-wizard')).not.toBeInTheDocument();
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

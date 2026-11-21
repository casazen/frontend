import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { onboardingApi } from '@/api/onboarding.api';
import { propertiesApi } from '@/api/properties.api';
import { wizardDraftApi } from '@/api/wizard-draft.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { OnboardingPartMissing } from '@/types/onboarding.types';
import type { Property } from '@/types';
import { OnboardingPartPage } from '../onboarding-part-page';
import { OWNER, plan } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { getPlan: vi.fn(), getFlowProperties: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/wizard-draft.api', () => ({
  WIZARD_DRAFTS_KEY: ['wizard-drafts'],
  wizardDraftApi: { get: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const LUGANO = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const ZURICH = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const STRANGER = '11111111-2222-4333-8444-555555555555';

const properties = [
  { id: LUGANO, name: 'Casa Lugano', city: 'Lugano' },
  { id: ZURICH, name: 'Studio Zurigo', city: 'Zurigo' },
] as Property[];

const MISSING_NUMBER: OnboardingPartMissing = { propertyId: LUGANO, reason: 'ticino_structure_id_missing', code: 'guest-registration' };
const MISSING_MUNICIPALITY: OnboardingPartMissing = { propertyId: ZURICH, reason: 'swiss_municipality_missing', code: 'guest-registration' };

/** The plan of a host with active properties in Switzerland: the part is open, with what each property lacks. */
function swissPlan(missing: OnboardingPartMissing[] | undefined, extra: Record<string, unknown> = {}) {
  return plan({
    guestRegistration: { state: 'open', reason: 'swiss_municipality_missing', done: 1, total: 1 + (missing?.length ?? 0), launchTarget: 'guestRegistration', ...(missing ? { missing } : {}), ...extra },
  });
}

function renderPage(features: Partial<typeof DEFAULT_FEATURE_FLAGS> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...features }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/app/short-rent/onboarding/parts/guestRegistration']}>
            <Routes>
              <Route path="/app/short-rent/onboarding/parts/:partKey" element={<OnboardingPartPage />} />
              <Route path="*" element={<p data-testid="arrived" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  workspace.hasPermission = () => true;
  vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(swissPlan([MISSING_NUMBER, MISSING_MUNICIPALITY]));
  vi.mocked(onboardingApi.getFlowProperties).mockReset();
  vi.mocked(propertiesApi.getAll).mockReset().mockResolvedValue(properties);
  vi.mocked(wizardDraftApi.get).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

// E29/F02/US02/T01, point 4: the part «Guest registration» lists its missing items with «Fai ora» reopening the wizard at the right step.
describe('OnboardingPartPage, the part «Notifica degli ospiti (Svizzera)»', () => {
  it('Part_ActivePropertiesThatLackSomething_AreListedByNameWithWhatIsMissingAndFaiOraOpeningTheWizardOnItsSwissStep', async () => {
    renderPage();

    const list = await screen.findByTestId('part-missing-list');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('onboardingPlan.parts.guestRegistration.title'));
    expect(screen.getByTestId('onboarding-part-progress')).toHaveTextContent(t('onboardingPlan.progress', { done: 1, total: 3 }));
    // Each property by its name and its comune, with what it lacks in plain words.
    const number = await within(list).findByTestId(`part-missing-${LUGANO}`);
    expect(number).toHaveTextContent('Casa Lugano');
    expect(number).toHaveTextContent('Lugano');
    expect(within(number).getByTestId(`part-missing-${LUGANO}-reason`)).toHaveTextContent(t('onboardingPlan.reasons.property.ticino_structure_id_missing'));
    expect(within(list).getByTestId(`part-missing-${ZURICH}`)).toHaveTextContent('Studio Zurigo');
    expect(within(list).getByTestId(`part-missing-${ZURICH}-reason`)).toHaveTextContent(t('onboardingPlan.reasons.property.swiss_municipality_missing'));
    // «Fai ora» reopens the activation wizard of THAT property on the step of the notification, in the same tab.
    const doNow = within(list).getByTestId(`part-missing-${LUGANO}-do`);
    expect(doNow).toHaveAttribute('href', `/app/short-rent/properties/${LUGANO}/activation?step=guest-registration`);
    expect(doNow).toHaveAccessibleName(`${t('onboardingPlan.actions.doNow')}: Casa Lugano`);
    expect(within(list).getByTestId(`part-missing-${ZURICH}-do`)).toHaveAttribute('href', `/app/short-rent/properties/${ZURICH}/activation?step=guest-registration`);
    // The one button of the part would only repeat them: «Torna al piano» is the only one left.
    expect(screen.queryByTestId('part-launch-primary')).not.toBeInTheDocument();
    expect(screen.getByTestId('part-launch-back')).toHaveAttribute('href', '/app/short-rent/onboarding');
  });

  it('Part_ThePlanListsFewerPropertiesThanLackSomething_SaysHowManyMoreThereAre', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(swissPlan([MISSING_NUMBER], { done: 1, total: 61 }));
    renderPage();

    expect(await screen.findByTestId('part-missing-more')).toHaveTextContent(t('onboardingPlan.part.missing.more', { count: 59 }));
    expect(screen.getAllByTestId(/^part-missing-[0-9a-f-]{36}$/)).toHaveLength(1);
  });

  it('Part_APropertyThatIsNotInTheList_IsNeverShownAsAnId', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(swissPlan([{ propertyId: STRANGER, reason: 'swiss_municipality_missing', code: 'guest-registration' }]));
    renderPage();

    const row = await screen.findByTestId(`part-missing-${STRANGER}`);
    expect(row).toHaveTextContent(t('onboardingPlan.part.missing.unnamed'));
    expect(row.textContent).not.toContain(STRANGER);
  });

  it('Part_ThePropertiesCannotBeRead_StillListsWhatIsMissingWithNoName', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValue(new Error('network'));
    renderPage();

    const row = await screen.findByTestId(`part-missing-${LUGANO}`);
    expect(row).toHaveTextContent(t('onboardingPlan.part.missing.unnamed'));
    expect(within(row).getByTestId(`part-missing-${LUGANO}-do`)).toBeInTheDocument();
  });

  it('Part_PersonWhoMayOnlyReadTheProperties_IsNeverSentToAWizardTheyCannotOpen', async () => {
    workspace.hasPermission = (_context, permission) => permission === 'property.read';
    renderPage();

    // The wizard writes the property (`property.write`): a reader gets the list of the properties, the page they may open.
    expect(await screen.findByTestId(`part-missing-${LUGANO}-do`)).toHaveAttribute('href', '/app/short-rent/properties');
  });

  it('Part_PersonWhoMayOpenNothing_IsToldItIsNotAvailableInsteadOfAButtonThatLeadsNowhere', async () => {
    workspace.hasPermission = () => false;
    renderPage();

    expect(await screen.findByTestId(`part-missing-${LUGANO}-unavailable`)).toHaveTextContent(t('onboardingPlan.launch.unavailable.title'));
    expect(screen.queryByTestId(`part-missing-${LUGANO}-do`)).not.toBeInTheDocument();
  });

  it('Part_ReasonOfAPropertyThisVersionDoesNotKnow_IsANeutralLineNeverTheCode', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(swissPlan([{ propertyId: LUGANO, reason: 'something_new', code: 'guest-registration' }]));
    renderPage();

    const reason = await screen.findByTestId(`part-missing-${LUGANO}-reason`);
    expect(reason).toHaveTextContent(t('onboardingPlan.reasons.property.unknown'));
    expect(reason).not.toHaveTextContent('something_new');
  });

  it('Part_ThePlanOfAnOlderServerHasNoList_ThePartReadsAsItAlwaysDidWithItsOneButton', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(swissPlan(undefined, { done: 0, total: 2 }));
    renderPage();

    expect(await screen.findByTestId('part-launch-primary')).toHaveAttribute('href', '/app/short-rent/properties');
    expect(screen.queryByTestId('part-missing')).not.toBeInTheDocument();
  });

  it('Part_NothingIsMissingAnyMore_IsDoneAndListsNothing', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ guestRegistration: { state: 'done', reason: null, done: 2, total: 2, launchTarget: 'guestRegistration', missing: [] } }));
    renderPage();

    expect(await screen.findByTestId('onboarding-part-state')).toHaveTextContent(t('onboardingPlan.states.done'));
    expect(screen.queryByTestId('part-missing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('part-launch-primary')).not.toBeInTheDocument();
  });

  // The part counts the ACTIVE properties only: a host with none has nothing to do here, and the page of the part says so.
  it('Part_NoActiveSwissProperty_SaysThereIsNothingToDoHere', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan());
    renderPage();

    expect(await screen.findByTestId('onboarding-part-state')).toHaveTextContent(t('onboardingPlan.states.notAvailable'));
    expect(screen.getByTestId('onboarding-part-reason')).toHaveTextContent(t('onboardingPlan.reasons.no_swiss_property'));
    expect(screen.queryByTestId('part-missing')).not.toBeInTheDocument();
  });

  it('Part_TheListInEnglish_SpeaksEnglishAndHasNoAccessibilityViolation', async () => {
    await i18n.changeLanguage('en');
    const { container } = renderPage();

    const list = await screen.findByTestId('part-missing');
    expect(list).toHaveTextContent(t('onboardingPlan.part.missing.title'));
    expect(await screen.findByText('Casa Lugano')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/onboardingPlan\.|guestRegistration\./);
    await expectNoAxeViolations(container);
  });
});

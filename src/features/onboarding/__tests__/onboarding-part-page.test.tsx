import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { onboardingApi } from '@/api/onboarding.api';
import { wizardDraftApi } from '@/api/wizard-draft.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { FlowPropertyStatus, PagedFlowProperties } from '@/types/onboarding.types';
import { OnboardingPartPage } from '../onboarding-part-page';
import { OWNER, plan } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { getPlan: vi.fn(), getFlowProperties: vi.fn() } }));
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

const PROPERTY = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';

function status(overrides: Partial<FlowPropertyStatus> = {}): FlowPropertyStatus {
  return {
    propertyId: PROPERTY,
    name: 'Casa del Mare',
    city: 'Rimini',
    flow: 'CheckInCompliance',
    state: 'toComplete',
    reason: 'sender_missing',
    action: 'chooseSender',
    prerequisites: [],
    ...overrides,
  };
}

function page(items: FlowPropertyStatus[], totalCount = items.length): PagedFlowProperties {
  return { items, totalCount, page: 1, pageSize: 20 };
}

function Arrived() {
  const location = useLocation();
  return <p data-testid="arrived">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(entry: string, features: Partial<typeof DEFAULT_FEATURE_FLAGS> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...features }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/app/short-rent/onboarding/parts/:partKey" element={<OnboardingPartPage />} />
              <Route path="*" element={<Arrived />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  workspace.hasPermission = () => true;
  vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan({ compliance: { state: 'open', reason: 'sender_missing', done: 0, total: 1, needs: ['alloggiatiCredentials'], launchTarget: 'compliance' } }));
  vi.mocked(onboardingApi.getFlowProperties).mockReset().mockResolvedValue(page([status()]));
  vi.mocked(wizardDraftApi.get).mockReset().mockResolvedValue(null);
  vi.mocked(wizardDraftApi.save).mockReset().mockResolvedValue({ status: 'saved', version: 1, lastSavedAt: '2026-11-10T10:00:00Z' });
  vi.mocked(wizardDraftApi.remove).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('OnboardingPartPage, one part of the plan (E10/F03/US02/T02)', () => {
  it('OnboardingPartPage_UnknownPartKey_LeadsToThePlan', async () => {
    renderPage('/app/short-rent/onboarding/parts/telepathy');

    expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding');
  });

  it('OnboardingPartPage_PartOfThePlan_ShowsWhatItNeedsItsStateAndTheOneButtonThatOpensItsWizard', async () => {
    renderPage('/app/short-rent/onboarding/parts/compliance');

    const status = await screen.findByTestId('onboarding-part-status');
    expect(status).toHaveTextContent(i18n.t('onboardingPlan.states.open'));
    expect(screen.getByTestId('onboarding-part-needs')).toHaveTextContent(i18n.t('onboardingPlan.needs.alloggiatiCredentials'));
    expect(screen.getByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.sender_missing'));
    expect(screen.getByTestId('part-launch-primary')).toHaveAttribute('href', '/app/short-rent/compliance');
    expect(screen.getByTestId('part-launch-back')).toHaveAttribute('href', '/app/short-rent/onboarding');
  });

  it('OnboardingPartPage_FatturazionePart_OpensTheWizardAtTheStepOfItsFirstMissingItem', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(
      plan({ fiscalDocuments: { state: 'open', reason: 'guest_series_unconfirmed', done: 2, total: 5, launchTarget: 'fiscal' } }),
    );
    vi.mocked(onboardingApi.getFlowProperties).mockResolvedValue(page([]));
    renderPage('/app/short-rent/onboarding/parts/fiscalDocuments', { fiscalDocumentIssuance: true });

    expect(await screen.findByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('billingWizard.items.guest_series_unconfirmed'));
    expect(screen.getByTestId('onboarding-part-progress')).toHaveTextContent(i18n.t('onboardingPlan.progress', { done: 2, total: 5 }));
    // «Riprendi» opens the wizard «Fatturazione» at the step the item belongs to, in the same tab.
    expect(screen.getByTestId('part-launch-primary')).toHaveAttribute('href', '/app/short-rent/fiscal/setup?step=numbering');
  });

  it('OnboardingPartPage_FatturazionePartWithTheIssuanceOff_SaysNotYetAvailableAndHasNoButtonToTheWizard', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ fiscalDocuments: { state: 'open', reason: 'issuer_missing', done: 0, total: 1, launchTarget: 'fiscal' } }));
    vi.mocked(onboardingApi.getFlowProperties).mockResolvedValue(page([]));
    renderPage('/app/short-rent/onboarding/parts/fiscalDocuments');

    expect(await screen.findByTestId('onboarding-part-reason')).toHaveTextContent(i18n.t('onboardingPlan.reasons.issuer_missing'));
    expect(await screen.findByTestId('part-launch-unavailable')).toHaveTextContent(i18n.t('onboardingPlan.launch.unavailable.title'));
    expect(screen.queryByTestId('part-launch-primary')).not.toBeInTheDocument();
    cleanup();
    renderPage('/app/short-rent/onboarding/parts/fiscalDocuments', { fiscalDocumentIssuance: true });
    expect(await screen.findByTestId('part-launch-primary')).toHaveAttribute('href', '/app/short-rent/fiscal/setup');
  });

  it('OnboardingPartPage_FatturazionePartWithTheIssuanceOff_HasNoButtonToTheWizardOnItsPropertiesEither', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ fiscalDocuments: { state: 'open', reason: 'issuer_missing', done: 0, total: 1, launchTarget: 'fiscal' } }));
    vi.mocked(onboardingApi.getFlowProperties).mockResolvedValue(
      page([status({ flow: 'Documents', state: 'toComplete', reason: 'issuer_missing', action: 'chooseIssuer' })]),
    );
    renderPage('/app/short-rent/onboarding/parts/fiscalDocuments');

    const row = await screen.findByTestId(`part-property-${PROPERTY}`);
    expect(within(row).queryByTestId(`part-property-${PROPERTY}-do`)).not.toBeInTheDocument();
    expect(within(row).getByTestId(`part-property-${PROPERTY}-unavailable`)).toHaveTextContent(i18n.t('onboardingPlan.launch.unavailable.title'));
  });

  it('OnboardingPartPage_PropertiesOfThePart_ShowTheirStateWhatIsMissingAndAFaiOraForThatProperty', async () => {
    renderPage('/app/short-rent/onboarding/parts/compliance');

    const row = await screen.findByTestId(`part-property-${PROPERTY}`);
    expect(onboardingApi.getFlowProperties).toHaveBeenCalledWith('CheckInCompliance', { page: 1, pageSize: 20, search: undefined });
    expect(row).toHaveAttribute('data-state', 'toComplete');
    expect(within(row).getByTestId('flow-state')).toHaveTextContent(i18n.t('onboardingPlan.flows.states.toComplete'));
    expect(screen.getByTestId(`part-property-${PROPERTY}-reason`)).toHaveTextContent(i18n.t('onboardingPlan.reasons.property.sender_missing'));
    expect(screen.getByTestId(`part-property-${PROPERTY}-do`)).toHaveAttribute('href', `/app/short-rent/compliance/sender?property=${PROPERTY}`);
    // The compliance part adds the guided steps of the police and ISTAT for each property.
    expect(screen.getByTestId(`part-property-${PROPERTY}-police`)).toHaveAttribute('href', `/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY}`);
    expect(screen.getByTestId(`part-property-${PROPERTY}-istat`)).toHaveAttribute('href', `/app/short-rent/onboarding/panel/istat?propertyId=${PROPERTY}`);
  });

  it('OnboardingPartPage_ComplianceOfAHostWhoChoseNewListings_SendsPoliceAndIstatToTheAssistFirst', async () => {
    vi.mocked(wizardDraftApi.get).mockResolvedValue({ type: 'OnboardingActivation', entityId: null, version: 3, lastSavedAt: new Date().toISOString(), data: { shape: 1, step: 'scenario', values: { scenario: 'newInventory' } } });
    renderPage('/app/short-rent/onboarding/parts/compliance');

    await waitFor(() => expect(screen.getByTestId(`part-property-${PROPERTY}-police`)).toHaveAttribute('href', `/app/short-rent/onboarding/panel/police?propertyId=${PROPERTY}&assist=1`));
  });

  it('OnboardingPartPage_NoPageThePersonCanOpen_SaysNotAvailableYetWithNoLink', async () => {
    workspace.hasPermission = () => false;
    renderPage('/app/short-rent/onboarding/parts/compliance');

    const unavailable = await screen.findByTestId('part-launch-unavailable');
    expect(unavailable).toHaveTextContent(i18n.t('onboardingPlan.launch.unavailable.title'));
    expect(screen.queryByTestId('part-launch-primary')).not.toBeInTheDocument();
    expect(screen.getByTestId('part-launch-back')).toBeInTheDocument();
  });

  it('OnboardingPartPage_MessagesPart_OpensTheInboxNowThatItIsRegistered', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ messagesAi: { state: 'open', reason: null, launchTarget: 'messages' } }));
    vi.mocked(onboardingApi.getFlowProperties).mockResolvedValue(page([]));
    renderPage('/app/short-rent/onboarding/parts/messagesAi');

    expect(await screen.findByTestId('part-launch-primary')).toHaveAttribute('href', '/app/short-rent/messages');
  });

  it('does not offer a channel connection or load its draft to a reader without OTA write access', async () => {
    workspace.hasPermission = (_context, permission) => permission === 'property.read';
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ octorateConnection: { state: 'open' } }));
    renderPage('/app/short-rent/onboarding/parts/octorateConnection', { octorateConnector: true });
    expect(await screen.findByTestId('part-launch-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('part-entry-question')).not.toBeInTheDocument();
    expect(wizardDraftApi.get).not.toHaveBeenCalled();
  });

  it('OnboardingPartPage_FirstPart_AsksWhereTheListingsAreAndKeepsTheAnswerInTheServerDraftBeforeOpeningTheConnectRoute', async () => {
    vi.mocked(onboardingApi.getPlan).mockResolvedValue(plan({ octorateConnection: { state: 'open', reason: 'inventory_scenario_missing', done: 0, total: 1, deferrable: false } }));
    renderPage('/app/short-rent/onboarding/parts/octorateConnection', { octorateConnector: true });

    expect(await screen.findByTestId('part-entry-question')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByTestId('part-entry-continue')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('part-entry-onOtas'));

    expect(screen.getByTestId('part-entry-continue')).toHaveAttribute('href', '/app/short-rent/integrations/octorate?scenario=onOtas&planPart=octorateConnection');
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledWith('OnboardingActivation', expect.objectContaining({ data: expect.objectContaining({ step: 'scenario', values: expect.objectContaining({ scenario: 'onOtas' }) }) })));
    fireEvent.click(screen.getByTestId('part-entry-newInventory'));
    expect(screen.getByTestId('part-entry-continue')).toHaveAttribute('href', '/app/short-rent/integrations/octorate?scenario=newInventory&planPart=octorateConnection');
    fireEvent.click(screen.getByTestId('part-entry-mixed'));
    expect(screen.getByTestId('part-entry-continue')).toHaveAttribute('href', '/app/short-rent/integrations/octorate?scenario=mixed&planPart=octorateConnection');
  });

  it('OnboardingPartPage_Page_HasNoViolationThatAxeCanFindWithoutABrowser', async () => {
    const { container } = renderPage('/app/short-rent/onboarding/parts/compliance');
    await screen.findByTestId(`part-property-${PROPERTY}`);

    await expectNoAxeViolations(container);
  });
});

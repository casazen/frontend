import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { ONBOARDING_PART_KEYS, type IntegrationOverview, type IntegrationPart, type OnboardingPartKey } from '@/types/onboarding.types';
import { IntegrationSettingsPage } from '../integration-settings-page';
import { COLLABORATOR, OWNER, part, problemError } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getIntegration: vi.fn(), reopenPart: vi.fn() },
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

const SETTINGS_PATH = '/app/short-rent/settings/integration';

function integrationPart(code: OnboardingPartKey, overrides: Partial<IntegrationPart> = {}): IntegrationPart {
  return { ...part(code, { state: 'done', launchTarget: 'connect' }), reopenable: true, ...overrides };
}

/** The eleven parts as the settings answer them; the three nobody provides yet cannot be reopened. */
function overview(overrides: Partial<IntegrationOverview> = {}): IntegrationOverview {
  const launchTargets: Record<OnboardingPartKey, IntegrationPart['launchTarget']> = {
    octorateConnection: 'connect',
    properties: 'mapping',
    channels: 'channels',
    listings: 'listings',
    pricesRules: 'prices',
    compliance: 'compliance',
    identification: 'identification',
    messagesAi: 'messages',
    fiscalDocuments: 'fiscal',
    partners: 'marketplace',
    activation: 'summary',
  };
  return {
    connection: { status: 'Connected', environment: 'Production', lastSyncedAt: '2026-11-10T08:30:00Z', reconnectRequired: false },
    parts: ONBOARDING_PART_KEYS.map((code) =>
      integrationPart(code, {
        launchTarget: launchTargets[code],
        ...(code === 'partners' ? { state: 'notAvailable', reason: 'not_provided', reopenable: false } : {}),
      }),
    ),
    senders: { channelManager: 3, casaZen: 1, manual: 2, notSet: 4 },
    channels: [
      { status: 'Draft', count: 1 },
      { status: 'Published', count: 7 },
      { status: 'ToFix', count: 2 },
    ],
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[SETTINGS_PATH]}>
          <Routes>
            <Route path={SETTINGS_PATH} element={<IntegrationSettingsPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.contexts = OWNER;
  workspace.hasPermission = () => true;
  vi.mocked(onboardingApi.getIntegration).mockReset().mockResolvedValue(overview());
  vi.mocked(onboardingApi.reopenPart).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('IntegrationSettingsPage, the integration settings (E10/F03/US03/T01)', () => {
  it('IntegrationSettingsPage_NotAnOrganizationAdministrator_ReadsWhoManagesItAndSendsNoRequest', async () => {
    workspace.contexts = COLLABORATOR;
    renderPage();

    expect(await screen.findByTestId('integration-admin-only')).toHaveTextContent(i18n.t('onboardingPlan.integration.adminOnly'));
    expect(screen.queryByTestId('connection-health-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reopen-parts')).not.toBeInTheDocument();
    // The settings are the administrator's: no read for anyone else, so no 403 to meet.
    expect(onboardingApi.getIntegration).not.toHaveBeenCalled();
    expect(onboardingApi.reopenPart).not.toHaveBeenCalled();
  });

  it('IntegrationSettingsPage_Administrator_ShowsTheConnectionThePartsTheSendersAndTheChannelsAndNeverAToken', async () => {
    renderPage();

    const card = await screen.findByTestId('connection-health-card');
    expect(within(card).getByTestId('connection-state')).toHaveTextContent(i18n.t('onboardingPlan.integration.connection.state.connected'));
    expect(within(card).getByTestId('connection-last-sync')).toHaveTextContent('2026');
    expect(within(card).getByTestId('connection-last-sync')).not.toHaveTextContent(i18n.t('onboardingPlan.integration.connection.neverSynced'));
    // Production: no «prova» label; connected: no notice of reconnection.
    expect(within(card).queryByTestId('connection-environment-test')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('connection-reconnect')).not.toBeInTheDocument();
    // The eleven parts, each with its state and «Riapri».
    expect(screen.getByTestId('reopen-parts-list').querySelectorAll('li')).toHaveLength(11);
    for (const code of ONBOARDING_PART_KEYS) expect(screen.getByTestId(`reopen-part-${code}-action`)).toBeInTheDocument();
    // Who sends the schedine, for how many properties; the listings by status (every status the server sent).
    expect(screen.getByTestId('integration-sender-channelManager')).toHaveTextContent('3');
    expect(screen.getByTestId('integration-sender-notSet')).toHaveTextContent('4');
    expect(screen.getByTestId('integration-channel-Published')).toHaveTextContent('7');
    expect(screen.getByTestId('integration-channel-ToFix')).toHaveTextContent(i18n.t('onboardingPlan.integration.channels.status.ToFix'));
    // Nothing of a token or a secret is in the page.
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/token|secret|password/);
  });

  it('ConnectionHealthCard_TestEnvironmentWithNoSyncYet_SaysProvaAndNonAncoraSincronizzato', async () => {
    vi.mocked(onboardingApi.getIntegration).mockResolvedValue(overview({ connection: { status: 'Connected', environment: 'Test', lastSyncedAt: null, reconnectRequired: false } }));
    renderPage();

    const card = await screen.findByTestId('connection-health-card');
    expect(within(card).getByTestId('connection-environment-test')).toHaveTextContent(i18n.t('onboardingPlan.integration.connection.environmentTest'));
    expect(within(card).getByTestId('connection-last-sync')).toHaveTextContent(i18n.t('onboardingPlan.integration.connection.neverSynced'));
  });

  it.each(['Disconnected', 'Error'] as const)('ConnectionHealthCard_Access%sAndReconnectRequired_ShowsTheRedNoticeAndRiCollegaIlCanaleAtTheConsentStep', async (status) => {
    vi.mocked(onboardingApi.getIntegration).mockResolvedValue(overview({ connection: { status, environment: 'Production', lastSyncedAt: '2026-11-01T10:00:00Z', reconnectRequired: true } }));
    renderPage();

    const card = await screen.findByTestId('connection-health-card');
    expect(within(card).getByTestId('connection-state')).toHaveAttribute('data-state', status === 'Disconnected' ? 'disconnected' : 'error');
    const notice = within(card).getByTestId('connection-reconnect');
    expect(notice).toHaveAttribute('role', 'alert');
    expect(notice).toHaveTextContent(i18n.t('onboardingPlan.integration.connection.reconnect.notice'));
    // The primary button opens the connect wizard at the consent step, in the same tab.
    const action = within(notice).getByTestId('connection-reconnect-action');
    expect(action).toHaveAttribute('href', '/app/short-rent/integrations/octorate?step=consent');
    expect(action).not.toHaveAttribute('target');
    expect(within(notice).getByTestId('connection-reconnect-todo')).toHaveAttribute('href', '/app/short-rent/activities');
  });

  it('ConnectionHealthCard_ReconnectWithNoPageTheAdministratorMayOpen_SaysNonAncoraDisponibileNeverADeadLink', async () => {
    workspace.hasPermission = () => false;
    vi.mocked(onboardingApi.getIntegration).mockResolvedValue(overview({ connection: { status: 'Error', environment: 'Production', lastSyncedAt: null, reconnectRequired: true } }));
    renderPage();

    const unavailable = await screen.findByTestId('connection-reconnect-unavailable');
    expect(unavailable).toHaveTextContent(i18n.t('onboardingPlan.integration.connection.reconnect.unavailable'));
    expect(screen.queryByTestId('connection-reconnect-action')).not.toBeInTheDocument();
  });

  it('ConnectionHealthCard_AStatusThisVersionDoesNotKnow_IsNeverReadAsConnected', async () => {
    vi.mocked(onboardingApi.getIntegration).mockResolvedValue(
      overview({ connection: { status: 'Quarantined' as never, environment: 'Production', lastSyncedAt: null, reconnectRequired: false } }),
    );
    renderPage();

    expect(await screen.findByTestId('connection-state')).toHaveAttribute('data-state', 'unknown');
    expect(screen.getByTestId('connection-state')).not.toHaveTextContent(i18n.t('onboardingPlan.integration.connection.state.connected'));
  });

  it('ReopenPartsList_CambiaChiInviaLeSchedine_ReopensCompliancePutsTheAdministratorOnTheSenderStep', async () => {
    vi.mocked(onboardingApi.reopenPart).mockResolvedValue({ code: 'compliance', launchTarget: 'compliance', focus: 'sender' });
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-quick-compliance'));

    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
    expect(onboardingApi.reopenPart).toHaveBeenCalledTimes(1);
    expect(onboardingApi.reopenPart).toHaveBeenCalledWith('compliance');
    expect(screen.getByTestId('where').textContent).toMatch(/^\/app\/short-rent\/compliance/);
  });

  it('ReopenPartsList_AddAChannelAndAddProperties_ReopenTheChannelsAndThePropertiesParts', async () => {
    vi.mocked(onboardingApi.reopenPart).mockImplementation((code) => Promise.resolve({ code, launchTarget: code === 'channels' ? 'channels' : 'mapping', focus: null }));
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-quick-channels'));
    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
    expect(onboardingApi.reopenPart).toHaveBeenLastCalledWith('channels');
    cleanup();

    renderPage();
    fireEvent.click(await screen.findByTestId('reopen-quick-properties'));
    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
    expect(onboardingApi.reopenPart).toHaveBeenLastCalledWith('properties');
  });

  it('ReopenPartsList_RiapriOnAPart_ReopensItAndGoesToTheWizardThatOwnsIt', async () => {
    vi.mocked(onboardingApi.reopenPart).mockResolvedValue({ code: 'octorateConnection', launchTarget: 'connect', focus: null });
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-part-octorateConnection-action'));

    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
    expect(onboardingApi.reopenPart).toHaveBeenCalledWith('octorateConnection');
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/integrations/octorate?step=consent');
  });

  it('ReopenPartsList_ATargetWithNoPageYet_KeepsThePersonOnThePageWithNonAncoraDisponibile', async () => {
    // The answer names a wizard this version of the app has no page for: no navigation, no dead link.
    vi.mocked(onboardingApi.reopenPart).mockResolvedValue({ code: 'listings', launchTarget: 'brandNewWizard' as never, focus: null });
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-part-listings-action'));

    expect(await screen.findByTestId('reopen-part-listings-unavailable')).toHaveTextContent(i18n.t('onboardingPlan.integration.parts.unavailable'));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('ReopenPartsList_APartNobodyProvides_CannotBeReopenedAndSaysWhy', async () => {
    renderPage();

    const action = await screen.findByTestId('reopen-part-partners-action');
    expect(action).toBeDisabled();
    expect(screen.getByTestId('reopen-part-partners-note')).toHaveTextContent(i18n.t('onboardingPlan.integration.parts.notReopenable'));
    fireEvent.click(action);
    expect(onboardingApi.reopenPart).not.toHaveBeenCalled();
  });

  it('ReopenPartsList_WhileAReopenIsOnItsWay_EveryButtonOfThePageIsOffAndASecondPressDoesNothing', async () => {
    let finish: (value: { code: OnboardingPartKey; launchTarget: 'connect'; focus: null }) => void = () => undefined;
    vi.mocked(onboardingApi.reopenPart).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-part-listings-action'));

    await waitFor(() => expect(screen.getByTestId('reopen-part-compliance-action')).toBeDisabled());
    for (const code of ONBOARDING_PART_KEYS) {
      if (code === 'listings') continue;
      expect(screen.getByTestId(`reopen-part-${code}-action`), code).toBeDisabled();
    }
    for (const code of ['compliance', 'channels', 'properties']) expect(screen.getByTestId(`reopen-quick-${code}`), code).toBeDisabled();
    // The one that was pressed ignores a second press: the server is asked once.
    fireEvent.click(screen.getByTestId('reopen-part-listings-action'));
    expect(onboardingApi.reopenPart).toHaveBeenCalledTimes(1);
    finish({ code: 'listings', launchTarget: 'connect', focus: null });
    await waitFor(() => expect(screen.getByTestId('where')).toBeInTheDocument());
  });

  it('ReopenPartsList_TheServerRefusesTheReopen_SaysSoWhereThePersonLooksAndStaysOnThePage', async () => {
    vi.mocked(onboardingApi.reopenPart).mockRejectedValue(problemError(422, { code: 'onboarding_part_not_reopenable', detail: 'Questo passo non si può riaprire.' }));
    renderPage();

    fireEvent.click(await screen.findByTestId('reopen-part-listings-action'));

    expect(await screen.findByTestId('reopen-error')).toHaveTextContent('Questo passo non si può riaprire.');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    // The buttons are back once the refusal is in.
    await waitFor(() => expect(screen.getByTestId('reopen-part-listings-action')).toBeEnabled());
  });

  it('IntegrationSettingsPage_TheReadFails_SaysItFailedWithARetryNeverThatAllIsInOrder', async () => {
    vi.mocked(onboardingApi.getIntegration).mockRejectedValueOnce(problemError(500, {})).mockResolvedValue(overview());
    renderPage();

    const error = await screen.findByTestId('integration-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent(i18n.t('onboardingPlan.integration.loadError'));
    expect(screen.queryByTestId('connection-health-card')).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('shared.errorState.retry') }));

    expect(await screen.findByTestId('connection-health-card')).toBeInTheDocument();
  });

  it('IntegrationSettingsPage_A404_IsNotFoundAndNotACardOfTheConnection', async () => {
    vi.mocked(onboardingApi.getIntegration).mockRejectedValue(problemError(404, {}));
    renderPage();

    expect(await screen.findByTestId('integration-error')).toHaveTextContent(i18n.t('onboardingPlan.integration.notFound'));
    expect(screen.queryByTestId('connection-health-card')).not.toBeInTheDocument();
  });
});

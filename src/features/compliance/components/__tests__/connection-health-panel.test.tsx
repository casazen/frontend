import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceHealthApi } from '@/api/compliance-health.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { ComplianceConnectionHealth, ConnectionHealthLine } from '@/types';
import { ConnectionHealthPanel } from '../connection-health-panel';

vi.mock('@/api/compliance-health.api', () => ({ complianceHealthApi: { getConnectionHealth: vi.fn() } }));
vi.mock('@/api/compliance-handoff.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance-handoff.api')>()),
  complianceHandoffApi: { start: vi.fn() },
}));
const workspace = vi.hoisted(() => ({ permissions: ['property.read', 'booking.read'] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => context === 'short-rent' && workspace.permissions.includes(permission) }),
}));

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

const line = (change: Partial<ConnectionHealthLine> = {}): ConnectionHealthLine => ({
  sender: 'ChannelManager',
  state: 'Active',
  connectionValid: true,
  autorun: true,
  lastAutomaticRunAt: '2026-10-12T12:05:00Z',
  reason: null,
  declaredAt: null,
  ...change,
});

const health = (change: Partial<ComplianceConnectionHealth> = {}): ComplianceConnectionHealth => ({
  propertyId: PROPERTY_ID,
  applies: true,
  alloggiati: line(),
  istat: line(),
  credentialsInCasaZen: false,
  credentialsUsable: false,
  checkedAt: '2026-11-13T10:00:00Z',
  ...change,
});

function problem(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: {}, statusText: '', headers: {}, config });
}

function renderPanel(connector = false, timeZone: string | undefined = 'Europe/Rome') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        FeatureFlagsContext.Provider,
        { value: { flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false } },
        createElement(MemoryRouter, null, createElement(ConnectionHealthPanel, { propertyId: PROPERTY_ID, timeZone })),
      ),
    ),
  );
}

const state = (topic: 'Alloggiati' | 'Istat') => screen.getByTestId(`connection-health-${topic}-state`);

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = ['property.read', 'booking.read'];
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

// E03/F03/US02/T01 (NF-52, AC-NF52-11, CHK-12 point 7).
describe('ConnectionHealthPanel', () => {
  it('ConnectionHealthPanel_ActiveChannelManager_ShowsSenderStateAndLastRunInThePropertyTimeZone', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health());
    renderPanel(false, 'Europe/Rome');

    await screen.findByTestId('connection-health-Alloggiati');
    expect(screen.getByTestId('connection-health-panel')).toHaveTextContent('Invio a Polizia e ISTAT');
    expect(screen.getByTestId('connection-health-Alloggiati-sender')).toHaveTextContent('Il tuo channel manager invia i dati');
    expect(state('Alloggiati')).toHaveTextContent('Attivo');
    expect(state('Istat')).toHaveTextContent('Attivo');
    expect(screen.getByTestId('connection-health-Alloggiati-last-run')).toHaveTextContent('14:05');
    expect(screen.getByTestId('connection-health-Alloggiati')).toHaveAttribute('data-state', 'Active');
    expect(complianceHealthApi.getConnectionHealth).toHaveBeenCalledExactlyOnceWith(PROPERTY_ID);
  });

  it('ConnectionHealthPanel_PropertyInAnotherTimeZone_TellsTheRunInIt', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health());
    renderPanel(false, 'America/New_York');

    expect(await screen.findByTestId('connection-health-Alloggiati-last-run')).toHaveTextContent('08:05');
  });

  // AC 2: an unreadable connection shows «cannot verify» with instructions, never a green state.
  it('ConnectionHealthPanel_UnknownConnection_SaysCasaZenCannotVerifyWithInstructionsAndNeverGreen', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(
      health({ alloggiati: line({ state: 'Unknown', connectionValid: null, autorun: null, lastAutomaticRunAt: null, reason: 'octorate_police_not_exposed' }), istat: line({ state: 'Unknown', lastAutomaticRunAt: null }) }),
    );
    renderPanel(false);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Non verificabile');
    expect(state('Alloggiati')).not.toHaveTextContent('Attivo');
    expect(screen.getByTestId('connection-health-Alloggiati-detail')).toHaveTextContent('CasaZen non riesce a verificare questa connessione');
    expect(screen.getByTestId('connection-health-Alloggiati-instructions')).toHaveTextContent("Controlla nel pannello del tuo channel manager");
    expect(screen.getByTestId('connection-health-Alloggiati')).toHaveTextContent('Il channel manager non ci lascia leggere questo stato.');
    // Nothing is told as a run it did not read.
    expect(screen.queryByTestId('connection-health-Alloggiati-last-run')).not.toBeInTheDocument();
  });

  it.each([
    ['a state of a newer API', 'Verified'],
    ['no state at all', undefined],
  ])('ConnectionHealthPanel_%s_IsUnknownNeverActive', async (_what, value) => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ alloggiati: line({ state: value as never }) }));
    renderPanel(false);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Non verificabile');
    expect(state('Alloggiati')).not.toHaveTextContent('Attivo');
  });

  it('ConnectionHealthPanel_InactiveSend_SaysItIsOffAndWhatToDo', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(
      health({ alloggiati: line({ state: 'Inactive', reason: 'octorate_police_autorun_off' }), istat: line({ state: 'Inactive' }) }),
    );
    renderPanel(false);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Non attivo');
    expect(screen.getByTestId('connection-health-Alloggiati-detail')).toHaveTextContent("l'invio non è attivo");
    expect(screen.getByTestId('connection-health-Alloggiati')).toHaveTextContent("L'invio automatico giornaliero è spento nel channel manager.");
    expect(screen.getByTestId('connection-health-Alloggiati-instructions')).toHaveTextContent("Accendi l'invio automatico");
  });

  it('ConnectionHealthPanel_ManualSender_SaysTheHostSendsAndAsksNothing', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(
      health({ alloggiati: line({ sender: 'Manual', state: 'Manual', lastAutomaticRunAt: null }), istat: line({ sender: 'Manual', state: 'Manual', lastAutomaticRunAt: null }) }),
    );
    renderPanel(true);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(screen.getByTestId('connection-health-Alloggiati-sender')).toHaveTextContent('Invio manuale');
    expect(state('Alloggiati')).toHaveTextContent('Manuale');
    expect(screen.queryByTestId('connection-health-Alloggiati-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-health-Alloggiati-verify')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_PropertyOutsideItaly_IsManualWhateverTheLinesSay', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ applies: false }));
    renderPanel(false);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Manuale');
    expect(screen.getByTestId('connection-health-Alloggiati-detail')).toHaveTextContent("Fuori dall'Italia");
    expect(screen.queryByTestId('connection-health-credentials')).not.toBeInTheDocument();
  });

  // The API never says the receipts can be downloaded in this release: neither does the panel.
  it.each([
    ['no credentials in CasaZen', { credentialsInCasaZen: false, credentialsUsable: false }, 'CasaZen non ha le credenziali', false],
    ['credentials saved but not verified', { credentialsInCasaZen: true, credentialsUsable: false }, 'salvate in CasaZen ma non verificate', false],
    ['credentials verified', { credentialsInCasaZen: true, credentialsUsable: true }, 'CasaZen può scaricare le ricevute', true],
  ])('ConnectionHealthPanel_%s_TellsTheReceiptsOnlyAsTheApiSays', async (_what, change, words, canDownload) => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health(change));
    renderPanel(false);

    const credentials = await screen.findByTestId('connection-health-credentials');
    expect(credentials).toHaveTextContent(words);
    expect(credentials.textContent?.includes('può scaricare')).toBe(canDownload);
    // When the receipts do not come by themselves the way to add them is one click away.
    expect(screen.queryByTestId('connection-health-archive-link') !== null).toBe(!canDownload);
    if (!canDownload) {
      expect(screen.getByTestId('connection-health-archive-link')).toHaveAttribute('href', `/app/short-rent/alloggiati/reports?property=${PROPERTY_ID}&tab=proofs`);
    }
  });

  // AC 4: the «activate or reconnect» button is rendered only when the wizard exists in the ROUTE_MANIFEST: there is none here yet.
  it('ConnectionHealthPanel_NoSenderWizardInTheManifest_ShowsTheInstructionsAndNoActivateButton', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ alloggiati: line({ state: 'Inactive' }) }));
    renderPanel(false);

    await screen.findByTestId('connection-health-Alloggiati');
    expect(screen.queryByTestId('connection-health-Alloggiati-activate')).not.toBeInTheDocument();
    expect(screen.getByTestId('connection-health-Alloggiati-instructions')).toBeInTheDocument();
  });

  it('ConnectionHealthPanel_UnknownChannelManagerWithTheConnectorOn_OffersTheSharedVerificationNotAnInternalResultScreen', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ istat: line({ state: 'Unknown', lastAutomaticRunAt: null }) }));
    renderPanel(true);

    await screen.findByTestId('connection-health-Istat');
    expect(screen.getByTestId('connection-health-Istat-verify')).toHaveTextContent('Verifica nel tuo Cassetto Compliance');
    // Active needs no verification.
    expect(screen.queryByTestId('connection-health-Alloggiati-verify')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_UnknownChannelManagerWithTheConnectorOff_HasNoButtonThatCanOnlyFail', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ istat: line({ state: 'Unknown', lastAutomaticRunAt: null }) }));
    renderPanel(false);

    await screen.findByTestId('connection-health-Istat');
    expect(screen.queryByTestId('connection-health-Istat-verify')).not.toBeInTheDocument();
    expect(screen.getByTestId('connection-health-Istat-instructions')).toBeInTheDocument();
  });

  // UX-12: the channel manager is «il tuo channel manager»; the supplier is named only in the closed disclosure.
  it('ConnectionHealthPanel_UnknownChannelManager_NamesTheSupplierOnlyInTheClosedDisclosure', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(health({ alloggiati: line({ state: 'Unknown', reason: 'octorate_unavailable' }), istat: line({ state: 'Inactive', reason: 'octorate_police_account_invalid' }) }));
    renderPanel(false);

    const panel = await screen.findByTestId('connection-health-panel');
    await screen.findByTestId('connection-health-Istat');
    const details = panel.querySelectorAll('details');
    expect(details.length).toBeGreaterThan(0);
    for (const disclosure of details) {
      expect(disclosure).not.toHaveAttribute('open');
      expect(disclosure).toHaveTextContent('Dati consultati su Octorate');
    }
    const outside = panel.cloneNode(true) as HTMLElement;
    outside.querySelectorAll('details').forEach((disclosure) => disclosure.remove());
    expect(outside.textContent).not.toMatch(/octorate/i);
  });

  it('ConnectionHealthPanel_WithoutPropertyRead_ShowsNothingAndAsksNothing', () => {
    workspace.permissions = ['booking.read'];
    renderPanel(false);

    expect(screen.queryByTestId('connection-health-panel')).not.toBeInTheDocument();
    expect(complianceHealthApi.getConnectionHealth).not.toHaveBeenCalled();
  });

  it('ConnectionHealthPanel_WhileItLoads_SaysSoAndShowsNoState', () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockReturnValue(new Promise(() => undefined));
    renderPanel(false);

    expect(screen.getByTestId('connection-health-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('connection-health-Alloggiati')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_ServerError_IsAnErrorWithRetryNeverAStateOrNotFound', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockRejectedValueOnce(problem(500));
    renderPanel(false);

    const error = await screen.findByTestId('connection-health-error');
    expect(error).toHaveTextContent("Non riusciamo a leggere lo stato dell'invio.");
    expect(screen.queryByTestId('connection-health-Alloggiati')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-health-not-found')).not.toBeInTheDocument();

    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValueOnce(health());
    fireEvent.click(within(error).getByRole('button', { name: /riprova/i }));
    await screen.findByTestId('connection-health-Alloggiati');
  });

  // A 404 is «not found» even with the older answer still in the cache (the query keeps the last data on an error).
  it('ConnectionHealthPanel_404AfterAnAnswer_IsNotFoundNeverTheOlderState', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValueOnce(health());
    renderPanel(false);
    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Attivo');

    vi.mocked(complianceHealthApi.getConnectionHealth).mockRejectedValueOnce(problem(404));
    fireEvent.click(screen.getByTestId('connection-health-refresh'));

    expect(await screen.findByTestId('connection-health-not-found')).toHaveTextContent('Non troviamo questo immobile.');
    expect(screen.queryByTestId('connection-health-Alloggiati')).not.toBeInTheDocument();
  });

  it('ConnectionHealthPanel_Refresh_ReadsAgainAndWaitsWhileItDoes', async () => {
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValueOnce(health({ alloggiati: line({ state: 'Unknown', lastAutomaticRunAt: null }) }));
    renderPanel(false);
    await screen.findByTestId('connection-health-Alloggiati');
    expect(state('Alloggiati')).toHaveTextContent('Non verificabile');

    let answer: (value: ComplianceConnectionHealth) => void = () => undefined;
    vi.mocked(complianceHealthApi.getConnectionHealth).mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const refresh = screen.getByTestId('connection-health-refresh');
    fireEvent.click(refresh);
    await waitFor(() => expect(refresh).toBeDisabled());

    answer(health());
    await waitFor(() => expect(state('Alloggiati')).toHaveTextContent('Attivo'));
    expect(refresh).not.toBeDisabled();
  });

  it.each(['it', 'en'])('ConnectionHealthPanel_UnknownAndInactiveLines_HaveNoAccessibilityViolation_%s', async (language) => {
    await i18n.changeLanguage(language);
    vi.mocked(complianceHealthApi.getConnectionHealth).mockResolvedValue(
      health({ alloggiati: line({ state: 'Unknown', reason: 'octorate_police_not_exposed' }), istat: line({ state: 'Inactive' }), credentialsInCasaZen: true }),
    );
    const { container } = renderPanel(true);

    await screen.findByTestId('connection-health-Istat');
    await expectNoAxeViolations(container);
  });
});

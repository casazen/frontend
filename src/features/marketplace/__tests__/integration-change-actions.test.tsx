import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { useUpdateActivationSettings } from '@/queries/use-marketplace';
import type { MarketplaceActiveIntegration, MarketplaceActivationChange, MarketplaceActivationPlan, MarketplaceHealthItem } from '@/types';
import { buildActiveRows, type ActiveRow } from '../lib/active-model';
import { ActiveIntegrationCard } from '../components/active-integration-card';

const api = vi.hoisted(() => ({
  getActivationPlan: vi.fn(),
  updateActivationSettings: vi.fn(),
  requestFunctionChange: vi.fn(),
}));

vi.mock('@/api/marketplace.api', () => ({
  getActivationPlan: api.getActivationPlan,
  updateActivationSettings: api.updateActivationSettings,
  requestFunctionChange: api.requestFunctionChange,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ROSA = { id: 'prop-1', name: 'Villa Rosa' };

const integration = (over: Partial<MarketplaceActiveIntegration> = {}): MarketplaceActiveIntegration => ({
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  property: ROSA,
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: null,
  declaredAt: null,
  verifiedAt: null,
  ...over,
});

const health = (over: Partial<MarketplaceHealthItem> = {}): MarketplaceHealthItem => ({
  activationId: 'act-1',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: null,
  error: null,
  quota: null,
  changeRequestedAt: null,
  ...over,
});

const channelRow = (): ActiveRow => buildActiveRows([integration()], [health()])[0];
const functionRow = (healthOver: Partial<MarketplaceHealthItem> = {}): ActiveRow =>
  buildActiveRows(
    [integration({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat' })],
    [health({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', activationId: 'act-f', ...healthOver })],
  )[0];

const plan = (requirements: string[]): MarketplaceActivationPlan => ({
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  propertyId: 'prop-1',
  requirements,
  creatable: true,
  propertyLinked: true,
  activationId: 'act-1',
  activationStatus: 'Active',
});

const change = (over: Partial<MarketplaceActivationChange> = {}): MarketplaceActivationChange => ({
  activationId: 'act-1',
  kind: 'Channel',
  code: 'PORTAL1',
  propertyId: 'prop-1',
  status: 'Active',
  changeRequestedAt: null,
  ...over,
});

/** An error of the API as axios makes it: the request that failed (with its body, which may hold a password) and the answer. */
function apiError(status: number, data: unknown = {}, body: unknown = { password: 'secret-pass' }): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify(body) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, { status, statusText: '', headers: {}, config, data });
}

let queryClient: QueryClient;

function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function renderCard(row: ActiveRow) {
  return render(
    <Providers>
      <ul>
        <ActiveIntegrationCard row={row} fixTo={null} mayManage />
      </ul>
    </Providers>,
  );
}

async function chooseFromMenu(name: string, item: string) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `Azioni per ${name}` }), { key: 'Enter' });
  await screen.findByRole('menu');
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
  return screen.findByRole('dialog');
}

const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

/** Everything the page keeps in the storage of the browser, as one text. */
const storedText = () => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]);

beforeEach(async () => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  api.getActivationPlan.mockResolvedValue(plan(['hotelId', 'credentials', 'panelAccess']));
  api.updateActivationSettings.mockResolvedValue(change());
  api.requestFunctionChange.mockResolvedValue(change({ kind: 'LicensedFunction', code: 'chat', activationId: 'act-f', changeRequestedAt: '2026-11-13T10:00:00Z' }));
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe('IntegrationSettingsDialog', () => {
  it('IntegrationSettingsDialog_AsksForWhatThePortalAsksFor_AndSendsOnlyWhatWasFilledOnce_NeverKeepingTheCredentials', async () => {
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');

    // The plan of the portal says what it wants: the identifier and the login details.
    await within(dialog).findByTestId('settings-hotel-id');
    expect(api.getActivationPlan).toHaveBeenCalledWith('Channel', 'PORTAL1', 'prop-1');
    expect(screen.getByTestId('settings-password')).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('settings-password')).toHaveAttribute('autocomplete', 'new-password');
    // Nothing to change yet: nothing can be saved.
    expect(screen.getByTestId('settings-save')).toBeDisabled();

    type('settings-username', '  host@example.com ');
    type('settings-password', 'secret-pass');
    expect(screen.getByTestId('settings-save')).toBeEnabled();
    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() => expect(api.updateActivationSettings).toHaveBeenCalledTimes(1));
    // The identifier that was left empty is not sent: no member is «everything».
    expect(api.updateActivationSettings).toHaveBeenCalledWith('act-1', { username: 'host@example.com', password: 'secret-pass' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Impostazioni salvate.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Sent once and forgotten: not in a draft, not in the storage of the browser, not in the address.
    expect(storedText()).not.toContain('secret-pass');
    expect(storedText()).not.toContain('host@example.com');
    expect(window.location.href).not.toContain('secret-pass');
    expect(document.body.innerHTML).not.toContain('secret-pass');
  });

  it('IntegrationSettingsDialog_OnlyTheIdentifierIsAsked_WhenThePortalAsksForNothingElse', async () => {
    api.getActivationPlan.mockResolvedValue(plan(['hotelId']));
    renderCard(channelRow());
    await chooseFromMenu('TEST Portal', 'Modifica impostazioni');

    await screen.findByTestId('settings-hotel-id');
    expect(screen.queryByTestId('settings-username')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-password')).not.toBeInTheDocument();
    type('settings-hotel-id', ' 4711 ');
    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() => expect(api.updateActivationSettings).toHaveBeenCalledWith('act-1', { hotelId: '4711' }));
  });

  it('IntegrationSettingsDialog_PortalWithNothingToChange_SaysSoAndAsksForNothing', async () => {
    api.getActivationPlan.mockResolvedValue(plan(['panelAccess']));
    renderCard(channelRow());
    await chooseFromMenu('TEST Portal', 'Modifica impostazioni');

    expect(await screen.findByTestId('settings-nothing-to-change')).toHaveTextContent('non ci sono impostazioni da modificare');
    expect(screen.queryByTestId('settings-hotel-id')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-save')).toBeDisabled();
    expect(api.updateActivationSettings).not.toHaveBeenCalled();
  });

  it('IntegrationSettingsDialog_PlanNotRead_SaysSoWithARetry_AndSavesNothing', async () => {
    api.getActivationPlan.mockRejectedValue(apiError(500));
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');

    expect(await within(dialog).findByTestId('settings-plan-error')).toHaveTextContent('Non riesco a leggere cosa chiede questo canale');
    expect(screen.getByTestId('settings-save')).toBeDisabled();

    api.getActivationPlan.mockResolvedValue(plan(['hotelId']));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('settings-hotel-id')).toBeInTheDocument();
  });

  it('IntegrationSettingsDialog_Refusal_IsSaidWithWhatWasTypedStillThere_AndNothingIsSavedInTheStorage', async () => {
    api.updateActivationSettings.mockRejectedValue(apiError(502, { code: 'octorate_partner_failed' }));
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');
    await within(dialog).findByTestId('settings-hotel-id');
    type('settings-username', 'host');
    type('settings-password', 'secret-pass');

    fireEvent.click(screen.getByTestId('settings-save'));

    const error = await within(dialog).findByTestId('settings-error');
    expect(error).toHaveTextContent('Il canale non ha accettato la richiesta');
    expect(error).toHaveTextContent('Non è stato cambiato nulla.');
    expect(toast.success).not.toHaveBeenCalled();
    // Kept in the dialog to be corrected, and only there.
    expect(screen.getByTestId('settings-username')).toHaveValue('host');
    expect(screen.getByTestId('settings-password')).toHaveValue('secret-pass');
    expect(storedText()).not.toContain('secret-pass');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('IntegrationSettingsDialog_ConnectionGone409_SaysSoWithoutSendingToAStepOfAWizard', async () => {
    api.updateActivationSettings.mockRejectedValue(apiError(409, { code: 'marketplace_connection_missing' }));
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');
    await within(dialog).findByTestId('settings-hotel-id');
    type('settings-hotel-id', '4711');

    fireEvent.click(screen.getByTestId('settings-save'));

    const error = await within(dialog).findByTestId('settings-error');
    expect(error).toHaveTextContent("Il collegamento non c'è più sul channel manager, quindi le impostazioni non si possono cambiare.");
    expect(error).toHaveTextContent('«Correggi»');
    // The text of the code itself sends the person to the step of a wizard, which this dialog does not have.
    expect(error).not.toHaveTextContent('torna al passo');
    expect(error).toHaveTextContent('Non è stato cambiato nulla.');
  });

  it('IntegrationSettingsDialog_OnItsWay_ShutsTheButtonsOfTheCardAndIsSentOnce', async () => {
    let finish: (value: MarketplaceActivationChange) => void = () => undefined;
    api.updateActivationSettings.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');
    await within(dialog).findByTestId('settings-hotel-id');
    type('settings-hotel-id', '4711');

    fireEvent.click(screen.getByTestId('settings-save'));
    fireEvent.submit(screen.getByTestId('settings-form'));

    await waitFor(() => expect(screen.getByTestId('settings-save')).toBeDisabled());
    expect(api.updateActivationSettings).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByTestId('settings-working')).toHaveTextContent('Salvo le impostazioni');
    expect(within(dialog).getByRole('button', { name: 'Annulla' })).toBeDisabled();
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1-actions')).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => finish(change()));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('IntegrationSettingsDialog_SavedButNotActive_IsToldAsAWarning_NotAsASuccess', async () => {
    api.updateActivationSettings.mockResolvedValue(change({ status: 'ToFix' }));
    renderCard(channelRow());
    const dialog = await chooseFromMenu('TEST Portal', 'Modifica impostazioni');
    await within(dialog).findByTestId('settings-hotel-id');
    type('settings-hotel-id', '4711');

    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Impostazioni salvate, ma il collegamento non risulta attivo: lo stato è «Da correggere».'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('useUpdateActivationSettings', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  it('useUpdateActivationSettings_Refusal_KeepsTheAnswerButNotTheRequestWithThePassword_AndTheMutationIsNotKept', async () => {
    api.updateActivationSettings.mockRejectedValue(apiError(422, { code: 'marketplace_settings_required' }));
    const { result, unmount } = renderHook(() => useUpdateActivationSettings(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'act-1', settings: { password: 'secret-pass' } }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as AxiosError;
    expect(error.response?.status).toBe(422);
    expect((error.response?.data as { code: string }).code).toBe('marketplace_settings_required');
    // The body that was sent is not in what the mutation keeps.
    expect(JSON.stringify(error.config?.data ?? '')).not.toContain('secret-pass');
    expect(error.config?.data).toBeUndefined();

    // Not kept once nothing observes it (`gcTime: 0`, not five minutes in the cache of the mutations).
    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('LicensedFunctionChangePanel', () => {
  const clipboard = { writeText: vi.fn() };

  beforeEach(() => {
    clipboard.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  });

  it('LicensedFunctionChangePanel_ExplainsThatCasaZenCannotChangeTheLicense_GivesTheTextToSendAndCopiesIt', async () => {
    renderCard(functionRow());
    const dialog = await chooseFromMenu('TEST Chat', 'Chiedi una modifica');

    expect(within(dialog).getByText(/CasaZen non può cambiarla/)).toBeInTheDocument();
    const text = (within(dialog).getByTestId('change-text') as HTMLTextAreaElement).value;
    expect(text).toContain('«TEST Chat»');
    expect(text).toContain('«Villa Rosa»');

    fireEvent.click(within(dialog).getByTestId('change-copy'));

    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(text));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Testo copiato.'));
    // Copying records nothing.
    expect(api.requestFunctionChange).not.toHaveBeenCalled();
  });

  it('LicensedFunctionChangePanel_IAskedForIt_RecordsTheRequestOnce_AndClosesWithAMessage', async () => {
    renderCard(functionRow());
    const dialog = await chooseFromMenu('TEST Chat', 'Chiedi una modifica');

    const button = within(dialog).getByTestId('change-asked');
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(api.requestFunctionChange).toHaveBeenCalledTimes(1));
    expect(api.requestFunctionChange).toHaveBeenCalledWith('act-f');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Richiesta registrata: la scheda mostra la data finché la licenza non cambia.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('LicensedFunctionChangePanel_OnItsWay_SaysSoShutsEveryButtonAndRecordsOnce', async () => {
    let finish: (value: MarketplaceActivationChange) => void = () => undefined;
    api.requestFunctionChange.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderCard(functionRow());
    const dialog = await chooseFromMenu('TEST Chat', 'Chiedi una modifica');

    fireEvent.click(within(dialog).getByTestId('change-asked'));
    fireEvent.click(within(dialog).getByTestId('change-asked'));

    await waitFor(() => expect(within(dialog).getByTestId('change-asked')).toBeDisabled());
    expect(within(dialog).getByTestId('change-working')).toHaveTextContent('Registro la richiesta');
    expect(within(dialog).getByTestId('change-copy')).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Annulla' })).toBeDisabled();
    expect(screen.getByTestId('marketplace-active-LicensedFunction-chat-prop-1-actions')).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(api.requestFunctionChange).toHaveBeenCalledTimes(1);

    await act(async () => finish(change({ kind: 'LicensedFunction', code: 'chat', activationId: 'act-f', changeRequestedAt: '2026-11-13T10:00:00Z' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('LicensedFunctionChangePanel_RequestAlreadyOpen_IsSaidInWords_NothingWasRecorded', async () => {
    api.requestFunctionChange.mockRejectedValue(apiError(409, { code: 'marketplace_change_already_requested' }, {}));
    renderCard(functionRow());
    const dialog = await chooseFromMenu('TEST Chat', 'Chiedi una modifica');

    fireEvent.click(within(dialog).getByTestId('change-asked'));

    const error = await within(dialog).findByTestId('change-error');
    expect(error).toHaveTextContent('Hai già chiesto questa modifica');
    expect(error).toHaveTextContent('Non è stato cambiato nulla.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('LicensedFunctionChangePanel_ChangeAlreadyRequested_TheCardSaysWhenAndTheMenuOffersNothingAgain', async () => {
    renderCard(functionRow({ changeRequestedAt: '2026-11-11T10:00:00Z' }));

    expect(await screen.findByTestId('marketplace-active-LicensedFunction-chat-prop-1-change')).toHaveTextContent('Modifica richiesta il 11 novembre 2026');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Azioni per TEST Chat' }), { key: 'Enter' });
    const item = await screen.findByRole('menuitem', { name: 'Chiedi una modifica' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });
});

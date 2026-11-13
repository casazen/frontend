import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import type { MarketplaceActiveIntegration, MarketplaceActivationChange, MarketplaceDeactivationPreview, MarketplaceHealthItem } from '@/types';
import { buildActiveRows, type ActiveRow } from '../lib/active-model';
import { ActiveIntegrationCard } from '../components/active-integration-card';

const api = vi.hoisted(() => ({
  getDeactivationPreview: vi.fn(),
  deactivateActivation: vi.fn(),
  getMarketplaceEntry: vi.fn(),
}));

vi.mock('@/api/marketplace.api', () => ({
  getDeactivationPreview: api.getDeactivationPreview,
  deactivateActivation: api.deactivateActivation,
  getMarketplaceEntry: api.getMarketplaceEntry,
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

const rowOf = (over: Partial<MarketplaceActiveIntegration> = {}, healthOver: Partial<MarketplaceHealthItem> | null = {}): ActiveRow =>
  buildActiveRows([integration(over)], healthOver === null ? null : [health({ kind: over.kind ?? 'Channel', code: over.code ?? 'PORTAL1', ...healthOver })])[0];

const PREVIEW: MarketplaceDeactivationPreview = {
  activationId: 'act-1',
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  effects: [
    'New TEST Portal bookings will no longer arrive in CasaZen.',
    'CasaZen stops updating availability and prices on TEST Portal.',
    'Your listing on TEST Portal stays published until you close it on the channel yourself.',
  ],
  requiresConfirmation: true,
  guided: false,
};

const change = (over: Partial<MarketplaceActivationChange> = {}): MarketplaceActivationChange => ({
  activationId: 'act-1',
  kind: 'Channel',
  code: 'PORTAL1',
  propertyId: 'prop-1',
  status: 'Deactivated',
  changeRequestedAt: null,
  ...over,
});

/** An error of the API as axios makes it: the request that failed (with its body) and the answer. */
function apiError(status: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ confirmed: true }) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, { status, statusText: '', headers: {}, config, data });
}

function renderCard(row: ActiveRow, mayManage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ul>
            <ActiveIntegrationCard row={row} fixTo={null} mayManage={mayManage} />
          </ul>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** Opens the menu of a button the way a keyboard does (Radix opens on the pointer going down, which a click does not send). */
async function openDeactivation(row: ActiveRow = rowOf()) {
  renderCard(row);
  const trigger = await screen.findByRole('button', { name: `Azioni per ${row.name}` });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await screen.findByRole('menu');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Disattiva' }));
  return screen.findByRole('dialog');
}

const tick = () => fireEvent.click(screen.getByTestId('deactivate-confirm-check'));
const confirmButton = (name = 'Disattiva') => within(screen.getByRole('dialog')).getByRole('button', { name });

beforeEach(async () => {
  vi.clearAllMocks();
  api.getDeactivationPreview.mockResolvedValue(PREVIEW);
  api.deactivateActivation.mockResolvedValue(change());
  api.getMarketplaceEntry.mockResolvedValue(undefined);
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('DeactivateIntegrationDialog · the effect first', () => {
  it('DeactivateIntegrationDialog_Open_ReadsThePreviewAndSaysTheEffectWithTheNamePropertyAndWhatStays_BeforeAnyCall', async () => {
    const dialog = await openDeactivation();

    expect(api.getDeactivationPreview).toHaveBeenCalledWith('act-1', 'it');
    // Which integration, which property.
    expect(within(dialog).getByText(/Stai per disattivare «TEST Portal» per l'immobile «Villa Rosa»/)).toBeInTheDocument();
    // What stops and what stays, in the server's own sentences.
    const list = await within(dialog).findByTestId('deactivate-effects-list');
    expect(list).toHaveTextContent('New TEST Portal bookings will no longer arrive in CasaZen.');
    expect(list).toHaveTextContent('stays published until you close it on the channel yourself');
    expect(within(dialog).getByText(/controlla sul canale le prenotazioni che ricevi/)).toBeInTheDocument();
    // And that it can be activated again.
    expect(within(dialog).getByText(/potrai riattivarla da Scopri/)).toBeInTheDocument();
    expect(api.deactivateActivation).not.toHaveBeenCalled();
  });

  it('DeactivateIntegrationDialog_Buttons_KeepItIsThePrimaryAndDeactivateIsTheQuietRedOneOffUntilTicked', async () => {
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');

    const keep = within(dialog).getByRole('button', { name: "Lascia com'è" });
    const deactivate = confirmButton();
    expect(keep.className).toContain('bg-primary');
    expect(deactivate.className).not.toContain('bg-primary');
    // The filled red of a confirmation is not what this button wears: the quiet, outlined one is.
    expect(deactivate.className).not.toMatch(/(^|\s)bg-destructive(\s|$)/);
    expect(deactivate.className).toContain('border-destructive/40');
    expect(deactivate).toBeDisabled();

    // Nothing is the default action: the focus does not start on the button that deactivates, and Enter on the form does nothing before the tick.
    expect(document.activeElement).not.toBe(deactivate);
    fireEvent.submit(within(dialog).getByTestId('deactivate-dialog-body').closest('form') as HTMLFormElement);
    expect(api.deactivateActivation).not.toHaveBeenCalled();

    tick();
    expect(confirmButton()).toBeEnabled();
  });

  it('DeactivateIntegrationDialog_PreviewNotRead_NothingCanBeConfirmed_AndTheCallIsNeverMade', async () => {
    api.getDeactivationPreview.mockRejectedValue(apiError(500));
    const dialog = await openDeactivation();

    expect(await within(dialog).findByTestId('deactivate-preview-error')).toHaveTextContent('Non riesco a leggere cosa succede');
    // The tick is not even offered before the effect is shown; whatever is done, the button stays off.
    expect(screen.getByTestId('deactivate-confirm-check')).toBeDisabled();
    fireEvent.click(screen.getByTestId('deactivate-confirm-check'));
    expect(confirmButton()).toBeDisabled();
    expect(api.deactivateActivation).not.toHaveBeenCalled();

    // Reading it again brings the effect, and then it can be confirmed.
    api.getDeactivationPreview.mockResolvedValue(PREVIEW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Riprova' }));
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();
    expect(confirmButton()).toBeEnabled();
  });

  it('DeactivateIntegrationDialog_Preview404_IsNotFound_NotAnError', async () => {
    api.getDeactivationPreview.mockRejectedValue(apiError(404, { code: 'marketplace_activation_not_found' }));
    const dialog = await openDeactivation();

    expect(await within(dialog).findByTestId('deactivate-preview-not-found')).toHaveTextContent("Questa attivazione non c'è più");
    expect(within(dialog).queryByTestId('deactivate-preview-error')).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });
});

describe('DeactivateIntegrationDialog · the real effect', () => {
  it('DeactivateIntegrationDialog_Confirmed_CallsOnceWithTheIdAndSaysItWasDeactivated', async () => {
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(api.deactivateActivation).toHaveBeenCalledTimes(1));
    expect(api.deactivateActivation).toHaveBeenCalledWith('act-1');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Disattivazione completata: TEST Portal.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('DeactivateIntegrationDialog_OnItsWay_ShutsEveryButtonOfTheCard_AndAPressedTwiceCallsOnce', async () => {
    let finish: (value: MarketplaceActivationChange) => void = () => undefined;
    api.deactivateActivation.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    const button = confirmButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(within(dialog).getByTestId('deactivate-dialog-body').closest('form') as HTMLFormElement);

    await waitFor(() => expect(button).toBeDisabled());
    expect(api.deactivateActivation).toHaveBeenCalledTimes(1);
    // What is not finished is said as that: the dialog tells that it is deactivating, not that it did.
    expect(within(dialog).getByTestId('deactivate-working')).toHaveTextContent('Disattivazione in corso');
    expect(toast.success).not.toHaveBeenCalled();
    // Every button of the dialog and of the card is shut, and Escape does not close the dialog that is waiting for the answer.
    expect(within(dialog).getByRole('button', { name: "Lascia com'è" })).toBeDisabled();
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1-actions')).toBeDisabled();
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1-details')).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => finish(change()));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deactivateActivation).toHaveBeenCalledTimes(1);
  });

  it('DeactivateIntegrationDialog_AnswerThatIsNotDeactivated_IsSaidAsWhatItIs_NeverAsSuccess', async () => {
    api.deactivateActivation.mockResolvedValue(change({ status: 'Pending' }));
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    fireEvent.click(confirmButton());

    expect(await within(dialog).findByTestId('deactivate-not-done')).toHaveTextContent('non risulta completata: lo stato è «In attesa»');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('DeactivateIntegrationDialog_RefusalOfTheChannelManager_SaysNothingWasChanged_AndTheDialogStays', async () => {
    api.deactivateActivation.mockRejectedValue(apiError(502, { code: 'octorate_unavailable' }));
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    fireEvent.click(confirmButton());

    const error = await within(dialog).findByTestId('deactivate-error');
    expect(error).toHaveTextContent('non risponde in questo momento');
    expect(error).toHaveTextContent('Non è stato cambiato nulla.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The person may try again.
    expect(confirmButton()).toBeEnabled();
  });

  it('DeactivateIntegrationDialog_FailureOfCasaZenOrNoAnswer_DoesNotClaimNothingWasChanged', async () => {
    api.deactivateActivation.mockRejectedValue(apiError(500));
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    fireEvent.click(confirmButton());

    const error = await within(dialog).findByTestId('deactivate-error');
    expect(error).toHaveTextContent('Non sappiamo se');
    expect(error).not.toHaveTextContent('Non è stato cambiato nulla.');
  });

  it('DeactivateIntegrationDialog_Refusal422_IsSaidInTheWordsOfItsCode', async () => {
    api.deactivateActivation.mockRejectedValue(apiError(422, { code: 'marketplace_confirmation_required' }));
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();

    fireEvent.click(confirmButton());

    expect(await within(dialog).findByTestId('deactivate-error')).toHaveTextContent('serve una conferma esplicita');
  });

  it('DeactivateIntegrationDialog_Cancel_ClosesWithoutAnyCall', async () => {
    const dialog = await openDeactivation();
    await within(dialog).findByTestId('deactivate-effects-list');

    fireEvent.click(within(dialog).getByRole('button', { name: "Lascia com'è" }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deactivateActivation).not.toHaveBeenCalled();
  });
});

describe('PartnerDeactivationGuide', () => {
  const PARTNER_PREVIEW: MarketplaceDeactivationPreview = {
    activationId: 'act-p',
    kind: 'Partner',
    code: 'beds',
    name: 'TEST Beds',
    effects: ["TEST Beds is turned off on its own site, not in CasaZen: turn it off there.", 'When you confirm here that you did it, CasaZen stops showing TEST Beds as active.'],
    requiresConfirmation: true,
    guided: true,
  };
  const partnerRow = () => rowOf({ kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null, isDeclared: true }, null);

  /** The list does not carry the id of a partner's activation (only the health rows have it): a list that sends it gives the partner its menu. */
  const partnerRowWithId = (): ActiveRow => ({ ...partnerRow(), activationId: 'act-p' });

  beforeEach(() => {
    api.getDeactivationPreview.mockResolvedValue(PARTNER_PREVIEW);
    api.getMarketplaceEntry.mockResolvedValue({ kind: 'Partner', code: 'beds', name: 'TEST Beds', deactivation: { text: 'Open the site, go to Settings and press Turn off.', guided: true } });
    api.deactivateActivation.mockResolvedValue(change({ activationId: 'act-p', kind: 'Partner', code: 'beds', propertyId: null }));
  });

  it('PartnerDeactivationGuide_ShowsTheInstructionsThenIDidIt_WhichRecordsTheDeactivation', async () => {
    const dialog = await openDeactivation(partnerRowWithId());

    const guide = await within(dialog).findByTestId('deactivate-partner-guide-text');
    expect(guide).toHaveTextContent('Open the site, go to Settings and press Turn off.');
    expect(within(dialog).getByText(/per tutta l'organizzazione/)).toBeInTheDocument();
    await within(dialog).findByTestId('deactivate-effects-list');

    // «L'ho fatto» is the quiet button, off until the person says they did it.
    expect(confirmButton("L'ho fatto")).toBeDisabled();
    tick();
    fireEvent.click(confirmButton("L'ho fatto"));

    await waitFor(() => expect(api.deactivateActivation).toHaveBeenCalledWith('act-p'));
    expect(api.getMarketplaceEntry).toHaveBeenCalledWith('Partner', 'beds', undefined, 'it');
  });

  it('PartnerDeactivationGuide_InstructionsNotRead_SaysSoAndTheHostWhoKnowsHowMayGoOn', async () => {
    api.getMarketplaceEntry.mockRejectedValue(apiError(500));
    const dialog = await openDeactivation(partnerRowWithId());

    expect(await within(dialog).findByTestId('deactivate-partner-guide-error')).toHaveTextContent('Non riesco a leggere le istruzioni');
    await within(dialog).findByTestId('deactivate-effects-list');
    tick();
    expect(confirmButton("L'ho fatto")).toBeEnabled();
  });

  it('PartnerDeactivationGuide_Instructions404_AreNotFound', async () => {
    api.getMarketplaceEntry.mockRejectedValue(apiError(404, { code: 'marketplace_entry_not_found' }));
    const dialog = await openDeactivation(partnerRowWithId());

    expect(await within(dialog).findByTestId('deactivate-partner-guide-not-found')).toBeInTheDocument();
  });
});

describe('the menu of a card', () => {
  it('ActiveIntegrationCard_WithoutTheRightToWrite_HasNoMenu', async () => {
    renderCard(rowOf(), false);

    await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-1');
    expect(screen.queryByTestId('marketplace-active-Channel-PORTAL1-prop-1-actions')).not.toBeInTheDocument();
  });

  it('ActiveIntegrationCard_WithoutTheIdOfTheActivation_OffersNothing_APartnerOfTheListIncluded', async () => {
    // The health was not read (so there is no id), and a partner has no health row: nothing is offered that could not be done.
    renderCard(rowOf({}, null));
    await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-1');
    expect(screen.queryByTestId('marketplace-active-Channel-PORTAL1-prop-1-actions')).not.toBeInTheDocument();
    cleanup();

    renderCard(rowOf({ kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null }, null));
    await screen.findByTestId('marketplace-active-Partner-beds-org');
    expect(screen.queryByTestId('marketplace-active-Partner-beds-org-actions')).not.toBeInTheDocument();
  });

  it('ActiveIntegrationCard_ConnectionGone_OffersNoSettings_ButStillTheDeactivation', async () => {
    // The health says the connection is no longer on the channel manager: its settings cannot be changed (the server would refuse), «Correggi» makes it again.
    renderCard(rowOf({ status: 'ToFix' }, { status: 'ToFix', error: { code: 'connection_missing', message: 'Il collegamento non c’è più.' } }));
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Azioni per TEST Portal' }), { key: 'Enter' });
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Disattiva']);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    cleanup();

    // A connection that is only switched off on the channel manager is still there: it keeps its settings.
    renderCard(rowOf({ status: 'ToFix' }, { status: 'ToFix', error: { code: 'connection_disabled', message: 'Il collegamento è spento.' } }));
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Azioni per TEST Portal' }), { key: 'Enter' });
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Modifica impostazioni', 'Disattiva']);
  });

  it('ActiveIntegrationCard_ByKind_OffersTheSettingsAndTheDeactivationOfAChannel_TheChangeOfAFunction_AndNeverADeactivationOfAFunction', async () => {
    renderCard(rowOf());
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Azioni per TEST Portal' }), { key: 'Enter' });
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Modifica impostazioni', 'Disattiva']);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    cleanup();

    renderCard(rowOf({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat' }, { kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', activationId: 'act-f' }));
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Azioni per TEST Chat' }), { key: 'Enter' });
    expect(within(await screen.findByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Chiedi una modifica']);
  });
});

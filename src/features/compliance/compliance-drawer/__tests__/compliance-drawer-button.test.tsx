import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { expectNoAxeViolations } from '@/test/axe';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import { ComplianceDrawerButton } from '../compliance-drawer-button';
import { RETURN_STORAGE_KEY, resetReturnForTests } from '../compliance-drawer-return';

vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
}));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && permissions.granted.includes(permission),
  }),
}));

const PROPERTY = '22222222-2222-2222-2222-222222222222';
const BOOKING = '11111111-1111-1111-1111-111111111111';
const ROUTE = '/app/short-rent/bookings/b1?tab=guest';
const TARGET = { topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING } as const;

const HANDOFF: ComplianceHandoff = {
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  topic: 'Alloggiati',
  destinationUrl: 'https://panel.example.com/home',
  destinationKind: 'Home',
  returnPath: ROUTE,
  context: {
    propertyId: PROPERTY,
    propertyName: 'Casa Rossi',
    octorateListingName: 'Casa Rossi - Roma centro',
    bookingId: BOOKING,
    bookingCode: 'ABCDE-12345',
    period: null,
  },
  guide: { code: 'alloggiati_daily', menuPath: 'Strutture, poi Questura, poi Invii giornalieri', check: 'Controlla che il soggiorno risulti inviato e senza errori.' },
};

/** A failed call as axios builds it, with the body the request carried (what `withoutRequest` must not keep). */
function answered(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ returnPath: ROUTE }) } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, { sent: true }, { status, statusText: '', headers: {}, config, data });
}

const start = vi.mocked(octorateComplianceHandoffApi.start);

function renderButton({ connector = true, path = ROUTE }: { connector?: boolean; path?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <MemoryRouter initialEntries={[path]}>
          <ComplianceDrawerButton target={TARGET} subject="Mario Rossi" />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}

const trigger = () => screen.getByTestId('compliance-drawer-trigger');

/** The browser shows the page: `persisted` when it brings it back from its memory (the back button of a page that left in the same tab). */
function pageshow(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  permissions.granted = ['booking.read'];
  start.mockResolvedValue(HANDOFF);
  window.sessionStorage.clear();
  resetReturnForTests();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ComplianceDrawerButton: who is offered it', () => {
  it('button_ConnectorOff_IsNotOnThePageAndAsksNothing', () => {
    renderButton({ connector: false });

    expect(screen.queryByTestId('compliance-drawer-trigger')).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });

  it('button_WithoutPermissionToReadBookings_IsNotOnThePageAndAsksNothing', () => {
    permissions.granted = ['property.read'];
    renderButton();

    expect(screen.queryByTestId('compliance-drawer-trigger')).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });

  it('button_ConnectorOnAndPermission_IsOfferedWithTheNameOfTheRowForAScreenReader', () => {
    renderButton();

    expect(screen.getByRole('button', { name: 'Verifica nel tuo Cassetto Compliance: Mario Rossi' })).toBeInTheDocument();
    // Offering it asks nothing: the handoff starts when the host presses it.
    expect(start).not.toHaveBeenCalled();
  });
});

describe('ComplianceDrawerButton: the dialog', () => {
  it('dialog_Opened_AsksTheServerOnceForTheTargetAndTheRouteAndNeverSendsAnAddress', async () => {
    renderButton({ path: '/app/short-rent/bookings/b1?tab=guest' });

    fireEvent.click(trigger());
    await screen.findByTestId('compliance-drawer-ready');

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ topic: 'Alloggiati', propertyId: PROPERTY, bookingId: BOOKING, period: null, returnPath: ROUTE });
  });

  it('dialog_Ready_SaysTheTargetTheMenuPathAndWhatToCheckAndDisclosesWhereTheDataAre', async () => {
    renderButton();

    fireEvent.click(trigger());
    const dialog = await screen.findByRole('dialog', { name: 'Cassetto Compliance' });

    expect(within(dialog).getByTestId('compliance-drawer-topic')).toHaveTextContent('Alloggiati Web');
    expect(within(dialog).getByTestId('compliance-drawer-property')).toHaveTextContent('Casa Rossi');
    expect(within(dialog).getByTestId('compliance-drawer-listing')).toHaveTextContent('Casa Rossi - Roma centro');
    expect(within(dialog).getByTestId('compliance-drawer-booking')).toHaveTextContent('ABCDE-12345');
    expect(within(dialog).getByTestId('compliance-drawer-menu')).toHaveTextContent('Strutture, poi Questura, poi Invii giornalieri');
    expect(within(dialog).getByTestId('compliance-drawer-check')).toHaveTextContent('Controlla che il soggiorno risulti inviato e senza errori.');
    const disclosure = within(dialog).getByTestId('compliance-drawer-disclosure');
    expect(disclosure).toHaveTextContent('Dati consultati su Octorate');
    expect(disclosure).toHaveTextContent('non lo importa');
    // The primary copy speaks as CasaZen: the name of the connected area is only in the disclosure.
    expect(within(dialog).getByTestId('compliance-drawer-menu')).not.toHaveTextContent('Octorate');
    expect(within(dialog).getByRole('button', { name: 'Continua la verifica' })).toBeEnabled();
  });

  it('dialog_Ready_HasNoIframeNoNewTabNoOutcomeToConfirmAndNoCredentialField', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderButton();

    fireEvent.click(trigger());
    const dialog = await screen.findByTestId('compliance-drawer-dialog');

    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('[target="_blank"]')).toBeNull();
    expect(dialog.querySelector('input, textarea, select')).toBeNull();
    expect(within(dialog).queryByText(/È stato inviato/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/password/i)).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it.each([
    ['ready', () => start.mockResolvedValueOnce(HANDOFF), 'compliance-drawer-ready'],
    ['failed', () => start.mockRejectedValueOnce(answered(503)), 'compliance-drawer-failed'],
  ])('dialog_%s_HasNoAccessibilityViolationAxeCanFind', async (_state, arrange, ready) => {
    arrange();
    renderButton();

    fireEvent.click(trigger());
    await screen.findByTestId(ready);

    await expectNoAxeViolations(document.body);
  });

  it('continue_Pressed_KeepsTheRouteAndTheFiltersAndGoesInTheSameTabToTheAddressTheServerGave', async () => {
    const assign = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.stubGlobal('location', { ...window.location, assign });
    renderButton();

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByTestId('compliance-drawer-continue'));

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://panel.example.com/home');
    expect(open).not.toHaveBeenCalled();
    const kept = JSON.parse(window.sessionStorage.getItem(RETURN_STORAGE_KEY) ?? 'null') as Record<string, unknown>;
    expect(kept).toMatchObject({
      handoffId: HANDOFF.handoffId,
      route: '/app/short-rent/bookings/b1',
      filters: '?tab=guest',
      origin: `Alloggiati:${PROPERTY}:${BOOKING}:`,
    });
    expect(Object.keys(kept).sort()).toEqual(['expiresAt', 'filters', 'handoffId', 'origin', 'route']);
    // Once the tab is on its way the button cannot be pressed again.
    expect(screen.getByTestId('compliance-drawer-continue')).toBeDisabled();
    open.mockRestore();
  });

  it('continue_AddressThatIsNotHttps_KeepsTheHostInCasaZenWithARetryAndKeepsNothing', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    start.mockResolvedValue({ ...HANDOFF, destinationUrl: 'javascript:alert(1)' });
    renderButton();

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByTestId('compliance-drawer-continue'));

    expect(assign).not.toHaveBeenCalled();
    expect(await screen.findByTestId('compliance-drawer-error')).toHaveTextContent('Non riusciamo ad aprire l\'area collegata da qui');
    expect(screen.getByTestId('compliance-drawer-retry')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('dialog_ServerUnavailable_ShowsTheGuideOfTheTopicAndARetryThatAsksAgain', async () => {
    start.mockRejectedValueOnce(answered(503));
    renderButton();

    fireEvent.click(trigger());
    const failed = await screen.findByTestId('compliance-drawer-failed');

    expect(within(failed).getByTestId('compliance-drawer-error')).toHaveTextContent('Non riusciamo a preparare la verifica');
    expect(within(failed).getByTestId('compliance-drawer-fallback')).toHaveTextContent('invio Alloggiati di questo soggiorno');
    // Not a success, and no way forward without an address: the one button that goes on is the retry.
    expect(screen.queryByTestId('compliance-drawer-continue')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('compliance-drawer-retry'));

    await screen.findByTestId('compliance-drawer-ready');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('dialog_NotFound_SaysItIsNotFoundAndOffersNoRetry', async () => {
    start.mockRejectedValueOnce(answered(404, { code: 'octorate_handoff_target_not_found' }));
    renderButton();

    fireEvent.click(trigger());

    expect(await screen.findByTestId('compliance-drawer-error')).toHaveTextContent('Non troviamo questa prenotazione o questo immobile');
    expect(screen.queryByTestId('compliance-drawer-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('compliance-drawer-close')).toBeInTheDocument();
  });

  it('dialog_PropertyNotConnected_IsSaidAsThatNotAsASuccessAndOffersNoRetry', async () => {
    start.mockRejectedValueOnce(answered(409, { code: 'octorate_handoff_property_not_mapped' }));
    renderButton();

    fireEvent.click(trigger());

    expect(await screen.findByTestId('compliance-drawer-error')).toHaveTextContent('non è collegato al tuo channel manager');
    expect(screen.queryByTestId('compliance-drawer-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-drawer-continue')).not.toBeInTheDocument();
  });
});

describe("ComplianceDrawerButton: a tab that does not leave, and a page brought back from the browser's memory", () => {
  /** The host pressed «Continua la verifica» and the navigation never came (the browser asked «Lasciare il sito?» and was told no). */
  async function pressContinueOnATabThatStays() {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderButton();
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByTestId('compliance-drawer-continue'));
    return assign;
  }

  it('continue_TabThatDoesNotLeaveInTenSeconds_GivesTheDialogBackInsteadOfLeavingItWaiting', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderButton();
    fireEvent.click(trigger());
    const proceed = await screen.findByTestId('compliance-drawer-continue');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(proceed);

      // On its way out: nothing of the layer can be pressed, and the tab kept where to come back to.
      expect(assign).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('compliance-drawer-continue')).toBeDisabled();
      expect(screen.getByTestId('compliance-drawer-continue')).toHaveTextContent("Apro l'area collegata");
      expect(screen.getByTestId('compliance-drawer-cancel')).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(9_999);
      });
      expect(screen.getByTestId('compliance-drawer-continue')).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      // The page that was to come never came: the layer is usable again, as it was, and is not a dead end.
      expect(screen.getByTestId('compliance-drawer-continue')).toBeEnabled();
      expect(screen.getByTestId('compliance-drawer-continue')).toHaveTextContent('Continua la verifica');
      expect(screen.getByTestId('compliance-drawer-cancel')).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('continue_TabThatDidNotLeave_ForgetsWhatItKeptWhenTheHostClosesTheDialog', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderButton();
    fireEvent.click(trigger());
    const proceed = await screen.findByTestId('compliance-drawer-continue');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(proceed);
      expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(screen.getByTestId('compliance-drawer-cancel'));

    // The host is not on their way any more: nothing is left to bring them back to a page they never left.
    await waitFor(() => expect(screen.queryByTestId('compliance-drawer-dialog')).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).toBeNull();
  });

  it('continue_DialogClosedWhileTheTabIsLeaving_StaysOpenAndKeepsWhatTheTabKept', async () => {
    await pressContinueOnATabThatStays();

    fireEvent.keyDown(screen.getByTestId('compliance-drawer-dialog'), { key: 'Escape' });

    expect(screen.getByTestId('compliance-drawer-dialog')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).not.toBeNull();
  });

  it('pageshow_PageBroughtBackFromTheBrowsersMemory_ClosesTheDialogAndLeavesWhatTheTabKeptForTheShell', async () => {
    await pressContinueOnATabThatStays();
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).not.toBeNull();

    pageshow(true);

    await waitFor(() => expect(screen.queryByTestId('compliance-drawer-dialog')).not.toBeInTheDocument());
    // It is the host's way back: the shell restores it, once; the button neither forgets it nor asks for anything more.
    expect(window.sessionStorage.getItem(RETURN_STORAGE_KEY)).not.toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
    expect(trigger()).not.toHaveAttribute('aria-busy');
  });

  it('pageshow_PageThatWasLoadedAnew_LeavesTheDialogAsItIs', async () => {
    renderButton();
    fireEvent.click(trigger());
    await screen.findByTestId('compliance-drawer-ready');

    pageshow(false);

    expect(screen.getByTestId('compliance-drawer-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-drawer-continue')).toBeEnabled();
  });
});

describe('ComplianceDrawerButton: while the request is in flight', () => {
  it('button_ServerPreparingTheHandoff_BlocksAnotherPressAndContinueIsOff', async () => {
    let resolve: (handoff: ComplianceHandoff) => void = () => undefined;
    start.mockReturnValueOnce(new Promise<ComplianceHandoff>((done) => (resolve = done)));
    renderButton();

    fireEvent.click(trigger());

    const continueButton = await screen.findByTestId('compliance-drawer-continue');
    expect(continueButton).toBeDisabled();
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('compliance-drawer-loading')).toBeInTheDocument();

    resolve(HANDOFF);
    await waitFor(() => expect(screen.getByTestId('compliance-drawer-continue')).toBeEnabled());
  });

  it('button_DialogClosedBeforeTheAnswer_StaysBusyAndDoesNotAskAgain', async () => {
    let resolve: (handoff: ComplianceHandoff) => void = () => undefined;
    start.mockReturnValueOnce(new Promise<ComplianceHandoff>((done) => (resolve = done)));
    renderButton();

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByTestId('compliance-drawer-cancel'));
    await waitFor(() => expect(screen.queryByTestId('compliance-drawer-dialog')).not.toBeInTheDocument());

    // Pressed again while the first request is still out: nothing is asked.
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(trigger());
    expect(start).toHaveBeenCalledTimes(1);

    resolve(HANDOFF);
  });
});

describe('ComplianceDrawerButton: what the mutation keeps (a route and a property are personal context)', () => {
  it('mutation_Failed_KeepsTheAnswerWithoutTheRequestThatCarriedTheRoute', async () => {
    start.mockRejectedValueOnce(answered(503, { detail: 'down' }));
    const client = renderButton();

    fireEvent.click(trigger());
    await screen.findByTestId('compliance-drawer-error');

    const kept = client.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(503);
    expect(kept.config?.data).toBeUndefined();
    expect(kept.request).toBeUndefined();
  });

  it('mutation_DialogClosed_IsDroppedAndHoldsNeitherTheAddressNorTheHandoff', async () => {
    const client = renderButton();

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByTestId('compliance-drawer-cancel'));

    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});

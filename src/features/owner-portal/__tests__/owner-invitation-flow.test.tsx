import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';
import {
  clearOwnerInvitationToken,
  OWNER_INVITATION_APP_STATE_KEY,
  OWNER_INVITATION_PATH,
  OWNER_PORTAL_HOME_PATH,
  peekOwnerInvitationToken,
  stashOwnerInvitationToken,
} from '@/lib/owner-invitation';
import { expectNoAxeViolations } from '@/test/axe';

// The page pulls in the card of the invitations and the shell of the app; importing it can take a while on a loaded machine.
configure({ asyncUtilTimeout: 8_000 });
vi.setConfig({ testTimeout: 60_000 });

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

let OwnerInvitationPage: typeof import('../owner-invitation-page').OwnerInvitationPage;
beforeAll(async () => {
  ({ OwnerInvitationPage } = await import('../owner-invitation-page'));
}, 240_000);

/** What the backend reads: 64 lowercase hex characters. */
const TOKEN = 'b7'.repeat(32);
const login = vi.fn();
const logout = vi.fn();
const refreshAccessToken = vi.fn();

const ACCEPTED = { ownerUserId: 'owner-user-1', agencyIds: ['agency-1'], ownedPropertyIds: ['property-1'], alreadyAccepted: false, claimsRefresh: 'published' };

function mockAuth(authenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: authenticated,
    user: authenticated ? { email: 'owner@example.com' } : undefined,
    login,
    logout,
    refreshAccessToken,
  } as unknown as ReturnType<typeof useAuth>);
}

/** A failed call as the API client raises it: the status and a ProblemDetails body. */
function problem(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

/** No answer at all: a network failure. */
function networkError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() });
}

/** The real address bar of jsdom: the page is opened the way the link of the e-mail opens it. */
function openAt(path: string, { strict = false }: { strict?: boolean } = {}) {
  window.history.pushState({}, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path={OWNER_INVITATION_PATH} element={<OwnerInvitationPage />} />
          <Route path={OWNER_PORTAL_HOME_PATH} element={<p data-testid="owner-portal">portal</p>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe('OwnerInvitationPage: the link of the e-mail and the round trip through the sign-in (NF-109, ADR-011-R6)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearOwnerInvitationToken();
    await i18n.changeLanguage('it');
    mockAuth(false);
    refreshAccessToken.mockResolvedValue('a-new-access-token');
    vi.mocked(axios.post).mockResolvedValue({ data: ACCEPTED });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('OwnerInvitationRoute_LinkOfTheEmail_TakesTheTokenOutOfTheAddressAndKeepsItInNoStorageNorLog', async () => {
    const logged = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByTestId('owner-invitation-signup')).toBeInTheDocument();

    // Out of the address bar and the history entry; in no storage, in no log, and nothing is sent before the person has signed in.
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.href).not.toContain(TOKEN);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    for (const spy of logged) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('OwnerInvitationRoute_SignInButtons_CarryTheTokenInTheAppStateOnlyAndReturnToThePageWithoutIt', async () => {
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByTestId('owner-invitation-signup'));
    expect(login).toHaveBeenLastCalledWith({
      returnTo: OWNER_INVITATION_PATH,
      appState: { [OWNER_INVITATION_APP_STATE_KEY]: TOKEN },
      authorizationParams: { screen_hint: 'signup' },
    });
    // The return address has no secret in it.
    expect(JSON.stringify(vi.mocked(login).mock.calls[0][0].returnTo)).not.toContain(TOKEN);

    fireEvent.click(screen.getByTestId('owner-invitation-login'));
    expect(login).toHaveBeenLastCalledWith({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: TOKEN }, authorizationParams: undefined });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('OwnerInvitationRoute_AuthRoundTripConsumesTokenOnce_Test', async () => {
    // 1. The owner opens the link, not signed in, and chooses to sign in.
    const first = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);
    fireEvent.click(await screen.findByTestId('owner-invitation-login'));
    const { appState } = vi.mocked(login).mock.calls[0][0] as { appState: Record<string, unknown> };
    first.unmount();

    // 2. The browser goes to the identity provider and comes back: the page is loaded again (memory is gone) and the app gives the `appState` back, which is
    //    all that `handleAuthRedirect` of the app does with the secret. Nothing was stored in the browser by the page.
    clearOwnerInvitationToken();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    stashOwnerInvitationToken(appState[OWNER_INVITATION_APP_STATE_KEY]);
    mockAuth(true);

    // 3. Signed in, the page sends the secret once, in the body, and never in the address of the request.
    openAt(OWNER_INVITATION_PATH);
    await screen.findByTestId('owner-portal');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/owner-invitations/accept');
    expect(url).not.toContain(TOKEN);
    expect(body).toEqual({ token: TOKEN });
    // The claims were published: a new token is asked for, then the address is replaced with the portal.
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(OWNER_PORTAL_HOME_PATH);
    expect(window.location.search).toBe('');
    // The secret is forgotten: not in memory, not in storage, and another visit of the page finds nothing to send.
    expect(peekOwnerInvitationToken()).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('OwnerInvitationRoute_SignedInPageRenderedTwiceByTheDevelopmentMode_SendsTheTokenOnce', async () => {
    mockAuth(true);
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`, { strict: true });
    await screen.findByTestId('owner-portal');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('OwnerInvitationRoute_ClaimsNotPublished_SaysTheAccessIsNotActiveAndDoesNotOpenThePortal', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockResolvedValue({ data: { ...ACCEPTED, claimsRefresh: 'failed' } });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByText(i18n.t('ownerInvitation.claimsPending.title'))).toBeInTheDocument();
    // Not a success: no portal, no new token asked for, and a way to try again.
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('owner-invitation-open-portal')).toBeInTheDocument();
  });

  it('OwnerInvitationRoute_NewTokenCannotBeAsked_SaysSoInsteadOfOpeningThePortal', async () => {
    mockAuth(true);
    refreshAccessToken.mockRejectedValue(new Error('login_required'));
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByText(i18n.t('ownerInvitation.tokenPending.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
  });

  it.each([
    [410, 'owner_invitation_expired', 'expired'],
    [410, 'owner_invitation_revoked', 'revoked'],
    [410, 'owner_invitation_used', 'used'],
    [410, 'owner_invitation_invalid', 'invalid'],
  ])('OwnerInvitationRoute_Refusal_%s_%s_ShowsTheBrandedRecoveryOfItsOwn', async (status, code, reason) => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValue(problem(status, code));
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByText(i18n.t(`ownerInvitation.unusable.${reason}.title`))).toBeInTheDocument();
    expect(screen.getByTestId('owner-invitation-portal')).toHaveAttribute('href', OWNER_PORTAL_HOME_PATH);
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(refreshAccessToken).not.toHaveBeenCalled();
    // A link that does not work is forgotten: it is not sent again by another visit.
    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('OwnerInvitationRoute_EmailOfAnotherAccount_OffersToSignOutAndGrantsNothing', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValue(problem(403, 'owner_invitation_email_mismatch'));
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByTestId('owner-invitation-switch'));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
  });

  it('OwnerInvitationRoute_PortalOff_IsNotFoundAndNeverAnError', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValue(problem(404, 'not_found'));
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByText(i18n.t('ownerInvitation.notFound.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('owner-invitation-retry')).not.toBeInTheDocument();
  });

  it('OwnerInvitationRoute_NoAnswer_KeepsTheTokenAndSendsTheSameOneOnlyWhenAsked', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValueOnce(networkError()).mockResolvedValue({ data: ACCEPTED });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    const retry = await screen.findByTestId('owner-invitation-retry');
    // It does not try again by itself.
    expect(axios.post).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    await screen.findByTestId('owner-portal');

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(vi.mocked(axios.post).mock.calls[1][1]).toEqual({ token: TOKEN });
  });

  it.each(['', 'not-a-token', `${TOKEN}0`, TOKEN.slice(1)])('OwnerInvitationRoute_LinkWithoutAToken_%j_DoesNotWorkAndSendsNothing', async (value) => {
    mockAuth(true);
    openAt(`${OWNER_INVITATION_PATH}?token=${value}`);

    expect(await screen.findByText(i18n.t('ownerInvitation.unusable.invalid.title'))).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('OwnerInvitationRoute_PageOfTheLink_HasNoAccessibilityViolation', async () => {
    const { container } = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);
    await screen.findByTestId('owner-invitation-signup');

    await expectNoAxeViolations(container);
  });
});

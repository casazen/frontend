import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

configure({ asyncUtilTimeout: 8_000 });
vi.setConfig({ testTimeout: 60_000 });

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

let OwnerInvitationPage: typeof import('../owner-invitation-page').OwnerInvitationPage;
beforeAll(async () => {
  ({ OwnerInvitationPage } = await import('../owner-invitation-page'));
}, 240_000);

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

function problem(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

function networkError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() });
}

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
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('OwnerInvitationRoute_LinkOfTheEmail_TakesTheTokenOutOfTheAddressAndKeepsItInNoStorageNorLog', async () => {
    const logged = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByTestId('owner-invitation-signup')).toBeInTheDocument();

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
    expect(JSON.stringify(vi.mocked(login).mock.calls[0][0].returnTo)).not.toContain(TOKEN);

    fireEvent.click(screen.getByTestId('owner-invitation-login'));
    expect(login).toHaveBeenLastCalledWith({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: TOKEN }, authorizationParams: undefined });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('OwnerInvitationRoute_AuthRoundTripConsumesTokenOnce_Test', async () => {
    const first = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);
    fireEvent.click(await screen.findByTestId('owner-invitation-login'));
    const { appState } = vi.mocked(login).mock.calls[0][0] as { appState: Record<string, unknown> };
    first.unmount();

    // 2. The browser goes to the identity provider and comes back: the page is loaded again (memory is gone) and the app gives the `appState` back, which is
    //    all that `handleAuthRedirect` of the app does with the secret (here by hand: the real hand-over, through `App` and its auth provider, is proved in
    //    `src/__tests__/app-owner-invitation-round-trip.test.tsx`, which fails when the app does not hand the secret over). Nothing was stored in the browser by the page.
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
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(OWNER_PORTAL_HOME_PATH);
    expect(window.location.search).toBe('');
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

  it('OwnerInvitationRoute_ClaimsNotPublished_SaysTheAccessIsNotActiveAndKeepsTheSecretForANewTry', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockResolvedValue({ data: { ...ACCEPTED, claimsRefresh: 'failed' } });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByText(i18n.t('ownerInvitation.claimsPending.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owner-invitation-open-portal')).not.toBeInTheDocument();
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('owner-invitation-retry')).toBeInTheDocument();
    expect(peekOwnerInvitationToken()).toBe(TOKEN);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('OwnerInvitationRoute_ClaimsFailedThenPublished_TheRetryAcceptsAgainWithTheSameSecretAndOpensThePortal', async () => {
    mockAuth(true);
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { ...ACCEPTED, claimsRefresh: 'failed' } })
      .mockResolvedValueOnce({ data: { ...ACCEPTED, alreadyAccepted: true, claimsRefresh: 'published' } });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByTestId('owner-invitation-retry'));
    await screen.findByTestId('owner-portal');

    expect(axios.post).toHaveBeenCalledTimes(2);
    for (const [url, body] of vi.mocked(axios.post).mock.calls) {
      expect(url).toBe('/owner-invitations/accept');
      expect(body).toEqual({ token: TOKEN });
    }
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(peekOwnerInvitationToken()).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('OwnerInvitationRoute_ClaimsStillNotPublishedAfterTheRetry_StaysOnTheCardAndSendsOnlyWhenAsked', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockResolvedValue({ data: { ...ACCEPTED, claimsRefresh: 'not_configured' } });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByTestId('owner-invitation-retry'));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));

    // Back on the same card, with the secret still in memory and no portal: one acceptance for each click, never by itself.
    expect(await screen.findByText(i18n.t('ownerInvitation.claimsPending.title'))).toBeInTheDocument();
    expect(screen.getByTestId('owner-invitation-retry')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(peekOwnerInvitationToken()).toBe(TOKEN);
  });

  it('OwnerInvitationRoute_LeavingThePageWhileARequestIsOnItsWay_TheAnswerDoesNotKeepTheSecretForWhoHasGone', async () => {
    mockAuth(true);
    let answer: (value: { data: unknown }) => void = () => undefined;
    vi.mocked(axios.post).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const view = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => {
      answer({ data: { ...ACCEPTED, claimsRefresh: 'failed' } });
    });

    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('OwnerInvitationRoute_LeavingThePageWhileTheClaimsAreNotPublished_ForgetsTheSecret', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockResolvedValue({ data: { ...ACCEPTED, claimsRefresh: 'failed' } });
    const view = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);
    await screen.findByText(i18n.t('ownerInvitation.claimsPending.title'));
    expect(peekOwnerInvitationToken()).toBe(TOKEN);

    view.unmount();

    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('continues through Auth0 without showing an error or reusing the invitation when silent refresh fails', async () => {
    mockAuth(true);
    refreshAccessToken.mockRejectedValue(new Error('login_required'));
    const page = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    const returnTo = `${OWNER_INVITATION_PATH}?resume=portal`;
    await waitFor(() => expect(login).toHaveBeenCalledWith({ returnTo }));
    expect(screen.getByTestId('owner-invitation-waiting')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('ownerInvitation.tokenPending.title'))).not.toBeInTheDocument();
    expect(peekOwnerInvitationToken()).toBeNull();

    page.unmount();
    openAt(returnTo);
    expect(await screen.findByTestId('owner-portal')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/owner-portal/properties', { localAuthRecovery: true });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the invite on one waiting screen while recovering from a forbidden portal response', async () => {
    mockAuth(true);
    vi.mocked(axios.get).mockRejectedValueOnce(problem(403, 'forbidden'));
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('owner-invitation-waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(OWNER_INVITATION_PATH);
  });

  it('offers a retry if Auth0 returns and the portal still denies access', async () => {
    mockAuth(true);
    vi.mocked(axios.get).mockRejectedValueOnce(problem(403, 'forbidden'));
    openAt(`${OWNER_INVITATION_PATH}?resume=portal`);

    expect(await screen.findByText(i18n.t('ownerInvitation.tokenPending.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
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
    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('OwnerInvitationRoute_EmailOfAnotherAccount_OffersAnotherSignInThatCarriesTheSecretInTheAppStateOnlyAndGrantsNothing', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValue(problem(403, 'owner_invitation_email_mismatch'));
    const view = openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByTestId('owner-invitation-switch'));

    expect(login).toHaveBeenLastCalledWith({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: TOKEN }, authorizationParams: { prompt: 'login' } });
    expect(JSON.stringify(vi.mocked(login).mock.calls[0][0].returnTo)).not.toContain(TOKEN);
    expect(logout).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('owner-portal')).not.toBeInTheDocument();
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);

    expect(peekOwnerInvitationToken()).toBe(TOKEN);
    view.unmount();
    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('OwnerInvitationRoute_EmailNotVerified_KeepsTheTokenAndANewSignInCarriesItAgain', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValueOnce(problem(403, 'owner_invitation_email_not_verified')).mockResolvedValue({ data: ACCEPTED });
    openAt(`${OWNER_INVITATION_PATH}?token=${TOKEN}`);

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('ownerInvitation.emailNotVerified.login') }));
    expect(login).toHaveBeenLastCalledWith({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: TOKEN } });
    expect(axios.post).toHaveBeenCalledTimes(1);

    // And «Riprova» sends the same secret once more, only because the person asked.
    fireEvent.click(screen.getByTestId('owner-invitation-retry'));
    await screen.findByTestId('owner-portal');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(vi.mocked(axios.post).mock.calls[1][1]).toEqual({ token: TOKEN });
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

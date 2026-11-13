import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { useAuth } from '@/hooks/use-auth';
import {
  clearOwnerContactToken,
  normalizeOwnerContactToken,
  OWNER_CONTACT_APP_STATE_KEY,
  OWNER_CONTACT_INVITATION_PATH,
  ownerContactFailureOf,
  peekOwnerContactToken,
  stashOwnerContactToken,
} from '@/lib/owner-contact-invitation';
import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';

configure({ asyncUtilTimeout: 8_000 });
vi.setConfig({ testTimeout: 60_000 });

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

let OwnerContactPage: typeof import('../owner-contact-page').OwnerContactPage;
beforeAll(async () => {
  ({ OwnerContactPage } = await import('../owner-contact-page'));
}, 240_000);

/** What the backend issues: 32 random bytes as URL-safe base64, 43 characters (case matters). */
const TOKEN = 'Qx7_aB-9kLmN0pRsTuVwXyZ1234567890AbCdEfGhIj';
const login = vi.fn();
const refreshAccessToken = vi.fn();

const ACCEPTED = { ownerUserId: 'owner-user-9', agencyIds: ['agency-1'], propertyIds: ['property-1'], alreadyAccepted: false, claimsRefresh: 'published' };

function mockAuth(authenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: authenticated,
    user: authenticated ? { email: 'contact@example.com' } : undefined,
    login,
    logout: vi.fn(),
    refreshAccessToken,
  } as unknown as ReturnType<typeof useAuth>);
}

function problem(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

function openAt(path: string) {
  window.history.pushState({}, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path={OWNER_CONTACT_INVITATION_PATH} element={<OwnerContactPage />} />
          <Route path={OWNER_PORTAL_HOME_PATH} element={<p data-testid="owner-portal">portal</p>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('the token of the invitation of a contact', () => {
  it('OwnerContactToken_IsOnly43OrSoCharactersOfTheUrlSafeAlphabet_AndCaseMatters', () => {
    expect(normalizeOwnerContactToken(TOKEN)).toBe(TOKEN);
    expect(normalizeOwnerContactToken(`  ${TOKEN}  `)).toBe(TOKEN);
    expect(normalizeOwnerContactToken(TOKEN.toLowerCase())).toBe(TOKEN.toLowerCase());
    expect(normalizeOwnerContactToken('short')).toBeNull();
    expect(normalizeOwnerContactToken(`${TOKEN}!`)).toBeNull();
    expect(normalizeOwnerContactToken(null)).toBeNull();
    clearOwnerContactToken();
    stashOwnerContactToken('not a token');
    expect(peekOwnerContactToken()).toBeNull();
    stashOwnerContactToken(TOKEN);
    expect(peekOwnerContactToken()).toBe(TOKEN);
    clearOwnerContactToken();
  });

  it('OwnerContactFailure_EachRefusalHasItsOwnWords', () => {
    expect(ownerContactFailureOf(problem(410, 'owner_contact_invitation_used'))).toEqual({ kind: 'unusable', reason: 'used' });
    expect(ownerContactFailureOf(problem(410, 'owner_contact_invitation_expired'))).toEqual({ kind: 'unusable', reason: 'expired' });
    expect(ownerContactFailureOf(problem(410, 'owner_contact_invitation_revoked'))).toEqual({ kind: 'unusable', reason: 'revoked' });
    expect(ownerContactFailureOf(problem(403, 'owner_contact_email_mismatch'))).toEqual({ kind: 'emailMismatch' });
    expect(ownerContactFailureOf(problem(403, 'owner_contact_email_not_verified'))).toEqual({ kind: 'emailNotVerified' });
    expect(ownerContactFailureOf(problem(404, 'not_found'))).toEqual({ kind: 'notFound' });
    expect(ownerContactFailureOf(problem(429, 'too_many_requests'))).toEqual({ kind: 'retry' });
    expect(ownerContactFailureOf(problem(422, 'something_else'))).toEqual({ kind: 'other' });
  });
});

describe('OwnerContactPage: the link of the e-mail and the round trip through the sign-in (NF-111, ADR-011)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearOwnerContactToken();
    await i18n.changeLanguage('it');
    mockAuth(false);
    refreshAccessToken.mockResolvedValue('a-new-access-token');
    vi.mocked(axios.post).mockResolvedValue({ data: ACCEPTED });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('OwnerContactRoute_LinkOfTheEmail_TakesTheTokenOutOfTheAddress_AndKeepsItInNoStorageNorLog', async () => {
    const logged = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByTestId('owner-contact-signup')).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.href).not.toContain(TOKEN);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    for (const spy of logged) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    // Nothing is sent before the person has signed in.
    expect(axios.post).not.toHaveBeenCalled();

    // The sign-in carries the secret in the `appState` only, and comes back to the page without it.
    fireEvent.click(screen.getByTestId('owner-contact-login'));
    expect(login).toHaveBeenLastCalledWith({ returnTo: OWNER_CONTACT_INVITATION_PATH, appState: { [OWNER_CONTACT_APP_STATE_KEY]: TOKEN }, authorizationParams: undefined });
    expect(JSON.stringify(vi.mocked(login).mock.calls[0][0].returnTo)).not.toContain(TOKEN);
  });

  it('OwnerContactRoute_SignedIn_AcceptsOnceWithTheSecretInTheBodyOnly_ThenOpensThePortalWithANewToken', async () => {
    mockAuth(true);
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=${TOKEN}`);

    expect(await screen.findByTestId('owner-portal')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('/owner-contacts/accept');
    expect(vi.mocked(axios.post).mock.calls[0][0]).not.toContain(TOKEN);
    expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ token: TOKEN });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    // The secret is forgotten once the claims are published.
    expect(peekOwnerContactToken()).toBeNull();
  });

  it('OwnerContactRoute_AcceptedButTheClaimsDidNotReachTheIdentityProvider_IsNotASuccess_AndRetryAcceptsAgain', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { ...ACCEPTED, claimsRefresh: 'failed' } });
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=${TOKEN}`);

    const retry = await screen.findByTestId('owner-contact-retry');
    expect(screen.getByText('Il tuo accesso al portale non è ancora attivo')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-portal')).toBeNull();
    expect(refreshAccessToken).not.toHaveBeenCalled();

    fireEvent.click(retry);
    expect(await screen.findByTestId('owner-portal')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('OwnerContactRoute_AnAccountThatIsNotTheInvitedOne_IsToldSo_AndALinkAlreadyUsedIsNotRetried', async () => {
    mockAuth(true);
    vi.mocked(axios.post).mockRejectedValueOnce(problem(403, 'owner_contact_email_mismatch'));
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=${TOKEN}`);
    fireEvent.click(await screen.findByTestId('owner-contact-switch'));
    expect(login).toHaveBeenLastCalledWith({
      returnTo: OWNER_CONTACT_INVITATION_PATH,
      appState: { [OWNER_CONTACT_APP_STATE_KEY]: TOKEN },
      authorizationParams: { prompt: 'login' },
    });
    cleanup();

    clearOwnerContactToken();
    vi.mocked(axios.post).mockRejectedValueOnce(problem(410, 'owner_contact_invitation_used'));
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=${TOKEN}`);
    expect(await screen.findByText('Questo invito è già stato usato')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-contact-retry')).toBeNull();
    // A link that does not work is final: the secret is forgotten.
    expect(peekOwnerContactToken()).toBeNull();
  });

  it('OwnerContactRoute_ALinkWithATokenThatIsNotOne_DoesNotWork_AndSendsNothing', async () => {
    mockAuth(true);
    openAt(`${OWNER_CONTACT_INVITATION_PATH}?token=abc`);
    expect(await screen.findByText('Questo invito non funziona')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

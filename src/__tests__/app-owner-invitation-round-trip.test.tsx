import { createElement, useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from '@/App';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { clearOwnerContactToken, OWNER_CONTACT_APP_STATE_KEY, OWNER_CONTACT_INVITATION_PATH, peekOwnerContactToken } from '@/lib/owner-contact-invitation';
import { clearOwnerInvitationToken, OWNER_INVITATION_APP_STATE_KEY, OWNER_INVITATION_PATH, peekOwnerInvitationToken } from '@/lib/owner-invitation';
import { getRouter } from '@/routes';

const signIn = vi.hoisted(() => ({
  appState: undefined as Record<string, unknown> | undefined,
  handed: 0,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children, onRedirectCallback }: { children: ReactNode; onRedirectCallback?: (appState?: Record<string, unknown>) => void }) => {
    useEffect(() => {
      void Promise.resolve().then(() => {
        onRedirectCallback?.(signIn.appState);
        signIn.handed += 1;
      });
    }, [onRedirectCallback]);
    return children;
  },
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { email: 'owner@example.com' },
    loginWithRedirect: signIn.loginWithRedirect,
    logout: signIn.logout,
    getAccessTokenSilently: signIn.getAccessTokenSilently,
  }),
}));

vi.mock('@/routes', async () => {
  const { createMemoryRouter } = await import('react-router-dom');
  const { OwnerInvitationPage } = await import('@/features/owner-portal/owner-invitation-page');
  const { OwnerContactPage } = await import('@/features/owner-portal/owner-contact-page');
  const router = createMemoryRouter([
    { path: '/portale-proprietari/invito', element: createElement(OwnerInvitationPage) },
    { path: '/portale-proprietari/contatto', element: createElement(OwnerContactPage) },
    { path: '/portale-proprietari', element: createElement('p', { 'data-testid': 'owner-portal' }, 'portal') },
    { path: '*', element: createElement('p', { 'data-testid': 'elsewhere' }, 'elsewhere') },
  ]);
  return { getRouter: () => router };
});

vi.mock('@/contexts/feature-flags-provider', () => ({ FeatureFlagsProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/routes/ui-version-sync', () => ({ UiVersionSync: () => null }));
vi.mock('@/i18n/i18n-locale-sync', () => ({ I18nLocaleSync: () => null }));
vi.mock('@/components/shared/app-toaster', () => ({ AppToaster: () => null }));
vi.mock('@/lib/axios', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/axios')>()), default: { post: vi.fn(), get: vi.fn() } }));

const TOKEN = 'c3'.repeat(32);
const ACCEPTED = { ownerUserId: 'owner-user-1', agencyIds: ['agency-1'], ownedPropertyIds: ['property-1'], alreadyAccepted: false, claimsRefresh: 'published' };

const CONTACT_TOKEN = 'Qx7_aB-9kLmN0pRsTuVwXyZ1234567890AbCdEfGhIj';
const ACCEPTED_CONTACT = { ownerUserId: 'owner-user-9', agencyIds: ['agency-1'], propertyIds: ['property-1'], alreadyAccepted: false, claimsRefresh: 'published' };

describe('App: the secret of an owner invitation across the sign-in (E10/F03/US05/T01, NF-109, ADR-011-R6)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearOwnerInvitationToken();
    signIn.handed = 0;
    await i18n.changeLanguage('it');
    signIn.getAccessTokenSilently.mockResolvedValue('a-new-access-token');
    vi.mocked(axios.post).mockResolvedValue({ data: ACCEPTED });
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    await getRouter().navigate('/', { replace: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('OwnerInvitationRoute_AuthRoundTripThroughTheApp_HandsTheSecretOfTheAppStateToThePageAndSendsItOnce_Test', async () => {
    signIn.appState = { returnTo: OWNER_INVITATION_PATH, [OWNER_INVITATION_APP_STATE_KEY]: TOKEN };
    render(<App />);

    await screen.findByTestId('owner-portal');

    // The page of the link found the secret that `handleAuthRedirect` of the app had put in memory, sent it once in the body (never in an address) and forgot it.
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/owner-invitations/accept');
    expect(url).not.toContain(TOKEN);
    expect(body).toEqual({ token: TOKEN });
    expect(getRouter().state.location.search).toBe('');
    expect(peekOwnerInvitationToken()).toBeNull();
    expect(signIn.getAccessTokenSilently).toHaveBeenCalledTimes(1);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('OwnerInvitationRoute_AuthRoundTripThroughTheApp_WithoutTheSecretInTheAppState_TheLinkDoesNotWorkAndNothingIsSent', async () => {
    signIn.appState = { returnTo: OWNER_INVITATION_PATH };
    render(<App />);

    expect(await screen.findByText(i18n.t('ownerInvitation.unusable.invalid.title'))).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    expect(peekOwnerInvitationToken()).toBeNull();
  });

  it('OwnerInvitationRoute_AuthRoundTripThroughTheApp_ThingsThatAreNotTheSecret_AreNotKept', async () => {
    const signIns: Array<Record<string, unknown> | undefined> = [
      { returnTo: '/app/short-rent' },
      { returnTo: '/app/short-rent', [OWNER_INVITATION_APP_STATE_KEY]: 'not-a-token' },
      { returnTo: '/app/short-rent', [OWNER_INVITATION_APP_STATE_KEY]: `${TOKEN}0` },
      undefined,
    ];
    for (const [index, appState] of signIns.entries()) {
      cleanup();
      await getRouter().navigate('/', { replace: true });
      signIn.appState = appState;
      render(<App />);

      await waitFor(() => expect(signIn.handed).toBe(index + 1));
      await waitFor(() => expect(getRouter().state.location.pathname).toBe(typeof appState?.returnTo === 'string' ? appState.returnTo : '/'));
      expect(peekOwnerInvitationToken()).toBeNull();
    }
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('App: the secret of the invitation of a CONTACT across the sign-in (E07/F07/US01/T03, NF-111, ADR-011)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearOwnerContactToken();
    clearOwnerInvitationToken();
    signIn.handed = 0;
    await i18n.changeLanguage('it');
    signIn.getAccessTokenSilently.mockResolvedValue('a-new-access-token');
    vi.mocked(axios.post).mockResolvedValue({ data: ACCEPTED_CONTACT });
    await getRouter().navigate('/', { replace: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('OwnerContactRoute_AuthRoundTripThroughTheApp_HandsTheSecretOfTheAppStateToThePageAndSendsItOnce_Test', async () => {
    signIn.appState = { returnTo: OWNER_CONTACT_INVITATION_PATH, [OWNER_CONTACT_APP_STATE_KEY]: CONTACT_TOKEN };
    render(<App />);

    await screen.findByTestId('owner-portal');

    // The page of the link found the secret that `handleAuthRedirect` of the app had put in memory, sent it once in the body (never in an address) and forgot it.
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe('/owner-contacts/accept');
    expect(url).not.toContain(CONTACT_TOKEN);
    expect(body).toEqual({ token: CONTACT_TOKEN });
    expect(getRouter().state.location.search).toBe('');
    expect(peekOwnerContactToken()).toBeNull();
    expect(signIn.getAccessTokenSilently).toHaveBeenCalledTimes(1);
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('OwnerContactRoute_AuthRoundTripThroughTheApp_WithoutTheSecretInTheAppState_TheLinkDoesNotWorkAndNothingIsSent', async () => {
    signIn.appState = { returnTo: OWNER_CONTACT_INVITATION_PATH };
    render(<App />);

    expect(await screen.findByText(i18n.t('ownerContactInvitation.unusable.invalid.title'))).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    expect(peekOwnerContactToken()).toBeNull();
  });

  it('OwnerContactRoute_AuthRoundTripThroughTheApp_ThingsThatAreNotTheSecret_AreNotKept', async () => {
    const signIns: Array<Record<string, unknown> | undefined> = [
      { returnTo: '/app/short-rent' },
      { returnTo: '/app/short-rent', [OWNER_CONTACT_APP_STATE_KEY]: 'not-a-token' },
      { returnTo: '/app/short-rent', [OWNER_CONTACT_APP_STATE_KEY]: `${CONTACT_TOKEN}!` },
      // The secret of the invitation of an OWNER is under another name of the appState: it is never taken for the one of a contact.
      { returnTo: '/app/short-rent', [OWNER_INVITATION_APP_STATE_KEY]: 'c3'.repeat(32) },
      undefined,
    ];
    for (const [index, appState] of signIns.entries()) {
      cleanup();
      await getRouter().navigate('/', { replace: true });
      signIn.appState = appState;
      render(<App />);

      await waitFor(() => expect(signIn.handed).toBe(index + 1));
      await waitFor(() => expect(getRouter().state.location.pathname).toBe(typeof appState?.returnTo === 'string' ? appState.returnTo : '/'));
      expect(peekOwnerContactToken()).toBeNull();
      clearOwnerInvitationToken();
    }
    expect(axios.post).not.toHaveBeenCalled();
  });
});

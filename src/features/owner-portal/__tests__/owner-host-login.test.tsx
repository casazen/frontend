// This file runs on the own domain of an agency: the page the browser is on is the origin of the agency, as it is when the sign-in starts there.
// @vitest-environment-options {"url": "https://prenota.quokka.example.test/"}
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { authConfig } from '@/config/auth.config';
import { AuthAppProviders } from '@/contexts/auth-bridge';
import { useAuth } from '@/hooks/use-auth';
import { setHostSite, type HostSite } from '@/lib/host-site';
import { safeReturnTo } from '@/lib/auth-return-to';
import { clearOwnerInvitationToken } from '@/lib/owner-invitation';
import { appRoutes } from '@/routes';
import { buildHostSiteRoutes } from '@/routes/host-site-routes';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { OwnerHostLoginPage } from '../owner-host-login-page';

// The sign-in service is the only thing replaced: what it is told (`loginWithRedirect`, `logout`) is what is checked. The bridge of the app, the pages and the routes are the real ones.
const auth0 = vi.hoisted(() => ({
  isLoading: false,
  authenticated: false,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => children,
  useAuth0: () => ({
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.authenticated,
    user: auth0.authenticated ? { email: 'owner@example.com' } : undefined,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
    getAccessTokenSilently: auth0.getAccessTokenSilently,
  }),
}));

// The portal itself is not what is tried here, except for its way out: the route tests land on a stand-in, the sign-out test on the real shell.
const shell = vi.hoisted(() => ({ real: false }));
vi.mock('@/features/owner-portal/owner-portal-shell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/owner-portal/owner-portal-shell')>();
  return { OwnerPortalShell: () => (shell.real ? <actual.OwnerPortalShell /> : <div data-testid="owner-portal-shell" />) };
});
vi.mock('@/queries/ownerPortal', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/queries/ownerPortal')>()), useCanManageOwnerContacts: () => false }));

/** The own domain of an agency whose owners can sign in, and the origin the browser is on there (the docblock at the top of the file). */
const HOST_ORIGIN = 'https://prenota.quokka.example.test';
const READY: HostSite = {
  host: 'prenota.quokka.example.test',
  slug: 'quokka',
  displayName: 'Quokka',
  surfaces: { guestArea: true, ownerPortal: true },
  ownerLoginReady: true,
  branding: { logoUrl: null, primaryColor: '#1a5276', themeId: null, fontId: null, displayName: 'Quokka', showPoweredBy: false },
};

const STARTED_KEY = 'casazen.owner-host-login-started-at';

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

/** Shows where the router is. */
function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderLoginPage(strict = false) {
  const tree = (
    <QueryClientProvider client={queryClient()}>
      <AuthAppProviders>
        <MemoryRouter initialEntries={['/portale-proprietari/accedi']}>
          <Routes>
            <Route path="/portale-proprietari/accedi" element={<OwnerHostLoginPage />} />
            <Route path="/portale-proprietari" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthAppProviders>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe('sign-in and sign-out of the own domain of an agency (E40/F02/US01/T02, NF-141)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    auth0.isLoading = false;
    auth0.authenticated = false;
    shell.real = false;
    auth0.getAccessTokenSilently.mockResolvedValue('a-new-access-token');
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    // The secret of a link waits in memory for the sign-in: no test leaves one for the next.
    clearOwnerInvitationToken();
  });

  it('redirect_uri is the host origin, the return lands on /portale-proprietari, sign-out returns to the host', () => {
    // redirect_uri: the identity service is told the origin of the page the sign-in starts from, so on the agency's domain it is the agency's origin.
    expect(window.location.origin).toBe(HOST_ORIGIN);
    expect(authConfig.authorizationParams.redirect_uri).toBe(HOST_ORIGIN);
    // The tokens are kept in the storage of that origin: nothing is shared with the CasaZen domain.
    expect(authConfig.cacheLocation).toBe('localstorage');

    // The return: the sign-in page asks for `/portale-proprietari`, which is a path the app accepts as a return address and nothing that could leave the origin.
    expect(safeReturnTo('/portale-proprietari')).toBe('/portale-proprietari');
    expect(safeReturnTo('/portale-proprietari/invito')).toBe('/portale-proprietari/invito');
    for (const outside of ['https://evil.example.test/portale-proprietari', '//evil.example.test/portale-proprietari', '/\\evil.example.test', 'portale-proprietari', undefined, null]) {
      expect(safeReturnTo(outside)).toBeNull();
    }

    // Sign-out: the bridge sends the browser back to the origin of the page, the agency's domain.
    function SignOutButton() {
      const { logout } = useAuth();
      return (
        <button type="button" onClick={logout}>
          out
        </button>
      );
    }
    render(
      <AuthAppProviders>
        <SignOutButton />
      </AuthAppProviders>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'out' }));

    expect(auth0.logout).toHaveBeenCalledTimes(1);
    expect(auth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: HOST_ORIGIN } });
  });

  it('SignOutOfTheOwnerShell_OnTheHostOrigin_ReturnsToTheHost', async () => {
    shell.real = true;
    auth0.authenticated = true;

    render(
      <QueryClientProvider client={queryClient()}>
        <AuthAppProviders>
          <MemoryRouter initialEntries={['/portale-proprietari']}>
            <OwnerPortalShell />
          </MemoryRouter>
        </AuthAppProviders>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByTestId('owner-sign-out'));

    expect(auth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: HOST_ORIGIN } });
  });

  describe('OwnerHostLoginPage', () => {
    it('OwnerHostLoginPage_SignedOutOwner_StartsTheLoginThatReturnsToThePortalOnce', async () => {
      renderLoginPage();

      expect(await screen.findByTestId('owner-host-login-redirecting')).toHaveTextContent('Ti stiamo portando alla pagina di accesso');
      await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
      const [options] = auth0.loginWithRedirect.mock.calls[0];
      // The return is a path of the agency's domain (the identity service gives the browser back at the origin of the page, then the app goes there).
      expect(options.appState).toEqual({ returnTo: '/portale-proprietari' });
      // The start is remembered in this tab only, to tell a return from a loop.
      expect(sessionStorage.getItem(STARTED_KEY)).not.toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('OwnerHostLoginPage_StrictModeRendersTheEffectsTwice_StillStartsTheLoginOnce', async () => {
      renderLoginPage(true);

      await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
    });

    it('OwnerHostLoginPage_ComesBackWithinAFewSecondsOfTheLastStart_OffersTheWayInWithAButtonInsteadOfARedirectLoop', async () => {
      // The browser's back button from the sign-in, or an error of the sign-in that sends the app here again.
      sessionStorage.setItem(STARTED_KEY, String(Date.now() - 2_000));

      renderLoginPage();

      const button = await screen.findByTestId('owner-host-login-button');
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
      expect(screen.queryByTestId('owner-host-login-redirecting')).not.toBeInTheDocument();
      fireEvent.click(button);
      expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1);
      expect(auth0.loginWithRedirect.mock.calls[0][0].appState).toEqual({ returnTo: '/portale-proprietari' });
    });

    it('OwnerHostLoginPage_StartLongAgo_IsNotALoop', async () => {
      sessionStorage.setItem(STARTED_KEY, String(Date.now() - 60_000));

      renderLoginPage();

      await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
    });

    it('OwnerHostLoginPage_AlreadySignedInOwner_GoesStraightToThePortalWithoutStartingAnything', async () => {
      auth0.authenticated = true;

      renderLoginPage();

      expect(await screen.findByTestId('where')).toHaveTextContent('/portale-proprietari');
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    });

    it('OwnerHostLoginPage_SessionStillBeingChecked_WaitsAndStartsNothing', async () => {
      auth0.isLoading = true;

      renderLoginPage();

      expect(await screen.findByTestId('owner-host-login-redirecting')).toBeInTheDocument();
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
      expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    });
  });

  describe('the owner routes of a host that is registered', () => {
    function renderHost(entry: string) {
      setHostSite(READY);
      const router = createMemoryRouter(buildHostSiteRoutes(appRoutes, READY), { initialEntries: [entry] });
      render(
        <QueryClientProvider client={queryClient()}>
          <AuthAppProviders>
            <RouterProvider router={router} />
          </AuthAppProviders>
        </QueryClientProvider>,
      );
      return router;
    }

    it('RouteOfTheSignIn_IsTheSignInPageOfTheDomainInsideTheFrameOfTheAgency', async () => {
      renderHost('/portale-proprietari/accedi');

      const frame = await screen.findByTestId('host-surface-frame');
      expect(within(frame).getByTestId('owner-host-login')).toBeInTheDocument();
      expect(within(frame).getByTestId('host-surface-frame-home')).toHaveTextContent('Quokka');
      await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
    });

    it.each(['/portale-proprietari/invito', '/portale-proprietari/contatto'])('RouteOfTheInvitation_%s_IsThePageOfTheLinkInsideTheFrame', async (path) => {
      renderHost(path);

      const frame = await screen.findByTestId('host-surface-frame');
      // The page of the link, as on the CasaZen domain: with no secret in the link it says so, and asks nothing of the server.
      expect(within(frame).getByTestId('invite-accept-page')).toBeInTheDocument();
      expect(screen.queryByTestId('owner-login-not-enabled')).not.toBeInTheDocument();
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    });

    it('RouteOfTheInvitation_LinkOfTheEmailOnTheDomain_SecretLeavesTheAddressAndTravelsInTheAppStateOfTheLogin', async () => {
      // The secret of an invitation, as the backend issues it (64 hex characters).
      const secret = 'd4'.repeat(32);
      const router = renderHost(`/portale-proprietari/invito?token=${secret}`);

      const login = await screen.findByTestId('owner-invitation-login');
      // Out of the address bar and the router at once; it waits in memory for the sign-in.
      await waitFor(() => expect(router.state.location.search).toBe(''));
      expect(document.body.innerHTML).not.toContain(secret);
      expect(Object.keys(localStorage)).toHaveLength(0);
      expect(Object.keys(sessionStorage)).toHaveLength(0);

      fireEvent.click(login);

      // It goes with the sign-in in the `appState`, never in an address, and the return is the page of the link on this same domain.
      expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1);
      const [options] = auth0.loginWithRedirect.mock.calls[0];
      expect(options.appState).toEqual({ ownerInvitation: secret, returnTo: '/portale-proprietari/invito' });
      expect(JSON.stringify(options.authorizationParams)).not.toContain(secret);
    });

    it('RouteOfThePortal_SignedOutVisitor_GoesToTheSignInPageOfTheDomainNeverToLogin', async () => {
      const router = renderHost('/portale-proprietari');

      expect(await screen.findByTestId('owner-host-login')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/portale-proprietari/accedi');
      expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    });

    it('RouteOfThePortal_PageOfThePortalWhileSignedOut_GoesToTheSignInPageToo', async () => {
      const router = renderHost('/portale-proprietari/contabilita');

      expect(await screen.findByTestId('owner-host-login')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/portale-proprietari/accedi');
    });

    it('RouteOfThePortal_SignedInOwner_ShowsThePortalInsideTheFrame', async () => {
      auth0.authenticated = true;

      renderHost('/portale-proprietari');

      const frame = await screen.findByTestId('host-surface-frame');
      expect(await within(frame).findByTestId('owner-portal-shell')).toBeInTheDocument();
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    });

    it('RouteOfTheSignIn_SignedInOwner_GoesStraightToThePortal', async () => {
      auth0.authenticated = true;

      const router = renderHost('/portale-proprietari/accedi');

      expect(await screen.findByTestId('owner-portal-shell')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/portale-proprietari');
    });

    it('RouteOfTheConsoleLogin_IsStillNotFoundOnTheDomain', async () => {
      const router = renderHost('/login');

      expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    });
  });
});

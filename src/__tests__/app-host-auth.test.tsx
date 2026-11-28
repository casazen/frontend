import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createMemoryRouter } from 'react-router-dom';
import App from '@/App';
import { publicCheckinApi } from '@/api/checkin.api';
import i18n from '@/i18n/config';
import axiosInstance from '@/lib/axios';
import { setHostSite, type HostSite } from '@/lib/host-site';
import { hostNeedsAuth, isSignInErrorReturn } from '@/lib/secure-origin';
import { getRouter } from '@/routes';
import type { PublicOrgDto } from '@/types';

// The sign-in service is the only thing replaced. Its provider is a marker in the page (so a test can see whether the app mounted it) and hands the app, once it is mounted, the `appState`
// that `login()` would have given back after the redirect: only for a return that completes. A return that comes back with an error does what the real provider does (it reads the answer, does not
// call `onRedirectCallback` and reports the failure as `error`). Everything else is the app: `App`, the auth bridge, `handleAuthRedirect` and the route table of the agency's own domain.
const auth0 = vi.hoisted(() => ({
  appState: undefined as Record<string, unknown> | undefined,
  error: undefined as Error | undefined,
  authenticated: false,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
}));

// The router of the app is created once per page load: the test makes a new one for each page it opens.
const testRouter = vi.hoisted(() => ({ reset: (): void => undefined }));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children, onRedirectCallback }: { children: ReactNode; onRedirectCallback?: (appState?: Record<string, unknown>) => void }) => {
    useEffect(() => {
      if (auth0.appState) void Promise.resolve().then(() => onRedirectCallback?.(auth0.appState));
    }, [onRedirectCallback]);
    return <div data-testid="auth0-provider">{children}</div>;
  },
  useAuth0: () => ({
    isLoading: false,
    error: auth0.error,
    isAuthenticated: auth0.authenticated,
    user: auth0.authenticated ? { email: 'owner@example.com' } : undefined,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
    getAccessTokenSilently: auth0.getAccessTokenSilently,
  }),
}));

// The routes are the real ones of the agency's own domain for the site the test sets (or the whole app when there is none), in a memory router that starts where the browser is.
vi.mock('@/routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/routes')>();
  const { buildHostSiteRoutes } = await import('@/routes/host-site-routes');
  const { toAppPath } = await import('@/routes/host-site-window');
  const { getHostSite } = await import('@/lib/host-site');
  let router: ReturnType<typeof createMemoryRouter> | null = null;
  testRouter.reset = () => {
    router?.dispose();
    router = null;
  };
  return {
    ...actual,
    getRouter: () => {
      if (!router) {
        const site = getHostSite();
        const { pathname, search } = window.location;
        router = site
          ? createMemoryRouter(buildHostSiteRoutes(actual.appRoutes, site), { initialEntries: [`${toAppPath(pathname, site.slug)}${search}`] })
          : createMemoryRouter(actual.appRoutes, { initialEntries: [`${pathname}${search}`] });
      }
      return router;
    },
  };
});

// The owner portal itself is not what is tried here: the router only has to land on it.
vi.mock('@/features/owner-portal/owner-portal-shell', () => ({ OwnerPortalShell: () => <div data-testid="owner-portal-shell" /> }));

const ORG: PublicOrgDto = { slug: 'villa-rossi', displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: null, tagline: null };
vi.mock('@/queries/use-public-org', () => ({
  usePublicOrg: () => ({ data: ORG, isLoading: false, isError: false }),
  useOrgProperties: () => ({ data: [], isLoading: false, isError: false }),
  useOrgPublicProperty: () => ({ data: undefined, isLoading: true, isError: false }),
}));
vi.mock('@/api/checkin.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/checkin.api')>();
  return { ...actual, publicCheckinApi: { ...actual.publicCheckinApi, getContext: vi.fn() } };
});

// Parts of the shell that read the network or the clock of the app: not what is tried here.
vi.mock('@/contexts/feature-flags-provider', () => ({ FeatureFlagsProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/routes/ui-version-sync', () => ({ UiVersionSync: () => null }));
vi.mock('@/i18n/i18n-locale-sync', () => ({ I18nLocaleSync: () => null }));
vi.mock('@/components/shared/app-toaster', () => ({ AppToaster: () => null }));

/** The agency's own domain, with the surfaces on, in the states the backend can say. */
const HOST: HostSite = { host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' };
const READY: HostSite = { ...HOST, surfaces: { guestArea: true, ownerPortal: true }, ownerLoginReady: true };
const NOT_READY: HostSite = { ...HOST, surfaces: { guestArea: true, ownerPortal: true } };
const OWNER_OFF: HostSite = { ...HOST, surfaces: { guestArea: true, ownerPortal: false }, ownerLoginReady: true };

/** The page the browser is on when the app starts. */
function openAt(url: string) {
  window.history.replaceState(null, '', url);
}

const provider = () => screen.queryByTestId('auth0-provider');

/** A read that the server refuses, as it does for the token of a person who is not an owner of this agency: the answer is a bare 403. */
async function refusedRead(config: InternalAxiosRequestConfig): Promise<never> {
  throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, { status: 403, statusText: 'Forbidden', headers: {}, config, data: '' });
}

describe('hostNeedsAuth (NF-141)', () => {
  it.each([
    '/portale-proprietari',
    '/portale-proprietari/',
    '/portale-proprietari/accedi',
    '/portale-proprietari/invito',
    '/portale-proprietari/contatto',
    '/portale-proprietari/contabilita/sv-1',
    '/portale-proprietari/accesso-negato',
    // The router reads an address without looking at the case and decodes its segments: these are the portal for it, so they need the sign-in service too (or its boundary would reload the page for ever).
    '/Portale-Proprietari',
    '/PORTALE-PROPRIETARI/Accedi',
    '/portale%2Dproprietari/accedi',
  ])('hostNeedsAuth_ReadyHost_%s_IsTrue', (path) => {
    expect(hostNeedsAuth(READY, path, '')).toBe(true);
  });

  it.each([
    '/',
    '/property/casa-mare',
    '/property/casa-mare/checkout',
    '/my-bookings',
    '/booking/0f6c',
    '/checkin/abc',
    '/search',
    '/embed/booking',
    '/portale-proprietari-x',
    '/Portale-Proprietari-x',
    '/legale/privacy',
  ])(
    'hostNeedsAuth_ReadyHost_%s_IsFalse',
    (path) => {
      // The booking site, the guest area and the widgets work with no sign-in module at all.
      expect(hostNeedsAuth(READY, path, '')).toBe(false);
      expect(hostNeedsAuth(READY, path, '?checkin=2026-12-01&guests=2&lang=it')).toBe(false);
    },
  );

  it.each([
    ['?code=abc&state=xyz', true],
    ['?state=xyz&code=abc', true],
    ['?error=access_denied&state=xyz', true],
    ['?error=access_denied&error_description=nope&state=xyz', true],
    ['?code=abc', false],
    ['?state=xyz', false],
    ['?error=access_denied', false],
    // The code of a booking, in the link of an e-mail, is not an answer of the sign-in.
    ['?code=K7M4Q-9XP2H', false],
    ['', false],
  ])('hostNeedsAuth_ReadyHostAtTheRoot_With_%s_Is_%s', (search, expected) => {
    expect(hostNeedsAuth(READY, '/', search)).toBe(expected);
  });

  it.each(['/embed/booking', '/embed/property/casa-mare', '/embed/guest-access', '/embed/v1/embed.js', '/EMBED/booking', '/%65mbed/booking'])(
    'hostNeedsAuth_ReadyHost_TheWidget_%s_IsFalseWhateverItsQuerySays',
    (path) => {
      // The widgets are frames of other sites: no session module, no storage (NF-145), even for an address that looks like the return of a sign-in.
      expect(hostNeedsAuth(READY, path, '?code=abc&state=xyz')).toBe(false);
      expect(hostNeedsAuth(READY, path, '?error=access_denied&state=xyz&lang=it&parent=https%3A%2F%2Fquokka.example.test&v=1')).toBe(false);
    },
  );

  it.each([
    ['a host that is not registered', NOT_READY],
    ['a host whose owner portal is off', OWNER_OFF],
    ['a host that says nothing of the surfaces', HOST],
    ['a host that says the sign-in is ready without a surface', { ...HOST, ownerLoginReady: true }],
    ["no site (the app's own host)", null],
  ])('hostNeedsAuth_%s_IsAlwaysFalse', (_name, site) => {
    expect(hostNeedsAuth(site, '/portale-proprietari/accedi', '')).toBe(false);
    expect(hostNeedsAuth(site, '/', '?code=abc&state=xyz')).toBe(false);
  });
});

describe('isSignInErrorReturn (NF-141)', () => {
  it.each([
    ['?error=access_denied&state=xyz', true],
    ['?state=xyz&error=access_denied&error_description=Account%20blocked', true],
    ['?code=abc&state=xyz', false],
    ['?error=access_denied', false],
    ['?state=xyz', false],
    ['', false],
  ])('isSignInErrorReturn_%s_Is_%s', (search, expected) => {
    expect(isSignInErrorReturn(search)).toBe(expected);
  });
});

describe('App on the own domain of an agency (E40/F02/US01/T02, NF-141)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    auth0.appState = undefined;
    auth0.error = undefined;
    auth0.authenticated = false;
    auth0.getAccessTokenSilently.mockResolvedValue('a-new-access-token');
    // A link that is already completed: the check-in page shows its closing card, nothing to fill in.
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo' });
    testRouter.reset();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    testRouter.reset();
    openAt('/');
  });

  it('not-ready host: no redirect to Auth0 and no Auth0 provider', async () => {
    setHostSite(NOT_READY);
    openAt('/portale-proprietari/accedi');

    render(<App />);

    // «Not yet enabled» instead of an error or a redirect.
    expect(await screen.findByTestId('owner-login-not-enabled')).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owner-host-login')).not.toBeInTheDocument();
  });

  it.each(['/portale-proprietari', '/portale-proprietari/invito', '/portale-proprietari/contatto', '/portale-proprietari/contabilita'])(
    'not-ready host: %s is the same page, still with no provider and no redirect',
    async (path) => {
      setHostSite(NOT_READY);
      openAt(path);

      render(<App />);

      expect(await screen.findByTestId('owner-login-not-enabled')).toBeInTheDocument();
      expect(provider()).not.toBeInTheDocument();
      expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    },
  );

  it('not-ready host: the address the sign-in would return to mounts nothing and shows the booking site', async () => {
    setHostSite(NOT_READY);
    openAt('/?code=abc&state=xyz');

    render(<App />);

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
  });

  it.each([
    ['/', 'public-site-shell'],
    ['/my-bookings', 'public-site-shell'],
    ['/checkin/abc', 'checkin-success'],
  ])('public host pages never mount Auth0: %s', async (path, page) => {
    // Even on a host that is registered with the sign-in service, only the owner portal and the return of the sign-in are not public pages.
    setHostSite(READY);
    openAt(path);

    render(<App />);

    expect(await screen.findByTestId(page)).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it('ready host: the owner portal mounts the sign-in service and its sign-in page starts the login of this domain', async () => {
    setHostSite(READY);
    openAt('/portale-proprietari/accedi');

    render(<App />);

    expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
    await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
    const [options] = auth0.loginWithRedirect.mock.calls[0];
    expect(options.appState).toEqual({ returnTo: '/portale-proprietari' });
    expect(screen.getByTestId('host-surface-frame')).toBeInTheDocument();
  });

  it.each(['/Portale-Proprietari/accedi', '/PORTALE-PROPRIETARI/Accedi', '/portale%2Dproprietari/accedi'])(
    'ready host: the owner portal opened as %s mounts the sign-in service and is not loaded again for ever',
    async (path) => {
      // The router reads these addresses as the portal (it decodes them and does not look at the case). If the app did not, the page would be shown with no sign-in service under the boundary that asks for it:
      // that boundary loads the page again, to the same address, and the page would never appear.
      setHostSite(READY);
      openAt(path);

      render(<App />);

      expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
      expect(await screen.findByTestId('owner-host-login')).toBeInTheDocument();
      await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    },
  );

  it('ready host: a 403 on a read of the portal opens the no-access page of the domain, which has the way out, and never «not found»', async () => {
    // A signed-in person who is not an owner of this agency (or an owner of another one): the server refuses the read, the shared client tells the app, and `/app/no-access` does not exist on a host.
    setHostSite(READY);
    openAt('/portale-proprietari');
    auth0.authenticated = true;
    render(<App />);
    expect(await screen.findByTestId('owner-portal-shell')).toBeInTheDocument();

    await axiosInstance.get('/owner-portal/dashboard', { adapter: refusedRead }).catch(() => undefined);

    expect(await screen.findByTestId('owner-host-no-access')).toBeInTheDocument();
    expect(getRouter().state.location.pathname).toBe('/portale-proprietari/accesso-negato');
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(screen.getByTestId('host-surface-frame')).toContainElement(screen.getByTestId('owner-host-no-access'));
    // The portal with its sign-out is gone by now: this page is the way out, and it brings the browser back to this domain.
    fireEvent.click(screen.getByTestId('owner-host-no-access-sign-out'));
    expect(auth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
  });

  it('ready host: the address the sign-in returns to mounts the sign-in service and completes the return', async () => {
    setHostSite(READY);
    openAt('/?code=abc&state=xyz');
    // What `login({ returnTo })` kept in the `appState`, handed back by the provider once it has read the answer.
    auth0.appState = { returnTo: '/portale-proprietari' };
    auth0.authenticated = true;

    render(<App />);

    expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
    // The return goes through the router of the host, to the page the owner asked for.
    expect(await screen.findByTestId('owner-portal-shell')).toBeInTheDocument();
    expect(getRouter().state.location.pathname).toBe('/portale-proprietari');
  });

  it('ready host: a sign-in that comes back with an error says so on the sign-in page of the domain, it does not leave the booking site with the answer in the address', async () => {
    setHostSite(READY);
    openAt('/?error=access_denied&error_description=Account%20blocked&state=xyz');
    // What the real provider does with such a return: it reads the answer, never calls `onRedirectCallback`, and reports the failure.
    auth0.error = new Error('access_denied');

    render(<App />);

    expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
    // The failure is told, inside the frame of the agency, and nothing sends the person off again by itself.
    const failed = await screen.findByTestId('owner-host-login-failed');
    expect(failed).toHaveTextContent('L’accesso non è andato a buon fine');
    expect(screen.getByTestId('host-surface-frame')).toContainElement(failed);
    expect(screen.queryByTestId('public-site-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owner-host-login-redirecting')).not.toBeInTheDocument();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    // The answer of the sign-in is out of the address (the entry is replaced, not added); the way to try again is a button.
    expect(getRouter().state.location.pathname).toBe('/portale-proprietari/accedi');
    expect(getRouter().state.location.search).toBe('');
    fireEvent.click(screen.getByTestId('owner-host-login-button'));
    expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1);
    expect(auth0.loginWithRedirect.mock.calls[0][0].appState).toEqual({ returnTo: '/portale-proprietari' });
  });

  it.each([
    ['/', 'public-site-shell'],
    ['/portale-proprietari/accedi', 'owner-host-login'],
  ])('ready host: %s with no answer of the sign-in in the address is not a failed sign-in, whatever the service reports', async (path, page) => {
    // The failure is only told for the return from the login: a person who simply opens a page is not told that a sign-in failed.
    setHostSite(READY);
    openAt(path);
    auth0.error = new Error('login_required');

    render(<App />);

    expect(await screen.findByTestId(page)).toBeInTheDocument();
    expect(screen.queryByTestId('owner-host-login-failed')).not.toBeInTheDocument();
  });

  it('ready host: the return address with a code and no state is not an answer of the sign-in and mounts nothing', async () => {
    setHostSite(READY);
    openAt('/?code=K7M4Q-9XP2H');

    render(<App />);

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
  });

  it('host whose owner portal is off: the owner paths are not found and nothing mounts the sign-in service', async () => {
    setHostSite(OWNER_OFF);
    openAt('/portale-proprietari/accedi');

    render(<App />);

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
  });

  it("the app's own host behaves as before: the owner sign-in mounts the sign-in service, a booking site does not", async () => {
    openAt('/portale-proprietari/accedi');
    render(<App />);
    expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
    expect(screen.queryByTestId('host-surface-frame')).not.toBeInTheDocument();
    cleanup();
    testRouter.reset();

    openAt('/book/villa-rossi');
    render(<App />);
    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(provider()).not.toBeInTheDocument();
  });
});

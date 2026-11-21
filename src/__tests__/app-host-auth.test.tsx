import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import App from '@/App';
import { publicCheckinApi } from '@/api/checkin.api';
import i18n from '@/i18n/config';
import { setHostSite, type HostSite } from '@/lib/host-site';
import { hostNeedsAuth } from '@/lib/secure-origin';
import { getRouter } from '@/routes';
import type { PublicOrgDto } from '@/types';

// The sign-in service is the only thing replaced. Its provider is a marker in the page (so a test can see whether the app mounted it) and hands the app, once it is mounted, the `appState`
// that `login()` would have given back after the redirect. Everything else is the app: `App`, the auth bridge, `handleAuthRedirect` and the route table of the agency's own domain.
const auth0 = vi.hoisted(() => ({
  appState: undefined as Record<string, unknown> | undefined,
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
  usePropertyAvailability: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
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

describe('hostNeedsAuth (NF-141)', () => {
  it.each(['/portale-proprietari', '/portale-proprietari/', '/portale-proprietari/accedi', '/portale-proprietari/invito', '/portale-proprietari/contatto', '/portale-proprietari/contabilita/sv-1'])(
    'hostNeedsAuth_ReadyHost_%s_IsTrue',
    (path) => {
      expect(hostNeedsAuth(READY, path, '')).toBe(true);
    },
  );

  it.each(['/', '/property/casa-mare', '/property/casa-mare/checkout', '/my-bookings', '/booking/0f6c', '/checkin/abc', '/search', '/embed/booking', '/portale-proprietari-x', '/legale/privacy'])(
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

  it.each(['/embed/booking', '/embed/property/casa-mare', '/embed/guest-access', '/embed/v1/embed.js'])(
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

describe('App on the own domain of an agency (E40/F02/US01/T02, NF-141)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    auth0.appState = undefined;
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

  it.each(['/?code=abc&state=xyz', '/?error=access_denied&state=xyz'])(
    'ready host: the address the sign-in returns to (%s) mounts the sign-in service and completes the return',
    async (url) => {
      setHostSite(READY);
      openAt(url);
      // What `login({ returnTo })` kept in the `appState`, handed back by the provider once it has read the answer.
      auth0.appState = { returnTo: '/portale-proprietari' };
      auth0.authenticated = true;

      render(<App />);

      expect(await screen.findByTestId('auth0-provider')).toBeInTheDocument();
      // The return goes through the router of the host, to the page the owner asked for.
      expect(await screen.findByTestId('owner-portal-shell')).toBeInTheDocument();
      expect(getRouter().state.location.pathname).toBe('/portale-proprietari');
    },
  );

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

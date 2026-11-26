import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import App from '@/App';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { recordLandingTouch } from '@/lib/signup-attribution';
import { getRouter } from '@/routes';
import { buildEmbedRoutes } from '@/routes/embed-routes';
import type { PublicOrgDto } from '@/types';

/**
 * No storage, no cookie and no IndexedDB on any page of the embeddable widgets (E41/F01/US01/T01, NF-144, AC-NF144-3): another site frames
 * them, and a browser that blocks third-party storage must not break the widget. The proof is a spy on everything a page could write to or read
 * from, while each of the three widgets renders in each of its states, and while the whole app starts on such an address.
 */
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn(), getOrgProperty: vi.fn(() => new Promise(() => undefined)) } }));
// The widgets are the real ones: none of their calls reaches the network here (the proof of what the booking widget keeps is in `booking-widget.test.tsx`, with fixtures).
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: {
    getStays: vi.fn(() => new Promise(() => undefined)),
    getSiteCalendar: vi.fn(() => new Promise(() => undefined)),
    getDestinations: vi.fn(() => new Promise(() => undefined)),
  },
}));

// The whole app (`App`) on an address of the widgets: its routes are the ones of the widgets and of the booking site, nothing else.
const signIn = vi.hoisted(() => ({ mounted: vi.fn() }));
vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => {
    signIn.mounted();
    return children;
  },
  useAuth0: () => ({ isLoading: false, isAuthenticated: false }),
}));
vi.mock('@/routes', async () => {
  const { createElement } = await import('react');
  const { createMemoryRouter: memoryRouter } = await import('react-router-dom');
  const { buildEmbedRoutes: embedRoutes } = await import('@/routes/embed-routes');
  const router = memoryRouter([
    ...embedRoutes('platform'),
    { path: '/book/:orgSlug', element: createElement('p', { 'data-testid': 'booking-site' }, 'site') },
    { path: '*', element: createElement('p', { 'data-testid': 'elsewhere' }, 'elsewhere') },
  ]);
  return { getRouter: () => router };
});
vi.mock('@/lib/signup-attribution', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/signup-attribution')>()), recordLandingTouch: vi.fn() }));
// Parts of the shell that read the network or are not what is tried here: the flags are read by the server, here the widgets are on.
vi.mock('@/contexts/feature-flags-provider', async () => {
  const { createElement } = await import('react');
  const { FeatureFlagsContext: Context } = await import('@/contexts/feature-flags-context');
  const { DEFAULT_FEATURE_FLAGS: defaults } = await import('@/config/feature-flags');
  const value = { flags: { ...defaults, siteEmbed: true }, isLoading: false };
  return { FeatureFlagsProvider: ({ children }: { children: ReactNode }) => createElement(Context.Provider, { value }, children) };
});
vi.mock('@/routes/ui-version-sync', () => ({ UiVersionSync: () => null }));
vi.mock('@/components/shared/app-toaster', () => ({ AppToaster: () => null }));

const ORG: PublicOrgDto = { slug: 'villa-rossi', displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: null };
const ADDRESS = `v=1&parent=${encodeURIComponent('https://quokka360.com')}`;
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);

interface Spies {
  /** Every call of the browser's storage, of the cookie and of IndexedDB, with the name of what was called. */
  calls: () => string[];
  restore: () => void;
}

/** A spy on everything a page can use to keep something in the browser. They let the calls through: any call at all is the failure. */
function spyOnTheBrowserMemory(): Spies {
  const spies: [string, MockInstance][] = [
    ...(['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const).map((name): [string, MockInstance] => [`Storage.${name}`, vi.spyOn(Storage.prototype, name)]),
    ['Storage.length', vi.spyOn(Storage.prototype, 'length', 'get')],
    ['document.cookie (read)', vi.spyOn(Document.prototype, 'cookie', 'get')],
    ['document.cookie (write)', vi.spyOn(Document.prototype, 'cookie', 'set')],
  ];
  // jsdom has no IndexedDB: a stand-in that only counts.
  const open = vi.fn();
  Object.defineProperty(window, 'indexedDB', { configurable: true, writable: true, value: { open } });
  spies.push(['indexedDB.open', open as unknown as MockInstance]);

  return {
    calls: () => spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([name, spy]) => `${name} x${spy.mock.calls.length}`),
    restore: () => {
      for (const [, spy] of spies) if ('mockRestore' in spy) spy.mockRestore();
      Reflect.deleteProperty(window, 'indexedDB');
    },
  };
}

let spies: Spies;

// The routes load the shell and the widgets when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../embed-shell'), import('../booking-widget'), import('../property-widget'), import('../guest-access-widget')]);
}, 120_000);

afterAll(() => {
  localStorage.clear();
});

beforeEach(async () => {
  getPublicOrg.mockReset();
  getPublicOrg.mockResolvedValue(ORG);
  signIn.mounted.mockClear();
  vi.mocked(recordLandingTouch).mockClear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  spies?.restore();
  window.history.replaceState({}, '', '/');
});

const WIDGETS = [
  ['booking', 'booking'],
  ['property', 'property/casa-mare'],
  ['guest-access', 'guest-access'],
] as const;

type Situation = 'loading' | 'ready' | 'unavailable';

/** What each situation needs: the flag and the org, as the shell reads them. */
const SITUATIONS: Record<Situation, { siteEmbed: boolean; flagsLoading: boolean; state: string }> = {
  loading: { siteEmbed: true, flagsLoading: true, state: 'loading' },
  ready: { siteEmbed: true, flagsLoading: false, state: 'ready' },
  unavailable: { siteEmbed: false, flagsLoading: false, state: 'unavailable' },
};

describe('the spy on the memory of the browser', () => {
  it('spyOnTheBrowserMemory_SeesEveryWayToKeepSomething', () => {
    // The control of the proof below: a spy that saw nothing would prove nothing.
    spies = spyOnTheBrowserMemory();

    localStorage.getItem('a');
    sessionStorage.setItem('a', 'b');
    sessionStorage.removeItem('a');
    void localStorage.length;
    localStorage.key(0);
    localStorage.clear();
    void document.cookie;
    document.cookie = 'a=b';
    document.cookie = 'a=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    (window.indexedDB as unknown as { open: (name: string) => void }).open('db');

    expect(spies.calls().map((call) => call.replace(/ x\d+$/, ''))).toEqual([
      'Storage.getItem',
      'Storage.setItem',
      'Storage.removeItem',
      'Storage.clear',
      'Storage.key',
      'Storage.length',
      'document.cookie (read)',
      'document.cookie (write)',
      'indexedDB.open',
    ]);
  });
});

describe('the pages of the widgets keep nothing in the browser (AC5)', () => {
  it.each(WIDGETS.flatMap(([widget, path]) => (['loading', 'ready', 'unavailable'] as const).map((situation) => [widget, path, situation] as const)))(
    'embedShell_noStorageOrCookies_%s_%s_%s',
    async (widget, path, situation) => {
      const { siteEmbed, flagsLoading, state } = SITUATIONS[situation];
      // Every language of the address, and the one a guest chose before on the same device: the frame must not look at it.
      localStorage.setItem('casazen.locale', 'en');
      const router = createMemoryRouter(buildEmbedRoutes('platform'), { initialEntries: [`/embed/villa-rossi/${path}?lang=it&${ADDRESS}`] });
      spies = spyOnTheBrowserMemory();

      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: flagsLoading }}>
            <RouterProvider router={router} />
          </FeatureFlagsContext.Provider>
        </QueryClientProvider>,
      );

      const shell = await screen.findByTestId('embed-shell');
      await waitFor(() => expect(shell).toHaveAttribute('data-state', state));
      if (situation === 'ready') await screen.findByTestId(`embed-widget-${widget}`);

      expect(spies.calls()).toEqual([]);
      localStorage.clear();
    },
  );
});

describe('the app on an address of the widgets (AC3)', () => {
  async function openApp(address: string) {
    window.history.replaceState({}, '', address);
    await getRouter().navigate(address, { replace: true });
    return render(<App />);
  }

  it('App_OnAnEmbedAddress_NeverMountsTheSignInNorRecordsTheLandingAndTouchesNoStorage', async () => {
    // The first thing the app does on a page is to read the language (`readStoredLocale` at import time and `I18nLocaleSync`), the sign-in gate and
    // the landing touch: none of them may reach the browser's memory on this address.
    localStorage.setItem('casazen.locale', 'en');
    spies = spyOnTheBrowserMemory();

    await openApp(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('embed-widget-booking');

    expect(signIn.mounted).not.toHaveBeenCalled();
    expect(recordLandingTouch).not.toHaveBeenCalled();
    expect(spies.calls()).toEqual([]);
    expect(i18n.language).toBe('it');
    localStorage.clear();
  });

  it('App_OnTheBookingSiteOfThePlatform_StillRecordsTheLanding', async () => {
    // The control: the same app on a page that is not a widget keeps doing what it did.
    await openApp('/book/villa-rossi');
    await screen.findByTestId('booking-site');

    expect(recordLandingTouch).toHaveBeenCalledTimes(1);
  });
});

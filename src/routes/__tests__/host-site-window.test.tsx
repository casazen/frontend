import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { createHostSiteWindow, toAppPath, toHostPath } from '../host-site-window';

/**
 * BK-16 (A3-08): on an org's own host the browser shows clean addresses while the router keeps its `/book/:orgSlug/…`
 * routes. Everything is checked against a real router and the jsdom history, not against the mapping alone.
 */
const SLUG = 'villa-rossi';

function setBrowserUrl(url: string) {
  window.history.replaceState(null, '', url);
}

describe('toAppPath / toHostPath', () => {
  it.each([
    ['/', '/book/villa-rossi'],
    ['', '/book/villa-rossi'],
    ['/property/casa-mare', '/book/villa-rossi/property/casa-mare'],
    ['/property/casa-mare/checkout', '/book/villa-rossi/property/casa-mare/checkout'],
    ['/my-bookings', '/book/villa-rossi/my-bookings'],
    ['/search', '/book/villa-rossi/search'],
    ['/booking/0f6c', '/book/villa-rossi/booking/0f6c'],
    ['/requests/0f6c/confirm', '/book/villa-rossi/requests/0f6c/confirm'],
    // Anything else is the route itself: legal pages, and the `/book/…` links of older shares and Stripe return URLs.
    ['/legale/privacy', '/legale/privacy'],
    ['/book/villa-rossi/booking/0f6c', '/book/villa-rossi/booking/0f6c'],
    ['/unknown', '/unknown'],
    // The guest check-in and the owner portal of the agency's domain (NF-140) are routes of their own, never rewritten into the booking site.
    ['/checkin/abc123', '/checkin/abc123'],
    ['/checkin/porta/door-token', '/checkin/porta/door-token'],
    ['/portale-proprietari', '/portale-proprietari'],
    ['/portale-proprietari/accedi', '/portale-proprietari/accedi'],
    ['/portale-proprietari/invito', '/portale-proprietari/invito'],
    ['/portale-proprietari/contabilita/sv-1', '/portale-proprietari/contabilita/sv-1'],
  ])('toAppPath_%s_is%s', (hostPath, expected) => {
    expect(toAppPath(hostPath, SLUG)).toBe(expected);
  });

  it.each([
    ['/book/villa-rossi', '/'],
    ['/book/villa-rossi/', '/'],
    ['/book/villa-rossi/property/casa-mare', '/property/casa-mare'],
    ['/book/villa-rossi/my-bookings', '/my-bookings'],
    ['/book/villa-rossi/search', '/search'],
    ['/book/villa-rossi/booking/0f6c', '/booking/0f6c'],
    ['/book/villa-rossi/requests/0f6c/confirm', '/requests/0f6c/confirm'],
    // A legacy single-segment link and another org's path stay as they are: there is no clean form of them.
    ['/book/villa-rossi/casa-mare', '/book/villa-rossi/casa-mare'],
    ['/book/villa-rossi-2/property/x', '/book/villa-rossi-2/property/x'],
    ['/legale/privacy', '/legale/privacy'],
    ['/checkin/abc123', '/checkin/abc123'],
    ['/portale-proprietari/accedi', '/portale-proprietari/accedi'],
  ])('toHostPath_%s_is%s', (appPath, expected) => {
    expect(toHostPath(appPath, SLUG)).toBe(expected);
  });

  it('toHostPath_ThenToAppPath_RoundTripsEveryPageOfTheOrg', () => {
    for (const path of ['/book/villa-rossi', '/book/villa-rossi/property/a', '/book/villa-rossi/my-bookings', '/book/villa-rossi/booking/1']) {
      expect(toAppPath(toHostPath(path, SLUG), SLUG)).toBe(path);
    }
  });

  it('toAppPath_SlugWithSpecialCharacters_IsEncodedLikeTheRoutes', () => {
    expect(toAppPath('/', 'a b')).toBe('/book/a%20b');
  });
});

describe('createHostSiteWindow with a real router', () => {
  const routes: RouteObject[] = [
    {
      path: '/book/:orgSlug',
      children: [
        { index: true, element: null, id: 'landing' },
        { path: 'property/:propertySlugOrId', element: null, id: 'property' },
        { path: 'my-bookings', element: null, id: 'my-bookings' },
        { path: 'booking/:bookingId', element: null, id: 'booking' },
      ],
    },
    { path: '/legale/privacy', element: null, id: 'privacy' },
    { path: '/checkin/:token', element: null, id: 'checkin' },
    { path: '/portale-proprietari/*', element: null, id: 'owner-portal' },
    { path: '*', element: null, id: 'not-found' },
  ];

  beforeEach(() => setBrowserUrl('/'));
  afterEach(() => setBrowserUrl('/'));

  function startRouter() {
    return createBrowserRouter(routes, { window: createHostSiteWindow(window, SLUG) });
  }

  it('createBrowserRouter_RootOfTheHost_MatchesTheOrgLandingRoute', () => {
    const router = startRouter();

    expect(router.state.location.pathname).toBe('/book/villa-rossi');
    expect(router.state.matches.at(-1)?.route.id).toBe('landing');
    expect(router.state.matches[0].params.orgSlug).toBe(SLUG);
    expect(window.location.pathname).toBe('/');
    router.dispose();
  });

  it('createBrowserRouter_CleanAddressOnLoad_MatchesTheRouteAndKeepsSearchAndHash', () => {
    setBrowserUrl('/property/casa-mare?checkin=2026-12-01&guests=2#prezzi');

    const router = startRouter();

    expect(router.state.location.pathname).toBe('/book/villa-rossi/property/casa-mare');
    expect(router.state.location.search).toBe('?checkin=2026-12-01&guests=2');
    expect(router.state.location.hash).toBe('#prezzi');
    expect(router.state.matches.at(-1)?.route.id).toBe('property');
    expect(router.state.matches.at(-1)?.params.propertySlugOrId).toBe('casa-mare');
    router.dispose();
  });

  it('createBrowserRouter_NavigateToABookPath_ShowsTheCleanAddressInTheBrowser', async () => {
    const router = startRouter();

    await router.navigate('/book/villa-rossi/property/casa-mare?guests=3');

    expect(router.state.location.pathname).toBe('/book/villa-rossi/property/casa-mare');
    expect(window.location.pathname).toBe('/property/casa-mare');
    expect(window.location.search).toBe('?guests=3');

    await router.navigate('/book/villa-rossi');
    expect(window.location.pathname).toBe('/');
    expect(router.state.matches.at(-1)?.route.id).toBe('landing');
    router.dispose();
  });

  it('createBrowserRouter_ReplaceNavigation_ReplacesTheCleanAddress', async () => {
    const router = startRouter();

    await router.navigate('/book/villa-rossi/my-bookings', { replace: true });

    expect(window.location.pathname).toBe('/my-bookings');
    expect(router.state.matches.at(-1)?.route.id).toBe('my-bookings');
    router.dispose();
  });

  it('createBrowserRouter_AddressOutsideTheOrgSite_IsLeftAsItIs', async () => {
    const router = startRouter();

    await router.navigate('/legale/privacy');

    expect(window.location.pathname).toBe('/legale/privacy');
    expect(router.state.matches.at(-1)?.route.id).toBe('privacy');
    router.dispose();
  });

  it('createBrowserRouter_CheckInAndOwnerPortalAddresses_AreLeftUntouched', async () => {
    setBrowserUrl('/checkin/abc123?step=identity');
    const router = startRouter();

    // On load: the check-in is the route itself, with its address and query as they are.
    expect(router.state.location.pathname).toBe('/checkin/abc123');
    expect(router.state.location.search).toBe('?step=identity');
    expect(router.state.matches.at(-1)?.route.id).toBe('checkin');
    expect(window.location.pathname).toBe('/checkin/abc123');

    // Moving between the pages of the agency's domain never writes a `/book/<slug>` address in the browser, nor turns one of these into the booking site.
    await router.navigate('/portale-proprietari/accedi');
    expect(window.location.pathname).toBe('/portale-proprietari/accedi');
    expect(router.state.matches.at(-1)?.route.id).toBe('owner-portal');

    await router.navigate('/portale-proprietari');
    expect(window.location.pathname).toBe('/portale-proprietari');
    expect(router.state.matches.at(-1)?.route.id).toBe('owner-portal');

    await router.navigate('/checkin/zzz', { replace: true });
    expect(window.location.pathname).toBe('/checkin/zzz');
    expect(router.state.matches.at(-1)?.route.id).toBe('checkin');
    router.dispose();
  });

  it('createBrowserRouter_BackButton_ReturnsToThePreviousPage', async () => {
    const router = startRouter();
    await router.navigate('/book/villa-rossi/property/casa-mare');
    await router.navigate('/book/villa-rossi/my-bookings');

    const popped = new Promise<void>((resolve) => {
      const unsubscribe = router.subscribe((state) => {
        if (state.location.pathname === '/book/villa-rossi/property/casa-mare') {
          unsubscribe();
          resolve();
        }
      });
    });
    window.history.back();
    await popped;

    expect(window.location.pathname).toBe('/property/casa-mare');
    router.dispose();
  });
});

describe('createHostSiteWindow', () => {
  beforeEach(() => setBrowserUrl('/my-bookings?code=ABC'));
  afterEach(() => setBrowserUrl('/'));

  it('location_PathnameIsTheRouterPath_AndTheRestIsTheRealLocation', () => {
    const proxy = createHostSiteWindow(window, SLUG);

    expect(proxy.location.pathname).toBe('/book/villa-rossi/my-bookings');
    expect(proxy.location.search).toBe('?code=ABC');
    expect(proxy.location.origin).toBe(window.location.origin);
    expect(proxy.location.hostname).toBe(window.location.hostname);
  });

  it('history_PushStateOfAnAbsoluteUrlOfAnotherHost_IsNotRewritten', () => {
    const proxy = createHostSiteWindow(window, SLUG);

    // jsdom refuses cross-origin pushState: the point is that the url is passed through untouched, not rewritten.
    expect(() => proxy.history.pushState(null, '', 'https://other.example.test/book/villa-rossi')).toThrow();
  });

  it('window_OtherMembers_AreTheRealOnesAndBoundToTheRealWindow', () => {
    const proxy = createHostSiteWindow(window, SLUG);
    let fired = 0;
    const listener = () => {
      fired += 1;
    };

    proxy.addEventListener('custom-bk16', listener);
    window.dispatchEvent(new Event('custom-bk16'));
    proxy.removeEventListener('custom-bk16', listener);
    window.dispatchEvent(new Event('custom-bk16'));

    expect(fired).toBe(1);
    expect(proxy.document).toBe(window.document);
  });
});

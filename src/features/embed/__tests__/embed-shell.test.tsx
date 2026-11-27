import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, matchRoutes, useOutletContext, type RouteObject } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FEATURE_FLAGS_QUERY_KEY, FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { resolveHostSite, setHostSite } from '@/lib/host-site';
import { isNotRedesignedMatch } from '@/lib/ui-version';
import type { PublicOrgDto } from '@/types';
import type { ResolveHostResponse } from '@/types/domain.types';
import { appRoutes } from '@/routes';
import { EMBED_CATCH_ALL_PATH, buildEmbedRoutes } from '@/routes/embed-routes';
import { buildHostSiteRoutes } from '@/routes/host-site-routes';
import { embedWidgetHandle, embedWidgetOf, isSupportedEmbedVersion, parseParentOrigin, useEmbed, type EmbedHostMode } from '../embed-context';
import { EmbedShell } from '../embed-shell';

/**
 * The shell and the routes of the embeddable widgets (E41/F01/US01/T01, NF-144): the frame every widget lives in. What costs something when it
 * is wrong is held here: a widget that is off must ask the server for nothing, the agency's domain serves only its own org, and the address
 * names the origin of the page that frames it only in the strict form of an origin.
 */
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn(), getOrgProperty: vi.fn(() => new Promise(() => undefined)) } }));
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: {
    getStays: vi.fn(() => new Promise(() => undefined)),
    getSiteCalendar: vi.fn(() => new Promise(() => undefined)),
    getDestinations: vi.fn(() => new Promise(() => undefined)),
  },
}));

const ORG: PublicOrgDto = {
  slug: 'villa-rossi',
  displayName: 'Villa Rossi',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
  primaryColor: '#1a6b8f',
  publicThemeId: 'mare',
  publicFontId: 'moderno',
};

const PARENT = 'https://quokka360.com';
const ADDRESS = `v=1&parent=${encodeURIComponent(PARENT)}`;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

interface RenderOptions {
  mode?: EmbedHostMode;
  siteEmbed?: boolean;
  flagsLoading?: boolean;
  flagsFailed?: boolean;
  client?: QueryClient;
  routes?: RouteObject[];
}

function renderEmbed(entry: string, options: RenderOptions = {}) {
  const { mode = 'platform', siteEmbed = true, flagsLoading = false, flagsFailed = false } = options;
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(options.routes ?? buildEmbedRoutes(mode), { initialEntries: [entry] });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: flagsLoading, isError: flagsFailed }}>
        <RouterProvider router={router} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { router, client };
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);

// The routes load the widgets when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../booking-widget'), import('../property-widget'), import('../guest-access-widget')]);
}, 120_000);

beforeEach(async () => {
  getPublicOrg.mockReset();
  getPublicOrg.mockResolvedValue(ORG);
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  setHostSite(null);
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

const WIDGETS = [
  ['booking', 'booking'],
  ['property', 'property/casa-mare'],
  ['guest-access', 'guest-access'],
] as const;

describe('the shell of the widgets on the CasaZen domain (AC1, AC7)', () => {
  it.each(WIDGETS)('embedShell_%s_WithTheFeatureOn_RendersTheThemeOfTheOrgAndNoAppChrome', async (widget, path) => {
    renderEmbed(`/embed/villa-rossi/${path}?${ADDRESS}`);

    const shell = await screen.findByTestId('embed-shell');
    await screen.findByTestId(`embed-widget-${widget}`);

    expect(shell).toHaveAttribute('data-widget', widget);
    expect(shell).toHaveAttribute('data-state', 'ready');
    expect(shell).toHaveAttribute('data-theme', 'mare');
    expect(shell).toHaveAttribute('data-font', 'moderno');
    expect(shell.style.getPropertyValue('--cz-public-primary')).toBe('#1a6b8f');
    expect(shell.style.getPropertyValue('--cz-public-on-primary')).not.toBe('');
    expect(shell).toHaveClass('public-site-root');
    expect(shell.style.background).toBe('transparent');
    await waitFor(() => {
      expect(document.body.style.margin).toBe('0px');
      expect(document.documentElement.style.overflowX).toBe('hidden');
    });
    expect(shell.className).not.toMatch(/min-h-screen|h-screen|\bvh\b/);
    expect(screen.queryByTestId('public-site-shell')).not.toBeInTheDocument();
    expect([...shell.children].map((child) => child.tagName)).toEqual(['MAIN']);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('publicSite.skipToContent'))).not.toBeInTheDocument();
    expect(document.querySelector('a[href="#main-content"]')).toBeNull();
    expect(getPublicOrg).toHaveBeenCalledTimes(1);
    expect(getPublicOrg).toHaveBeenCalledWith('villa-rossi');
  });

  it('embedShell_PutsTheDocumentBackWhenItGoes', async () => {
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('embed-widget-booking');
    await waitFor(() => {
      expect(document.documentElement.style.overflowX).toBe('hidden');
      expect(document.body.style.margin).toBe('0px');
      expect(document.documentElement.style.getPropertyValue('--cz-public-primary')).toBe('#1a6b8f');
    });

    cleanup();

    expect(document.documentElement.style.overflowX).toBe('');
    expect(document.body.style.margin).toBe('');
    expect(document.documentElement.style.getPropertyValue('--cz-public-primary')).toBe('');
  });

  it('embedShell_ShellStyles_NeverUseTheHeightOfTheWindow', () => {
    for (const file of ['embed-shell.tsx', 'embed-states.tsx', 'booking-widget.tsx', 'property-widget.tsx', 'guest-access-widget.tsx']) {
      const code = readFileSync(resolve(process.cwd(), 'src/features/embed', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/\b\d+(\.\d+)?d?vh\b|min-h-screen|\bh-screen\b/);
    }
  });

  it.each([
    ['platform', ['/embed/:orgSlug/booking', '/embed/:orgSlug/property/:propertySlugOrId', '/embed/:orgSlug/guest-access']],
    ['host', ['/embed/booking', '/embed/property/:propertySlugOrId', '/embed/guest-access']],
  ] as const)('buildEmbedRoutes_%s_IsOneFrameWithTheThreeWidgetsAndTheCatchAllOfEmbed', (mode, paths) => {
    const [frame, ...others] = buildEmbedRoutes(mode);

    expect(others).toEqual([]);
    expect(frame.path).toBeUndefined();
    expect(frame.index).toBeUndefined();
    expect(frame.children?.map((child) => child.path)).toEqual([...paths, EMBED_CATCH_ALL_PATH]);
    expect(frame.children?.map((child) => embedWidgetOf([child]))).toEqual(['booking', 'property', 'guest-access', null]);
    expect(isNotRedesignedMatch([{ route: frame }])).toBe(true);
  });

  it('embedShell_MovingFromOneWidgetToAnother_KeepsTheShellMounted', async () => {
    const { router } = renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);
    const shell = await screen.findByTestId('embed-shell');
    await screen.findByTestId('embed-widget-booking');
    expect(shell).toHaveAttribute('data-widget', 'booking');

    await act(async () => {
      await router.navigate(`/embed/villa-rossi/property/casa-mare?from=booking&${ADDRESS}`);
    });
    await screen.findByTestId('embed-widget-property');

    expect(screen.getByTestId('embed-shell')).toBe(shell);
    expect(shell).toHaveAttribute('data-widget', 'property');
    expect(getPublicOrg).toHaveBeenCalledTimes(1);
  });
});

describe('the feature off (AC1: the proof of the flag)', () => {
  it.each(WIDGETS)('embedShell_embedOff_makesNoOrgRequest_%s', async (_widget, path) => {
    renderEmbed(`/embed/villa-rossi/${path}?${ADDRESS}`, { siteEmbed: false });

    const shell = await screen.findByTestId('embed-shell');
    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByText('Questo widget non è disponibile')).toBeInTheDocument();
    expect(getPublicOrg).not.toHaveBeenCalled();
    await waitFor(() => expect(robots()).toBe('noindex,nofollow'));
  });

  it('embedShell_FlagsStillLoading_WaitsInsteadOfSayingNotAvailable_AndAsksNothing', async () => {
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`, { flagsLoading: true });

    const shell = await screen.findByTestId('embed-shell');
    expect(shell).toHaveAttribute('data-state', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Caricamento in corso…');
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('embedShell_FlagsThatCouldNotBeRead_IsAnErrorWithRetryNotNotAvailable', async () => {
    const { client } = renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`, { flagsFailed: true });
    const refetch = vi.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

    await screen.findByTestId('embed-error');
    expect(screen.queryByTestId('embed-unavailable')).not.toBeInTheDocument();
    expect(getPublicOrg).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(refetch).toHaveBeenCalledWith({ queryKey: FEATURE_FLAGS_QUERY_KEY });
  });

  it.each([
    ['another number', 'v=2'],
    ['absent', ''],
    ['not a number', 'v=latest'],
  ])('embedShell_VersionOfTheProtocol_%s_IsNotAvailableAndAsksNothing', async (_label, version) => {
    renderEmbed(`/embed/villa-rossi/booking?${version}&parent=${encodeURIComponent(PARENT)}`);

    const shell = await screen.findByTestId('embed-shell');
    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('isSupportedEmbedVersion_OnlyVersionOne', () => {
    expect(isSupportedEmbedVersion('1')).toBe(true);
    for (const value of ['2', '0', '01', '1.0', ' 1', '', 'v1', null, undefined]) {
      expect(isSupportedEmbedVersion(value)).toBe(false);
    }
  });
});

describe('the parent parameter (the proof of the strict origin)', () => {
  it.each(['https://quokka360.com', 'https://a.example:8443', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost', 'https://localhost'])(
    'embedParent_accepts_%s',
    (value) => {
      expect(parseParentOrigin(value)).toBe(value);
    },
  );

  it.each([
    ['a script address', 'javascript:alert(1)'],
    ['a data address', 'data:text/html,<p>x</p>'],
    ['http on a real host', 'http://evil.example'],
    ['http on a name that only starts like localhost', 'http://localhost.evil.example'],
    ['a path', 'https://a.example/path'],
    ['the root path', 'https://a.example/'],
    ['a query', 'https://a.example?x=1'],
    ['a fragment', 'https://a.example#x'],
    ['credentials', 'https://user:pw@a.example'],
    ['a user only', 'https://user@a.example'],
    ['a relative address', '/embed/booking'],
    ['a protocol-relative address', '//a.example'],
    ['another scheme', 'ftp://a.example'],
    ['an empty value', ''],
    ['spaces', ' https://a.example'],
    ['a long value', `https://${'a'.repeat(400)}.example`],
  ])('embedParent_rejects_%s', (_label, value) => {
    expect(parseParentOrigin(value)).toBeNull();
  });

  it('embedParent_Missing_IsNull', () => {
    expect(parseParentOrigin(null)).toBeNull();
    expect(parseParentOrigin(undefined)).toBeNull();
  });

  it('embedParent_WrittenInUpperCase_IsTheOriginTheBrowserWrites', () => {
    // So that it can be compared with `event.origin`.
    expect(parseParentOrigin('HTTPS://Quokka360.COM')).toBe('https://quokka360.com');
  });
});

function Probe() {
  const embed = useEmbed();
  const outlet = useOutletContext<{ org?: PublicOrgDto }>();
  return <pre data-testid="probe">{JSON.stringify({ embed, org: outlet.org?.slug })}</pre>;
}

function probeRoutes(mode: EmbedHostMode): RouteObject[] {
  return [
    {
      element: <EmbedShell mode={mode} />,
      children: [{ path: mode === 'host' ? '/embed/booking' : '/embed/:orgSlug/booking', handle: embedWidgetHandle('booking'), element: <Probe /> }],
    },
  ];
}

describe('what the shell gives the widget it frames', () => {
  it('useEmbed_OnTheCasazenDomain_IsTheWidgetTheOrgTheBaseTheParentAndTheLanguage', async () => {
    renderEmbed(`/embed/villa-rossi/booking?lang=en&${ADDRESS}`, { routes: probeRoutes('platform') });

    const probe = await screen.findByTestId('probe');

    expect(JSON.parse(probe.textContent ?? '')).toEqual({
      embed: { widget: 'booking', orgSlug: 'villa-rossi', embedBase: '/embed/villa-rossi', parentOrigin: PARENT, lang: 'en', hostMode: 'platform' },
      org: 'villa-rossi',
    });
  });

  it('useEmbed_OnAnAgencyDomain_TakesTheOrgFromTheHostAndTheBaseIsEmbed', async () => {
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi', embedEnabled: true });
    renderEmbed(`/embed/booking?v=1&parent=${encodeURIComponent('http://localhost:3000')}`, { mode: 'host', routes: probeRoutes('host') });

    const probe = await screen.findByTestId('probe');

    expect(JSON.parse(probe.textContent ?? '')).toEqual({
      embed: { widget: 'booking', orgSlug: 'villa-rossi', embedBase: '/embed', parentOrigin: 'http://localhost:3000', lang: 'it', hostMode: 'host' },
      org: 'villa-rossi',
    });
  });

  it('useEmbed_AParentThatIsNotAnOrigin_IsNullAndThePageWorksOnItsOwn', async () => {
    renderEmbed('/embed/villa-rossi/booking?v=1&parent=https%3A%2F%2Fa.example%2Fpath', { routes: probeRoutes('platform') });

    const probe = await screen.findByTestId('probe');

    expect(JSON.parse(probe.textContent ?? '').embed.parentOrigin).toBeNull();
  });

  it('embedShell_ARouteThatNamesNoWidget_HasNothingToShowAndAsksNothing', async () => {
    const routes: RouteObject[] = [{ element: <EmbedShell mode="platform" />, children: [{ path: '/embed/:orgSlug/booking', element: <Probe /> }] }];
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`, { routes });

    const shell = await screen.findByTestId('embed-shell');

    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('useEmbed_OutsideAWidget_IsNull', () => {
    function Outside() {
      return <p data-testid="outside">{String(useEmbed())}</p>;
    }
    render(<Outside />);

    expect(screen.getByTestId('outside')).toHaveTextContent('null');
  });
});

describe('the language of the page (AC4)', () => {
  it('embedShell_LangEn_GivesEnglishTextsAndTheLangOfTheDocument', async () => {
    renderEmbed(`/embed/villa-rossi/guest-access?lang=en&${ADDRESS}`);

    expect(await screen.findByLabelText('Booking code')).toBeInTheDocument();
    await waitFor(() => {
      expect(i18n.language).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it.each([['?lang=de&'], ['?lang=&'], ['?']])('embedShell_AddressWith%s_GivesItalian', async (query) => {
    await i18n.changeLanguage('en');
    document.documentElement.lang = 'en';
    renderEmbed(`/embed/villa-rossi/guest-access${query}${ADDRESS}`);

    expect(await screen.findByLabelText('Codice prenotazione')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe('it'));
  });

  it('embedShell_Language_IsNeverWrittenToTheBrowser', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderEmbed(`/embed/villa-rossi/booking?lang=en&${ADDRESS}`);
    await screen.findByTestId('embed-widget-booking');
    await waitFor(() => expect(i18n.language).toBe('en'));

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe('');
    setItem.mockRestore();
  });
});

describe('the states of the shell (AC7)', () => {
  it('embedShell_OrgStillLoading_IsASkeletonAnnouncedOnce', async () => {
    getPublicOrg.mockReturnValue(new Promise(() => undefined));
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);

    const shell = await screen.findByTestId('embed-shell');

    expect(shell).toHaveAttribute('data-state', 'loading');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(robots()).toBe('noindex,nofollow'));
  });

  it('embedShell_Org404_IsNotFoundNeverTheErrorAndHasNoWayOutOfTheFrame', async () => {
    getPublicOrg.mockRejectedValue(httpError(404));
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);

    expect(await screen.findByTestId('embed-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe(i18n.t('embed.notFound.title'));
      expect(robots()).toBe('noindex,nofollow');
    });
  });

  it('embedShell_Org404WithAnOlderAnswerInTheCache_IsStillNotFound', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['public-org', 'villa-rossi'], ORG);
    getPublicOrg.mockRejectedValue(httpError(404));
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`, { client });

    expect(await screen.findByTestId('embed-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-widget-booking')).not.toBeInTheDocument();
  });

  it.each([[500], [503]])('embedShell_Org%i_IsAnErrorWithRetryNotNotFound', async (status) => {
    getPublicOrg.mockRejectedValueOnce(httpError(status));
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);

    const retry = await screen.findByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') });
    expect(screen.getByTestId('embed-error')).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('embed-not-found')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe(i18n.t('embed.error.title'));
      expect(robots()).toBe('noindex,nofollow');
    });

    fireEvent.click(retry);

    expect(await screen.findByTestId('embed-widget-booking')).toBeInTheDocument();
    expect(getPublicOrg).toHaveBeenCalledTimes(2);
  });

  it('embedShell_NetworkFailure_IsAnErrorWithRetry', async () => {
    getPublicOrg.mockRejectedValue(new Error('Network Error'));
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);

    expect(await screen.findByTestId('embed-error')).toBeInTheDocument();
  });

  it('embedShell_ReadyState_IsNoindexToo', async () => {
    renderEmbed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('embed-widget-booking');

    await waitFor(() => {
      expect(document.title).toBe('Prenota · Villa Rossi');
      expect(robots()).toBe('noindex,nofollow');
    });
  });
});

describe('the agency domain (AC1, AC2: the proof of the isolation)', () => {
  const HOST = { host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' };
  const hostRoutes = () => buildHostSiteRoutes([{ path: '/book/:orgSlug', element: <p data-testid="booking-site" /> }]);

  beforeEach(() => setHostSite({ ...HOST, embedEnabled: true }));

  it.each(WIDGETS)('embedRoutes_hostDomain_servesOnlyTheHostOrg_%s', async (widget, path) => {
    renderEmbed(`/embed/${path}?${ADDRESS}&org=other-org&orgSlug=other-org`, { mode: 'host', routes: hostRoutes() });

    await screen.findByTestId(`embed-widget-${widget}`);

    expect(getPublicOrg).toHaveBeenCalledTimes(1);
    expect(getPublicOrg).toHaveBeenCalledWith('villa-rossi');
  });

  it.each([
    '/embed/other-org/booking?v=1',
    '/embed/villa-rossi/booking?v=1',
    '/embed/other-org/property/casa-mare?v=1',
    '/embed',
    '/embed/',
    '/embed/booking/extra',
    '/embed/search',
    '/embed/v1/embed.js',
    '/embed/v1/anything',
  ])('embedRoutes_hostDomain_%s_IsTheShellSayingThereIsNothingHere_WithNoWayOutOfTheFrame', async (path) => {
    renderEmbed(path, { mode: 'host', routes: hostRoutes() });

    // The address of a page that is no widget is served as a frame like the others (`vercel.json`): it must not be the 404 page of the agency's site, whose
    // button is a link of the router that leads the frame to the whole site (the guest area, the checkout with the payment) inside another website.
    const shell = await screen.findByTestId('embed-shell');
    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByTestId('embed-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(document.querySelectorAll('a, [role="link"]')).toHaveLength(0);
    expect(getPublicOrg).not.toHaveBeenCalled();
    await waitFor(() => expect(robots()).toBe('noindex,nofollow'));
  });

  it.each([
    '/embedded',
    '/embed-x/booking',
    '/book/other-org',
    '/book/other-org/property/casa-mare',
    '/login',
    '/app/short-rent/bookings',
    '/checkin/abc',
  ])('embedRoutes_hostDomain_%s_IsNotFound', async (path) => {
    renderEmbed(path, { mode: 'host', routes: hostRoutes() });

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-shell')).not.toBeInTheDocument();
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('embedRoutes_hostDomain_TheBookingSiteOfTheHostStaysTheFirstRoute', () => {
    const [orgSite] = hostRoutes();

    expect(orgSite.path).toBe('/book/:orgSlug');
  });

  it.each([
    ['without embedEnabled', undefined],
    ['with embedEnabled false', false],
  ])('embedShell_hostDomain_%s_IsNotAvailableAndMakesNoOrgRequest', async (_label, embedEnabled) => {
    setHostSite({ ...HOST, embedEnabled });
    renderEmbed(`/embed/booking?${ADDRESS}`, { mode: 'host', routes: hostRoutes() });

    const shell = await screen.findByTestId('embed-shell');

    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('embedShell_hostDomain_IgnoresTheGlobalFlag_ThePlanOfTheAgencyDecides', async () => {
    setHostSite({ ...HOST, embedEnabled: false });
    renderEmbed(`/embed/booking?${ADDRESS}`, { mode: 'host', routes: hostRoutes(), siteEmbed: true });

    expect(await screen.findByTestId('embed-shell')).toHaveAttribute('data-state', 'unavailable');
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('resolveHostSite_TakesEmbedEnabledAndTrackingFromResolveHost', async () => {
    const resolved: ResolveHostResponse = {
      orgId: 'org-1',
      slug: 'villa-rossi',
      publicHostMode: 'CustomDomain',
      planTier: 'Pro',
      branding: { displayName: 'Villa Rossi', slug: 'villa-rossi', showPoweredBy: false },
      embedEnabled: true,
      tracking: { gtmContainerId: 'GTM-ABC123' },
    };

    expect(await resolveHostSite(HOST.host, vi.fn().mockResolvedValue(resolved))).toEqual({
      kind: 'site',
      site: { ...HOST, embedEnabled: true, tracking: { gtmContainerId: 'GTM-ABC123' } },
    });
    const older = await resolveHostSite(HOST.host, vi.fn().mockResolvedValue({ ...resolved, embedEnabled: undefined, tracking: undefined }));
    expect(older).toEqual({ kind: 'site', site: HOST });
  });
});

describe('the route table of the CasaZen domain', () => {
  it.each([
    '/embed/villa-rossi/booking',
    '/embed/villa-rossi/property/casa-mare',
    '/embed/villa-rossi/guest-access',
  ])('appRoutes_%s_IsAFrameThatKeepsTheCurrentLook', (path) => {
    const matches = matchRoutes(appRoutes, path);

    expect(matches).not.toBeNull();
    expect(matches?.at(-1)?.route.path).not.toBe('*');
    expect(isNotRedesignedMatch(matches)).toBe(true);
  });

  it.each([
    '/embed',
    '/embed/',
    '/embed/booking',
    '/embed/property/casa-mare',
    '/embed/villa-rossi',
    '/embed/villa-rossi/search',
    '/embed/villa-rossi/booking/extra',
    '/embed/v1/embed.js',
    '/embed/v1/anything',
  ])('appRoutes_%s_IsTheCatchAllOfTheFrameNeverThe404PageOfTheApp', (path) => {
    const matches = matchRoutes(appRoutes, path);

    expect(matches?.at(-1)?.route.path).toBe(EMBED_CATCH_ALL_PATH);
    expect(embedWidgetOf(matches?.map(({ route }) => route) ?? [])).toBeNull();
    expect(isNotRedesignedMatch(matches)).toBe(true);
  });

  it.each(['/embedded', '/embed-x/booking'])('appRoutes_%s_OnlyStartsLikeEmbed_IsTheAppsOwn404', (path) => {
    expect(matchRoutes(appRoutes, path)?.at(-1)?.route.path).toBe('*');
  });
});

describe('an address under /embed that is no widget: the frame never leads to the rest of the site', () => {
  it.each([
    '/embed',
    '/embed/',
    '/embed/booking',
    '/embed/villa-rossi',
    '/embed/villa-rossi/search',
    '/embed/villa-rossi/booking/extra',
    '/embed/v1/embed.js',
    '/embed/v1/anything',
  ])('embedShell_%s_OnTheCasazenDomain_SaysThereIsNothingHere_WithNoLinkAndAsksNothing', async (path) => {
    const routes: RouteObject[] = [...buildEmbedRoutes('platform'), { path: '*', element: <a href="/">home of the app</a> }];
    renderEmbed(`${path}${path.includes('?') ? '&' : '?'}${ADDRESS}`, { routes });

    const shell = await screen.findByTestId('embed-shell');
    expect(shell).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByTestId('embed-unavailable')).toBeInTheDocument();
    expect(screen.queryByText('home of the app')).not.toBeInTheDocument();
    expect(document.querySelectorAll('a, [role="link"]')).toHaveLength(0);
    expect(getPublicOrg).not.toHaveBeenCalled();
    await waitFor(() => expect(robots()).toBe('noindex,nofollow'));
  });

  it('embedShell_ACatchAllAddress_WithTheFeatureOff_IsTheSameStateAndAsksNothing', async () => {
    renderEmbed(`/embed/villa-rossi/search?${ADDRESS}`, { siteEmbed: false });

    expect(await screen.findByTestId('embed-shell')).toHaveAttribute('data-state', 'unavailable');
    expect(document.querySelectorAll('a, [role="link"]')).toHaveLength(0);
    expect(getPublicOrg).not.toHaveBeenCalled();
  });
});

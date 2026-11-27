import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { DomainApi } from '@/api/domain.api';
import { OrgTrackingApi } from '@/api/org-tracking.api';
import { SiteConnectionsApi } from '@/api/site-connections.api';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { DEFAULT_FEATURE_FLAGS, isFeatureRuleEnabled } from '@/config/feature-flags';
import { ROUTE_MANIFEST, getNavChildren, getNavSection, hasEntryPermission } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { useProperties } from '@/queries/use-properties';
import { useOrgDestinations } from '@/queries/use-public-stays';
import type { DomainSurfaces, OrgDomainConfig } from '@/types/domain.types';
import { EmbedSettingsPage } from '../embed-settings-page';

vi.mock('@/api/domain.api', () => ({ DomainApi: { getDomain: vi.fn() } }));
vi.mock('@/api/org-tracking.api', () => ({ OrgTrackingApi: { setTracking: vi.fn() } }));
vi.mock('@/api/site-connections.api', () => ({ SiteConnectionsApi: { list: vi.fn(), revoke: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
// The deployment the bundle was built for (`VERCEL_ENV`, written by `vite.config.ts`): a test chooses it.
const build = vi.hoisted(() => ({ deployEnv: '' }));
vi.mock('@/config/deploy-env', () => ({
  get deployEnv() {
    return build.deployEnv;
  },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ org: { id: 'org-1', slug: 'villa-mare' }, user: { orgId: 'org-1', onboardingRequired: false }, isLoading: false }),
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('@/queries/use-public-stays', () => ({ useOrgDestinations: vi.fn() }));
const workspace = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: workspace.hasPermission,
    contexts: [{ contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' }],
    isReady: true,
    getDefaultRoute: () => '/app/short-rent',
  }),
}));

const SURFACES: DomainSurfaces = {
  guestAreaOnOwnDomain: true,
  ownerPortalOnOwnDomain: true,
  useOwnDomainForLinks: true,
  ownerLoginHostState: 'Pending',
  ownerLoginAutomatic: false,
  effective: { guestArea: true, ownerPortal: false, ownerLoginReady: false, linksOnOwnDomain: true },
};

/** An org on the platform path: no domain of its own. */
const PLATFORM: OrgDomainConfig = {
  orgId: 'org-1',
  publicHostMode: 'CasazenPath',
  subdomain: null,
  customDomain: null,
  domainVerificationStatus: 'Pending',
  canUseCustomDomain: true,
  publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', subdomainUrl: null, customDomainUrl: null },
  surfaces: null,
  tracking: { gtmContainerId: null },
};

/** An org with a verified domain of its own and the surfaces of it. */
const OWN: OrgDomainConfig = {
  ...PLATFORM,
  publicHostMode: 'CustomDomain',
  customDomain: 'prenota.tuavilla.test',
  domainVerificationStatus: 'Verified',
  publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', subdomainUrl: null, customDomainUrl: 'https://prenota.tuavilla.test' },
  surfaces: SURFACES,
};

const HOMES = [
  { id: 'p1', name: 'Casa Mare', city: 'Lugano', slug: 'casa-mare', isActive: true, isPaused: false, complianceStatus: 'Active' },
  { id: 'p2', name: 'Villa Lago', city: 'Locarno', slug: null, isActive: true, isPaused: false, complianceStatus: 'Active' },
  // Paused: the widget would show nothing, so it is not offered.
  { id: 'p3', name: 'Casa in pausa', city: 'Ascona', slug: 'casa-in-pausa', isActive: true, isPaused: true, complianceStatus: 'Active' },
];

const PLACES = [
  { id: 'lugano', label: 'Lugano', comune: 'Lugano', count: 3 },
  { id: 'locarno', label: 'Locarno', comune: 'Locarno', count: 1 },
  // An id the bar would not take: it is not put in the code.
  { id: 'con spazio', label: 'Non valido', comune: 'Altro', count: 1 },
];

type EmbedWindow = Window & { CasaZenEmbed?: { mount: (element: HTMLElement, options: Record<string, unknown>) => void } };
const mount = vi.fn();
const writeText = vi.fn();

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function page(client: QueryClient) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EmbedSettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

const renderPage = (client = newClient()) => render(page(client));

const withDomain = (config: OrgDomainConfig) => vi.mocked(DomainApi.getDomain).mockResolvedValue(config);
const loaded = () => screen.findByTestId('embed-content');
const snippetText = () => screen.getByTestId('embed-snippet').textContent ?? '';
const pickWidget = (widget: string) => fireEvent.click(screen.getByTestId(`embed-widget-${widget}`));
const typeTarget = (value: string) => fireEvent.change(screen.getByTestId('embed-search-target'), { target: { value } });
const lastMount = () => {
  const call = mount.mock.calls.at(-1);
  if (!call) throw new Error('the loader was not asked to mount anything');
  return { element: call[0] as HTMLElement, options: call[1] as Record<string, unknown> };
};

/** The attributes of the widget element in a piece of HTML, by the name of the option of the loader: what a page that holds the pasted snippet gives it. */
function attributesOf(html: string): Record<string, string> {
  const page = document.createElement('div');
  page.innerHTML = html;
  const element = page.querySelector('[data-casazen-widget]');
  if (!element) throw new Error('no widget in the snippet');
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith('data-casazen-'))
      .map((attribute) => [attribute.name.slice('data-casazen-'.length), attribute.value]),
  );
}

function problem(status: number, data: Record<string, unknown>) {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, statusText: 'Error', headers: {}, config: {}, data } as unknown as AxiosResponse);
}

describe('EmbedSettingsPage (E41/F03/US01, NF-147, NF-149)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.hasPermission.mockImplementation(() => true);
    mount.mockReset();
    (window as EmbedWindow).CasaZenEmbed = { mount };
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.mocked(useProperties).mockReturnValue({ data: HOMES, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(useOrgDestinations).mockReturnValue({ data: PLACES, isPending: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useOrgDestinations>);
    vi.mocked(SiteConnectionsApi.list).mockResolvedValue([]);
    build.deployEnv = '';
    withDomain(PLATFORM);
  });

  afterEach(async () => {
    // The preview settles in a promise: let it do so inside act, before the page goes.
    await act(async () => undefined);
    cleanup();
    vi.clearAllMocks();
    delete (window as EmbedWindow).CasaZenEmbed;
    document.head.querySelectorAll('script[data-casazen-preview-loader]').forEach((script) => script.remove());
    vi.unstubAllEnvs();
  });

  describe('who reaches it, and with which flag', () => {
    const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === '/app/short-rent/settings/embed');
    const notAdmin = (_context: string, permission: string) => permission !== ORG_BILLING_ADMIN_PERMISSION;

    it('embedSettings_route_requiresBillingAdmin', async () => {
      // The route: the tab of the account administrator, right after the domain it extends, behind the flag.
      expect(entry).toMatchObject({ context: 'short-rent', navParent: '/app/short-rent/settings', orgBillingAdmin: true, requiredPermissions: [], featureFlag: 'siteEmbed', navKey: 'nav.embed' });
      if (!entry) throw new Error('the page is not in the manifest');
      expect(hasEntryPermission(entry, notAdmin)).toBe(false);
      expect(hasEntryPermission(entry, () => true)).toBe(true);
      const flags = { siteEmbed: true };
      const tabs = getNavChildren('/app/short-rent/settings', () => true, flags).map((tab) => tab.path);
      expect(tabs[tabs.indexOf('/app/short-rent/settings/domain') + 1]).toBe('/app/short-rent/settings/embed');
      expect(getNavChildren('/app/short-rent/settings', notAdmin, flags).map((tab) => tab.path)).not.toContain('/app/short-rent/settings/embed');

      // The page itself: whoever opens its address without being the administrator is told so, and neither the domain nor the tracking is asked for.
      workspace.hasPermission.mockImplementation(notAdmin);
      renderPage();

      expect(await screen.findByTestId('embed-restricted')).toHaveTextContent(i18n.t('embed.settings.restricted.title'));
      expect(screen.queryByTestId('embed-widget-block')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-gtm')).not.toBeInTheDocument();
      expect(DomainApi.getDomain).not.toHaveBeenCalled();
      expect(OrgTrackingApi.setTracking).not.toHaveBeenCalled();
      expect(useProperties).not.toHaveBeenCalled();
      expect(useOrgDestinations).not.toHaveBeenCalled();
      // Nor the connected sites: the list is the administrator's, and a refused read would send the whole app to the page of no access.
      expect(SiteConnectionsApi.list).not.toHaveBeenCalled();
    });

    it('embedSettings_flagOff_hidesTheTab', () => {
      if (!entry) throw new Error('the page is not in the manifest');
      const paths = (flags: { siteEmbed: boolean }) => getNavSection('/app/short-rent/settings/domain', () => true, flags).map((tab) => tab.path);

      expect(isFeatureRuleEnabled({ ...DEFAULT_FEATURE_FLAGS }, entry.featureFlag)).toBe(false);
      expect(paths({ siteEmbed: false })).not.toContain('/app/short-rent/settings/embed');
      expect(paths({ siteEmbed: true })).toContain('/app/short-rent/settings/embed');
      expect(getNavChildren('/app/short-rent/settings', () => true, { siteEmbed: false }).map((tab) => tab.path)).not.toContain('/app/short-rent/settings/embed');
    });

    it.each([
      [false, 'home', 'embed page'],
      [true, 'embed page', 'home'],
    ])('embedSettings_route_SiteEmbed%s_Shows_%s', (siteEmbed, shown, hidden) => {
      if (!entry) throw new Error('the page is not in the manifest');
      render(
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: false }}>
          <MemoryRouter initialEntries={[entry.path]}>
            <Routes>
              <Route path="/app/short-rent" element={<p>home</p>} />
              <Route
                path={entry.path}
                element={
                  <ContextRouteGuard contextKey="short-rent" requiredPermissions={entry.requiredPermissions} featureFlag={entry.featureFlag}>
                    <p>embed page</p>
                  </ContextRouteGuard>
                }
              />
            </Routes>
          </MemoryRouter>
        </FeatureFlagsContext.Provider>,
      );

      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    });
  });

  describe('the domain it stands on', () => {
    it('page_VerifiedDomain_CodeUsesItsOriginAndNoOrg', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      const code = snippetText();
      expect(code).toContain('<script src="https://prenota.tuavilla.test/embed/v1/embed.js" async></script>');
      expect(attributesOf(code)).toEqual({ widget: 'booking', base: 'https://prenota.tuavilla.test', lang: 'auto' });
      expect(code).not.toContain('data-casazen-org');
      expect(screen.getByTestId('embed-status')).toHaveAttribute('data-domain', 'own');
      expect(screen.queryByTestId('embed-status-no-domain')).not.toBeInTheDocument();
    });

    it('page_NoDomain_CodeUsesTheOriginOfCasazenAndTheSlug_AndTheDomainStepIsExplainedInOneSentence', async () => {
      renderPage();
      await loaded();

      expect(attributesOf(snippetText())).toEqual({ widget: 'booking', base: 'https://sito.test', org: 'villa-mare', lang: 'auto' });
      const sentence = screen.getByTestId('embed-status-no-domain');
      expect(sentence).toHaveTextContent(i18n.t('embed.settings.status.noDomain', { slug: 'villa-mare' }));
      expect(screen.getByTestId('embed-status')).toHaveAttribute('data-domain', 'casazen');
    });

    it('page_Status_ShowsDomainSurfacesOwnerSignInAndLinks_AndLinksToTheDomainTabWithoutAForm', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-status-domain')).toHaveTextContent(`prenota.tuavilla.test${i18n.t('domain.state.verified')}`);
      expect(screen.getByTestId('embed-status-guest-area')).toHaveTextContent(i18n.t('embed.settings.status.surfaceOwn'));
      // The portal of the owners is chosen but its sign-in is not ready: it is not on the domain yet, and the line says so.
      expect(screen.getByTestId('embed-status-owner-portal')).toHaveTextContent(i18n.t('embed.settings.status.surfaceCasazen'));
      expect(screen.getByTestId('embed-status-owner-login')).toHaveTextContent(i18n.t('domain.surfaces.ownerLogin.state.pendingManual'));
      expect(screen.getByTestId('embed-status-links')).toHaveTextContent(i18n.t('embed.settings.status.linksOwn'));
      expect(screen.getByTestId('embed-status-manage')).toHaveAttribute('href', '/app/short-rent/settings/domain');
      // It extends the tab of the domain, it never repeats its form.
      for (const testId of ['host-mode-radio', 'custom-domain-input', 'subdomain-input', 'save-domain-settings']) {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      }
    });

    it.each([
      ['the owner sign-in failed', { ownerLoginHostState: 'Failed', ownerLoginAutomatic: true }, 'failed'],
      ['the sign-in is ready', { ownerLoginHostState: 'Ready', ownerLoginAutomatic: true, effective: { ...SURFACES.effective, ownerPortal: true, ownerLoginReady: true } }, 'ready'],
    ] as const)('page_Status_%s', async (_label, surfaces, state) => {
      withDomain({ ...OWN, surfaces: { ...SURFACES, ...surfaces } });
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-status-owner-login')).toHaveTextContent(i18n.t(`domain.surfaces.ownerLogin.state.${state}`));
      expect(screen.getByTestId('embed-status-owner-portal')).toHaveTextContent(i18n.t(state === 'ready' ? 'embed.settings.status.surfaceOwn' : 'embed.settings.status.surfaceCasazen'));
    });

    it('page_Status_WithoutSurfacesFromTheBackend_ShowsTheDomainOnly', async () => {
      withDomain({ ...OWN, surfaces: null });
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-status-domain')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-status-guest-area')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-status-owner-login')).not.toBeInTheDocument();
    });

    it('page_DomainWaitingForDns_SaysSoAndTheCodeStaysOnTheAddressOfCasazen', async () => {
      withDomain({ ...PLATFORM, publicHostMode: 'CustomDomain', customDomain: 'www.tuavilla.test', domainVerificationStatus: 'Pending', status: { detail: 'ownership_txt_missing', activationAvailable: true, autoCheckActive: true } });
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-status-domain')).toHaveTextContent(`www.tuavilla.test${i18n.t('domain.state.waitingDns')}`);
      expect(screen.getByTestId('embed-status-no-domain')).toBeInTheDocument();
      expect(attributesOf(snippetText())).toMatchObject({ base: 'https://sito.test', org: 'villa-mare' });
    });

    it('page_Loading_ShowsNoCodeYet', () => {
      vi.mocked(DomainApi.getDomain).mockReturnValue(new Promise(() => undefined));
      renderPage();

      expect(screen.getByTestId('embed-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
    });

    it('page_ReadFails_ShowsTheErrorWithRetry_NeverACodeOnAnAddressThatWasNotConfirmed', async () => {
      vi.mocked(DomainApi.getDomain).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(OWN);
      renderPage();

      const alert = await screen.findByTestId('embed-load-error');
      expect(alert).toHaveTextContent(i18n.t('embed.settings.loadError'));
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-gtm')).not.toBeInTheDocument();

      fireEvent.click(within(alert).getByRole('button', { name: i18n.t('embed.settings.retry') }));

      await loaded();
      expect(screen.queryByTestId('embed-load-error')).not.toBeInTheDocument();
      expect(attributesOf(snippetText())).toMatchObject({ base: 'https://prenota.tuavilla.test' });
    });
  });

  describe('the choice of the widget and its code', () => {
    it('picker_Booking_IsTheStartAndGuestAccessTakesNothingMore', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-widget-booking')).toHaveAttribute('aria-pressed', 'true');
      expect(attributesOf(snippetText()).widget).toBe('booking');

      pickWidget('guest-access');
      expect(attributesOf(snippetText())).toEqual({ widget: 'guest-access', base: 'https://prenota.tuavilla.test', lang: 'auto' });
      expect(screen.getByTestId('embed-widget-help')).toHaveTextContent(i18n.t('embed.settings.widgets.guestAccess.help'));
    });

    it('picker_Property_OffersThePublishedHomesAndWritesTheSlugOfTheChosenOne', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      pickWidget('property');

      const select = screen.getByTestId('embed-property-select');
      // The paused home is not offered; the first of the others is the choice at once.
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['Casa Mare (Lugano)', 'Villa Lago (Locarno)']);
      expect(attributesOf(snippetText())).toMatchObject({ widget: 'property', property: 'casa-mare' });
      expect(useProperties).toHaveBeenCalledWith({ mode: 'short' }, { fresh: true, enabled: true });

      // A home with no slug goes by its id, as the links of the site do.
      fireEvent.change(select, { target: { value: 'p2' } });
      expect(attributesOf(snippetText())).toMatchObject({ widget: 'property', property: 'p2' });
    });

    it('picker_PropertyWithNoPublishedHome_SaysSoAndGivesNoCode', async () => {
      vi.mocked(useProperties).mockReturnValue({ data: [HOMES[2]], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');

      expect(screen.getByTestId('embed-property-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.getByTestId('embed-snippet-copy')).toBeDisabled();
      expect(screen.getByTestId('embed-snippet-waiting')).toHaveTextContent(i18n.t('embed.settings.snippet.waiting.property'));
    });

    it('picker_PropertyHiddenByTheHost_IsNotOfferedAndIsNeverTheStart', async () => {
      // The switch «Mostra la casa sul sito» of the host: a home it hides answers 404 to the widget, active, not paused and compliant as it may be.
      const hidden = { ...HOMES[0], id: 'p4', name: 'Casa nascosta', slug: 'casa-nascosta', publishedOnSite: false };
      vi.mocked(useProperties).mockReturnValue({ data: [hidden, { ...HOMES[0], publishedOnSite: true }], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');

      expect(within(screen.getByTestId('embed-property-select')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Casa Mare (Lugano)']);
      expect(attributesOf(snippetText())).toMatchObject({ widget: 'property', property: 'casa-mare' });
    });

    it('picker_PropertyEveryHomeHiddenByTheHost_SaysSoAndGivesNoCode', async () => {
      vi.mocked(useProperties).mockReturnValue({ data: [{ ...HOMES[0], publishedOnSite: false }], isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');

      expect(screen.getByTestId('embed-property-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.getByTestId('embed-snippet-copy')).toBeDisabled();
    });

    it('picker_PropertyHomesOnTheirWay_SaysSoWhereTheCodeWillBe_NotThatThereAreNone', async () => {
      vi.mocked(useProperties).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');

      expect(screen.getByTestId('embed-snippet-waiting')).toHaveTextContent(i18n.t('embed.settings.property.loading'));
      expect(screen.queryByTestId('embed-property-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-property-select')).not.toBeInTheDocument();
    });

    it('picker_PropertyHomesCannotBeRead_ShowsTheErrorWithRetry', async () => {
      const refetch = vi.fn();
      vi.mocked(useProperties).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');
      fireEvent.click(within(screen.getByTestId('embed-property-error')).getByRole('button', { name: i18n.t('embed.settings.retry') }));

      expect(refetch).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
    });

    it('picker_PropertyHomesReadAgainFails_GivesNoCodeFromTheOlderRead_AndOffersToTryAgain', async () => {
      // A read that fails leaves the homes of the last one that worked in the query: the page says they could not be read, so no code and no preview stand on them.
      const refetch = vi.fn();
      vi.mocked(useProperties).mockReturnValue({ data: HOMES, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useProperties>);
      renderPage();
      await loaded();

      pickWidget('property');
      await act(async () => undefined);

      expect(screen.getByTestId('embed-property-error')).toBeInTheDocument();
      expect(screen.queryByTestId('embed-property-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.getByTestId('embed-snippet-copy')).toBeDisabled();
      expect(screen.getByTestId('embed-snippet-waiting')).toHaveTextContent(i18n.t('embed.settings.snippet.waiting.homesFailed'));
      expect(mount).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ widget: 'property' }));

      fireEvent.click(within(screen.getByTestId('embed-property-error')).getByRole('button', { name: i18n.t('embed.settings.retry') }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('picker_Search_AsksTheAddressOfThePageAndWritesItWithThePlaces', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      pickWidget('search');

      // Nothing to copy until there is a page for the bar to lead to.
      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.getByTestId('embed-snippet-copy')).toBeDisabled();
      expect(useOrgDestinations).toHaveBeenCalledWith('villa-mare', { fresh: true });

      typeTarget('  https://www.tuavilla.test/prenota  ');

      const attributes = attributesOf(snippetText());
      expect(attributes).toMatchObject({ widget: 'search', base: 'https://prenota.tuavilla.test', target: 'https://www.tuavilla.test/prenota' });
      // The two places the bar takes; the one with an id it would drop is not in the code.
      expect(JSON.parse(attributes.destinations ?? '[]')).toEqual([
        { id: 'lugano', label: 'Lugano' },
        { id: 'locarno', label: 'Locarno' },
      ]);
      expect(screen.getByTestId('embed-destinations-note')).toHaveTextContent(i18n.t('embed.settings.search.destinationsIncluded', { count: 2 }));
    });

    it.each(['javascript:alert(1)', 'www.tuavilla.test/prenota', 'ftp://tuavilla.test/prenota', 'https://utente:segreto@tuavilla.test/prenota', '/prenota'])(
      'picker_SearchTarget_%s_IsRefusedAndBlocksTheCopy',
      async (target) => {
        renderPage();
        await loaded();
        pickWidget('search');

        typeTarget(target);

        expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('embed.settings.search.targetInvalid'));
        expect(screen.getByTestId('embed-search-target')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
        expect(screen.getByTestId('embed-snippet-copy')).toBeDisabled();
        fireEvent.click(screen.getByTestId('embed-snippet-copy'));
        expect(writeText).not.toHaveBeenCalled();
      },
    );

    it('picker_SearchPlacesCannotBeRead_GivesNoCodeAndOffersToTryAgain', async () => {
      const refetch = vi.fn();
      vi.mocked(useOrgDestinations).mockReturnValue({ data: undefined, isPending: false, isError: true, refetch } as unknown as ReturnType<typeof useOrgDestinations>);
      renderPage();
      await loaded();
      pickWidget('search');

      typeTarget('https://www.tuavilla.test/prenota');

      expect(screen.queryByTestId('embed-snippet')).not.toBeInTheDocument();
      expect(screen.getByTestId('embed-snippet-waiting')).toHaveTextContent(i18n.t('embed.settings.snippet.waiting.destinationsFailed'));
      fireEvent.click(within(screen.getByTestId('embed-destinations-error')).getByRole('button', { name: i18n.t('embed.settings.retry') }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('picker_WhatWasWrittenForSearch_IsKeptWhileLookingAtAnotherWidget', async () => {
      renderPage();
      await loaded();
      pickWidget('search');
      typeTarget('https://www.tuavilla.test/prenota');

      pickWidget('booking');
      pickWidget('search');

      expect(screen.getByTestId('embed-search-target')).toHaveValue('https://www.tuavilla.test/prenota');
    });

    it('copy_CopiesExactlyTheTextShownAndConfirms', async () => {
      renderPage();
      await loaded();

      fireEvent.click(screen.getByTestId('embed-snippet-copy'));

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText).toHaveBeenCalledWith(snippetText());
      expect(await screen.findByRole('button', { name: i18n.t('embed.settings.snippet.copied') })).toBeInTheDocument();

      // Another choice is another code: the button says «Copia» again.
      pickWidget('guest-access');
      expect(screen.getByTestId('embed-snippet-copy')).toHaveTextContent(i18n.t('embed.settings.snippet.copy'));
    });

    it('copy_TheClipboardRefuses_SaysSoAndDoesNotConfirm', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      renderPage();
      await loaded();

      fireEvent.click(screen.getByTestId('embed-snippet-copy'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('embed.settings.snippet.copyFailed')));
      expect(screen.getByTestId('embed-snippet-copy')).toHaveTextContent(i18n.t('embed.settings.snippet.copy'));
    });
  });

  describe('the preview', () => {
    it('preview_MountsThroughTheLoaderFromTheBaseOfTheCodeWithItsOptions_AndRemountsWhenTheChoiceChanges', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
      const first = lastMount();
      expect(first.options).toEqual({ widget: 'booking', base: 'https://prenota.tuavilla.test', lang: 'auto' });
      expect(screen.getByTestId('embed-preview-host')).toContainElement(first.element);
      await waitFor(() => expect(screen.getByTestId('embed-preview')).toHaveAttribute('data-state', 'ready'));

      pickWidget('guest-access');

      await waitFor(() => expect(mount).toHaveBeenCalledTimes(2));
      const second = lastMount();
      expect(second.options).toMatchObject({ widget: 'guest-access' });
      // A new element: the loader mounts an element once, and the old one has left the page.
      expect(second.element).not.toBe(first.element);
      expect(first.element.isConnected).toBe(false);
      expect(screen.getByTestId('embed-preview-host')).toContainElement(second.element);
    });

    it('preview_ADrawAgainWithTheSameChoice_LeavesTheWidgetAsItIs', async () => {
      withDomain(OWN);
      const client = newClient();
      const { rerender } = renderPage(client);
      await loaded();
      await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));

      rerender(page(client));

      expect(mount).toHaveBeenCalledTimes(1);
    });

    it('preview_Search_IsMountedAsAPreviewSoTheConsoleIsNotTakenAway', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();
      pickWidget('search');
      typeTarget('https://www.tuavilla.test/prenota');

      await waitFor(() => expect(lastMount().options).toMatchObject({ widget: 'search' }));

      expect(lastMount().options).toMatchObject({ preview: true, target: 'https://www.tuavilla.test/prenota' });
      // A widget in a frame is the real one: it has no such switch.
      pickWidget('booking');
      await waitFor(() => expect(lastMount().options).toMatchObject({ widget: 'booking' }));
      expect(lastMount().options).not.toHaveProperty('preview');
    });

    it.each([
      ['booking', {}],
      ['guest-access', {}],
      ['property', {}],
      ['search', { target: 'https://www.tuavilla.test/prenota' }],
    ])('preview_Widget_%s_IsWhatThePastedSnippetGivesTheLoader', async (widget, extra) => {
      renderPage();
      await loaded();
      pickWidget(widget);
      if ('target' in extra) typeTarget(extra.target);
      await waitFor(() => expect(lastMount().options).toMatchObject({ widget }));
      await screen.findByTestId('embed-snippet');

      // The text pasted in a page: the loader reads its attributes as the options of the element. The preview passes the same values.
      const { preview, ...options } = lastMount().options;
      expect(options).toEqual(attributesOf(snippetText()));
      expect(preview).toBe(widget === 'search' ? true : undefined);
    });

    it('preview_LoaderNotOnThePage_AddsItsScriptOnceFromTheSameBaseAndMountsWhenItLoads', async () => {
      delete (window as EmbedWindow).CasaZenEmbed;
      withDomain(OWN);
      renderPage();
      await loaded();

      const scripts = () => document.head.querySelectorAll<HTMLScriptElement>('script[data-casazen-preview-loader]');
      await waitFor(() => expect(scripts()).toHaveLength(1));
      const script = scripts()[0]!;
      expect(script.src).toBe('https://prenota.tuavilla.test/embed/v1/embed.js');
      expect(script.async).toBe(true);
      expect(screen.getByTestId('embed-preview')).toHaveAttribute('data-state', 'loading');

      // The choice changes while the file is on its way: still one script, and only the choice that stands is mounted.
      pickWidget('guest-access');
      expect(scripts()).toHaveLength(1);
      (window as EmbedWindow).CasaZenEmbed = { mount };
      fireEvent.load(script);

      await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
      expect(lastMount().options).toMatchObject({ widget: 'guest-access' });
      await waitFor(() => expect(screen.getByTestId('embed-preview')).toHaveAttribute('data-state', 'ready'));
    });

    it('preview_LoaderDoesNotCome_SaysSoWithTheAddressAndOffersToTryAgain', async () => {
      delete (window as EmbedWindow).CasaZenEmbed;
      withDomain(OWN);
      renderPage();
      await loaded();
      const scripts = () => document.head.querySelectorAll<HTMLScriptElement>('script[data-casazen-preview-loader]');
      await waitFor(() => expect(scripts()).toHaveLength(1));

      fireEvent.error(scripts()[0]!);

      const failed = await screen.findByTestId('embed-preview-failed');
      expect(failed).toHaveTextContent(i18n.t('embed.settings.preview.failed', { address: 'prenota.tuavilla.test' }));
      expect(screen.getByTestId('embed-preview')).toHaveAttribute('data-state', 'failed');
      expect(mount).not.toHaveBeenCalled();
      // The code is still there: the host can paste it.
      expect(screen.getByTestId('embed-snippet')).toBeInTheDocument();

      // Trying again puts a new script (the one that failed has left the page) and mounts when it comes.
      fireEvent.click(screen.getByTestId('embed-preview-retry'));
      await waitFor(() => expect(scripts()).toHaveLength(1));
      (window as EmbedWindow).CasaZenEmbed = { mount };
      fireEvent.load(scripts()[0]!);

      await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByTestId('embed-preview-failed')).not.toBeInTheDocument());
    });
  });

  describe('the plugin for WordPress (PLG-FE-CONSOLE, NF-200, NF-201)', () => {
    const MAIN = 'https://github.com/casazen/frontend/releases/download/wp-plugin-main/casazen.zip';
    const DEVELOP = 'https://github.com/casazen/frontend/releases/download/wp-plugin-develop/casazen.zip';

    it('plugin_ShowsTheFourSteps_DownloadConnectDomainAndPages', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      const steps = within(screen.getByTestId('embed-plugin-steps')).getAllByRole('listitem');
      expect(steps.map((step) => step.textContent)).toEqual([
        i18n.t('embed.settings.plugin.step1'),
        i18n.t('embed.settings.plugin.step2'),
        i18n.t('embed.settings.plugin.step3'),
        i18n.t('embed.settings.plugin.step4'),
      ]);
      expect(steps[0]).toHaveTextContent('Scarica il plugin');
      expect(steps[1]).toHaveTextContent('«Connetti a CasaZen»');
      expect(steps[2]).toHaveTextContent('dominio');
      expect(steps[2]).toHaveTextContent('record DNS');
      expect(steps[3]).toHaveTextContent('Area proprietari');
    });

    it('plugin_Steps_NoLongerAskForTheAddressAndTheSlug_TheConnectionFillsThemIn', async () => {
      renderPage();
      await loaded();

      const steps = screen.getByTestId('embed-plugin-steps');
      expect(steps).not.toHaveTextContent('https://sito.test');
      expect(steps).not.toHaveTextContent('villa-mare');
    });

    it('plugin_ManualSetup_IsACollapsedNote_WithTheAddressAndNoSlugOnAnOwnDomain', async () => {
      withDomain(OWN);
      renderPage();
      await loaded();

      const manual = screen.getByTestId('embed-plugin-manual') as HTMLDetailsElement;
      // Collapsed: the steps are the way, the manual set-up is only for whoever does not connect the plugin.
      expect(manual.open).toBe(false);
      expect(within(manual).getByText(i18n.t('embed.settings.plugin.manual.title'))).toBeInTheDocument();
      expect(screen.getByTestId('embed-plugin-address')).toHaveTextContent(i18n.t('embed.settings.plugin.manual.address', { address: 'https://prenota.tuavilla.test' }));
      // The domain of the agency knows who it is: there is no slug to write.
      expect(screen.getByTestId('embed-plugin-slug')).toHaveTextContent(i18n.t('embed.settings.plugin.manual.slugNotNeeded'));
      expect(screen.getByTestId('embed-plugin-slug')).not.toHaveTextContent('villa-mare');
      // It sits under the steps, not before them.
      expect(screen.getByTestId('embed-plugin-steps').compareDocumentPosition(manual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('plugin_ManualSetup_WithoutADomain_ShowsTheAddressAndTheSlugOfTheOrg', async () => {
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-address')).toHaveTextContent(i18n.t('embed.settings.plugin.manual.address', { address: 'https://sito.test' }));
      expect(screen.getByTestId('embed-plugin-slug')).toHaveTextContent(i18n.t('embed.settings.plugin.manual.slug', { slug: 'villa-mare' }));
    });

    it('plugin_DownloadLink_IsThereWithNothingSet_OnTheDevelopChannel', async () => {
      // No variable, a local or CI build: the link is there, and it is the asset of the develop channel.
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', DEVELOP);
      expect(screen.getByTestId('embed-plugin-download')).toHaveTextContent(i18n.t('embed.settings.plugin.download'));
    });

    it('plugin_DownloadLink_ProductionBuild_IsTheAssetOfTheMainChannel', async () => {
      build.deployEnv = 'production';
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', MAIN);
    });

    it('plugin_DownloadLink_PreviewBuild_IsTheAssetOfTheDevelopChannel', async () => {
      build.deployEnv = 'preview';
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', DEVELOP);
    });

    it('plugin_DownloadLink_IsTheAddressOfTheVariable_WhenItIsSet', async () => {
      vi.stubEnv('VITE_WORDPRESS_PLUGIN_URL', 'https://downloads.tuavilla.test/casazen-1.0.0.zip');
      build.deployEnv = 'production';
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', 'https://downloads.tuavilla.test/casazen-1.0.0.zip');
    });

    it('plugin_DownloadLink_AnAddressThatIsNotOnHttps_IsIgnoredAndTheLinkOfTheChannelStays', async () => {
      vi.stubEnv('VITE_WORDPRESS_PLUGIN_URL', 'http://downloads.tuavilla.test/casazen-1.0.0.zip');
      build.deployEnv = 'production';
      renderPage();
      await loaded();

      expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', MAIN);
    });

    it('plugin_DownloadLink_IsInEveryStateOfTheDomain', async () => {
      // The button is shown in every case: with a domain of its own, with the address of CasaZen, with a domain that waits for its DNS.
      for (const config of [OWN, PLATFORM, { ...PLATFORM, publicHostMode: 'CustomDomain', customDomain: 'www.tuavilla.test' } as OrgDomainConfig]) {
        withDomain(config);
        const view = renderPage();
        await loaded();

        expect(screen.getByTestId('embed-plugin-download')).toHaveAttribute('href', DEVELOP);
        view.unmount();
      }
    });

    it('sites_TheConnectedSitesAreAQuietBlockOfThePage_AfterThePluginAndBeforeTheContainer', async () => {
      vi.mocked(SiteConnectionsApi.list).mockResolvedValue([{ id: 'c1', siteUrl: 'https://www.tuavilla.test', createdAt: '2026-11-20T12:00:00Z', lastUsedAt: null }]);
      withDomain(OWN);
      renderPage();
      await loaded();

      expect(await screen.findByTestId('embed-site')).toHaveTextContent('https://www.tuavilla.test');
      expect(SiteConnectionsApi.list).toHaveBeenCalledWith('org-1');
      const order = Array.from(screen.getByTestId('embed-content').children).map((child) => child.getAttribute('data-testid'));
      expect(order.indexOf('embed-plugin')).toBeGreaterThan(-1);
      expect(order.indexOf('embed-sites')).toBe(order.indexOf('embed-plugin') + 1);
      expect(order.indexOf('embed-gtm')).toBe(order.indexOf('embed-sites') + 1);
    });
  });

  describe('the Google Tag Manager container', () => {
    const input = () => screen.getByTestId('embed-gtm-input');
    const save = () => screen.getByTestId('embed-gtm-save');
    const type = (value: string) => fireEvent.change(input(), { target: { value } });

    it.each(['GA-12345', 'GTM-', 'GTM-ABC', 'GTM-ABCDEFGHIJKLM', 'UA-1234-5', '<script>', 'GTM ABC123', 'GTM-ÀBC123'])('embedSettings_gtmId_validatesFormat_%s', async (value) => {
      renderPage();
      await loaded();

      type(value);
      fireEvent.click(save());

      // Refused before any request, with the rule in words.
      expect(await screen.findByText(i18n.t('embed.settings.gtm.invalid'))).toBeInTheDocument();
      expect(input()).toHaveAttribute('aria-invalid', 'true');
      expect(OrgTrackingApi.setTracking).not.toHaveBeenCalled();
    });

    it('embedSettings_gtmId_SavesAValidOneAsTheServerStoresItAndConfirms', async () => {
      vi.mocked(OrgTrackingApi.setTracking).mockResolvedValue({ gtmContainerId: 'GTM-ABC123' });
      renderPage();
      await loaded();

      type('  gtm-abc123 ');
      fireEvent.click(save());

      await waitFor(() => expect(OrgTrackingApi.setTracking).toHaveBeenCalledWith('org-1', { gtmContainerId: 'GTM-ABC123' }));
      expect(OrgTrackingApi.setTracking).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(input()).toHaveValue('GTM-ABC123'));
      expect(toast.success).toHaveBeenCalledWith(i18n.t('embed.settings.gtm.saved'));
      // Nothing more to save: what the field shows is what the server holds.
      expect(save()).toBeDisabled();
      // The domain settings were not read again: the answer of the server is what the page shows.
      expect(DomainApi.getDomain).toHaveBeenCalledTimes(1);
    });

    it('embedSettings_gtmId_EmptyClearsTheSavedOne', async () => {
      withDomain({ ...PLATFORM, tracking: { gtmContainerId: 'GTM-OLD123' } });
      vi.mocked(OrgTrackingApi.setTracking).mockResolvedValue({ gtmContainerId: null });
      renderPage();
      await loaded();
      expect(input()).toHaveValue('GTM-OLD123');

      type('   ');
      fireEvent.click(save());

      await waitFor(() => expect(OrgTrackingApi.setTracking).toHaveBeenCalledWith('org-1', { gtmContainerId: null }));
      await waitFor(() => expect(input()).toHaveValue(''));
      expect(toast.success).toHaveBeenCalledWith(i18n.t('embed.settings.gtm.cleared'));
    });

    it('embedSettings_gtmId_ServerRejection_IsShownWithItsOwnWords_AndTheFieldKeepsWhatWasTyped', async () => {
      const detail = 'The Google Tag Manager container ID is not valid: it must be GTM- followed by 4 to 12 letters or digits (for example GTM-ABC123).';
      vi.mocked(OrgTrackingApi.setTracking).mockRejectedValue(problem(400, { code: 'gtm_container_id_invalid', detail, status: 400 }));
      renderPage();
      await loaded();

      type('GTM-ABCD');
      fireEvent.click(save());

      expect(await screen.findByText(detail)).toBeInTheDocument();
      expect(input()).toHaveValue('GTM-ABCD');
      expect(toast.success).not.toHaveBeenCalled();

      // Writing again takes the refusal away.
      type('GTM-ABCDE');
      expect(screen.queryByText(detail)).not.toBeInTheDocument();
    });

    it('embedSettings_gtmId_ServerFailureWithNoWords_SaysItCouldNotBeSaved', async () => {
      vi.mocked(OrgTrackingApi.setTracking).mockRejectedValue(problem(404, {}));
      renderPage();
      await loaded();

      type('GTM-ABCD');
      fireEvent.click(save());

      expect(await screen.findByText(i18n.t('embed.settings.gtm.failed'))).toBeInTheDocument();
    });

    it('embedSettings_gtmId_ShowsTheSavedValueAfterAReload', async () => {
      withDomain({ ...PLATFORM, tracking: { gtmContainerId: 'GTM-XYZ789' } });
      const first = renderPage();
      await loaded();
      expect(input()).toHaveValue('GTM-XYZ789');
      expect(save()).toBeDisabled();
      first.unmount();

      // A new visit: nothing of the first one is kept on the page, the settings are read again.
      renderPage();
      await loaded();

      expect(input()).toHaveValue('GTM-XYZ789');
      expect(DomainApi.getDomain).toHaveBeenCalledTimes(2);
    });

    it('embedSettings_gtmId_WhileASaveIsOnItsWay_TheFieldAndTheButtonAreOff_AndItGoesOutOnce', async () => {
      let answer!: (value: { gtmContainerId: string | null }) => void;
      vi.mocked(OrgTrackingApi.setTracking).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      renderPage();
      await loaded();

      type('GTM-ABC123');
      fireEvent.click(save());
      await waitFor(() => expect(save()).toBeDisabled());
      expect(input()).toBeDisabled();
      fireEvent.click(save());
      fireEvent.submit(input().closest('form')!);
      expect(OrgTrackingApi.setTracking).toHaveBeenCalledTimes(1);

      answer({ gtmContainerId: 'GTM-ABC123' });
      await waitFor(() => expect(input()).toBeEnabled());
    });
  });
});

describe('the texts of the page', () => {
  const sources = import.meta.glob<string>(['/src/features/settings/embed/*.ts', '/src/features/settings/embed/*.tsx'], { query: '?raw', import: 'default', eager: true });

  /** Every text of a block with the path of its key, and the keys of each of its objects in the order the file has them. */
  function scan(node: unknown, path: string, texts: [string, string][] = [], orders: [string, string[]][] = []) {
    if (typeof node === 'string') texts.push([path, node]);
    else if (node !== null && typeof node === 'object') {
      orders.push([path, Object.keys(node)]);
      for (const [key, value] of Object.entries(node)) scan(value, `${path}.${key}`, texts, orders);
    }
    return { texts, orders };
  }

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('texts_%s_AreInAlphabeticalOrderNameNoOtherBookingSystemAndNeverConvertACurrency', (_language, locale) => {
    const { texts, orders } = scan(locale.embed.settings, 'embed.settings');
    texts.push(['nav.embed', locale.nav.embed]);
    // The scan really reaches the block.
    expect(texts.length).toBeGreaterThan(70);

    for (const [path, keys] of orders) expect(keys, path).toEqual([...keys].sort());
    expect(texts.filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
    expect(texts.filter(([, text]) => /kross|booking\.com|airbnb|expedia|octorate|smoobu|lodgify|guesty|hostaway|beds24|vrbo/i.test(text)).map(([key]) => key)).toEqual([]);
    expect(texts.filter(([, text]) => /conver(t|s|ti|sion)|cambio|exchange rate/i.test(text)).map(([key]) => key)).toEqual([]);
  });

  it('texts_BothLanguagesHaveTheSameKeys', () => {
    expect(scan(it_.embed.settings, 'embed.settings').texts.map(([key]) => key)).toEqual(scan(en.embed.settings, 'embed.settings').texts.map(([key]) => key));
    expect(it_.nav.embed).toBeTruthy();
    expect(en.nav.embed).toBeTruthy();
  });

  it.each(['it', 'en'] as const)('texts_%s_EveryKeyTheCodeAsksFor_Exists', (language) => {
    const has = (key: string) => typeof i18n.getResource(language, 'translation', key) === 'string' || typeof i18n.getResource(language, 'translation', `${key}_other`) === 'string';
    const keys = new Set<string>(['nav.embed']);
    for (const source of Object.values(sources)) {
      for (const match of source.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.-]+)['"]/g)) keys.add(match[1] ?? '');
    }
    // The keys the code builds: the confirmations of the container, the texts of each widget, the state of a custom domain and the step of the owner sign-in (the words of the tab of the domain).
    for (const outcome of ['saved', 'cleared']) keys.add(`embed.settings.gtm.${outcome}`);
    for (const widget of ['booking', 'property', 'guestAccess', 'search']) for (const part of ['label', 'help']) keys.add(`embed.settings.widgets.${widget}.${part}`);
    for (const state of ['verified', 'waitingDns', 'activating', 'failed']) keys.add(`domain.state.${state}`);
    for (const state of ['failed', 'notRequested', 'pendingAutomatic', 'pendingManual', 'ready']) keys.add(`domain.surfaces.ownerLogin.state.${state}`);

    // The scan really reaches the code of the page.
    expect(keys.size).toBeGreaterThan(60);
    expect([...keys].filter((key) => !has(key))).toEqual([]);
  });

  it('texts_TheCodeOfThePage_NeverUsesADefaultValue', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(8);
    expect(Object.values(sources).some((source) => /\bdefaultValue\b/.test(source))).toBe(false);
  });

  it('texts_TheCodeOfThePage_NeverUsesTheStorageOfTheBrowser', () => {
    // The page keeps nothing on the device: not what was chosen, not what was written.
    expect(Object.values(sources).some((source) => /localStorage|sessionStorage|document\.cookie/.test(source))).toBe(false);
  });
});

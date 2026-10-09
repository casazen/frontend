import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import { AppShell } from '@/components/layout/app-shell';
import { ContextLayout } from '@/components/layout/context-layout';
import { PageHeader } from '@/components/layout/page-header';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';

/**
 * UI-03 on a route tree shaped like the app's: `ContextLayout` as the layout route of the area, pages that still wrap
 * themselves in `AppShell` (as 38 files do), the guard of the manifest routes. The shell, its header and its menus are
 * the real ones; only the sources of data (auth, current user) are replaced.
 */
const support = vi.hoisted(() => ({ email: null as string | null }));

vi.mock('@/config/support.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/support.config')>();
  return {
    ...actual,
    supportConfig: {
      get email() {
        return support.email;
      },
    },
  };
});
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Demo User', email: 'demo@casazen.com' }, logout: vi.fn() }),
}));
// The counters of the menu have their own tests: the route tree does not need a query client.
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: () => ({}) }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({
    org: { id: 'org-1', name: 'Acme Stays', slug: 'acme-stays', planTier: 'Pro' },
    planTier: 'Pro',
    user: null,
    isLoading: false,
  }),
}));

const contexts: ContextBootstrapDto[] = [
  {
    contextKey: 'short-rent',
    displayName: 'Affitti brevi',
    roleKey: 'property_owner',
    permissions: ['property.read', 'booking.read'],
    defaultRoute: '/app/short-rent',
  },
  {
    contextKey: 'long-rent',
    displayName: 'Affitti lungo termine',
    roleKey: 'long_term_landlord',
    permissions: ['lease.read'],
    defaultRoute: '/app/long-rent/leases',
  },
];

const workspace: WorkspaceContextValue = {
  contexts,
  activeContext: 'short-rent',
  isReady: true,
  setActiveContext: vi.fn(),
  hasPermission: (contextKey, permission) =>
    contexts.find((context) => context.contextKey === contextKey)?.permissions.includes(permission) ?? false,
  getDefaultRoute: (contextKey) => contexts.find((context) => context.contextKey === contextKey)?.defaultRoute ?? '/app',
};

/** A page as the app has them: its own `AppShell` wrapper around a `PageHeader`. */
function Page({ title }: { title: string }) {
  return (
    <AppShell>
      <PageHeader title={title} />
      <p>{`${title}: contenuto`}</p>
    </AppShell>
  );
}

function buildRoutes(value: WorkspaceContextValue): RouteObject[] {
  return [
    {
      path: '/app',
      element: (
        <WorkspaceContext.Provider value={value}>
          <Outlet />
        </WorkspaceContext.Provider>
      ),
      children: [
        {
          path: 'short-rent',
          element: <ContextLayout />,
          children: [
            { index: true, element: <Page title="Cruscotto" /> },
            { path: 'bookings', element: <Page title="Prenotazioni" /> },
            { path: 'properties', element: <Page title="Immobili" /> },
            {
              path: 'payments',
              element: (
                <ContextRouteGuard contextKey="short-rent" requiredPermissions={['payment.read']}>
                  <Page title="Incassi" />
                </ContextRouteGuard>
              ),
            },
          ],
        },
        {
          path: 'long-rent',
          element: <ContextLayout />,
          children: [{ path: 'leases', element: <Page title="Contratti lungo termine" /> }],
        },
        {
          path: 'unknown-area',
          element: <ContextLayout />,
          children: [{ index: true, element: <Page title="Mai mostrata" /> }],
        },
        { path: 'choose-context', element: <h1>Scegli l'area</h1> },
      ],
    },
  ];
}

function renderApp(entry: string, value: WorkspaceContextValue = workspace) {
  const router = createMemoryRouter(buildRoutes(value), { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('one shell per route (UI-03)', () => {
  beforeEach(async () => {
    window.scrollTo = vi.fn();
    support.email = null;
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('AppShellRoute_PageWrappedInAppShell_RendersASingleShell', async () => {
    renderApp('/app/short-rent');

    expect(await screen.findByRole('heading', { level: 1, name: 'Cruscotto' })).toBeInTheDocument();
    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('complementary', { name: i18n.t('shell.mainNavigation') })).toHaveLength(1);
    expect(screen.getAllByRole('navigation', { name: i18n.t('shell.mobileNavigation') })).toHaveLength(1);
    // The menu button of the header is gone (UI-05): on a phone the menu is "Altro" of the bottom bar, and only the bar has it.
    expect(screen.queryByRole('button', { name: 'Apri menu di navigazione' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: i18n.t('shell.mobileNavigation') })).getAllByRole('button', { name: i18n.t('nav.more') }),
    ).toHaveLength(1);
  });

  it('AppShellRoute_EveryPage_PutsItsOwnTitleAndTheNameOfItsAreaOnTheTab', async () => {
    document.title = 'CasaZen';
    const router = renderApp('/app/short-rent');

    expect(await screen.findByRole('heading', { level: 1, name: 'Cruscotto' })).toBeInTheDocument();
    expect(document.title).toBe('Cruscotto · Affitti brevi · CasaZen');

    // The shell stays and the page changes: so does the title, and the area when the user goes to another one.
    await act(async () => {
      await router.navigate('/app/short-rent/bookings');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeInTheDocument();
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');

    await act(async () => {
      await router.navigate('/app/long-rent/leases');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Contratti lungo termine' })).toBeInTheDocument();
    expect(document.title).toBe('Contratti lungo termine · Affitti lunghi · CasaZen');
  });

  it('AppShellRoute_WorkspaceNotReady_ShowsTheLoadingScreenNotAnEmptyShell', async () => {
    renderApp('/app/short-rent', { ...workspace, isReady: false });

    expect(await screen.findByText(i18n.t('shared.auth.loadingWorkspace'))).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Cruscotto' })).not.toBeInTheDocument();
  });

  it('AppShellRoute_UnknownArea_LeavesForTheAreaPickerWithoutAShell', async () => {
    const router = renderApp('/app/unknown-area');

    expect(await screen.findByRole('heading', { level: 1, name: "Scegli l'area" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/choose-context');
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
  });

  it('AppShellRoute_EveryArea_RendersASingleShellWithItsOwnName', async () => {
    renderApp('/app/long-rent/leases');

    expect(await screen.findByRole('heading', { level: 1, name: 'Contratti lungo termine' })).toBeInTheDocument();
    const shells = screen.getAllByTestId('app-shell');
    expect(shells).toHaveLength(1);
    expect(shells[0]).toHaveAttribute('data-context', 'long-rent');
    expect(within(screen.getByRole('complementary')).getByText(i18n.t('areas.longRent.name'))).toBeInTheDocument();
  });

  it('AppShellRoute_NavigatingBetweenPages_KeepsTheHeaderAndTheSidebarMounted', async () => {
    const router = renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });
    const header = screen.getByRole('banner');
    const sidebar = screen.getByRole('complementary');
    const main = screen.getByRole('main');

    await act(() => router.navigate('/app/short-rent/bookings'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeInTheDocument();

    expect(screen.getByRole('banner')).toBe(header);
    expect(screen.getByRole('complementary')).toBe(sidebar);
    expect(screen.getByRole('main')).toBe(main);
    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Cruscotto' })).not.toBeInTheDocument();
  });

  it('AppShellRoute_SwitchingArea_KeepsTheSameShellAndChangesItsMenu', async () => {
    const router = renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });
    const header = screen.getByRole('banner');

    await act(() => router.navigate('/app/long-rent/leases'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Contratti lungo termine' })).toBeInTheDocument();

    expect(screen.getByRole('banner')).toBe(header);
    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-context', 'long-rent');
    expect(within(screen.getByRole('complementary')).getByText(i18n.t('areas.longRent.name'))).toBeInTheDocument();
  });

  it('AppShellRoute_FirstPage_LeavesTheFocusWhereTheBrowserPutIt', async () => {
    renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });

    expect(document.activeElement).toBe(document.body);
    expect(screen.getByTestId('route-announcer')).toBeEmptyDOMElement();
  });

  it('AppShellRoute_NavigatingToAnotherPage_MovesTheFocusToTheHeadingAndAnnouncesTheTitle', async () => {
    const router = renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });

    await act(() => router.navigate('/app/short-rent/bookings'));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Prenotazioni' });

    await waitFor(() => expect(heading).toHaveFocus());
    await waitFor(() => expect(screen.getByTestId('route-announcer')).toHaveTextContent('Prenotazioni'));
    expect(screen.getByTestId('route-announcer')).toHaveAttribute('aria-live', 'polite');

    await act(() => router.navigate('/app/short-rent/properties'));
    const next = await screen.findByRole('heading', { level: 1, name: 'Immobili' });
    await waitFor(() => expect(next).toHaveFocus());
    await waitFor(() => expect(screen.getByTestId('route-announcer')).toHaveTextContent('Immobili'));
  });

  it('AppShellRoute_NavigatingToAnotherPage_OpensItAtTheTopOfTheWindow', async () => {
    const router = renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });
    vi.mocked(window.scrollTo).mockClear();

    await act(() => router.navigate('/app/short-rent/bookings'));
    await screen.findByRole('heading', { level: 1, name: 'Prenotazioni' });

    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 0));
  });

  it('AppShellRoute_SkipLink_IsTheFirstFocusableElementAndMovesTheFocusToTheContent', async () => {
    renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });

    const firstFocusable = document.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const skipLink = screen.getByRole('link', { name: i18n.t('appShell.skipToContent') });
    expect(firstFocusable).toBe(skipLink);
    expect(skipLink).toHaveAttribute('href', '#main-content');

    act(() => skipLink.click());
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveFocus();
  });

  it('AppShellRoute_PageWithoutThePermission_ShowsTheReservedPageInsideTheShell', async () => {
    const router = renderApp('/app/short-rent/payments');

    const title = await screen.findByRole('heading', { level: 1, name: i18n.t('appShell.reserved.title') });
    expect(within(screen.getByRole('main')).getByTestId('reserved-page')).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(screen.queryByText('Incassi: contenuto')).not.toBeInTheDocument();
    // No silent redirect: the address is the one the user asked for.
    expect(router.state.location.pathname).toBe('/app/short-rent/payments');
    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.getByRole('link', { name: i18n.t('appShell.reserved.backToToday') })).toHaveAttribute(
      'href',
      '/app/short-rent',
    );
  });

  it('AppShellRoute_ReservedPage_TakesTheFocusAndIsAnnouncedLikeAnyOtherPage', async () => {
    const router = renderApp('/app/short-rent');
    await screen.findByRole('heading', { level: 1, name: 'Cruscotto' });

    await act(() => router.navigate('/app/short-rent/payments'));
    const title = await screen.findByRole('heading', { level: 1, name: i18n.t('appShell.reserved.title') });

    await waitFor(() => expect(title).toHaveFocus());
    await waitFor(() =>
      expect(screen.getByTestId('route-announcer')).toHaveTextContent(i18n.t('appShell.reserved.title')),
    );
  });

  it('AppShellRoute_ReservedPageBackLink_LeadsToTheHomeInTheSameShell', async () => {
    const router = renderApp('/app/short-rent/payments');
    await screen.findByRole('heading', { level: 1, name: i18n.t('appShell.reserved.title') });
    const header = screen.getByRole('banner');

    await act(async () => screen.getByRole('link', { name: i18n.t('appShell.reserved.backToToday') }).click());

    expect(await screen.findByRole('heading', { level: 1, name: 'Cruscotto' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/short-rent');
    expect(screen.getByRole('banner')).toBe(header);
  });

  it('AppShellRoute_ReservedPageWithSupportEmail_OffersToAskForAccessByEmail', async () => {
    support.email = 'assistenza@casazen.test';
    renderApp('/app/short-rent/payments');
    await screen.findByRole('heading', { level: 1, name: i18n.t('appShell.reserved.title') });

    const ask = screen.getByRole('link', { name: i18n.t('appShell.reserved.requestAccess') });
    const href = ask.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:assistenza@casazen.test?subject=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('/app/short-rent/payments');
  });

  it('AppShellRoute_ReservedPageWithoutSupportEmail_InventsNoChannel', async () => {
    renderApp('/app/short-rent/payments');
    await screen.findByRole('heading', { level: 1, name: i18n.t('appShell.reserved.title') });

    expect(screen.queryByRole('link', { name: i18n.t('appShell.reserved.requestAccess') })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getByText(i18n.t('appShell.reserved.requestAccessGeneric'))).toBeInTheDocument();
  });
});

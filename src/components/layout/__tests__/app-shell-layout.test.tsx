import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { AppShell } from '../app-shell';
import { AppShellContext } from '../app-shell-context';
import { AppShellLayout } from '../app-shell-layout';

const supplier = vi.hoisted(() => ({ suspended: false }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { name: 'Demo User', email: 'demo@casazen.com' }, logout: vi.fn() }),
}));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({
    org: { id: 'org-1', name: 'Acme Stays', slug: 'acme-stays', planTier: 'Pro' },
    planTier: 'Pro',
    user: null,
    isLoading: false,
  }),
}));
vi.mock('@/queries/use-supplier', () => ({ useSupplierSuspended: () => supplier.suspended }));

function workspace(contextKeys: AppContextKey[]): WorkspaceContextValue {
  const contexts: ContextBootstrapDto[] = contextKeys.map((contextKey) => ({
    contextKey,
    displayName: contextKey,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));
  return {
    contexts,
    activeContext: contextKeys[0] ?? null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: () => true,
    getDefaultRoute: (contextKey) => `/app/${contextKey}`,
  };
}

function renderInRouter(ui: React.ReactNode, path = '/app/short-rent', contextKeys: AppContextKey[] = ['short-rent']) {
  return render(
    <WorkspaceContext.Provider value={workspace(contextKeys)}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

describe('AppShellLayout (UI-03)', () => {
  beforeEach(async () => {
    supplier.suspended = false;
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('AppShellLayout_Page_SitsInTheContentRegionTheSkipLinkLeadsTo', () => {
    renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <h1>Prenotazioni</h1>
      </AppShellLayout>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(within(main).getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('appShell.skipToContent') })).toHaveAttribute('href', '#main-content');
  });

  it('AppShellLayout_Rendered_HasTheSkipLinkBeforeEverythingElse', () => {
    renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <p>pagina</p>
      </AppShellLayout>,
    );

    const focusable = document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea');
    expect(focusable[0]).toBe(screen.getByTestId('skip-link'));
    expect(focusable[0]).toHaveTextContent(i18n.t('appShell.skipToContent'));
  });

  it('AppShellLayout_Rendered_KeepsTheLandmarksTheEndToEndSpecsRead', () => {
    renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <p>pagina</p>
      </AppShellLayout>,
      '/app/short-rent',
      ['short-rent', 'long-rent'],
    );

    expect(screen.getByRole('complementary', { name: i18n.t('shell.mainNavigation') })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: i18n.t('shell.mobileNavigation') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('shell.openMenu') })).toBeInTheDocument();
    expect(screen.getAllByRole('tablist', { name: i18n.t('shell.workspaceContext') })).toHaveLength(1);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('org-badge')).toBeInTheDocument();
    // `header` is queried by tag in the end-to-end specs: there is one, and it is the banner of the page.
    expect(document.querySelectorAll('header')).toHaveLength(1);
    expect(screen.getByRole('banner')).toBe(document.querySelector('header'));
  });

  it.each<[AppContextKey, string]>([
    ['short-rent', 'shell.shortRentSubtitle'],
    ['long-rent', 'shell.longRentSubtitle'],
    ['admin', 'shell.adminSubtitle'],
    ['supplier', 'shell.supplierSubtitle'],
  ])('AppShellLayout_%s_ShowsTheSubtitleOfItsArea', (contextKey, subtitleKey) => {
    renderInRouter(
      <AppShellLayout contextKey={contextKey}>
        <p>pagina</p>
      </AppShellLayout>,
      `/app/${contextKey}`,
      [contextKey],
    );

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-context', contextKey);
    // The subtitle sits under the brand (a menu group may carry the same word, e.g. "Amministrazione").
    const brand = within(screen.getByRole('complementary')).getByText('CASAZEN');
    expect(brand.nextElementSibling).toHaveTextContent(i18n.t(subtitleKey));
  });

  it('AppShellLayout_AdminArea_KeepsItsOwnFooterLabel', () => {
    renderInRouter(
      <AppShellLayout contextKey="admin">
        <p>pagina</p>
      </AppShellLayout>,
      '/app/admin',
      ['admin'],
    );

    expect(within(screen.getByRole('complementary')).getByText(i18n.t('shell.adminFooter'))).toBeInTheDocument();
  });

  it('AppShellLayout_SupplierSuspended_ShowsTheSuspensionBannerInsideTheContent', () => {
    supplier.suspended = true;
    renderInRouter(
      <AppShellLayout contextKey="supplier">
        <p>pagina</p>
      </AppShellLayout>,
      '/app/supplier/inbox',
      ['supplier'],
    );

    expect(within(screen.getByRole('main')).getByTestId('supplier-suspended-banner')).toBeInTheDocument();
  });

  it('AppShellLayout_OtherAreas_NeverShowTheSupplierSuspensionBanner', () => {
    supplier.suspended = true;
    renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <p>pagina</p>
      </AppShellLayout>,
    );

    expect(screen.queryByTestId('supplier-suspended-banner')).not.toBeInTheDocument();
  });

  // The window scrolls (not an inner region): these classes are what makes the header and the sidebar stay in place.
  it('AppShellLayout_Rendered_LetsTheWindowScrollWithAStickyHeaderAndSidebar', () => {
    renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <p>pagina</p>
      </AppShellLayout>,
    );

    const shell = screen.getByTestId('app-shell');
    expect(shell).toHaveClass('min-h-dvh');
    expect(shell).not.toHaveClass('h-screen');
    expect(shell).not.toHaveClass('overflow-hidden');
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('complementary')).toHaveClass('sticky', 'top-0', 'h-dvh', 'self-start');
    expect(screen.getByRole('main')).not.toHaveClass('overflow-y-auto');
    expect(screen.getByRole('main').parentElement).not.toHaveClass('overflow-hidden');
  });

  it('AppShellLayout_Mounted_KeepsAnchorsAndFocusedElementsFromLandingUnderTheStickyHeader', () => {
    document.documentElement.style.scrollPaddingTop = '';
    const { unmount } = renderInRouter(
      <AppShellLayout contextKey="short-rent">
        <p>pagina</p>
      </AppShellLayout>,
    );

    expect(document.documentElement.style.scrollPaddingTop).toBe('4rem');

    // Nothing is left behind when the user leaves the shell (the public pages have no sticky header).
    unmount();
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
  });
});

describe('AppShell (idempotent, UI-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('AppShell_InsideAShell_RendersOnlyTheChildren', () => {
    render(
      <AppShellContext.Provider value={{ contextKey: 'short-rent' }}>
        <AppShell>
          <p>contenuto della pagina</p>
        </AppShell>
      </AppShellContext.Provider>,
    );

    expect(screen.getByText('contenuto della pagina')).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('AppShell_NestedInsideTheShellOfTheRoute_NeverAddsASecondShell', () => {
    renderInRouter(
      <AppShellLayout contextKey="long-rent">
        <AppShell>
          <AppShell>
            <p>contenuto della pagina</p>
          </AppShell>
        </AppShell>
      </AppShellLayout>,
      '/app/long-rent/leases',
      ['long-rent'],
    );

    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-context', 'long-rent');
    expect(within(screen.getByRole('main')).getByText('contenuto della pagina')).toBeInTheDocument();
  });

  it('AppShell_OutsideAnyShell_GivesTheShortRentShellAsItAlwaysDid', () => {
    renderInRouter(
      <AppShell>
        <p>contenuto della pagina</p>
      </AppShell>,
    );

    expect(screen.getAllByTestId('app-shell')).toHaveLength(1);
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-context', 'short-rent');
    expect(within(screen.getByRole('main')).getByText('contenuto della pagina')).toBeInTheDocument();
  });
});

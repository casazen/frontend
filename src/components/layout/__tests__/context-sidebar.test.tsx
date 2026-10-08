import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { UI_STORE_STORAGE_KEY, useUiStore } from '@/store/ui-store';
import { ContextSidebar } from '../context-sidebar';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: vi.fn() }));

import { useWorkspace } from '@/hooks/use-workspace';
import { useNavCounts } from '@/hooks/use-nav-counts';

function arrange(contextKeys: AppContextKey[], hasPermission: (ctx: AppContextKey, permission: string) => boolean = () => true) {
  const contexts: ContextBootstrapDto[] = contextKeys.map((contextKey) => ({
    contextKey,
    displayName: `backend ${contextKey}`,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));
  vi.mocked(useWorkspace).mockReturnValue({
    contexts,
    activeContext: contextKeys[0] ?? null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission,
    getDefaultRoute: (key) => `/app/${key}`,
  });
}

function renderSidebar(contextKey: AppContextKey, path = `/app/${contextKey}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ContextSidebar contextKey={contextKey} organizationName="Casa Rossi Srl" />
    </MemoryRouter>,
  );
}

describe('ContextSidebar (UI-04a)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useUiStore.setState({ sidebarCollapsed: false });
    vi.mocked(useNavCounts).mockReturnValue({});
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('ContextSidebar_Rendered_KeepsTheLandmarkAndTheStickyFrameOfTheShell', () => {
    arrange(['short-rent']);
    renderSidebar('short-rent');

    const aside = screen.getByRole('complementary', { name: 'Navigazione principale' });
    expect(aside).toHaveClass('sticky', 'top-0', 'h-dvh', 'self-start');
    expect(within(aside).getByRole('navigation', { name: 'Menu Affitti brevi' })).toBeInTheDocument();
  });

  it('ContextSidebar_OneArea_StartsWithTheNameOfTheAreaAndTheOrganization', () => {
    arrange(['long-rent']);
    renderSidebar('long-rent', '/app/long-rent/leases');

    const heading = screen.getByTestId('area-header');
    expect(within(heading).getByText('Affitti lunghi')).toBeInTheDocument();
    expect(within(heading).getByText('Casa Rossi Srl')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('ContextSidebar_SeveralAreas_HasTheAreaSwitcherInsteadOfTheIconTabs', () => {
    arrange(['short-rent', 'long-rent', 'supplier']);
    renderSidebar('short-rent');

    expect(screen.getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('ContextSidebar_StaffConsole_KeepsItsNameAndItsOwnFooterLine', () => {
    arrange(['admin']);
    renderSidebar('admin', '/app/admin');

    expect(within(screen.getByTestId('area-header')).getByText('Amministrazione')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0 · Admin')).toBeInTheDocument();
  });

  it('ContextSidebar_OtherAreas_ShowTheVersionLine', () => {
    arrange(['short-rent']);
    renderSidebar('short-rent');

    expect(screen.getByText('v1.0.0 · casazen.io')).toBeInTheDocument();
  });

  it('ContextSidebar_ShortRent_ShowsAtMostSevenEntriesInGroupsAndMore', () => {
    arrange(['short-rent']);
    renderSidebar('short-rent');

    const nav = screen.getByRole('navigation', { name: 'Menu Affitti brevi' });
    expect(within(nav).getAllByRole('link')).toHaveLength(7);
    const groups = within(nav).getAllByRole('group');
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveAccessibleName('Ogni giorno');
    expect(groups[1]).toHaveAccessibleName('La tua offerta');
    expect(groups[2]).toHaveAccessibleName('Gestione');
    expect(within(nav).getByRole('button', { name: 'Altro' })).toBeInTheDocument();
  });

  it('ContextSidebar_UserWithoutAPermission_DoesNotSeeTheEntryThatAsksForIt', () => {
    arrange(['short-rent'], (_ctx, permission) => permission !== 'property.read');
    renderSidebar('short-rent');

    expect(screen.queryByRole('link', { name: 'Immobili' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cruscotto' })).toBeInTheDocument();
  });

  it('ContextSidebar_RequestsWaiting_ShowsTheCounterOfBookingsAndAsksForTheEntriesOfTheMenu', () => {
    arrange(['short-rent']);
    vi.mocked(useNavCounts).mockReturnValue({ bookingRequests: 2 });
    renderSidebar('short-rent');

    expect(within(screen.getByRole('link', { name: /Prenotazioni/ })).getByTestId('nav-count')).toHaveTextContent('2');
    // The hook is given the entries of the menu: it asks for a count only where the menu has an entry that shows it.
    const entries = vi.mocked(useNavCounts).mock.calls[0][0];
    expect(entries.map((entry) => entry.path)).toContain('/app/short-rent/bookings');
    expect(entries.some((entry) => entry.navCount === 'bookingRequests')).toBe(true);
  });

  it('ContextSidebar_Supplier_ShowsTheCounterOfTheInbox', () => {
    arrange(['supplier']);
    vi.mocked(useNavCounts).mockReturnValue({ supplierRequests: 3 });
    renderSidebar('supplier', '/app/supplier/dashboard');

    expect(within(screen.getByRole('link', { name: /Richieste/ })).getByTestId('nav-count')).toHaveTextContent('3');
  });

  describe('collapse', () => {
    it('ContextSidebar_Rendered_StartsExpandedWithAButtonToCollapse', () => {
      arrange(['short-rent']);
      renderSidebar('short-rent');

      const aside = screen.getByRole('complementary');
      expect(aside).toHaveAttribute('data-collapsed', 'false');
      expect(aside).toHaveClass('w-64');
      expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAccessibleName('Comprimi menu');
      expect(screen.getByText('Cruscotto')).not.toHaveClass('sr-only');
    });

    it('ContextSidebar_CollapseButton_ReducesTheSidebarToTheIconsAndBack', () => {
      arrange(['short-rent', 'long-rent']);
      renderSidebar('short-rent');

      fireEvent.click(screen.getByTestId('sidebar-collapse-toggle'));

      const aside = screen.getByRole('complementary');
      expect(aside).toHaveAttribute('data-collapsed', 'true');
      expect(aside).toHaveClass('w-[4.5rem]');
      expect(aside).not.toHaveClass('w-64');
      expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAccessibleName('Espandi menu');
      // Names stay for screen readers; the footer line and the group names go.
      expect(screen.getByRole('link', { name: 'Cruscotto' })).toBeInTheDocument();
      expect(screen.getByText('Cruscotto')).toHaveClass('sr-only');
      expect(screen.queryByText('v1.0.0 · casazen.io')).not.toBeInTheDocument();
      expect(screen.queryByText('Ogni giorno')).not.toBeInTheDocument();
      // The area switcher keeps working on the icon alone.
      expect(screen.getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' })).not.toHaveTextContent('Affitti brevi');

      fireEvent.click(screen.getByTestId('sidebar-collapse-toggle'));
      expect(screen.getByRole('complementary')).toHaveAttribute('data-collapsed', 'false');
      expect(screen.getByText('v1.0.0 · casazen.io')).toBeInTheDocument();
    });

    it('ContextSidebar_Collapsed_IsRememberedAndTheNextVisitStartsCollapsed', async () => {
      arrange(['short-rent']);
      const { unmount } = renderSidebar('short-rent');
      fireEvent.click(screen.getByTestId('sidebar-collapse-toggle'));
      const kept = window.localStorage.getItem(UI_STORE_STORAGE_KEY) ?? '';
      expect(JSON.parse(kept).state).toEqual({ sidebarCollapsed: true });
      unmount();

      // A new visit: the memory starts empty and the store reads what the browser kept.
      useUiStore.setState({ sidebarCollapsed: false });
      window.localStorage.setItem(UI_STORE_STORAGE_KEY, kept);
      await act(async () => {
        await useUiStore.persist.rehydrate();
      });
      renderSidebar('short-rent');

      expect(screen.getByRole('complementary')).toHaveAttribute('data-collapsed', 'true');
      expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAccessibleName('Espandi menu');
    });

    it('ContextSidebar_Collapsed_StillShowsHowManyRequestsAreWaiting', () => {
      arrange(['short-rent']);
      vi.mocked(useNavCounts).mockReturnValue({ bookingRequests: 2 });
      useUiStore.setState({ sidebarCollapsed: true });
      renderSidebar('short-rent');

      expect(screen.getByRole('link', { name: /Prenotazioni/ })).toHaveAccessibleName('Prenotazioni, 2 richieste da approvare');
    });
  });
});

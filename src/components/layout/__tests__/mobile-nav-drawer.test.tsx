import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { useUiStore } from '@/store/ui-store';
import { MobileNavDrawer } from '../mobile-nav-drawer';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: vi.fn() }));

import { useWorkspace } from '@/hooks/use-workspace';
import { useCurrentUser } from '@/queries/use-users';

function arrange(contextKeys: AppContextKey[]) {
  const contexts: ContextBootstrapDto[] = contextKeys.map((contextKey) => ({
    contextKey,
    displayName: contextKey,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));
  vi.mocked(useWorkspace).mockReturnValue({
    contexts,
    activeContext: contextKeys[0] ?? null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: () => true,
    getDefaultRoute: (key) => `/app/${key}`,
  });
}

function renderDrawer(contextKey: AppContextKey, path = `/app/${contextKey}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileNavDrawer contextKey={contextKey} />
    </MemoryRouter>,
  );
}

// The menu of the phone (UI-04b redraws it as a sheet from the bottom): it keeps working with the new manifest.
describe('MobileNavDrawer (UI-04a)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useUiStore.setState({ sidebarOpen: true });
    vi.mocked(useCurrentUser).mockReturnValue({
      org: { id: 'org-1', name: 'Casa Rossi Srl', slug: 'casa-rossi', planTier: 'Pro' },
      user: null,
      planTier: 'Pro',
      isLoading: false,
    } as unknown as ReturnType<typeof useCurrentUser>);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ sidebarOpen: false });
  });

  it('MobileNavDrawer_Closed_ShowsNothing', () => {
    useUiStore.setState({ sidebarOpen: false });
    arrange(['short-rent']);
    renderDrawer('short-rent');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('MobileNavDrawer_Open_ListsWhatTheBottomBarDoesNot', () => {
    arrange(['short-rent']);
    renderDrawer('short-rent');

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('CASAZEN')).toBeInTheDocument();
    const nav = within(drawer).getByRole('navigation', { name: 'Menu Affitti brevi' });
    const groups = within(nav).getAllByRole('group');
    expect(groups).toHaveLength(3);
    expect(groups[0]).toHaveAccessibleName('La tua offerta');
    expect(groups[1]).toHaveAccessibleName('Gestione');
    expect(groups[2]).toHaveAccessibleName('Altro');
    const labels = within(nav).getAllByRole('link').map((link) => link.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Sito di prenotazione', 'Marketplace', 'Incassi', 'Ospiti', 'Profilo', 'Stripe Connect']));
    for (const inTheBar of ['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili']) {
      expect(labels).not.toContain(inTheBar);
    }
  });

  it('MobileNavDrawer_UserWithSeveralAreas_CanChangeAreaFromTheMenu', () => {
    arrange(['short-rent', 'long-rent']);
    renderDrawer('short-rent');

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('tab')).not.toBeInTheDocument();
  });

  it('MobileNavDrawer_UserWithOneArea_HasNoSwitcher', () => {
    arrange(['supplier']);
    renderDrawer('supplier', '/app/supplier/dashboard');

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByTestId('area-header')).toHaveTextContent('Portale fornitori');
    expect(within(drawer).queryByTestId('area-switcher')).not.toBeInTheDocument();
    // Supplier: one destination of the bar less (Vetrina is in the bar), "Altro" holds the profile and the guide.
    expect(within(drawer).getAllByRole('link').map((link) => link.textContent)).toEqual(['Profilo', 'Guida iCal']);
  });

  it('MobileNavDrawer_ChoosingAPage_ClosesTheDrawer', () => {
    arrange(['short-rent']);
    renderDrawer('short-rent');

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Incassi' }));

    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('MobileNavDrawer_PageOfTheMenu_IsMarkedCurrent', () => {
    arrange(['short-rent']);
    renderDrawer('short-rent', '/app/short-rent/payments');

    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Incassi' })).toHaveAttribute('aria-current', 'page');
  });
});

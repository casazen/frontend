import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { useUiStore } from '@/store/ui-store';
import { BottomNav } from '../bottom-nav';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: vi.fn() }));

import { useWorkspace } from '@/hooks/use-workspace';
import { useNavCounts } from '@/hooks/use-nav-counts';

function arrange(
  contextKeys: AppContextKey[] = ['short-rent'],
  hasPermission: (ctx: AppContextKey, permission: string) => boolean = () => true,
) {
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
    hasPermission,
    getDefaultRoute: (key) => `/app/${key}`,
  });
}

function renderBar(contextKey: AppContextKey, path = `/app/${contextKey}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav contextKey={contextKey} />
    </MemoryRouter>,
  );
}

const bar = () => screen.getByRole('navigation', { name: 'Navigazione mobile' });
const labels = () => within(bar()).getAllByRole('link').map((link) => link.textContent);
const more = () => within(bar()).getByRole('button', { name: 'Altro' });

describe('BottomNav (UI-04b)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useUiStore.setState({ sidebarOpen: false, bottomBarVisible: false });
    vi.mocked(useNavCounts).mockReturnValue({});
    arrange();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ sidebarOpen: false, bottomBarVisible: false });
  });

  describe('destinations', () => {
    it('BottomNav_ShortRent_ListsTheFourDestinationsAndAltroNotEveryMainEntryOfTheMenu', () => {
      renderBar('short-rent');

      expect(labels()).toEqual(['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili']);
      expect(more()).toBeInTheDocument();
      for (const name of ['Sito di prenotazione', 'Marketplace', 'Incassi']) {
        expect(within(bar()).queryByRole('link', { name })).not.toBeInTheDocument();
      }
    });

    it('BottomNav_ShortRent_LinksToTheRealRoutes', () => {
      renderBar('short-rent');

      expect(within(bar()).getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings');
      expect(within(bar()).getByRole('link', { name: 'Immobili' })).toHaveAttribute('href', '/app/short-rent/properties');
    });

    it('BottomNav_EveryArea_KeepsToFourDestinationsAtMost', () => {
      arrange(['admin']);
      renderBar('admin');
      expect(labels()).toEqual(['Cruscotto', 'Utenti', 'Fornitori', 'Processi']);
      cleanup();

      arrange(['supplier']);
      renderBar('supplier', '/app/supplier/dashboard');
      expect(labels()).toEqual(['Dashboard', 'Richieste', 'Disponibilità', 'Vetrina']);
    });

    it('BottomNav_LongRent_ListsTheTwoDestinationsItHasAndAltro', () => {
      arrange(['long-rent']);
      renderBar('long-rent', '/app/long-rent/leases');

      expect(labels()).toEqual(['Contratti', 'Immobili']);
      expect(more()).toBeInTheDocument();
    });

    it('BottomNav_UserWithoutAPermission_DoesNotSeeTheDestinationThatAsksForIt', () => {
      arrange(['short-rent'], (_ctx, permission) => permission !== 'property.read');
      renderBar('short-rent');

      expect(labels()).toEqual(['Cruscotto', 'Calendario', 'Prenotazioni']);
    });

    it('BottomNav_NoDestinationForTheUser_ShowsNoBar', () => {
      arrange(['admin'], () => false);
      const { container } = renderBar('admin');

      expect(container).toBeEmptyDOMElement();
    });

    it('BottomNav_EnglishUi_UsesTheEnglishNames', async () => {
      await i18n.changeLanguage('en');
      renderBar('short-rent');

      const englishBar = screen.getByRole('navigation', { name: 'Mobile navigation' });
      expect(within(englishBar).getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Dashboard',
        'Calendar',
        'Bookings',
        'Properties',
      ]);
      expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    });
  });

  describe('the open page', () => {
    it('BottomNav_PageOfADestination_IsTheOnlyTabMarkedCurrent', () => {
      renderBar('short-rent', '/app/short-rent/bookings/abc');

      expect(within(bar()).getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('aria-current', 'page');
      for (const name of ['Cruscotto', 'Calendario', 'Immobili']) {
        expect(within(bar()).getByRole('link', { name })).not.toHaveAttribute('aria-current');
      }
      expect(more()).not.toHaveAttribute('aria-current');
    });

    it('BottomNav_CalendarPage_MarksCalendarNotBookings', () => {
      renderBar('short-rent', '/app/short-rent/bookings/calendar');

      expect(within(bar()).getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page');
      expect(within(bar()).getByRole('link', { name: 'Prenotazioni' })).not.toHaveAttribute('aria-current');
    });

    it('BottomNav_PageOfTheEntry_MarksTheDestinationItHangsFrom', () => {
      // The iCal calendar of the supplier hangs from the availability, which is a destination of the bar.
      arrange(['supplier']);
      renderBar('supplier', '/app/supplier/calendar');

      expect(within(bar()).getByRole('link', { name: 'Disponibilità' })).toHaveAttribute('aria-current', 'page');
      expect(more()).not.toHaveAttribute('aria-current');
    });

    it('BottomNav_PageTheBarDoesNotList_MarksAltro', () => {
      // Incassi is a main entry of the menu but not one of the four destinations of the bar.
      renderBar('short-rent', '/app/short-rent/payments');

      expect(more()).toHaveAttribute('aria-current', 'page');
      for (const link of within(bar()).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
      }
    });

    it('BottomNav_PageThatHangsFromAnEntryOfAltro_MarksAltro', () => {
      renderBar('short-rent', '/app/short-rent/alloggiati');

      expect(more()).toHaveAttribute('aria-current', 'page');
    });

    it('BottomNav_PageInNoMenu_MarksAltroNotTheFirstTab', () => {
      // Plan and billing are in no menu (they are reached from the badge of the organization).
      renderBar('short-rent', '/app/short-rent/settings/plan');

      expect(more()).toHaveAttribute('aria-current', 'page');
      expect(within(bar()).getByRole('link', { name: 'Cruscotto' })).not.toHaveAttribute('aria-current');
      cleanup();

      arrange(['long-rent']);
      renderBar('long-rent', '/app/long-rent/settings/billing');

      expect(more()).toHaveAttribute('aria-current', 'page');
      for (const link of within(bar()).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
      }
    });
  });

  describe('"Altro"', () => {
    it('BottomNav_Altro_IsAButtonThatOpensADialogAndIsClosedAtFirst', () => {
      renderBar('short-rent');

      expect(more()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(more()).toHaveAttribute('aria-expanded', 'false');
      expect(more()).toHaveAttribute('type', 'button');
    });

    it('BottomNav_ClickOnAltro_OpensTheSheet', () => {
      renderBar('short-rent');

      fireEvent.click(more());

      expect(useUiStore.getState().sidebarOpen).toBe(true);
      expect(more()).toHaveAttribute('aria-expanded', 'true');
    });

    it('BottomNav_ClickOnAltroTwice_KeepsItOpen', () => {
      renderBar('short-rent');

      fireEvent.click(more());
      fireEvent.click(more());

      expect(useUiStore.getState().sidebarOpen).toBe(true);
    });

    it('BottomNav_OpenSheet_DoesNotMakeAltroTheCurrentPage', () => {
      renderBar('short-rent', '/app/short-rent');
      fireEvent.click(more());

      // `aria-current` says where the user is, `aria-expanded` that the sheet is open.
      expect(more()).toHaveAttribute('aria-expanded', 'true');
      expect(more()).not.toHaveAttribute('aria-current');
      expect(within(bar()).getByRole('link', { name: 'Cruscotto' })).toHaveAttribute('aria-current', 'page');
    });

    it('BottomNav_Mounted_ClosesASheetLeftOpenByThePreviousPage', () => {
      useUiStore.setState({ sidebarOpen: true });
      renderBar('short-rent');

      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe('counters', () => {
    it('BottomNav_RequestsWaiting_ShowTheCountOnTheIconAndSayItAloud', () => {
      vi.mocked(useNavCounts).mockReturnValue({ bookingRequests: 2 });
      renderBar('short-rent');

      const bookings = within(bar()).getByRole('link', { name: /Prenotazioni/ });
      expect(within(bookings).getByTestId('nav-count')).toHaveTextContent('2');
      expect(bookings).toHaveAccessibleName('Prenotazioni, 2 richieste da approvare');
      // The other tabs have none.
      expect(screen.getAllByTestId('nav-count')).toHaveLength(1);
    });

    it('BottomNav_Supplier_ShowsTheRequestsToAcceptOnRichieste', () => {
      arrange(['supplier']);
      vi.mocked(useNavCounts).mockReturnValue({ supplierRequests: 3 });
      renderBar('supplier', '/app/supplier/dashboard');

      expect(within(bar()).getByRole('link', { name: /Richieste/ })).toHaveAccessibleName('Richieste, 3 richieste da accettare');
    });

    it('BottomNav_NothingWaiting_ShowsNoCount', () => {
      vi.mocked(useNavCounts).mockReturnValue({ bookingRequests: 0 });
      renderBar('short-rent');

      expect(screen.queryByTestId('nav-count')).not.toBeInTheDocument();
    });

    it('BottomNav_AsksForTheCountOfTheDestinationsOfTheBar', () => {
      renderBar('short-rent');

      const entries = vi.mocked(useNavCounts).mock.calls[0][0];
      expect(entries.map((entry) => entry.path)).toEqual([
        '/app/short-rent',
        '/app/short-rent/bookings/calendar',
        '/app/short-rent/bookings',
        '/app/short-rent/properties',
      ]);
    });
  });

  describe('look', () => {
    it('BottomNav_Rendered_IsFixedToTheBottomEdgeOfThePhoneAndHiddenFromTablet', () => {
      renderBar('short-rent');

      expect(bar()).toHaveClass('fixed', 'inset-x-0', 'bottom-0', 'md:hidden');
    });

    it('BottomNav_Rendered_IsTallEnoughForTheHomeIndicatorOfThePhone', () => {
      renderBar('short-rent');

      // The bar is its own height plus the safe area, and its tabs keep the 64 px above it.
      expect(bar().style.height).toBe('calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))');
      expect(bar().firstElementChild).toHaveClass('pb-[env(safe-area-inset-bottom)]');
    });

    it('BottomNav_EveryTab_IsATouchTargetAsTallAsTheBar', () => {
      renderBar('short-rent');

      for (const tab of [...within(bar()).getAllByRole('link'), more()]) {
        expect(tab).toHaveClass('min-h-11', 'flex-1');
      }
    });

    it('BottomNav_Labels_FitAColumnOfAPhoneInsteadOfBeingCut', () => {
      renderBar('short-rent');

      const tab = within(bar()).getByRole('link', { name: 'Prenotazioni' });
      // 11 px semibold (10 px under 340 px), one line, and an ellipsis only as a last resort.
      expect(tab).toHaveClass('text-[11px]', 'max-[340px]:text-[10px]');
      expect(within(tab).getByText('Prenotazioni')).toHaveClass('truncate');
    });

    it('BottomNav_CurrentTab_HasTheAccentLineAndThePill', () => {
      renderBar('short-rent', '/app/short-rent/properties');

      const current = within(bar()).getByRole('link', { name: 'Immobili' });
      expect(current.querySelector('span[aria-hidden="true"].bg-primary')).not.toBeNull();
      expect(current.querySelector('span.bg-primary\\/10')).not.toBeNull();
      const other = within(bar()).getByRole('link', { name: 'Calendario' });
      expect(other.querySelector('span.bg-primary')).toBeNull();
    });
  });

  describe('toasts', () => {
    it('BottomNav_OnThePage_SaysItIsThereSoThatTheToastsComeUpAboveIt', () => {
      const { unmount } = renderBar('short-rent');

      expect(useUiStore.getState().bottomBarVisible).toBe(true);

      // Nothing is left behind when the bar goes (a page with no bar).
      unmount();
      expect(useUiStore.getState().bottomBarVisible).toBe(false);
    });

    it('BottomNav_NoBar_LeavesTheToastsWhereTheyWere', () => {
      arrange(['admin'], () => false);
      renderBar('admin');

      expect(useUiStore.getState().bottomBarVisible).toBe(false);
    });

    it('BottomNav_UserLosesTheDestinations_TheBarGoesAndSoDoesTheFlag', () => {
      arrange(['admin']);
      const { rerender } = renderBar('admin');
      expect(useUiStore.getState().bottomBarVisible).toBe(true);

      arrange(['admin'], () => false);
      rerender(
        <MemoryRouter initialEntries={['/app/admin']}>
          <BottomNav contextKey="admin" />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('navigation', { name: 'Navigazione mobile' })).not.toBeInTheDocument();
      expect(useUiStore.getState().bottomBarVisible).toBe(false);
    });
  });
});

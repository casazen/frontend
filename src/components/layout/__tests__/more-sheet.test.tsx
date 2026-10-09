import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { useUiStore } from '@/store/ui-store';
import { stubViewportWidth } from '@/test/viewport';
import { MoreSheet } from '../more-sheet';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));

import { useWorkspace } from '@/hooks/use-workspace';
import { useNavCounts } from '@/hooks/use-nav-counts';
import { useAuth } from '@/hooks/use-auth';

const logout = vi.fn();

function arrange(contextKeys: AppContextKey[], hasPermission: (ctx: AppContextKey, permission: string) => boolean = () => true) {
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

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

/** The sheet next to a stand-in for the "Altro" button of the bar, which the sheet gives the focus back to. */
function renderSheet(contextKey: AppContextKey, path = `/app/${contextKey}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <button type="button" data-more-trigger="">
        Altro (barra)
      </button>
      <button type="button">Menu (testata)</button>
      <MoreSheet contextKey={contextKey} organizationName="Casa Rossi Srl" />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const open = () => act(() => useUiStore.setState({ sidebarOpen: true }));
const sheet = () => screen.getByRole('dialog', { name: 'Altro' });
const tiles = (container: HTMLElement) => within(container).getAllByRole('link').map((link) => link.textContent);

describe('MoreSheet (UI-04b)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useUiStore.setState({ sidebarOpen: false });
    vi.mocked(useNavCounts).mockReturnValue({});
    vi.mocked(useAuth).mockReturnValue({ user: { name: 'Mario Rossi', email: 'mario@example.com' }, logout } as unknown as ReturnType<typeof useAuth>);
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useUiStore.setState({ sidebarOpen: false });
  });

  describe('what it shows', () => {
    it('MoreSheet_Closed_ShowsNothing', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('MoreSheet_Open_IsAModalDialogFromTheBottomNamedAltro', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      expect(sheet()).toHaveAttribute('data-sheet-side', 'bottom');
      expect(sheet()).toHaveAttribute('data-testid', 'more-sheet');
      // Phone only: from the tablet the sidebar takes over.
      expect(sheet()).toHaveClass('md:hidden');
      // The title names it; nothing else describes it.
      expect(sheet()).not.toHaveAttribute('aria-describedby');
      expect(within(sheet()).getByRole('heading', { name: 'Altro' })).toBeInTheDocument();
    });

    it('MoreSheet_ShortRent_ListsWhatTheBarDoesNotInTheGroupsOfTheSidebar', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      const nav = within(sheet()).getByRole('navigation', { name: 'Menu Affitti brevi' });
      const groups = within(nav).getAllByRole('group');
      expect(groups.map((group) => group.getAttribute('data-testid'))).toEqual(['nav-group-offer', 'nav-group-management', 'nav-group-more']);
      expect(groups[0]).toHaveAccessibleName('La tua offerta');
      expect(tiles(groups[0])).toEqual(['Sito di prenotazione', 'Marketplace']);
      expect(groups[1]).toHaveAccessibleName('Gestione');
      expect(tiles(groups[1])).toEqual(['Incassi']);
      expect(groups[2]).toHaveAccessibleName('Altro');
      expect(tiles(groups[2])).toEqual([
        'Ospiti',
        'Adempimenti',
        'Ricavi',
        'Regime fiscale',
        'Profilo',
        'Stripe Connect',
        'Dominio pubblico',
        'Organizzazione',
      ]);
      // The destinations of the bar are not repeated.
      for (const name of ['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili']) {
        expect(within(sheet()).queryByRole('link', { name })).not.toBeInTheDocument();
      }
    });

    it('MoreSheet_Tiles_LeadToTheRealRoutes', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      expect(within(sheet()).getByRole('link', { name: 'Incassi' })).toHaveAttribute('href', '/app/short-rent/payments');
      expect(within(sheet()).getByRole('link', { name: 'Stripe Connect' })).toHaveAttribute('href', '/app/short-rent/settings/payments');
    });

    it('MoreSheet_AreaWithJustAltro_HasNoGroupHeadings', () => {
      arrange(['long-rent']);
      renderSheet('long-rent', '/app/long-rent/leases');

      open();

      expect(tiles(sheet())).toEqual(['Profilo', 'Organizzazione']);
      // One group needs no name on the screen (the title says it), and still has one for a screen reader.
      expect(within(sheet()).getByRole('group', { name: 'Altro' })).toBeInTheDocument();
      expect(within(sheet()).queryByText('Altro', { selector: 'p' })).not.toBeInTheDocument();
    });

    it('MoreSheet_PageOfTheSheet_IsMarkedCurrent', () => {
      arrange(['short-rent']);
      renderSheet('short-rent', '/app/short-rent/payments');

      open();

      expect(within(sheet()).getByRole('link', { name: 'Incassi' })).toHaveAttribute('aria-current', 'page');
      expect(within(sheet()).getByRole('link', { name: 'Marketplace' })).not.toHaveAttribute('aria-current');
    });

    it('MoreSheet_EnglishUi_ShowsTheEnglishNames', async () => {
      await i18n.changeLanguage('en');
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      const english = screen.getByRole('dialog', { name: 'More' });
      expect(within(english).getByRole('group', { name: 'Your offer' })).toBeInTheDocument();
      expect(within(english).getByRole('link', { name: 'Booking site' })).toBeInTheDocument();
    });
  });

  describe('area', () => {
    it('MoreSheet_OneArea_ShowsWhereTheUserIsWithoutASwitcher', () => {
      arrange(['supplier']);
      renderSheet('supplier', '/app/supplier/dashboard');

      open();

      const heading = within(sheet()).getByTestId('area-header');
      expect(heading).toHaveTextContent('Portale fornitori');
      expect(heading).toHaveTextContent('Casa Rossi Srl');
      expect(within(sheet()).queryByTestId('area-switcher')).not.toBeInTheDocument();
      // The supplier keeps the profile and the iCal guide in "Altro".
      expect(tiles(sheet())).toEqual(['Profilo', 'Guida iCal']);
    });

    it('MoreSheet_SeveralAreas_HasTheAreaSwitcher', () => {
      arrange(['short-rent', 'long-rent']);
      renderSheet('short-rent');

      open();

      expect(within(sheet()).getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' })).toHaveAttribute('aria-haspopup', 'menu');
      expect(within(sheet()).queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  describe('account (UI-05)', () => {
    // The sheet lists the page "Profilo" among its tiles too: the account is looked at on its own.
    const account = () => within(screen.getByTestId('sheet-account'));
    const accountRow = () => account().getByRole('button', { name: /Mario Rossi/ });

    it('MoreSheet_Open_EndsWithOneRowForTheProfileAndTheLanguage', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      // The row of the demo ("Profilo, tema e lingua") without the theme, which does not exist yet (D26).
      expect(accountRow()).toHaveTextContent('Profilo e lingua');
      expect(accountRow()).toHaveAttribute('aria-expanded', 'false');
      // Closed, what is inside is not reachable.
      expect(account().queryByRole('link', { name: 'Profilo' })).not.toBeInTheDocument();
      expect(account().queryByRole('button', { name: 'Esci' })).not.toBeInTheDocument();
      expect(account().getByTestId('language-switcher')).not.toBeVisible();
    });

    it('MoreSheet_AccountRowOpened_OffersProfileLanguageAndLogout', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      fireEvent.click(accountRow());

      expect(accountRow()).toHaveAttribute('aria-expanded', 'true');
      expect(account().getByRole('link', { name: 'Profilo' })).toHaveAttribute('href', '/app/short-rent/profile');
      const language = account().getByRole('group', { name: 'Lingua' });
      expect(within(language).getByRole('button', { name: "Passa all'italiano" })).toHaveAttribute('aria-pressed', 'true');
      expect(within(language).getByRole('button', { name: "Passa all'inglese" })).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(account().getByRole('button', { name: 'Esci' }));
      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('MoreSheet_LanguageButtons_AreAtLeast44PixelsForAFinger', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();
      fireEvent.click(accountRow());

      for (const name of ["Passa all'italiano", "Passa all'inglese"]) {
        expect(account().getByRole('button', { name })).toHaveClass('min-h-11', 'min-w-11');
      }
    });

    it('MoreSheet_ChoosingEnglish_ChangesTheLanguageAndKeepsTheChoice', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();
      fireEvent.click(accountRow());

      fireEvent.click(account().getByRole('button', { name: "Passa all'inglese" }));

      await waitFor(() => expect(i18n.language).toBe('en'));
      expect(localStorage.getItem('casazen.locale')).toBe('en');
      expect(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: /Profile and language/ })).toBeInTheDocument();
    });

    it('MoreSheet_ProfileLink_ClosesTheSheetAndOpensTheProfileOfTheArea', () => {
      arrange(['supplier']);
      renderSheet('supplier', '/app/supplier/dashboard');
      open();
      fireEvent.click(accountRow());

      fireEvent.click(account().getByRole('link', { name: 'Profilo' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/app/supplier/profile');
    });

    it('MoreSheet_NoUser_HasNoAccountRow', () => {
      vi.mocked(useAuth).mockReturnValue({ user: undefined, logout } as unknown as ReturnType<typeof useAuth>);
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      expect(within(sheet()).queryByTestId('sheet-account')).not.toBeInTheDocument();
    });
  });

  describe('closing', () => {
    it('MoreSheet_ChoosingAPage_ClosesItAndOpensThePage', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      fireEvent.click(within(sheet()).getByRole('link', { name: 'Incassi' }));

      expect(useUiStore.getState().sidebarOpen).toBe(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/payments');
    });

    it('MoreSheet_Escape_Closes', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      fireEvent.keyDown(sheet(), { key: 'Escape' });

      expect(useUiStore.getState().sidebarOpen).toBe(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('MoreSheet_CloseButton_Closes', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      fireEvent.click(within(sheet()).getByRole('button', { name: 'Chiudi' }));

      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });

    it('MoreSheet_WindowGrowsToATablet_ClosesItBecauseTheSidebarTakesOver', () => {
      const viewport = stubViewportWidth(390);
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();
      expect(sheet()).toBeInTheDocument();

      act(() => viewport.resize(820));

      expect(useUiStore.getState().sidebarOpen).toBe(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('MoreSheet_PhoneTurnedSideways_StaysOpenWhileTheWindowIsStillANarrowOne', () => {
      const viewport = stubViewportWidth(390);
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      act(() => viewport.resize(700));

      expect(sheet()).toBeInTheDocument();
    });
  });

  describe('focus', () => {
    it('MoreSheet_Opened_TakesTheFocusItselfNotTheCloseButton', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');

      open();

      // The first control would be the close button, which would show its ring at every tap on "Altro".
      expect(sheet()).toHaveFocus();
      expect(sheet()).toHaveClass('outline-none');
    });

    it('MoreSheet_ClosedWithEscape_GivesTheFocusBackToWhatOpenedIt', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      const opener = screen.getByRole('button', { name: 'Menu (testata)' });
      act(() => opener.focus());
      open();
      expect(sheet()).toHaveFocus();

      fireEvent.keyDown(sheet(), { key: 'Escape' });

      await waitFor(() => expect(opener).toHaveFocus());
    });

    it('MoreSheet_OpenerTookNoFocus_TheFocusGoesBackToAltroOfTheBar', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      // A tap on Safari does not focus a button: nothing has the focus when the sheet opens.
      expect(document.body).toHaveFocus();
      open();

      fireEvent.keyDown(sheet(), { key: 'Escape' });

      await waitFor(() => expect(screen.getByRole('button', { name: 'Altro (barra)' })).toHaveFocus());
    });

    it('MoreSheet_ClosedWithTheCloseButton_GivesTheFocusBack', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      const bar = screen.getByRole('button', { name: 'Altro (barra)' });
      act(() => bar.focus());
      open();

      fireEvent.click(within(sheet()).getByRole('button', { name: 'Chiudi' }));

      await waitFor(() => expect(bar).toHaveFocus());
    });

    it('MoreSheet_ClosedByChoosingAPage_LeavesTheFocusToTheNewPage', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      const bar = screen.getByRole('button', { name: 'Altro (barra)' });
      act(() => bar.focus());
      open();

      fireEvent.click(within(sheet()).getByRole('link', { name: 'Incassi' }));
      // Radix gives the focus back one tick after the sheet is gone: wait for it not to.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });

      // `RouteFocus` moves the focus to the heading of the new page; the bar must not take it.
      expect(bar).not.toHaveFocus();
    });

    it('MoreSheet_TileOfThePageAlreadyOpen_GivesTheFocusBackSinceNothingChanged', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent', '/app/short-rent/payments');
      const bar = screen.getByRole('button', { name: 'Altro (barra)' });
      act(() => bar.focus());
      open();

      fireEvent.click(within(sheet()).getByRole('link', { name: 'Incassi' }));

      // Same page: no heading to take the focus, so it goes back to where it was.
      await waitFor(() => expect(bar).toHaveFocus());
      expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/payments');
    });

    it('MoreSheet_OpenedAgain_NotesTheNewOpener', async () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      const bar = screen.getByRole('button', { name: 'Altro (barra)' });
      const header = screen.getByRole('button', { name: 'Menu (testata)' });
      act(() => bar.focus());
      open();
      fireEvent.keyDown(sheet(), { key: 'Escape' });
      await waitFor(() => expect(bar).toHaveFocus());

      act(() => header.focus());
      open();
      fireEvent.keyDown(sheet(), { key: 'Escape' });

      await waitFor(() => expect(header).toHaveFocus());
    });
  });

  describe('with what the sheet lists', () => {
    it('MoreSheet_AsksForTheCountsOfTheEntriesOfTheMenu', () => {
      arrange(['short-rent']);
      renderSheet('short-rent');
      open();

      expect(useNavCounts).toHaveBeenCalled();
      const entries = vi.mocked(useNavCounts).mock.calls[0][0];
      expect(entries.some((entry) => entry.navCount === 'bookingRequests')).toBe(true);
    });

    it('MoreSheet_UserWithoutAPermission_DoesNotSeeTheTileThatAsksForIt', () => {
      arrange(['short-rent'], (_ctx, permission) => permission !== 'payment.read');
      renderSheet('short-rent');

      open();

      expect(within(sheet()).queryByRole('link', { name: 'Incassi' })).not.toBeInTheDocument();
      expect(within(sheet()).getByRole('link', { name: 'Marketplace' })).toBeInTheDocument();
    });
  });
});

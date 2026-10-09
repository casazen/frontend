import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { tabTo } from '@/test/keyboard';
import {
  getContextNav,
  getNavMatchEntries,
  type AppContextKey,
  type PermissionPredicate,
} from '@/config/route-manifest';
import type { NavCounts } from '@/hooks/use-nav-counts';
import { GroupedNavLinks } from '../grouped-nav-links';

const allowAll: PermissionPredicate = () => true;

interface Options {
  contextKey?: AppContextKey;
  variant?: 'sidebar' | 'sheet';
  collapsed?: boolean;
  counts?: NavCounts;
  hasPermission?: PermissionPredicate;
  onNavigate?: () => void;
}

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderNav(path: string, options: Options = {}) {
  const { contextKey = 'short-rent', variant = 'sidebar', hasPermission = allowAll, ...rest } = options;
  const nav = getContextNav(contextKey, hasPermission, {}, { withoutBottom: variant === 'sheet' });
  const matchEntries = getNavMatchEntries(contextKey, hasPermission, {});
  return render(
    <MemoryRouter initialEntries={[path]}>
      <nav>
        <GroupedNavLinks nav={nav} matchEntries={matchEntries} variant={variant} {...rest} />
      </nav>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const link = (name: string | RegExp) => screen.getByRole('link', { name });

describe('GroupedNavLinks (UI-04a, UI-04b)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('main menu', () => {
    it('GroupedNavLinks_ShortRent_ShowsTheNamedGroupsWithTheirEntries', () => {
      renderNav('/app/short-rent');

      // The heading is the name of the group (aria-labelledby): the screen reader does not hear it twice.
      expect(screen.getByRole('group', { name: 'Ogni giorno' })).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('group', { name: 'Ogni giorno' })).not.toHaveAttribute('aria-label');
      const everyday = screen.getByRole('group', { name: 'Ogni giorno' });
      expect(within(everyday).getAllByRole('link').map((item) => item.textContent)).toEqual(['Cruscotto', 'Calendario', 'Prenotazioni']);
      const offer = screen.getByRole('group', { name: 'La tua offerta' });
      expect(within(offer).getAllByRole('link').map((item) => item.textContent)).toEqual(['Immobili', 'Sito di prenotazione', 'Marketplace']);
      const management = screen.getByRole('group', { name: 'Gestione' });
      expect(within(management).getAllByRole('link').map((item) => item.textContent)).toEqual(['Incassi']);
      // The names of the groups are on the screen too.
      expect(screen.getByText('Ogni giorno')).toBeVisible();
      expect(screen.getByText('La tua offerta')).toBeVisible();
      expect(screen.getByText('Gestione')).toBeVisible();
    });

    it('GroupedNavLinks_EnglishUi_ShowsTheEnglishGroupsAndEntries', async () => {
      await i18n.changeLanguage('en');
      renderNav('/app/short-rent');

      expect(screen.getByRole('group', { name: 'Every day' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Your offer' })).toBeInTheDocument();
      expect(link('Properties')).toHaveAttribute('href', '/app/short-rent/properties');
      expect(link('Booking site')).toHaveAttribute('href', '/app/short-rent/vetrina');
    });

    it('GroupedNavLinks_SingleGroup_HasNoGroupHeading', () => {
      // The staff console has one group: a heading would only repeat the area. The group still has a name for screen readers.
      renderNav('/app/admin', { contextKey: 'admin' });

      expect(screen.getByRole('group', { name: 'Piattaforma' })).toBeInTheDocument();
      expect(screen.queryByText('Piattaforma')).not.toBeInTheDocument();
      expect(link('Utenti')).toHaveAttribute('href', '/app/admin/users');
    });

    it('GroupedNavLinks_OpenPage_IsTheOnlyEntryMarkedCurrent', () => {
      renderNav('/app/short-rent/bookings/abc');

      expect(link('Prenotazioni')).toHaveAttribute('aria-current', 'page');
      for (const name of ['Cruscotto', 'Calendario', 'Immobili', 'Sito di prenotazione', 'Marketplace', 'Incassi']) {
        expect(link(name)).not.toHaveAttribute('aria-current');
      }
    });

    it('GroupedNavLinks_CalendarPage_HighlightsCalendarNotBookings', () => {
      renderNav('/app/short-rent/bookings/calendar');

      expect(link('Calendario')).toHaveAttribute('aria-current', 'page');
      expect(link('Prenotazioni')).not.toHaveAttribute('aria-current');
    });

    it('GroupedNavLinks_CurrentEntry_HasTheAccentBarAndTheAccentColors', () => {
      renderNav('/app/short-rent/properties');

      const current = link('Immobili');
      expect(current).toHaveClass('bg-primary/10');
      // The bar next to the current entry (decorative); the other entries have none.
      expect(current.querySelector('span[aria-hidden="true"].bg-primary')).not.toBeNull();
      expect(link('Calendario').querySelector('span.bg-primary')).toBeNull();
    });

    it('GroupedNavLinks_ClickOnAnEntry_GoesToItsPage', () => {
      renderNav('/app/short-rent');

      fireEvent.click(link('Incassi'));

      expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/payments');
      expect(link('Incassi')).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('counters', () => {
    it('GroupedNavLinks_EntryWithRequests_ShowsTheCountAndSaysItAloud', () => {
      renderNav('/app/short-rent', { counts: { bookingRequests: 2 } });

      const bookings = link(/Prenotazioni/);
      expect(within(bookings).getByTestId('nav-count')).toHaveTextContent('2');
      expect(bookings).toHaveAccessibleName('Prenotazioni, 2 richieste da approvare');
    });

    it('GroupedNavLinks_OneRequest_UsesTheSingular', () => {
      renderNav('/app/short-rent', { counts: { bookingRequests: 1 } });

      expect(link(/Prenotazioni/)).toHaveAccessibleName('Prenotazioni, 1 richiesta da approvare');
    });

    it('GroupedNavLinks_NothingWaiting_ShowsNoCounter', () => {
      renderNav('/app/short-rent', { counts: { bookingRequests: 0 } });

      expect(screen.queryByTestId('nav-count')).not.toBeInTheDocument();
      expect(link('Prenotazioni')).toBeInTheDocument();
    });

    it('GroupedNavLinks_NoCountYet_ShowsNoCounter', () => {
      renderNav('/app/short-rent');

      expect(screen.queryByTestId('nav-count')).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_ManyRequests_CapsTheNumberButNotTheSpokenOne', () => {
      renderNav('/app/short-rent', { counts: { bookingRequests: 120 } });

      const pill = screen.getByTestId('nav-count');
      expect(pill.querySelector('[aria-hidden="true"]')).toHaveTextContent('99+');
      expect(pill).toHaveTextContent('120 richieste da approvare');
    });

    it('GroupedNavLinks_Supplier_CountsTheRequestsToAccept', () => {
      renderNav('/app/supplier/dashboard', { contextKey: 'supplier', counts: { supplierRequests: 4 } });

      expect(link(/Richieste/)).toHaveAccessibleName('Richieste, 4 richieste da accettare');
      expect(within(link('Dashboard')).queryByTestId('nav-count')).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_CounterOfAnotherEntry_IsNotShownHere', () => {
      renderNav('/app/short-rent', { counts: { supplierRequests: 9 } });

      expect(screen.queryByTestId('nav-count')).not.toBeInTheDocument();
    });
  });

  describe('"Altro"', () => {
    it('GroupedNavLinks_MoreMenu_IsClosedWhileTheOpenPageIsNotInIt', () => {
      renderNav('/app/short-rent');

      const toggle = screen.getByRole('button', { name: 'Altro' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: 'Ospiti' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Profilo' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_MoreMenu_OpensOnClickAndShowsTheOtherEntries', () => {
      renderNav('/app/short-rent');

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      const more = screen.getByTestId('nav-more');
      expect(within(more).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Ospiti',
        'Adempimenti',
        'Ricavi',
        'Regime fiscale',
        'Profilo',
        'Stripe Connect',
        'Dominio pubblico',
        'Organizzazione',
      ]);
      // The button controls the list it opens.
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-controls', within(more).getByRole('list').id);
    });

    it('GroupedNavLinks_PageInsideMoreMenu_OpensItAndMarksTheEntry', () => {
      renderNav('/app/short-rent/guests/g1');

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(link('Ospiti')).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_PageThatHangsFromAnEntryOfMore_OpensItAndMarksThatEntry', () => {
      renderNav('/app/short-rent/alloggiati');

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(link('Adempimenti')).toHaveAttribute('aria-current', 'page');
      // The page is in no menu, only the entry it hangs from is.
      expect(screen.queryByRole('link', { name: 'Alloggiati' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_UserClosesTheMenu_ItStaysClosedUntilThePageChanges', () => {
      renderNav('/app/short-rent/guests');
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: 'Ospiti' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_ChoiceOfTheUser_ValidOnlyForThePageItWasMadeOn', () => {
      renderNav('/app/short-rent');
      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');

      // A page outside "Altro": back to the default, closed.
      fireEvent.click(link('Incassi'));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');

      // A page inside it: open again.
      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      fireEvent.click(link('Profilo'));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(link('Profilo')).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_NoEntryForTheUser_HasNoMoreMenu', () => {
      // A user who may open nothing of "Altro" (no permission at all, not even the org billing administrator one).
      renderNav('/app/supplier/dashboard', { contextKey: 'supplier', hasPermission: (_ctx, permission) => !permission });

      // Profile and the iCal guide ask no permission: "Altro" is there. For a context where nothing is left, it is not.
      expect(screen.getByRole('button', { name: 'Altro' })).toBeInTheDocument();
      cleanup();
      renderNav('/app/admin', { contextKey: 'admin', hasPermission: () => false });
      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
    });
  });

  describe('sidebar reduced to the icons', () => {
    it('GroupedNavLinks_Collapsed_KeepsTheNamesForScreenReaders', () => {
      renderNav('/app/short-rent', { collapsed: true });

      const dashboard = link('Cruscotto');
      expect(within(dashboard).getByText('Cruscotto')).toHaveClass('sr-only');
      expect(dashboard).toHaveClass('justify-center');
      // No group names, but the groups stay separate for screen readers.
      expect(screen.queryByText('Ogni giorno')).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Ogni giorno' })).toBeInTheDocument();
    });

    it('GroupedNavLinks_Collapsed_StillSaysHowManyRequestsAreWaiting', () => {
      renderNav('/app/short-rent', { collapsed: true, counts: { bookingRequests: 3 } });

      expect(link(/Prenotazioni/)).toHaveAccessibleName('Prenotazioni, 3 richieste da approvare');
    });

    it('GroupedNavLinks_Collapsed_ShowsTheNameOfAnIconOnKeyboardFocusAndOnHover', () => {
      renderNav('/app/short-rent', { collapsed: true });

      tabTo(link('Calendario'));
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Calendario');

      act(() => link('Calendario').blur());
      expect(screen.queryByTestId('rail-tooltip')).not.toBeInTheDocument();

      fireEvent.pointerEnter(link('Immobili'), { pointerType: 'mouse' });
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Immobili');
    });

    it('GroupedNavLinks_Collapsed_NoLongerRelyOnTheTitleAttribute', () => {
      // The `title` of UI-04a showed on hover only and then twice, next to the tooltip: the tooltip is the one.
      renderNav('/app/short-rent', { collapsed: true });

      expect(link('Cruscotto')).not.toHaveAttribute('title');
      expect(screen.getByRole('button', { name: 'Altro' })).not.toHaveAttribute('title');
    });

    it('GroupedNavLinks_Collapsed_AltroHasItsNameAsATooltipToo', () => {
      renderNav('/app/short-rent', { collapsed: true });

      tabTo(screen.getByRole('button', { name: 'Altro' }));

      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Altro');
    });

    it('GroupedNavLinks_Collapsed_AltroStillOpensAndItsEntriesHaveTooltipsToo', () => {
      renderNav('/app/short-rent', { collapsed: true });

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      tabTo(link('Ospiti'));

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Ospiti');
    });

    it('GroupedNavLinks_Expanded_ShowsNoTooltipSinceTheNamesAreOnTheScreen', () => {
      renderNav('/app/short-rent');

      tabTo(link('Calendario'));
      fireEvent.pointerEnter(link('Immobili'), { pointerType: 'mouse' });

      expect(screen.queryByTestId('rail-tooltip')).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_Collapsed_CounterStaysOnTheCornerOfTheIcon', () => {
      renderNav('/app/short-rent', { collapsed: true, counts: { bookingRequests: 3 } });

      expect(screen.getByTestId('nav-count')).toHaveClass('absolute', 'right-1', 'top-1');
    });
  });

  describe('sheet of the phone', () => {
    it('GroupedNavLinks_Sheet_ListsWhatTheBottomBarDoesNotAndMoreAsOneMoreGroup', () => {
      renderNav('/app/short-rent', { variant: 'sheet' });

      expect(screen.getByRole('group', { name: 'La tua offerta' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Gestione' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Altro' })).toBeInTheDocument();
      expect(screen.getByText('Altro')).toBeVisible();
      // Entries of the bar are left out; the others are all there, "Altro" is not a closed menu.
      expect(screen.queryByRole('link', { name: 'Cruscotto' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Prenotazioni' })).not.toBeInTheDocument();
      for (const name of ['Sito di prenotazione', 'Marketplace', 'Incassi', 'Ospiti', 'Profilo', 'Stripe Connect']) {
        expect(link(name)).toBeVisible();
      }
      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_Sheet_DrawsTilesInTwoColumnsNotARowPerEntry', () => {
      renderNav('/app/short-rent', { variant: 'sheet' });

      const offer = screen.getByRole('group', { name: 'La tua offerta' });
      expect(within(offer).getByRole('list')).toHaveClass('grid', 'grid-cols-2');
      // Far taller than the 44 px a finger needs, the icon above the name (the name is first in the markup: it is read
      // before the counter).
      expect(link('Marketplace')).toHaveClass('min-h-[4.5rem]', 'flex-col-reverse');
      expect(link('Marketplace').querySelector('svg')).not.toBeNull();
      expect(link('Marketplace').firstElementChild).toHaveTextContent('Marketplace');
    });

    it('GroupedNavLinks_Sheet_DoesNotUseBorderColorsThePageResetsAndTellsTheOpenPageByBackgroundAndRing', () => {
      renderNav('/app/short-rent/payments', { variant: 'sheet' });

      expect(link('Incassi')).toHaveClass('bg-primary/10', 'ring-1', 'ring-inset');
      expect(link('Incassi').className).not.toMatch(/\bborder/);
      expect(link('Marketplace')).toHaveClass('bg-muted/60');
      expect(link('Marketplace')).not.toHaveClass('ring-1');
    });

    it('GroupedNavLinks_Sheet_TellsTheSheetToCloseWhenAnEntryIsChosen', () => {
      const onNavigate = vi.fn();
      renderNav('/app/short-rent', { variant: 'sheet', onNavigate });

      fireEvent.click(link('Incassi'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('location')).toHaveTextContent('/app/short-rent/payments');
    });

    it('GroupedNavLinks_Sheet_MarksTheOpenPage', () => {
      renderNav('/app/short-rent/settings/site-appearance', { variant: 'sheet' });

      expect(link('Sito di prenotazione')).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_Sheet_ShowsTheCountOnTheCornerOfTheTileAndSaysItAloud', () => {
      // Prenotazioni is in the bar for short-rent: list everything, as a flat menu would, to have a tile with a count.
      const nav = getContextNav('short-rent', allowAll, {});
      render(
        <MemoryRouter initialEntries={['/app/short-rent']}>
          <GroupedNavLinks
            nav={nav}
            matchEntries={getNavMatchEntries('short-rent', allowAll, {})}
            variant="sheet"
            counts={{ bookingRequests: 2 }}
          />
        </MemoryRouter>,
      );

      const bookings = link(/Prenotazioni/);
      expect(within(bookings).getByTestId('nav-count')).toHaveTextContent('2');
      expect(bookings).toHaveAccessibleName('Prenotazioni, 2 richieste da approvare');
    });

    it('GroupedNavLinks_Sheet_ShowsNoTooltipEvenOnFocus', () => {
      renderNav('/app/short-rent', { variant: 'sheet' });

      tabTo(link('Incassi'));

      expect(screen.queryByTestId('rail-tooltip')).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_SheetOfASingleGroup_HasNoHeadingButTheGroupHasAName', () => {
      renderNav('/app/long-rent/leases', { variant: 'sheet', contextKey: 'long-rent' });

      expect(screen.getByRole('group', { name: 'Altro' })).toBeInTheDocument();
      expect(screen.queryByText('Altro')).not.toBeInTheDocument();
      expect(link('Profilo')).toBeInTheDocument();
    });
  });
});

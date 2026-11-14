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
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { FooterNavLinks, GroupedNavLinks } from '../grouped-nav-links';

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
      expect(within(everyday).getAllByRole('link').map((item) => item.textContent)).toEqual(['Cruscotto', 'Calendario', 'Prenotazioni', 'Adempimenti']);
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
      // The Amministrazione of an org that is no agency has one group: a heading would only repeat the area. The group still has a name.
      renderNav('/app/account', { contextKey: 'account' });

      expect(screen.getByRole('group', { name: 'Il tuo account' })).toBeInTheDocument();
      expect(screen.queryByText('Il tuo account')).not.toBeInTheDocument();
      expect(link('Persone')).toHaveAttribute('href', '/app/account/people');
    });

    it('GroupedNavLinks_StaffConsole_IsInFourNamedGroups', () => {
      render(
        <MemoryRouter initialEntries={['/app/admin']}>
          <GroupedNavLinks
            nav={getContextNav('admin', allowAll, { octorateOnboarding: true, agencyTier: true })}
            matchEntries={getNavMatchEntries('admin', allowAll, { octorateOnboarding: true, agencyTier: true })}
          />
        </MemoryRouter>,
      );

      expect(within(screen.getByRole('group', { name: 'Piattaforma' })).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Cruscotto',
        'Utenti',
        'Fornitori',
      ]);
      expect(within(screen.getByRole('group', { name: 'Supporto' })).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Richieste di aiuto',
        'Attività',
      ]);
      expect(within(screen.getByRole('group', { name: 'Contenuti' })).getAllByRole('link').map((item) => item.textContent)).toEqual(['SEO & Contenuti']);
      expect(within(screen.getByRole('group', { name: 'Sistema' })).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Conformità',
        'Processi',
      ]);
      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
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

    it('GroupedNavLinks_RiskOfASanction_ShowsTheRedCounterOnTheAdempimentiAndSaysItAloud', () => {
      renderNav('/app/short-rent', { counts: { compliance: 2 } });

      const compliance = link(/Adempimenti/);
      expect(within(compliance).getByTestId('nav-count')).toHaveClass('bg-destructive');
      expect(compliance).toHaveAccessibleName('Adempimenti, 2 adempimenti con rischio di sanzione');
      // The counter of the bookings is the accent of the area: the colors tell the two apart.
      expect(link(/Prenotazioni/).querySelector('[data-testid="nav-count"]')).toBeNull();
    });

    it('GroupedNavLinks_OneRiskOfASanction_UsesTheSingular', () => {
      renderNav('/app/short-rent', { counts: { compliance: 1 } });

      expect(link(/Adempimenti/)).toHaveAccessibleName('Adempimenti, 1 adempimento con rischio di sanzione');
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
    /** A menu whose "Altro" holds an entry with a counter (no area has one today: the toggle still carries it for when one does). */
    function renderCountedMore(counts: NavCounts) {
      const todo = getNavMatchEntries('short-rent', allowAll, {}).find((entry) => entry.path === '/app/short-rent/activities')!;
      const nav = { sections: [], more: [{ ...todo, navParent: undefined, navPlacement: 'secondary' as const }], footer: [] };
      return render(
        <MemoryRouter initialEntries={['/app/short-rent/bookings']}>
          <GroupedNavLinks nav={nav} matchEntries={nav.more} counts={counts} />
        </MemoryRouter>,
      );
    }

    it('GroupedNavLinks_ShortRent_HasNoAltroForWhoMayOpenEverySection', () => {
      // The queues are tabs of the Cruscotto, the settings are pinned at the foot of the sidebar (`FooterNavLinks`), «Inizia con CasaZen» is the
      // welcome of the first access and the guide.
      renderNav('/app/short-rent');

      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
      for (const name of ['Coda di approvazione', 'Da fare', 'Organizzazione', 'Impostazioni', 'Consiglia CasaZen', 'Inizia con CasaZen']) {
        expect(screen.queryByRole('link', { name }), name).not.toBeInTheDocument();
      }
    });

    it('GroupedNavLinks_MoreMenu_IsClosedWhileTheOpenPageIsNotInIt', () => {
      renderNav('/app/long-rent', { contextKey: 'long-rent' });

      const toggle = screen.getByRole('button', { name: 'Altro' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: 'Report fiscale' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_MoreMenu_OpensOnClickAndShowsItsEntries', () => {
      renderNav('/app/long-rent', { contextKey: 'long-rent' });

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      const more = screen.getByTestId('nav-more');
      expect(within(more).getAllByRole('link').map((item) => item.textContent)).toEqual(['Report fiscale', 'Spese condominiali']);
      // The button controls the list it opens.
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-controls', within(more).getByRole('list').id);
    });

    it('GroupedNavLinks_PagesOfASection_AreNotEntriesOfTheMenu', () => {
      renderNav('/app/short-rent');

      for (const name of ['Messaggi', 'Ospiti', 'CRM Ospiti', 'Recensioni', 'Ricavi', 'Report', 'Regime fiscale', 'Stripe Connect', 'Canali e calendari', 'Fornitori fidati', 'Dominio pubblico', 'Verifiche', 'Da approvare', 'Profilo']) {
        expect(screen.queryByRole('link', { name }), name).not.toBeInTheDocument();
      }
    });

    it('GroupedNavLinks_PageInsideMoreMenu_OpensItAndMarksTheEntry', () => {
      renderNav('/app/long-rent/fiscal', { contextKey: 'long-rent' });

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(link('Report fiscale')).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_PageThatHangsFromAnEntryOfTheMainMenu_MarksThatEntry', () => {
      renderNav('/app/short-rent/alloggiati');

      expect(link('Adempimenti')).toHaveAttribute('aria-current', 'page');
      // The page is in no menu, only the entry it hangs from is.
      expect(screen.queryByRole('link', { name: 'Alloggiati' })).not.toBeInTheDocument();
    });

    it.each([
      ['/app/short-rent/activities', 'Cruscotto'],
      ['/app/short-rent/approval-queue', 'Cruscotto'],
      ['/app/short-rent/verifications', 'Cruscotto'],
      ['/app/short-rent/messages', 'Prenotazioni'],
      ['/app/short-rent/guests', 'Prenotazioni'],
      ['/app/short-rent/reviews', 'Prenotazioni'],
      ['/app/short-rent/payments/revenue', 'Incassi'],
      ['/app/short-rent/documents', 'Incassi'],
      ['/app/short-rent/fiscal', 'Incassi'],
      ['/app/short-rent/settings/payments', 'Incassi'],
      ['/app/short-rent/channels', 'Immobili'],
      ['/app/short-rent/interventions', 'Immobili'],
      ['/app/short-rent/settings/domain', 'Sito di prenotazione'],
    ])('GroupedNavLinks_TabOfASection_%s_MarksTheEntryOfTheSection_%s', (path, entry) => {
      renderNav(path);

      expect(link(entry)).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_UserClosesTheMenu_ItStaysClosedUntilThePageChanges', () => {
      renderNav('/app/long-rent/fiscal', { contextKey: 'long-rent' });
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('link', { name: 'Report fiscale' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_ChoiceOfTheUser_ValidOnlyForThePageItWasMadeOn', () => {
      renderNav('/app/long-rent', { contextKey: 'long-rent' });
      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');

      // A page outside "Altro": back to the default, closed.
      fireEvent.click(link('Immobili'));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');

      // A page inside it: open again.
      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      fireEvent.click(link('Report fiscale'));
      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(link('Report fiscale')).toHaveAttribute('aria-current', 'page');
    });

    it('GroupedNavLinks_CounterInsideAClosedMore_SitsOnTheToggleToo', () => {
      renderCountedMore({ activities: 3 });

      // The entry with the counter is behind "Altro": the toggle carries it, in red, and says it aloud.
      const toggle = screen.getByRole('button', { name: /^Altro/ });
      expect(within(toggle).getByTestId('nav-count')).toHaveClass('bg-destructive');
      expect(toggle).toHaveAccessibleName('Altro, 3 attività urgenti');

      // Once the menu is open the entry shows its own counter and the toggle gives it up.
      fireEvent.click(toggle);
      expect(within(screen.getByRole('button', { name: 'Altro' })).queryByTestId('nav-count')).not.toBeInTheDocument();
      expect(within(link(/^Da fare/)).getByTestId('nav-count')).toHaveTextContent('3');
    });

    it('GroupedNavLinks_NothingCounted_LeavesTheToggleOfAltroPlain', () => {
      renderCountedMore({ activities: 0 });

      expect(within(screen.getByRole('button', { name: 'Altro' })).queryByTestId('nav-count')).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_NoEntryForTheUser_HasNoMoreMenu', () => {
      // A user who may open nothing of "Altro" (no permission at all, not even the org billing administrator one).
      renderNav('/app/supplier/dashboard', { contextKey: 'supplier', hasPermission: (_ctx, permission) => !permission });

      // Profile and the iCal guide ask no permission: "Altro" is there. For a context where nothing is left, it is not.
      expect(screen.getByRole('button', { name: 'Altro' })).toBeInTheDocument();
      cleanup();
      renderNav('/app/admin', { contextKey: 'admin', hasPermission: () => false });
      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
      cleanup();
      // Profilo left the menus of the rental areas: with nothing else to open there is no "Altro" there either.
      renderNav('/app/short-rent', { hasPermission: (_ctx, permission) => !permission });
      expect(screen.queryByRole('button', { name: 'Altro' })).not.toBeInTheDocument();
    });

    it('GroupedNavLinks_ARoleWithoutTheOwnerOfAPage_StillFindsItsPagesInMore', () => {
      // Who cannot read the payments finds the documents, the fiscal regime and the Stripe account in "Altro", each as an entry of its own:
      // "Altro" is there only for the pages whose section is closed to the user.
      renderNav('/app/short-rent', { hasPermission: (_ctx, permission) => permission !== 'payment.read' });
      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));

      expect(within(screen.getByTestId('nav-more')).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Documenti',
        'Regime fiscale',
        'Stripe Connect',
      ]);
    });
  });

  describe('foot of the sidebar', () => {
    function renderFooter(path: string) {
      const nav = getContextNav('short-rent', allowAll, {});
      return render(
        <MemoryRouter initialEntries={[path]}>
          <FooterNavLinks entries={nav.footer} matchEntries={getNavMatchEntries('short-rent', allowAll, {})} />
        </MemoryRouter>,
      );
    }

    it('FooterNavLinks_ShortRent_PinsTheSettingsAndTheInvitations', () => {
      renderFooter('/app/short-rent');

      expect(within(screen.getByTestId('nav-footer')).getAllByRole('link').map((item) => item.textContent)).toEqual([
        'Impostazioni',
        'Consiglia CasaZen',
      ]);
      expect(link('Impostazioni')).toHaveAttribute('href', '/app/short-rent/settings/organization');
      expect(link('Impostazioni')).not.toHaveAttribute('aria-current');
    });

    it('FooterNavLinks_PageOfTheSettings_MarksImpostazioni', () => {
      renderFooter('/app/short-rent/settings/organization');

      expect(link('Impostazioni')).toHaveAttribute('aria-current', 'page');
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
      renderNav('/app/long-rent', { contextKey: 'long-rent', collapsed: true });

      expect(link('Panoramica')).not.toHaveAttribute('title');
      expect(screen.getByRole('button', { name: 'Altro' })).not.toHaveAttribute('title');
    });

    it('GroupedNavLinks_Collapsed_AltroHasItsNameAsATooltipToo', () => {
      renderNav('/app/long-rent', { contextKey: 'long-rent', collapsed: true });

      tabTo(screen.getByRole('button', { name: 'Altro' }));

      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Altro');
    });

    it('GroupedNavLinks_Collapsed_AltroStillOpensAndItsEntriesHaveTooltipsToo', () => {
      renderNav('/app/long-rent', { contextKey: 'long-rent', collapsed: true });

      fireEvent.click(screen.getByRole('button', { name: 'Altro' }));
      tabTo(link('Report fiscale'));

      expect(screen.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Report fiscale');
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
    it('GroupedNavLinks_Sheet_ListsWhatTheBottomBarDoesNotAndTheSettingsAsOneMoreGroup', () => {
      renderNav('/app/short-rent', { variant: 'sheet' });

      expect(screen.getByRole('group', { name: 'La tua offerta' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Gestione' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Impostazioni e inviti' })).toBeInTheDocument();
      expect(screen.getByText('Impostazioni e inviti')).toBeVisible();
      // No "Altro" in short-rent for who may open every section.
      expect(screen.queryByRole('group', { name: 'Altro' })).not.toBeInTheDocument();
      // Entries of the bar are left out; the others are all there.
      expect(screen.queryByRole('link', { name: 'Cruscotto' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Prenotazioni' })).not.toBeInTheDocument();
      for (const name of ['Sito di prenotazione', 'Marketplace', 'Incassi', 'Impostazioni', 'Consiglia CasaZen']) {
        expect(link(name)).toBeVisible();
      }
      // The pages of a section are its tabs, and Profilo is in the account block of the sheet: none is a tile.
      for (const name of ['Ospiti', 'Profilo', 'Stripe Connect', 'Da fare', 'Coda di approvazione']) {
        expect(screen.queryByRole('link', { name }), name).not.toBeInTheDocument();
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
      // A role that reads the leases and not the properties, and is not the organization administrator: the bar holds all its main entries and
      // nothing is at the foot, so the sheet has only "Altro".
      renderNav('/app/long-rent/leases', {
        variant: 'sheet',
        contextKey: 'long-rent',
        hasPermission: (_ctx, permission) => permission !== 'property.read' && permission !== ORG_BILLING_ADMIN_PERMISSION,
      });

      expect(screen.getByRole('group', { name: 'Altro' })).toBeInTheDocument();
      expect(screen.queryByText('Altro')).not.toBeInTheDocument();
      expect(link('Report fiscale')).toBeInTheDocument();
    });
  });
});

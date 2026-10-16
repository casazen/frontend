import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Users } from 'lucide-react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { stubViewportWidth } from '@/test/viewport';
import { RouteTabs, type RouteTabItem } from '../route-tabs';

const BASE = '/app/short-rent';

const ITEMS: RouteTabItem[] = [
  { label: 'Prenotazioni', href: `${BASE}/bookings`, testId: 'tab-bookings' },
  { label: 'Ospiti', href: `${BASE}/guests`, testId: 'tab-guests' },
  { label: 'Pagamenti', href: `${BASE}/payments`, testId: 'tab-payments' },
];

function renderTabs(initialEntry: string, items: readonly RouteTabItem[] = ITEMS, extra: Partial<React.ComponentProps<typeof RouteTabs>> = {}) {
  const router = createMemoryRouter(
    [{ path: '*', element: <RouteTabs label="Sezioni di Prenotazioni" items={items} {...extra} /> }],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const link = (name: string | RegExp) => screen.getByRole('link', { name });
const currentLinks = () => screen.queryAllByRole('link').filter((element) => element.getAttribute('aria-current') === 'page');

describe('RouteTabs (UI-15)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('structure', () => {
    it('RouteTabs_Items_AreLinksToTheirPagesInANavigationNamedLikeTheGroup', () => {
      renderTabs(`${BASE}/bookings`);

      const nav = screen.getByRole('navigation', { name: 'Sezioni di Prenotazioni' });
      expect(within(nav).getAllByRole('link').map((element) => element.textContent)).toEqual(['Prenotazioni', 'Ospiti', 'Pagamenti']);
      expect(link('Ospiti')).toHaveAttribute('href', `${BASE}/guests`);
      expect(link('Pagamenti')).toHaveAttribute('href', `${BASE}/payments`);
    });

    it('RouteTabs_IsNavigationNotATablist_BecauseThePageBelowIsNotAPanelItControls', () => {
      renderTabs(`${BASE}/bookings`);

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('RouteTabs_NoItems_RendersNothing', () => {
      const router = createMemoryRouter([{ path: '*', element: <RouteTabs label="Sezioni" items={[]} /> }], { initialEntries: ['/'] });
      const { container } = render(<RouterProvider router={router} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('RouteTabs_TestId_IsPassedOnToTheLink', () => {
      renderTabs(`${BASE}/bookings`);

      expect(screen.getByTestId('tab-guests')).toBe(link('Ospiti'));
    });

    it('RouteTabs_Icon_IsDecorative', () => {
      renderTabs(`${BASE}/bookings`, [{ label: 'Ospiti', href: `${BASE}/guests`, icon: Users }]);

      expect(link('Ospiti').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(link('Ospiti')).toHaveAccessibleName('Ospiti');
    });

    it('RouteTabs_Links_AreAtLeast44PixelsTall', () => {
      renderTabs(`${BASE}/bookings`);

      expect(link('Ospiti')).toHaveClass('min-h-11');
    });
  });

  describe('the section the page is on', () => {
    it('RouteTabs_AddressOnASection_MarksItAsTheCurrentPageAndNoOtherOne', () => {
      renderTabs(`${BASE}/payments`);

      expect(link('Pagamenti')).toHaveAttribute('aria-current', 'page');
      expect(currentLinks()).toHaveLength(1);
    });

    it('RouteTabs_AddressUnderASection_BelongsToThatSection', () => {
      renderTabs(`${BASE}/bookings/b-7`);

      expect(link('Prenotazioni')).toHaveAttribute('aria-current', 'page');
      expect(currentLinks()).toHaveLength(1);
    });

    it('RouteTabs_APathThatOnlyStartsLikeASection_IsNotThatSection', () => {
      renderTabs(`${BASE}/bookings-archive`);

      expect(currentLinks()).toHaveLength(0);
    });

    it('RouteTabs_TrailingSlash_DoesNotMatter', () => {
      renderTabs(`${BASE}/guests/`);

      expect(link('Ospiti')).toHaveAttribute('aria-current', 'page');
    });

    it('RouteTabs_TheMostSpecificSectionWins', () => {
      renderTabs(`${BASE}/reports/fiscal`, [
        { label: 'Report', href: `${BASE}/reports` },
        { label: 'Fiscale', href: `${BASE}/reports/fiscal` },
      ]);

      expect(link('Fiscale')).toHaveAttribute('aria-current', 'page');
      expect(link('Report')).not.toHaveAttribute('aria-current');
    });

    it('RouteTabs_SectionsOfOnePageDistinguishedByTheirQuery_FollowTheQueryOfTheAddress', () => {
      const items: RouteTabItem[] = [
        { label: 'Report', href: '/report' },
        { label: 'Canali', href: '/report?tab=canali' },
        { label: 'Adempimenti', href: '/report?tab=adempimenti' },
      ];

      renderTabs('/report?tab=canali&q=x', items);
      expect(link('Canali')).toHaveAttribute('aria-current', 'page');
      expect(currentLinks()).toHaveLength(1);

      cleanup();
      renderTabs('/report', items);
      expect(link('Report')).toHaveAttribute('aria-current', 'page');
      expect(currentLinks()).toHaveLength(1);
    });

    it('RouteTabs_CurrentGivenByThePage_WinsOverTheAddress', () => {
      renderTabs(`${BASE}/bookings`, [
        { label: 'Prenotazioni', href: `${BASE}/bookings` },
        { label: 'Ospiti', href: `${BASE}/guests`, current: true },
      ]);

      expect(link('Ospiti')).toHaveAttribute('aria-current', 'page');
      expect(link('Prenotazioni')).not.toHaveAttribute('aria-current');
    });

    it('RouteTabs_HrefWithAFragmentOrATrailingSlash_StillMatchesItsPage', () => {
      renderTabs(`${BASE}/guests`, [
        { label: 'Prenotazioni', href: `${BASE}/bookings/#top` },
        { label: 'Ospiti', href: `${BASE}/guests/` },
      ]);

      expect(link('Ospiti')).toHaveAttribute('aria-current', 'page');
      expect(currentLinks()).toHaveLength(1);
    });

    it('RouteTabs_AddressOnNoSection_MarksNone', () => {
      renderTabs(`${BASE}/properties`);

      expect(currentLinks()).toHaveLength(0);
    });
  });

  describe('counters', () => {
    it('RouteTabs_Count_ShowsTheNumberWithItsToneAndSaysWhatItCounts', () => {
      renderTabs(`${BASE}/bookings`, [
        { label: 'Prenotazioni', href: `${BASE}/bookings` },
        { label: 'Pagamenti', href: `${BASE}/payments`, count: 3, countLabel: '3 da incassare', tone: 'warning' },
      ]);

      const payments = link(/Pagamenti/);
      // The label says the number (once): the number itself is hidden from assistive technology.
      expect(payments).toHaveAccessibleName(/^Pagamenti.*3 da incassare$/);
      const pill = within(payments).getByText('3').parentElement as HTMLElement;
      expect(pill).toHaveAttribute('data-tone', 'warning');
      expect(pill.className).toContain('bg-warning-soft');
      expect(within(payments).getByText('3')).toHaveAttribute('aria-hidden', 'true');
    });

    it('RouteTabs_CountWithoutATone_KeepsTheAccentOfTheApp', () => {
      renderTabs(`${BASE}/bookings`, [{ label: 'Prenotazioni', href: `${BASE}/bookings`, count: 2 }]);

      expect(within(link(/Prenotazioni/)).getByText('2').parentElement).toHaveClass('bg-primary');
    });

    it('RouteTabs_ZeroAndBigCounts_AreHiddenOrShownAs99Plus', () => {
      renderTabs(`${BASE}/bookings`, [
        { label: 'Prenotazioni', href: `${BASE}/bookings`, count: 0 },
        { label: 'Ospiti', href: `${BASE}/guests`, count: 250 },
      ]);

      expect(link('Prenotazioni')).toHaveTextContent(/^Prenotazioni$/);
      expect(link(/Ospiti/)).toHaveTextContent('99+');
    });
  });

  describe('going to another section', () => {
    it('RouteTabs_Click_GoesToThePageOfTheSectionAndAddsAStepToTheHistory', () => {
      const router = renderTabs(`${BASE}/bookings`);

      fireEvent.click(link('Ospiti'));

      expect(router.state.location.pathname).toBe(`${BASE}/guests`);
      expect(router.state.historyAction).toBe('PUSH');
    });
  });

  describe('a menu on a phone', () => {
    beforeEach(() => {
      stubViewportWidth(390);
    });

    it('RouteTabs_Phone_IsANativeMenuNamedLikeTheGroupWithTheCurrentSectionSelected', () => {
      renderTabs(`${BASE}/payments`);

      const menu = screen.getByRole('combobox', { name: 'Sezioni di Prenotazioni' });
      expect(menu).toHaveValue(`${BASE}/payments`);
      expect(within(menu).getAllByRole('option').map((option) => option.textContent)).toEqual(['Prenotazioni', 'Ospiti', 'Pagamenti']);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('RouteTabs_Phone_ChoosingAnOptionGoesToThatPage', () => {
      const router = renderTabs(`${BASE}/bookings`);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: `${BASE}/guests` } });

      expect(router.state.location.pathname).toBe(`${BASE}/guests`);
      expect(screen.getByRole('combobox')).toHaveValue(`${BASE}/guests`);
    });

    it('RouteTabs_Phone_TheCountGoesInTheTextOfTheOption', () => {
      renderTabs(`${BASE}/bookings`, [
        { label: 'Prenotazioni', href: `${BASE}/bookings` },
        { label: 'Pagamenti', href: `${BASE}/payments`, count: 3 },
      ]);

      expect(screen.getByRole('option', { name: 'Pagamenti (3)' })).toBeInTheDocument();
    });

    it('RouteTabs_Phone_APageOfNoSection_DoesNotPretendToBeOnTheFirstOne', () => {
      renderTabs(`${BASE}/properties`);

      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('RouteTabs_Phone_ATestIdForTheMenuIsPassedOn', () => {
      renderTabs(`${BASE}/bookings`, ITEMS, { selectTestId: 'sections-select' });

      expect(screen.getByTestId('sections-select')).toBe(screen.getByRole('combobox'));
    });

    it('RouteTabs_Phone_HasNoAxeViolations', async () => {
      renderTabs(`${BASE}/guests`);

      await expectNoAxeViolations(document.body);
    });
  });

  describe('accessibility', () => {
    it('RouteTabs_OnATabletOrADesktop_HasNoAxeViolations', async () => {
      renderTabs(`${BASE}/payments`, [
        ...ITEMS.slice(0, 2),
        { label: 'Pagamenti', href: `${BASE}/payments`, count: 2, countLabel: '2 da incassare', tone: 'danger' },
      ]);

      await expectNoAxeViolations(document.body);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Users } from 'lucide-react';
import i18n from '@/i18n/config';
import { stubViewportWidth } from '@/test/viewport';
import { expectNoAxeViolations } from '@/test/axe';
import { Tabs, type TabItem } from '../tabs';

const ITEMS: TabItem[] = [
  { value: 'details', label: 'Dettagli', testId: 'tab-details' },
  { value: 'guest', label: 'Ospite', testId: 'tab-guest' },
  { value: 'payment', label: 'Pagamento', testId: 'tab-payment' },
  { value: 'alloggiati', label: 'Alloggiati', testId: 'tab-alloggiati' },
];

type TabsExtra = Partial<React.ComponentProps<typeof Tabs>>;

function renderTabs(initialEntry = '/bookings/7', extra: TabsExtra = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/bookings/:id',
        element: (
          <Tabs label="Sezioni della prenotazione" items={ITEMS} defaultValue="details" {...extra}>
            <p>contenuto</p>
          </Tabs>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const tab = (name: string) => screen.getByRole('tab', { name });
const where = (router: ReturnType<typeof createMemoryRouter>) => router.state.location.pathname + router.state.location.search;

describe('Tabs (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('structure', () => {
    it('Tabs_Default_IsATablistWithATabForEachItemAndAPanelForTheOpenOne', () => {
      renderTabs();

      const list = screen.getByRole('tablist', { name: 'Sezioni della prenotazione' });
      expect(within(list).getAllByRole('tab').map((t) => t.textContent)).toEqual([
        'Dettagli',
        'Ospite',
        'Pagamento',
        'Alloggiati',
      ]);
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveTextContent('contenuto');
      expect(panel).toHaveAccessibleName('Dettagli');
    });

    it('Tabs_Default_TheTabsAreLinksToTheSamePage', () => {
      renderTabs();

      expect(tab('Dettagli').tagName).toBe('A');
      expect(tab('Dettagli')).toHaveAttribute('href', '/bookings/7');
      expect(tab('Pagamento')).toHaveAttribute('href', '/bookings/7?tab=payment');
    });

    it('Tabs_OpenTab_IsSelectedInTheTabOrderAndControlsThePanel', () => {
      renderTabs();

      const open = tab('Dettagli');
      expect(open).toHaveAttribute('aria-selected', 'true');
      expect(open).toHaveAttribute('tabindex', '0');
      expect(open).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
      for (const other of ['Ospite', 'Pagamento', 'Alloggiati']) {
        expect(tab(other)).toHaveAttribute('aria-selected', 'false');
        expect(tab(other)).toHaveAttribute('tabindex', '-1');
        expect(tab(other)).not.toHaveAttribute('aria-controls');
      }
    });

    it('Tabs_NoChildren_ShowsNoPanel', () => {
      const router = createMemoryRouter(
        [{ path: '/', element: <Tabs label="Viste" items={ITEMS} /> }],
        { initialEntries: ['/'] },
      );
      render(<RouterProvider router={router} />);

      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
      expect(tab('Dettagli')).not.toHaveAttribute('aria-controls');
    });

    it('Tabs_NoItems_RendersNothing', () => {
      const router = createMemoryRouter([{ path: '/', element: <Tabs label="Viste" items={[]} /> }], {
        initialEntries: ['/'],
      });
      const { container } = render(<RouterProvider router={router} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('the address says which tab is open', () => {
    it('Tabs_AddressWithATab_OpensIt', () => {
      renderTabs('/bookings/7?tab=alloggiati');

      expect(tab('Alloggiati')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Alloggiati');
    });

    it('Tabs_AddressWithAnUnknownTab_OpensTheDefaultOne', () => {
      renderTabs('/bookings/7?tab=nonsense');

      expect(tab('Dettagli')).toHaveAttribute('aria-selected', 'true');
    });

    it('Tabs_NoDefaultValue_TheFirstTabIsTheDefault', () => {
      renderTabs('/bookings/7', { defaultValue: undefined });

      expect(tab('Dettagli')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Dettagli')).toHaveAttribute('href', '/bookings/7');
    });

    it('Tabs_ADefaultThatIsNotTheFirst_HasTheCleanAddressAndTheFirstOneHasAParameter', () => {
      renderTabs('/bookings/7', { defaultValue: 'payment' });

      expect(tab('Pagamento')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Pagamento')).toHaveAttribute('href', '/bookings/7');
      expect(tab('Dettagli')).toHaveAttribute('href', '/bookings/7?tab=details');
    });

    it('Tabs_OtherParameters_AreKeptInEveryTabAddress', () => {
      renderTabs('/bookings/7?q=mario&tab=guest&status=open');

      expect(tab('Dettagli')).toHaveAttribute('href', '/bookings/7?q=mario&status=open');
      expect(tab('Pagamento')).toHaveAttribute('href', '/bookings/7?q=mario&tab=payment&status=open');
    });

    it('Tabs_AnotherParameterName_IsUsedAsGiven', () => {
      renderTabs('/bookings/7?vista=calendario', {
        param: 'vista',
        items: [
          { value: 'elenco', label: 'Elenco' },
          { value: 'calendario', label: 'Calendario' },
        ],
        defaultValue: 'elenco',
      });

      expect(tab('Calendario')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Elenco')).toHaveAttribute('href', '/bookings/7');
    });

    it('Tabs_AValueFromThePage_WinsOverTheAddress', () => {
      renderTabs('/bookings/7?tab=guest', { value: 'payment' });

      expect(tab('Pagamento')).toHaveAttribute('aria-selected', 'true');
    });

    it('Tabs_ClickOnATab_OpensItByReplacingTheEntryOfTheHistory', () => {
      const router = renderTabs('/bookings/7?q=mario');

      fireEvent.click(tab('Ospite'));

      expect(where(router)).toBe('/bookings/7?q=mario&tab=guest');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(tab('Ospite')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Ospite');
    });

    it('Tabs_ClickOnTheDefaultTab_TakesTheParameterAwayFromTheAddress', () => {
      const router = renderTabs('/bookings/7?tab=guest&q=mario');

      fireEvent.click(tab('Dettagli'));

      expect(where(router)).toBe('/bookings/7?q=mario');
    });

    it('Tabs_ClickOnATab_DoesNotScrollThePageBackToTheTop', () => {
      const router = renderTabs();

      fireEvent.click(tab('Ospite'));

      expect(router.state.preventScrollReset).toBe(true);
    });
  });

  describe('keyboard', () => {
    it('Tabs_ArrowRightAndLeft_MoveTheFocusAlongTheTabsAndWrapAround', () => {
      renderTabs();
      tab('Dettagli').focus();

      fireEvent.keyDown(tab('Dettagli'), { key: 'ArrowRight' });
      expect(tab('Ospite')).toHaveFocus();

      fireEvent.keyDown(tab('Ospite'), { key: 'ArrowLeft' });
      expect(tab('Dettagli')).toHaveFocus();

      fireEvent.keyDown(tab('Dettagli'), { key: 'ArrowLeft' });
      expect(tab('Alloggiati')).toHaveFocus();

      fireEvent.keyDown(tab('Alloggiati'), { key: 'ArrowRight' });
      expect(tab('Dettagli')).toHaveFocus();
    });

    it('Tabs_HomeAndEnd_GoToTheFirstAndTheLastTab', () => {
      renderTabs();
      tab('Ospite').focus();

      fireEvent.keyDown(tab('Ospite'), { key: 'End' });
      expect(tab('Alloggiati')).toHaveFocus();

      fireEvent.keyDown(tab('Alloggiati'), { key: 'Home' });
      expect(tab('Dettagli')).toHaveFocus();
    });

    it('Tabs_MovingTheFocus_DoesNotOpenTheTab', () => {
      const router = renderTabs();
      tab('Dettagli').focus();

      fireEvent.keyDown(tab('Dettagli'), { key: 'ArrowRight' });

      expect(where(router)).toBe('/bookings/7');
      expect(tab('Dettagli')).toHaveAttribute('aria-selected', 'true');
    });

    it('Tabs_SpaceOnATab_OpensIt', () => {
      const router = renderTabs();
      tab('Dettagli').focus();
      fireEvent.keyDown(tab('Dettagli'), { key: 'ArrowRight' });

      fireEvent.keyDown(tab('Ospite'), { key: ' ' });

      expect(where(router)).toBe('/bookings/7?tab=guest');
    });

    it('Tabs_AnotherKey_IsLeftAlone', () => {
      renderTabs();
      tab('Dettagli').focus();

      fireEvent.keyDown(tab('Dettagli'), { key: 'a' });

      expect(tab('Dettagli')).toHaveFocus();
    });
  });

  describe('counters', () => {
    it('Tabs_Count_ShowsTheNumberAndSaysWhatItCountsToAScreenReader', () => {
      renderTabs('/bookings/7', {
        items: [
          { value: 'details', label: 'Dettagli' },
          { value: 'requests', label: 'Richieste', count: 3, countLabel: 'da approvare' },
        ],
      });

      const requests = tab(/Richieste/);
      // The number is for the eyes; the ears get what it counts, once.
      expect(requests).toHaveAccessibleName(/^Richieste.*da approvare$/);
      expect(requests).toHaveTextContent('3');
      expect(within(requests).getByText('3')).toHaveAttribute('aria-hidden', 'true');
      expect(within(requests).getByText(', da approvare')).toHaveClass('sr-only');
    });

    it('Tabs_ZeroOrNoCount_ShowsNoPill', () => {
      renderTabs('/bookings/7', {
        items: [
          { value: 'details', label: 'Dettagli', count: 0 },
          { value: 'requests', label: 'Richieste' },
        ],
      });

      expect(tab('Dettagli')).toHaveTextContent(/^Dettagli$/);
      expect(tab('Richieste')).toHaveTextContent(/^Richieste$/);
    });

    it('Tabs_ABigCount_IsShownAs99Plus', () => {
      renderTabs('/bookings/7', { items: [{ value: 'details', label: 'Dettagli', count: 250 }] });

      expect(tab(/Dettagli/)).toHaveTextContent('99+');
    });

    it('Tabs_Icon_IsDecorative', () => {
      renderTabs('/bookings/7', {
        items: [{ value: 'details', label: 'Dettagli', icon: Users }],
      });

      expect(tab('Dettagli').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(tab('Dettagli')).toHaveAccessibleName('Dettagli');
    });
  });

  describe('a menu on a phone', () => {
    beforeEach(() => {
      stubViewportWidth(390);
    });

    it('Tabs_Phone_IsANativeMenuNamedLikeTheTabsWithTheOpenOneSelected', () => {
      renderTabs('/bookings/7?tab=payment');

      const menu = screen.getByRole('combobox', { name: 'Sezioni della prenotazione' });
      expect(menu).toHaveValue('payment');
      expect(within(menu).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Dettagli',
        'Ospite',
        'Pagamento',
        'Alloggiati',
      ]);
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('Tabs_Phone_ChoosingAnOptionChangesTheAddressAndKeepsTheOtherParameters', () => {
      const router = renderTabs('/bookings/7?q=mario');

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'alloggiati' } });

      expect(where(router)).toBe('/bookings/7?q=mario&tab=alloggiati');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(screen.getByRole('combobox')).toHaveValue('alloggiati');
    });

    it('Tabs_Phone_ChoosingTheDefaultOptionTakesTheParameterAway', () => {
      const router = renderTabs('/bookings/7?tab=guest');

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'details' } });

      expect(where(router)).toBe('/bookings/7');
    });

    it('Tabs_Phone_TheCountGoesInTheTextOfTheOption', () => {
      renderTabs('/bookings/7', {
        items: [
          { value: 'details', label: 'Dettagli' },
          { value: 'requests', label: 'Richieste', count: 3 },
        ],
      });

      expect(screen.getByRole('option', { name: 'Richieste (3)' })).toBeInTheDocument();
    });

    it('Tabs_Phone_ThePanelIsOnlyABoxBecauseThereAreNoTabs', () => {
      renderTabs();

      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
      expect(screen.getByText('contenuto')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-controls', screen.getByText('contenuto').parentElement!.id);
    });

    it('Tabs_Phone_ATestIdForTheMenuIsPassedOn', () => {
      renderTabs('/bookings/7', { selectTestId: 'booking-tabs-select' });

      expect(screen.getByTestId('booking-tabs-select')).toBe(screen.getByRole('combobox'));
    });

    it('Tabs_Phone_HasNoAxeViolations', async () => {
      renderTabs('/bookings/7?tab=guest');

      await expectNoAxeViolations(document.body);
    });
  });

  describe('accessibility', () => {
    it('Tabs_OnATabletOrADesktop_HasNoAxeViolations', async () => {
      renderTabs('/bookings/7?tab=guest', {
        items: [
          ...ITEMS.slice(0, 3),
          { value: 'alloggiati', label: 'Alloggiati', count: 2, countLabel: 'da completare' },
        ],
      });

      await expectNoAxeViolations(document.body);
    });
  });
});

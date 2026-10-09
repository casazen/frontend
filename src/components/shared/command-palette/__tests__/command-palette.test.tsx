import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Home } from 'lucide-react';
import i18n from '@/i18n/config';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { expectNoAxeViolations } from '@/test/axe';
import { registerCommands } from '../registry';
import { MAX_RESULTS_PER_GROUP } from '../search';
import type { CommandItem, RemoteCommandSource } from '../types';
import { renderShell } from './palette-harness';

const auth = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, logout: auth.logout }) }));

const dialog = () => screen.getByRole('dialog', { name: 'Cerca' });
const maybeDialog = () => screen.queryByRole('dialog', { name: 'Cerca' });
const box = () => within(dialog()).getByRole('combobox');
const options = () => within(dialog()).queryAllByRole('option');
const group = (name: string) => within(dialog()).getByRole('group', { name });
const labelsOf = (root: HTMLElement) => within(root).getAllByRole('option').map((option) => option.textContent);
const selected = () => options().findIndex((option) => option.getAttribute('aria-selected') === 'true');

const ctrlK = (target: Element = document.body) => fireEvent.keyDown(target, { key: 'k', ctrlKey: true });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(box(), { key, ...init });

async function open(render = renderShell) {
  const shell = render();
  ctrlK();
  await waitFor(() => expect(box()).toHaveFocus());
  return shell;
}

describe('CommandPalette (UI-06)', () => {
  beforeEach(async () => {
    localStorage.clear();
    auth.logout.mockReset();
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
    vi.restoreAllMocks();
  });

  describe('opening and closing', () => {
    it('Palette_CtrlK_OpensWithTheFocusInTheBox', async () => {
      renderShell();
      expect(maybeDialog()).not.toBeInTheDocument();

      ctrlK();

      await waitFor(() => expect(box()).toHaveFocus());
      expect(dialog()).toBeInTheDocument();
    });

    it('Palette_CommandK_OpensToo', async () => {
      renderShell();

      fireEvent.keyDown(document.body, { key: 'k', metaKey: true });

      await waitFor(() => expect(box()).toHaveFocus());
    });

    it('Palette_AnotherKey_DoesNotOpenIt', () => {
      renderShell();

      fireEvent.keyDown(document.body, { key: 'k' });
      fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, shiftKey: true });

      expect(maybeDialog()).not.toBeInTheDocument();
    });

    it('Palette_ShortcutWhileItIsOpen_ClosesIt', async () => {
      renderShell();
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      ctrlK(box());

      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
    });

    it('Palette_Escape_ClosesItAndTheFocusGoesBackToTheSearchThatOpenedIt', async () => {
      const shell = renderShell();
      // A click does not give a button the focus in every browser (Safari): the palette notes the button itself.
      fireEvent.click(shell.trigger());
      await waitFor(() => expect(box()).toHaveFocus());

      press('Escape');

      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      await waitFor(() => expect(shell.trigger()).toHaveFocus());
    });

    it('Palette_OpenedByKeyboardFromAField_GivesTheFocusBackToTheField', async () => {
      renderShell();
      const field = screen.getByTestId('page-field');
      field.focus();
      // The shortcut works from a text field: it does not use Ctrl+K.
      ctrlK(field);
      await waitFor(() => expect(box()).toHaveFocus());

      press('Escape');

      await waitFor(() => expect(field).toHaveFocus());
    });

    it('Palette_AFieldThatUsesTheShortcut_KeepsIt', () => {
      renderShell({ page: <div data-command-palette="off"><input aria-label="Editor" data-testid="editor" /></div> });

      ctrlK(screen.getByTestId('editor'));

      expect(maybeDialog()).not.toBeInTheDocument();
    });

    it('Palette_AFieldThatHandledTheShortcutItself_KeepsIt', () => {
      renderShell();
      const field = screen.getByTestId('page-field');
      field.addEventListener('keydown', (event) => event.preventDefault());

      ctrlK(field);

      expect(maybeDialog()).not.toBeInTheDocument();
    });

    it('Palette_WhileAnotherDialogIsOpen_StaysShut', async () => {
      renderShell({
        page: (
          <Dialog open>
            <DialogContent>
              <DialogTitle>Cancella la prenotazione</DialogTitle>
              <DialogDescription>Non si può tornare indietro.</DialogDescription>
            </DialogContent>
          </Dialog>
        ),
      });
      await screen.findByRole('dialog', { name: 'Cancella la prenotazione' });

      ctrlK(document.body);

      expect(maybeDialog()).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Cancella la prenotazione' })).toBeInTheDocument();
    });

    it('Palette_AddressThatChanges_ClosesItAndItStaysClosedWhenThePersonComesBack', async () => {
      const shell = await open();
      expect(shell.location()).toBe('/app/short-rent');

      // The page behind is hidden from assistive technology, but a Back button or a link of the app can still act.
      fireEvent.click(screen.getByText('Cambia pagina'));
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      expect(shell.location()).toBe('/app/short-rent/elsewhere');

      fireEvent.click(screen.getByText('Torna indietro'));
      expect(shell.location()).toBe('/app/short-rent');
      expect(maybeDialog()).not.toBeInTheDocument();
    });

    it('Palette_ChoiceThatLeadsToAnotherPage_LeavesTheFocusToThatPage', async () => {
      const shell = await open();
      type('prenotazioni');

      press('Enter');

      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      expect(shell.location()).toBe('/app/short-rent/bookings');
      // The heading of the new page takes the focus (RouteFocus): the palette does not take it back to the search.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(shell.trigger()).not.toHaveFocus();
    });

    it('Palette_ChoiceOfThePageThePersonIsOn_GivesTheFocusBackToTheSearch', async () => {
      const shell = renderShell();
      fireEvent.click(shell.trigger());
      await waitFor(() => expect(box()).toHaveFocus());
      type('cruscotto');

      press('Enter');

      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      expect(shell.location()).toBe('/app/short-rent');
      // The page does not change, so no heading is going to take the focus: it goes back to where it was.
      await waitFor(() => expect(shell.trigger()).toHaveFocus());
    });
  });

  describe('the box and the list (combobox and listbox)', () => {
    it('Palette_Open_IsADialogWithATitleADescriptionAndAComboboxWithAListbox', async () => {
      await open();

      expect(dialog()).toHaveAccessibleDescription(/Usa le frecce/);
      expect(box()).toHaveAttribute('aria-autocomplete', 'list');
      expect(box()).toHaveAccessibleName('Cerca immobili, prenotazioni, ospiti, pagine…');
      expect(box()).toHaveAttribute('placeholder', 'Cerca immobili, prenotazioni, ospiti, pagine…');
      expect(box()).toHaveAttribute('aria-expanded', 'true');
      const list = within(dialog()).getByRole('listbox', { name: 'Risultati' });
      expect(box()).toHaveAttribute('aria-controls', list.id);
      expect(box().getAttribute('aria-activedescendant')).toBe(options()[0].id);
    });

    it('Palette_NothingTyped_SuggestsActionsAndPagesOfTheAreaInGroups', async () => {
      await open();

      expect(labelsOf(group('Azioni'))).toEqual([
        expect.stringContaining('Crea una prenotazione'),
        expect.stringContaining('Aggiungi un immobile'),
        expect.stringContaining('Registra un pagamento'),
      ]);
      expect(labelsOf(group('Pagine'))[0]).toContain('Cruscotto');
      // The actions of the account are found by typing and are not offered here.
      expect(within(dialog()).queryByText('Esci')).not.toBeInTheDocument();
      expect(within(dialog()).getByRole('status')).toHaveTextContent('');
    });

    it('Palette_TypingAPage_ShowsItUnderAHeadingWithTheTextUnderlined', async () => {
      await open();

      type('preno');

      const pages = group('Pagine');
      expect(within(pages).getAllByRole('option')[0]).toHaveTextContent('Prenotazioni');
      expect(within(pages).getAllByRole('option')[0].querySelector('[data-match]')).toHaveTextContent('Preno');
    });

    it('Palette_Typing_PutsTheGroupWithTheBestResultFirstAndTheCursorOnItsFirstRow', async () => {
      await open();

      type('prenotazione');

      expect(selected()).toBe(0);
      const groups = within(dialog()).getAllByRole('group');
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveAccessibleName('Pagine');
      expect(groups[1]).toHaveAccessibleName('Azioni');
      expect(options()[0]).toHaveTextContent('Prenotazioni');
    });

    it('Palette_ManyResults_ShowAtMostFivePerGroup', async () => {
      const client = new QueryClient();
      client.setQueryData(
        ['properties', undefined],
        Array.from({ length: 12 }, (_unused, index) => ({ id: `p${index}`, name: `Villa ${index}`, city: 'Roma' })),
      );
      renderShell({ queryClient: client });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      type('villa');

      expect(within(group('Immobili')).getAllByRole('option')).toHaveLength(MAX_RESULTS_PER_GROUP);
    });

    it('Palette_NothingFound_SaysSoAndTheBoxIsNotExpanded', async () => {
      await open();

      type('qwxz');

      expect(screen.getByTestId('command-palette-empty')).toHaveTextContent('Nessun risultato per «qwxz»');
      expect(screen.getByTestId('command-palette-empty')).toHaveTextContent('Prova con il nome di un immobile');
      expect(box()).toHaveAttribute('aria-expanded', 'false');
      expect(box()).not.toHaveAttribute('aria-controls');
      expect(box()).not.toHaveAttribute('aria-activedescendant');
      expect(within(dialog()).queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Palette_Arrows_MoveTheCursorWithoutMovingTheFocusAndWrapAround', async () => {
      await open();
      const count = options().length;
      expect(count).toBeGreaterThan(3);

      press('ArrowDown');
      expect(selected()).toBe(1);
      expect(box().getAttribute('aria-activedescendant')).toBe(options()[1].id);
      expect(box()).toHaveFocus();

      press('ArrowUp');
      press('ArrowUp');
      expect(selected()).toBe(count - 1);
      press('ArrowDown');
      expect(selected()).toBe(0);
    });

    it('Palette_HomeAndEnd_GoToTheFirstAndTheLastResult', async () => {
      await open();
      const count = options().length;

      press('End');
      expect(selected()).toBe(count - 1);
      press('Home');
      expect(selected()).toBe(0);
    });

    it('Palette_HomeAndEndWithNothingToChoose_LeaveTheTextAlone', async () => {
      await open();
      type('qwxz');

      const home = fireEvent.keyDown(box(), { key: 'Home' });
      const end = fireEvent.keyDown(box(), { key: 'End' });

      // Not prevented: the caret moves in the text, as it does in any field.
      expect(home && end).toBe(true);
    });

    it('Palette_Typing_PutsTheCursorBackOnTheFirstResult', async () => {
      await open();
      press('End');
      expect(selected()).toBeGreaterThan(0);

      type('preno');

      expect(selected()).toBe(0);
    });

    it('Palette_Enter_GoesToTheResultTheCursorIsOnNotToTheFirstOne', async () => {
      const shell = await open();
      type('prenotazione');
      press('ArrowDown');
      expect(options()[1]).toHaveTextContent('Sito di prenotazione');

      press('Enter');

      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      expect(shell.location()).toBe('/app/short-rent/vetrina');
    });

    it('Palette_EnterOnAPage_GoesThere', async () => {
      const shell = await open();
      type('preno');

      press('Enter');

      expect(shell.location()).toBe('/app/short-rent/bookings');
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
    });

    it('Palette_EnterWithNothingFound_DoesNothing', async () => {
      const shell = await open();
      type('qwxz');

      press('Enter');

      expect(dialog()).toBeInTheDocument();
      expect(shell.location()).toBe('/app/short-rent');
    });

    it('Palette_EnterThatPicksALetterOfAnInputMethod_IsNotAChoice', async () => {
      const shell = await open();
      type('preno');

      fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });

      expect(dialog()).toBeInTheDocument();
      expect(shell.location()).toBe('/app/short-rent');
    });

    it('Palette_MouseOverARow_MovesTheCursorAndAClickChooses', async () => {
      const shell = await open();
      type('prenotazione');
      const second = options()[1];

      fireEvent.pointerMove(second, { clientX: 10, clientY: 20 });
      expect(selected()).toBe(1);
      // A move without a movement (a list that scrolled under the mouse) is not the person pointing.
      fireEvent.pointerMove(options()[0], { clientX: 10, clientY: 20 });
      expect(selected()).toBe(1);
      fireEvent.pointerMove(options()[0], { clientX: 11, clientY: 22 });
      expect(selected()).toBe(0);

      fireEvent.click(options()[0]);
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
      expect(shell.location()).toBe('/app/short-rent/bookings');
    });

    it('Palette_ClickOnTheList_DoesNotTakeTheFocusFromTheBox', async () => {
      await open();

      const notPrevented = fireEvent.mouseDown(within(dialog()).getByRole('listbox'));

      expect(notPrevented).toBe(false);
      expect(box()).toHaveFocus();
    });
  });

  describe('actions', () => {
    it('Palette_ActionToChangeTheLanguage_ChangesItAndClosesThePalette', async () => {
      await open();
      type('inglese');

      press('Enter');

      await waitFor(() => expect(i18n.language).toBe('en'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('Palette_ActionToSignOut_SignsOut', async () => {
      await open();
      type('esci');
      expect(options()[0]).toHaveTextContent('Esci');

      press('Enter');

      expect(auth.logout).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());
    });

    it('Palette_ActionsThatAreNotAPage_AreNotRemembered', async () => {
      await open();
      type('esci');
      press('Enter');

      expect(Object.keys(localStorage).filter((key) => key.startsWith('casazen:palette'))).toEqual([]);
    });

    it('Palette_ActionToGoToAnotherArea_LeadsToItsHome', async () => {
      const shell = await open(() => renderShell({ areas: ['short-rent', 'long-rent'] }));
      type('lunghi');
      expect(options()[0]).toHaveTextContent('Cambia area: Affitti lunghi');

      press('Enter');

      expect(shell.location()).toBe('/app/long-rent');
    });
  });

  describe('what the user may see', () => {
    it('Palette_RoleWithoutThePermissions_DoesNotOfferTheActionAndTheBookingsOfThePages', async () => {
      const client = new QueryClient();
      client.setQueryData(['bookings', { page: 1 }], {
        items: [
          {
            id: 'b1',
            propertyId: 'p1',
            propertyName: 'Casa del Lago',
            checkInDate: '2026-11-20',
            checkOutDate: '2026-11-23',
            guest: { firstName: 'Mario', lastName: 'Rossi' },
          },
        ],
      });
      renderShell({ queryClient: client, hasPermission: (_area, permission) => !permission.startsWith('booking') });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      // The page of the calendar needs the permission, and so do the bookings of the cache.
      type('calendario');
      expect(screen.getByTestId('command-palette-empty')).toBeInTheDocument();
      type('rossi');
      expect(screen.getByTestId('command-palette-empty')).toBeInTheDocument();
    });

    it('Palette_FlagThatIsOff_HidesItsPageAndItsAction', async () => {
      await open();

      type('airbnb');

      expect(screen.getByTestId('command-palette-empty')).toBeInTheDocument();
    });

    it('Palette_FlagThatIsOn_ShowsThem', async () => {
      renderShell({ flags: { otaPartnerApi: true } });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      type('airbnb');

      expect(within(group('Pagine')).getAllByRole('option')[0]).toHaveTextContent('OTA');
      expect(within(group('Azioni')).getAllByRole('option')[0]).toHaveTextContent('Collega Airbnb o Booking.com');
    });
  });

  describe('recents', () => {
    it('Palette_ChosenPage_IsOfferedFirstTheNextTimeAndOnlyItsIdIsKept', async () => {
      const shell = await open();
      type('prenotazioni');
      press('Enter');
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());

      // The next time the palette opens (on another page: it closes when the address changes).
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      expect(within(group('Recenti')).getAllByRole('option')[0]).toHaveTextContent('Prenotazioni');
      // A screen reader is told what each recent is: they are of different kinds.
      expect(within(group('Recenti')).getAllByRole('option')[0]).toHaveTextContent('Pagina: Prenotazioni');
      // What is kept: the id, in this browser, for this user in this area.
      const kept = Object.entries(localStorage).filter(([key]) => key.startsWith('casazen:palette'));
      expect(kept).toHaveLength(1);
      expect(kept[0][0]).toBe('casazen:palette:recent:auth0%7Ctest-user:short-rent');
      expect(JSON.parse(kept[0][1])).toEqual(['page:/app/short-rent/bookings']);
      expect(shell.location()).toBe('/app/short-rent/bookings');
    });

    it('Palette_WithoutAUser_RemembersNothing', async () => {
      renderShell({ userId: null });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());
      type('prenotazioni');
      press('Enter');

      expect(localStorage.length).toBe(0);
    });

    it('Palette_RecentThatNoLongerExists_IsLeftOut', async () => {
      localStorage.setItem('casazen:palette:recent:auth0%7Ctest-user:short-rent', JSON.stringify(['property:gone', 'page:/app/short-rent/bookings']));
      await open();

      expect(labelsOf(group('Recenti'))).toHaveLength(1);
    });
  });

  describe('what it tells a screen reader', () => {
    it('Palette_AfterTyping_SaysHowManyResultsThereAreOnceThePersonStoppedTyping', async () => {
      await open();
      const status = within(dialog()).getByRole('status');

      type('prenotazione');

      await waitFor(() => expect(status).toHaveTextContent(/^\d+ risultati disponibili$/), { timeout: 2_000 });
      type('prenotazioni cruscotto');
      type('qwxz');
      await waitFor(() => expect(status).toHaveTextContent('Nessun risultato'), { timeout: 2_000 });
    });

    it('Palette_OneResult_SaysItInTheSingular', async () => {
      await open();

      type('regime fiscale');

      await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent(/^1 risultato disponibile$/), { timeout: 2_000 });
    });

    it('Palette_InEnglish_EverythingIsInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderShell();
      ctrlK();
      const english = await screen.findByRole('dialog', { name: 'Search' });
      const field = within(english).getByRole('combobox');

      expect(field).toHaveAttribute('placeholder', 'Search properties, bookings, guests, pages…');
      expect(within(english).getByRole('group', { name: 'Actions' })).toBeInTheDocument();
      fireEvent.change(field, { target: { value: 'qwxz' } });
      expect(screen.getByTestId('command-palette-empty')).toHaveTextContent('No results for “qwxz”');
    });

    // Three passes of axe: more than the 5 s a test has by default when the machine is loaded.
    it('Palette_WithSuggestionsResultsAndNothingFound_HasNoAccessibilityViolationThatJsdomCanFind', async () => {
      await open();
      await expectNoAxeViolations(dialog());

      type('prenotazione');
      await expectNoAxeViolations(dialog());

      type('qwxz');
      await expectNoAxeViolations(dialog());
    }, 30_000);
  });

  describe('privacy', () => {
    it('Palette_Use_LogsNothingAndKeepsNoTextTheUserTypedAnywhere', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await open();

      type('mario rossi');
      type('mario@example.com');
      type('prenotazioni');
      press('Enter');
      await waitFor(() => expect(maybeDialog()).not.toBeInTheDocument());

      for (const spy of [log, info, debug, warn, error]) expect(spy).not.toHaveBeenCalled();
      const everything = [...Object.entries(localStorage), ...Object.entries(sessionStorage)].flat().join('\n').toLowerCase();
      for (const typed of ['mario', 'rossi', 'example.com']) expect(everything).not.toContain(typed);
    });
  });

  describe('what pages and features add', () => {
    it('Palette_ObjectsInTheCache_AreFoundAndLeadToTheirPage', async () => {
      const client = new QueryClient();
      client.setQueryData(['properties', undefined], [{ id: 'p-lago', name: 'Casa del Lago', city: 'Como' }]);
      const shell = renderShell({ queryClient: client });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      type('lago');
      expect(within(group('Immobili')).getAllByRole('option')[0]).toHaveTextContent('Casa del Lago');
      expect(within(group('Immobili')).getAllByRole('option')[0]).toHaveTextContent('Como');
      press('Enter');

      expect(shell.location()).toBe('/app/short-rent/properties/p-lago');
    });

    it('Palette_CommandRegisteredByAFeature_IsFoundLikeTheOthers', async () => {
      const run = vi.fn();
      const remove = registerCommands({
        id: 'help',
        getItems: () => [{ id: 'help:open', kind: 'action', label: 'Apri il centro assistenza', icon: Home, run }],
      });
      try {
        await open();

        type('assistenza');
        press('Enter');

        expect(run).toHaveBeenCalledTimes(1);
      } finally {
        remove();
      }
    });

    it('Palette_NoRemoteSource_MakesNoRequestAndWaitsForNothing', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      await open();

      type('mario rossi');
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(fetchSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('Palette_RemoteSource_AddsItsResultsUnderTheirGroupAndTheyLeadToTheirPage', async () => {
      const found: CommandItem = { id: 'lease:l1', kind: 'guest', label: 'Marta Neri', icon: Home, to: '/app/short-rent/guests/g-neri' };
      const search = vi.fn<RemoteCommandSource['search']>(async () => [found]);
      const remoteSource: RemoteCommandSource = { debounceMs: 20, search };
      const shell = renderShell({ remoteSource });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      type('neri');

      await waitFor(() => expect(within(group('Ospiti')).getAllByRole('option')[0]).toHaveTextContent('Marta Neri'));
      expect(search).toHaveBeenCalledTimes(1);
      expect(search.mock.calls[0][0]).toBe('neri');
      press('Enter');
      expect(shell.location()).toBe('/app/short-rent/guests/g-neri');
    });

    it('Palette_RemoteSourceThatIsWaiting_SaysSoWhileThereIsNothingElse', async () => {
      let resolve: (items: CommandItem[]) => void = () => undefined;
      const remoteSource: RemoteCommandSource = {
        debounceMs: 10,
        search: () => new Promise<CommandItem[]>((done) => (resolve = done)),
      };
      renderShell({ remoteSource });
      ctrlK();
      await waitFor(() => expect(box()).toHaveFocus());

      type('qwxz');

      await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent('Ricerca in corso'), { timeout: 2_000 });
      await act(async () => resolve([]));
      await waitFor(() => expect(within(dialog()).getByRole('status')).toHaveTextContent('Nessun risultato'), { timeout: 2_000 });
    });
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { registerDetail, type DetailContentProps } from '@/components/shared/detail-drawer/detail-registry';
import { settleDrawer } from '@/test/drawer';
import type { ListDefinition } from '../list-types';
import { stayList, type Stay } from './list-fixtures';
import { addressNow, goBack, renderList, stayTable } from './list-harness';

function StayContent({ id }: DetailContentProps) {
  return <p data-testid="drawer-body-text">Stay {id} in the global drawer</p>;
}

const withDrawer = (extra: Partial<ListDefinition<Stay>> = {}) =>
  stayList({ extra: { detail: { drawerKind: 'stay-probe' }, rowHref: undefined, ...extra } });

function renderWithDrawer(list: ListDefinition<Stay> = withDrawer(), initial = '/app/short-rent/bookings') {
  return renderList({ list, initial, beside: <DetailDrawerHost /> });
}

const address = () => new URLSearchParams(addressNow());
/** The button that opens a row, in the table (the cards of a phone are in the page too, and a media query shows one of the two). */
const nameButton = (name: string) => within(stayTable()).getByRole('button', { name });

describe('ListView opens the global drawer (UI-15)', () => {
  const undo: Array<() => void> = [];

  beforeAll(() => {
    undo.push(registerDetail('stay-probe', { title: 'detailDrawer.fallbackTitle', Content: StayContent }));
  });

  afterAll(() => {
    while (undo.length > 0) undo.pop()?.();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await settleDrawer();
  });

  it('ListView_DrawerKind_PressingTheNameOfARowOpensTheGlobalDrawerWithTheKeyOfTheRow', async () => {
    renderWithDrawer();

    fireEvent.click(nameButton('Mario Rossi'));

    const dialog = await screen.findByRole('dialog', { name: 'Details' });
    expect(within(dialog).getByTestId('drawer-body-text')).toHaveTextContent('Stay s1 in the global drawer');
    expect(address().get('detail')).toBe('stay-probe:s1');
    // It is not the slot of the list.
    expect(screen.queryByTestId('list-detail-panel')).not.toBeInTheDocument();
  });

  it('ListView_DrawerKind_APressAnywhereOnTheRowOpensItToo', async () => {
    renderWithDrawer();

    fireEvent.click(within(stayTable()).getByTestId('list-row-s2'));

    expect(await screen.findByTestId('drawer-body-text')).toHaveTextContent('Stay s2');
    expect(address().get('detail')).toBe('stay-probe:s2');
  });

  it('ListView_DrawerId_IsWhatTheDefinitionSaysInsteadOfTheKeyOfTheRow', async () => {
    renderWithDrawer(withDrawer({ detail: { drawerKind: 'stay-probe', drawerId: (stay) => `code-${stay.id}` } }));

    fireEvent.click(nameButton('Mario Rossi'));

    expect(await screen.findByTestId('drawer-body-text')).toHaveTextContent('Stay code-s1');
    expect(address().get('detail')).toBe('stay-probe:code-s1');
  });

  it('ListView_DrawerKind_KeepsTheStateOfTheListInTheAddressAndAddsOneParameterToIt', async () => {
    renderWithDrawer(withDrawer(), '/app/short-rent/bookings?q=anna');

    fireEvent.click(nameButton('Anna Bianchi'));
    await screen.findByRole('dialog');

    const params = address();
    expect(params.get('q')).toBe('anna');
    expect(params.get('detail')).toBe('stay-probe:s2');
  });

  it('ListView_DrawerOpen_AChangeOfTheListKeepsTheDrawerAndTheDrawerKeepsTheList', async () => {
    renderWithDrawer(withDrawer(), '/app/short-rent/bookings?detail=stay-probe:s1');
    await screen.findByRole('dialog');

    // The list is behind the dialog, but something can still change it (a filter applied from a link, a saved view).
    fireEvent.click(screen.getByTestId('list-chip-all'));

    expect(address().get('chip')).toBe('all');
    expect(address().get('detail')).toBe('stay-probe:s1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ListView_DrawerKind_BackClosesTheDrawerAndLeavesTheListAsItWas', async () => {
    renderWithDrawer(withDrawer(), '/app/short-rent/bookings?q=mario');
    fireEvent.click(nameButton('Mario Rossi'));
    await screen.findByRole('dialog');

    goBack();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(address().get('detail')).toBeNull();
    expect(address().get('q')).toBe('mario');
  });

  it('ListView_DrawerKind_TheFocusGoesBackToTheNameThatWasPressed', async () => {
    renderWithDrawer();
    const name = nameButton('Mario Rossi');
    name.focus();
    fireEvent.click(name);
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(nameButton('Mario Rossi')).toHaveFocus());
  });

  it('ListView_DrawerKind_TheNameIsAButtonAsWithTheSlotSoTheKeyboardCanOpenIt', () => {
    renderWithDrawer();

    expect(nameButton('Mario Rossi').tagName).toBe('BUTTON');
    expect(within(stayTable()).queryByRole('link', { name: 'Mario Rossi' })).not.toBeInTheDocument();
  });

  describe('a row that the drawer cannot show', () => {
    it('ListView_DrawerKindNobodyRegistered_GoesToThePageOfTheRowWhenTheListHasOne', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      renderWithDrawer(withDrawer({ detail: { drawerKind: 'nobody-registered' }, rowHref: (stay) => `/app/short-rent/bookings/${stay.id}` }));

      fireEvent.click(nameButton('Mario Rossi'));

      expect(screen.getByTestId('pathname')).toHaveTextContent('/app/short-rent/bookings/s1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ListView_DrawerKindNobodyRegistered_WithNoPageToGoToSaysSoInsteadOfDoingNothing', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(toast, 'error').mockImplementation(() => '');
      renderWithDrawer(withDrawer({ detail: { drawerKind: 'nobody-registered' } }));

      fireEvent.click(nameButton('Mario Rossi'));

      expect(error).toHaveBeenCalledWith('The details could not be opened.');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(address().get('detail')).toBeNull();
      expect(within(stayTable()).getByTestId('list-row-s1')).toBeInTheDocument();
    });

    it('ListView_ARowKeyThatIsNotAnId_SaysSoUntilTheListGivesADrawerId', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(toast, 'error').mockImplementation(() => '');
      renderWithDrawer(withDrawer({ detail: { drawerKind: 'stay-probe', drawerId: () => 'mario@example.com' } }));

      fireEvent.click(nameButton('Mario Rossi'));

      expect(error).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('the slot of the list, as it was', () => {
    it('ListView_LocalSlot_StillOpensItsOwnPanelAndWritesNothingInTheAddress', async () => {
      renderWithDrawer(stayList({ withDetail: true }));

      fireEvent.click(nameButton('Mario Rossi'));

      const panel = await screen.findByTestId('list-detail-panel');
      expect(within(panel).getByTestId('detail-body')).toHaveTextContent('Detail of s1');
      expect(address().get('detail')).toBeNull();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });

    it('ListView_ListWithoutAnyDetail_StillLinksToThePageOfTheRow', () => {
      renderWithDrawer(stayList());

      expect(within(stayTable()).getByRole('link', { name: 'Mario Rossi' })).toHaveAttribute('href', '/app/short-rent/bookings/s1');
    });
  });
});

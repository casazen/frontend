import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { ListView } from '../list-view';
import { savedViewsKey } from '../saved-views';
import { STAYS, stayList, type Stay } from './list-fixtures';
import { SCOPE, addressNow, namesInTable, openMenu, pretendToBeAPhone, renderList, settle, stayTable } from './list-harness';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn() }));

const ALL = '/app/short-rent/bookings?chip=all';

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** What the CSV saved says: the bytes start with the mark of UTF-8, and the rest is the text. */
async function savedCsv(call = 0) {
  const [blob, fileName] = vi.mocked(saveBlobAs).mock.calls[call];
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { fileName, mark: Array.from(bytes.slice(0, 3)), text: new TextDecoder().decode(bytes.slice(3)) };
}

const checkbox = (name: string) => within(stayTable()).getByRole('checkbox', { name });
const bulkBar = () => screen.getByRole('region', { name: 'Actions on the selected rows' });

describe('ListView, selecting rows', () => {
  it('shows a bar of actions as soon as a row is selected, and takes it away when none is', () => {
    renderList({ initial: ALL });
    expect(screen.queryByRole('region', { name: 'Actions on the selected rows' })).not.toBeInTheDocument();

    fireEvent.click(checkbox('Mario Rossi'));

    expect(within(bulkBar()).getByRole('status')).toHaveTextContent('1 selected');
    for (const name of ['Send the link', 'Remove', 'Export the selection (CSV)', 'Clear selection']) {
      expect(within(bulkBar()).getByRole('button', { name })).toBeInTheDocument();
    }
    fireEvent.click(checkbox('Mario Rossi'));
    expect(screen.queryByRole('region', { name: 'Actions on the selected rows' })).not.toBeInTheDocument();
  });

  it('selects all the rows on the screen with the box of the header, and clears them with the button of the bar', () => {
    renderList();

    fireEvent.click(within(stayTable()).getByRole('checkbox', { name: 'Select all rows' }));
    expect(within(bulkBar()).getByRole('status')).toHaveTextContent('3 selected');

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Actions on the selected rows' })).not.toBeInTheDocument();
    expect(checkbox('Mario Rossi')).not.toBeChecked();
  });

  it('forgets the selection when the rows change under it (another quick filter, another search, another page)', () => {
    renderList({ initial: ALL });
    fireEvent.click(checkbox('Mario Rossi'));
    expect(bulkBar()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('region', { name: 'Actions on the selected rows' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(checkbox('Mario Rossi')).not.toBeChecked();
  });

  it('runs an action on the selected rows only, tells how many, and offers to undo it', async () => {
    const onAction = vi.fn();
    renderList({ initial: ALL, list: stayList({ onAction }) });
    fireEvent.click(checkbox('Mario Rossi'));
    fireEvent.click(checkbox('Anna Bianchi'));

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Send the link' }));
    await settle();

    expect(onAction).toHaveBeenCalledWith('send-link:s2,s1', expect.anything());
    expect(toast.success).toHaveBeenCalledWith('Link sent to 2', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    // The rows were dealt with: nothing is selected any more.
    expect(screen.queryByRole('region', { name: 'Actions on the selected rows' })).not.toBeInTheDocument();

    // "Undo" does the opposite, to the same rows.
    const { action } = vi.mocked(toast.success).mock.calls[0][1] as { action: { onClick: () => void } };
    action.onClick();
    await settle();
    expect(onAction).toHaveBeenCalledWith('unsend-link:s2,s1', expect.anything());
  });

  it('asks first for what cannot be taken back, and does nothing if the person says no', async () => {
    const onAction = vi.fn();
    renderList({ initial: ALL, list: stayList({ onAction }) });
    fireEvent.click(checkbox('Mario Rossi'));
    fireEvent.click(checkbox('Anna Bianchi'));

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Remove' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Remove 2 stays?' }));
    expect(dialog.getByText('The guests are told.')).toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onAction).not.toHaveBeenCalled();
    expect(bulkBar()).toBeInTheDocument();

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Remove 2 stays?' })).getByRole('button', { name: 'Remove the stays' }));
    await settle();

    expect(onAction).toHaveBeenCalledWith('remove:s2,s1', expect.anything());
    expect(toast.success).toHaveBeenCalledWith('Remove: 2 rows');
  });

  it('tells the person when an action fails, and keeps the selection', async () => {
    const failing = stayList({
      extra: {
        bulk: [{ id: 'boom', label: 'Boom', run: () => Promise.reject(new Error('no')) }],
      },
    });
    renderList({ initial: ALL, list: failing });
    fireEvent.click(checkbox('Mario Rossi'));

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Boom' }));
    await settle();

    expect(toast.error).toHaveBeenCalledWith('The action did not work. Try again.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(bulkBar()).getByRole('status')).toHaveTextContent('1 selected');
  });

  it('has no boxes and no bar for a list with no actions on many', () => {
    renderList({ initial: ALL, list: stayList({ withBulk: false }) });

    expect(within(stayTable()).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps the boxes of the cards for the person who asks to select, on a phone, and a swipe is off meanwhile', () => {
    renderList({ initial: ALL });
    const cards = screen.getByRole('list', { name: 'Stays' });
    expect(within(cards).queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Select more rows' }));

    expect(screen.getByTestId('list-select-hint')).toHaveTextContent('Tap the rows you want to select.');
    expect(within(cards).getAllByRole('checkbox').length).toBeGreaterThan(1);

    fireEvent.click(within(screen.getByTestId('list-select-hint')).getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('list-select-hint')).not.toBeInTheDocument();
    expect(within(cards).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('ListView, the CSV', () => {
  it('saves the rows that are on the screen, with the columns that are on, in a file named after the list and the day', async () => {
    renderList({ initial: ALL });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Export 6 rows (CSV)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export 6 rows (CSV)' }));

    const csv = await savedCsv();
    expect(csv.mark).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.fileName).toMatch(/^stays-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csv.text.split('\r\n');
    expect(lines[0]).toBe('"Guest","Dates","Channel","Status","Total"');
    expect(lines).toHaveLength(7);
    // In the order of the list, as the person sees it.
    expect(lines[1]).toBe('"Luigi Verdi","2026-09-20 → 2026-09-24","direct","Done","610"');
    expect(lines[3]).toBe('"Anna Bianchi","2026-10-10 → 2026-10-13","airbnb","Confirmed","380.5"');
    expect(toast.success).toHaveBeenCalledWith('Export ready: 6 rows in the CSV file (it opens in Excel).');
  });

  it('writes what could be read as a formula as text', async () => {
    renderList({ initial: ALL });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export 6 rows (CSV)' }));

    const { text } = await savedCsv();

    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""clicca"")"`);
    expect(text).not.toMatch(/(^|,)"=HYPERLINK/m);
  });

  it('follows the filters and the columns that are on', async () => {
    renderList({ initial: `${ALL}&f_property=trullo&cols=guest,email` });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export 3 rows (CSV)' }));

    const { text } = await savedCsv();

    expect(text.split('\r\n')).toEqual(['"Guest","Email"', '"Zoë Müller","zoe@example.com"', '"Anna Bianchi","anna@example.com"', '"Chiara Neri","chiara@example.com"']);
  });

  it('follows the search', async () => {
    renderList({ initial: `${ALL}&q=zoe` });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Export 1 row (CSV)' }));

    const { text } = await savedCsv();

    expect(text.split('\r\n')).toHaveLength(2);
    expect(text).toContain('"Zoë Müller"');
  });

  it('uses `;` and the decimal comma in Italian, where Excel wants them', async () => {
    await i18n.changeLanguage('it');
    renderList({ initial: ALL });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Colonne, ordine ed esportazione' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Esporta 6 righe (CSV)' }));

    const { text } = await savedCsv();

    expect(text.split('\r\n')[0]).toBe('"Guest";"Dates";"Channel";"Status";"Total"');
    expect(text).toContain('"380,5"');
  });

  it('saves only the selected rows from the bar', async () => {
    renderList({ initial: ALL });
    fireEvent.click(checkbox('Mario Rossi'));
    fireEvent.click(checkbox('Zoë Müller'));

    fireEvent.click(within(bulkBar()).getByRole('button', { name: 'Export the selection (CSV)' }));

    const { text } = await savedCsv();
    expect(text.split('\r\n').slice(1)).toEqual(['"Zoë Müller","2026-10-07 → 2026-10-11","booking","In progress","520"', '"Mario Rossi","2026-10-12 → 2026-10-15","direct","Pending","450"']);
  });

  it('has no export where the list has none, or nothing to export', () => {
    const { unmount } = renderList({ initial: ALL, list: stayList({ extra: { csv: false } }) });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    expect(screen.queryByRole('menuitem', { name: /Export/ })).not.toBeInTheDocument();
    unmount();
    cleanup();

    renderList({ initial: '/app/short-rent/bookings?chip=done&f_property=trullo' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    expect(screen.queryByRole('menuitem', { name: /Export/ })).not.toBeInTheDocument();
  });

  it('says that it is the page, not the whole list, when a server pages it', async () => {
    renderList({ rows: [STAYS[0], STAYS[1]], props: { mode: 'server', totalCount: 45, pageSize: 20 } });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });

    expect(await screen.findByRole('menuitem', { name: 'Export this page (2 rows, CSV)' })).toBeInTheDocument();
  });
});

describe('ListView, the actions of a row', () => {
  it('shows the one action of a row where there is one, and runs it', () => {
    const onAction = vi.fn();
    renderList({ list: stayList({ onAction }) });
    const table = within(stayTable());

    // Only Mario's request waits for an answer.
    expect(table.getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
    fireEvent.click(table.getByRole('button', { name: 'Accept' }));

    expect(onAction).toHaveBeenCalledWith('accept', expect.objectContaining({ id: 's1' }));
  });

  it('does not open the row when its action or its menu is pressed', () => {
    renderList({ list: stayList({ withDetail: true }) });

    fireEvent.click(within(stayTable()).getByRole('button', { name: 'Accept' }));
    fireEvent.keyDown(within(stayTable()).getByRole('button', { name: 'More actions: Mario Rossi' }), { key: 'Enter' });

    expect(screen.queryByTestId('list-detail-panel')).not.toBeInTheDocument();
  });

  it('puts the other actions in the menu, with a name that says whose', async () => {
    const onAction = vi.fn();
    renderList({ list: stayList({ onAction }) });

    const menu = within(await openMenu(within(stayTable()).getByRole('button', { name: 'More actions: Mario Rossi' })));

    expect(menu.getByRole('menuitem', { name: 'Open the stay' })).toHaveAttribute('href', '/app/short-rent/bookings/s1');
    fireEvent.click(menu.getByRole('menuitem', { name: 'Cancel the stay' }));
    expect(onAction).toHaveBeenCalledWith('cancel', expect.objectContaining({ id: 's1' }));
  });

  it('adds to the menu what a swipe does, since a gesture is never the only way, and not what the menu has already', async () => {
    const onAction = vi.fn();
    renderList({ list: stayList({ onAction }) });

    // Anna's stay is confirmed: a swipe to the left registers the arrival, one to the right writes to her.
    const menu = within(await openMenu(within(stayTable()).getByRole('button', { name: 'More actions: Anna Bianchi' })));

    expect(menu.getByRole('menuitem', { name: 'Arrival' })).toBeInTheDocument();
    expect(menu.getByRole('menuitem', { name: 'Write' })).toBeInTheDocument();
    fireEvent.click(menu.getByRole('menuitem', { name: 'Arrival' }));
    expect(onAction).toHaveBeenCalledWith('arrive', expect.objectContaining({ id: 's2' }));
  });

  it('does not repeat an action that is in the menu and under a swipe', async () => {
    const list = stayList({
      extra: {
        menu: () => [{ id: 'write', label: 'Write to the guest', onSelect: () => undefined }],
      },
    });
    renderList({ list });

    const menu = within(await openMenu(within(stayTable()).getByRole('button', { name: 'More actions: Anna Bianchi' })));

    // "write" is the same action under the swipe: it is in the menu once, with the name the menu gives it.
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Write to the guest', 'Arrival']);
  });

  it('has no column of actions, and no "⋯", for a list with none', () => {
    renderList({ list: stayList({ withSwipe: false, extra: { primaryAction: undefined, menu: undefined } }) });

    expect(within(stayTable()).queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument();
    expect(within(stayTable()).queryByRole('columnheader', { name: 'Row actions' })).not.toBeInTheDocument();
  });
});

describe('ListView, opening a row', () => {
  it('goes to the page of the row when its name or the row is pressed', () => {
    renderList();

    // Pressing the row (the cell of the channel), not the link: the person has a mouse and no wish to aim.
    fireEvent.click(within(screen.getAllByTestId('list-row-s2')[0]).getByText('airbnb'));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/app/short-rent/bookings/s2');
  });

  it('opens a drawer with what the list says about the row, from the name and from the row', async () => {
    renderList({ list: stayList({ withDetail: true }) });

    fireEvent.click(within(stayTable()).getByRole('button', { name: 'Anna Bianchi' }));

    const drawer = within(await screen.findByRole('dialog', { name: 'Anna Bianchi' }));
    expect(drawer.getByTestId('detail-body')).toHaveTextContent('Detail of s2');
    expect(drawer.getByText('2026-10-10 → 2026-10-13')).toBeInTheDocument();
    expect(drawer.getByRole('link', { name: 'Open the full page' })).toHaveAttribute('href', '/app/short-rent/bookings/s2');
    // The address does not change: the drawer is not a page.
    expect(addressNow()).toBe('');
  });

  it('opens the same drawer from a press on the row, and gives the focus back to the name when it closes', async () => {
    renderList({ list: stayList({ withDetail: true }) });
    const name = within(stayTable()).getByRole('button', { name: 'Anna Bianchi' });

    fireEvent.click(within(screen.getAllByTestId('list-row-s2')[0]).getByText('airbnb'));
    expect(await screen.findByRole('dialog', { name: 'Anna Bianchi' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(name).toHaveFocus());
  });

  it('is a sheet from the bottom on a phone', async () => {
    const restore = pretendToBeAPhone();
    try {
      renderList({ list: stayList({ withDetail: true }) });
      fireEvent.click(within(stayTable()).getByRole('button', { name: 'Anna Bianchi' }));

      const dialog = await screen.findByRole('dialog', { name: 'Anna Bianchi' });
      expect(dialog).toHaveAttribute('data-dialog-sheet');
    } finally {
      restore();
    }
  });

  it('closes the drawer if the row is not there any more', async () => {
    const list = stayList({ withDetail: true });
    function Dropping() {
      const [rows, setRows] = useState<readonly Stay[]>(STAYS);
      return (
        <>
          <ListView list={list} rows={rows} />
          <button type="button" onClick={() => setRows(STAYS.filter((stay) => stay.id !== 's2'))}>
            drop the row
          </button>
        </>
      );
    }
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Dropping />
        </MemoryRouter>
      </I18nextProvider>,
    );
    fireEvent.click(within(stayTable()).getByRole('button', { name: 'Anna Bianchi' }));
    await screen.findByRole('dialog', { name: 'Anna Bianchi' });

    // The page behind a dialog is hidden from the accessibility tree: the button is found by its words.
    fireEvent.click(screen.getByText('drop the row'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ListView, the views', () => {
  const openViews = async () => openMenu(screen.getByTestId('list-views-button'));

  it('lists the views of the list, applies one, and ticks the one the list is in', async () => {
    renderList();

    fireEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'Arrivals this week' }));
    expect(addressNow()).toBe('?chip=all&f_arrival=2026-10-07..2026-10-14');
    expect(namesInTable()).toEqual(['Zoë Müller', 'Anna Bianchi', 'Mario Rossi']);

    const again = within(await openViews());
    expect(again.getByRole('menuitemradio', { name: 'Arrivals this week' })).toBeChecked();
  });

  it('keeps the view the person saves, under a name, where they will find it', async () => {
    renderList({ initial: '/app/short-rent/bookings?chip=pending&f_property=casa-bianca' });

    fireEvent.click(within(await openViews()).getByRole('menuitem', { name: 'Save this view…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Save this view' }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Name of the view' }), { target: { value: 'My requests' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save the view' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('View “My requests” saved');
    const stored = JSON.parse(window.localStorage.getItem(savedViewsKey('stays', SCOPE)) ?? '{}');
    expect(stored).toMatchObject({ version: 1, views: [{ name: 'My requests', query: 'chip=pending&f_property=casa-bianca' }] });

    // It is in the menu under "My views", and applying it brings the list back to what it was.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(addressNow()).toBe('?chip=all&f_property=casa-bianca');
    fireEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'My requests' }));
    expect(addressNow()).toBe('?chip=pending&f_property=casa-bianca');
  });

  it('does not save a view without a name, and says so', async () => {
    renderList();

    fireEvent.click(within(await openViews()).getByRole('menuitem', { name: 'Save this view…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Save this view' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save the view' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('Write a name for the view.');
    expect(window.localStorage.getItem(savedViewsKey('stays', SCOPE))).toBeNull();
  });

  it('keeps the views of a person to that person, and of an area to that area', async () => {
    window.localStorage.setItem(
      savedViewsKey('stays', { userId: 'someone-else', context: 'short-rent' }),
      JSON.stringify({ version: 1, views: [{ id: 'x', name: 'Not mine', query: 'chip=done' }] }),
    );
    window.localStorage.setItem(
      savedViewsKey('stays', { userId: SCOPE.userId, context: 'long-rent' }),
      JSON.stringify({ version: 1, views: [{ id: 'y', name: 'Other area', query: 'chip=done' }] }),
    );
    window.localStorage.setItem(
      savedViewsKey('stays', SCOPE),
      JSON.stringify({ version: 1, views: [{ id: 'z', name: 'Mine here', query: 'chip=done' }] }),
    );
    renderList();

    const menu = within(await openViews());

    expect(menu.getByRole('menuitemradio', { name: 'Mine here' })).toBeInTheDocument();
    expect(menu.queryByRole('menuitemradio', { name: 'Not mine' })).not.toBeInTheDocument();
    expect(menu.queryByRole('menuitemradio', { name: 'Other area' })).not.toBeInTheDocument();
  });

  it('deletes a saved view, and brings it back with "Undo"', async () => {
    window.localStorage.setItem(
      savedViewsKey('stays', SCOPE),
      JSON.stringify({ version: 1, views: [{ id: 'a', name: 'First', query: 'chip=done' }, { id: 'b', name: 'Second', query: 'chip=all' }] }),
    );
    renderList();

    fireEvent.click(within(await openViews()).getByRole('menuitem', { name: 'Delete a saved view…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete a view' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete the view: First' }));

    expect(toast.success).toHaveBeenCalledWith('View “First” deleted', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    expect(JSON.parse(window.localStorage.getItem(savedViewsKey('stays', SCOPE)) ?? '{}').views.map((view: { name: string }) => view.name)).toEqual(['Second']);

    const { action } = vi.mocked(toast.success).mock.calls[0][1] as { action: { onClick: () => void } };
    await act(async () => {
      action.onClick();
    });
    expect(JSON.parse(window.localStorage.getItem(savedViewsKey('stays', SCOPE)) ?? '{}').views.map((view: { name: string }) => view.name)).toEqual(['First', 'Second']);
  });

  it('keeps the menu for the views of the list when there is nobody to save for, and has no menu when there are none at all', () => {
    const { unmount } = renderList({ props: { viewsScope: null } });
    expect(screen.getByTestId('list-views-button')).toBeInTheDocument();
    unmount();
    cleanup();

    renderList({ list: stayList({ extra: { views: [] } }), props: { viewsScope: null } });
    expect(screen.queryByTestId('list-views-button')).not.toBeInTheDocument();
  });

  it('does not offer to save a view when there is nobody to keep it for', async () => {
    renderList({ props: { viewsScope: null } });

    const menu = within(await openViews());

    expect(menu.getByRole('menuitemradio', { name: 'Arrivals this week' })).toBeInTheDocument();
    expect(menu.queryByRole('menuitem', { name: 'Save this view…' })).not.toBeInTheDocument();
  });
});

describe('ListView, the layout', () => {
  it('switches between the list and the columns with the buttons, and the address says which', () => {
    renderList();
    expect(screen.queryByTestId('list-board')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(addressNow()).toBe('?view=board');
    expect(screen.getByTestId('list-board')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // The columns start from the quick filter for everything: with "Upcoming" most of them would be empty.
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(addressNow()).toBe('');
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no such buttons for a list with no columns view', () => {
    renderList({ list: stayList({ withBoard: false }) });

    expect(screen.queryByTestId('list-layout')).not.toBeInTheDocument();
  });
});

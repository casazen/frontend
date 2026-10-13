import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { stayList } from './list-fixtures';
import { addressNow, openMenu, pretendToBeAPhone, renderList, settle } from './list-harness';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

const BOARD = '/app/short-rent/bookings?view=board';

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // `elementFromPoint` is put in place by the tests that drag.
  Reflect.deleteProperty(document, 'elementFromPoint');
});

const column = (id: string) => document.querySelector<HTMLElement>(`[data-board-column="${id}"]`)!;
const card = (id: string) => screen.getByTestId(`list-board-card-${id}`);

/** The ghost of the card being dragged: a fixed copy of it, outside the board. */
const ghost = () => document.body.querySelector<HTMLElement>('[data-board-ghost]');

function pointerAt(target: Element | null) {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target });
}

describe('ListView, the columns by state', () => {
  it('shows a column for each state, with its cards and how many, and says when a column has none', () => {
    renderList({ initial: BOARD });

    expect(within(column('pending')).getByRole('heading', { name: 'Requests' })).toBeInTheDocument();
    expect(within(column('pending')).getByLabelText('1 item')).toBeInTheDocument();
    expect(within(column('confirmed')).getByLabelText('2 items')).toBeInTheDocument();
    expect(within(column('confirmed')).getByRole('link', { name: 'Anna Bianchi' })).toHaveAttribute('href', '/app/short-rent/bookings/s2');
    expect(within(column('inProgress')).getByText('Zoë Müller')).toBeInTheDocument();
    expect(within(column('done')).getByText('Luigi Verdi')).toBeInTheDocument();
  });

  it('says what an empty column is for', () => {
    renderList({ initial: `${BOARD}&q=zoe&chip=all` });

    expect(within(column('pending')).getByText('No requests')).toBeInTheDocument();
    expect(within(column('confirmed')).getByText('Nothing confirmed')).toBeInTheDocument();
    expect(within(column('inProgress')).getByText('Zoë Müller')).toBeInTheDocument();
  });

  it('applies the search and the filters of the list to the cards', () => {
    renderList({ initial: `${BOARD}&f_channel=airbnb` });

    expect(within(column('confirmed')).getAllByRole('link').map((link) => link.textContent)).toEqual(['Anna Bianchi', '=HYPERLINK("http://evil.example","clicca")']);
    expect(within(column('pending')).queryByText('Mario Rossi')).not.toBeInTheDocument();
  });

  it('shows the action of a card and the title that opens it, and the group is named for a screen reader', () => {
    renderList({ initial: BOARD });

    expect(screen.getByRole('group', { name: 'Columns by status' })).toBeInTheDocument();
    expect(within(card('s1')).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(card('s1')).getByRole('link', { name: 'Mario Rossi' })).toHaveAttribute('href', '/app/short-rent/bookings/s1');
  });

  it('shows placeholders while it loads, and a way to try again when it fails', () => {
    const { unmount } = renderList({ initial: BOARD, rows: [], props: { isLoading: true } });
    expect(screen.getAllByRole('status', { hidden: true }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('list-board')).not.toBeInTheDocument();
    unmount();

    const onRetry = vi.fn();
    renderList({ initial: BOARD, rows: [], props: { isError: true, onRetry } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says that nothing passes the filters, instead of a board of empty columns', () => {
    renderList({ initial: `${BOARD}&q=nobody` });

    expect(screen.getByText('No stay with these filters')).toBeInTheDocument();
    expect(screen.queryByTestId('list-board')).not.toBeInTheDocument();
  });
});

describe('ListView, moving a card with its menu', () => {
  const moveMenu = (id: string) => openMenu(screen.getByTestId(`list-board-menu-${id}`));

  it('offers the other columns, and the other actions of the row after them', async () => {
    renderList({ initial: BOARD });

    const menu = within(await moveMenu('s1'));

    expect(menu.getByText('Move to…')).toBeInTheDocument();
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Move to “Confirmed”',
      'Move to “In progress”',
      'Move to “Done”',
      'Open the stay',
      'Cancel the stay',
      'Write',
    ]);
  });

  it('moves it, and tells the person', async () => {
    const onAction = vi.fn();
    renderList({ initial: BOARD, list: stayList({ onAction }) });

    fireEvent.click(within(await moveMenu('s1')).getByRole('menuitem', { name: 'Move to “Confirmed”' }));
    await settle();

    expect(onAction).toHaveBeenCalledWith('move:pending->confirmed', expect.objectContaining({ id: 's1' }));
    expect(toast.success).toHaveBeenCalledWith('Moved', { description: undefined });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('says why a move is not allowed, and does not call it a success', async () => {
    renderList({ initial: BOARD });

    fireEvent.click(within(await moveMenu('s1')).getByRole('menuitem', { name: 'Move to “Done”' }));
    await settle();

    expect(toast.warning).toHaveBeenCalledWith('Cannot move it here', { description: 'A stay is done after the departure.' });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('offers to undo a move that can be taken back', async () => {
    const undo = vi.fn();
    const list = stayList({
      extra: {
        board: {
          columns: [
            { id: 'pending', label: 'Requests', test: (stay) => stay.status === 'pending', empty: '-' },
            { id: 'confirmed', label: 'Confirmed', test: (stay) => stay.status === 'confirmed', empty: '-' },
          ],
          onMove: () => ({ ok: true, title: 'Moved to confirmed', description: 'The guest is told.', undo }),
        },
      },
    });
    renderList({ initial: BOARD, list });

    fireEvent.click(within(await moveMenu('s1')).getByRole('menuitem', { name: 'Move to “Confirmed”' }));
    await settle();

    expect(toast.success).toHaveBeenCalledWith('Moved to confirmed', expect.objectContaining({ description: 'The guest is told.', action: expect.objectContaining({ label: 'Undo' }) }));
    const { action } = vi.mocked(toast.success).mock.calls[0][1] as { action: { onClick: () => void } };
    action.onClick();
    await settle();
    expect(undo).toHaveBeenCalled();
  });

  it('says nothing when the page has told the person itself', async () => {
    const list = stayList({
      extra: {
        board: {
          columns: [
            { id: 'pending', label: 'Requests', test: (stay) => stay.status === 'pending', empty: '-' },
            { id: 'confirmed', label: 'Confirmed', test: (stay) => stay.status === 'confirmed', empty: '-' },
          ],
          onMove: () => undefined,
        },
      },
    });
    renderList({ initial: BOARD, list });

    fireEvent.click(within(await moveMenu('s1')).getByRole('menuitem', { name: 'Move to “Confirmed”' }));
    await settle();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('tells the person when the move fails', async () => {
    const list = stayList({
      extra: {
        board: {
          columns: [
            { id: 'pending', label: 'Requests', test: (stay) => stay.status === 'pending', empty: '-' },
            { id: 'confirmed', label: 'Confirmed', test: (stay) => stay.status === 'confirmed', empty: '-' },
          ],
          onMove: () => Promise.reject(new Error('no')),
        },
      },
    });
    renderList({ initial: BOARD, list });

    fireEvent.click(within(await moveMenu('s1')).getByRole('menuitem', { name: 'Move to “Confirmed”' }));
    await settle();

    expect(toast.error).toHaveBeenCalledWith('It could not be moved. Try again.');
  });
});

describe('ListView, dragging a card with the mouse', () => {
  const press = (target: Element, init: Record<string, unknown> = {}) =>
    fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10, ...init });

  it('lights the column it is over, moves the card where it is let go, and tidies up', async () => {
    const onAction = vi.fn();
    renderList({ initial: BOARD, list: stayList({ onAction }) });
    pointerAt(column('confirmed'));

    press(within(card('s1')).getByText('2026-10-12 → 2026-10-15'));
    // Not yet picked up: it has not moved far enough to be more than a click.
    fireEvent.pointerMove(window, { clientX: 12, clientY: 12 });
    expect(ghost()).toBeNull();

    fireEvent.pointerMove(window, { clientX: 80, clientY: 60 });
    expect(ghost()).not.toBeNull();
    expect(ghost()).toHaveTextContent('Mario Rossi');
    expect(card('s1')).toHaveAttribute('data-dragging', 'true');
    expect(column('confirmed').className).toContain('border-dashed');
    expect(column('done').className).not.toContain('border-dashed');

    fireEvent.pointerUp(window, { clientX: 80, clientY: 60 });
    await settle();

    expect(onAction).toHaveBeenCalledWith('move:pending->confirmed', expect.objectContaining({ id: 's1' }));
    expect(ghost()).toBeNull();
    expect(card('s1')).not.toHaveAttribute('data-dragging');
    expect(document.body.style.userSelect).toBe('');
  });

  it('says why when the card is dropped where it cannot go', async () => {
    renderList({ initial: BOARD });
    pointerAt(column('done'));

    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });
    await settle();

    expect(toast.warning).toHaveBeenCalledWith('Cannot move it here', { description: 'A stay is done after the departure.' });
  });

  it('does nothing when the card is let go where it came from, or outside every column', async () => {
    const onAction = vi.fn();
    renderList({ initial: BOARD, list: stayList({ onAction }) });

    pointerAt(column('pending'));
    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });

    pointerAt(document.body);
    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });
    await settle();

    expect(onAction).not.toHaveBeenCalled();
    expect(ghost()).toBeNull();
  });

  it('puts the card back on Escape', async () => {
    const onAction = vi.fn();
    renderList({ initial: BOARD, list: stayList({ onAction }) });
    pointerAt(column('confirmed'));

    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    expect(ghost()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });
    await settle();

    expect(ghost()).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('is not a drag when the press is on a button or a link of the card, with a finger, or with another button of the mouse', () => {
    renderList({ initial: BOARD });
    pointerAt(column('confirmed'));

    for (const [target, init] of [
      [within(card('s1')).getByRole('button', { name: 'Accept' }), {}],
      [within(card('s1')).getByRole('link', { name: 'Mario Rossi' }), {}],
      [card('s1'), { pointerType: 'touch' }],
      [card('s1'), { button: 2 }],
    ] as const) {
      press(target, init);
      fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
      expect(ghost()).toBeNull();
      fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });
    }
  });

  it('swallows the click that ends a drag, so that a card dropped on its own title does not open', async () => {
    renderList({ initial: BOARD });
    pointerAt(column('confirmed'));
    const link = within(card('s1')).getByRole('link', { name: 'Mario Rossi' });
    const clicked = vi.fn();
    link.addEventListener('click', clicked);

    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    fireEvent.pointerUp(window, { clientX: 90, clientY: 50 });
    fireEvent.click(link);
    await settle();

    expect(clicked).not.toHaveBeenCalled();
    // The click after that one is the person's again.
    fireEvent.click(link);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('does not leave the ghost on the page if the list goes away in the middle of a drag', () => {
    const { unmount } = renderList({ initial: BOARD });
    pointerAt(column('confirmed'));

    press(card('s1'));
    fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });
    expect(ghost()).not.toBeNull();
    unmount();

    expect(ghost()).toBeNull();
    expect(document.body.style.userSelect).toBe('');
  });

  it('does not drag at all on a phone, even with a mouse: the menu of the card is the way there', () => {
    const restore = pretendToBeAPhone();
    try {
      renderList({ initial: BOARD });
      pointerAt(column('confirmed'));
      expect(card('s1').className).not.toContain('cursor-grab');

      press(card('s1'));
      fireEvent.pointerMove(window, { clientX: 90, clientY: 50 });

      expect(ghost()).toBeNull();
    } finally {
      restore();
    }
  });
});

describe('ListView, the title of a card', () => {
  it('opens the drawer of the row when the list has one', async () => {
    renderList({ initial: BOARD, list: stayList({ withDetail: true }) });

    fireEvent.click(within(card('s2')).getByRole('button', { name: 'Anna Bianchi' }));

    expect(await screen.findByRole('dialog', { name: 'Anna Bianchi' })).toBeInTheDocument();
    expect(addressNow()).toBe('?view=board');
    await waitFor(() => expect(screen.getByTestId('detail-body')).toHaveTextContent('Detail of s2'));
  });
});

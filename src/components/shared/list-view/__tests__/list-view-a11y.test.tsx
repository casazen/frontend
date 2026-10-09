import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { savedViewsKey } from '../saved-views';
import { STAYS, stayList } from './list-fixtures';
import { SCOPE, openMenu, pretendToBeAPhone, renderList, stayTable } from './list-harness';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * What a screen reader and a keyboard need, found by axe in jsdom: names, roles, labels, the structure of tables and lists.
 * (The colors and the widths of a phone are checked in a browser by the Playwright spec.)
 */
describe('ListView, accessibility', () => {
  it('has no violation with rows, in the table and as cards', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?chip=all' });

    await expectNoAxeViolations(container);
  });

  it('has none with the columns the person added and a sort on', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?chip=all&cols=guest,email,code&sort=guest:desc' });

    await expectNoAxeViolations(container);
  });

  it('has none while rows are selected, with the bar of actions', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?chip=all' });
    fireEvent.click(within(stayTable()).getByRole('checkbox', { name: 'Select all rows' }));

    expect(screen.getByRole('region', { name: 'Actions on the selected rows' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('has none when the person is selecting from the cards of a phone', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?chip=all' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Select more rows' }));

    await expectNoAxeViolations(container);
  });

  it('has none with a filter on, its tag and the search', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?chip=all&f_property=trullo&q=an' });

    await expectNoAxeViolations(container);
  });

  it('has none while it loads, when it failed, when it is empty and when nothing passes the filters', async () => {
    for (const [initial, rows, props] of [
      ['/app/short-rent/bookings', [], { isLoading: true }],
      ['/app/short-rent/bookings', [], { isError: true, onRetry: vi.fn() }],
      ['/app/short-rent/bookings', [], {}],
      ['/app/short-rent/bookings?chip=done&f_property=trullo', undefined, {}],
    ] as const) {
      const { container, unmount } = renderList({ initial, ...(rows ? { rows } : {}), props });

      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('has none with a server paging it', async () => {
    const { container } = renderList({ rows: STAYS.slice(0, 2), props: { mode: 'server', totalCount: 45, pageSize: 20 } });

    await expectNoAxeViolations(container);
  });

  it('has none as columns by state', async () => {
    const { container } = renderList({ initial: '/app/short-rent/bookings?view=board' });

    await expectNoAxeViolations(container);
  });

  it('has none with the menu of a row open', async () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });
    await openMenu(within(stayTable()).getByRole('button', { name: 'More actions: Mario Rossi' }));

    await expectNoAxeViolations(document.body);
  });

  it('has none with the menu of a card of the columns open', async () => {
    renderList({ initial: '/app/short-rent/bookings?view=board' });
    await openMenu(screen.getByTestId('list-board-menu-s1'));

    await expectNoAxeViolations(document.body);
  });

  it('has none with the menu of the views open, with the views of the list and the person\'s own', async () => {
    window.localStorage.setItem(savedViewsKey('stays', SCOPE), JSON.stringify({ version: 1, views: [{ id: 'a', name: 'Mine', query: 'chip=done' }] }));
    renderList();
    await openMenu(screen.getByTestId('list-views-button'));

    await expectNoAxeViolations(document.body);
  });

  describe('panels', () => {
    it('has none with the panel of the filters open, in a drawer and as a sheet on a phone', async () => {
      renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
      await screen.findByRole('dialog', { name: 'Filters' });
      await expectNoAxeViolations(document.body);
      cleanup();

      const restore = pretendToBeAPhone();
      try {
        renderList();
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
        await screen.findByRole('dialog', { name: 'Filters' });
        await expectNoAxeViolations(document.body);
      } finally {
        restore();
      }
    });

    it('has none with the dialogs of the columns, the order, saving a view and deleting one', async () => {
      window.localStorage.setItem(savedViewsKey('stays', SCOPE), JSON.stringify({ version: 1, views: [{ id: 'a', name: 'Mine', query: 'chip=done' }] }));
      renderList();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Choose the columns…' }));
      await screen.findByRole('dialog', { name: 'Columns of the list' });
      await expectNoAxeViolations(document.body);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Sort by…' }));
      await screen.findByRole('dialog', { name: 'Sort by' });
      await expectNoAxeViolations(document.body);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      fireEvent.click(within(await openMenu(screen.getByTestId('list-views-button'))).getByRole('menuitem', { name: 'Save this view…' }));
      await screen.findByRole('dialog', { name: 'Save this view' });
      await expectNoAxeViolations(document.body);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      fireEvent.click(within(await openMenu(screen.getByTestId('list-views-button'))).getByRole('menuitem', { name: 'Delete a saved view…' }));
      await screen.findByRole('dialog', { name: 'Delete a view' });
      await expectNoAxeViolations(document.body);
    });

    it('has none with the drawer of a row open, and with the question before an action that cannot be taken back', async () => {
      renderList({ initial: '/app/short-rent/bookings?chip=all', list: stayList({ withDetail: true }) });

      fireEvent.click(within(stayTable()).getByRole('button', { name: 'Anna Bianchi' }));
      await screen.findByRole('dialog', { name: 'Anna Bianchi' });
      await expectNoAxeViolations(document.body);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      fireEvent.click(within(stayTable()).getByRole('checkbox', { name: 'Mario Rossi' }));
      fireEvent.click(within(screen.getByRole('region', { name: 'Actions on the selected rows' })).getByRole('button', { name: 'Remove' }));
      await screen.findByRole('dialog', { name: 'Remove 1 stays?' });
      await expectNoAxeViolations(document.body);
    });
  });
});

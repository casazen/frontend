import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { STAYS, stayList } from './list-fixtures';
import { addressNow, goBack, namesInTable, renderList, stayCards, stayTable } from './list-harness';

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

const search = () => screen.getByRole('searchbox', { name: 'Search stays' });

describe('ListView, what it shows', () => {
  it('shows the rows of the default quick filter in the default order, in a table and as cards', () => {
    renderList();

    expect(namesInTable()).toEqual(['Anna Bianchi', 'Mario Rossi', '=HYPERLINK("http://evil.example","clicca")']);
    // The same three rows, as cards.
    expect(within(stayCards()).getAllByTestId(/^list-row-/)).toHaveLength(3);
    expect(screen.getByTestId('list-count')).toHaveTextContent('3 stays of 6');
  });

  it('shows the default columns, not the optional ones, and says which one the rows are sorted by', () => {
    renderList();
    const table = within(stayTable());

    for (const name of ['Guest', 'Dates', 'Channel', 'Status', 'Total']) {
      expect(table.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(table.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'Code' })).not.toBeInTheDocument();
    expect(table.getByRole('columnheader', { name: 'Dates' })).toHaveAttribute('aria-sort', 'ascending');
    expect(table.getByRole('columnheader', { name: 'Total' })).not.toHaveAttribute('aria-sort');
  });

  it('makes the name of a row the link to its page, in the table and on the card', () => {
    renderList();

    expect(within(stayTable()).getByRole('link', { name: 'Anna Bianchi' })).toHaveAttribute('href', '/app/short-rent/bookings/s2');
    expect(within(stayCards()).getByRole('link', { name: 'Anna Bianchi' })).toHaveAttribute('href', '/app/short-rent/bookings/s2');
  });

  it('puts the state top right on the card and the rest, in the order of the priorities, under the name', () => {
    renderList();
    const card = within(stayCards()).getByTestId('list-row-s1');

    // Mario Rossi: the title; then the dates (priority 3) as the line under it; the state (card status) apart; then the rest.
    expect(card).toHaveTextContent(/Mario Rossi.*2026-10-12 → 2026-10-15/s);
    expect(within(card).getByText('Pending')).toBeInTheDocument();
    expect(card).toHaveTextContent(/Total:\s*€ 450/);
    expect(card).toHaveTextContent(/Channel:\s*direct/);
  });

  it('marks the row that waits for an answer and the one that is over', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });

    expect(screen.getAllByTestId('list-row-s1')[0].className).toContain('var(--color-destructive)');
    expect(screen.getAllByTestId('list-row-s4')[0].className).toContain('text-foreground/70');
    expect(screen.getAllByTestId('list-row-s2')[0].className).not.toContain('var(--color-destructive)');
  });

  it('says how many rows there are, in the words of the list, and of how many', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });

    expect(screen.getByTestId('list-count')).toHaveTextContent('6 stays');
    expect(screen.getByTestId('list-count')).not.toHaveTextContent('of 6');
  });

  it('says it in Italian too', async () => {
    await i18n.changeLanguage('it');
    renderList({ list: stayList({ extra: { countLabel: undefined } }) });

    expect(screen.getByRole('button', { name: 'Filtri' })).toBeInTheDocument();
    expect(screen.getByTestId('list-count')).toHaveTextContent('3 risultati su 6');
  });
});

describe('ListView, the search', () => {
  it('searches without accents or capitals, a moment after the last key, and writes the search to the address', async () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });

    fireEvent.change(search(), { target: { value: 'ZOE muller' } });
    // Not yet: the person may still be typing.
    expect(addressNow()).toBe('?chip=all');
    await waitFor(() => expect(addressNow()).toBe('?q=ZOE+muller&chip=all'), { timeout: 3000 });

    expect(namesInTable()).toEqual(['Zoë Müller']);
    expect(screen.getByTestId('list-count')).toHaveTextContent('1 stay of 6');
    // What is typed stays in the box, as it was typed.
    expect(search()).toHaveValue('ZOE muller');
  });

  it('searches at once with Enter', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });

    fireEvent.change(search(), { target: { value: 'luigi' } });
    fireEvent.submit(search().closest('form')!);

    expect(addressNow()).toBe('?q=luigi&chip=all');
    expect(namesInTable()).toEqual(['Luigi Verdi']);
  });

  it('starts from the search that is in the address', () => {
    renderList({ initial: '/app/short-rent/bookings?q=anna&chip=all' });

    expect(search()).toHaveValue('anna');
    expect(namesInTable()).toEqual(['Anna Bianchi']);
  });

  it('follows the address when it changes by itself, with Back, and does not keep a search that was undone', async () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all' });
    fireEvent.change(search(), { target: { value: 'luigi' } });
    fireEvent.submit(search().closest('form')!);
    expect(namesInTable()).toEqual(['Luigi Verdi']);

    goBack();

    await waitFor(() => expect(search()).toHaveValue(''));
    expect(addressNow()).toBe('?chip=all');
    expect(namesInTable()).toHaveLength(6);
  });

  it('says what the search is for the screen reader, and shows it as a tag that takes it away', () => {
    renderList({ initial: '/app/short-rent/bookings?q=anna&chip=all' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove the filter: Search: “anna”' }));

    expect(addressNow()).toBe('?chip=all');
    expect(search()).toHaveValue('');
  });
});

describe('ListView, the quick filters', () => {
  it('shows a number only on the one that needs attention, and says so to a screen reader', () => {
    renderList();

    const pending = screen.getByRole('button', { name: /To confirm/ });
    expect(pending).toHaveTextContent('To confirm1');
    expect(pending).toHaveTextContent('1 needs attention');
    expect(screen.getByRole('button', { name: 'All' })).toHaveTextContent(/^All$/);
  });

  it('counts what the search and the filters leave, not the quick filter', () => {
    renderList({ initial: '/app/short-rent/bookings?f_channel=airbnb' });

    // Mario's request is direct: with the filter on Airbnb nothing is waiting any more.
    expect(screen.getByRole('button', { name: 'To confirm' })).not.toHaveTextContent('1');
  });

  it('presses one at a time and writes it to the address, without writing the default one', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /To confirm/ }));
    expect(addressNow()).toBe('?chip=pending');
    expect(screen.getByRole('button', { name: /To confirm/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'false');
    expect(namesInTable()).toEqual(['Mario Rossi']);

    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(addressNow()).toBe('');
  });

  it('keeps a step in the history for each, so that Back gives the one before', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'In progress' }));
    expect(addressNow()).toBe('?chip=inProgress');

    goBack();
    expect(addressNow()).toBe('?chip=done');
    goBack();
    expect(addressNow()).toBe('');
  });

  it('ignores a quick filter that the list does not have', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=nope' });

    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ListView, the filters', () => {
  const openFilters = async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    return screen.findByRole('dialog', { name: 'Filters' });
  };

  it('opens a panel with every filter and the number of results the choice gives', async () => {
    renderList();
    const panel = within(await openFilters());

    expect(panel.getByLabelText('Property')).toBeInTheDocument();
    expect(panel.getByRole('checkbox', { name: 'Airbnb' })).toBeInTheDocument();
    expect(panel.getByLabelText('From')).toBeInTheDocument();
    // The quick filter "Upcoming" has three rows.
    expect(panel.getByRole('button', { name: 'Show 3 results' })).toBeInTheDocument();

    fireEvent.change(panel.getByLabelText('Property'), { target: { value: 'trullo' } });
    expect(panel.getByRole('button', { name: 'Show 1 result' })).toBeInTheDocument();
  });

  it('applies them together, writes them to the address, and shows them as tags and on the button', async () => {
    renderList();
    const panel = within(await openFilters());

    fireEvent.change(panel.getByLabelText('Property'), { target: { value: 'casa-bianca' } });
    fireEvent.click(panel.getByRole('checkbox', { name: 'Direct' }));
    fireEvent.click(panel.getByRole('checkbox', { name: 'Airbnb' }));
    fireEvent.change(panel.getByLabelText('From'), { target: { value: '2026-10-11' } });
    fireEvent.click(panel.getByTestId('list-filters-apply'));

    expect(addressNow()).toBe('?f_property=casa-bianca&f_channel=direct%2Cairbnb&f_arrival=2026-10-11..');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Filters · 3' })).toBeInTheDocument();
    expect(namesInTable()).toEqual(['Mario Rossi', '=HYPERLINK("http://evil.example","clicca")']);
    expect(screen.getByRole('button', { name: 'Remove the filter: Property: Casa Bianca' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove the filter: Channel: Direct, Airbnb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove the filter: Arrival: from/ })).toBeInTheDocument();
  });

  it('starts the panel from the filters that are on', async () => {
    renderList({ initial: '/app/short-rent/bookings?f_property=trullo&f_channel=airbnb' });
    const panel = within(await openFilters());

    expect(panel.getByLabelText('Property')).toHaveValue('trullo');
    expect(panel.getByRole('checkbox', { name: 'Airbnb' })).toBeChecked();
    expect(panel.getByRole('checkbox', { name: 'Direct' })).not.toBeChecked();
  });

  it('takes one away with its tag, and all of them with "Clear the filters"', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all&f_property=trullo&f_channel=airbnb&q=anna' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove the filter: Property: Trullo' }));
    expect(addressNow()).toBe('?q=anna&chip=all&f_channel=airbnb');

    fireEvent.click(screen.getByTestId('list-clear'));
    // "Clear" leaves the quick filter for everything, not the one the list starts from.
    expect(addressNow()).toBe('?chip=all');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears the filters from the panel and closes it', async () => {
    renderList({ initial: '/app/short-rent/bookings?f_property=trullo' });
    const panel = within(await openFilters());

    fireEvent.click(panel.getByRole('button', { name: 'Clear' }));

    expect(addressNow()).toBe('');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument());
  });

  it('refuses a range that ends before it starts, and says so', async () => {
    renderList();
    const panel = within(await openFilters());

    fireEvent.change(panel.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(panel.getByLabelText('To'), { target: { value: '2026-10-01' } });

    expect(panel.getByRole('alert')).toHaveTextContent('The start date is after the end date.');
    expect(panel.getByTestId('list-filters-apply')).toBeDisabled();
  });

  it('gives the focus back to the button that opened the panel', async () => {
    renderList();
    const button = screen.getByRole('button', { name: 'Filters' });
    button.focus();
    const panel = within(await openFilters());

    fireEvent.click(panel.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(button).toHaveFocus());
  });

  it('has no filters button when the list has no filters', () => {
    renderList({ list: stayList({ extra: { filters: [] } }) });

    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
  });
});

describe('ListView, the columns and the order', () => {
  it('lets the person choose the columns, keeps the ones that cannot be hidden, and writes the choice to the address', async () => {
    renderList();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Choose the columns…' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Columns of the list' }));
    expect(dialog.getByRole('checkbox', { name: /Guest/ })).toBeDisabled();
    expect(dialog.getByRole('checkbox', { name: /Guest/ })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Channel' })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Email' })).not.toBeChecked();

    fireEvent.click(dialog.getByRole('checkbox', { name: 'Email' }));
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Channel' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));

    expect(addressNow()).toBe('?cols=guest%2Cdates%2Cstatus%2Ctotal%2Cemail');
    const table = within(stayTable());
    expect(table.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'Channel' })).not.toBeInTheDocument();
  });

  it('goes back to the default columns with "Reset"', async () => {
    renderList({ initial: '/app/short-rent/bookings?cols=guest,email' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Choose the columns…' }));

    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Columns of the list' })).getByRole('button', { name: 'Reset' }));

    expect(addressNow()).toBe('');
    expect(within(stayTable()).getByRole('columnheader', { name: 'Channel' })).toBeInTheDocument();
  });

  it('sorts by the column whose title is pressed, and the other way when it is pressed again', () => {
    renderList();
    const total = () => within(stayTable()).getByRole('columnheader', { name: 'Total' });

    fireEvent.click(within(total()).getByRole('button'));
    expect(addressNow()).toBe('?sort=total%3Aasc');
    expect(total()).toHaveAttribute('aria-sort', 'ascending');
    expect(namesInTable()).toEqual(['=HYPERLINK("http://evil.example","clicca")', 'Anna Bianchi', 'Mario Rossi']);

    fireEvent.click(within(total()).getByRole('button'));
    expect(addressNow()).toBe('?sort=total%3Adesc');
    expect(namesInTable()).toEqual(['Mario Rossi', 'Anna Bianchi', '=HYPERLINK("http://evil.example","clicca")']);
  });

  it('sorts from a dialog too, where there is no column title to press', async () => {
    renderList();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Columns, order and export' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sort by…' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Sort by' }));
    fireEvent.click(dialog.getByRole('radio', { name: 'Total' }));
    fireEvent.click(dialog.getByRole('radio', { name: /^Descending/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));

    expect(addressNow()).toBe('?sort=total%3Adesc');
    expect(namesInTable()[0]).toBe('Mario Rossi');
  });

  it('ignores a sort by a column that cannot be sorted', () => {
    renderList({ initial: '/app/short-rent/bookings?sort=channel:asc' });

    expect(within(stayTable()).getByRole('columnheader', { name: 'Dates' })).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('ListView, when there is nothing to show', () => {
  it('shows placeholders while it loads, and keeps the bar', () => {
    renderList({ rows: [], props: { isLoading: true } });

    expect(screen.getAllByRole('status', { hidden: true }).length).toBeGreaterThan(0);
    expect(search()).toBeInTheDocument();
    expect(screen.queryByTestId('list-count')).not.toBeInTheDocument();
  });

  it('says it failed, with a way to try again, and not that the list is empty', () => {
    const onRetry = vi.fn();
    renderList({ rows: [], props: { isError: true, onRetry, errorTitle: 'Could not load the stays' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the stays');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Your stays arrive here')).not.toBeInTheDocument();
  });

  it('explains what the list is for when it is empty, and offers what to do', () => {
    const onClick = vi.fn();
    renderList({
      rows: [],
      list: stayList({ extra: { empty: { title: 'Your stays arrive here', description: 'From your site.', action: { label: 'Add a stay', onClick } } } }),
    });

    expect(screen.getByText('Your stays arrive here')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a stay' }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByTestId('list-count')).not.toBeInTheDocument();
  });

  it('has no bar for searching and filtering when there is nothing at all, only what to do about it', () => {
    renderList({ rows: [] });

    expect(screen.getByText('Your stays arrive here')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('list-toolbar')).not.toBeInTheDocument();
  });

  it('says that nothing passes the filters, and clears them', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=done&f_property=trullo' });

    expect(screen.getByText('No stay with these filters')).toBeInTheDocument();
    expect(screen.getByText('Try removing a filter.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // The button of the empty state (the bar has one too, for the tags).
    fireEvent.click(within(screen.getByText('No stay with these filters').parentElement!).getByRole('button', { name: 'Clear the filters' }));

    expect(addressNow()).toBe('?chip=all');
    expect(namesInTable()).toHaveLength(6);
  });

  it('is not "empty" when the rows are there and the search finds none of them', () => {
    renderList({ initial: '/app/short-rent/bookings?chip=all&q=nobody' });

    expect(screen.queryByText('Your stays arrive here')).not.toBeInTheDocument();
    expect(screen.getByText('No stay with these filters')).toBeInTheDocument();
  });

  it('dims the rows while the next ones are on their way', () => {
    renderList({ props: { isRefreshing: true } });

    expect(screen.getByRole('region', { name: 'Stays' })).toHaveAttribute('aria-busy', 'true');
    expect(namesInTable()).toHaveLength(3);
  });
});

describe('ListView, the rows come from a server', () => {
  const page = [STAYS[0], STAYS[1]];

  it('shows the rows as they are given and does not filter them again', () => {
    renderList({ rows: page, props: { mode: 'server', totalCount: 45, pageSize: 20 } });

    // The quick filter is "Upcoming" and would keep both anyway: with a search that matches neither, a client would show none.
    expect(namesInTable()).toEqual(['Mario Rossi', 'Anna Bianchi']);
    expect(screen.getByTestId('list-count')).toHaveTextContent('45 stays');
  });

  it('does not sort them either, only says which column the page sorts by', () => {
    renderList({ rows: page, initial: '/app/short-rent/bookings?sort=guest:asc', props: { mode: 'server', totalCount: 2, pageSize: 20 } });

    expect(namesInTable()).toEqual(['Mario Rossi', 'Anna Bianchi']);
    expect(within(stayTable()).getByRole('columnheader', { name: 'Guest' })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('pages: previous and next write the page to the address, and the first page has no previous', () => {
    renderList({ rows: page, props: { mode: 'server', totalCount: 45, pageSize: 20 } });
    const nav = within(screen.getByRole('navigation', { name: 'Pages of the list' }));

    expect(nav.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(nav.getByRole('button', { name: 'Next' }));
    expect(addressNow()).toBe('?page=2');
    expect(nav.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Previous' })).toBeEnabled();

    fireEvent.click(nav.getByRole('button', { name: 'Next' }));
    expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('has no pages when everything fits in one', () => {
    renderList({ rows: page, props: { mode: 'server', totalCount: 2, pageSize: 20 } });

    expect(screen.queryByRole('navigation', { name: 'Pages of the list' })).not.toBeInTheDocument();
  });

  it('goes back to the first page when the search, the filters or the quick filter change', () => {
    renderList({ rows: page, initial: '/app/short-rent/bookings?page=3', props: { mode: 'server', totalCount: 45, pageSize: 20 } });

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(addressNow()).toBe('?chip=done');
  });

  it('shows the numbers of the quick filters that the page counted', () => {
    renderList({ rows: page, props: { mode: 'server', totalCount: 45, pageSize: 20, chipCounts: { pending: 12 } } });

    expect(screen.getByRole('button', { name: /To confirm/ })).toHaveTextContent('To confirm12');
  });

  it('cannot say how many results a choice of filters gives, and says "Show the results"', async () => {
    renderList({ rows: page, props: { mode: 'server', totalCount: 45, pageSize: 20 } });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    expect(await screen.findByRole('button', { name: 'Show the results' })).toBeInTheDocument();
  });

  it('tells "nothing yet" from "nothing found"', () => {
    const { unmount } = renderList({ rows: [], initial: '/app/short-rent/bookings?chip=all', props: { mode: 'server', totalCount: 0, pageSize: 20 } });
    expect(screen.getByText('Your stays arrive here')).toBeInTheDocument();
    unmount();

    renderList({ rows: [], initial: '/app/short-rent/bookings?chip=all&q=zzz', props: { mode: 'server', totalCount: 0, pageSize: 20 } });
    expect(screen.getByText('No stay with these filters')).toBeInTheDocument();
  });

  it('does not take a page past the last one for an empty list', () => {
    renderList({ rows: [], initial: '/app/short-rent/bookings?chip=all&page=9', props: { mode: 'server', totalCount: 3, pageSize: 20 } });

    expect(screen.getByText('No stay with these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(addressNow()).toBe('?chip=all');
  });
});

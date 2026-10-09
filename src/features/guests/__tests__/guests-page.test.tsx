import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { GuestsPage } from '../guests-page';
import { guestsApi } from '@/api/guests.api';
import { saveBlobAs } from '@/lib/file-download';
import type { GuestSummary, PagedResult } from '@/types';

vi.mock('@/api/guests.api', () => ({
  guestsApi: { getAll: vi.fn() },
}));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn() }));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'auth0|tester', context: 'short-rent' }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const guest = (id: string, firstName: string, extra: Partial<GuestSummary> = {}): GuestSummary => ({
  id,
  firstName,
  lastName: 'Rossi',
  email: `${id}@example.com`,
  phoneNumber: '',
  city: 'Roma',
  country: 'Italia',
  createdAt: '2026-09-20T10:00:00Z',
  ...extra,
});

const page = (items: GuestSummary[], totalCount: number, pageNumber = 1): PagedResult<GuestSummary> => ({
  items,
  totalCount,
  page: pageNumber,
  pageSize: 20,
});

function Where() {
  return createElement('output', { 'data-testid': 'search' }, useLocation().search);
}

function renderPage(initial = '/app/short-rent/guests') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [initial] }, createElement(GuestsPage), createElement(Where))),
    ),
  );
}

/** The table of the page, once it is there. */
const findTable = () => screen.findByRole('table', { name: i18n.t('guests.title') });
/**
 * A cell of the table of the page, once it is there. The table of the last search stays while the next one is on its way, so
 * "the table is there" is not "the new rows are": it waits for the cell.
 */
function findInTable(text: string) {
  return waitFor(() => within(screen.getByRole('table', { name: i18n.t('guests.title') })).getByText(text));
}

beforeEach(async () => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('en');
});

describe('GuestsPage', () => {
  it('renders the items of the paged response', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));

    renderPage();

    expect(await findInTable('Mario Rossi')).toBeInTheDocument();
    expect(guestsApi.getAll).toHaveBeenCalledWith({ search: undefined, page: 1, pageSize: 20 });
    expect(screen.queryByRole('navigation', { name: i18n.t('listView.pagination.label') })).not.toBeInTheDocument();
  });

  // UI-07 (DataView) and UI-14 (the unified list): the list is a table where there is room and a list of cards on a phone; the page
  // has both and a media query shows one, so a test that means "the row is there" asks the table (or the list) and not the page.
  it('shows each guest once in the table and once as a card that opens the guest', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));

    renderPage();

    const table = await findTable();
    expect(within(table).getByRole('rowheader', { name: 'Mario Rossi' })).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: i18n.t('guests.viewDetails') })).toHaveAttribute('href', '/app/short-rent/guests/g1');
    expect(within(table).getByRole('link', { name: 'Mario Rossi' })).toHaveAttribute('href', '/app/short-rent/guests/g1');
    const cards = screen.getByRole('list', { name: i18n.t('guests.title') });
    expect(within(cards).getByRole('link', { name: /Mario Rossi/ })).toHaveAttribute('href', '/app/short-rent/guests/g1');
  });

  it('shows the columns it has the data for, and the others when the person asks', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario', { phoneNumber: '+39 333 1234567', city: '' })], 1));

    renderPage();

    const table = within(await findTable());
    for (const name of ['guests.anagrafica', 'guests.email', 'guests.city', 'guests.createdAt']) {
      expect(table.getByRole('columnheader', { name: i18n.t(name) })).toBeInTheDocument();
    }
    expect(table.queryByRole('columnheader', { name: i18n.t('guests.phone') })).not.toBeInTheDocument();
    // No last stay, no stays, no documents, no marketing consent: the list the API gives has none of them, and none is made up.
    expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).not.toContain('Marketing');
    expect(table.getByText('—')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: i18n.t('listView.more.button') }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: i18n.t('listView.more.columns') }));
    const dialog = within(await screen.findByRole('dialog', { name: i18n.t('listView.columns.title') }));
    fireEvent.click(dialog.getByRole('checkbox', { name: i18n.t('guests.phone') }));
    fireEvent.click(dialog.getByRole('button', { name: i18n.t('listView.columns.apply') }));

    expect(within(await findTable()).getByRole('columnheader', { name: i18n.t('guests.phone') })).toBeInTheDocument();
    expect(within(await findTable()).getByText('+39 333 1234567')).toBeInTheDocument();
  });

  it('requests the next page when there are more guests than a page, and puts the page in the address', async () => {
    vi.mocked(guestsApi.getAll)
      .mockResolvedValueOnce(page([guest('g1', 'Mario')], 21))
      .mockResolvedValueOnce(page([guest('g21', 'Luigi')], 21, 2));

    renderPage();

    const nav = within(await screen.findByRole('navigation', { name: i18n.t('listView.pagination.label') }));
    expect(nav.getByText(i18n.t('listView.pagination.page', { page: 1, pageCount: 2 }))).toBeInTheDocument();
    fireEvent.click(nav.getByRole('button', { name: i18n.t('listView.pagination.next') }));

    expect(await findInTable('Luigi Rossi')).toBeInTheDocument();
    await waitFor(() => expect(guestsApi.getAll).toHaveBeenLastCalledWith({ search: undefined, page: 2, pageSize: 20 }));
    expect(screen.getByTestId('search')).toHaveTextContent('?page=2');
  });

  it('keeps the guests of the last search on the screen while those of the next arrive', async () => {
    let answer: (value: PagedResult<GuestSummary>) => void = () => undefined;
    vi.mocked(guestsApi.getAll)
      .mockResolvedValueOnce(page([guest('g1', 'Mario')], 21))
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));

    renderPage();
    fireEvent.click(within(await screen.findByRole('navigation', { name: i18n.t('listView.pagination.label') })).getByRole('button', { name: i18n.t('listView.pagination.next') }));

    // The second page has not come: the first is still there, and the list says it is working.
    await waitFor(() => expect(guestsApi.getAll).toHaveBeenCalledTimes(2));
    expect(within(await findTable()).getByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByTestId('guest-list')).toHaveAttribute('aria-busy', 'true');

    answer(page([guest('g21', 'Luigi')], 21, 2));
    expect(await findInTable('Luigi Rossi')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('guest-list')).not.toHaveAttribute('aria-busy'));
  });

  describe('the search', () => {
    it('is asked of the API, a moment after the last key, and is in the address', async () => {
      vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));
      renderPage();
      await findInTable('Mario Rossi');

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rossi' } });

      await waitFor(() => expect(guestsApi.getAll).toHaveBeenLastCalledWith({ search: 'rossi', page: 1, pageSize: 20 }), { timeout: 3000 });
      expect(screen.getByTestId('search')).toHaveTextContent('?q=rossi');
      // One request for the word, not one for each key.
      expect(guestsApi.getAll).toHaveBeenCalledTimes(2);
    });

    it('starts from the search that is in the address', async () => {
      vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));

      renderPage('/app/short-rent/guests?q=%20mario%20&page=1');

      await findInTable('Mario Rossi');
      // The spaces around the word are the person's, they are not asked of the API.
      expect(guestsApi.getAll).toHaveBeenCalledWith({ search: 'mario', page: 1, pageSize: 20 });
      expect(screen.getByRole('searchbox')).toHaveValue(' mario ');
    });

    it('says that nothing was found, and "Clear the filters" shows the guests again', async () => {
      vi.mocked(guestsApi.getAll).mockImplementation(({ search }) => Promise.resolve(search ? page([], 0) : page([guest('g1', 'Mario')], 1)));
      renderPage('/app/short-rent/guests?q=zzz');

      expect(await screen.findByText(i18n.t('listView.noResults.title'))).toBeInTheDocument();
      expect(screen.queryByText(i18n.t('guests.empty'))).not.toBeInTheDocument();

      const empty = screen.getByText(i18n.t('listView.noResults.title')).parentElement!;
      fireEvent.click(within(empty).getByRole('button', { name: i18n.t('listView.clear') }));

      expect(await findInTable('Mario Rossi')).toBeInTheDocument();
      expect(screen.getByTestId('search')).toHaveTextContent('');
    });
  });

  it('says that there are no guests yet, when there are none', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([], 0));

    renderPage();

    expect(await screen.findByText(i18n.t('guests.empty'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error state, not an empty list, when the API fails, and tries again', async () => {
    vi.mocked(guestsApi.getAll).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([guest('g1', 'Mario')], 1));

    renderPage();

    expect(await screen.findByText(i18n.t('guests.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('guests.empty'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await findInTable('Mario Rossi')).toBeInTheDocument();
  });

  it('exports the guests that are selected, with the columns on the screen, as a CSV', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario'), guest('g2', 'Luigi')], 2));
    renderPage();
    const table = within(await findTable());

    fireEvent.click(table.getByRole('checkbox', { name: 'Luigi Rossi' }));
    fireEvent.click(within(screen.getByRole('region', { name: i18n.t('listView.bulk.bar') })).getByRole('button', { name: i18n.t('listView.bulk.export') }));

    const [blob, fileName] = vi.mocked(saveBlobAs).mock.calls[0];
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(3));
    expect(fileName).toMatch(/^ospiti-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.split('\r\n')).toEqual([
      '"Personal Info","Email","City","Created At"',
      '"Luigi Rossi","g2@example.com","Roma","20/09/2026"',
    ]);
  });

  it('keeps the test id the end-to-end tests read, on the list', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));

    renderPage();

    await findTable();
    expect(screen.getByTestId('guest-list')).toContainElement(screen.getByRole('table'));
  });
});

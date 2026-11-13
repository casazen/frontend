import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentArchiveApi } from '@/api/document-archive.api';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { todayInRome } from '@/lib/stay-dates';
import { useProperties } from '@/queries/use-properties';
import type { ArchiveDocument, ArchiveDocumentPage, ArchiveTypeCount } from '@/types';
import { formatFileSize } from '../document-file';
import { DocumentsPage } from '../documents-page';

vi.mock('@/api/document-archive.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/document-archive.api')>()),
  documentArchiveApi: { list: vi.fn(), types: vi.fn(), download: vi.fn(), export: vi.fn() },
}));
vi.mock('@/lib/file-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/file-download')>()),
  saveBlobAs: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, primary }: { title: string; primary?: { label: string; onClick?: () => void; testId?: string } }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      primary ? createElement('button', { type: 'button', onClick: primary.onClick, 'data-testid': primary.testId }, primary.label) : null,
    ),
}));

const doc = (id: string, change: Partial<ArchiveDocument> = {}): ArchiveDocument => ({
  type: 'propertyDocument',
  id,
  title: `File ${id}.pdf`,
  date: '2026-10-12',
  propertyId: 'p1',
  propertyName: 'Villa Rosa',
  bookingId: null,
  bookingCode: null,
  contentType: 'application/pdf',
  sizeBytes: null,
  ...change,
});

const page = (items: ArchiveDocument[], totalCount = items.length, pageNumber = 1, pageSize = 25): ArchiveDocumentPage => ({ items, totalCount, page: pageNumber, pageSize });

const TYPES: ArchiveTypeCount[] = [
  { type: 'propertyDocument', count: 3 },
  { type: 'contract', count: 1 },
  { type: 'touristTax', count: 2 },
];

const PROPERTIES = [
  { id: 'p1', name: 'Villa Rosa' },
  { id: 'p2', name: 'Casa Mare' },
];

/** What the client of the API throws for an answer with a problem body (the body already parsed, as `withJsonErrorBody` leaves it). */
function problem(status: number, body: Record<string, unknown>): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: body, statusText: '', headers: {}, config });
}

/** True when `secret` is anywhere in `value`, in any text of it, however deep. */
function holds(value: unknown, secret: string, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => holds(item, secret, seen));
}

function Where() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'where' }, location.search);
}

function Tree({ initial, client }: { initial: string; client: QueryClient }) {
  return createElement(
    I18nextProvider,
    { i18n },
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [initial] }, createElement(DocumentsPage), createElement(Where))),
  );
}

function renderPage(initial = '/app/short-rent/documents', client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(createElement(Tree, { initial, client })) };
}

const findTable = () => screen.findByRole('table', { name: i18n.t('documentArchive.title') });

/** The button of a row, in the table (the cards of a phone have their own, in the same page). */
const downloadButtons = () => within(screen.getByRole('table', { name: i18n.t('documentArchive.title') })).queryAllByRole('button', { name: 'Download' });

beforeEach(async () => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('en');
  vi.mocked(useProperties).mockReturnValue({ data: PROPERTIES, isLoading: false } as unknown as ReturnType<typeof useProperties>);
  vi.mocked(documentArchiveApi.types).mockResolvedValue(TYPES);
  vi.mocked(documentArchiveApi.list).mockResolvedValue(page([doc('d1'), doc('d2', { type: 'contract', title: 'Contratto.pdf', bookingId: 'b1', bookingCode: 'CZ-123', sizeBytes: 2_500_000 })]));
});

describe('DocumentsPage (NF-99)', () => {
  it('lists every document with its kind, day, property, booking and size, and a download for each row', async () => {
    renderPage();

    const table = within(await findTable());
    expect(table.getByRole('rowheader', { name: /File d1\.pdf/ })).toBeInTheDocument();
    for (const header of ['document', 'date', 'property', 'booking', 'size']) {
      expect(table.getByRole('columnheader', { name: i18n.t(`documentArchive.columns.${header}`) })).toBeInTheDocument();
    }
    expect(table.getByText('Property document')).toBeInTheDocument();
    expect(table.getByText('Contract')).toBeInTheDocument();
    expect(table.getAllByText('Villa Rosa').length).toBeGreaterThan(0);
    // The booking is a link to it; the size is as a person reads it; a property document stores none.
    expect(table.getByRole('link', { name: 'CZ-123' })).toHaveAttribute('href', '/app/short-rent/bookings/b1');
    expect(table.getByText(/2[.,]4 MB/)).toBeInTheDocument();
    expect(downloadButtons()).toHaveLength(2);
    // The day is the one of the row, written as a person reads it (a stay date: never moved by the time zone of the browser).
    expect(table.getAllByText(/Oct.*12.*2026|12.*Oct.*2026/).length).toBeGreaterThan(0);
    // The button of a row is 44 px high whatever the pointer (the table is where the mouse is).
    expect(screen.getByTestId('documents-list')).toHaveClass('[&_td_button]:min-h-11');
    expect(documentArchiveApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25, types: undefined }));
  });

  describe('the types', () => {
    it('are the chips the server sends, each with its count, and no other', async () => {
      renderPage();
      await findTable();

      const chips = within(screen.getByTestId('list-chips'));
      expect(chips.getAllByRole('button').map((chip) => chip.getAttribute('data-testid'))).toEqual([
        'list-chip-all',
        'list-chip-propertyDocument',
        'list-chip-contract',
        'list-chip-touristTax',
      ]);
      expect(screen.getByTestId('list-chip-all')).toHaveTextContent('6');
      expect(screen.getByTestId('list-chip-propertyDocument')).toHaveTextContent('Property document');
      expect(screen.getByTestId('list-chip-propertyDocument')).toHaveTextContent('3');
      expect(screen.queryByTestId('list-chip-invoice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('list-chip-alloggiatiReceipt')).not.toBeInTheDocument();
    });

    it('narrow the list to that type, in the address and in the request', async () => {
      renderPage();
      await findTable();

      fireEvent.click(screen.getByTestId('list-chip-contract'));

      await waitFor(() => expect(documentArchiveApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ types: ['contract'], page: 1 })));
      expect(screen.getByTestId('where')).toHaveTextContent('?chip=contract');
    });

    it('count what the other filters leave: the counts are asked again with the search', async () => {
      renderPage('/app/short-rent/documents?q=ape');
      await findTable();

      await waitFor(() => expect(documentArchiveApi.types).toHaveBeenCalledWith({ from: undefined, to: undefined, propertyId: undefined, q: 'ape' }));
      // The types themselves, which define the chips, are asked with no filter at all.
      expect(documentArchiveApi.types).toHaveBeenCalledWith({});
    });

    it('that the server did not send are not valid in the address either: the list is asked for every type', async () => {
      renderPage('/app/short-rent/documents?chip=invoice');

      await findTable();
      expect(documentArchiveApi.list).toHaveBeenCalledWith(expect.objectContaining({ types: undefined }));
      expect(documentArchiveApi.list).not.toHaveBeenCalledWith(expect.objectContaining({ types: ['invoice'] }));
      expect(screen.queryByTestId('list-chip-invoice')).not.toBeInTheDocument();
    });

    it('are not offered as chips when there is only one: there is nothing to choose between', async () => {
      vi.mocked(documentArchiveApi.types).mockResolvedValue([{ type: 'propertyDocument', count: 3 }]);
      renderPage();

      await findTable();
      expect(screen.queryByTestId('list-chips')).not.toBeInTheDocument();
    });
  });

  it('asks the server for the search, a moment after the last key, as the word of the request', async () => {
    renderPage();
    await findTable();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'CZ-123' } });

    await waitFor(() => expect(documentArchiveApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'CZ-123', page: 1 })), { timeout: 3000 });
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', i18n.t('documentArchive.search.placeholder'));
  });

  it('asks for the days and the property of the address', async () => {
    renderPage('/app/short-rent/documents?f_days=2026-01-01..2026-03-31&f_property=p2');

    await findTable();
    expect(documentArchiveApi.list).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01', to: '2026-03-31', propertyId: 'p2' }));
  });

  it('says that nothing was found for these filters, and "Clear the filters" shows the documents again', async () => {
    vi.mocked(documentArchiveApi.list).mockImplementation(({ q }) => Promise.resolve(q ? page([]) : page([doc('d1')])));
    renderPage('/app/short-rent/documents?q=zzz');

    expect(await screen.findByText(i18n.t('documentArchive.noResultsTitle'))).toBeInTheDocument();
    const empty = screen.getByText(i18n.t('documentArchive.noResultsTitle')).parentElement!;
    fireEvent.click(within(empty).getByRole('button', { name: i18n.t('listView.clear') }));

    expect(await findTable()).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('');
  });

  it('says that there are no documents yet when there are none', async () => {
    vi.mocked(documentArchiveApi.list).mockResolvedValue(page([]));
    vi.mocked(documentArchiveApi.types).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(i18n.t('documentArchive.emptyTitle'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  describe('the pages', () => {
    it('are the ones of the server, and the page and the size of the address are what is asked', async () => {
      vi.mocked(documentArchiveApi.list).mockResolvedValue(page([doc('d51')], 120, 2, 50));
      renderPage('/app/short-rent/documents?page=2&pageSize=50');

      await findTable();
      expect(documentArchiveApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 50 }));
      expect(screen.getByTestId('documents-page-size')).toHaveValue('50');
      const nav = within(screen.getByRole('navigation', { name: i18n.t('listView.pagination.label') }));
      expect(nav.getByText(i18n.t('listView.pagination.page', { page: 2, pageCount: 3 }))).toBeInTheDocument();
    });

    it('go back to the first page when the size changes, and the size is written in the address', async () => {
      vi.mocked(documentArchiveApi.list).mockResolvedValue(page([doc('d26')], 120, 2));
      renderPage('/app/short-rent/documents?page=2&chip=contract');
      await findTable();

      fireEvent.change(screen.getByTestId('documents-page-size'), { target: { value: '100' } });

      await waitFor(() => expect(documentArchiveApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 100, types: ['contract'] })));
      const search = new URLSearchParams(screen.getByTestId('where').textContent ?? '');
      expect(search.get('pageSize')).toBe('100');
      expect(search.has('page')).toBe(false);
      expect(search.get('chip')).toBe('contract');
    });

    it('have no size to choose when everything fits in one', async () => {
      renderPage();

      await findTable();
      expect(screen.queryByTestId('documents-page-size')).not.toBeInTheDocument();
    });
  });

  it('reads the list again at every visit: it changes on screens that know nothing of it', async () => {
    const first = renderPage();
    await findTable();
    expect(documentArchiveApi.list).toHaveBeenCalledTimes(1);
    first.unmount();

    renderPage(undefined, first.client);

    await findTable();
    await waitFor(() => expect(documentArchiveApi.list).toHaveBeenCalledTimes(2));
  });

  it('shows the error, not an empty list, with the words of the server for the days it refused, and tries again', async () => {
    vi.mocked(documentArchiveApi.list).mockRejectedValueOnce(problem(400, { code: 'archive_invalid_period' })).mockResolvedValue(page([doc('d1')]));
    renderPage('/app/short-rent/documents?f_days=1999-01-01..2026-03-31');

    expect(await screen.findByText(i18n.t('documentArchive.error'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('apiErrors.codes.archiveInvalidPeriod'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('documentArchive.emptyTitle'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await findTable()).toBeInTheDocument();
  });

  describe('a download', () => {
    it('is asked by type and id, saved under the name of the file, and every button waits while it runs', async () => {
      let finish: (blob: Blob) => void = () => undefined;
      vi.mocked(documentArchiveApi.download).mockImplementation(() => new Promise((resolve) => (finish = resolve)));
      renderPage();
      await findTable();

      fireEvent.click(downloadButtons()[0]);

      await waitFor(() => expect(documentArchiveApi.download).toHaveBeenCalledWith('propertyDocument', 'd1'));
      await waitFor(() => expect(downloadButtons().every((button) => (button as HTMLButtonElement).disabled)).toBe(true));
      expect(downloadButtons()).toHaveLength(2);

      await act(async () => finish(new Blob(['%PDF-1.4'], { type: 'application/pdf' })));

      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'File d1.pdf'));
      await waitFor(() => expect(downloadButtons().every((button) => !(button as HTMLButtonElement).disabled)).toBe(true));
      expect(toast.success).toHaveBeenCalledWith(i18n.t('documentArchive.downloadDone'));
    });

    it('of a row whose file the server cannot find says so in the row, and the row has no button any more', async () => {
      vi.mocked(documentArchiveApi.download).mockRejectedValueOnce(problem(404, { code: 'archive_document_has_no_file' }));
      renderPage();
      const table = within(await findTable());

      fireEvent.click(downloadButtons()[0]);

      await waitFor(() => expect(table.getByText(i18n.t('documentArchive.noFile'))).toBeInTheDocument());
      expect(downloadButtons()).toHaveLength(1);
      expect(table.queryByTestId('document-download-propertyDocument:d1')).not.toBeInTheDocument();
      expect(table.getByTestId('document-download-contract:d2')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.archiveDocumentHasNoFile'));
      // The row stays that way when the list is read again.
      expect(documentArchiveApi.list).toHaveBeenCalledTimes(1);
    });

    it('of a document that is not found any more says so, even though the list showed it, and the list is read again', async () => {
      vi.mocked(documentArchiveApi.download).mockRejectedValueOnce(problem(404, { code: 'archive_document_not_found' }));
      vi.mocked(documentArchiveApi.list).mockResolvedValueOnce(page([doc('d1'), doc('d2')])).mockResolvedValue(page([doc('d2')]));
      renderPage();
      const table = within(await findTable());

      fireEvent.click(downloadButtons()[0]);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.archiveDocumentNotFound')));
      await waitFor(() => expect(documentArchiveApi.list).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(table.queryByText('File d1.pdf')).not.toBeInTheDocument());
    });

    it('that fails for another reason says it in plain words and leaves the button to try again', async () => {
      vi.mocked(documentArchiveApi.download).mockRejectedValueOnce(new Error('boom'));
      renderPage();
      await findTable();

      fireEvent.click(downloadButtons()[0]);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('documentArchive.downloadFailed')));
      await waitFor(() => expect(downloadButtons().every((button) => !(button as HTMLButtonElement).disabled)).toBe(true));
      expect(downloadButtons()).toHaveLength(2);
    });

    // A file can be a contract or a proof about guests, and the request that fails holds the access token: the cache of the mutations keeps
    // neither, and not even the mutation once nobody watches it.
    it('keeps in the cache of the mutations neither the token of the request that failed nor the file that came', async () => {
      const failed = problem(500, { code: 'boom' });
      failed.config!.headers.set('Authorization', 'Bearer SECRET-TOKEN');
      // The test is a real one: the token is in what axios gives.
      expect(holds(failed, 'SECRET-TOKEN')).toBe(true);
      vi.mocked(documentArchiveApi.download).mockRejectedValueOnce(failed).mockResolvedValueOnce(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
      const { client, unmount } = renderPage();
      await findTable();

      fireEvent.click(downloadButtons()[0]);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('documentArchive.downloadFailed')));
      const failures = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
      expect(failures.length).toBeGreaterThan(0);
      expect(holds(failures, 'SECRET-TOKEN')).toBe(false);

      await waitFor(() => expect(downloadButtons().every((button) => !(button as HTMLButtonElement).disabled)).toBe(true));
      fireEvent.click(downloadButtons()[0]);
      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
      expect(client.getMutationCache().getAll().every((mutation) => mutation.state.data === undefined)).toBe(true);

      unmount();
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it('is not offered for a file that the list already knows to be empty: the row says so instead', async () => {
      vi.mocked(documentArchiveApi.list).mockResolvedValue(page([doc('d1', { type: 'contract', sizeBytes: 0 }), doc('d2')]));
      renderPage();
      const table = within(await findTable());

      expect(table.getByText(i18n.t('documentArchive.noFile'))).toBeInTheDocument();
      expect(downloadButtons()).toHaveLength(1);
    });
  });
});

describe('the archive of a period (NF-99)', () => {
  const year = () => todayInRome().slice(0, 4);

  async function openDialog() {
    renderPage();
    await findTable();
    fireEvent.click(screen.getByTestId('archive-export-open'));
    return within(await screen.findByTestId('archive-export-dialog'));
  }

  it('asks for the period and the types, and starts from this year and every type the server offers', async () => {
    const dialog = await openDialog();

    expect(dialog.getByTestId('archive-export-period')).toHaveValue('thisYear');
    for (const type of ['propertyDocument', 'contract', 'touristTax']) expect(dialog.getByTestId(`archive-export-type-${type}`)).toBeChecked();
    expect(dialog.queryByTestId('archive-export-type-invoice')).not.toBeInTheDocument();
    expect(dialog.getByTestId('archive-export-start')).toBeEnabled();
  });

  it('downloads the ZIP of the period with the types that are on, and saves it under the name the server gives it', async () => {
    vi.mocked(documentArchiveApi.export).mockResolvedValue(new Blob(['PK'], { type: 'application/zip' }));
    const dialog = await openDialog();
    fireEvent.click(dialog.getByTestId('archive-export-type-touristTax'));

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    await waitFor(() =>
      expect(documentArchiveApi.export).toHaveBeenCalledWith(
        { from: `${year()}-01-01`, to: `${year()}-12-31`, types: ['propertyDocument', 'contract'], propertyId: undefined },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), `casazen-documenti-${year()}0101-${year()}1231.zip`));
    await waitFor(() => expect(screen.queryByTestId('archive-export-dialog')).not.toBeInTheDocument());
  });

  it('starts from the property the list is narrowed to, and sends it', async () => {
    vi.mocked(documentArchiveApi.export).mockResolvedValue(new Blob(['PK']));
    renderPage('/app/short-rent/documents?f_property=p2');
    await findTable();
    fireEvent.click(screen.getByTestId('archive-export-open'));
    const dialog = within(await screen.findByTestId('archive-export-dialog'));

    expect(dialog.getByTestId('archive-export-property')).toHaveValue('p2');
    fireEvent.click(dialog.getByTestId('archive-export-start'));

    await waitFor(() => expect(documentArchiveApi.export).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 'p2' }), expect.anything()));
  });

  it('refuses a period of more than 24 months before asking the server', async () => {
    const dialog = await openDialog();

    fireEvent.change(dialog.getByTestId('archive-export-period'), { target: { value: 'custom' } });
    fireEvent.change(dialog.getByTestId('archive-export-from'), { target: { value: '2023-01-01' } });
    fireEvent.change(dialog.getByTestId('archive-export-to'), { target: { value: '2026-01-01' } });

    expect(dialog.getByTestId('archive-export-problem')).toHaveTextContent(i18n.t('documentArchive.export.error.tooLong'));
    expect(dialog.getByTestId('archive-export-start')).toBeDisabled();
    fireEvent.change(dialog.getByTestId('archive-export-to'), { target: { value: '2022-12-31' } });
    expect(dialog.getByTestId('archive-export-problem')).toHaveTextContent(i18n.t('documentArchive.export.error.invalidDates'));
    expect(documentArchiveApi.export).not.toHaveBeenCalled();
  });

  it('never means every type when none is chosen: it asks to choose one', async () => {
    const dialog = await openDialog();

    for (const type of ['propertyDocument', 'contract', 'touristTax']) fireEvent.click(dialog.getByTestId(`archive-export-type-${type}`));

    expect(dialog.getByTestId('archive-export-no-types')).toHaveTextContent(i18n.t('documentArchive.export.error.noTypes'));
    expect(dialog.getByTestId('archive-export-start')).toBeDisabled();
    fireEvent.click(dialog.getByTestId('archive-export-type-contract'));
    expect(dialog.getByTestId('archive-export-start')).toBeEnabled();
  });

  it('tells how many files the server found when the period holds too many, with how many one archive holds, and asks for a shorter one', async () => {
    vi.mocked(documentArchiveApi.export).mockRejectedValueOnce(problem(422, { code: 'archive_export_too_large', fileCount: 412, maxFiles: 300, maxBytes: 209715200 }));
    const dialog = await openDialog();

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    const message = await dialog.findByTestId('archive-export-too-large');
    expect(message).toHaveTextContent(i18n.t('documentArchive.export.tooLarge', { count: 412, max: 300 }));
    expect(message).toHaveTextContent('412');
    expect(message).toHaveTextContent('300');
    expect(saveBlobAs).not.toHaveBeenCalled();
    // The dialog stays open for another period, and the button offers to try again.
    expect(dialog.getByTestId('archive-export-start')).toHaveTextContent(i18n.t('documentArchive.export.retry'));
    fireEvent.change(dialog.getByTestId('archive-export-period'), { target: { value: 'lastMonth' } });
    expect(dialog.queryByTestId('archive-export-too-large')).not.toBeInTheDocument();
  });

  // The cap of the bytes counts a document that stores no size as 10 MB: 21 property documents are 210 MB, over the 200 MB, with far fewer than 300 files.
  it('says the archive is too large, not that there are too many files, when a few files go over the size', async () => {
    vi.mocked(documentArchiveApi.export).mockRejectedValueOnce(problem(422, { code: 'archive_export_too_large', fileCount: 21, maxFiles: 300, maxBytes: 209715200 }));
    const dialog = await openDialog();

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    const message = await dialog.findByTestId('archive-export-too-large');
    // The size is written as a person reads it, with the space that the language puts between the number and the unit: any kind of space is one.
    const expected = i18n.t('documentArchive.export.tooBig', { count: 21, max: 300, size: formatFileSize(209715200, 'en') }).replace(/\s+/g, ' ');
    expect(message).toHaveTextContent(expected);
    expect(message).toHaveTextContent(/too large/i);
    expect(message).not.toHaveTextContent(/too many/i);
    expect(message).toHaveTextContent('21');
    expect(message).toHaveTextContent('300');
    expect(message).toHaveTextContent(/200\s*MB/);
    expect(saveBlobAs).not.toHaveBeenCalled();
  });

  it('says only that the archive would be too large when the server does not send the limits', async () => {
    vi.mocked(documentArchiveApi.export).mockRejectedValueOnce(problem(422, { code: 'archive_export_too_large' }));
    const dialog = await openDialog();

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    expect(await dialog.findByTestId('archive-export-too-large')).toHaveTextContent(i18n.t('apiErrors.codes.archiveExportTooLarge'));
  });

  it('keeps no token in the cache of the mutations when the archive fails, and nothing once the dialog is closed', async () => {
    const failed = problem(500, { code: 'boom' });
    failed.config!.headers.set('Authorization', 'Bearer SECRET-TOKEN');
    vi.mocked(documentArchiveApi.export).mockRejectedValueOnce(failed);
    const { client } = renderPage();
    await findTable();
    fireEvent.click(screen.getByTestId('archive-export-open'));
    const dialog = within(await screen.findByTestId('archive-export-dialog'));

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    await dialog.findByTestId('archive-export-failure');
    const failures = client.getMutationCache().getAll().map((mutation) => mutation.state.error);
    expect(failures.length).toBeGreaterThan(0);
    expect(holds(failures, 'SECRET-TOKEN')).toBe(false);
    fireEvent.click(dialog.getByRole('button', { name: i18n.t('shared.cancel') }));
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('says another failure in plain words', async () => {
    vi.mocked(documentArchiveApi.export).mockRejectedValueOnce(new Error('boom'));
    const dialog = await openDialog();

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    expect(await dialog.findByTestId('archive-export-failure')).toHaveTextContent(i18n.t('documentArchive.export.failed'));
  });

  it('shows how much came while it runs, locks the form, and closing the dialog stops the download', async () => {
    let request: { signal?: AbortSignal; onProgress?: (bytes: number) => void } = {};
    vi.mocked(documentArchiveApi.export).mockImplementation((_query, options) => {
      request = options ?? {};
      return new Promise<Blob>(() => undefined);
    });
    const dialog = await openDialog();

    fireEvent.click(dialog.getByTestId('archive-export-start'));

    expect(await dialog.findByTestId('archive-export-progress')).toHaveTextContent(i18n.t('documentArchive.export.preparing'));
    expect(dialog.getByTestId('archive-export-period')).toBeDisabled();
    expect(dialog.getByTestId('archive-export-type-contract')).toBeDisabled();
    // A second press does not start a second download.
    fireEvent.click(dialog.getByTestId('archive-export-start'));
    expect(documentArchiveApi.export).toHaveBeenCalledTimes(1);

    act(() => request.onProgress?.(5 * 1024 * 1024));
    expect(dialog.getByTestId('archive-export-progress')).toHaveTextContent(/5 MB/);

    expect(request.signal?.aborted).toBe(false);
    fireEvent.click(dialog.getByRole('button', { name: i18n.t('shared.cancel') }));

    await waitFor(() => expect(screen.queryByTestId('archive-export-dialog')).not.toBeInTheDocument());
    expect(request.signal?.aborted).toBe(true);
    expect(saveBlobAs).not.toHaveBeenCalled();
  });
});

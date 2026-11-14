import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import { PublicFiscalDocumentPage } from '../PublicFiscalDocumentPage';

// E12/F02/US02: the guest opens the document from the link of the e-mail. The privacy rule of these tests: the token of the link is the only access check,
// so it is read once, taken out of the address bar, sent in the body of the two public calls and nowhere else (no storage, no key, no variable, no error kept).
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/file-download')>()),
  saveBlobAs: vi.fn(),
}));

const post = vi.mocked(axios.post);
const save = vi.mocked(saveBlobAs);

const DOCUMENT_ID = '3f2b8c0e-5d2a-4f7e-9a41-1c6d8e0b7a52';
const TOKEN = 'CfDJ8Kq-the-secret-of-the-link_7Hx9.zQ42';
const LINK = `/documents/view/${DOCUMENT_ID}?token=${TOKEN}`;

const SUMMARY = { id: DOCUMENT_ID, kind: 'Invoice', number: '2026/12', issueDate: '2026-11-19', total: 245.5, currency: 'CHF' };

function pdf(type = 'application/pdf') {
  return { data: new Blob(['%PDF-1.4'], { type }), headers: { 'content-disposition': 'attachment; filename="documento-FT-2026-12.pdf"' } };
}

/** What the client of axios throws: it holds the request, and the request holds the body that was sent, which is the token. */
function failure(status?: number, body: unknown = { code: 'document_link_invalid' }): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ token: TOKEN }) } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data: body, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', status === undefined ? AxiosError.ERR_NETWORK : AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(path = LINK) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/documents/view/:documentId" element={<PublicFiscalDocumentPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

/** Everything the browser keeps for the page: the keys and the values of both storages and the cookies. */
function keptByTheBrowser(): string {
  const kept: string[] = [document.cookie];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) ?? '';
      kept.push(key, storage.getItem(key) ?? '');
    }
  }
  return kept.join('\n');
}

/** Everything the caches of the queries hold of the calls: the keys, the variables of the mutations and the failures (an error of axios serialises its request). */
function keptByTheCaches(client: QueryClient): string {
  return JSON.stringify([
    ...client.getQueryCache().getAll().map((query) => [query.queryKey, query.state.error]),
    ...client.getMutationCache().getAll().map((mutation) => [mutation.options.mutationKey, mutation.state.variables, mutation.state.error]),
  ]);
}

function browserLanguages(...languages: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
}

describe('PublicFiscalDocumentPage (E12/F02/US02)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    browserLanguages('it-IT', 'it');
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('PublicDocumentPage_ValidLink_ShowsTheSummaryAndTheTokenIsNeverWrittenToStorage', async () => {
    post.mockResolvedValueOnce({ data: SUMMARY }).mockResolvedValueOnce(pdf());

    const client = renderPage();

    // The summary: kind, number, day, and the total in the currency of the document.
    const summary = await screen.findByTestId('public-document-summary');
    expect(summary).toHaveTextContent('Fattura');
    expect(summary).toHaveTextContent('2026/12');
    expect(summary).toHaveTextContent('19 novembre 2026');
    expect(screen.getByTestId('public-document-total')).toHaveTextContent(/245,50\s*CHF/);
    expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'ready');

    // The token left the address bar, which still names the page.
    expect(screen.getByTestId('location')).toHaveTextContent(`/documents/view/${DOCUMENT_ID}`);
    expect(screen.getByTestId('location')).not.toHaveTextContent(TOKEN);

    fireEvent.click(screen.getByTestId('public-document-download'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'documento-FT-2026-12.pdf');

    // The token travelled in the body of the two calls, to the public endpoints, and in no address, header or option.
    expect(post).toHaveBeenCalledTimes(2);
    const [summaryCall, pdfCall] = post.mock.calls;
    expect(summaryCall![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}`);
    expect(summaryCall![1]).toEqual({ token: TOKEN });
    expect(summaryCall![2]).toMatchObject({ public: true });
    expect(pdfCall![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}/pdf`);
    expect(pdfCall![1]).toEqual({ token: TOKEN });
    expect(pdfCall![2]).toMatchObject({ public: true, responseType: 'blob', headers: { 'Accept-Language': 'it' } });
    expect(JSON.stringify([summaryCall![0], pdfCall![0], summaryCall![2], pdfCall![2]])).not.toContain(TOKEN);

    // The privacy rule: not in the storages, not in the cookies, not in a key, a variable or a failure of the caches.
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it.each([
    ['a link that does not open (404)', failure(404)],
    ['a link the guest has too many times (429)', failure(429, { code: 'rate_limited' })],
    ['a server error (500)', failure(500, {})],
    ['no answer at all', failure()],
    ['an answer that is not a summary', { data: { id: DOCUMENT_ID } }],
    ['an answer that is the page of the app', { data: '<!doctype html><html></html>' }],
  ])('PublicDocumentPage_ReadFails_%s_ShowsTheSameInvalidLinkPageAndKeepsNoToken', async (_name, outcome) => {
    if (outcome instanceof AxiosError) post.mockRejectedValueOnce(outcome);
    else post.mockResolvedValueOnce(outcome);

    const client = renderPage();

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).toHaveTextContent('Questo link non è valido o è scaduto. Chiedi un nuovo invio alla struttura.');
    // Nothing of a document and no way to ask for one.
    expect(screen.queryByTestId('public-document-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-document-download')).not.toBeInTheDocument();
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it.each([
    ['the link stopped working meanwhile (404)', () => post.mockRejectedValueOnce(failure(404))],
    ['a failed download (500)', () => post.mockRejectedValueOnce(failure(500, {}))],
    ['an answer that is not a PDF', () => post.mockResolvedValueOnce(pdf('text/html'))],
  ])('PublicDocumentPage_DownloadFails_%s_ReplacesTheSummaryWithTheSameInvalidLinkPage', async (_name, failDownload) => {
    post.mockResolvedValueOnce({ data: SUMMARY });
    failDownload();

    const client = renderPage();
    fireEvent.click(await screen.findByTestId('public-document-download'));

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    // No data of the document stays on the page, and a file that is not a PDF is never saved as one.
    expect(screen.queryByTestId('public-document-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).not.toHaveTextContent('2026/12');
    expect(save).not.toHaveBeenCalled();
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it('PublicDocumentPage_NoToken_ShowsTheInvalidLinkPageWithoutCallingTheApi', async () => {
    renderPage(`/documents/view/${DOCUMENT_ID}`);

    expect(await screen.findByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid');
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ['EUR', 'it', /245,50\s*€/, 'Fattura'],
    ['CHF', 'it', /245,50\s*CHF/, 'Fattura'],
    ['CHF', 'en', /CHF\s*245\.50/, 'Invoice'],
  ])('PublicDocumentPage_Total_%s_InThe%sPage_ComesFromTheDataOfTheDocument', async (currency, language, amount, kind) => {
    browserLanguages(language);
    post.mockResolvedValueOnce({ data: { ...SUMMARY, currency, kind: 'Invoice' } });

    renderPage();

    expect(await screen.findByTestId('public-document-total')).toHaveTextContent(amount);
    expect(screen.getByTestId('public-document-summary')).toHaveTextContent(kind);
    expect(screen.queryByTestId('public-document-no-currency')).not.toBeInTheDocument();
  });

  it('PublicDocumentPage_DocumentWithoutCurrency_ShowsTheAmountWithoutSymbolAndSaysSo', async () => {
    post.mockResolvedValueOnce({ data: { ...SUMMARY, currency: null } });

    renderPage();

    const total = await screen.findByTestId('public-document-total');
    expect(total).toHaveTextContent('245,50');
    expect(total).not.toHaveTextContent(/€|CHF|EUR/);
    expect(screen.getByTestId('public-document-no-currency')).toHaveTextContent('La valuta non è indicata nel documento');
  });

  it('PublicDocumentPage_ABrowserInAnotherLanguage_OpensInEnglishAndTheGuestCanChooseItalianForPageAndPdf', async () => {
    browserLanguages('de-CH', 'de');
    post.mockResolvedValueOnce({ data: SUMMARY }).mockResolvedValueOnce(pdf());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Your document' })).toBeInTheDocument();
    expect(screen.getByTestId('public-document-summary')).toHaveTextContent('Invoice');

    // The visible choice between Italian and English: it changes the page, and the PDF is asked in the same language.
    fireEvent.change(screen.getByTestId('checkin-language-select'), { target: { value: 'it' } });
    expect(await screen.findByRole('heading', { name: 'Il tuo documento' })).toBeInTheDocument();
    expect(screen.getByTestId('public-document-summary')).toHaveTextContent('Fattura');
    fireEvent.click(screen.getByTestId('public-document-download'));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]![2]).toMatchObject({ headers: { 'Accept-Language': 'it' } });
    // The choice lives for the page only: nothing is written to the browser.
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
});

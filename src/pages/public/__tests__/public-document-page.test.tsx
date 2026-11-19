import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
// FIX/FE-RESEND-DOC-EMAIL: what the page says of a failure depends on what the server answered. A refusal (401, 403, 404 `document_link_invalid`) is the invalid-link page; a passing error
// (no answer, 5xx, 429, an answer that is not what the server gives) is never told as an expired link: «Riprova» reads again, or repeats the download next to the summary.
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

  // The server says the link does not open (the 404 `document_link_invalid` of the API contract, or a 401 or a 403): the calm «Link non valido o scaduto» page.
  it.each([
    ['a link that does not open (404 document_link_invalid)', failure(404)],
    ['a refused request (401)', failure(401, '')],
    ['a forbidden request (403)', failure(403, '')],
  ])('PublicDocumentPage_ReadRefusedByTheServer_%s_ShowsTheInvalidLinkPageAndKeepsNoToken', async (_name, outcome) => {
    post.mockRejectedValueOnce(outcome);

    const client = renderPage();

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).toHaveTextContent('Questo link non è valido o è scaduto. Chiedi un nuovo invio alla struttura.');
    // Nothing of a document and no way to ask for one or to try again.
    expect(screen.queryByTestId('public-document-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-document-download')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-document-retry')).not.toBeInTheDocument();
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  // A passing error says nothing about the link: never the expired-link page, and «Riprova» reads again.
  it.each([
    ['too many calls in a minute (429)', failure(429, { code: 'rate_limited' })],
    ['a server error (500)', failure(500, {})],
    ['a gateway that does not answer (503)', failure(503, '')],
    ['no answer at all', failure()],
    ['an answer that is not a summary', { data: { id: DOCUMENT_ID } }],
    ['an answer that is the page of the app', { data: '<!doctype html><html></html>' }],
  ])('PublicDocumentPage_ReadFailsForAPassingReason_%s_ShowsTheErrorPageWithRiprova_NeverTheExpiredLinkPage_AndKeepsNoToken', async (_name, outcome) => {
    if (outcome instanceof AxiosError) post.mockRejectedValueOnce(outcome);
    else post.mockResolvedValueOnce(outcome);

    const client = renderPage();

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'error'));
    expect(screen.getByRole('heading', { name: 'Non riusciamo a caricare il documento' })).toBeInTheDocument();
    expect(screen.queryByText('Link non valido o scaduto')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).not.toHaveTextContent('è scaduto');
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
    // Nothing of a document, and no download.
    expect(screen.queryByTestId('public-document-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('public-document-download')).not.toBeInTheDocument();
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it('PublicDocumentPage_RiprovaAfterAFailedRead_ReadsTheSummaryAgainWithTheSameCall', async () => {
    post.mockRejectedValueOnce(failure(500, {})).mockResolvedValueOnce({ data: SUMMARY });

    const client = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('public-document-summary')).toHaveTextContent('2026/12');
    expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'ready');
    // The same call twice: the token never left the memory of the page, and the guest did not have to open the link again.
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
    expect(post.mock.calls[1]![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}`);
    expect(post.mock.calls[1]![1]).toEqual({ token: TOKEN });
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it('PublicDocumentPage_RiprovaThatMeetsARefusal_ShowsTheInvalidLinkPage', async () => {
    post.mockRejectedValueOnce(failure(500, {})).mockRejectedValueOnce(failure(404));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    expect(screen.queryByTestId('public-document-retry')).not.toBeInTheDocument();
  });

  it.each([
    ['the link stopped working meanwhile (404)', () => post.mockRejectedValueOnce(failure(404))],
    ['the link is refused meanwhile (403)', () => post.mockRejectedValueOnce(failure(403, ''))],
  ])('PublicDocumentPage_DownloadRefusedByTheServer_%s_ReplacesTheSummaryWithTheInvalidLinkPage', async (_name, failDownload) => {
    post.mockResolvedValueOnce({ data: SUMMARY });
    failDownload();

    const client = renderPage();
    fireEvent.click(await screen.findByTestId('public-document-download'));

    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    // No data of the document stays on the page, and nothing is saved.
    expect(screen.queryByTestId('public-document-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).not.toHaveTextContent('2026/12');
    expect(save).not.toHaveBeenCalled();
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  // The link is good (the summary was just read): a download that fails for a passing reason is told as such, next to the summary, and «Riprova» repeats the same call.
  it.each([
    ['a server error (500)', () => post.mockRejectedValueOnce(failure(500, {}))],
    ['too many calls in a minute (429)', () => post.mockRejectedValueOnce(failure(429, { code: 'rate_limited' }))],
    ['no answer at all', () => post.mockRejectedValueOnce(failure())],
    ['an answer that is not a PDF', () => post.mockResolvedValueOnce(pdf('text/html'))],
  ])('PublicDocumentPage_DownloadFailsForAPassingReason_%s_KeepsTheSummaryNeverSaysTheLinkExpiredAndRiprovaRepeatsTheDownload', async (_name, failDownload) => {
    post.mockResolvedValueOnce({ data: SUMMARY });
    failDownload();
    post.mockResolvedValueOnce(pdf());

    const client = renderPage();
    fireEvent.click(await screen.findByTestId('public-document-download'));

    const failed = await screen.findByTestId('public-document-download-failed');
    expect(failed).toHaveTextContent('Non siamo riusciti a scaricare il PDF');
    expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'ready');
    expect(screen.getByTestId('public-document-summary')).toHaveTextContent('2026/12');
    expect(screen.queryByText('Link non valido o scaduto')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-document-page')).not.toHaveTextContent('è scaduto');
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'documento-FT-2026-12.pdf');
    await waitFor(() => expect(screen.queryByTestId('public-document-download-failed')).not.toBeInTheDocument());
    expect(screen.getByTestId('public-document-download')).toHaveTextContent('Scarica il PDF');
    // The same call twice: the summary, the failed download, the repeated download. The repeat has the same address, body and options as the first.
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[2]).toEqual(post.mock.calls[1]);
    expect(post.mock.calls[2]![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}/pdf`);
    expect(post.mock.calls[2]![1]).toEqual({ token: TOKEN });
    expect(keptByTheBrowser()).not.toContain(TOKEN);
    expect(keptByTheCaches(client)).not.toContain(TOKEN);
  });

  it('PublicDocumentPage_AnInvalidTokenAndAFailedDownload_ShowDifferentScreens_AndRiprovaRepeatsTheDownload', async () => {
    // A token the server refuses: the page of the expired link, with nothing to press.
    post.mockRejectedValueOnce(failure(404));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('public-document-page')).toHaveAttribute('data-state', 'invalid'));
    expect(screen.getByRole('heading', { name: 'Link non valido o scaduto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    cleanup();

    // A good token whose download fails: not that page. The summary, the failure, and a «Riprova» that downloads again.
    post.mockReset();
    post.mockResolvedValueOnce({ data: SUMMARY }).mockRejectedValueOnce(failure(500, {})).mockResolvedValueOnce(pdf());
    renderPage();
    fireEvent.click(await screen.findByTestId('public-document-download'));
    expect(await screen.findByTestId('public-document-download-failed')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Link non valido o scaduto' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[1]![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}/pdf`);
    expect(post.mock.calls[2]![0]).toBe(`/public/fiscal-documents/${DOCUMENT_ID}/pdf`);
  });

  it('PublicDocumentPage_WhileTheSummaryIsRead_SaysSoAndNeitherTheInvalidLinkNorTheErrorPage', async () => {
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    renderPage();

    const page = screen.getByTestId('public-document-page');
    expect(page).toHaveAttribute('data-state', 'loading');
    expect(within(page).getByRole('status')).toHaveTextContent('Carico il documento');
    expect(screen.queryByRole('heading', { name: 'Link non valido o scaduto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();

    await act(async () => {
      answer({ data: SUMMARY });
    });
    expect(await screen.findByTestId('public-document-summary')).toBeInTheDocument();
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

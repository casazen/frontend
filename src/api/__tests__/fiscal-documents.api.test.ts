import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { getHttpStatus, getProblemCode, UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import {
  downloadPdf,
  downloadXml,
  exportList,
  FISCAL_DOCUMENT_ERROR,
  getDocument,
  getDocumentsContext,
  issueBatch,
  listBookingDocuments,
  listDocuments,
  pdfPathOf,
} from '../fiscal-documents.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

/** What the shared client resolves with for a read that came back with a status the read accepts. */
const answer = (data: unknown, status = 200, headers: Record<string, string> = {}) => ({ status, data, headers });

const FISCAL_CODE = 'RSSMRA80A01H501U';
const VAT_NUMBER = 'IT01234567890';
const DOCUMENT_ID = 'd0000000-0000-4000-8000-000000000001';

/** A document as the API sends it: with the whole recipient (fiscal code, VAT number, address, PEC) and the lines. */
const wire = (overrides: Record<string, unknown> = {}) => ({
  id: DOCUMENT_ID,
  bookingId: 'b0000000-0000-4000-8000-000000000001',
  source: 'CasaZen',
  kind: 'Invoice',
  status: 'Issued',
  series: 'A',
  sequenceNumber: 12,
  number: 'A/12',
  issueDate: '2026-11-05',
  currency: 'EUR',
  recipientKind: 'PrivatePerson',
  recipientName: 'Mario Rossi',
  recipientFiscalCode: FISCAL_CODE,
  recipientVatNumber: VAT_NUMBER,
  recipientAddressStreet: 'Via Roma',
  recipientAddressCivic: '1',
  recipientPostalCode: '00100',
  recipientCity: 'Roma',
  recipientProvince: 'RM',
  recipientCountryCode: 'IT',
  recipientSdiCode: '0000000',
  recipientPec: 'mario@pec.example',
  taxableBase: 100,
  vatAmount: 22.1,
  stampDuty: 0,
  total: 122.1,
  vatRatePercent: 22,
  paymentState: 'ToCollect',
  sdiStatus: 'to_send',
  sdiErrorCode: null,
  hasXml: true,
  octoratePdfAvailable: false,
  createdAt: '2026-11-05T10:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  lines: [{ lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 100, totalPrice: 100, vatRatePercent: 22 }],
  ...overrides,
});

const page = (items: unknown[], totalCount = items.length) => ({ items, totalCount, page: 1, pageSize: 20 });

/** The failure of an axios call whose body is a JSON Blob (`responseType: 'blob'`). */
function blobFailure(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  const data = new Blob([JSON.stringify(body)], { type: 'application/problem+json' });
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listDocuments', () => {
  it('ListDocuments_FiltersAndAPage_AsksForThemAndLeavesOutWhatIsEmpty', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(page([wire()])));

    await listDocuments({ from: '2026-11-01', to: '2026-11-30', kind: 'Invoice', source: '', status: undefined }, 2, 20);

    expect(axios.get).toHaveBeenCalledWith('/fiscal/documents', expect.objectContaining({ params: { from: '2026-11-01', to: '2026-11-30', kind: 'Invoice', page: 2, pageSize: 20 } }));
  });

  // Money rule: the figures and the words of the document are the ones of the server, untouched.
  it('ListDocuments_ADocument_KeepsTheNumberTheDayAndTheAmountAsTheServerSentThem', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(page([wire(), wire({ id: 'd-2', currency: 'CHF', total: 55 })], 41)));

    const result = await listDocuments({}, 1, 20);

    expect(result.totalCount).toBe(41);
    expect(result.items.map((item) => [item.number, item.issueDate, item.currency, item.total])).toEqual([
      ['A/12', '2026-11-05', 'EUR', 122.1],
      ['A/12', '2026-11-05', 'CHF', 55],
    ]);
    expect(result.items[0].paymentState).toBe('ToCollect');
    expect(result.items[0].sdiStatus).toBe('to_send');
  });

  // Privacy rule: the fiscal code, the VAT number, the address and the PEC of the recipient never reach the state of the page, the cache of the queries or a log.
  it('ListDocuments_TheRecipientOfADocument_IsReducedToItsNameAndNothingFiscalIsKept', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(page([wire()])));

    const result = await listDocuments({}, 1, 20);
    const kept = JSON.stringify(result);

    expect(result.items[0].recipientName).toBe('Mario Rossi');
    for (const secret of [FISCAL_CODE, VAT_NUMBER, 'Via Roma', 'pec.example', '00100', 'Soggiorno']) expect(kept).not.toContain(secret);
    expect(Object.keys(result.items[0]).filter((key) => /fiscal|vat|address|pec|postal|city|sdiCode|lines/i.test(key))).toEqual([]);
  });

  it('ListDocuments_AMemberTheApiLeavesOut_IsNullAndNeverMadeUp', async () => {
    const bare = { id: DOCUMENT_ID, source: 'Octorate', kind: 'Proforma', status: 'Issued', currency: 'EUR', total: 0, paymentState: 'Unknown', sdiStatus: 'unknown' };
    vi.mocked(axios.get).mockResolvedValueOnce(answer(page([bare])));

    const [only] = (await listDocuments({}, 1, 20)).items;

    expect(only).toMatchObject({ bookingId: null, number: null, issueDate: null, recipientName: null, sdiErrorCode: null, hasXml: false, octoratePdfAvailable: false, total: 0 });
  });

  it.each([
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
    ['nothing', undefined],
    ['a list', []],
    ['no items', { totalCount: 0, page: 1, pageSize: 20 }],
    ['no count', { items: [], page: 1, pageSize: 20 }],
    ['a count that is a text', { items: [], totalCount: '0', page: 1, pageSize: 20 }],
    ['a total as a text', page([wire({ total: '122.10' })])],
    ['a total that is not a number', page([wire({ total: Number.NaN })])],
    ['a document with no state', page([wire({ sdiStatus: undefined })])],
    ['a number that is a figure', page([wire({ number: 12 })])],
    // One bad document is a load error for the whole answer: a list that silently misses a document could be read as one in order.
    ['one bad document among good ones', page([wire(), wire({ id: 7 })])],
  ])('ListDocuments_%s_IsALoadErrorAndNeverAnEmptyList', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(listDocuments({}, 1, 20)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('ListDocuments_AFailure_IsLeftToTheCaller', async () => {
    const failure = Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500 } });
    vi.mocked(axios.get).mockRejectedValueOnce(failure);

    await expect(listDocuments({}, 1, 20)).rejects.toBe(failure);
  });
});

describe('a 403 (permission rule: the refusal of the server is an answer of the read, not a move of the whole app to the no-access page)', () => {
  /** The shared client rejects a 403 on a read and sends the app to the no-access page, so the read has to accept the status for the answer to reach the code. */
  const acceptedStatuses = () => {
    const config = vi.mocked(axios.get).mock.calls[0][1];
    return [200, 204, 401, 403, 404, 422, 500].filter((status) => config?.validateStatus?.(status));
  };

  it.each([
    ['the list', () => listDocuments({}, 1, 20)],
    ['the PDF', () => downloadPdf({ id: DOCUMENT_ID, source: 'CasaZen' })],
    ['the XML', () => downloadXml({ id: DOCUMENT_ID })],
    ['a file of the list', () => exportList('csv', {})],
    ['the setting', () => getDocumentsContext()],
    ['the detail', () => getDocument(DOCUMENT_ID)],
    ['the documents of a booking', () => listBookingDocuments('b0000000-0000-4000-8000-000000000001')],
  ])('%s_A403_IsAcceptedByTheClientAndThrownAsTheRefusalItIsWithItsResponse', async (_case, read) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer('', 403));

    const failure = await read().then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(getHttpStatus(failure)).toBe(403);
    expect(failure).not.toBeInstanceOf(UnexpectedApiResponseError);
    expect(acceptedStatuses()).toEqual([200, 204, 403]);
  });
});

describe('the files', () => {
  it('PdfPathOf_ADocumentOfCasaZenAndOneOfTheChannelManager_HaveEachTheirOwnAddress', () => {
    expect(pdfPathOf({ id: DOCUMENT_ID, source: 'CasaZen' })).toBe(`/fiscal/documents/${DOCUMENT_ID}/pdf`);
    expect(pdfPathOf({ id: DOCUMENT_ID, source: 'Octorate' })).toBe(`/fiscal/documents/${DOCUMENT_ID}/octorate-pdf`);
    // The id is never taken for a path.
    expect(pdfPathOf({ id: '../x', source: 'CasaZen' })).toBe('/fiscal/documents/..%2Fx/pdf');
  });

  it('DownloadPdf_ADocument_IsReadAsABlobThroughTheAuthenticatedClientWithTheNameTheServerGave', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.mocked(axios.get).mockResolvedValueOnce(answer(blob, 200, { 'Content-Disposition': 'attachment; filename=documento-A-12.pdf' }));

    const file = await downloadPdf({ id: DOCUMENT_ID, source: 'CasaZen' });

    expect(axios.get).toHaveBeenCalledWith(`/fiscal/documents/${DOCUMENT_ID}/pdf`, expect.objectContaining({ responseType: 'blob' }));
    expect(file.blob).toBe(blob);
    expect(file.contentDisposition).toBe('attachment; filename=documento-A-12.pdf');
  });

  it('DownloadPdf_TheChannelManagerOne_UsesTheAddressThroughCasaZenAndNeverAnotherHost', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(new Blob(['%PDF']), 200));

    const file = await downloadPdf({ id: DOCUMENT_ID, source: 'Octorate' });

    const [path] = vi.mocked(axios.get).mock.calls[0];
    expect(path).toBe(`/fiscal/documents/${DOCUMENT_ID}/octorate-pdf`);
    expect(String(path)).not.toMatch(/^https?:/);
    // A header the page may not read (CORS) is no name, and no error.
    expect(file.contentDisposition).toBeNull();
  });

  it('DownloadXml_ADocument_IsReadAsABlob', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(new Blob(['<x/>']), 200));

    await downloadXml({ id: DOCUMENT_ID });

    expect(axios.get).toHaveBeenCalledWith(`/fiscal/documents/${DOCUMENT_ID}/xml`, expect.objectContaining({ responseType: 'blob' }));
  });

  it.each([
    ['not found', 404, FISCAL_DOCUMENT_ERROR.notFound],
    ['the XML the document does not have', 404, FISCAL_DOCUMENT_ERROR.xmlUnavailable],
    ['the PDF the channel manager does not have', 404, FISCAL_DOCUMENT_ERROR.octoratePdfUnavailable],
    ['the schema of the invoice not installed', 422, FISCAL_DOCUMENT_ERROR.schemaUnavailable],
  ])('DownloadXml_%s_KeepsTheCodeOfTheProblemReadable', async (_case, status, code) => {
    vi.mocked(axios.get).mockRejectedValueOnce(blobFailure(status, { code }));

    const failure = await downloadXml({ id: DOCUMENT_ID }).then(
      () => undefined,
      (error: unknown) => error,
    );

    // With `responseType: 'blob'` a problem body arrives as a Blob: it is parsed so that the code can be read and told in its own words.
    expect(getHttpStatus(failure)).toBe(status);
    expect(getProblemCode((failure as AxiosError).response?.data)).toBe(code);
  });

  it('ExportList_TheFiltersOfTheList_AreSentButTheStatusIsNot', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(new Blob(['x']), 200));

    await exportList('xlsx', { from: '2026-11-01', to: '2026-11-30', kind: 'Invoice', source: 'CasaZen', status: 'Issued' });

    expect(axios.get).toHaveBeenCalledWith(
      '/fiscal/documents/export',
      expect.objectContaining({ params: { from: '2026-11-01', to: '2026-11-30', kind: 'Invoice', source: 'CasaZen', format: 'xlsx' }, responseType: 'blob' }),
    );
  });

  it('ExportList_NoFilter_AsksOnlyForTheFormat', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(new Blob(['x']), 200));

    await exportList('csv', {});

    expect(vi.mocked(axios.get).mock.calls[0][1]).toMatchObject({ params: { format: 'csv' } });
  });
});

describe('getDocumentsContext', () => {
  const settings = (overrides: Record<string, unknown> = {}) => ({
    mode: 'CasaZenDirectOnly',
    regime: 'VatOrdinary',
    issuer: { legalName: 'Casa Srl', vatNumber: VAT_NUMBER, fiscalCode: FISCAL_CODE, addressStreet: 'Via Roma', issuerPec: 'casa@pec.example' },
    casazenIssuanceEnabled: true,
    octorateIssuesAllBookings: false,
    octorateConnected: false,
    sdi: { providerConfigured: false, providerName: 'Some Provider' },
    missingFields: [],
    ...overrides,
  });

  // Privacy rule: the data of the issuer and the name of whoever carries the invoices to the SDI are in the answer and are not kept.
  it('GetDocumentsContext_TheSetting_IsReducedToWhoIssuesAndWhetherThereIsAChannelToTheSdi', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(settings()));

    const context = await getDocumentsContext();

    expect(axios.get).toHaveBeenCalledWith('/fiscal/documents/settings', expect.anything());
    // The setting has no series of its own: the server uses the year, which the context says with an empty pattern.
    expect(context).toEqual({ mode: 'CasaZenDirectOnly', casazenIssuanceEnabled: true, sdiProviderConfigured: false, guestDocumentSeries: '' });
    const kept = JSON.stringify(context);
    for (const secret of [VAT_NUMBER, FISCAL_CODE, 'Via Roma', 'pec.example', 'Some Provider']) expect(kept).not.toContain(secret);
  });

  it('GetDocumentsContext_ASettingNobodyChoseYet_HasNoMode', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(settings({ mode: undefined, sdi: { providerConfigured: true } })));

    expect(await getDocumentsContext()).toEqual({ mode: null, casazenIssuanceEnabled: true, sdiProviderConfigured: true, guestDocumentSeries: '' });
  });

  it('GetDocumentsContext_TheSeriesOfTheSetting_IsKeptAsThePatternItIsAndNothingIsClaimedWithoutTheIssuer', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(settings({ issuer: { legalName: 'Casa Srl', guestDocumentSeries: ' PM-{year} ' } })));
    expect((await getDocumentsContext()).guestDocumentSeries).toBe('PM-{year}');

    vi.mocked(axios.get).mockResolvedValueOnce(answer(settings({ issuer: undefined })));
    expect((await getDocumentsContext()).guestDocumentSeries).toBeNull();
  });

  it.each([
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
    ['nothing', undefined],
    ['no flag of CasaZen', settings({ casazenIssuanceEnabled: undefined })],
    ['no channel to the SDI', settings({ sdi: undefined })],
    ['a channel that is a text', settings({ sdi: { providerConfigured: 'no' } })],
  ])('GetDocumentsContext_%s_IsALoadErrorAndNeverASetting', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(getDocumentsContext()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('getDocument', () => {
  // Privacy rule: the detail keeps the lines and the name of the recipient and nothing fiscal of it (no fiscal code, VAT number, address or PEC).
  it('GetDocument_ADocumentWithItsLines_KeepsTheLinesAndTheNameAndNothingFiscalOfTheRecipient', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(wire({ lines: [{ lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 100, totalPrice: 100, vatRatePercent: 22, lineType: 'Accommodation', vatAmount: 18.03 }] })));

    const detail = await getDocument(DOCUMENT_ID);

    expect(axios.get).toHaveBeenCalledWith(`/fiscal/documents/${DOCUMENT_ID}`, expect.anything());
    expect(detail.recipientName).toBe('Mario Rossi');
    expect(detail.lines).toEqual([
      { lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 100, totalPrice: 100, vatRatePercent: 22, vatNatureCode: null, lineType: 'Accommodation', vatAmount: 18.03 },
    ]);
    expect([detail.taxableBase, detail.vatAmount, detail.stampDuty, detail.total, detail.currency]).toEqual([100, 22.1, 0, 122.1, 'EUR']);
    const kept = JSON.stringify(detail);
    for (const secret of [FISCAL_CODE, VAT_NUMBER, 'Via Roma', 'pec.example', '00100']) expect(kept).not.toContain(secret);
    expect(Object.keys(detail).filter((key) => /fiscalcode|vatnumber|address|pec|postal|city|sdicode/i.test(key))).toEqual([]);
  });

  it('GetDocument_WhatTheServerDoesNotSayOfALine_IsNullAndNeverMadeUp', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(wire()));

    const [line] = (await getDocument(DOCUMENT_ID)).lines;

    expect(line).toMatchObject({ lineType: null, vatAmount: null, vatNatureCode: null });
  });

  it.each([
    ['a line with no amount', wire({ lines: [{ lineNumber: 1, description: 'Soggiorno', quantity: 1, unitPrice: 100, vatRatePercent: 22 }] })],
    ['no lines', wire({ lines: undefined })],
    ['a total of the document that is a text', wire({ taxableBase: '100' })],
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
  ])('GetDocument_%s_IsALoadErrorAndNeverADocument', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(getDocument(DOCUMENT_ID)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('issueBatch', () => {
  // Data rule: the counts are made from the rows, one per document, so a count can never say «all issued» over a row that failed.
  it('IssueBatch_TheCounts_AreMadeFromTheRowsAndNotTakenFromTheAnswer', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce(
      answer({
        rows: [
          { id: 'a', issued: true, number: '2026/6' },
          { id: 'b', issued: false, errorCode: 'document_draft_outdated' },
        ],
        issued: 2,
        failed: 0,
        remaining: 3,
      }),
    );

    const result = await issueBatch(['a', 'b']);

    expect(axios.post).toHaveBeenCalledWith('/fiscal/documents/issue-batch', { documentIds: ['a', 'b'] });
    expect([result.issued, result.failed, result.remaining]).toEqual([1, 1, 3]);
    expect(result.rows).toEqual([
      { id: 'a', issued: true, number: '2026/6', errorCode: null },
      { id: 'b', issued: false, number: null, errorCode: 'document_draft_outdated' },
    ]);
  });

  it.each([
    ['no rows', { issued: 2, failed: 0 }],
    ['a row with no verdict', { rows: [{ id: 'a' }] }],
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
  ])('IssueBatch_%s_IsALoadErrorAndNeverASuccess', async (_case, body) => {
    vi.mocked(axios.post).mockResolvedValueOnce(answer(body));

    await expect(issueBatch(['a'])).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('listBookingDocuments', () => {
  it('ListBookingDocuments_TheDocumentsOfABooking_AreKeptWithTheirCurrencyAndTheirPaymentState', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(
      answer([{ id: 'd-1', kind: 'Invoice', status: 'Issued', number: '2026/5', total: 736, currency: 'CHF', paymentState: 'ToCollect', issueDate: '2026-11-05', creditedDocumentId: null }]),
    );

    const documents = await listBookingDocuments('b-1');

    expect(axios.get).toHaveBeenCalledWith('/bookings/b-1/fiscal-documents', expect.anything());
    expect(documents).toEqual([{ id: 'd-1', kind: 'Invoice', status: 'Issued', number: '2026/5', total: 736, currency: 'CHF', paymentState: 'ToCollect', issueDate: '2026-11-05' }]);
  });

  it.each([
    ['not a list', { items: [] }],
    ['a document with no currency', [{ id: 'd-1', kind: 'Invoice', status: 'Issued', total: 736, paymentState: 'ToCollect' }]],
  ])('ListBookingDocuments_%s_IsALoadErrorAndNeverAnEmptyCard', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(listBookingDocuments('b-1')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import {
  ARCHIVE_ERROR,
  archiveErrorCode,
  archiveExportFileName,
  archiveExportParams,
  archiveExportTooLarge,
  archiveListParams,
  documentArchiveApi,
  isArchiveCallCancelled,
} from '../document-archive.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const DOCUMENT = {
  type: 'contract',
  id: '5d0d8a52-1111-4222-8333-944455556666',
  title: 'Contratto.pdf',
  date: '2026-10-12',
  propertyId: null,
  propertyName: null,
  bookingId: null,
  bookingCode: null,
  contentType: 'application/pdf',
  sizeBytes: 1024,
};

/** What a failed call of the axios client looks like when the body is a Blob (`responseType: 'blob'`). */
function blobError(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  const data = new Blob([JSON.stringify(body)], { type: 'application/problem+json' });
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// NF-99: the API reads a repeated `type`, and axios writes an array as `type[]=a`, which the API does not read: the words go as `type=a&type=b`.
describe('archiveListParams (NF-99)', () => {
  it('ArchiveListParams_SeveralTypes_AreWrittenAsARepeatedWord', () => {
    const params = archiveListParams({ types: ['contract', 'touristTax'], page: 2, pageSize: 50 });

    expect(params.toString()).toBe('type=contract&type=touristTax&page=2&pageSize=50');
    expect(params.getAll('type')).toEqual(['contract', 'touristTax']);
  });

  it('ArchiveListParams_DaysPropertyAndSearch_AreSent', () => {
    const params = archiveListParams({ from: '2026-01-01', to: '2026-03-31', propertyId: 'p1', q: '  APE  ', page: 1, pageSize: 25 });

    expect(Object.fromEntries(params)).toEqual({ from: '2026-01-01', to: '2026-03-31', propertyId: 'p1', q: 'APE', page: '1', pageSize: '25' });
  });

  it('ArchiveListParams_NothingAsked_SendsOnlyThePage', () => {
    const params = archiveListParams({ types: undefined, from: undefined, to: undefined, propertyId: undefined, q: '   ', page: 1, pageSize: 25 });

    expect(params.toString()).toBe('page=1&pageSize=25');
  });

  // An empty list in input is never "every type": no `type` at all is that, so an empty list fails instead of widening what comes back.
  it('ArchiveListParams_AnEmptyListOfTypes_IsAMistakeNotEveryType', () => {
    expect(() => archiveListParams({ types: [], page: 1, pageSize: 25 })).toThrow(RangeError);
    expect(() => archiveExportParams({ from: '2026-01-01', to: '2026-01-31', types: [] })).toThrow(RangeError);
  });

  it('ArchiveListParams_LongSearch_IsCutAtTheLengthTheServerLooksFor', () => {
    expect(archiveListParams({ q: 'a'.repeat(150), page: 1, pageSize: 25 }).get('q')).toHaveLength(100);
  });
});

describe('archiveExportParams (NF-99)', () => {
  it('ArchiveExportParams_PeriodTypesAndProperty_AreSent_NoSearchNoPage', () => {
    const params = archiveExportParams({ from: '2026-01-01', to: '2026-12-31', types: ['contract', 'propertyDocument'], propertyId: 'p1' });

    expect(params.toString()).toBe('type=contract&type=propertyDocument&from=2026-01-01&to=2026-12-31&propertyId=p1');
  });

  it('ArchiveExportParams_NoTypesNoProperty_SendsTheDaysOnly', () => {
    expect(archiveExportParams({ from: '2026-01-01', to: '2026-03-31' }).toString()).toBe('from=2026-01-01&to=2026-03-31');
  });
});

// A call the person stopped is not a failure: it is read by its code, which stays when the mutations keep the failure without its request.
describe('isArchiveCallCancelled (NF-99)', () => {
  it('IsArchiveCallCancelled_TheCallWasAborted_IsCancelledWithOrWithoutItsRequest', () => {
    const aborted = new CanceledError('canceled');

    expect(isArchiveCallCancelled(aborted)).toBe(true);
    expect(isArchiveCallCancelled(withoutRequest(aborted))).toBe(true);
  });

  it('IsArchiveCallCancelled_AnyOtherError_IsNot', () => {
    expect(isArchiveCallCancelled(blobError(500, { code: 'x' }))).toBe(false);
    expect(isArchiveCallCancelled(new Error('canceled'))).toBe(false);
    expect(isArchiveCallCancelled(undefined)).toBe(false);
  });
});

describe('archiveExportFileName', () => {
  it('ArchiveExportFileName_Days_AreWrittenAsTheServerWritesThem', () => {
    expect(archiveExportFileName('2026-01-01', '2026-12-31')).toBe('casazen-documenti-20260101-20261231.zip');
  });
});

describe('documentArchiveApi.list and types (NF-99)', () => {
  it('List_Query_AsksTheDocumentsWithTheQueryString', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { items: [DOCUMENT], totalCount: 1, page: 1, pageSize: 25 } });

    const page = await documentArchiveApi.list({ types: ['contract'], page: 1, pageSize: 25 });

    expect(page.items).toEqual([DOCUMENT]);
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe('/documents');
    expect((config as { params: URLSearchParams }).params.toString()).toBe('type=contract&page=1&pageSize=25');
  });

  it.each([
    ['a body that is not an object', '<html></html>'],
    ['a body with no items', { totalCount: 0 }],
    ['an item with no id', { items: [{ ...DOCUMENT, id: undefined }], totalCount: 1 }],
    ['a total that is not a number', { items: [], totalCount: '0' }],
  ])('List_%s_IsAnErrorToShowNotRowsToDraw', async (_name, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: body });

    await expect(documentArchiveApi.list({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('Types_Filters_AreSentWithoutAnyTypeAndTheTypesCome', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { types: [{ type: 'contract', count: 2 }, { type: 'touristTax', count: 0 }] } });

    const types = await documentArchiveApi.types({ from: '2026-01-01', propertyId: 'p1', q: 'rossi' });

    expect(types).toEqual([
      { type: 'contract', count: 2 },
      { type: 'touristTax', count: 0 },
    ]);
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe('/documents/types');
    expect((config as { params: URLSearchParams }).params.toString()).toBe('from=2026-01-01&propertyId=p1&q=rossi');
  });

  it('Types_ABodyThatIsNotTheList_IsAnError', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { types: [{ type: 'contract' }] } });

    await expect(documentArchiveApi.types({})).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('documentArchiveApi.download and export (NF-99)', () => {
  it('Download_Document_IsAskedByTypeAndIdAsABlob', async () => {
    const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: file, headers: {} });

    const download = await documentArchiveApi.download('contract', DOCUMENT.id);

    expect(download.blob).toBe(file);
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe(`/documents/contract/${DOCUMENT.id}/download`);
    expect(config).toMatchObject({ responseType: 'blob' });
  });

  // The API exposes `Content-Disposition` to the page (CORS): the name the server gave the file comes with it, whatever the case of the header's name.
  it.each([
    ['a plain object, as the name came', { 'Content-Disposition': `attachment; filename*=UTF-8''F24.pdf` }],
    ['a plain object in lower case', { 'content-disposition': `attachment; filename*=UTF-8''F24.pdf` }],
    ['the headers of axios', new AxiosHeaders({ 'content-disposition': `attachment; filename*=UTF-8''F24.pdf` })],
  ])('Download_%s_BringsTheNameTheServerGave', async (_name, headers) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: new Blob(['%PDF-1.4']), headers });

    const download = await documentArchiveApi.download('touristTax', DOCUMENT.id);

    expect(download.contentDisposition).toBe(`attachment; filename*=UTF-8''F24.pdf`);
  });

  // Where the API does not expose the header to this origin the page does not see it: no name, and no error.
  it.each([
    ['no headers at all', undefined],
    ['other headers only', { 'content-type': 'application/pdf' }],
    ['a header that is not a text', { 'content-disposition': 12 }],
  ])('Download_%s_HasNoNameAndNoError', async (_name, headers) => {
    const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: file, headers });

    await expect(documentArchiveApi.download('touristTax', DOCUMENT.id)).resolves.toEqual({ blob: file, contentDisposition: null });
  });

  it('Download_NoFile_ExposesTheCodeOfTheProblemBody', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(blobError(404, { code: ARCHIVE_ERROR.noFile }));

    const error = await documentArchiveApi.download('contract', DOCUMENT.id).catch((failure: unknown) => failure);

    expect(archiveErrorCode(error)).toBe(ARCHIVE_ERROR.noFile);
  });

  it('Export_Query_IsAskedAsABlobWithTheLongTimeoutAndTheSignal', async () => {
    const zip = new Blob(['PK'], { type: 'application/zip' });
    vi.mocked(axios.get).mockResolvedValueOnce({ data: zip });
    const controller = new AbortController();

    const blob = await documentArchiveApi.export({ from: '2026-01-01', to: '2026-12-31', types: ['contract'] }, { signal: controller.signal });

    expect(blob).toBe(zip);
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe('/documents/export');
    expect(config).toMatchObject({ responseType: 'blob', signal: controller.signal, timeout: 10 * 60_000 });
    expect((config as { params: URLSearchParams }).params.toString()).toBe('type=contract&from=2026-01-01&to=2026-12-31');
  });

  it('Export_Progress_IsToldInBytes', async () => {
    vi.mocked(axios.get).mockImplementationOnce((_url, config) => {
      (config as { onDownloadProgress: (event: { loaded: number }) => void }).onDownloadProgress({ loaded: 4096 });
      return Promise.resolve({ data: new Blob(['PK']) });
    });
    const onProgress = vi.fn();

    await documentArchiveApi.export({ from: '2026-01-01', to: '2026-01-31' }, { onProgress });

    expect(onProgress).toHaveBeenCalledWith(4096);
  });
});

// NF-99, AC-NF99-4: the 422 says which limit the period went over (too many files, or too large), and the page tells it; any other error is not that case.
describe('archiveExportTooLarge (NF-99)', () => {
  const MEGABYTE = 1024 * 1024;

  async function refusedWith(body: Record<string, unknown>): Promise<unknown> {
    vi.mocked(axios.get).mockRejectedValueOnce(blobError(422, { code: ARCHIVE_ERROR.tooLarge, ...body }));
    return documentArchiveApi.export({ from: '2026-01-01', to: '2026-12-31' }).catch((failure: unknown) => failure);
  }

  it('ArchiveExportTooLarge_MoreFilesThanOneArchiveHolds_IsTooManyFiles', async () => {
    const refused = await refusedWith({ fileCount: 412, maxFiles: 300, maxBytes: 200 * MEGABYTE });

    expect(archiveExportTooLarge(refused)).toEqual({ limit: 'files', fileCount: 412, maxFiles: 300 });
  });

  // A document that stores no size counts as 10 MB in the cap of the bytes: 21 property documents are 210 MB, over the 200 MB, with far fewer than 300 files.
  it('ArchiveExportTooLarge_FewFilesOverTheBytes_IsTooLargeNotTooManyFiles', async () => {
    const refused = await refusedWith({ fileCount: 21, maxFiles: 300, maxBytes: 200 * MEGABYTE });

    expect(archiveExportTooLarge(refused)).toEqual({ limit: 'size', fileCount: 21, maxFiles: 300, maxBytes: 200 * MEGABYTE });
  });

  it('ArchiveExportTooLarge_ExactlyTheMostFiles_IsTheSizeNotTheNumber', async () => {
    const refused = await refusedWith({ fileCount: 300, maxFiles: 300, maxBytes: 200 * MEGABYTE });

    expect(archiveExportTooLarge(refused)).toMatchObject({ limit: 'size' });
  });

  it.each([
    ['no number in the body', {}],
    ['no limit of the files', { fileCount: 21, maxBytes: 200 * MEGABYTE }],
    ['no count of the files', { maxFiles: 300, maxBytes: 200 * MEGABYTE }],
    ['no limit of the bytes for a few files', { fileCount: 21, maxFiles: 300 }],
    ['numbers that are not numbers', { fileCount: '21', maxFiles: -1, maxBytes: null }],
  ])('ArchiveExportTooLarge_%s_StillTheSameCaseButNoLimitIsToldApart', async (_name, body) => {
    const refused = await refusedWith(body);

    expect(archiveExportTooLarge(refused)).toEqual({ limit: null });
  });

  it.each([
    ['another 422', 422, { code: 'report_period_too_long' }],
    ['the same code on another status', 400, { code: ARCHIVE_ERROR.tooLarge }],
  ])('ArchiveExportTooLarge_%s_IsNotTheCase', async (_name, status, body) => {
    vi.mocked(axios.get).mockRejectedValueOnce(blobError(status, body));
    const refused = await documentArchiveApi.export({ from: '2026-01-01', to: '2026-12-31' }).catch((failure: unknown) => failure);

    expect(archiveExportTooLarge(refused)).toBeNull();
  });

  it('ArchiveExportTooLarge_NotAnApiError_IsNotTheCase', () => {
    expect(archiveExportTooLarge(new Error('boom'))).toBeNull();
    expect(archiveErrorCode(new Error('boom'))).toBeUndefined();
  });
});

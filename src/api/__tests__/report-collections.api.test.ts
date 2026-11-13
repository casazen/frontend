import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError, getProblemMessage } from '@/lib/api-errors';
import { collectionsFileName, reportCollectionsApi } from '../report-collections.api';
import { ReportAccessDeniedError } from '../report-files';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

const PERIOD = { from: '2026-10-01', to: '2026-10-31' };

const COLLECTIONS = {
  title: 'Incassato per data, per cassa',
  basis: 'cash',
  period: { from: '2026-10-01', to: '2026-10-31', nights: 31 },
  total: { amount: 1234.56, amountCents: 123456, paymentCount: 3 },
  byDate: [],
  byMethod: [],
  byChannel: [],
  credits: {
    stripe: { available: false, payouts: [], cardPaymentCount: 0, paymentsWithoutFigures: 0 },
    channels: { available: false, reportedBy: 'channelManager', rows: [], staysWithoutNet: 0 },
  },
};

const BALANCES = { title: 'Saldi da incassare', basis: 'balances', asOf: '2026-10-09', since: '2024-10-09', rows: [], totals: [] };

/** The error axios throws for a failed answer: its body is a Blob when the call asked for one. */
function failure(status: number, body: unknown, asBlob: boolean): AxiosError {
  const data = asBlob ? new Blob([JSON.stringify(body)], { type: 'application/problem+json' }) : body;
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportCollectionsApi (NF-97)', () => {
  it('GetCollections_Days_AreAskedAsFromAndToWithNoPropertyUnlessChosen', async () => {
    get.mockResolvedValueOnce({ status: 200, data: COLLECTIONS });

    await expect(reportCollectionsApi.getCollections(PERIOD, '')).resolves.toBe(COLLECTIONS);

    const [url, config] = get.mock.calls[0]!;
    expect(url).toBe('/reports/collections');
    expect(config?.params).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('GetCollections_Property_IsAskedForOnlyWhenChosen', async () => {
    get.mockResolvedValueOnce({ status: 200, data: COLLECTIONS });

    await reportCollectionsApi.getCollections(PERIOD, 'p-1');

    expect(get.mock.calls[0]![1]?.params).toEqual({ from: '2026-10-01', to: '2026-10-31', propertyId: 'p-1' });
  });

  // Permission: a 403 is an answer of the page, not a reason to send the whole app to the page of the missing access.
  it('GetCollections_403_ResolvesToNullAndTheClientAcceptsTheStatus', async () => {
    get.mockResolvedValueOnce({ status: 403, data: { code: 'forbidden' } });

    await expect(reportCollectionsApi.getCollections(PERIOD, '')).resolves.toBeNull();

    const validateStatus = get.mock.calls[0]![1]?.validateStatus as (status: number) => boolean;
    expect([200, 204, 403].map(validateStatus)).toEqual([true, true, true]);
    expect([400, 401, 404, 422, 500].map(validateStatus)).toEqual([false, false, false, false, false]);
  });

  it('GetCollections_AnswerThatIsNotTheReport_IsAnErrorToShowNotDataToDraw', async () => {
    get.mockResolvedValueOnce({ status: 200, data: '<!doctype html><html></html>' });
    get.mockResolvedValueOnce({ status: 200, data: { ...COLLECTIONS, byDate: undefined } });
    get.mockResolvedValueOnce({ status: 200, data: { ...COLLECTIONS, credits: { stripe: {} } } });

    await expect(reportCollectionsApi.getCollections(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    await expect(reportCollectionsApi.getCollections(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    await expect(reportCollectionsApi.getCollections(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('GetCollections_404_IsNotSwallowed', async () => {
    const notFound = failure(404, {}, false);
    get.mockRejectedValueOnce(notFound);

    await expect(reportCollectionsApi.getCollections(PERIOD, 'p-9')).rejects.toBe(notFound);
  });

  it('GetBalancesToCollect_NoDays_AskedAsOfTodayWithTheChosenProperty', async () => {
    get.mockResolvedValueOnce({ status: 200, data: BALANCES });
    get.mockResolvedValueOnce({ status: 200, data: BALANCES });

    await reportCollectionsApi.getBalancesToCollect('');
    await reportCollectionsApi.getBalancesToCollect('p-1');

    expect(get.mock.calls[0]![0]).toBe('/reports/balances-to-collect');
    expect(get.mock.calls[0]![1]?.params).toEqual({});
    expect(get.mock.calls[1]![1]?.params).toEqual({ propertyId: 'p-1' });
  });

  it('GetBalancesToCollect_403AndWrongShape_AreNullAndAnError', async () => {
    get.mockResolvedValueOnce({ status: 403, data: {} });
    get.mockResolvedValueOnce({ status: 200, data: { rows: 'x' } });

    await expect(reportCollectionsApi.getBalancesToCollect('')).resolves.toBeNull();
    await expect(reportCollectionsApi.getBalancesToCollect('')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  // Data / privacy: the file is read from the authenticated API (the client adds the token), as a Blob, and is named after the report and
  // its days: no property, guest or owner in the name.
  it.each([
    { name: 'DownloadCsv', run: () => reportCollectionsApi.downloadCsv(PERIOD, 'p-1'), format: 'csv' },
    { name: 'DownloadXlsx', run: () => reportCollectionsApi.downloadXlsx(PERIOD, 'p-1'), format: 'xlsx' },
  ])('Download_AsksTheAuthenticatedApiForABlobOfTheFormat_$name', async ({ run, format }) => {
    const file = new Blob(['x'], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    get.mockResolvedValueOnce({ status: 200, data: file });

    await expect(run()).resolves.toBe(file);

    const [url, config] = get.mock.calls[0]!;
    expect(url).toBe('/reports/collections');
    expect(config).toMatchObject({ params: { from: '2026-10-01', to: '2026-10-31', propertyId: 'p-1', format }, responseType: 'blob' });
  });

  it('CollectionsFileName_Days_AreWrittenAsTheServerNamesTheFile', () => {
    expect(collectionsFileName(PERIOD, 'csv')).toBe('casazen-incassato-per-cassa-20261001-20261031.csv');
    expect(collectionsFileName(PERIOD, 'xlsx')).toBe('casazen-incassato-per-cassa-20261001-20261031.xlsx');
  });
});

describe('the files of the money reports', () => {
  it('Download_403_IsAnAnswerOfThePageNotAFailureOfTheNetwork', async () => {
    get.mockResolvedValueOnce({ status: 403, data: new Blob(['{}'], { type: 'application/json' }) });

    await expect(reportCollectionsApi.downloadCsv(PERIOD, '')).rejects.toBeInstanceOf(ReportAccessDeniedError);
  });

  // The 422 of a file with too many rows comes as a JSON Blob: its code must be readable so the person is told to narrow the period.
  it('DownloadXlsx_422TooManyRows_KeepsTheCodeAndIsToldInWords', async () => {
    get.mockRejectedValueOnce(failure(422, { code: 'xlsx_too_many_rows', title: 'Unprocessable Entity' }, true));

    const error = await reportCollectionsApi.downloadXlsx(PERIOD, '').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AxiosError);
    const message = getProblemMessage(error, (key: string) => (key === 'apiErrors.codes.xlsxTooManyRows' ? 'troppe righe' : key));
    expect(message).toBe('troppe righe');
  });

  it('Download_AnswerThatIsAWebPageOrJson_IsNotTheFileThatWasAskedFor', async () => {
    get.mockResolvedValueOnce({ status: 200, data: new Blob(['<html></html>'], { type: 'text/html' }) });
    get.mockResolvedValueOnce({ status: 200, data: { not: 'a blob' } });

    await expect(reportCollectionsApi.downloadXlsx(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    await expect(reportCollectionsApi.downloadCsv(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

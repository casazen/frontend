import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError, getProblemMessage } from '@/lib/api-errors';
import { channelCostsFileName, reportChannelCostsApi } from '../report-channel-costs.api';
import { ACCEPT_FORBIDDEN, ReportAccessDeniedError } from '../report-files';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

const PERIOD = { from: '2026-10-01', to: '2026-10-31' };

const COSTS = { title: 'Costi dei canali', basis: 'accrual', period: { from: '2026-10-01', to: '2026-10-31', nights: 31 }, rows: [], total: { stayCount: 0 } };

/** The error axios throws for a failed answer: its body is a Blob when the call asked for one. */
function failure(status: number, body: unknown): AxiosError {
  const data = new Blob([JSON.stringify(body)], { type: 'application/problem+json' });
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportChannelCostsApi (NF-98)', () => {
  it('GetChannelCosts_DaysAndProperty_AreAskedAsFromToAndPropertyId', async () => {
    get.mockResolvedValueOnce({ status: 200, data: COSTS });
    get.mockResolvedValueOnce({ status: 200, data: COSTS });

    await expect(reportChannelCostsApi.getChannelCosts(PERIOD, '')).resolves.toBe(COSTS);
    await reportChannelCostsApi.getChannelCosts(PERIOD, 'p-2');

    expect(get.mock.calls[0]![0]).toBe('/reports/channel-costs');
    expect(get.mock.calls[0]![1]?.params).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(get.mock.calls[1]![1]?.params).toEqual({ from: '2026-10-01', to: '2026-10-31', propertyId: 'p-2' });
  });

  // Permission: a 403 is an answer of the page, not a reason to send the whole app to the page of the missing access.
  it('GetChannelCosts_403_ResolvesToNullInsteadOfSendingTheAppToTheNoAccessPage', async () => {
    get.mockResolvedValueOnce({ status: 403, data: {} });

    await expect(reportChannelCostsApi.getChannelCosts(PERIOD, '')).resolves.toBeNull();
    expect(ACCEPT_FORBIDDEN(403)).toBe(true);
    expect(get.mock.calls[0]![1]?.validateStatus).toBe(ACCEPT_FORBIDDEN);
  });

  it('GetChannelCosts_AnswerThatIsNotTheReport_IsAnErrorToShow', async () => {
    get.mockResolvedValueOnce({ status: 200, data: { rows: [] } });

    await expect(reportChannelCostsApi.getChannelCosts(PERIOD, '')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('DownloadXlsxAndCsv_AskForTheFormatAsABlob', async () => {
    const csv = new Blob(['a;b'], { type: 'text/csv' });
    const xlsx = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    get.mockResolvedValueOnce({ status: 200, data: csv });
    get.mockResolvedValueOnce({ status: 200, data: xlsx });

    await expect(reportChannelCostsApi.downloadCsv(PERIOD, '')).resolves.toBe(csv);
    await expect(reportChannelCostsApi.downloadXlsx(PERIOD, '')).resolves.toBe(xlsx);

    expect(get.mock.calls[0]![1]).toMatchObject({ params: { from: '2026-10-01', to: '2026-10-31', format: 'csv' }, responseType: 'blob' });
    expect(get.mock.calls[1]![1]).toMatchObject({ params: { format: 'xlsx' }, responseType: 'blob' });
  });

  it('Download_403_IsAnAnswerOfThePageNotAFailureOfTheNetwork', async () => {
    get.mockResolvedValueOnce({ status: 403, data: new Blob(['{}'], { type: 'application/json' }) });

    await expect(reportChannelCostsApi.downloadXlsx(PERIOD, '')).rejects.toBeInstanceOf(ReportAccessDeniedError);
  });

  // The 422 of a file with too many rows comes as a JSON Blob: its code must be readable so the person is told to narrow the period.
  it('DownloadXlsx_422TooManyRows_KeepsTheCodeAndIsToldInWords', async () => {
    get.mockRejectedValueOnce(failure(422, { code: 'xlsx_too_many_rows', title: 'Unprocessable Entity' }));

    const error = await reportChannelCostsApi.downloadXlsx(PERIOD, '').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AxiosError);
    const message = getProblemMessage(error, (key: string) => (key === 'apiErrors.codes.xlsxTooManyRows' ? 'troppe righe' : key));
    expect(message).toBe('troppe righe');
  });

  it('ChannelCostsFileName_Days_AreWrittenAsTheServerNamesTheFile', () => {
    expect(channelCostsFileName(PERIOD, 'csv')).toBe('casazen-costi-dei-canali-competenza-20261001-20261031.csv');
    expect(channelCostsFileName(PERIOD, 'xlsx')).toBe('casazen-costi-dei-canali-competenza-20261001-20261031.xlsx');
  });
});

import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError, getProblemMessage } from '@/lib/api-errors';
import { acceptsRefusal } from '../accept-refusal';
import { ReportAccessDeniedError } from '../report-files';
import { withholdingApi } from '../withholding.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

const OWNER = '11111111-1111-4111-8111-111111111111';

/** The error axios throws for a failed answer: its body is a Blob when the call asked for one. */
function failure(status: number, body: unknown): AxiosError {
  const data = new Blob([JSON.stringify(body)], { type: 'application/problem+json' });
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

interface TaxFile {
  name: string;
  call: () => Promise<unknown>;
  path: string;
  params?: Record<string, string>;
}

/** Every file of the Italian withholding that the agency hands to its accountant, with the path it is asked on and what it sends along. */
const FILES: TaxFile[] = [
  { name: 'DownloadF24Data', call: () => withholdingApi.downloadF24Data(2026, 11, 'csv'), path: '/withholding/f24/2026/11/export', params: { format: 'csv' } },
  { name: 'DownloadCuData', call: () => withholdingApi.downloadCuData(2026, 'xlsx'), path: '/withholding/annual/2026/export', params: { format: 'xlsx' } },
  { name: 'DownloadCuProspect', call: () => withholdingApi.downloadCuProspect(2026, OWNER), path: `/withholding/annual/2026/owners/${OWNER}/pdf` },
  { name: 'Download770Data', call: () => withholdingApi.download770Data(2026, 'csv'), path: '/withholding/770/2026/export', params: { format: 'csv' } },
  { name: 'DownloadContractsCommunication', call: () => withholdingApi.downloadContractsCommunication(2026, 'xlsx'), path: '/withholding/contracts-communication/2026/export', params: { format: 'xlsx' } },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the files of the withholding through the authenticated client (E18/F02/US01/T01)', () => {
  for (const file of FILES) {
    it(`${file.name}_AsksItsPathAsABlobAndTakesTheRefusalAsAnAnswer_AndKeepsTheNameTheServerGave`, async () => {
      const blob = new Blob(['a;b'], { type: 'text/csv' });
      get.mockResolvedValueOnce({ status: 200, data: blob, headers: { 'Content-Disposition': 'attachment; filename="file.csv"' } });

      await expect(file.call()).resolves.toEqual({ blob, contentDisposition: 'attachment; filename="file.csv"' });

      expect(get.mock.calls[0]![0]).toBe(file.path);
      expect(get.mock.calls[0]![1]).toMatchObject({ responseType: 'blob', validateStatus: acceptsRefusal, ...(file.params ? { params: file.params } : {}) });
    });

    // Permission: a 403 on a read makes the shared client send the whole app to the page of no access; the file tells it where the person is.
    it(`${file.name}_403_IsAnAnswerOfThePage_NeverAFailureThatSendsTheAppAway`, async () => {
      get.mockResolvedValueOnce({ status: 403, data: new Blob(['{}'], { type: 'application/json' }), headers: {} });

      await expect(file.call()).rejects.toBeInstanceOf(ReportAccessDeniedError);
      expect(acceptsRefusal(403)).toBe(true);
      expect(get.mock.calls[0]![1]?.validateStatus).toBe(acceptsRefusal);
    });
  }

  it('DownloadFile_AnAnswerThatIsAWebPageOrAJsonBody_IsNotTheFileThatWasAskedFor', async () => {
    for (const type of ['text/html', 'application/json', 'application/problem+json']) {
      get.mockResolvedValueOnce({ status: 200, data: new Blob(['x'], { type }), headers: {} });
      await expect(withholdingApi.download770Data(2026, 'csv'), type).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    }
    // Something that is not even a Blob (the page of another kind an odd proxy sends) is an error too, never a file to save.
    get.mockResolvedValueOnce({ status: 200, data: '<!doctype html><html></html>', headers: {} });
    await expect(withholdingApi.downloadCuData(2026, 'csv')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('DownloadFile_AFileWithNoNameHeaderIsStillAFile_ThePageNamesItItself', async () => {
    const blob = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    get.mockResolvedValueOnce({ status: 200, data: blob, headers: {} });

    await expect(withholdingApi.downloadContractsCommunication(2026, 'xlsx')).resolves.toEqual({ blob, contentDisposition: null });
  });

  // The 422 of a month without any decision comes as a JSON Blob: its code must be readable so the person is told in words what is missing.
  it('DownloadF24Data_422NoObligations_KeepsTheCodeAndIsToldInWords', async () => {
    get.mockRejectedValueOnce(failure(422, { code: 'tax_no_obligations', title: 'Unprocessable Entity' }));

    const error = await withholdingApi.downloadF24Data(2026, 3, 'csv').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AxiosError);
    expect(getProblemMessage(error, (key: string) => (key === 'apiErrors.codes.taxNoObligations' ? 'niente da versare' : key))).toBe('niente da versare');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode } from '@/lib/api-errors';
import { fileApi } from '../file.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

/** What a failed call of the axios client looks like when the body is a Blob (`responseType: 'blob'`). */
function blobError(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  const data = new Blob([JSON.stringify(body)], { type: 'application/problem+json' });
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('the files of the agency\'s money pages come through the authenticated client', () => {
  it('FileApi_Get_AsksTheBytesWithTheQueryAndBringsTheNameTheServerGave', async () => {
    const blob = new Blob(['%PDF-1.4']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob, headers: new AxiosHeaders({ 'content-disposition': 'attachment; filename="f24-2026-11.pdf"' }) });

    const download = await fileApi.get('/withholding/f24/pdf', { month: 11, year: 2026 });

    expect(download).toEqual({ blob, contentDisposition: 'attachment; filename="f24-2026-11.pdf"' });
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe('/withholding/f24/pdf');
    expect(config).toMatchObject({ params: { month: 11, year: 2026 }, responseType: 'blob' });
  });

  it.each([
    ['a plain object, as the name came', { 'Content-Disposition': 'attachment; filename="a.xml"' }, 'attachment; filename="a.xml"'],
    ['a plain object in lower case', { 'content-disposition': 'attachment; filename="a.xml"' }, 'attachment; filename="a.xml"'],
    ['no headers at all', undefined, null],
    ['other headers only', { 'content-type': 'application/xml' }, null],
    ['a header that is not a text', { 'content-disposition': 12 }, null],
  ])('FileApi_Get_%s_NameOrNoNameAndNoError', async (_name, headers, expected) => {
    const blob = new Blob(['<x/>']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob, headers });

    await expect(fileApi.get('/wire-transfers/batch/1/file')).resolves.toEqual({ blob, contentDisposition: expected });
  });

  it('FileApi_Get_RefusalWithABlobBody_ExposesTheCodeOfTheProblem', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(blobError(422, { code: 'statement_not_exportable' }));

    const error = await fileApi.get('/statements/1/pdf').catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(AxiosError);
    expect(getProblemCode((error as AxiosError).response?.data)).toBe('statement_not_exportable');
  });
});

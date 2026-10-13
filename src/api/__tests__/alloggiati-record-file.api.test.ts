import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { alloggiatiApi } from '../alloggiati.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('alloggiatiApi.downloadRecordFile (CO-13)', () => {
  it('downloadRecordFile_callsTheAuthenticatedEndpointAsBlob', async () => {
    const blob = new Blob(['16']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob });

    const result = await alloggiatiApi.downloadRecordFile('b-1');

    expect(axios.get).toHaveBeenCalledWith('/alloggiati/b-1/record-file', { responseType: 'blob' });
    // Never an anonymous call: the request goes through the token interceptor (no `public` flag).
    expect(vi.mocked(axios.get).mock.calls[0][1]).not.toHaveProperty('public');
    expect(result).toBe(blob);
  });

  it('downloadRecordFile_jsonProblemBody_isParsedBeforeRethrowSoTheCodeCanBeTranslated', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const body = new Blob([JSON.stringify({ code: 'alloggiati_file_not_ready' })], { type: 'application/json' });
    vi.mocked(axios.get).mockRejectedValueOnce(
      new AxiosError('Unprocessable', AxiosError.ERR_BAD_REQUEST, config, {}, {
        status: 422,
        data: body,
        statusText: '',
        headers: {},
        config,
      }),
    );

    const error = await alloggiatiApi.downloadRecordFile('b-1').catch((e: unknown) => e);

    expect((error as AxiosError).response?.data).toEqual({ code: 'alloggiati_file_not_ready' });
  });
});

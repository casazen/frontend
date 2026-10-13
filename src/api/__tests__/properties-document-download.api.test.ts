import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { propertiesApi } from '../properties.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('propertiesApi.downloadDocument (FD-07)', () => {
  it('downloadDocument_callsAuthenticatedEndpointAsBlob', async () => {
    const blob = new Blob(['%PDF']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob });

    const result = await propertiesApi.downloadDocument('p-1', 'd-1');

    expect(axios.get).toHaveBeenCalledWith('/properties/p-1/documents/d-1/download', { responseType: 'blob' });
    // Never an anonymous call: the request goes through the token interceptor (no `public` flag).
    expect(vi.mocked(axios.get).mock.calls[0][1]).not.toHaveProperty('public');
    expect(result).toBe(blob);
  });

  it('downloadDocument_jsonErrorBody_isParsedBeforeRethrow', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const body = new Blob([JSON.stringify({ code: 'document_file_missing' })], { type: 'application/json' });
    vi.mocked(axios.get).mockRejectedValueOnce(
      new AxiosError('Not found', AxiosError.ERR_BAD_REQUEST, config, {}, {
        status: 404,
        data: body,
        statusText: '',
        headers: {},
        config,
      }),
    );

    const error = await propertiesApi.downloadDocument('p-1', 'd-1').catch((e: unknown) => e);

    expect((error as AxiosError).response?.data).toEqual({ code: 'document_file_missing' });
  });
});

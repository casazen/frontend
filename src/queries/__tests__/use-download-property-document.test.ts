import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { saveBlobAs } from '@/lib/file-download';
import { useDownloadPropertyDocument } from '../use-properties';

vi.mock('@/api/properties.api');
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDownloadPropertyDocument (FD-07)', () => {
  it('mutate_success_savesBlobWithDocumentFileName', async () => {
    const blob = new Blob(['%PDF']);
    vi.mocked(propertiesApi.downloadDocument).mockResolvedValueOnce(blob);
    const { result } = renderHook(() => useDownloadPropertyDocument(), { wrapper: makeWrapper() });

    act(() => result.current.mutate({ propertyId: 'p-1', docId: 'd-1', fileName: 'Contratto.pdf' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(propertiesApi.downloadDocument).toHaveBeenCalledWith('p-1', 'd-1');
    expect(saveBlobAs).toHaveBeenCalledWith(blob, 'Contratto.pdf');
  });

  it('mutate_fileMissing_showsTranslatedErrorNotAFakeDownload', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    vi.mocked(propertiesApi.downloadDocument).mockRejectedValueOnce(
      new AxiosError('Not found', AxiosError.ERR_BAD_REQUEST, config, {}, {
        status: 404,
        data: { code: 'document_file_missing' },
        statusText: '',
        headers: {},
        config,
      }),
    );
    const { result } = renderHook(() => useDownloadPropertyDocument(), { wrapper: makeWrapper() });

    act(() => result.current.mutate({ propertyId: 'p-1', docId: 'd-1', fileName: 'Contratto.pdf' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(saveBlobAs).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.documentFileMissing'));
  });
});

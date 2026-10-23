import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import { apeReadFoundNothing } from '@/lib/ape-documents';
import type { PropertyDocumentDto } from '@/types';
import { useApeAutoRead, useReadApeIdentification, useUploadPropertyDocument } from '../use-properties';

vi.mock('@/api/properties.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const APE: PropertyDocumentDto = {
  id: 'doc-ape',
  fileName: 'APE.pdf',
  fileType: 'pdf',
  documentType: 'Ape',
  uploadedAt: '2026-10-23T10:00:00Z',
  downloadUrl: '',
  apeCode: null,
  apeEnergyClass: null,
};
const READ: PropertyDocumentDto = { ...APE, apeCode: '1610800012345/17', apeEnergyClass: 'F' };
const PDF = new File(['%PDF-1.7'], 'APE.pdf', { type: 'application/pdf' });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('reading the code and the class of an APE by itself (LT-10)', () => {
  it('useApeAutoRead_ApeWithoutCodeAndClass_AsksTheServerOnceForTheDocument', async () => {
    vi.mocked(propertiesApi.readApeIdentification).mockResolvedValue(READ);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result, rerender } = renderHook(() => useApeAutoRead('p-1', APE), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender();

    expect(propertiesApi.readApeIdentification).toHaveBeenCalledTimes(1);
    expect(propertiesApi.readApeIdentification).toHaveBeenCalledWith('p-1', 'doc-ape');
    // The documents shown are read again before the reading is done, so they already carry what was found.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties', 'p-1', 'documents'] });
    expect(client.getQueryState(['ape-read', 'doc-ape'])?.status).toBe('success');
    expect(apeReadFoundNothing('doc-ape')).toBe(false);
  });

  it('useApeAutoRead_NotTheDocumentOfTheContract_DoesNotAsk', () => {
    const { wrapper } = setup();

    renderHook(() => useApeAutoRead('p-1', APE, false), { wrapper });
    renderHook(() => useApeAutoRead('p-1', READ), { wrapper });
    renderHook(() => useApeAutoRead('p-1', { ...APE, documentType: 'FloorPlan' }), { wrapper });

    expect(propertiesApi.readApeIdentification).not.toHaveBeenCalled();
  });

  it('useApeAutoRead_ReadingFoundNothing_IsRememberedAndNotAskedAgainAtTheNextVisit', async () => {
    vi.mocked(propertiesApi.readApeIdentification).mockResolvedValue({ ...APE, apeCode: null, apeEnergyClass: 'F' });
    const first = setup();
    const { result } = renderHook(() => useApeAutoRead('p-1', APE), { wrapper: first.wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apeReadFoundNothing('doc-ape')).toBe(true);

    // Another visit of the same browser (a new cache): the same file would give the same answer, a minute of server for nothing.
    const second = setup();
    renderHook(() => useApeAutoRead('p-1', APE), { wrapper: second.wrapper });

    expect(propertiesApi.readApeIdentification).toHaveBeenCalledTimes(1);
  });

  it('useUploadPropertyDocument_ApeReadByTheUpload_SeedsTheReadingSoNobodyReadsItAgain', async () => {
    vi.mocked(propertiesApi.uploadDocument).mockResolvedValue(READ);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUploadPropertyDocument(), { wrapper });

    await act(() => result.current.mutateAsync({ propertyId: 'p-1', file: PDF, documentType: 'Ape' }));

    expect(client.getQueryData(['ape-read', 'doc-ape'])).toEqual(READ);
    expect(apeReadFoundNothing('doc-ape')).toBe(false);
  });

  it('useUploadPropertyDocument_ApeNotReadWhole_IsRememberedSoThePageAsksForTheFieldsAtOnce', async () => {
    vi.mocked(propertiesApi.uploadDocument).mockResolvedValue({ ...APE, apeEnergyClass: 'F' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useUploadPropertyDocument(), { wrapper });

    await act(() => result.current.mutateAsync({ propertyId: 'p-1', file: PDF, documentType: 'Ape' }));

    expect(apeReadFoundNothing('doc-ape')).toBe(true);
  });

  it('useUploadPropertyDocument_NotAnApe_LeavesTheReadingAlone', async () => {
    vi.mocked(propertiesApi.uploadDocument).mockResolvedValue({ ...APE, id: 'doc-plan', documentType: 'FloorPlan' });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUploadPropertyDocument(), { wrapper });

    await act(() => result.current.mutateAsync({ propertyId: 'p-1', file: PDF, documentType: 'FloorPlan' }));

    expect(client.getQueryData(['ape-read', 'doc-plan'])).toBeUndefined();
    expect(apeReadFoundNothing('doc-plan')).toBe(false);
  });

  it('useReadApeIdentification_ReadingFails_SaysSoAndKeepsTheFieldsAvailable', async () => {
    vi.mocked(propertiesApi.readApeIdentification).mockRejectedValue(new Error('timeout of 120000ms exceeded'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReadApeIdentification(), { wrapper });

    act(() => result.current.mutate({ propertyId: 'p-1', docId: 'doc-ape' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(i18n.t('toast.apeReadFailed'));
    // A failure is not an answer: the file is not remembered as one that gives nothing.
    expect(apeReadFoundNothing('doc-ape')).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import * as api from '@/api/fiscal-documents.api';
import { document } from '@/features/fiscal/documents/__tests__/document-fixtures';
import { SDI_POLL_MS, SDI_WATCH_MS, useDownloadFiscalDocument, useExportFiscalDocuments, useFiscalDocuments } from '../use-fiscal-documents';

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, listDocuments: vi.fn(), downloadPdf: vi.fn(), downloadXml: vi.fn(), exportList: vi.fn() };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const TOKEN = 'secret-access-token';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

/** The failure of a call as the client throws it: its request holds the access token of the caller. */
function failureWithToken(status: number): AxiosError {
  const headers = new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` });
  const config = { headers, url: '/fiscal/documents/x/pdf' } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: { code: 'x_code' }, statusText: '', headers: {}, config });
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  createObjectURL = vi.fn(() => 'blob:http://localhost/fiscal');
  revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDownloadFiscalDocument (privacy rule: the file is a document of a person, it is released and never kept)', () => {
  it('UseDownloadFiscalDocument_AFile_IsSavedUnderItsNameAndItsAddressIsReleasedAtOnce', async () => {
    vi.mocked(api.downloadPdf).mockResolvedValue({ blob: new Blob(['%PDF']), contentDisposition: 'attachment; filename=documento-A-12.pdf' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useDownloadFiscalDocument(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ document: document(), format: 'pdf' });
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fiscal');
    const anchor = vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('documento-A-12.pdf');
  });

  it('UseDownloadFiscalDocument_AFile_NeverStaysInTheCacheOfTheMutations', async () => {
    vi.mocked(api.downloadXml).mockResolvedValue({ blob: new Blob(['<xml>fiscal data</xml>']), contentDisposition: null });
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useDownloadFiscalDocument(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ document: document(), format: 'xml' });
    });

    // Nothing is handed back: the bytes went to the disk inside the function of the mutation, never into the cache.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(client.getMutationCache().getAll().every((mutation) => mutation.state.data === undefined)).toBe(true);

    // And the mutation itself is dropped as soon as nothing watches it (`gcTime: 0`).
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('UseDownloadFiscalDocument_AFailure_IsKeptWithoutTheRequestThatHoldsTheAccessToken', async () => {
    vi.mocked(api.downloadPdf).mockRejectedValue(failureWithToken(500));
    const { wrapper } = setup();
    const { result } = renderHook(() => useDownloadFiscalDocument(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ document: document(), format: 'pdf' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const kept = result.current.error as AxiosError;
    expect(kept.response?.status).toBe(500);
    expect(kept.response?.data).toEqual({ code: 'x_code' });
    expect(JSON.stringify(kept.config)).not.toContain(TOKEN);
    expect(JSON.stringify(kept.toJSON())).not.toContain(TOKEN);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('useExportFiscalDocuments', () => {
  it('UseExportFiscalDocuments_AFile_IsSavedAndLeavesNothingInTheCache', async () => {
    vi.mocked(api.exportList).mockResolvedValue({ blob: new Blob(['x']), contentDisposition: null });
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useExportFiscalDocuments(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ format: 'xlsx', criteria: { from: '2026-10-15' } });
    });

    expect(api.exportList).toHaveBeenCalledWith('xlsx', { from: '2026-10-15' });
    expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.instances).toHaveLength(1);
    expect((vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('documenti-2026-10.xlsx');
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('useFiscalDocuments (the list is read again, and is not kept)', () => {
  const page = (items = [document()]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });

  it('UseFiscalDocuments_NotEnabled_AsksNothing', () => {
    const { wrapper } = setup();
    renderHook(() => useFiscalDocuments({}, 1, 20, { enabled: false }), { wrapper });

    expect(api.listDocuments).not.toHaveBeenCalled();
  });

  it('UseFiscalDocuments_APage_IsReadAgainWheneverItOpensAndNotKeptOnceNothingShowsIt', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue(page());
    const { client, wrapper } = setup();
    const first = renderHook(() => useFiscalDocuments({ kind: 'Invoice' }, 1, 20), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(api.listDocuments).toHaveBeenCalledWith({ kind: 'Invoice' }, 1, 20);

    first.unmount();
    // The names of the recipients do not stay in the browser: nothing watches the list, nothing keeps it.
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['fiscal', 'documents', 'list'] })).toHaveLength(0));

    renderHook(() => useFiscalDocuments({ kind: 'Invoice' }, 1, 20), { wrapper });
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledTimes(2));
  });

  it('UseFiscalDocuments_ADocumentWaitingForTheSdi_IsReadAgainByItselfAndOtherwiseIsNot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'submitted' })]));
      const { wrapper } = setup();
      const waiting = renderHook(() => useFiscalDocuments({}, 1, 20), { wrapper });
      await waitFor(() => expect(waiting.result.current.isSuccess).toBe(true));
      expect(api.listDocuments).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS + 1000);
      });
      expect(vi.mocked(api.listDocuments).mock.calls.length).toBeGreaterThanOrEqual(2);
      waiting.unmount();

      vi.mocked(api.listDocuments).mockClear();
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'delivered' })]));
      const settled = renderHook(() => useFiscalDocuments({}, 1, 20), { wrapper });
      await waitFor(() => expect(settled.result.current.isSuccess).toBe(true));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS * 3);
      });
      expect(api.listDocuments).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // Cost rule: a tab left open does not ask for days. The answer of the SDI is followed for `SDI_WATCH_MS`; after it the page stops, says so (`watchOver`) and «Controlla di nuovo»
  // (`checkAgain`) reads at once and opens the window again. The first read is waited for BEFORE the clock moves.
  it('UseFiscalDocuments_ADocumentStillWaitingForTheSdiAfterTheWindow_IsNoLongerReadByItselfUntilCheckedAgain', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'submitted' })]));
      const { wrapper } = setup();
      const waiting = renderHook(() => useFiscalDocuments({}, 1, 20), { wrapper });
      await waitFor(() => expect(waiting.result.current.isSuccess).toBe(true));
      expect(waiting.result.current.watchOver).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_WATCH_MS + SDI_POLL_MS);
      });
      const reads = vi.mocked(api.listDocuments).mock.calls.length;
      // It asked by itself while the window was open, once a minute and no more than the window holds...
      expect(reads).toBeGreaterThan(10);
      expect(reads).toBeLessThanOrEqual(SDI_WATCH_MS / SDI_POLL_MS + 2);
      expect(waiting.result.current.watchOver).toBe(true);

      // ...and it asks no more once the window is over, however long the tab stays open.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS * 10);
      });
      expect(api.listDocuments).toHaveBeenCalledTimes(reads);

      // «Controlla di nuovo» reads at once, opens the window again, and the page follows the document by itself again.
      await act(async () => {
        waiting.result.current.checkAgain();
      });
      await waitFor(() => expect(vi.mocked(api.listDocuments).mock.calls.length).toBe(reads + 1));
      expect(waiting.result.current.watchOver).toBe(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS + 1000);
      });
      expect(vi.mocked(api.listDocuments).mock.calls.length).toBeGreaterThanOrEqual(reads + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('UseFiscalDocuments_ATabInTheBackground_DoesNotAskByItself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'submitted' })]));
      const { wrapper } = setup();
      const waiting = renderHook(() => useFiscalDocuments({}, 1, 20), { wrapper });
      await waitFor(() => expect(waiting.result.current.isSuccess).toBe(true));
      expect(api.listDocuments).toHaveBeenCalledTimes(1);

      focusManager.setFocused(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS * 3);
      });
      expect(api.listDocuments).toHaveBeenCalledTimes(1);
    } finally {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });

  it('UseFiscalDocuments_APageThatIsLeft_AsksNothingMore', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(api.listDocuments).mockResolvedValue(page([document({ sdiStatus: 'submitted' })]));
      const { wrapper } = setup();
      const waiting = renderHook(() => useFiscalDocuments({}, 1, 20), { wrapper });
      await waitFor(() => expect(waiting.result.current.isSuccess).toBe(true));
      expect(api.listDocuments).toHaveBeenCalledTimes(1);

      waiting.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SDI_POLL_MS * 3);
      });
      expect(api.listDocuments).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { toast } from 'sonner';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import type { UploadSwissReceiptForm } from '@/types/swissCompliance.types';
import {
  isAlreadyDeclaredConflict,
  useDeclareTicinoDay,
  useDownloadGroupSheet,
  useDownloadTicinoFile,
  useRecordTicinoDocument,
  useUndeclareTicinoDay,
} from '../swissCompliance';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/swissCompliance.api', () => ({
  swissComplianceApi: {
    getTicinoDay: vi.fn(),
    downloadTicinoFile: vi.fn(),
    downloadGroupSheet: vi.fn(),
    declareTicinoDay: vi.fn(),
    undeclareTicinoDay: vi.fn(),
    uploadReceipt: vi.fn(),
  },
}));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const DAY = '2026-11-19';
const GUEST = 'Giulia Bianchi';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

function refusal(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ file: `riepilogo-${GUEST}.pdf`, arrivalDay: DAY }) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: code ? { code } : {}, statusText: '', headers: {}, config });
}

const receipt = (file = new File(['pdf'], `riepilogo-${GUEST}.pdf`, { type: 'application/pdf' })): UploadSwissReceiptForm => ({
  type: 'Police',
  reportDate: DAY,
  reference: 'TI-ref',
  file,
});

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

/**
 * Privacy (NF-128, no personal data kept): the layer of the Ticino notification files documents that hold the names of guests (the receipt of the portal, the authorization of
 * the parents, the sheet of a group) and saves the file of the guests. A mutation keeps what it was given and the request of a failure in the cache of the mutations for five
 * minutes by default, after the layer is gone.
 */
describe('what the layer of the Ticino notification files is not kept once it is gone', () => {
  it('useRecordTicinoDocument_Refused_KeepsTheAnswerButNotTheRequestThatCarriesTheFile', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(swissComplianceApi.uploadReceipt).mockRejectedValue(refusal(400, 'swiss_receipt_file_invalid'));
    const { result, unmount } = renderHook(() => useRecordTicinoDocument(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(receipt())).rejects.toMatchObject({ response: { status: 400 } });
    });

    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(400);
    expect(kept.response?.data).toEqual({ code: 'swiss_receipt_file_invalid' });
    expect(JSON.stringify(kept.config ?? {})).not.toContain(GUEST);
    expect(JSON.stringify(kept.response?.config ?? {})).not.toContain(GUEST);
    expect(queryClient.getMutationCache().getAll()[0]?.options.gcTime).toBe(0);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useRecordTicinoDocument_Filed_LeavesNothingInTheMutationCacheOnceTheLayerIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(swissComplianceApi.uploadReceipt).mockResolvedValue({ id: 'r1', propertyId: PROPERTY_ID, type: 'Police', reportDate: DAY, reference: 'TI-ref', fileHash: 'h', uploadedAt: DAY });
    vi.mocked(swissComplianceApi.declareTicinoDay).mockResolvedValue({ propertyId: PROPERTY_ID, arrivalDay: DAY, declaredAt: DAY, declaredBy: null, receiptId: 'r1', created: true });
    const { result, unmount } = renderHook(() => useRecordTicinoDocument(PROPERTY_ID), { wrapper });
    const form = receipt();

    await act(async () => {
      await result.current.mutateAsync(form);
    });
    expect(swissComplianceApi.uploadReceipt).toHaveBeenCalledWith(PROPERTY_ID, form);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useDownloadTicinoFile_Saved_KeepsNoFileOfTheGuestsAndNothingOnceTheLayerIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(swissComplianceApi.downloadTicinoFile).mockResolvedValue(new Blob([`Rossi;Mario;${GUEST}`]));
    const { result, unmount } = renderHook(() => useDownloadTicinoFile(PROPERTY_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ reportDate: DAY, format: 'csv' });
    });

    expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'notifiche-ti-2026-11-19.csv');
    expect(queryClient.getMutationCache().getAll()[0]?.state.data).toBeUndefined();

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it.each([
    ['the sheet of a group', () => useDownloadGroupSheet(PROPERTY_ID), (hook: ReturnType<typeof useDownloadGroupSheet>) => hook.mutateAsync({ bookingId: 'b1', day: DAY }), swissComplianceApi.downloadGroupSheet],
    ['the declaration of a day', () => useDeclareTicinoDay(PROPERTY_ID), (hook: ReturnType<typeof useDeclareTicinoDay>) => hook.mutateAsync({ arrivalDay: DAY }), swissComplianceApi.declareTicinoDay],
    ['the undo of a declaration', () => useUndeclareTicinoDay(PROPERTY_ID), (hook: ReturnType<typeof useUndeclareTicinoDay>) => hook.mutateAsync(DAY), swissComplianceApi.undeclareTicinoDay],
  ] as const)('Refused_%s_KeepsTheAnswerButNotTheRequestAndNothingOnceTheLayerIsGone', async (_name, useHook, run, call) => {
    const { queryClient, wrapper } = setup();
    vi.mocked(call as (...args: unknown[]) => Promise<unknown>).mockRejectedValue(refusal(422, 'property_not_in_ticino'));
    const { result, unmount } = renderHook(() => useHook() as never, { wrapper });

    await act(async () => {
      await expect((run as (hook: unknown) => Promise<unknown>)(result.current)).rejects.toMatchObject({ response: { status: 422 } });
    });

    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(422);
    expect(JSON.stringify(kept.config ?? {})).not.toContain(GUEST);
    expect(queryClient.getMutationCache().getAll()[0]?.options.gcTime).toBe(0);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('the answers of the Ticino notification that the layer tells apart', () => {
  it('isAlreadyDeclaredConflict_The409OfAClosedDay_IsTheOneThatAsksTheConfirmation', () => {
    expect(isAlreadyDeclaredConflict(refusal(409, 'ticino_day_already_declared'))).toBe(true);
    expect(isAlreadyDeclaredConflict(refusal(409, 'something_else'))).toBe(false);
    expect(isAlreadyDeclaredConflict(refusal(500, 'ticino_day_already_declared'))).toBe(false);
    expect(isAlreadyDeclaredConflict(new Error('ticino_day_already_declared'))).toBe(false);
    expect(isAlreadyDeclaredConflict(null)).toBe(false);
  });

  it('useDownloadTicinoFile_TheConflictOfAClosedDay_IsNotAToastBecauseTheLayerAsksInstead', async () => {
    const { wrapper } = setup();
    vi.mocked(swissComplianceApi.downloadTicinoFile).mockRejectedValue(refusal(409, 'ticino_day_already_declared'));
    const { result } = renderHook(() => useDownloadTicinoFile(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ reportDate: DAY, format: 'csv' })).rejects.toMatchObject({ response: { status: 409 } });
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(saveBlobAs).not.toHaveBeenCalled();
  });

  it('useDownloadTicinoFile_AnyOtherRefusal_IsToldInWords', async () => {
    const { wrapper } = setup();
    vi.mocked(swissComplianceApi.downloadTicinoFile).mockRejectedValue(refusal(422, 'ticino_structure_id_missing'));
    const { result } = renderHook(() => useDownloadTicinoFile(PROPERTY_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ reportDate: DAY, format: 'csv' })).rejects.toMatchObject({ response: { status: 422 } });
    });

    expect(toast.error).toHaveBeenCalledWith('Manca il numero identificativo della struttura: inseriscilo per creare il file.');
  });
});

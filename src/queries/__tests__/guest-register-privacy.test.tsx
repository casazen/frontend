import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { toast } from 'sonner';
import { guestRegisterApi } from '@/api/guest-register.api';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { useDownloadGuestRegister, useGuestRegisterInfo, usePrintGuestRegister } from '../guestRegister';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/guest-register.api', () => ({ guestRegisterApi: { getInfo: vi.fn(), download: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const PERIOD = { from: '2026-10-23', to: '2026-11-21' };
/** A guest the file holds: what the mutations must not keep. */
const GUEST = 'Giulia Bianchi';
const CSV = `Arrivo;Cognome;Nome;Firma\r\n19.11.2026;Bianchi;Giulia;\r\n`;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

/** A refusal of the API as axios keeps it, with the request that was sent (and the guest it names in a field, as a request that carried a body would). */
function refusal(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify({ guest: GUEST }) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: code ? { code } : {}, statusText: '', headers: {}, config });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

/**
 * Privacy (NF-130, the register is never stored): the file holds the guests of a period by name, document and address. A mutation keeps what it returns and the request of a failure in the cache of
 * the mutations for five minutes by default, after the layer is gone.
 */
describe('what the guest register is not kept once the layer is gone', () => {
  it('useDownloadGuestRegister_Saved_KeepsNoFileOfTheGuestsAndNothingOnceTheLayerIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(guestRegisterApi.download).mockResolvedValue({ blob: new Blob([CSV]), contentDisposition: null });
    const { result, unmount } = renderHook(() => useDownloadGuestRegister(PROPERTY_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(PERIOD);
    });

    // The file is saved and let go: the mutation holds no data (the bytes are never in the cache).
    expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'registro-ospiti-ch-2026-10-23-2026-11-21.csv');
    expect(queryClient.getMutationCache().getAll()[0]?.state.data).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()[0]?.options.gcTime).toBe(0);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('usePrintGuestRegister_Read_HandsTheTableToTheCallerAndKeepsNothingOfTheGuestsAnywhereElse', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(guestRegisterApi.download).mockResolvedValue({ blob: new Blob([CSV]), contentDisposition: null });
    const onTable = vi.fn();
    const { result, unmount } = renderHook(() => usePrintGuestRegister(PROPERTY_ID, onTable), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(PERIOD);
    });

    // The caller draws it, prints it and lets it go; the period it was made for comes with it.
    expect(onTable).toHaveBeenCalledWith({ header: ['Arrivo', 'Cognome', 'Nome', 'Firma'], rows: [['19.11.2026', 'Bianchi', 'Giulia', '']] }, PERIOD);
    expect(guestRegisterApi.download).toHaveBeenCalledWith(PROPERTY_ID, PERIOD, 'it');
    const kept = queryClient.getMutationCache().getAll()[0];
    expect(kept?.state.data).toBeUndefined();
    expect(JSON.stringify(kept?.state ?? {})).not.toContain(GUEST);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it.each([
    ['the download', () => useDownloadGuestRegister(PROPERTY_ID), (hook: ReturnType<typeof useDownloadGuestRegister>) => hook.mutateAsync(PERIOD)],
    ['the print', () => usePrintGuestRegister(PROPERTY_ID, vi.fn()), (hook: ReturnType<typeof usePrintGuestRegister>) => hook.mutateAsync(PERIOD)],
  ] as const)('Refused_%s_KeepsTheAnswerButNotTheRequestAndNothingOnceTheLayerIsGone', async (_name, useHook, run) => {
    const { queryClient, wrapper } = setup();
    vi.mocked(guestRegisterApi.download).mockRejectedValue(refusal(404, 'guest_register_not_available'));
    const { result, unmount } = renderHook(() => useHook() as never, { wrapper });

    await act(async () => {
      await expect((run as (hook: unknown) => Promise<unknown>)(result.current)).rejects.toMatchObject({ response: { status: 404 } });
    });

    // What the layer turns into words stays (the status and the code of the answer); the request does not.
    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(404);
    expect(kept.response?.data).toEqual({ code: 'guest_register_not_available' });
    expect(JSON.stringify(kept.config ?? {})).not.toContain(GUEST);
    expect(JSON.stringify(kept.response?.config ?? {})).not.toContain(GUEST);
    // The words of the refusal are the ones of its code, in the language of the page.
    expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.guestRegisterNotAvailable'));

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('the count of the guest register (E31/F02/US02/T01)', () => {
  it('useGuestRegisterInfo_APeriodThatIsNotOne_AsksNothing', () => {
    const { wrapper } = setup();
    renderHook(() => useGuestRegisterInfo(PROPERTY_ID, null), { wrapper });
    renderHook(() => useGuestRegisterInfo('', PERIOD), { wrapper });
    renderHook(() => useGuestRegisterInfo(PROPERTY_ID, PERIOD, { enabled: false }), { wrapper });

    expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
  });

  it('useGuestRegisterInfo_APeriod_AsksTheCountOfThatPeriodOfThatProperty', async () => {
    const { wrapper } = setup();
    vi.mocked(guestRegisterApi.getInfo).mockResolvedValue({ propertyId: PROPERTY_ID, ...PERIOD, rowCount: 4, retentionYears: 5, regimeCode: 'CH-TI' });
    const { result } = renderHook(() => useGuestRegisterInfo(PROPERTY_ID, PERIOD), { wrapper });

    await waitFor(() => expect(result.current.data?.rowCount).toBe(4));
    expect(guestRegisterApi.getInfo).toHaveBeenCalledWith(PROPERTY_ID, PERIOD);
  });
});

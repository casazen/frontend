import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { useResendCheckInLink } from '../use-checkin';
import { bookingsApi } from '@/api/bookings.api';

vi.mock('@/api/bookings.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

async function resendAndFail(error: unknown) {
  vi.mocked(bookingsApi.resendCheckInLink).mockRejectedValueOnce(error);
  const { result } = renderHook(() => useResendCheckInLink('b1'), { wrapper });
  await act(async () => {
    result.current.mutate();
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useResendCheckInLink onError (A9-09 FE)', () => {
  it('onError_problemDetailsDetail_showsServerMessage', async () => {
    await resendAndFail(httpError(409, { detail: "Il link di check-in è già stato completato dall'ospite." }));

    expect(toast.error).toHaveBeenCalledWith("Il link di check-in è già stato completato dall'ospite.");
  });

  it('onError_noUsefulBody_keepsGenericTranslatedMessage', async () => {
    await resendAndFail(httpError(500, { detail: 'System.NullReferenceException at ...' }));

    expect(toast.error).toHaveBeenCalledWith(i18n.t('checkin.resendError'));
  });
});

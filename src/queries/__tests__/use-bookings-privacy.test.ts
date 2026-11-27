import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { bookingsApi } from '@/api/bookings.api';
import { useBookingEditQuote, useCancelBooking, useRetryOctorateSync, useUpdateBooking } from '../use-bookings';

vi.mock('@/api/bookings.api', () => ({
  asBookingPage: vi.fn(),
  bookingsApi: { update: vi.fn(), editQuote: vi.fn(), cancel: vi.fn(), retryOctorateSync: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOTE = 'La signora Bianchi arriva tardi, citofono rotto';
const TOKEN = 'Bearer eyJhbGciOiJSUzI1NiJ9.secret';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

function refusal(): AxiosError {
  const config = {
    headers: new AxiosHeaders({ Authorization: TOKEN }),
    data: JSON.stringify({ specialRequests: NOTE }),
  } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status: 422,
    data: { status: 422, code: 'booking_settlement_failed' },
    statusText: '',
    headers: {},
    config,
  });
}

async function expectTheAnswerAndNotTheRequestIsKept<V>(hook: () => { mutateAsync: (variables: V) => Promise<unknown> }, variables: V) {
  const { queryClient, wrapper } = setup();
  const { result, unmount } = renderHook(hook, { wrapper });

  await act(async () => {
    await expect(result.current.mutateAsync(variables)).rejects.toBeDefined();
  });

  const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
  expect(kept.response?.status).toBe(422);
  expect(kept.response?.data).toEqual({ status: 422, code: 'booking_settlement_failed' });
  expect(kept.config?.data).toBeUndefined();
  expect(JSON.stringify(kept.config ?? {})).not.toContain(NOTE);
  expect(JSON.stringify(kept.config ?? {})).not.toContain('secret');

  unmount();
  await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
}

describe('the mutations of the edit and of the cancellation keep nothing once the page is gone', () => {
  const edit = { checkInDate: '2027-10-01', checkOutDate: '2027-10-06', numberOfGuests: 2, specialRequests: NOTE };

  it('useUpdateBooking_Refused_KeepsTheAnswerAndNotTheRequest', async () => {
    vi.mocked(bookingsApi.update).mockRejectedValue(refusal());

    await expectTheAnswerAndNotTheRequestIsKept(() => useUpdateBooking(), { id: 'b-1', data: edit });
  });

  it('useBookingEditQuote_Refused_KeepsTheAnswerAndNotTheRequest', async () => {
    vi.mocked(bookingsApi.editQuote).mockRejectedValue(refusal());

    await expectTheAnswerAndNotTheRequestIsKept(() => useBookingEditQuote(), { id: 'b-1', data: edit });
  });

  it('useCancelBooking_Refused_KeepsTheAnswerAndNotTheRequest', async () => {
    vi.mocked(bookingsApi.cancel).mockRejectedValue(refusal());

    await expectTheAnswerAndNotTheRequestIsKept(() => useCancelBooking(), { id: 'b-1', data: { reason: NOTE } });
  });

  it('useRetryOctorateSync_Refused_KeepsTheAnswerAndNotTheRequest', async () => {
    vi.mocked(bookingsApi.retryOctorateSync).mockRejectedValue(refusal());

    await expectTheAnswerAndNotTheRequestIsKept(() => useRetryOctorateSync(), { id: 'b-1', overwrite: true });
  });

  it('useUpdateBooking_Saved_LeavesNothingInTheMutationCacheOnceThePageIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.update).mockResolvedValue({ id: 'b-1', specialRequests: NOTE } as never);
    const { result, unmount } = renderHook(() => useUpdateBooking(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b-1', data: edit });
    });
    expect(queryClient.getMutationCache().getAll()[0]?.state.variables).toMatchObject({ data: { specialRequests: NOTE } });

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useCancelBooking_Cancelled_LeavesTheReasonNowhereOnceTheDialogIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.cancel).mockResolvedValue({ bookingId: 'b-1', status: 'Cancelled', refunds: [], canceledIntents: 0 });
    const { result, unmount } = renderHook(() => useCancelBooking(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b-1', data: { reason: NOTE } });
    });
    expect(queryClient.getMutationCache().getAll()[0]?.state.variables).toMatchObject({ data: { reason: NOTE } });

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});

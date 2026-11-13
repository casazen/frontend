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

/** What a refused call carries: the answer, and the request that was sent, with the note of the host in its body and the access token in its headers. */
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

/** Runs a mutation that the server refuses, and checks what the mutation cache keeps of it while the page is there and after it is gone. */
async function expectTheAnswerAndNotTheRequestIsKept<V>(hook: () => { mutateAsync: (variables: V) => Promise<unknown> }, variables: V) {
  const { queryClient, wrapper } = setup();
  const { result, unmount } = renderHook(hook, { wrapper });

  await act(async () => {
    await expect(result.current.mutateAsync(variables)).rejects.toBeDefined();
  });

  const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
  // What a screen turns into words is still there...
  expect(kept.response?.status).toBe(422);
  expect(kept.response?.data).toEqual({ status: 422, code: 'booking_settlement_failed' });
  // ...and the request that failed is not: not the note, not the token.
  expect(kept.config?.data).toBeUndefined();
  expect(JSON.stringify(kept.config ?? {})).not.toContain(NOTE);
  expect(JSON.stringify(kept.config ?? {})).not.toContain('secret');

  unmount();
  await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
}

/**
 * Privacy (E08/F03/US02): a mutation keeps what it was given (the notes of the host, the ages of the minors, the reason of a cancellation) and, when it fails, the request that
 * was sent (the same body, and the access token of the call) in the mutation cache for five minutes by default, after the page that made it is gone. None of that may stay in the
 * browser's memory: the mutation is dropped as soon as nothing observes it, and a refusal is kept with what a screen reads (the status and the answer) and nothing of the request.
 */
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
    // While the page that saved is there, the mutation is its own...
    expect(queryClient.getMutationCache().getAll()[0]?.state.variables).toMatchObject({ data: { specialRequests: NOTE } });

    // ...and as soon as it is gone nothing of it is left to read.
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

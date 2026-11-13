import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createElement } from 'react';
import { bookingsApi } from '@/api/bookings.api';
import { ConnectApi } from '@/api/connect.api';
import type { Booking, BookingPaymentLink, CreateManualBookingDto, ManualBooking } from '@/types';
import {
  BOOKINGS_KEY,
  bookingMirrorKey,
  useBookingMirror,
  useCreateManualBooking,
  useCreatePaymentLink,
  usePaymentLinkAccountReady,
  useRetryOctorateSync,
} from '../use-bookings';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  asBookingPage: vi.fn(),
  bookingsApi: { createManual: vi.fn(), createPaymentLink: vi.fn(), retryOctorateSync: vi.fn(), getById: vi.fn() },
}));
vi.mock('@/api/connect.api', () => ({ ConnectApi: { getStatus: vi.fn() } }));

const GUEST_EMAIL = 'mario.rossi@example.com';
const LINK = 'https://example.test/book/casa/booking/b-1?token=secret-token';

const dto: CreateManualBookingDto = {
  propertyId: 'property-1',
  checkInDate: '2027-10-01',
  checkOutDate: '2027-10-05',
  adults: 2,
  children: 0,
  guest: { firstName: 'Mario', lastName: 'Rossi', email: GUEST_EMAIL },
  paymentArrangement: 'paymentLink',
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

/** A refusal of the API as axios keeps it: with the request that was sent, whose body holds the guest. */
function refusal(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: JSON.stringify(dto) } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Privacy (NF-74): a mutation keeps what it was given (the name, the e-mail and the phone of the guest) and what it got back (the payment link, a credential)
 * in the mutation cache for five minutes by default, after the wizard that made it is gone.
 */
describe('what the new-booking wizard asks and gets back is not kept once it is gone', () => {
  it('useCreateManualBooking_Created_LeavesNothingInTheMutationCacheOnceTheWizardIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'b-1', paymentLinkUrl: LINK } as ManualBooking);
    const { result, unmount } = renderHook(() => useCreateManualBooking(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(dto);
    });

    // While the wizard is there the mutation is its own: it holds the guest it was given and the link it got back...
    const held = queryClient.getMutationCache().getAll()[0];
    expect(held?.state.variables).toMatchObject({ guest: { email: GUEST_EMAIL } });
    expect(held?.state.data).toMatchObject({ paymentLinkUrl: LINK });

    // ...and as soon as it is gone nothing of it is left to read.
    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useCreateManualBooking_Refused_KeepsTheAnswerOfTheApiAndNotTheRequestThatHoldsTheGuest', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.createManual).mockRejectedValue(refusal(409, { status: 409, code: 'booking_dates_unavailable' }));
    const { result, unmount } = renderHook(() => useCreateManualBooking(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(dto)).rejects.toMatchObject({ response: { status: 409, data: { code: 'booking_dates_unavailable' } } });
    });

    // What a screen turns into words stays (the status and the code); the body that was sent does not.
    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(409);
    expect(JSON.stringify(kept.config ?? {})).not.toContain(GUEST_EMAIL);
    expect(kept.config?.data).toBeUndefined();

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useCreateManualBooking_Created_ReadsAgainTheBookingsAndThePaymentsTheLinkOpens', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'b-1' } as ManualBooking);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateManualBooking(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(dto);
    });

    const roots = invalidate.mock.calls.map(([filters]) => (filters?.queryKey as string[] | undefined)?.[0]);
    expect(roots).toEqual(expect.arrayContaining([BOOKINGS_KEY, 'payments']));
  });

  it('useCreatePaymentLink_Made_LeavesTheLinkNowhereOnceTheResultIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.createPaymentLink).mockResolvedValue({ bookingId: 'b-1', paymentLinkUrl: LINK, emailSent: true } as BookingPaymentLink);
    const { result, unmount } = renderHook(() => useCreatePaymentLink(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('b-1');
    });
    expect(queryClient.getMutationCache().getAll()[0]?.state.data).toMatchObject({ paymentLinkUrl: LINK });

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useCreatePaymentLink_Refused_KeepsNoRequest', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.createPaymentLink).mockRejectedValue(refusal(422, { status: 422, code: 'payment_link_unavailable' }));
    const { result } = renderHook(() => useCreatePaymentLink(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('b-1')).rejects.toMatchObject({ response: { status: 422 } });
    });

    const kept = queryClient.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.config?.data).toBeUndefined();
  });
});

describe('«Retry» of the sync with the channel manager', () => {
  it('useRetryOctorateSync_WithoutOverwrite_AsksForThePushAgainAndReadsTheBookingAgain', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: 'b-1', state: 'Pending' });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRetryOctorateSync(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b-1' });
    });

    expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith('b-1', undefined);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [BOOKINGS_KEY, 'b-1'] });
  });

  it('useRetryOctorateSync_WithOverwrite_PassesTheChoiceOfTheHost', async () => {
    const { wrapper } = setup();
    vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: 'b-1', state: 'Pending' });
    const { result } = renderHook(() => useRetryOctorateSync(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'b-1', overwrite: true });
    });

    expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith('b-1', true);
  });

  it('useRetryOctorateSync_Refused409_ReadsTheBookingAgainAllTheSame', async () => {
    // Nothing to retry any more (the push went through meanwhile): the line must show what the server holds, not what it showed.
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.retryOctorateSync).mockRejectedValue(refusal(409, { status: 409, code: 'octorate_sync_not_retryable' }));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRetryOctorateSync(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({ response: { status: 409 } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: [BOOKINGS_KEY, 'b-1'] });
  });
});

describe('the Stripe account of the payment link', () => {
  it('usePaymentLinkAccountReady_NotAllowedToRead_AsksNothing', () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => usePaymentLinkAccountReady(false), { wrapper });

    expect(result.current).toBeNull();
    expect(ConnectApi.getStatus).not.toHaveBeenCalled();
  });

  it('usePaymentLinkAccountReady_AccountThatTakesCharges_IsReady_WithoutAskingStripe', async () => {
    const { wrapper } = setup();
    vi.mocked(ConnectApi.getStatus).mockResolvedValue({ connectedAccountId: 'acct_1', chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] });

    const { result } = renderHook(() => usePaymentLinkAccountReady(true), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
    // `refresh=false`: the state as CasaZen holds it, no call to Stripe on every opening of the wizard.
    expect(ConnectApi.getStatus).toHaveBeenCalledWith(false);
  });

  it.each([
    ['not connected', { connectedAccountId: null, chargesEnabled: false }],
    ['still being verified', { connectedAccountId: 'acct_1', chargesEnabled: false }],
  ])('usePaymentLinkAccountReady_%s_IsNotReady', async (_name, status) => {
    const { wrapper } = setup();
    vi.mocked(ConnectApi.getStatus).mockResolvedValue({ payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [], ...status });

    const { result } = renderHook(() => usePaymentLinkAccountReady(true), { wrapper });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('usePaymentLinkAccountReady_StatusThatCannotBeRead_IsNotKnown', async () => {
    const { wrapper } = setup();
    vi.mocked(ConnectApi.getStatus).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePaymentLinkAccountReady(true), { wrapper });

    await waitFor(() => expect(ConnectApi.getStatus).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

describe('the result of the wizard follows the channel manager without a reload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useBookingMirror_WhileTheAnswerIsStillToCome_ReadsTheBookingAgainEveryFewSeconds', async () => {
    const { wrapper } = setup();
    vi.mocked(bookingsApi.getById).mockResolvedValue({ id: 'b-1', octorateSync: { state: 'Pending' } } as Booking);

    const { rerender } = renderHook(
      ({ watching }) => useBookingMirror('b-1', { enabled: true, keepWatching: () => watching }),
      { wrapper, initialProps: { watching: true } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(bookingsApi.getById).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(bookingsApi.getById).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(bookingsApi.getById).toHaveBeenCalledTimes(3);

    // Settled (or the time is over): it stops asking.
    rerender({ watching: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(bookingsApi.getById).toHaveBeenCalledTimes(3);
  });

  it('useBookingMirror_NotAllowedToRead_AsksNothing', async () => {
    const { wrapper } = setup();

    renderHook(() => useBookingMirror('b-1', { enabled: false, keepWatching: () => true }), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(bookingsApi.getById).not.toHaveBeenCalled();
  });

  it('useBookingMirror_OpenedAgainWithTheMirrorInTheCache_ReadsItAgainBeforeSayingAnything', async () => {
    // The client does not read an unobserved query again by default (`refetchOnMount: false`): the state of the sync changes on the server meanwhile.
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(bookingMirrorKey('b-1'), { octorateSync: { state: 'Pending' } });
    vi.mocked(bookingsApi.getById).mockResolvedValue({ id: 'b-1', octorateSync: { state: 'Synced' } } as Booking);

    const { result } = renderHook(() => useBookingMirror('b-1', { enabled: true, keepWatching: () => false }), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(bookingsApi.getById).toHaveBeenCalledTimes(1);
    expect(result.current.data?.octorateSync?.state).toBe('Synced');
  });

  it('useBookingMirror_KeepsTheMirrorOnly_NotTheBookingWithItsGuestAndNotTheEntryOfTheBookingPage', async () => {
    // The booking holds the contact of the guest; the result needs the mirror. The page of the booking, which the host opens from the result, reads its own.
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.getById).mockResolvedValue({ id: 'b-1', guest: { email: GUEST_EMAIL }, octorateSync: { state: 'Synced' } } as Booking);

    renderHook(() => useBookingMirror('b-1', { enabled: true, keepWatching: () => false }), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const kept = queryClient.getQueryData(bookingMirrorKey('b-1'));
    expect(kept).toEqual({ octorateSync: { state: 'Synced' } });
    expect(JSON.stringify(kept)).not.toContain(GUEST_EMAIL);
    expect(queryClient.getQueryData([BOOKINGS_KEY, 'b-1'])).toBeUndefined();
  });

  it('useBookingMirror_BookingWithNoMirror_KeepsNullAndNotUndefined', async () => {
    // A query cannot keep `undefined`: "not mirrored" is a null the screen reads.
    const { queryClient, wrapper } = setup();
    vi.mocked(bookingsApi.getById).mockResolvedValue({ id: 'b-1' } as Booking);

    renderHook(() => useBookingMirror('b-1', { enabled: true, keepWatching: () => false }), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(queryClient.getQueryData(bookingMirrorKey('b-1'))).toEqual({ octorateSync: null });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { bookingMessagesApi } from '@/api/booking-messages.api';
import { useUnreadMessagesByBooking } from '../use-booking-messages';

vi.mock('@/api/booking-messages.api');

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

describe('useUnreadMessagesByBooking', () => {
  it('useUnreadMessagesByBooking_Items_BecomeAMapWithoutTheBookingsAtZero', async () => {
    vi.mocked(bookingMessagesApi.listUnread).mockResolvedValue({
      items: [
        { bookingId: 'b-1', unreadCount: 2 },
        { bookingId: 'b-2', unreadCount: 0 },
      ],
    });
    const { result } = renderHook(() => useUnreadMessagesByBooking(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get('b-1')).toBe(2);
    expect(result.current.data?.has('b-2')).toBe(false);
  });

  it('useUnreadMessagesByBooking_UnexpectedBody_IsAnEmptyMapNotAnError', async () => {
    vi.mocked(bookingMessagesApi.listUnread).mockResolvedValue('<html>' as unknown as { items: [] });
    const { result } = renderHook(() => useUnreadMessagesByBooking(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.size).toBe(0);
  });

  it('useUnreadMessagesByBooking_Disabled_AsksNothing', () => {
    vi.mocked(bookingMessagesApi.listUnread).mockClear();
    renderHook(() => useUnreadMessagesByBooking(false), { wrapper: wrapper() });
    expect(bookingMessagesApi.listUnread).not.toHaveBeenCalled();
  });
});

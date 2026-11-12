import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bookingMessagesApi } from '@/api/booking-messages.api';
import { messageHubApi } from '@/api/message-hub.api';
import type { HostThread, MessageHubPage } from '@/types';
import { useMarkThreadRead, useSendBookingMessage } from '../use-booking-messages';
import { useMessageHubThreads, useMessageHubUnread } from '../use-message-hub';

vi.mock('@/api/booking-messages.api', () => ({ bookingMessagesApi: { send: vi.fn(), markRead: vi.fn() } }));
vi.mock('@/api/message-hub.api', () => ({ messageHubApi: { list: vi.fn(), unread: vi.fn() } }));

const PAGE: MessageHubPage = { items: [], totalCount: 0, page: 1, pageSize: 20 };
const THREAD: HostThread = { state: 'Open', closesAt: null, unreadCount: 0, needsReply: false, messages: [] };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { wrapper };
}

// The Home («Rispondi a…») and the tab «Messaggi» read the conversations through the hub (NF-61); the tab Messaggi of a booking and its
// drawer (SR-12) write to the same conversation through the older endpoints. What they do must reach the hub at once, not at the next minute.
describe('an answer or a read given from the booking changes the hub too (NF-61, SR-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(messageHubApi.list).mockResolvedValue(PAGE);
    vi.mocked(messageHubApi.unread).mockResolvedValue({ items: [] });
    vi.mocked(bookingMessagesApi.send).mockResolvedValue({
      message: { id: 'm-1', sender: 'Host', text: 'Dalle 15.', createdAt: '2026-11-10T08:00:00Z' } as HostThread['messages'][number],
      redacted: false,
      replayed: false,
    });
    vi.mocked(bookingMessagesApi.markRead).mockResolvedValue(THREAD);
  });
  afterEach(() => cleanup());

  it('useSendBookingMessage_AnswerGivenFromTheBooking_ReadsTheListOfTheHubAndItsCountersAgainAtOnce', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ threads: useMessageHubThreads({ needsReply: true }), unread: useMessageHubUnread(), booking: useSendBookingMessage('b-1') }), { wrapper });
    await waitFor(() => expect(result.current.threads.isSuccess && result.current.unread.isSuccess).toBe(true));
    expect(messageHubApi.list).toHaveBeenCalledTimes(1);
    expect(messageHubApi.unread).toHaveBeenCalledTimes(1);

    act(() => result.current.booking.send('Dalle 15.'));

    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(messageHubApi.unread).toHaveBeenCalledTimes(2));
    expect(bookingMessagesApi.send).toHaveBeenCalledTimes(1);
  });

  it('useMarkThreadRead_ThreadReadFromTheBooking_ReadsTheListOfTheHubAndItsCountersAgainAtOnce', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ threads: useMessageHubThreads({}), unread: useMessageHubUnread(), read: useMarkThreadRead('b-1') }), { wrapper });
    await waitFor(() => expect(result.current.threads.isSuccess && result.current.unread.isSuccess).toBe(true));

    act(() => result.current.read.mutate());

    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(messageHubApi.unread).toHaveBeenCalledTimes(2));
  });
});

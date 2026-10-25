import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingMessagesApi, type HostThreadFilters } from '@/api/booking-messages.api';
import { retryTransientErrors } from '@/lib/query-client';
import { NOTIFICATIONS_QUERY } from '@/queries/use-notifications';
import { useThreadSend } from '@/queries/use-thread-send';
import type { HostThread } from '@/types';

export const BOOKING_THREAD_QUERY = 'booking-thread';
export const HOST_THREADS_QUERY = 'host-threads';
export const UNREAD_MESSAGES_QUERY = 'booking-messages-unread';

/** How often an open thread is read again while the page is visible (no real-time channel in v1). */
const THREAD_POLL_MS = 60_000;

/**
 * The thread of a booking for its host (SR-12): the messages, how many the host has not read and whether the guest waits for an answer.
 * A guest writes from outside, so it is read again when the page opens, on return to the window and every minute while it is visible.
 */
export function useBookingThread(bookingId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [BOOKING_THREAD_QUERY, bookingId],
    queryFn: () => bookingMessagesApi.getThread(bookingId),
    enabled: enabled && Boolean(bookingId),
    refetchInterval: THREAD_POLL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * The host's messages to the guest, with the optimistic row and the retry of {@link useThreadSend}. Once one is stored, the thread and the
 * lists that count what waits for an answer are read again (the answer marks the thread as read and takes it off «Da rispondere»).
 */
export function useSendBookingMessage(bookingId: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => [BOOKING_THREAD_QUERY, bookingId] as const, [bookingId]);
  const send = useCallback(
    async (text: string, idempotencyKey: string) => {
      const sent = await bookingMessagesApi.send(bookingId, text, idempotencyKey);
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
      return sent;
    },
    [bookingId, key, queryClient],
  );
  return useThreadSend<HostThread>(key, send);
}

/** Marks the guest's messages as read (up to the last one): the unread counters of the booking and of the lists drop. */
export function useMarkThreadRead(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingMessagesApi.markRead(bookingId),
    onSuccess: (thread) => {
      queryClient.setQueryData([BOOKING_THREAD_QUERY, bookingId], thread);
      void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
    },
  });
}

/** The threads of the host's properties (`needsReply: true` is the «Rispondi a un ospite» of the Home). Read again on every visit. */
export function useHostThreads(filters: HostThreadFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: [HOST_THREADS_QUERY, filters],
    queryFn: () => bookingMessagesApi.listThreads(filters),
    enabled,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/**
 * The unread guest messages of every booking, in one query for a whole page (the calendar, the lists): a map from booking id to
 * count, with only the bookings that have unread messages. The same data feeds every badge; a failure leaves no badge, never an error.
 * Kept fresh by the real-time channel (`notificationsChanged`), with the focus of the window as a safety net.
 */
export function useUnreadMessagesByBooking(enabled: boolean = true) {
  return useQuery({
    queryKey: [UNREAD_MESSAGES_QUERY],
    queryFn: () => bookingMessagesApi.listUnread(),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryTransientErrors(1),
    select: (data): ReadonlyMap<string, number> =>
      new Map((Array.isArray(data?.items) ? data.items : []).filter((row) => row.unreadCount > 0).map((row) => [row.bookingId, row.unreadCount])),
  });
}

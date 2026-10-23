import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { guestMessagesApi } from '@/api/guest-messages.api';
import { getHttpStatus } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import { useThreadSend } from '@/queries/use-thread-send';
import type { GuestSession, GuestThread } from '@/types';

const GUEST_THREAD_QUERY = 'guest-thread';

/** How often the thread is read again while the page is open and visible (no real-time channel in v1). */
const THREAD_POLL_MS = 60_000;

function threadKey(session: GuestSession) {
  return [GUEST_THREAD_QUERY, session.bookingCode, session.expiresAt] as const;
}

/**
 * The thread of the guest's booking (DB-14b). Read when the page opens, when the guest comes back to the window and every minute while
 * the page is visible (TanStack Query pauses the interval in a hidden tab and when the browser is offline). A 401 means the session ended:
 * the booking is read again, which finds it out and sends the guest back to the form. A 404 means the booking has no thread: the section
 * hides itself.
 */
export function useGuestThread(session: GuestSession) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: threadKey(session),
    queryFn: async () => {
      try {
        return await guestMessagesApi.getThread(session.accessToken, session.bookingCode);
      } catch (error) {
        if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
        throw error;
      }
    },
    refetchInterval: THREAD_POLL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: (failures, error) => ![401, 404, 429].includes(getHttpStatus(error) ?? 0) && failures < 2,
  });
}

/** The guest's messages, sent with the optimistic row and the retry of {@link useThreadSend}. */
export function useSendGuestMessage(session: GuestSession) {
  const key = useMemo(() => threadKey(session), [session]);
  const send = useCallback(
    (text: string, idempotencyKey: string) => guestMessagesApi.send(session.accessToken, session.bookingCode, text, idempotencyKey),
    [session.accessToken, session.bookingCode],
  );
  return useThreadSend<GuestThread>(key, send);
}

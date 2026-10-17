import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { guestMessagesApi } from '@/api/guest-messages.api';
import { getHttpStatus } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import type { GuestSession, GuestThread } from '@/types';

const GUEST_THREAD_QUERY = 'guest-thread';

/** How often the thread is read again while the page is open and visible (no real-time channel in v1). */
const THREAD_POLL_MS = 60_000;

/** A message written on this page that the server has not confirmed yet. `key` is its `Idempotency-Key`. */
export interface PendingGuestMessage {
  key: string;
  text: string;
  status: 'sending' | 'failed';
  error?: unknown;
}

/** One key per message (8 to 64 letters, digits, `-` or `_`): sending the same message again with it never writes it twice. */
function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

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

/**
 * Sends the guest's messages with an optimistic row: the message shows at once as «sending», becomes the stored one when the server
 * answers, or stays as «not sent» with a retry that sends it again with the same key (the server writes it once). Nothing is retried
 * by itself. `redacted` is true after the server replaced a card number or an IBAN, until the guest sends the next message.
 */
export function useSendGuestMessage(session: GuestSession) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingGuestMessage[]>([]);
  const [redacted, setRedacted] = useState(false);

  const attempt = useCallback(
    async (item: PendingGuestMessage) => {
      setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'sending', error: undefined } : p)));
      try {
        const sent = await guestMessagesApi.send(session.accessToken, session.bookingCode, item.text, item.key);
        queryClient.setQueryData<GuestThread>(threadKey(session), (thread) =>
          thread && !thread.messages.some((m) => m.id === sent.message.id)
            ? { ...thread, messages: [...thread.messages, sent.message] }
            : thread,
        );
        setRedacted(sent.redacted);
        setPending((all) => all.filter((p) => p.key !== item.key));
      } catch (error) {
        setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'failed', error } : p)));
        // A 409 says the thread closed meanwhile: read it again, so the composer gives way to the «closed» note.
        if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: threadKey(session) });
      }
    },
    [queryClient, session],
  );

  const send = useCallback(
    (text: string) => {
      const item: PendingGuestMessage = { key: newIdempotencyKey(), text, status: 'sending' };
      setPending((all) => [...all, item]);
      setRedacted(false);
      void attempt(item);
    },
    [attempt],
  );

  const retry = useCallback(
    (key: string) => {
      const item = pending.find((p) => p.key === key);
      if (item && item.status === 'failed') void attempt(item);
    },
    [attempt, pending],
  );

  return { pending, redacted, send, retry };
}

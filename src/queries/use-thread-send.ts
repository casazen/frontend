import { useCallback, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getHttpStatus } from '@/lib/api-errors';
import type { GuestThreadMessage, SentGuestMessage } from '@/types';

/** A message written on this page that the server has not confirmed yet. `key` is its `Idempotency-Key`. */
export interface PendingThreadMessage {
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

/** Adds the message the server just stored to the thread in the cache, unless the next reading already brought it. */
function withMessage<T extends { messages: GuestThreadMessage[] }>(thread: T | undefined, message: GuestThreadMessage): T | undefined {
  return thread && !thread.messages.some((m) => m.id === message.id) ? { ...thread, messages: [...thread.messages, message] } : thread;
}

/**
 * The optimistic send of a conversation (DB-14b for the guest, SR-12 for the host): the message shows at once as «sending», becomes the
 * stored one when the server answers, or stays as «not sent» with a retry that sends it again with the same key (the server writes it
 * once). Nothing is retried by itself. `redacted` is true after the server replaced a card number or an IBAN, until the next send.
 *
 * `threadKey` is the cache entry of the thread the message is added to; a 409 (the thread closed meanwhile) reads it again, so the
 * composer gives way to the «closed» note. The text of a message is held in memory only, for as long as the page is open.
 */
export function useThreadSend<T extends { messages: GuestThreadMessage[] }>(
  threadKey: QueryKey,
  send: (text: string, idempotencyKey: string) => Promise<SentGuestMessage>,
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingThreadMessage[]>([]);
  const [redacted, setRedacted] = useState(false);

  const attempt = useCallback(
    async (item: PendingThreadMessage) => {
      setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'sending', error: undefined } : p)));
      try {
        const sent = await send(item.text, item.key);
        queryClient.setQueryData<T>(threadKey, (thread) => withMessage(thread, sent.message));
        setRedacted(sent.redacted);
        setPending((all) => all.filter((p) => p.key !== item.key));
      } catch (error) {
        setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'failed', error } : p)));
        if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: threadKey });
      }
    },
    [queryClient, send, threadKey],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const item: PendingThreadMessage = { key: newIdempotencyKey(), text, status: 'sending' };
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

  return { pending, redacted, send: sendMessage, retry };
}

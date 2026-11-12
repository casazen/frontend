import { useCallback, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getHttpStatus } from '@/lib/api-errors';
import type { GuestThreadMessage } from '@/types';

/** A message written on this page that the server has not confirmed yet. `key` is its `Idempotency-Key`. */
export interface PendingThreadMessage {
  key: string;
  text: string;
  status: 'sending' | 'failed';
  error?: unknown;
}

/**
 * What a send answers: the message the server stored, whether a card number or an IBAN of the text was replaced (`redacted`, the direct
 * threads) and whether the same `Idempotency-Key` had already written it (`replayed`). The thread of the guest and the hub of the messages
 * (NF-61) each have their own shape of message: `M` is it.
 */
export interface SentThreadMessage<M extends { id: string } = GuestThreadMessage> {
  message: M;
  redacted: boolean;
  replayed: boolean;
}

/** One key per message (8 to 64 letters, digits, `-` or `_`): sending the same message again with it never writes it twice. */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Adds the message the server just stored to the thread in the cache, unless the next reading already brought it. */
function withMessage<M extends { id: string }, T extends { messages: M[] }>(thread: T | undefined, message: M): T | undefined {
  return thread && !thread.messages.some((m) => m.id === message.id) ? { ...thread, messages: [...thread.messages, message] } : thread;
}

/**
 * The optimistic send of a conversation (DB-14b for the guest, SR-12 for the host, NF-63 for the hub): the message shows at once as
 * «sending», becomes the stored one when the server answers, or stays as «not sent» with a retry that sends it again with the same key
 * (the server writes it once). Nothing is retried by itself. `redacted` is true after the server replaced a card number or an IBAN,
 * until the next send. A message that stays «not sent» can be dropped (`discard`), for the one the server refused and that the person
 * edits instead of sending again.
 *
 * `threadKey` is the cache entry of the thread the message is added to; a 409 (the thread closed meanwhile) reads it again, so the
 * composer gives way to the «closed» note. The text of a message is held in memory only, for as long as the page is open.
 */
export function useThreadSend<T extends { messages: M[] }, M extends { id: string } = GuestThreadMessage>(
  threadKey: QueryKey,
  send: (text: string, idempotencyKey: string) => Promise<SentThreadMessage<M>>,
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingThreadMessage[]>([]);
  const [redacted, setRedacted] = useState(false);

  const attempt = useCallback(
    async (item: PendingThreadMessage) => {
      setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'sending', error: undefined } : p)));
      try {
        const sent = await send(item.text, item.key);
        queryClient.setQueryData<T>(threadKey, (thread) => withMessage<M, T>(thread, sent.message));
        setRedacted(sent.redacted);
        setPending((all) => all.filter((p) => p.key !== item.key));
      } catch (error) {
        setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'failed', error } : p)));
        if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: threadKey });
      }
    },
    [queryClient, send, threadKey],
  );

  // `idempotencyKey` is for a caller that offers again something an earlier attempt may already have stored (a message the channel
  // refused, from a page that is opened again later): it gives the key of that message, so that the server answers `replayed` with the
  // stored one instead of writing it a second time. Without it every message gets a key of its own.
  const sendMessage = useCallback(
    (text: string, idempotencyKey?: string) => {
      const item: PendingThreadMessage = { key: idempotencyKey ?? newIdempotencyKey(), text, status: 'sending' };
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

  const discard = useCallback((key: string) => setPending((all) => all.filter((p) => p.key !== key || p.status !== 'failed')), []);

  return { pending, redacted, send: sendMessage, retry, discard };
}

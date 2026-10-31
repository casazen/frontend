import { useCallback, useState } from 'react';
import { publicBookingApi } from '@/api/public-supplier-booking.api';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';
import type { QuietCall } from './types';

/** A message written on this page that the server has not confirmed yet. */
export interface PendingMessage {
  key: string;
  text: string;
  status: 'sending' | 'failed';
  failure?: RequestFailure;
}

let pendingCounter = 0;

/**
 * The customer's messages with the optimistic row and the retry of every conversation of CasaZen (the host's, the guest's, the supplier's):
 * the message shows at once as «sending», becomes the stored one when the server answers (the answer is the request with its thread, which
 * the page then shows), or stays as «not sent» with a retry. Nothing is retried by itself. The text is held in memory only, for as long as
 * the page is open. A failed message that cannot be sent again (the conversation is closed, it is full, the text is not valid) stays on the
 * screen with the reason, so nothing the person wrote is lost silently.
 */
export function useInquiryMessages(quiet: QuietCall) {
  const [pending, setPending] = useState<PendingMessage[]>([]);

  const attempt = useCallback(
    async (item: PendingMessage) => {
      setPending((all) => all.map((one) => (one.key === item.key ? { ...one, status: 'sending', failure: undefined } : one)));
      const outcome = await quiet((access) => publicBookingApi.sendMessage(access, item.text));
      setPending((all) => (outcome.ok ? all.filter((one) => one.key !== item.key) : all.map((one) => (one.key === item.key ? { ...one, status: 'failed', failure: outcome.failure } : one))));
    },
    [quiet],
  );

  const send = useCallback(
    (text: string) => {
      pendingCounter += 1;
      const item: PendingMessage = { key: `inquiry-message-${pendingCounter}`, text, status: 'sending' };
      setPending((all) => [...all, item]);
      void attempt(item);
    },
    [attempt],
  );

  const retry = useCallback(
    (key: string) => {
      const item = pending.find((one) => one.key === key);
      if (item && item.status === 'failed') void attempt(item);
    },
    [attempt, pending],
  );

  return { pending, send, retry };
}

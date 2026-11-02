import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import {
  fetchSupplierDispute,
  fetchSupplierRequestThread,
  postSupplierRequestMessage,
  replySupplierDispute,
  sendSupplierOffer,
  withdrawSupplierOffer,
} from '@/api/supplier-inquiry.api';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { SendSupplierOfferBody, SupplierOfferResponse, SupplierRequestMessage, SupplierRequestThread, SupplierServiceDispute } from '@/types/supplier-inquiry';

/** How often a thread that is on screen is read again, and the most it waits when nothing has been happening (30 s, 60 s, then 2 minutes). */
const POLL_MS = 30_000;
const POLL_MAX_MS = 120_000;

/** Under `['supplier', 'inbox']`: every action of the supplier on the request (a take, a refusal, an offer) reads the thread again. */
const threadKey = (id: string | undefined) => ['supplier', 'inbox', 'thread', id] as const;
const disputeKey = (id: string | undefined) => ['supplier', 'dispute', id] as const;

/** What a step of the supplier on a request on measure reads again: the thread, the request and its lists, the numbers, the home. */
function refreshInquiry(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
  void queryClient.invalidateQueries({ queryKey: ['supplier', 'dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['service-requests'] });
}

/**
 * The conversation of a request on measure (SP-10b), its offer and the time left to answer. With `poll` it is read again every 30 seconds
 * while the page is visible (a hidden tab asks nothing), and less often while nothing changes: the seconds double twice, up to two minutes,
 * and start again when something does. It is read again when the page opens. Reading marks the customer's messages as read, which is why
 * only the page of the request asks for it, and not the drawer of the list.
 */
export function useSupplierRequestThread(id: string | undefined, options: { poll?: boolean } = {}) {
  const unchanged = useRef(0);
  const lastSeen = useRef<string | null>(null);
  return useQuery({
    queryKey: threadKey(id),
    enabled: !!id,
    queryFn: async () => {
      const thread = await fetchSupplierRequestThread(id!);
      const seen = `${thread.messages.length}|${thread.negotiation}|${thread.offer?.sentAt ?? ''}|${thread.status}`;
      unchanged.current = seen === lastSeen.current ? unchanged.current + 1 : 0;
      lastSeen.current = seen;
      return thread;
    },
    refetchOnMount: 'always',
    refetchInterval: options.poll ? () => Math.min(POLL_MS * 2 ** Math.min(unchanged.current, 2), POLL_MAX_MS) : false,
  });
}

/** Adds the message the server just stored to the thread in the cache, unless the next reading already brought it. */
function withMessage(thread: SupplierRequestThread | undefined, message: SupplierRequestMessage): SupplierRequestThread | undefined {
  return thread && !thread.messages.some((existing) => existing.id === message.id)
    ? // The first answer of the supplier stops its hour: the thread says so from now on.
      { ...thread, messages: [...thread.messages, message], respondBy: null }
    : thread;
}

/** A message of the supplier. The hook does not toast: the conversation shows the message as «not sent» with its own retry. */
export function useSendSupplierMessage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postSupplierRequestMessage(id, body),
    onSuccess: (message) => {
      queryClient.setQueryData<SupplierRequestThread>(threadKey(id), (thread) => withMessage(thread, message));
      // Its first message stops the clock of the hour: the lists and the numbers read it again.
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox', 'counts'] });
    },
    onError: (error) => {
      // The conversation closed meanwhile (the customer cancelled, the request was refused): the composer gives way to the note.
      if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: threadKey(id) });
    },
  });
}

/** What the thread and the request say after the supplier sent or took back an offer: the answer of the server, without another request. */
function keepOffer(queryClient: QueryClient, id: string, answer: SupplierOfferResponse) {
  queryClient.setQueryData<SupplierRequestThread>(threadKey(id), (thread) =>
    thread ? { ...thread, negotiation: answer.negotiation, offer: answer.offer ?? null, respondBy: null } : thread,
  );
  refreshInquiry(queryClient);
}

/**
 * The supplier answers a request on measure with an offer, or replaces the one that waits (SP-10b-b). The error is the caller's to show where
 * the supplier is looking (the sheet stays open and says why: a time the agenda cannot do, an offer outside the limits); a request that changed
 * meanwhile is read again.
 */
export function useSendSupplierOffer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SendSupplierOfferBody) => sendSupplierOffer(id, body),
    onSuccess: (answer) => {
      keepOffer(queryClient, id, answer);
      toast.success(i18n.t('supplier.inquiry.offer.sentToast'));
    },
    onError: (error) => {
      if (getHttpStatus(error) === 409 && getProblemCode(isAxiosError(error) ? error.response?.data : undefined) === 'service_request_state_changed') refreshInquiry(queryClient);
    },
  });
}

/** The supplier takes its offer back: the request stays new and the conversation goes on (the customer is not told by e-mail). */
export function useWithdrawSupplierOffer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => withdrawSupplierOffer(id),
    onSuccess: (answer) => {
      keepOffer(queryClient, id, answer);
      toast.success(i18n.t('supplier.inquiry.offer.withdrawnToast'));
    },
    onError: (error) => {
      // The offer may be gone already (the customer answered, it lapsed): the page shows what it is now.
      refreshInquiry(queryClient);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.inquiry.offer.failed'));
    },
  });
}

/**
 * The complaint against the supplier about this job, or `null` when there is none (the server answers 404 `service_dispute_not_found`, which is
 * an answer and not a failure). Asked only for a job that can have one (`enabled`): paid inside CasaZen, and taken.
 */
export function useSupplierDispute(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: disputeKey(id),
    enabled: enabled && !!id,
    queryFn: async (): Promise<SupplierServiceDispute | null> => {
      try {
        return await fetchSupplierDispute(id!);
      } catch (error) {
        if (getHttpStatus(error) === 404 && getProblemCode(isAxiosError(error) ? error.response?.data : undefined) === 'service_dispute_not_found') return null;
        throw error;
      }
    },
    refetchOnMount: true,
  });
}

/** The supplier's one reply to the complaint (SP-15c-c). A complaint decided meanwhile is read again. */
export function useReplySupplierDispute(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => replySupplierDispute(id, text),
    onSuccess: (dispute) => {
      queryClient.setQueryData<SupplierServiceDispute | null>(disputeKey(id), dispute);
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      toast.success(i18n.t('supplier.dispute.repliedToast'));
    },
    onError: (error) => {
      if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: disputeKey(id) });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.dispute.replyFailed'));
    },
  });
}

/** A message written on this page that the server has not confirmed yet. */
export interface PendingInquiryMessage {
  key: string;
  text: string;
  status: 'sending' | 'failed';
  error?: unknown;
}

let pendingCounter = 0;

/**
 * The supplier's messages with the optimistic row and the retry of the conversations of the console (the same as the host's and the guest's:
 * the message shows at once as «sending», becomes the stored one when the server answers, or stays as «not sent» with a retry). Nothing is
 * retried by itself. The text of a message is held in memory only, for as long as the page is open.
 */
export function useInquiryMessageSend(id: string) {
  const { mutateAsync } = useSendSupplierMessage(id);
  const [pending, setPending] = useState<PendingInquiryMessage[]>([]);

  const attempt = useCallback(
    async (item: PendingInquiryMessage) => {
      setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'sending', error: undefined } : p)));
      try {
        await mutateAsync(item.text);
        setPending((all) => all.filter((p) => p.key !== item.key));
      } catch (error) {
        setPending((all) => all.map((p) => (p.key === item.key ? { ...p, status: 'failed', error } : p)));
      }
    },
    [mutateAsync],
  );

  const send = useCallback(
    (text: string) => {
      pendingCounter += 1;
      const item: PendingInquiryMessage = { key: `inquiry-message-${pendingCounter}`, text, status: 'sending' };
      setPending((all) => [...all, item]);
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

  return { pending, send, retry };
}

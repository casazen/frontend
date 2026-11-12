import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageHubApi } from '@/api/message-hub.api';
import { retryTransientErrors } from '@/lib/query-client';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { MESSAGE_HUB_POLL_MS, MESSAGE_HUB_QUERY, invalidateMessageHubLists, useRefetchOnNotificationsChange } from '@/queries/use-message-hub';
import { NOTIFICATIONS_QUERY } from '@/queries/use-notifications';
import { newIdempotencyKey, useThreadSend, type SentThreadMessage } from '@/queries/use-thread-send';
import type {
  MessageHubMessage,
  MessageHubReply,
  MessageHubThreadDetail,
  MessageTranslationRequest,
} from '@/types';

/** The cache entry of one conversation. */
const threadKeyOf = (threadKey: string) => [MESSAGE_HUB_QUERY, 'thread', threadKey] as const;

/**
 * One conversation of the hub (`GET /api/messages/threads/{threadKey}`, NF-61): the messages, the booking card, the customer link and
 * what the channel allows. A guest writes from outside, so it is read again when the page opens, on return to the window, every minute
 * while it is visible, and when the in-app notifications change.
 */
export function useMessageThread(threadKey: string, enabled: boolean = true) {
  useRefetchOnNotificationsChange(enabled);
  return useQuery({
    queryKey: threadKeyOf(threadKey),
    queryFn: () => messageHubApi.getThread(threadKey),
    enabled: enabled && Boolean(threadKey),
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * Marks the guest's messages of the conversation as read (`POST …/read`, called when it opens): the unread counter of the thread, of the
 * lists, of the menu and of the bell drop. A direct conversation also clears the caller's notifications of it, so those are read again.
 */
export function useMarkHubThreadRead(threadKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => messageHubApi.markRead(threadKey),
    onSuccess: (read) => {
      queryClient.setQueryData<MessageHubThreadDetail>(threadKeyOf(threadKey), (thread) => (thread ? { ...thread, unreadCount: read.unreadCount } : thread));
      invalidateMessageHubLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
    },
  });
}

/** The message a reply answers with when it carries none (it always does for a conversation): what the host wrote, with the state the answer gives. */
function provisionalMessage(text: string, answer: MessageHubReply, idempotencyKey: string): MessageHubMessage {
  return { id: `reply-${idempotencyKey}`, direction: 'Outbound', origin: 'Person', text, sentAt: new Date().toISOString(), deliveryState: answer.state };
}

/**
 * The host's answer to a conversation of the hub (`POST …/reply`, NF-63), with the optimistic row and the retry of {@link useThreadSend}:
 * one `Idempotency-Key` is made for each message and kept for its retries, so a second click or a retry never sends it twice, and a
 * message that is already stored answers `replayed` and sends nothing. Once one is stored the conversation, the lists that count what
 * waits for an answer and the counters are read again (an answer marks the guest's messages as read).
 */
export function useSendHubReply(threadKey: string) {
  const queryClient = useQueryClient();
  const key = useMemo(() => threadKeyOf(threadKey), [threadKey]);
  const send = useCallback(
    async (text: string, idempotencyKey: string): Promise<SentThreadMessage<MessageHubMessage>> => {
      const answer = await messageHubApi.reply(threadKey, text, idempotencyKey);
      invalidateMessageHubLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
      return { message: answer.message ?? provisionalMessage(text, answer, idempotencyKey), redacted: false, replayed: answer.replayed };
    },
    [queryClient, threadKey],
  );
  return useThreadSend<MessageHubThreadDetail, MessageHubMessage>(key, send);
}

/**
 * How the guest of a booking can be written to now (`GET /api/bookings/{id}/contact-options`, NF-63). Read when asked for: the answer
 * says whether an e-mail or a number exist, never the address or the number.
 */
export function useContactOptions(bookingId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'contact-options', bookingId],
    queryFn: () => messageHubApi.getContactOptions(bookingId as string),
    enabled: enabled && Boolean(bookingId),
    refetchOnMount: 'always',
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * The first message to the guest of a booking (`POST /api/bookings/{id}/messages/new`): through the channel the contact options name.
 * The `Idempotency-Key` is made once for a text and kept while it is not stored, so a second click or a retry after a lost answer never
 * sends it twice; a different text is a different message with a key of its own.
 */
export function useStartConversation(bookingId: string) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<{ text: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: ({ text, key }: { text: string; key: string }) => messageHubApi.startConversation(bookingId, text, key),
    onSuccess: () => {
      setAttempt(null);
      void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY] });
      void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
    },
  });
  const { mutate } = mutation;
  const send = useCallback(
    (text: string) => {
      const key = attempt?.text === text ? attempt.key : newIdempotencyKey();
      setAttempt({ text, key });
      mutate({ text, key });
    },
    [attempt, mutate],
  );
  return { ...mutation, send };
}

/** The templates of the organization the composer offers (`GET /api/message-templates?activeOnly=true`). Read when the picker opens. */
export function useMessageTemplates(enabled: boolean) {
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'templates'],
    queryFn: () => messageHubApi.listTemplates(),
    enabled,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/** The templates the channel keeps for a conversation, read only (`GET …/channel-templates`). Read when the picker opens. */
export function useChannelTemplates(threadKey: string, enabled: boolean) {
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'channel-templates', threadKey],
    queryFn: () => messageHubApi.listChannelTemplates(threadKey),
    enabled: enabled && Boolean(threadKey),
    retry: false,
  });
}

/** The text of a template for the conversation, with its variables filled in by the server (`POST …/render`): nothing is stored or sent. */
export function useRenderTemplate(threadKey: string) {
  return useMutation({ mutationFn: (templateId: string) => messageHubApi.renderTemplate(templateId, threadKey) });
}

/** A translation for the screen only (`POST /api/messages/translate`): it is never stored, the message keeps its original text. */
export function useTranslateMessage() {
  return useMutation({ mutationFn: (request: MessageTranslationRequest) => messageHubApi.translate(request) });
}

/** A file that is not a picture, read through the API when the host asks to download it. */
export function useDownloadAttachment() {
  return useMutation({ mutationFn: (messageId: string) => messageHubApi.openAttachment(messageId) });
}

/** The file of a message, read through the API (`GET /api/messages/{id}/attachment`) when it is asked for. */
export function useMessageAttachment(messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'attachment', messageId],
    queryFn: () => messageHubApi.openAttachment(messageId),
    enabled,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });
}

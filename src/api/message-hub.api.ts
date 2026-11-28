import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import { ApiClient } from './client';
import type {
  ChannelMessageTemplate,
  HostMessageTemplate,
  MessageChannelStatus,
  MessageContactOptions,
  MessageHubFilters,
  MessageHubPage,
  MessageHubRead,
  MessageHubReply,
  MessageHubThreadDetail,
  MessageHubUnread,
  MessageTranslation,
  MessageTranslationRequest,
  RenderedMessageTemplate,
} from '@/types';

function threadPath(threadKey: string): string {
  return `/messages/threads/${encodeURIComponent(threadKey)}`;
}

function bookingPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

function idempotent(idempotencyKey: string) {
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

/**
 * The host's hub of messages (E05/F02, NF-61, NF-63, NF-64): the conversations of the channels and the direct ones, in one list and one
 * thread model. `booking.read` to read, `booking.write` to answer and to mark as read; what a caller sees follows its reach on the
 * properties, so a collaborator «Solo alcuni» lists and opens the conversations of its own properties only. The words of a message
 * are the guest's personal data: they go in the body, never in an address, and the answers are kept nowhere but in the memory of the page.
 */
export const messageHubApi = {
  list: (filters: MessageHubFilters = {}) => ApiClient.get<MessageHubPage>('/messages', { ...filters, includeOta: true }),

  unread: () => ApiClient.get<MessageHubUnread>('/messages/unread', { includeOta: true }),

  /**
   * `GET /api/messages/channel-status`: the sync state of each listing in scope, `available`, `pending_sync`, `waiting_permission` or `error`.
   * It reads stored results without contacting Octorate; the inbox uses them to show why a
   * listing has no conversation instead of showing an empty list.
   */
  getChannelStatus: () => ApiClient.get<MessageChannelStatus>('/messages/channel-status'),

  getThread: (threadKey: string) => ApiClient.get<MessageHubThreadDetail>(threadPath(threadKey)),

  markRead: (threadKey: string) => ApiClient.post<MessageHubRead>(`${threadPath(threadKey)}/read`),

  /**
   * `POST /api/messages/threads/{threadKey}/reply`: the host's answer, one `Idempotency-Key` per message. 200 (or 202 when the outcome is
   * not known) `{ message, state, replayed }`; 409 `thread_closed` or `mapping_not_confirmed`; 422 `message_text_invalid` or
   * `channel_rule_violation`; 429 `rate_limited`.
   */
  reply: (threadKey: string, text: string, idempotencyKey: string) =>
    ApiClient.post<MessageHubReply>(`${threadPath(threadKey)}/reply`, { text }, idempotent(idempotencyKey)),

  getContactOptions: (bookingId: string, signal?: AbortSignal) => ApiClient.get<MessageContactOptions>(`${bookingPath(bookingId)}/contact-options`, undefined, { signal }),

  startConversation: (bookingId: string, text: string, idempotencyKey: string) =>
    ApiClient.post<MessageHubReply>(`${bookingPath(bookingId)}/messages/new`, { text }, idempotent(idempotencyKey)),

  listTemplates: (signal?: AbortSignal) => ApiClient.get<HostMessageTemplate[]>('/message-templates', { activeOnly: true }, { signal }),

  renderTemplate: (templateId: string, threadKey: string, signal?: AbortSignal) =>
    ApiClient.post<RenderedMessageTemplate>(`/message-templates/${encodeURIComponent(templateId)}/render`, { threadKey }, { signal }),

  listChannelTemplates: (threadKey: string) => ApiClient.get<ChannelMessageTemplate[]>(`${threadPath(threadKey)}/channel-templates`),

  translate: (request: MessageTranslationRequest) => ApiClient.post<MessageTranslation>('/messages/translate', request),

  /**
   * `GET /api/messages/{messageId}/attachment`: the file of a message, through the API and nowhere else (the address of the channel never
   * reaches the browser). It needs the token of the user, so it is read as a file and not put in an `<img src>`. 404 `attachment_unavailable`
   * when the file is gone.
   */
  openAttachment: async (messageId: string): Promise<Blob> => {
    try {
      return (await axios.get<Blob>(`/messages/${encodeURIComponent(messageId)}/attachment`, { responseType: 'blob' })).data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};

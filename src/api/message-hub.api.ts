import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import { ApiClient } from './client';
import type {
  ChannelMessageTemplate,
  HostMessageTemplate,
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

/** The path of one conversation: its key goes escaped (`ota:…` is `ota%3A…`). */
function threadPath(threadKey: string): string {
  return `/messages/threads/${encodeURIComponent(threadKey)}`;
}

function bookingPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

/** The one key of a message: sending the same message again with it never writes it twice. */
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
  /**
   * `GET /api/messages?includeOta=true`: one page of the conversations, the latest message first. The same address without `includeOta`
   * answers the direct threads only (the Home and the calendar badges of the bookings read that one: it is not changed).
   */
  list: (filters: MessageHubFilters = {}) => ApiClient.get<MessageHubPage>('/messages', { ...filters, includeOta: true }),

  /** `GET /api/messages/unread?includeOta=true`: the conversations with messages of the guest not read yet, counters only (at most 200 of each source). */
  unread: () => ApiClient.get<MessageHubUnread>('/messages/unread', { includeOta: true }),

  /** `GET /api/messages/threads/{threadKey}`: the latest messages oldest first, the booking card, the customer link and what the channel allows. 404 `thread_not_found`. */
  getThread: (threadKey: string) => ApiClient.get<MessageHubThreadDetail>(threadPath(threadKey)),

  /** `POST /api/messages/threads/{threadKey}/read`: marks the guest's messages as read, called when the conversation opens. */
  markRead: (threadKey: string) => ApiClient.post<MessageHubRead>(`${threadPath(threadKey)}/read`),

  /**
   * `POST /api/messages/threads/{threadKey}/reply`: the host's answer, one `Idempotency-Key` per message. 200 (or 202 when the outcome is
   * not known) `{ message, state, replayed }`; 409 `thread_closed` or `mapping_not_confirmed`; 422 `message_text_invalid` or
   * `channel_rule_violation`; 429 `rate_limited`.
   */
  reply: (threadKey: string, text: string, idempotencyKey: string) =>
    ApiClient.post<MessageHubReply>(`${threadPath(threadKey)}/reply`, { text }, idempotent(idempotencyKey)),

  /** `GET /api/bookings/{id}/contact-options`: through which channel the guest of the booking is reached now; never an address or a number. */
  getContactOptions: (bookingId: string) => ApiClient.get<MessageContactOptions>(`${bookingPath(bookingId)}/contact-options`),

  /**
   * `POST /api/bookings/{id}/messages/new`: the first message to the guest of a booking, through the channel the contact options name.
   * 409 `contact_info_unavailable` when only an e-mail exists and the channel does not release it.
   */
  startConversation: (bookingId: string, text: string, idempotencyKey: string) =>
    ApiClient.post<MessageHubReply>(`${bookingPath(bookingId)}/messages/new`, { text }, idempotent(idempotencyKey)),

  /** `GET /api/message-templates?activeOnly=true`: the templates of the organization the composer offers. */
  listTemplates: () => ApiClient.get<HostMessageTemplate[]>('/message-templates', { activeOnly: true }),

  /** `POST /api/message-templates/{id}/render`: the text of a template for a conversation. 422 `template_variable_missing` names the variable that has no value. */
  renderTemplate: (templateId: string, threadKey: string) =>
    ApiClient.post<RenderedMessageTemplate>(`/message-templates/${encodeURIComponent(templateId)}/render`, { threadKey }),

  /** `GET /api/messages/threads/{threadKey}/channel-templates`: the templates the channel keeps for the conversation, read only. */
  listChannelTemplates: (threadKey: string) => ApiClient.get<ChannelMessageTemplate[]>(`${threadPath(threadKey)}/channel-templates`),

  /** `POST /api/messages/translate`: a message of the conversation or the draft, in another language, for the screen only. 422 `translation_unavailable`. */
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

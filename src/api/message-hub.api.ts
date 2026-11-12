import { ApiClient } from './client';
import type { MessageHubFilters, MessageHubPage, MessageHubUnread } from '@/types';

/**
 * The host's hub of messages (E05/F02, NF-61): the conversations of the channels and the direct ones, in one list. `booking.read` to
 * read; what a caller sees follows its reach on the properties, so a collaborator «Solo alcuni» lists the conversations of its own
 * properties only. The words of a message are the guest's personal data: they never go in an address, and the answers are kept nowhere
 * but in the memory of the page.
 */
export const messageHubApi = {
  /**
   * `GET /api/messages?includeOta=true`: one page of the conversations, the latest message first. The same address without `includeOta`
   * answers the direct threads only (the Home and the calendar badges of the bookings read that one: it is not changed).
   */
  list: (filters: MessageHubFilters = {}) => ApiClient.get<MessageHubPage>('/messages', { ...filters, includeOta: true }),

  /** `GET /api/messages/unread?includeOta=true`: the conversations with messages of the guest not read yet, counters only (at most 200 of each source). */
  unread: () => ApiClient.get<MessageHubUnread>('/messages/unread', { includeOta: true }),
};

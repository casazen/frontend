import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ScheduledMessage } from '@/types';
import { ApiClient } from './client';

/**
 * The scheduled messages of a booking, host side (E05/F07/US02, NF-71, MSG-11). Behind the backend flag `ScheduledMessages`: while it is off every call is a 404. Reading asks `booking.read`
 * and changing asks `booking.write`, both on the property of the booking and within the reach of the caller; a message of another organization or out of the reach is a 404, like a missing one.
 * The answers are private (`Cache-Control: no-store`): they carry the words of messages written for a guest, and never a link of the check-in nor an access code (a preview issues none).
 */
export const scheduledMessagesApi = {
  /**
   * `GET /api/bookings/{id}/scheduled-messages`: the messages of the booking in time order, each with its state, the reason it is held back or ended, the channel it will use and the
   * text as it will read, and with `canEdit`, `canSkip` and `canSendNow` for what the host may do with it. 404 for a booking out of the reach.
   *
   * It is a read of a section of a page, so a refusal (403) stays on the section instead of sending the whole app to the page of no access (`localAuthRecovery`); an answer that is not
   * a list is a failed read, never an empty list.
   */
  list: async (bookingId: string): Promise<ScheduledMessage[]> => {
    const url = `/bookings/${encodeURIComponent(bookingId)}/scheduled-messages`;
    const messages = await ApiClient.get<unknown>(url, undefined, { localAuthRecovery: true });
    if (!Array.isArray(messages)) throw new UnexpectedApiResponseError(url);
    return messages as ScheduledMessage[];
  },

  edit: (id: string, text: string | null) => ApiClient.put<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}`, { text }),

  skip: (id: string) => ApiClient.post<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}/skip`),

  sendNow: (id: string) => ApiClient.post<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}/send-now`),
};

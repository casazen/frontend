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

  /**
   * `PUT /api/scheduled-messages/{id}`: the text of this message for this booking only, or an empty text to go back to the template of the routine. 404 for a message out of the reach;
   * 409 `scheduled_message_not_editable` (it was sent, skipped, cancelled or expired), `scheduled_message_in_progress` (a send holds it) or `scheduled_message_changed` (somebody else
   * changed it meanwhile); 422 `message_text_invalid` or `template_variable_unknown`.
   */
  edit: (id: string, text: string | null) => ApiClient.put<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}`, { text }),

  /**
   * `POST /api/scheduled-messages/{id}/skip`: the message will not be sent, and the other people who reach the property are told. 409 `scheduled_message_not_editable` for one that already ended,
   * `scheduled_message_in_progress` for one a send holds.
   */
  skip: (id: string) => ApiClient.post<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}/skip`),

  /**
   * `POST /api/scheduled-messages/{id}/send-now`: sends it at once, whatever its planned time. 409 `scheduled_message_not_sendable` for one that ended, `scheduled_message_in_progress` while
   * another actor sends it; 422 `scheduled_message_blocked` with `missing` (the codes of what it still waits for) for one that is still blocked; 429 when the host sends too many.
   */
  sendNow: (id: string) => ApiClient.post<ScheduledMessage>(`/scheduled-messages/${encodeURIComponent(id)}/send-now`),
};

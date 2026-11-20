import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { missingCodesOfProblem, missingItemOf } from './scheduled-messages';

/**
 * The words for a failed call on a scheduled message (edit, skip, send now), by the status and the stable code of the answer (E05/F07/US01, NF-71):
 * - 404: the message is not there, or is out of the reach of the caller; a 404 is always said as one, whatever the screen still holds of the message;
 * - 409 `scheduled_message_in_progress`: a send holds the row at this moment, so it is not changed (try again shortly); `scheduled_message_not_editable` and `scheduled_message_not_sendable`: it
 *   already ended; `scheduled_message_changed`: somebody else changed it while it was being changed;
 * - 422 `scheduled_message_blocked` with `missing`: what the message still waits for, in the words of the timeline; `message_text_invalid` and `template_variable_unknown`: the text.
 * Anything else is the same as every other call (`getProblemMessage`: the text of the code, the session, the permission, the limit), else a generic sentence.
 */
export function describeScheduledMessageError(error: unknown, t: TFunction): string {
  const status = getHttpStatus(error);
  const data = isAxiosError(error) ? error.response?.data : undefined;
  const code = getProblemCode(data);

  if (status === 404) return t('booking.scheduledMessages.errors.notFound');

  if (status === 409) {
    if (code === 'scheduled_message_in_progress') return t('booking.scheduledMessages.errors.inProgress');
    if (code === 'scheduled_message_not_editable') return t('booking.scheduledMessages.errors.notEditable');
    if (code === 'scheduled_message_not_sendable') return t('booking.scheduledMessages.errors.notSendable');
    if (code === 'scheduled_message_changed') return t('booking.scheduledMessages.errors.changed');
  }

  if (status === 422) {
    if (code === 'scheduled_message_blocked') {
      const missing = missingCodesOfProblem(data).map((item) => t(missingItemOf(item).itemKey));
      return missing.length > 0 ? t('booking.scheduledMessages.errors.blockedNamed', { missing: missing.join('; ') }) : t('booking.scheduledMessages.errors.blocked');
    }
    if (code === 'message_text_invalid') return t('booking.scheduledMessages.errors.textInvalid');
    if (code === 'template_variable_unknown') return t('booking.scheduledMessages.errors.variableUnknown');
  }

  return getProblemMessage(error, t) ?? t('booking.scheduledMessages.errors.generic');
}

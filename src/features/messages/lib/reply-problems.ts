import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemCode, getProblemMessage, getRetryAfterSeconds, isTransientRequestError } from '@/lib/api-errors';

function codeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * The sentence for a send that did not go (NF-63), one for each answer the API gives: 409 `thread_closed` (the conversation closed
 * meanwhile), 409 `mapping_not_confirmed` (nothing was sent), 422 `channel_rule_violation` (no link, e-mail or number before the booking),
 * 422 for a text that is empty or too long, 429 with the minutes to wait. Anything else is the server's own sentence, or a general one.
 */
export function replyProblemMessage(error: unknown, t: TFunction): string {
  const status = getHttpStatus(error);
  const code = codeOf(error);
  if (status === 409 && code === 'thread_closed') return t('messages.problem.threadClosed');
  if (status === 409 && code === 'mapping_not_confirmed') return t('messages.problem.mappingNotConfirmed');
  if (status === 422 && code === 'channel_rule_violation') return t('messages.request.noContacts');
  if (status === 422 && (code === 'message_text_invalid' || code === 'idempotency_key_invalid')) return t('messages.problem.textInvalid');
  if (status === 429) {
    const seconds = getRetryAfterSeconds(error);
    return seconds !== undefined ? t('messages.problem.rateLimited', { count: Math.max(1, Math.ceil(seconds / 60)) }) : t('messages.problem.tooManyRequests');
  }
  return getProblemMessage(error, t) ?? t('messages.problem.generic');
}

/**
 * Whether sending the same message again can work: the network or the server failed, or the host was told to wait. A message the API
 * refused (a closed conversation, a rule of the channel, a text it does not take) is edited instead: sending it again would be refused
 * the same way.
 */
export function canRetryReply(error: unknown): boolean {
  return isTransientRequestError(error) || getHttpStatus(error) === 429;
}

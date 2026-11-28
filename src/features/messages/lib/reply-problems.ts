import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemCode, getProblemMessage, getRetryAfterSeconds, isTransientRequestError } from '@/lib/api-errors';

function codeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

export function replyProblemMessage(error: unknown, t: TFunction): string {
  const status = getHttpStatus(error);
  const code = codeOf(error);
  if (status === 409 && code === 'thread_closed') return t('messages.problem.threadClosed');
  if (status === 409 && code === 'mapping_not_confirmed') return t('messages.problem.mappingNotConfirmed');
  if (status === 409 && code === 'chat_not_licensed') return t('messages.problem.chatNotLicensed');
  if (status === 422 && code === 'channel_rule_violation') return t('messages.request.noContacts');
  if (status === 422 && (code === 'message_text_invalid' || code === 'idempotency_key_invalid')) return t('messages.problem.textInvalid');
  if (status === 429) {
    const seconds = getRetryAfterSeconds(error);
    return seconds !== undefined ? t('messages.problem.rateLimited', { count: Math.max(1, Math.ceil(seconds / 60)) }) : t('messages.problem.tooManyRequests');
  }
  return getProblemMessage(error, t) ?? t('messages.problem.generic');
}

export function canRetryReply(error: unknown): boolean {
  return isTransientRequestError(error) || getHttpStatus(error) === 429;
}

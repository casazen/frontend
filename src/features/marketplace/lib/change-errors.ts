import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { problemCodeOf } from '../activation/activation-wizard-model';

/**
 * The words of a refusal of a call that changes an activation (the settings, the deactivation, the change request): the text of its code (`apiErrors.codes`), else what the
 * answer says in plain words (a status that asks a thing of the person, the `detail` of a 4xx), else `fallbackKey`. A text of the channel manager's own is never among them: the
 * server sends codes and its own words.
 */
export function changeErrorText(error: unknown, t: TFunction, fallbackKey: string): string {
  return translateErrorCode(problemCodeOf(error), t) ?? getProblemMessage(error, t) ?? t(fallbackKey);
}

/**
 * Whether a call that failed left the activation as it was. The server says so for a refusal (a 4xx: nothing is read, checked or written past it) and for a failure of the
 * channel manager or the channel (a 502: nothing was changed, try again). A call that got no answer, or that failed inside CasaZen (any other 5xx), may have gone through:
 * it is said as that, never as «nothing happened».
 */
export function leftUnchanged(error: unknown): boolean {
  const status = getHttpStatus(error);
  return status !== undefined && (status < 500 || status === 502);
}

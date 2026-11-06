import { getHttpStatus, getProblemMessage, isTransientRequestError } from '@/lib/api-errors';

type TranslateFn = (key: string) => string;

/**
 * The message keys the API sends in the `codes` extension of the 400 of `POST /public/checkin/{token}` (the `CheckInValidationKeys` of the
 * backend), each with the text of the page: the guest reads the error in the language of the page, not in the one of the server. The
 * keys are written out so that the i18n test finds a missing translation, and the subset files of German, French and Spanish carry them.
 */
export const GUEST_ERROR_KEYS: Record<string, string> = {
  CheckInFieldRequired: 'checkin.errors.fieldRequired',
  CheckInFieldMaxLength: 'checkin.errors.fieldMaxLength',
  CheckInGenderInvalid: 'checkin.errors.genderInvalid',
  CheckInDocumentTypeInvalid: 'checkin.errors.documentTypeInvalid',
  CheckInMarketingConsentUnavailable: 'checkin.errors.marketingConsentUnavailable',
  CheckInMarketingConsentMinor: 'checkin.errors.marketingConsentMinor',
  CheckInMarketingEmailRequired: 'checkin.errors.marketingEmailRequired',
  CheckInMarketingEmailInvalid: 'checkin.errors.marketingEmailInvalid',
  CheckInGuestsCount: 'checkin.errors.guestsCount',
  CheckInGuestTypeInvalid: 'checkin.errors.guestTypeInvalid',
  CheckInMemberWithoutHead: 'checkin.errors.memberWithoutHead',
  CheckInHeadWithoutMembers: 'checkin.errors.headWithoutMembers',
  CheckInDateOfBirthInFuture: 'checkin.errors.dateOfBirthInFuture',
  CheckInProvinceInvalid: 'checkin.errors.provinceInvalid',
  CheckInCodeInvalid: 'checkin.errors.codeInvalid',
  CheckInCodeUnknown: 'checkin.errors.codeUnknown',
  CheckInDocumentNumberInvalid: 'checkin.errors.documentNumberInvalid',
  CheckInDocumentIssuedOnInvalid: 'checkin.errors.documentIssuedOnInvalid',
  CheckInDocumentExpiresBeforeIssue: 'checkin.errors.documentExpiresBeforeIssue',
  CheckInStatisticalValueInvalid: 'checkin.errors.statisticalValueInvalid',
};

/**
 * The text, in the language of the page, of a message key the API sent in `codes`; `undefined` for a key the page does not know, and
 * the caller then shows the message of the server.
 */
export function translateGuestServerCode(code: string, t: TranslateFn): string | undefined {
  if (!Object.hasOwn(GUEST_ERROR_KEYS, code)) return undefined;
  const key = GUEST_ERROR_KEYS[code];
  const text = t(key);
  return text && text !== key ? text : undefined;
}

/**
 * What the page says when a submit fails with no field to blame: no answer from the server, too many requests, the message of the server
 * when it has one worth showing, otherwise a plain "could not save".
 */
export function guestProblemMessage(error: unknown, t: TranslateFn): string {
  if (getHttpStatus(error) === undefined && isTransientRequestError(error)) return t('checkin.errors.network');
  if (getHttpStatus(error) === 429) return t('checkin.errors.tooManyRequests');
  return getProblemMessage(error, t) ?? t('checkin.toast.saveFailed');
}

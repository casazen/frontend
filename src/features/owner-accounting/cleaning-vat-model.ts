import { isAxiosError } from 'axios';
import type { AppContextKey } from '@/config/route-manifest';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import type { CleaningVatAnswer } from '@/types';

/**
 * The part of the address that opens the question of the VAT of a cleaning: its value is the id of the cleaning request (`…/interventions/<request>?cleaningVat=<request>`). The «Da fare» `StateCleaningVat` leads
 * there, and closing the dialog takes it off. The address is the only place that says which request is being asked about: nothing of it is kept in the storage of the browser, and the id of a request is not personal data.
 */
export const CLEANING_VAT_PARAM = 'cleaningVat';

export const CLEANING_VAT_AREA: AppContextKey = 'short-rent';
export const CLEANING_VAT_PERMISSION = 'property.write';

export const CLEANING_VAT_ANSWERS: readonly CleaningVatAnswer[] = ['Applied', 'NotApplied', 'Unknown'];

/**
 * What a refusal or a failure of the question is, each with its own words (`ownerAccounting.cleaningVat.problem.<kind>`). `notFound`: the request is not there (another organization's, out of reach, gone: 404
 * `service_request_not_found`). `forbidden`: the person may not answer it (403). `rememberForbidden`: «Ricorda» is for a caller of the whole organization (403 `cleaning_vat_remember_forbidden`): the answer can be sent
 * again without it. `changed`: another operation changed the request meanwhile (409 `service_request_state_changed`): the question is read again. 422: `answerInvalid` (`cleaning_vat_answer_invalid`), `notCompleted` (the
 * cleaning is not completed: there is no invoice of the company to answer about yet, `cleaning_vat_not_completed`), `rateUnknown` (no rate for the day of the cleaning: «Sì» is refused, `cleaning_vat_rate_unknown`) and
 * `rememberUnknown` («Non lo so» is not remembered, `cleaning_vat_remember_unknown`). `failed`: anything else (a 5xx, no answer, a session that ended, an answer that is not the question or not the answer that was sent):
 * the outcome is not known, so it is told as «not confirmed», never as done, and it can be tried again.
 */
export type CleaningVatProblem =
  | 'notFound'
  | 'forbidden'
  | 'rememberForbidden'
  | 'changed'
  | 'answerInvalid'
  | 'notCompleted'
  | 'rateUnknown'
  | 'rememberUnknown'
  | 'failed';

const CODE_TO_PROBLEM: Readonly<Record<string, CleaningVatProblem>> = {
  cleaning_vat_remember_forbidden: 'rememberForbidden',
  cleaning_vat_answer_invalid: 'answerInvalid',
  cleaning_vat_not_completed: 'notCompleted',
  cleaning_vat_rate_unknown: 'rateUnknown',
  cleaning_vat_remember_unknown: 'rememberUnknown',
};

/** What a refusal or a failure of `GET` or `POST api/service-requests/{id}/cleaning-vat` is, from its status and its code. */
export function cleaningVatProblemOf(error: unknown): CleaningVatProblem {
  const status = getHttpStatus(error);
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (status === 404) return 'notFound';
  if (status === 403) return code === 'cleaning_vat_remember_forbidden' ? 'rememberForbidden' : 'forbidden';
  if (status === 409) return 'changed';
  if (status === 422 && code !== undefined && Object.hasOwn(CODE_TO_PROBLEM, code)) return CODE_TO_PROBLEM[code];
  return 'failed';
}

export function isFinalProblem(problem: CleaningVatProblem): boolean {
  return problem === 'notFound' || problem === 'forbidden' || problem === 'notCompleted';
}

export function yesRateOf(standardRatePercent: number | null): number | null {
  return typeof standardRatePercent === 'number' && Number.isFinite(standardRatePercent) && standardRatePercent > 0 ? standardRatePercent : null;
}

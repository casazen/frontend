import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import type { SelfBillingCloseRequest, SelfBillingListItem } from '@/types';

export const SELF_BILLING_PATH = '/app/account/self-billing';

export const KEPT_REASONS = ['portal_not_configured', 'issuer_profile_incomplete', 'owner_issuer_missing', 'ledger_gives_no_td17'] as const;

export function keptKeyOf(code: string): string {
  return (KEPT_REASONS as readonly string[]).includes(code) ? `selfBilling.kept.${code}` : 'selfBilling.kept.unknown';
}

export function isCorrectedOriginal(item: Pick<SelfBillingListItem, 'replacedByDocumentId'>): boolean {
  return item.replacedByDocumentId !== null;
}

export function replacesAnInvoice(item: Pick<SelfBillingListItem, 'replacesDocumentId'>): boolean {
  return item.replacesDocumentId !== null;
}

export function canIssueDraft(item: Pick<SelfBillingListItem, 'status' | 'keptReason'>): boolean {
  return item.status === 'Draft' && item.keptReason === null;
}

export function canDiscardDraft(item: Pick<SelfBillingListItem, 'status' | 'replacesDocumentId'>): boolean {
  return item.status === 'Draft' && item.replacesDocumentId === null;
}

/**
 * What the correction of a rejected TD17 can come back with when it does not work, each with its own words: the call that failed is the only one that can be tried again as it is. Its words never say that nothing
 * changed (the outcome is not known: the server may have committed before the answer was lost): they ask to check the list and try again, which is safe because a second call answers the same draft.
 */
export type CorrectionProblem = 'notFound' | 'unavailable' | 'notCorrectable' | 'forbidden' | 'failed';

const NOT_FOUND_CODE = 'fiscal_document_not_found';
const NOT_CORRECTABLE_CODE = 'self_billing_not_correctable';
const DRAFT_OUTDATED_CODE = 'document_draft_outdated';

function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * What a refusal or a failure of `POST api/fiscal/self-billing/{id}/correct` is, from its status and its code. 403: the person has not the whole organization (the app is not sent anywhere). 404 with
 * `fiscal_document_not_found`: the TD17 is not there (another organization's, not a TD17, gone); a 404 with no such code is the endpoint itself not being open (a flag is off). 422 `self_billing_not_correctable`:
 * it is not issued and rejected by the SDI any more, or it has an issued credit note. Anything else is a call that failed (a 5xx, no answer, a session that ended, a success status that is not the 201 of the endpoint): the
 * outcome is not known, so it is told as «not confirmed» (never as «nothing changed», and never as done), the list behind it is read again, and it can be tried again.
 */
export function correctionProblemOf(error: unknown): CorrectionProblem {
  const status = getHttpStatus(error);
  if (status === 403) return 'forbidden';
  if (status === 404) return problemCodeOf(error) === NOT_FOUND_CODE ? 'notFound' : 'unavailable';
  if (status === 422 && problemCodeOf(error) === NOT_CORRECTABLE_CODE) return 'notCorrectable';
  return 'failed';
}

/** The issue of a draft refused because it was made with data that changed since (409 `document_draft_outdated`): the drafts of the month are made again, and then it is issued. */
export function isDraftOutdated(error: unknown): boolean {
  return getHttpStatus(error) === 409 && problemCodeOf(error) === DRAFT_OUTDATED_CODE;
}

export const CLOSE_REASONS = ['portal_credit_note', 'holder_no_longer_subject', 'duplicate_or_error'] as const;

export const CLOSE_NOTE_MAX = 500;

export function closeReasonKeyOf(code: string): string | null {
  return (CLOSE_REASONS as readonly string[]).includes(code) ? `selfBilling.close.reason.${code}` : null;
}

export function canCloseNotDue(item: Pick<SelfBillingListItem, 'status' | 'replacesDocumentId' | 'keptReason'>): boolean {
  return item.status === 'Draft' && item.replacesDocumentId !== null && item.keptReason !== null;
}

export function isClosedNotDue(item: Pick<SelfBillingListItem, 'status' | 'closedReason'>): boolean {
  return item.status === 'Discarded' && item.closedReason !== null;
}

/**
 * What the closing can come back with when it does not work, each with its own words. `reasonRequired` and `noteTooLong` are what the person can put right in the dialog (the form does not send them, so they mean the
 * server and the page disagree); `alreadyClosed` (closed with another reason: there is nothing to fix), `notClosable`, `notFound`, `unavailable` and `forbidden` are answers of the server that asking again as it is will not
 * change; `failed` is the only one that can be tried again as it is. Its words never say that nothing changed (the outcome is not known: the server may have committed before the answer was lost): they ask to check the
 * list and try again, which is safe because the same call with the same reason answers the same closed draft.
 */
export type CloseProblem = 'reasonRequired' | 'noteTooLong' | 'alreadyClosed' | 'notClosable' | 'notFound' | 'unavailable' | 'forbidden' | 'failed';

const CLOSE_PROBLEM_BY_CODE: ReadonlyMap<string, CloseProblem> = new Map<string, CloseProblem>([
  ['close_reason_required', 'reasonRequired'],
  ['close_note_too_long', 'noteTooLong'],
  ['self_billing_already_closed', 'alreadyClosed'],
  ['self_billing_not_closable', 'notClosable'],
]);

export function closeProblemOf(error: unknown): CloseProblem {
  const status = getHttpStatus(error);
  if (status === 403) return 'forbidden';
  if (status === 404) return problemCodeOf(error) === NOT_FOUND_CODE ? 'notFound' : 'unavailable';
  if (status === 422) return CLOSE_PROBLEM_BY_CODE.get(problemCodeOf(error) ?? '') ?? 'failed';
  return 'failed';
}

export function closeRequestOf(reason: string, note: string): SelfBillingCloseRequest {
  const text = note.trim();
  return text === '' ? { reason } : { reason, note: text };
}

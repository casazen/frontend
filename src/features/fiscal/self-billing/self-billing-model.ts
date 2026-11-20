import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import type { SelfBillingCloseRequest, SelfBillingListItem } from '@/types';

/** The page of the self-billed invoices in the route manifest: who may use its actions is who that entry lets in (the role of the organization's administrators and the flag of the issuance). */
export const SELF_BILLING_PATH = '/app/account/self-billing';

/**
 * Why a draft that holds the number of a rejected TD17 is kept (`keptReason` of a row, `reason` of `kept` in the answer of the drafts of the month), as the server writes it: each code has its sentence,
 * `selfBilling.kept.<code>`, in both languages (a test checks it).
 */
export const KEPT_REASONS = ['portal_not_configured', 'issuer_profile_incomplete', 'owner_issuer_missing', 'ledger_gives_no_td17'] as const;

/** The key of the sentence of a code. A code this client does not know (the server is newer) has the sentence that names it: never a blank, and never a reason made up. */
export function keptKeyOf(code: string): string {
  return (KEPT_REASONS as readonly string[]).includes(code) ? `selfBilling.kept.${code}` : 'selfBilling.kept.unknown';
}

/** The TD17 a correction discarded (its number stays on it): history, with a reference to what replaces it and no action. */
export function isCorrectedOriginal(item: Pick<SelfBillingListItem, 'replacedByDocumentId'>): boolean {
  return item.replacedByDocumentId !== null;
}

/** A draft (or the TD17 issued from it) that replaces a rejected TD17 and holds its number. */
export function replacesAnInvoice(item: Pick<SelfBillingListItem, 'replacesDocumentId'>): boolean {
  return item.replacesDocumentId !== null;
}

/**
 * Whether a draft is offered for the issue. A draft that is kept (nothing gives it a TD17 now) is refused by the server whatever the person does (409 `document_draft_outdated`, and making the drafts of the
 * month again changes nothing): it is not offered, and says why instead.
 */
export function canIssueDraft(item: Pick<SelfBillingListItem, 'status' | 'keptReason'>): boolean {
  return item.status === 'Draft' && item.keptReason === null;
}

/** Whether a draft is offered for the discard. A draft that replaces a rejected TD17 holds its number: it is issued, never discarded (the server answers 422 `document_replacement_holds_number`). */
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

// ---------------------------------------------------------------------------------------------------------------------------------
// «Chiudi come non più dovuta»: the exit of a replacement draft the month no longer supports (backend `POST api/fiscal/self-billing/{id}/close-not-due`)

/**
 * Why the replacement draft of a rejected TD17 is closed as «non più dovuta» (`reason` of the request, `closedReason` of the closed draft), as the server writes it: each code has its words, `selfBilling.close.reason.<code>`,
 * in both languages (a test checks it). The order is the one of the options in the dialog.
 */
export const CLOSE_REASONS = ['portal_credit_note', 'holder_no_longer_subject', 'duplicate_or_error'] as const;

/** The longest note the server takes (422 `close_note_too_long` above it): the field stops there and shows the count. */
export const CLOSE_NOTE_MAX = 500;

/** The key of the words of a code of the closing, or `null` for a code this client does not know (the server is newer): the page then shows the code as it came, never a blank and never a reason made up. */
export function closeReasonKeyOf(code: string): string | null {
  return (CLOSE_REASONS as readonly string[]).includes(code) ? `selfBilling.close.reason.${code}` : null;
}

/**
 * Whether «Chiudi come non più dovuta» is offered for a row (the person's right and the flags are the page's, not the row's): a DRAFT that replaces a rejected TD17 (it holds its number) and that the system reports as
 * kept (`keptReason`: nothing gives it a TD17 now). A draft that is not kept is issued, not closed (the server answers 422 `self_billing_not_closable`); the server decides what is kept, the client never works it out.
 */
export function canCloseNotDue(item: Pick<SelfBillingListItem, 'status' | 'replacesDocumentId' | 'keptReason'>): boolean {
  return item.status === 'Draft' && item.replacesDocumentId !== null && item.keptReason !== null;
}

/** The replacement draft that was closed as «non più dovuta»: history (it keeps its number, reserved), with the reason, the day, the person and the note, and no action. */
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

/**
 * What a refusal or a failure of `POST api/fiscal/self-billing/{id}/close-not-due` is, from its status and its code. 403: the person has not the whole organization (the app is not sent anywhere). 404 with
 * `fiscal_document_not_found`: the TD17 is not there (another organization's, not a TD17, gone); a 404 with no such code is the endpoint itself not being open (a flag is off). 422: the code says which of the four
 * refusals (a 422 with a code this client does not know is a call that failed). Anything else is a call that failed (a 5xx, no answer, a session that ended, a success status that is not the answer of the endpoint).
 */
export function closeProblemOf(error: unknown): CloseProblem {
  const status = getHttpStatus(error);
  if (status === 403) return 'forbidden';
  if (status === 404) return problemCodeOf(error) === NOT_FOUND_CODE ? 'notFound' : 'unavailable';
  if (status === 422) return CLOSE_PROBLEM_BY_CODE.get(problemCodeOf(error) ?? '') ?? 'failed';
  return 'failed';
}

/** The body of the call: the reason, and the note only when the person wrote one (trimmed: a note of spaces is no note). */
export function closeRequestOf(reason: string, note: string): SelfBillingCloseRequest {
  const text = note.trim();
  return text === '' ? { reason } : { reason, note: text };
}

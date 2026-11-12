import { isAxiosError } from 'axios';
import type { TFunction, i18n as I18nInstance } from 'i18next';
import { getProblemCode, translateErrorCode } from '@/lib/api-errors';
import { APPROVAL_ITEM_TYPES, type ApprovalQueueItem, type KnownApprovalItemType } from '@/types/approval-queue.types';

/*
 * What the page of the approvals needs to say about an item, as plain functions: the type, the situation and the confidence of a draft, the
 * text an approval acts with, the rules of an edit (the same the API applies: it decides, these only spare a round trip) and the words for
 * what an approval did or why it did not. The texts of the items are messages to guests and mailings: nothing here logs or stores them.
 */

/** The type of the drafts the assistant writes for a conversation (`ItemType`): approving one sends the text to the guest. */
export const MESSAGE_DRAFT_TYPE: KnownApprovalItemType = 'MessageDraft';

/** The type of a marketing campaign waiting for approval: its text is the subject line, a blank line and the body. */
export const CAMPAIGN_TYPE: KnownApprovalItemType = 'Campaign';

/** The longest message to a guest (`GuestMessageRules.TextMaxLength`). */
export const MESSAGE_TEXT_MAX_LENGTH = 2000;

/** The longest subject line of a campaign (`ApprovalQueueRules.CampaignSubjectMaxLength`). */
export const CAMPAIGN_SUBJECT_MAX_LENGTH = 200;

/** The longest reason of a rejection (`ApprovalQueueItem.RejectionReasonMaxLength`). */
export const REJECTION_REASON_MAX_LENGTH = 500;

/**
 * The score from which a draft of the assistant is called «high» (PO-08: 0.85 is the threshold the assistant starts with; the page does not
 * know the one an organization may have set, so it only words the score: the decision is always the host's).
 */
export const HIGH_CONFIDENCE_FROM = 0.85;

/** The codes of the answers of the approval queue (`ApprovalQueueRules`), the ones the page tells apart. */
export const ORIGIN_ACTION_FAILED_CODE = 'approval_origin_action_failed';
const NOT_PENDING_CODE = 'approval_item_not_pending';
const NOT_FOUND_CODE = 'approval_item_not_found';

/** The code the server gives to a failure of an action that nobody foresaw (`ApprovalQueueRules.UnexpectedErrorCode`). */
const UNEXPECTED_ORIGIN_ERROR_CODE = 'origin_action_error';

const TYPE_LABEL_KEYS: Record<KnownApprovalItemType, string> = {
  MessageDraft: 'approval.type.messageDraft',
  Campaign: 'approval.type.campaign',
  Routine: 'approval.type.routine',
  AiText: 'approval.type.aiText',
};

/** The types the filter of the page offers, in the order it shows them (the drafts of messages first). */
export const FILTERABLE_TYPES: readonly KnownApprovalItemType[] = APPROVAL_ITEM_TYPES;

/** The type of an item in words: «Bozza di messaggio», «Campagna»; «Altro» for a type this version does not know. */
export function approvalTypeLabel(itemType: string, t: TFunction): string {
  const key = (TYPE_LABEL_KEYS as Record<string, string | undefined>)[itemType] ?? 'approval.type.other';
  return t(key);
}

/** Whether the item is the draft of a message to a guest: it has a conversation, a situation and a score. */
export function isMessageDraft(item: Pick<ApprovalQueueItem, 'itemType'>): boolean {
  return item.itemType === MESSAGE_DRAFT_TYPE;
}

/** Whether the item is a campaign. */
export function isCampaign(item: Pick<ApprovalQueueItem, 'itemType'>): boolean {
  return item.itemType === CAMPAIGN_TYPE;
}

/** Whether the host edited the text: the approval then acts with the edit, and the original stays on the item. */
export function isEdited(item: Pick<ApprovalQueueItem, 'editedContentText'>): boolean {
  return item.editedContentText !== null && item.editedContentText !== undefined;
}

/** The text the approval acts with: the edit of the host when there is one, otherwise the text as it was submitted. */
export function finalTextOf(item: Pick<ApprovalQueueItem, 'contentText' | 'editedContentText'>): string {
  return isEdited(item) ? (item.editedContentText as string) : item.contentText;
}

/** The first line of a text, for a place where it only has to be recognised. */
export function firstLineOf(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
}

// -- the confidence and the situation of a draft ---------------------------------------------------------------------------------------

/** The score of a draft in words: `high` from {@link HIGH_CONFIDENCE_FROM}, `low` below it («check it carefully»), with the percentage. */
export interface ConfidenceView {
  level: 'high' | 'low';
  percent: number;
}

/** The confidence of a draft, or `null` when the item has no score (every item that is not the draft of a message). */
export function confidenceView(score: number | null | undefined): ConfidenceView | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const clamped = Math.min(1, Math.max(0, score));
  return { level: clamped >= HIGH_CONFIDENCE_FROM ? 'high' : 'low', percent: Math.round(clamped * 100) };
}

/**
 * The situation the assistant recognised, in words: `approval.situation.<code>` for the situations it has (snake_case codes), and, for a code
 * this version does not know, the code itself written as a phrase («late_check_in» → «Late check in»), never a raw identifier.
 */
export function situationLabel(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `approval.situation.${code}`;
  if (/^[a-z][a-z0-9_]*$/.test(code) && i18n.exists(key)) return t(key);
  const phrase = code.replace(/[_-]+/g, ' ').trim();
  return phrase.length === 0 ? code : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

// -- the text of an edit ---------------------------------------------------------------------------------------------------------------

/** The fields the edit dialog holds: one text for everything but a campaign, whose text is a subject line and a body. */
export interface EditFields {
  text: string;
  subject: string;
  body: string;
}

/** What is wrong with an edit: the field, the i18n key of the sentence and, when it has one, the limit it names. */
export interface EditProblem {
  field: 'text' | 'subject' | 'body';
  key: string;
  max?: number;
}

function normalizeBreaks(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * The subject line and the body of the text of a campaign: the subject on one line, a blank line, the body (`ApprovalQueueRules.TryParseCampaignText`).
 * `null` for a text that is not in that form.
 */
export function parseCampaignText(text: string): { subject: string; body: string } | null {
  const normalized = normalizeBreaks(text).trim();
  const split = normalized.indexOf('\n\n');
  if (split <= 0) return null;

  const subject = normalized.slice(0, split).trim();
  const body = normalized.slice(split + 2).trim();
  if (subject.length === 0 || subject.length > CAMPAIGN_SUBJECT_MAX_LENGTH || subject.includes('\n') || body.length === 0) return null;
  return { subject, body };
}

/** The text of a campaign item: the subject, a blank line and the body (the form the API reads). */
export function campaignTextOf(subject: string, body: string): string {
  return `${subject.trim()}\n\n${body.trim()}`;
}

/** The fields of the edit dialog for a text: a campaign is split into its subject line and its body, any other text is one field. */
export function editFieldsOf(item: Pick<ApprovalQueueItem, 'itemType'>, text: string): EditFields {
  if (isCampaign(item)) {
    const parsed = parseCampaignText(text);
    return { text, subject: parsed?.subject ?? '', body: parsed?.body ?? text.trim() };
  }
  return { text, subject: '', body: '' };
}

/** The text an edit saves: the subject line, a blank line and the body for a campaign, the text as it is for the others. */
export function editedTextOf(item: Pick<ApprovalQueueItem, 'itemType'>, fields: EditFields): string {
  return isCampaign(item) ? campaignTextOf(fields.subject, fields.body) : fields.text;
}

/**
 * What the API would refuse in an edit (`approval_edit_invalid`), found before the request: an empty text, a message longer than
 * {@link MESSAGE_TEXT_MAX_LENGTH} characters, a campaign without a subject line (or with one longer than {@link CAMPAIGN_SUBJECT_MAX_LENGTH}
 * or on several lines) or without a body. `null` when the edit is usable. The API stays the judge: it answers 422 for what this lets through.
 */
export function editProblem(item: Pick<ApprovalQueueItem, 'itemType'>, fields: EditFields): EditProblem | null {
  if (isCampaign(item)) {
    const subject = normalizeBreaks(fields.subject).trim();
    if (subject.length === 0) return { field: 'subject', key: 'approval.edit.error.subjectRequired' };
    if (subject.includes('\n')) return { field: 'subject', key: 'approval.edit.error.subjectOneLine' };
    if (subject.length > CAMPAIGN_SUBJECT_MAX_LENGTH) return { field: 'subject', key: 'approval.edit.error.subjectTooLong', max: CAMPAIGN_SUBJECT_MAX_LENGTH };
    if (normalizeBreaks(fields.body).trim().length === 0) return { field: 'body', key: 'approval.edit.error.bodyRequired' };
    return null;
  }

  const text = normalizeBreaks(fields.text).trim();
  if (text.length === 0) return { field: 'text', key: 'approval.edit.error.empty' };
  if (isMessageDraft(item) && text.length > MESSAGE_TEXT_MAX_LENGTH) {
    return { field: 'text', key: 'approval.edit.error.tooLong', max: MESSAGE_TEXT_MAX_LENGTH };
  }
  return null;
}

// -- what an approval did, and why it did not ------------------------------------------------------------------------------------------

/** What an approval did, as the page tells it: the i18n key of the sentence and its tone (`warning` when the host has something to check). */
export interface ApprovalOutcome {
  key: string;
  tone: 'success' | 'warning';
}

/**
 * What the approval of an item did, from the answer of the API (`originActionResult`): the message that went out, the one the channel has and
 * sends, the one whose outcome must be checked on the channel, the campaign approved and scheduled (or approved and still without a time),
 * an item that was already approved (nothing was sent again) or one with no action linked.
 */
export function approvalOutcome(item: Pick<ApprovalQueueItem, 'originActionResult' | 'originActionStatus'>): ApprovalOutcome {
  switch (item.originActionResult) {
    case 'Sent':
      return { key: 'approval.action.executed.message', tone: 'success' };
    case 'Created':
    case 'WaitingAuthorization':
      return { key: 'approval.action.executed.messageQueued', tone: 'success' };
    case 'ManualVerify':
      return { key: 'approval.action.executed.messageVerify', tone: 'warning' };
    case 'Scheduled':
      return { key: 'approval.action.executed.campaign', tone: 'success' };
    case 'Approved':
      return { key: 'approval.action.executed.campaignApproved', tone: 'success' };
    default:
      return item.originActionStatus === 'Executed'
        ? { key: 'approval.action.executed.already', tone: 'success' }
        : { key: 'approval.action.executed.none', tone: 'success' };
  }
}

/**
 * The stable code of a failed action when the error is the 409 `approval_origin_action_failed` of an approval (its `originActionError`):
 * the item stays pending and the host can try again. `undefined` for any other error.
 */
export function originActionErrorOf(error: unknown): string | undefined {
  if (!isAxiosError(error) || error.response?.status !== 409) return undefined;

  const data: unknown = error.response.data;
  if (getProblemCode(data) !== ORIGIN_ACTION_FAILED_CODE) return undefined;

  const code = (data as Record<string, unknown>).originActionError;
  return typeof code === 'string' && code.length > 0 ? code : UNEXPECTED_ORIGIN_ERROR_CODE;
}

/**
 * Whether the item is not there to be decided any more: 404 `approval_item_not_found` (it is gone, or out of the reach of the caller) or
 * 409 `approval_item_not_pending` (another person decided it, or it expired). The page lets the list say so instead of keeping a dialog open on it.
 */
export function itemIsGone(error: unknown): boolean {
  if (!isAxiosError(error)) return false;

  const code = getProblemCode(error.response?.data);
  const status = error.response?.status;
  return (status === 404 && code === NOT_FOUND_CODE) || (status === 409 && code === NOT_PENDING_CODE);
}

/**
 * Why an action failed, in plain words, from the code the server saved (`originActionError`): the codes that have a text in `apiErrors.codes`
 * (a closed conversation, a channel that refuses the text, a campaign that is not waiting any more…), otherwise a general sentence that says
 * the item is still there to try again.
 */
export function originErrorMessage(code: string | null | undefined, t: TFunction): string {
  return translateErrorCode(code, t) ?? t('approval.action.originUnknown');
}

/** The code of the failure to show on an item that is still pending: the one the last approval gave, or the one the server saved on the item. */
export function failureCodeOf(item: Pick<ApprovalQueueItem, 'originActionStatus' | 'originActionError'>): string | null {
  return item.originActionStatus === 'Failed' ? (item.originActionError ?? UNEXPECTED_ORIGIN_ERROR_CODE) : null;
}

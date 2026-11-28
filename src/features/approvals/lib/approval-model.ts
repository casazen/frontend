import { isAxiosError } from 'axios';
import type { TFunction, i18n as I18nInstance } from 'i18next';
import { getProblemCode, translateErrorCode } from '@/lib/api-errors';
import { APPROVAL_ITEM_TYPES, type ApprovalQueueItem, type KnownApprovalItemType } from '@/types/approval-queue.types';
import { REVIEW_REPLY_MAX_LENGTH } from '@/types/review.types';

export const MESSAGE_DRAFT_TYPE: KnownApprovalItemType = 'MessageDraft';

export const CAMPAIGN_TYPE: KnownApprovalItemType = 'Campaign';

export const REVIEW_REPLY_TYPE: KnownApprovalItemType = 'ReviewReply';

export const MESSAGE_TEXT_MAX_LENGTH = 2000;

export const CAMPAIGN_SUBJECT_MAX_LENGTH = 200;

export const REJECTION_REASON_MAX_LENGTH = 500;

export const HIGH_CONFIDENCE_FROM = 0.85;

export const ORIGIN_ACTION_FAILED_CODE = 'approval_origin_action_failed';
const NOT_PENDING_CODE = 'approval_item_not_pending';
const NOT_FOUND_CODE = 'approval_item_not_found';

const UNEXPECTED_ORIGIN_ERROR_CODE = 'origin_action_error';

const TYPE_LABEL_KEYS: Record<KnownApprovalItemType, string> = {
  MessageDraft: 'approval.type.messageDraft',
  Campaign: 'approval.type.campaign',
  Routine: 'approval.type.routine',
  AiText: 'approval.type.aiText',
  ReviewReply: 'approval.type.reviewReply',
};

export const FILTERABLE_TYPES: readonly KnownApprovalItemType[] = APPROVAL_ITEM_TYPES;

export function approvalTypeLabel(itemType: string, t: TFunction): string {
  const key = (TYPE_LABEL_KEYS as Record<string, string | undefined>)[itemType] ?? 'approval.type.other';
  return t(key);
}

export function isMessageDraft(item: Pick<ApprovalQueueItem, 'itemType'>): boolean {
  return item.itemType === MESSAGE_DRAFT_TYPE;
}

export function isCampaign(item: Pick<ApprovalQueueItem, 'itemType'>): boolean {
  return item.itemType === CAMPAIGN_TYPE;
}

export function isReviewReply(item: Pick<ApprovalQueueItem, 'itemType'>): boolean {
  return item.itemType === REVIEW_REPLY_TYPE;
}

export function isEdited(item: Pick<ApprovalQueueItem, 'editedContentText'>): boolean {
  return item.editedContentText !== null && item.editedContentText !== undefined;
}

/** The text the approval acts with: the edit of the host when there is one, otherwise the text as it was submitted. */
export function finalTextOf(item: Pick<ApprovalQueueItem, 'contentText' | 'editedContentText'>): string {
  return isEdited(item) ? (item.editedContentText as string) : item.contentText;
}

export function firstLineOf(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
}

/** The score of a draft in words: `high` from {@link HIGH_CONFIDENCE_FROM}, `low` below it («check it carefully»), with the percentage. */
export interface ConfidenceView {
  level: 'high' | 'low';
  percent: number;
}

export function confidenceView(score: number | null | undefined): ConfidenceView | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const clamped = Math.min(1, Math.max(0, score));
  return { level: clamped >= HIGH_CONFIDENCE_FROM ? 'high' : 'low', percent: Math.round(clamped * 100) };
}

export function situationLabel(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `approval.situation.${code}`;
  if (/^[a-z][a-z0-9_]*$/.test(code) && i18n.exists(key)) return t(key);
  const phrase = code.replace(/[_-]+/g, ' ').trim();
  return phrase.length === 0 ? code : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export interface EditFields {
  text: string;
  subject: string;
  body: string;
}

export interface EditProblem {
  field: 'text' | 'subject' | 'body';
  key: string;
  max?: number;
}

function normalizeBreaks(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseCampaignText(text: string): { subject: string; body: string } | null {
  const normalized = normalizeBreaks(text).trim();
  const split = normalized.indexOf('\n\n');
  if (split <= 0) return null;

  const subject = normalized.slice(0, split).trim();
  const body = normalized.slice(split + 2).trim();
  if (subject.length === 0 || subject.length > CAMPAIGN_SUBJECT_MAX_LENGTH || subject.includes('\n') || body.length === 0) return null;
  return { subject, body };
}

export function campaignTextOf(subject: string, body: string): string {
  return `${subject.trim()}\n\n${body.trim()}`;
}

export function editFieldsOf(item: Pick<ApprovalQueueItem, 'itemType'>, text: string): EditFields {
  if (isCampaign(item)) {
    const parsed = parseCampaignText(text);
    return { text, subject: parsed?.subject ?? '', body: parsed?.body ?? text.trim() };
  }
  return { text, subject: '', body: '' };
}

export function editedTextOf(item: Pick<ApprovalQueueItem, 'itemType'>, fields: EditFields): string {
  return isCampaign(item) ? campaignTextOf(fields.subject, fields.body) : fields.text;
}

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
  if (isReviewReply(item) && text.length > REVIEW_REPLY_MAX_LENGTH) {
    return { field: 'text', key: 'approval.edit.error.tooLong', max: REVIEW_REPLY_MAX_LENGTH };
  }
  return null;
}

/** What an approval did, as the page tells it: the i18n key of the sentence and its tone (`warning` when the host has something to check). */
export interface ApprovalOutcome {
  key: string;
  tone: 'success' | 'warning';
}

/**
 * What the approval of an item did, from the answer of the API (`originActionResult`): the message that went out, the one the channel has and
 * sends, the one whose outcome must be checked on the channel, the campaign approved and scheduled (or approved and still without a time),
 * an item that was already approved (nothing was sent again) or one with no action linked. The reply to a review (`itemType` `ReviewReply`) is told as the reply that was published, or
 * that the channel has not confirmed: it is not a message to the guest.
 */
export function approvalOutcome(item: Pick<ApprovalQueueItem, 'originActionResult' | 'originActionStatus'> & Partial<Pick<ApprovalQueueItem, 'itemType'>>): ApprovalOutcome {
  if (item.itemType === REVIEW_REPLY_TYPE) {
    if (item.originActionResult === 'Sent') return { key: 'approval.action.executed.review', tone: 'success' };
    if (item.originActionResult === 'ManualVerify') return { key: 'approval.action.executed.reviewVerify', tone: 'warning' };
  }
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

export function failureCodeOf(item: Pick<ApprovalQueueItem, 'originActionStatus' | 'originActionError'>): string | null {
  return item.originActionStatus === 'Failed' ? (item.originActionError ?? UNEXPECTED_ORIGIN_ERROR_CODE) : null;
}

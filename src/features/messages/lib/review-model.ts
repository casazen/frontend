import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type { BadgeProps } from '@/components/ui/badge';
import { isReviewReply } from '@/features/approvals/lib/approval-model';
import { getProblemCode, getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import {
  REVIEW_MAX_RATING,
  REVIEW_TEXT_MAX_LENGTH,
  type HostReviewCommand,
  type OtaReviewActionState,
  type ReviewThreadSource,
} from '@/types';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

/*
 * What the screens of the reviews say about their data, as plain functions: which key is a review, the stars and the categories in words, where a reply stands, why a review cannot be
 * read or answered, what the host's own review needs, and which draft of the approval queue belongs to a review. The words of a review, of a reply and of the host's own review are
 * personal data: nothing here reads, logs or stores them.
 */

const OTA_REVIEW_PREFIX = 'otareview:';
const SITE_REVIEW_PREFIX = 'review:';

export interface ReviewTarget {
  source: ReviewThreadSource;
  id: string;
}

export function parseReviewKey(threadKey: string): ReviewTarget | null {
  if (threadKey.startsWith(OTA_REVIEW_PREFIX)) return { source: 'OtaReview', id: threadKey.slice(OTA_REVIEW_PREFIX.length) };
  if (threadKey.startsWith(SITE_REVIEW_PREFIX)) return { source: 'Review', id: threadKey.slice(SITE_REVIEW_PREFIX.length) };
  return null;
}

export function isReviewThreadKey(threadKey: string): boolean {
  return parseReviewKey(threadKey) !== null;
}

export function ratingText(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

function phraseOf(code: string): string {
  const phrase = code.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return phrase.length === 0 ? code : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function categoryLabel(category: string, t: TFunction): string {
  switch (category.trim().toLowerCase()) {
    case 'accuracy':
      return t('reviews.category.accuracy');
    case 'checkin':
      return t('reviews.category.checkin');
    case 'cleanliness':
      return t('reviews.category.cleanliness');
    case 'communication':
      return t('reviews.category.communication');
    case 'location':
      return t('reviews.category.location');
    case 'respect_house_rules':
      return t('reviews.category.respect_house_rules');
    case 'value':
      return t('reviews.category.value');
    default:
      return phraseOf(category);
  }
}

export function actionStateLabel(state: OtaReviewActionState, t: TFunction): string {
  switch (state) {
    case 'Sent':
      return t('reviews.state.sent');
    case 'Error':
      return t('reviews.state.error');
    case 'ManualVerify':
      return t('reviews.state.manualVerify');
    default:
      return t('reviews.state.none');
  }
}

export function actionStateVariant(state: OtaReviewActionState): BadgeProps['variant'] {
  switch (state) {
    case 'Sent':
      return 'success';
    case 'Error':
      return 'destructive';
    case 'ManualVerify':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * The sentence for a code that says why a review cannot be read or answered now: a reason of the channel or of the property (`channel_not_integrated`, `mapping_not_confirmed`…), where
 * a reply or the host's review stands (`ota_review_reply_already_sent`, `reply_not_delivered`…), or the failure of the last read. `channel` names the portal for the codes that talk about it.
 * `null` for a code the app has no words for: the caller says its own sentence, never the code.
 */
export function reasonText(code: string | null | undefined, t: TFunction, channel?: string): string | null {
  switch (code) {
    case 'channel_not_integrated':
      return t('reviews.channel.notIntegrated', { channel: channel ?? t('reviews.channel.thisChannel') });
    case 'no_reviews_for_booking_source':
      return t('reviews.channel.noSource');
    case 'mapping_not_confirmed':
      return t('reviews.reason.mappingNotConfirmed');
    case 'octorate_not_connected':
      return t('reviews.reason.notConnected');
    default:
      return translateErrorCode(code, t) ?? null;
  }
}

export function reviewProblemMessage(error: unknown, t: TFunction): string | undefined {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  return reasonText(code, t) ?? getProblemMessage(error, t);
}

export function pendingReviewDraftOf(items: readonly ApprovalQueueItem[] | undefined, threadKey: string): ApprovalQueueItem | null {
  const drafts = (items ?? []).filter((item) => isReviewReply(item) && item.status === 'Pending' && item.threadKey === threadKey);
  return drafts.reduce<ApprovalQueueItem | null>((newest, item) => (newest === null || item.createdAt > newest.createdAt ? item : newest), null);
}

const DRAFT_REASONS: ReadonlySet<string> = new Set([
  'assistant_disabled',
  'ai_provider_not_configured',
  'ai_budget_exceeded',
  'ai_provider_error',
  'ai_invalid_answer',
  'draft_rule_violation',
  'draft_too_long',
  'already_answered',
  'already_drafted',
  'ota_review_not_published',
  'ota_review_channel_not_supported',
  'reply_not_possible',
]);

export function draftReasonText(reason: string | null | undefined, t: TFunction): string {
  switch (reason !== null && reason !== undefined && DRAFT_REASONS.has(reason) ? reason : '') {
    case 'assistant_disabled':
      return t('reviews.thread.draft.reason.assistant_disabled');
    case 'ai_provider_not_configured':
      return t('reviews.thread.draft.reason.ai_provider_not_configured');
    case 'ai_budget_exceeded':
      return t('reviews.thread.draft.reason.ai_budget_exceeded');
    case 'ai_provider_error':
      return t('reviews.thread.draft.reason.ai_provider_error');
    case 'ai_invalid_answer':
      return t('reviews.thread.draft.reason.ai_invalid_answer');
    case 'draft_rule_violation':
      return t('reviews.thread.draft.reason.draft_rule_violation');
    case 'draft_too_long':
      return t('reviews.thread.draft.reason.draft_too_long');
    case 'already_answered':
      return t('reviews.thread.draft.reason.already_answered');
    case 'already_drafted':
      return t('reviews.thread.draft.reason.already_drafted');
    case 'ota_review_not_published':
      return t('reviews.thread.draft.reason.ota_review_not_published');
    case 'ota_review_channel_not_supported':
      return t('reviews.thread.draft.reason.ota_review_channel_not_supported');
    case 'reply_not_possible':
      return t('reviews.thread.draft.reason.reply_not_possible');
    default:
      return t('reviews.thread.draft.reason.unknown');
  }
}

export const HOST_REVIEW_CATEGORIES: readonly string[] = ['cleanliness', 'communication', 'respect_house_rules'];

export const HOST_REVIEW_TEXT_MAX_LENGTH = REVIEW_TEXT_MAX_LENGTH;

export interface HostReviewDraft {
  ratings: Readonly<Record<string, number>>;
  text: string;
  privateText: string;
}

export const EMPTY_HOST_REVIEW: HostReviewDraft = { ratings: {}, text: '', privateText: '' };

export type HostReviewProblem = 'ratings' | 'text' | 'textTooLong' | 'privateTooLong';

export function hostReviewProblem(draft: HostReviewDraft): HostReviewProblem | null {
  const rated = HOST_REVIEW_CATEGORIES.every((category) => {
    const value = draft.ratings[category];
    return Number.isInteger(value) && value >= 1 && value <= REVIEW_MAX_RATING;
  });
  if (!rated) return 'ratings';
  const text = draft.text.trim();
  if (text.length === 0) return 'text';
  if (text.length > HOST_REVIEW_TEXT_MAX_LENGTH) return 'textTooLong';
  if (draft.privateText.trim().length > HOST_REVIEW_TEXT_MAX_LENGTH) return 'privateTooLong';
  return null;
}

export function hostReviewCommandOf(draft: HostReviewDraft): HostReviewCommand {
  const privateText = draft.privateText.trim();
  return {
    ratings: HOST_REVIEW_CATEGORIES.map((category) => ({ category, value: draft.ratings[category] })),
    text: draft.text.trim(),
    ...(privateText.length > 0 ? { privateText } : {}),
  };
}

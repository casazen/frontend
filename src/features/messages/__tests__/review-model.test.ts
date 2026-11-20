import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import {
  EMPTY_HOST_REVIEW,
  HOST_REVIEW_CATEGORIES,
  actionStateLabel,
  actionStateVariant,
  categoryLabel,
  draftReasonText,
  hostReviewCommandOf,
  hostReviewProblem,
  isReviewThreadKey,
  parseReviewKey,
  pendingReviewDraftOf,
  ratingText,
  reasonText,
  reviewProblemMessage,
} from '../lib/review-model';

const t = () => i18n.getFixedT('it');

function lookup(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

function item(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'ReviewReply',
    itemId: 'r1',
    contentText: 'Grazie del soggiorno.',
    contentVersion: null,
    isAiGenerated: true,
    status: 'Pending',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T08:00:00Z',
    expiresAt: '2026-11-17T08:00:00Z',
    propertyId: 'p1',
    originAction: 'SendReviewReply',
    originActionStatus: 'Pending',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: null,
    confidenceScore: null,
    situationCode: null,
    threadKey: 'otareview:6f1c9a52-1111-4222-8333-944455556666',
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

describe('the model of the reviews (E05/F06/US02, NF-69)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  describe('the key of a review', () => {
    it('parseReviewKey_KeysOfAReview_GiveTheSourceAndTheId', () => {
      expect(parseReviewKey('otareview:abc')).toEqual({ source: 'OtaReview', id: 'abc' });
      expect(parseReviewKey('review:abc')).toEqual({ source: 'Review', id: 'abc' });
    });

    it('isReviewThreadKey_ConversationKeys_AreNotReviews', () => {
      expect(isReviewThreadKey('otareview:6f1c9a52-1111-4222-8333-944455556666')).toBe(true);
      expect(isReviewThreadKey('review:6f1c9a52-1111-4222-8333-944455556666')).toBe(true);
      // The key of a conversation is never read as the one of a review: its endpoints answer 404 to the key of a review, and the other way round.
      for (const key of ['ota:6f1c9a52-1111-4222-8333-944455556666', 'direct:6f1c9a52-1111-4222-8333-944455556666', 'site:6f1c9a52-1111-4222-8333-944455556666', '', 'preview:1']) {
        expect(isReviewThreadKey(key), key).toBe(false);
      }
    });
  });

  describe('the stars and the words', () => {
    it('ratingText_OneDecimalAtMost_InTheLanguageOfTheReader', () => {
      expect(ratingText(4.5, 'it')).toBe('4,5');
      expect(ratingText(4.5, 'en')).toBe('4.5');
      expect(ratingText(5, 'it')).toBe('5');
    });

    it('categoryLabel_KnownCategoriesHaveWordsAndAnUnknownOneIsAPhraseNeverACode', () => {
      expect(categoryLabel('cleanliness', t())).toBe('Pulizia');
      expect(categoryLabel('respect_house_rules', t())).toBe('Rispetto delle regole della casa');
      expect(categoryLabel('Communication', t())).toBe('Comunicazione');
      expect(categoryLabel('cleanliness_of_place', t())).toBe('Cleanliness of place');
    });

    it('actionStateLabel_ASendIsPublishedOnlyWhenTheChannelSaysSo', () => {
      expect(actionStateLabel('Sent', t())).toBe('Pubblicata');
      expect(actionStateLabel('ManualVerify', t())).toBe('Da verificare');
      expect(actionStateLabel('Error', t())).toBe('Non inviata');
      expect(actionStateVariant('ManualVerify')).toBe('warning');
      expect(actionStateVariant('Error')).toBe('destructive');
      expect(actionStateVariant('Sent')).toBe('success');
    });
  });

  describe('why a review cannot be read or answered', () => {
    it('reasonText_TheReasonsOfTheChannelAndOfTheProperty_AreOneSentenceEachWithTheNameOfThePortal', () => {
      expect(reasonText('channel_not_integrated', t(), 'Booking.com')).toBe('Booking.com non permette a CasaZen di leggere le recensioni né di rispondere: leggile e rispondi dal portale.');
      expect(reasonText('channel_not_integrated', t())).toMatch(/^Questo canale non permette/);
      expect(reasonText('no_reviews_for_booking_source', t())).toMatch(/non ha recensioni/);
      expect(reasonText('mapping_not_confirmed', t())).toMatch(/non è ancora collegato a un tuo immobile/);
      expect(reasonText('octorate_not_connected', t())).toMatch(/collegamento ai canali non è attivo/);
    });

    it.each([
      'ota_review_channel_not_supported',
      'ota_review_not_published',
      'ota_review_window_closed',
      'ota_review_action_not_allowed',
      'ota_review_action_unconfirmed',
      'ota_review_reply_already_sent',
      'ota_review_host_review_already_sent',
      'ota_review_host_review_invalid',
      'ota_review_booking_not_reviewable',
      'ota_review_refresh_too_soon',
      'review_reply_already_sent',
      'review_reply_invalid',
      'review_not_available',
      'reply_not_delivered',
      'review_not_delivered',
    ])('reasonText_%s_HasWordsInItalianAndEnglish', (code) => {
      expect(reasonText(code, i18n.getFixedT('it'))).toBeTruthy();
      expect(reasonText(code, i18n.getFixedT('en'))).toBeTruthy();
    });

    it('reasonText_ACodeTheAppHasNoWordsFor_IsNullNeverTheCode', () => {
      expect(reasonText('something_new', t())).toBeNull();
      expect(reasonText(null, t())).toBeNull();
      expect(reasonText(undefined, t())).toBeNull();
    });

    it('reviewProblemMessage_AnErrorOfTheApi_SaysItInTheWordsOfTheReview', () => {
      const error = new AxiosError('failed', '409', undefined, undefined, {
        status: 409,
        data: { code: 'mapping_not_confirmed' },
        statusText: '',
        headers: {},
        config: {} as never,
      });
      // The general text of this code talks about a message to a guest: a review has its own words.
      expect(reviewProblemMessage(error, t())).toMatch(/non risponde alle recensioni/);
      expect(reviewProblemMessage(new Error('boom'), t())).toBeUndefined();
    });
  });

  describe('the draft of the reply', () => {
    it('pendingReviewDraftOf_OnlyTheReplyToThisReview_TheNewestOne', () => {
      const key = 'otareview:6f1c9a52-1111-4222-8333-944455556666';
      const drafts = [
        item({ id: 'old', createdAt: '2026-11-10T08:00:00Z' }),
        item({ id: 'new', createdAt: '2026-11-10T09:00:00Z' }),
        item({ id: 'other-review', threadKey: 'otareview:aaaaaaaa-1111-4222-8333-944455556666', createdAt: '2026-11-10T10:00:00Z' }),
        item({ id: 'message', itemType: 'MessageDraft', createdAt: '2026-11-10T11:00:00Z' }),
        item({ id: 'decided', status: 'Approved', createdAt: '2026-11-10T12:00:00Z' }),
      ];

      expect(pendingReviewDraftOf(drafts, key)?.id).toBe('new');
      expect(pendingReviewDraftOf([], key)).toBeNull();
      expect(pendingReviewDraftOf(undefined, key)).toBeNull();
    });

    it.each([
      ['draft_rule_violation', /non rispettava le regole/],
      ['ai_budget_exceeded', /limite di utilizzo/],
      ['assistant_disabled', /spento/],
      ['already_answered', /Hai già risposto/],
      ['reply_not_possible', /non può inviare la risposta/],
    ])('draftReasonText_%s_IsASentenceThatSaysNoDraftWasWritten', (reason, expected) => {
      expect(draftReasonText(reason, t())).toMatch(expected);
    });

    it('draftReasonText_AReasonOfALaterVersion_IsTheGeneralSentenceNeverACode', () => {
      expect(draftReasonText('something_new', t())).toMatch(/non ha completato la richiesta/);
      expect(draftReasonText(null, t())).toMatch(/non ha completato la richiesta/);
    });
  });

  describe('the review of the host', () => {
    const rated = { ratings: { cleanliness: 5, communication: 4, respect_house_rules: 5 }, text: 'Ospite ordinato e puntuale.', privateText: '' };

    it('hostReviewProblem_EveryCategoryNeedsAWholeMarkAndThePublicTextNeedsWords', () => {
      expect(hostReviewProblem(rated)).toBeNull();
      expect(hostReviewProblem(EMPTY_HOST_REVIEW)).toBe('ratings');
      expect(hostReviewProblem({ ...rated, ratings: { cleanliness: 5, communication: 4 } })).toBe('ratings');
      expect(hostReviewProblem({ ...rated, ratings: { ...rated.ratings, communication: 4.5 } })).toBe('ratings');
      expect(hostReviewProblem({ ...rated, ratings: { ...rated.ratings, communication: 6 } })).toBe('ratings');
      expect(hostReviewProblem({ ...rated, text: '   ' })).toBe('text');
      expect(hostReviewProblem({ ...rated, text: 'x'.repeat(1501) })).toBe('textTooLong');
      expect(hostReviewProblem({ ...rated, privateText: 'x'.repeat(1501) })).toBe('privateTooLong');
    });

    it('hostReviewCommandOf_TheRatingsInTheOrderOfTheFormAndThePrivateTextOnlyWhenThereIsOne', () => {
      expect(hostReviewCommandOf(rated)).toEqual({
        ratings: [
          { category: 'cleanliness', value: 5 },
          { category: 'communication', value: 4 },
          { category: 'respect_house_rules', value: 5 },
        ],
        text: 'Ospite ordinato e puntuale.',
      });
      expect(hostReviewCommandOf({ ...rated, text: '  Bene.  ', privateText: ' Solo per te. ' })).toMatchObject({ text: 'Bene.', privateText: 'Solo per te.' });
      expect(HOST_REVIEW_CATEGORIES).toHaveLength(3);
    });
  });

  it('theTextsOfTheReviews_NeverNameTheSupplierOfTheChannelManagerOrOfTheContracts', () => {
    const texts = (tree: unknown, path = ''): Array<[string, string]> => {
      if (typeof tree === 'string') return [[path, tree]];
      if (tree !== null && typeof tree === 'object') return Object.entries(tree).flatMap(([key, value]) => texts(value, path ? `${path}.${key}` : key));
      return [];
    };
    for (const locale of [it_, en]) {
      const own = [
        ...texts(lookup(locale, 'reviews'), 'reviews'),
        ...['otaReviewActionNotAllowed', 'otaReviewChannelNotSupported', 'reviewNotAvailable', 'otaReviewBookingNotReviewable'].map((code) => [code, String(lookup(locale, `apiErrors.codes.${code}`))] as [string, string]),
        ...['otaReviewReceived', 'otaReviewActionFailed'].map((key) => [key, String(lookup(locale, `notifications.types.${key}`))] as [string, string]),
      ];
      expect(own.length).toBeGreaterThan(100);
      expect(own.filter(([, text]) => /octorate|concordato\s*facile/i.test(text)).map(([key]) => key)).toEqual([]);
    }
  });
});

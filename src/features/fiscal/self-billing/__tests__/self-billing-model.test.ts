import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { KEPT_REASONS, canDiscardDraft, canIssueDraft, correctionProblemOf, isCorrectedOriginal, isDraftOutdated, keptKeyOf, replacesAnInvoice } from '../self-billing-model';
import { failure, item, original, replacement } from './self-billing-fixtures';

/** The text of a key in each language, asked when the test runs (not when the file is read). */
const it_ = (key: string, options?: Record<string, unknown>): string => i18n.getFixedT('it')(key, options);
const en = (key: string, options?: Record<string, unknown>): string => i18n.getFixedT('en')(key, options);

describe('the reasons a draft that holds the number of a rejected TD17 is kept (each has its own sentence, in two different languages)', () => {
  it.each(KEPT_REASONS)('keptKeyOf_%s_HasItsSentenceInItalianAndInEnglishAndTheyAreNotTheSame', (code) => {
    const key = keptKeyOf(code);

    expect(key).toBe(`selfBilling.kept.${code}`);
    expect(it_(key).length).toBeGreaterThan(40);
    expect(en(key).length).toBeGreaterThan(40);
    expect(it_(key)).not.toBe(en(key));
    // The sentence is a sentence of its own: it says what to do or who decides, and never a code.
    expect(it_(key)).not.toContain(code);
    expect(en(key)).not.toContain(code);
  });

  it('keptKeyOf_ACodeThisClientDoesNotKnow_IsTheSentenceThatNamesIt_NeverABlank', () => {
    expect(keptKeyOf('a_reason_of_the_future')).toBe('selfBilling.kept.unknown');
    expect(it_('selfBilling.kept.unknown', { code: 'a_reason_of_the_future' })).toContain('a_reason_of_the_future');
    expect(en('selfBilling.kept.unknown', { code: 'a_reason_of_the_future' })).toContain('a_reason_of_the_future');
  });

  it('theFourSentences_AreDifferentFromEachOther', () => {
    const sentences = new Set(KEPT_REASONS.map((code) => it_(keptKeyOf(code))));
    expect(sentences.size).toBe(KEPT_REASONS.length);
  });
});

describe('what a draft is offered (a draft that replaces a rejected TD17 is issued, never discarded; a kept one is neither)', () => {
  it('canIssueDraft_OnlyADraftThatIsNotKept', () => {
    expect(canIssueDraft(item())).toBe(true);
    expect(canIssueDraft(replacement())).toBe(true);
    expect(canIssueDraft(replacement({ keptReason: 'ledger_gives_no_td17' }))).toBe(false);
    expect(canIssueDraft(item({ status: 'Issued' }))).toBe(false);
    expect(canIssueDraft(original())).toBe(false);
  });

  it('canDiscardDraft_NeverADraftThatHoldsTheNumberOfARejectedInvoice', () => {
    expect(canDiscardDraft(item())).toBe(true);
    expect(canDiscardDraft(replacement())).toBe(false);
    expect(canDiscardDraft(replacement({ keptReason: 'portal_not_configured' }))).toBe(false);
    expect(canDiscardDraft(item({ status: 'Issued' }))).toBe(false);
  });

  it('isCorrectedOriginal_AndReplacesAnInvoice_FollowTheTwoReferences', () => {
    expect(isCorrectedOriginal(original())).toBe(true);
    expect(isCorrectedOriginal(replacement())).toBe(false);
    expect(replacesAnInvoice(replacement())).toBe(true);
    expect(replacesAnInvoice(original())).toBe(false);
    expect(replacesAnInvoice(item())).toBe(false);
  });
});

describe('what the correction of a rejected TD17 comes back with when it does not work', () => {
  it.each([
    ['403, no body', failure(403), 'forbidden'],
    ['403 with a code', failure(403, 'forbidden'), 'forbidden'],
    ['404 fiscal_document_not_found', failure(404, 'fiscal_document_not_found'), 'notFound'],
    ['404 with no code (a flag is off)', failure(404), 'unavailable'],
    ['404 with another code', failure(404, 'not_found'), 'unavailable'],
    ['422 self_billing_not_correctable', failure(422, 'self_billing_not_correctable'), 'notCorrectable'],
    ['422 with another code', failure(422, 'document_not_draft'), 'failed'],
    ['500', failure(500), 'failed'],
    ['no answer at all', new Error('Network Error'), 'failed'],
  ] as const)('correctionProblemOf_%s_Is_%s', (_name, error, expected) => {
    expect(correctionProblemOf(error)).toBe(expected);
  });

  it('isDraftOutdated_OnlyA409WithTheCodeOfAnOutdatedDraft', () => {
    expect(isDraftOutdated(failure(409, 'document_draft_outdated'))).toBe(true);
    expect(isDraftOutdated(failure(409, 'sdi_not_to_send'))).toBe(false);
    expect(isDraftOutdated(failure(409))).toBe(false);
    expect(isDraftOutdated(failure(422, 'document_draft_outdated'))).toBe(false);
    expect(isDraftOutdated(new Error('Network Error'))).toBe(false);
  });
});

describe('the words around the correction of a rejected TD17 (the «Da fare» names the button, a call that failed never says nothing changed, a replaced original has words of its own)', () => {
  it.each(['it', 'en'] as const)('theTodoOfARejectedTd17_NamesTheButtonThePageOffers_In_%s', (lng) => {
    const t = i18n.getFixedT(lng);

    // The «Da fare» that opens the page says what to press there: when the button is renamed the sentence follows, never the other way round.
    expect(t('activity.todo.type.SelfBillingRejected.why')).toContain(t('selfBilling.correct.button'));
  });

  it('theWordsOfACallThatFailed_AskToCheckTheListAndNeverSayNothingChanged_BecauseTheOutcomeIsNotKnown', () => {
    expect(it_('selfBilling.correct.problem.failed')).not.toMatch(/non è cambiato|è ancora quella/i);
    expect(en('selfBilling.correct.problem.failed')).not.toMatch(/nothing changed|still the rejected/i);
    expect(it_('selfBilling.correct.problem.failed')).toMatch(/elenco/i);
    expect(en('selfBilling.correct.problem.failed')).toMatch(/list/i);
    expect(it_('selfBilling.correct.problem.failed')).not.toBe(en('selfBilling.correct.problem.failed'));
  });

  it.each(['title', 'body', 'open'])('theWordsOfAReplacedOriginalInItsDetail_%s_AreDifferentInTheTwoLanguages', (member) => {
    const key = `selfBilling.detail.replaced.${member}`;

    expect(it_(key).length).toBeGreaterThan(5);
    expect(en(key).length).toBeGreaterThan(5);
    expect(it_(key)).not.toBe(en(key));
  });
});

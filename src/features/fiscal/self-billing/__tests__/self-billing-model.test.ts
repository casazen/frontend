import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  CLOSE_NOTE_MAX,
  CLOSE_REASONS,
  KEPT_REASONS,
  canCloseNotDue,
  canDiscardDraft,
  canIssueDraft,
  closeProblemOf,
  closeReasonKeyOf,
  closeRequestOf,
  correctionProblemOf,
  isClosedNotDue,
  isCorrectedOriginal,
  isDraftOutdated,
  keptKeyOf,
  replacesAnInvoice,
  type CloseProblem,
} from '../self-billing-model';
import { closed, failure, item, kept, original, rejected, replacement } from './self-billing-fixtures';

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

  it.each(['it', 'en'] as const)('theKeptSentences_NoLongerSayThatTheDraftCanBeNeitherIssuedNorDiscardedNorThatTheAccountantDecidesWhatTheNumberIsFor_ButStillSayItCannotBeIssued_In_%s', (lng) => {
    const t = i18n.getFixedT(lng);
    const outdated = lng === 'it' ? /né emettere né scartare|lo decide il commercialista/i : /neither issued nor discarded|decided by the accountant/i;
    const stillTrue = lng === 'it' ? /non si può emettere/i : /cannot be issued/i;

    // The four reasons and the sentence of a code this client does not know: the draft has a way out now (closing it), so none of them leaves the person with «nothing can be done, the accountant decides».
    for (const key of [...KEPT_REASONS.map((code) => keptKeyOf(code)), keptKeyOf('a_reason_of_the_future')]) {
      expect(t(key, { code: 'a_reason_of_the_future' })).not.toMatch(outdated);
      expect(t(key, { code: 'a_reason_of_the_future' })).toMatch(stillTrue);
    }
  });

  it('theWayOutOfAKeptDraft_SaysItIsClosedAsNoLongerDue_ThatTheNumberStaysReservedAndIsNeverGivenAgain_AndNamesTheButtonThePageDraws', () => {
    expect(it_('selfBilling.kept.exit')).toMatch(/chiudila come non più dovuta/i);
    expect(it_('selfBilling.kept.exit')).toMatch(/riservato/i);
    expect(it_('selfBilling.kept.exit')).toMatch(/mai riusato/i);
    expect(en('selfBilling.kept.exit')).toMatch(/close it as no longer due/i);
    expect(en('selfBilling.kept.exit')).toMatch(/reserved/i);
    expect(en('selfBilling.kept.exit')).toMatch(/never given to another invoice/i);
    expect(it_('selfBilling.kept.exit')).not.toBe(en('selfBilling.kept.exit'));
    // It names the button of the page: when the button is renamed the sentence follows, never the other way round.
    expect(it_('selfBilling.kept.exit')).toContain(it_('selfBilling.close.button').replace(/^Chiudi /, ''));
    expect(en('selfBilling.kept.exit')).toContain(en('selfBilling.close.button').replace(/^Close /, ''));
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

describe('«Chiudi come non più dovuta»: what is offered, and the reasons of the closing (each has its words, in two different languages)', () => {
  it('canCloseNotDue_OnlyADraftThatReplacesARejectedInvoiceAndThatTheServerSaysIsKept', () => {
    expect(canCloseNotDue(kept())).toBe(true);
    // A replacement the month still supports is issued, not closed; an ordinary draft is not a replacement; whatever is not a draft is history or issued.
    expect(canCloseNotDue(replacement())).toBe(false);
    expect(canCloseNotDue(item())).toBe(false);
    expect(canCloseNotDue(item({ keptReason: 'ledger_gives_no_td17' }))).toBe(false);
    expect(canCloseNotDue(kept({ status: 'Issued' }))).toBe(false);
    expect(canCloseNotDue(rejected())).toBe(false);
    expect(canCloseNotDue(original())).toBe(false);
    expect(canCloseNotDue(closed())).toBe(false);
  });

  it('isClosedNotDue_OnlyADiscardedDraftThatSaysHowItWasClosed', () => {
    expect(isClosedNotDue(closed())).toBe(true);
    expect(isClosedNotDue(original())).toBe(false);
    expect(isClosedNotDue(kept())).toBe(false);
    expect(isClosedNotDue(item({ status: 'Discarded' }))).toBe(false);
  });

  it.each(CLOSE_REASONS)('closeReasonKeyOf_%s_HasItsWordsInItalianAndInEnglishAndTheyAreNotTheSame', (code) => {
    const key = closeReasonKeyOf(code);

    expect(key).toBe(`selfBilling.close.reason.${code}`);
    expect(it_(key as string).length).toBeGreaterThan(15);
    expect(en(key as string).length).toBeGreaterThan(15);
    expect(it_(key as string)).not.toBe(en(key as string));
    // Words a host understands, never the code.
    expect(it_(key as string)).not.toContain(code);
    expect(en(key as string)).not.toContain(code);
  });

  it('closeReasonKeyOf_ACodeThisClientDoesNotKnow_HasNoWords_SoThePageShowsTheCodeAsItCame', () => {
    expect(closeReasonKeyOf('a_reason_of_the_future')).toBeNull();
    expect(closeReasonKeyOf('')).toBeNull();
    expect(new Set(CLOSE_REASONS.map((code) => it_(`selfBilling.close.reason.${code}`))).size).toBe(CLOSE_REASONS.length);
  });

  it.each([
    ['403, no body', failure(403), 'forbidden'],
    ['404 fiscal_document_not_found', failure(404, 'fiscal_document_not_found'), 'notFound'],
    ['404 with no code (a flag is off)', failure(404), 'unavailable'],
    ['404 with another code', failure(404, 'not_found'), 'unavailable'],
    ['422 close_reason_required', failure(422, 'close_reason_required'), 'reasonRequired'],
    ['422 close_note_too_long', failure(422, 'close_note_too_long'), 'noteTooLong'],
    ['422 self_billing_already_closed', failure(422, 'self_billing_already_closed'), 'alreadyClosed'],
    ['422 self_billing_not_closable', failure(422, 'self_billing_not_closable'), 'notClosable'],
    ['422 with a code of the correction', failure(422, 'self_billing_not_correctable'), 'failed'],
    ['422 with the name of a member of an object', failure(422, 'constructor'), 'failed'],
    ['409', failure(409, 'document_draft_outdated'), 'failed'],
    ['500', failure(500), 'failed'],
    ['no answer at all', new Error('Network Error'), 'failed'],
  ] as const)('closeProblemOf_%s_Is_%s', (_name, error, expected) => {
    expect(closeProblemOf(error)).toBe(expected);
  });

  it('closeRequestOf_CarriesTheReasonAndTheNoteOnlyWhenThereIsOne_TrimmedAndNeverAnEmptyOne', () => {
    expect(closeRequestOf('duplicate_or_error', '')).toEqual({ reason: 'duplicate_or_error' });
    expect(closeRequestOf('duplicate_or_error', '  \n ')).toEqual({ reason: 'duplicate_or_error' });
    expect(closeRequestOf('portal_credit_note', '  nota di credito n. 55  ')).toEqual({ reason: 'portal_credit_note', note: 'nota di credito n. 55' });
    expect(Object.keys(closeRequestOf('portal_credit_note', ''))).toEqual(['reason']);
    expect(CLOSE_NOTE_MAX).toBe(500);
  });

  it.each(['it', 'en'] as const)('theEightProblemsOfTheClosing_EachHaveTheirOwnWords_AndNoneSaysNothingChangedWhenTheOutcomeIsNotKnown_In_%s', (lng) => {
    const t = i18n.getFixedT(lng);
    const kinds: CloseProblem[] = ['reasonRequired', 'noteTooLong', 'alreadyClosed', 'notClosable', 'notFound', 'unavailable', 'forbidden', 'failed'];
    const sentences = kinds.map((kind) => t(`selfBilling.close.problem.${kind}`, { max: CLOSE_NOTE_MAX }));

    expect(new Set(sentences).size).toBe(kinds.length);
    for (const sentence of sentences) expect(sentence.length).toBeGreaterThan(20);
    // A call that failed does not know the outcome: it asks to check the list and to try again, and never says that nothing changed.
    expect(t('selfBilling.close.problem.failed')).toMatch(lng === 'it' ? /elenco/i : /list/i);
    expect(t('selfBilling.close.problem.failed')).not.toMatch(/non è cambiato|nothing changed/i);
    // An «already closed» draft has nothing to fix, and says so.
    expect(t('selfBilling.close.problem.alreadyClosed')).toMatch(lng === 'it' ? /nulla da correggere/i : /nothing to fix/i);
    // The note is cut at 500 characters, and the sentence says the figure the server uses.
    expect(t('selfBilling.close.problem.noteTooLong', { max: CLOSE_NOTE_MAX })).toContain(String(CLOSE_NOTE_MAX));
  });

  it.each([
    'button',
    'confirm',
    'title',
    'description',
    'descriptionUnknown',
    'consequenceClosed',
    'consequenceReserved',
    'consequenceRegister',
    'done',
    'doneUnknown',
    'reasonLegend',
    'note.label',
    'note.hint',
  ])('theWordsOfTheDialogOfTheClosing_%s_AreDifferentInTheTwoLanguages', (member) => {
    const key = `selfBilling.close.${member}`;

    expect(it_(key, { number: 'AF-2026/1', title: 'x' }).length).toBeGreaterThan(3);
    expect(en(key, { number: 'AF-2026/1', title: 'x' }).length).toBeGreaterThan(3);
    expect(it_(key, { number: 'AF-2026/1', title: 'x' })).not.toBe(en(key, { number: 'AF-2026/1', title: 'x' }));
  });

  it('theDialogSaysThePlainFacts_TheNumberStaysReserved_ItIsInTheRegisterOfTheAccountant_AndItCannotBeUndone_In_BothLanguages', () => {
    expect(it_('selfBilling.close.consequenceReserved')).toMatch(/riservato/i);
    expect(en('selfBilling.close.consequenceReserved')).toMatch(/reserved/i);
    expect(it_('selfBilling.close.consequenceRegister')).toMatch(/registro dei numeri non utilizzati/i);
    expect(en('selfBilling.close.consequenceRegister')).toMatch(/register of unused numbers/i);
    expect(it_('selfBilling.close.consequenceClosed')).toMatch(/non si può annullare/i);
    expect(en('selfBilling.close.consequenceClosed')).toMatch(/cannot be undone/i);
  });

  it.each(['it', 'en'] as const)('theClosedStateAndItsStatus_HaveWords_In_%s', (lng) => {
    const t = i18n.getFixedT(lng);

    // «Chiusa, non più dovuta»: the outcome of the draft; not «scarto confermato», which is a fact of the SDI.
    expect(t('selfBilling.status.ClosedNotDue')).toBe(lng === 'it' ? 'Chiusa, non più dovuta' : 'Closed, no longer due');
    // The original whose replacement was closed is not «Sostituita»: no invoice replaces it, and what stays is the rejection of the SDI.
    expect(t('selfBilling.status.RejectedClosed')).toBe(lng === 'it' ? 'Scartata dallo SDI' : 'Rejected by the SDI');
    expect(t('selfBilling.status.RejectedClosed')).not.toBe(t('selfBilling.status.Replaced'));
    for (const member of ['reason', 'at', 'by', 'note', 'title', 'intro', 'introUnknown']) expect(t(`selfBilling.closed.${member}`, { number: 'AF-2026/1' }).length).toBeGreaterThan(2);
    expect(t('selfBilling.closed.intro', { number: 'AF-2026/1' })).toContain('AF-2026/1');
    expect(t('selfBilling.closed.introUnknown')).not.toContain('{{');
  });
});

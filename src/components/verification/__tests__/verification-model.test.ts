import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  arrivalTiming,
  checkKey,
  figuresOf,
  mailtoOf,
  percentOf,
  QUEUE_REASONS,
  queueReasonOf,
  resultKey,
  resultTone,
  VERIFICATION_CHECKS,
  VERIFICATION_RESULTS,
} from '../verification-model';

describe('queueReasonOf (E03/F04/US03/T02)', () => {
  it('queueReasonOf_NoAutomaticOutcome_IsTheGuestWhoAskedForAPersonOrRefusedTheConsent', () => {
    expect(queueReasonOf({ biometricOutcome: null, reasons: [] })).toBe('operator_requested');
    // An older API sends no `reasons` at all.
    expect(queueReasonOf({ biometricOutcome: 'Escalate' })).toBe('operator_requested');
  });

  it('queueReasonOf_ModelsCouldNotRun_IsATechnicalError', () => {
    expect(queueReasonOf({ biometricOutcome: 'Escalate', reasons: [{ check: 'quality', result: 'passed' }, { check: 'processing', result: 'timeout' }] })).toBe(
      'technical_error',
    );
  });

  it('queueReasonOf_SimilarityBetweenTheThresholds_IsAnUncertainComparison', () => {
    expect(
      queueReasonOf({ biometricOutcome: 'Escalate', reasons: [{ check: 'similarity', result: 'between_thresholds', value: 0.78, threshold: 0.85 }] }),
    ).toBe('uncertain');
  });

  it('queueReasonOf_SimilarityFailed_IsNoMatch', () => {
    expect(queueReasonOf({ biometricOutcome: 'Reject', reasons: [{ check: 'similarity', result: 'failed', value: 0.4, threshold: 0.7 }] })).toBe('no_match');
  });

  it('queueReasonOf_AnotherCheckAskedForAPerson_IsAReview', () => {
    expect(queueReasonOf({ biometricOutcome: 'Escalate', reasons: [{ check: 'mrz_consistency', result: 'names_mismatch' }] })).toBe('review');
  });

  it('queueReasonOf_AnotherCheckFailedWithoutAReview_IsNotPassed', () => {
    expect(queueReasonOf({ biometricOutcome: 'Reject', reasons: [{ check: 'document_validity', result: 'expired' }] })).toBe('not_passed');
  });

  it('queueReasonOf_TheProcessingFailureComesBeforeTheOtherChecks', () => {
    expect(
      queueReasonOf({
        biometricOutcome: 'Escalate',
        reasons: [
          { check: 'similarity', result: 'between_thresholds' },
          { check: 'processing', result: 'error' },
        ],
      }),
    ).toBe('technical_error');
  });
});

describe('the words of the checks and of the results', () => {
  it.each(['it', 'en'])('everyCheckAndEveryResultTheApiSends_HasItsWordsIn_%s', (language) => {
    for (const check of VERIFICATION_CHECKS) expect(i18n.exists(checkKey(check), { lng: language }), `${language} ${check}`).toBe(true);
    for (const result of VERIFICATION_RESULTS) expect(i18n.exists(resultKey(result), { lng: language }), `${language} ${result}`).toBe(true);
    for (const reason of QUEUE_REASONS) {
      expect(i18n.exists(`verification.why.${reason}`, { lng: language }), `${language} why ${reason}`).toBe(true);
      expect(i18n.exists(`verification.filter.reasons.${reason}`, { lng: language }), `${language} filter ${reason}`).toBe(true);
    }
  });

  it('checkKeyAndResultKey_ACodeTheConsoleDoesNotKnow_UseTheGenericTextThatCarriesTheCode', () => {
    expect(checkKey('from_the_future')).toBe('verification.check.other');
    expect(resultKey('from_the_future')).toBe('verification.result.other');
    expect(i18n.getFixedT('it')(resultKey('from_the_future'), { code: 'from_the_future' })).toContain('from_the_future');
  });

  it('resultTone_PassedNotRunAndEverythingElse_AreTold', () => {
    expect(resultTone('passed')).toBe('passed');
    expect(resultTone('not_run')).toBe('skipped');
    expect(resultTone('between_thresholds')).toBe('attention');
    expect(resultTone('expired')).toBe('attention');
  });
});

describe('figuresOf', () => {
  it('figuresOf_ValueAndThreshold_AreWrittenInTheLanguageOfThePage', () => {
    expect(figuresOf({ check: 'similarity', result: 'between_thresholds', value: 0.784, threshold: 0.85 }, 'it')).toEqual({
      key: 'verification.figures.valueAndThreshold',
      values: { value: '0,78', threshold: '0,85' },
    });
    expect(figuresOf({ check: 'similarity', result: 'between_thresholds', value: 0.784, threshold: 0.85 }, 'en')?.values).toEqual({
      value: '0.78',
      threshold: '0.85',
    });
  });

  it('figuresOf_OnlyAThreshold_OrOnlyAValue_SaysOnlyThat', () => {
    expect(figuresOf({ check: 'similarity', result: 'not_run', threshold: 0.85 }, 'en')?.key).toBe('verification.figures.threshold');
    expect(figuresOf({ check: 'liveness', result: 'passed', value: 0.9 }, 'en')?.key).toBe('verification.figures.value');
  });

  it('figuresOf_ACheckWithNoNumbers_SaysNothing', () => {
    expect(figuresOf({ check: 'quality', result: 'passed' }, 'en')).toBeNull();
    expect(figuresOf({ check: 'quality', result: 'passed', value: null, threshold: null }, 'en')).toBeNull();
  });

  it('figuresOf_AZeroValue_IsAFigureNotNothing', () => {
    expect(figuresOf({ check: 'liveness', result: 'failed', value: 0, threshold: 0.8 }, 'en')?.values).toEqual({ value: '0', threshold: '0.8' });
  });
});

describe('mailtoOf', () => {
  it('mailtoOf_APlainAddress_IsALinkToIt', () => {
    expect(mailtoOf('mario.rossi+stay@example.test')).toBe('mailto:mario.rossi+stay@example.test');
    expect(mailtoOf('  mario@example.test  ')).toBe('mailto:mario@example.test');
  });

  it.each([
    'mario@example.test?cc=someone@else.test',
    'mario@example.test&body=hello',
    'mario@example.test#frag',
    'a@b.test, c@d.test',
    'two words@example.test',
    'no-at-sign',
    '',
  ])('mailtoOf_%s_IsNotALinkBecauseItWouldAddToTheMessage', (address) => {
    expect(mailtoOf(address)).toBeNull();
  });

  it('mailtoOf_NoAddress_IsNotALink', () => {
    expect(mailtoOf(null)).toBeNull();
    expect(mailtoOf(undefined)).toBeNull();
  });
});

describe('percentOf and arrivalTiming', () => {
  it('percentOf_AShareOfOne_IsAWholePercent', () => {
    expect(percentOf(0.4286, 'en')).toBe('43%');
    expect(percentOf(0, 'en')).toBe('0%');
    expect(percentOf(Number.NaN, 'en')).toBe('0%');
  });

  it('arrivalTiming_TheDayAsWritten_IsComparedWithTodayInRome', () => {
    expect(arrivalTiming('2026-10-09T00:00:00Z', '2026-10-10')).toBe('past');
    expect(arrivalTiming('2026-10-10T00:00:00Z', '2026-10-10')).toBe('today');
    expect(arrivalTiming('2026-10-11', '2026-10-10')).toBe('upcoming');
    expect(arrivalTiming('not a date', '2026-10-10')).toBe('unknown');
  });
});

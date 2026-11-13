import type { PendingVerification, VerificationReason } from '@/types/verification.types';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';

/**
 * The checks of an automatic outcome, in the order the agent evaluates them (backend `VerificationReasons.Checks`). A code the console does not know
 * is shown with the generic text and the code itself, so a newer API never leaves a blank.
 */
export const VERIFICATION_CHECKS = [
  'quality',
  'liveness',
  'document_validity',
  'mrz_consistency',
  'similarity',
  'processing',
] as const;

/**
 * The results of a check (backend `VerificationReasons.Results`, and the codes of the pipeline when the quality of a capture is the reason).
 * Each has its words in `verification.result.*`.
 */
export const VERIFICATION_RESULTS = [
  'passed',
  'failed',
  'not_run',
  'between_thresholds',
  'expired',
  'unreadable',
  'check_digits_invalid',
  'names_mismatch',
  'birth_date_mismatch',
  'document_number_mismatch',
  'nationality_mismatch',
  'unavailable',
  'timeout',
  'error',
  'no_face',
  'multiple_faces',
  'face_too_small',
  'image_unreadable',
] as const;

/**
 * Why a verification is in the queue, as far as the queue itself can tell (the pending item carries the last automatic outcome and its checks, not
 * what the guest did): the models could not run, the comparison is between the thresholds, the faces do not match, a check other than the comparison
 * asks for a person, the automatic check did not pass, or there is no automatic outcome (the guest asked for a person or did not give the consent).
 */
export const QUEUE_REASONS = ['operator_requested', 'uncertain', 'no_match', 'technical_error', 'review', 'not_passed'] as const;
export type QueueReason = (typeof QUEUE_REASONS)[number];

/** The words of a check: its own text, or the generic one that carries the code. */
export function checkKey(check: string): string {
  return (VERIFICATION_CHECKS as readonly string[]).includes(check) ? `verification.check.${check}` : 'verification.check.other';
}

/** The words of a result: its own text, or the generic one that carries the code. */
export function resultKey(result: string): string {
  return (VERIFICATION_RESULTS as readonly string[]).includes(result) ? `verification.result.${result}` : 'verification.result.other';
}

/** The reason of the queue of a pending verification. The checks are read in the order of what they say about the guest, the most telling first. */
export function queueReasonOf(item: Pick<PendingVerification, 'biometricOutcome' | 'reasons'>): QueueReason {
  const reasons = item.reasons ?? [];
  const found = (check: string, result?: string) =>
    reasons.some((reason) => reason.check === check && (result === undefined || reason.result === result));

  if (found('processing')) return 'technical_error';
  if (found('similarity', 'between_thresholds')) return 'uncertain';
  if (found('similarity', 'failed')) return 'no_match';
  if (reasons.length === 0) return 'operator_requested';
  return item.biometricOutcome === 'Escalate' ? 'review' : 'not_passed';
}

/** The tone of a result for its icon: a check that passed, one that was not reached, anything else. */
export type ResultTone = 'passed' | 'skipped' | 'attention';

export function resultTone(result: string): ResultTone {
  if (result === 'passed') return 'passed';
  if (result === 'not_run') return 'skipped';
  return 'attention';
}

/**
 * The `mailto:` link of the e-mail address of a guest, or `null` when it is not one to put there: the address comes from the booking, and one with a
 * `?` or an `&` in it would add a header or a body to the message the operator opens. A plain address only.
 */
export function mailtoOf(email: string | null | undefined): string | null {
  const address = email?.trim() ?? '';
  return /^[^\s@?&#,;<>"']+@[^\s@?&#,;<>"']+$/.test(address) ? `mailto:${address}` : null;
}

/** A number of a check (a score, a threshold) with at most two decimals in the language of the page. */
export function formatFigure(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
}

/** The figures of a reason: which key says them and what fills it; `null` when the check has no number. */
export function figuresOf(reason: VerificationReason, language: string): { key: string; values: { value?: string; threshold?: string } } | null {
  const hasValue = typeof reason.value === 'number';
  const hasThreshold = typeof reason.threshold === 'number';
  const value = hasValue ? formatFigure(reason.value as number, language) : undefined;
  const threshold = hasThreshold ? formatFigure(reason.threshold as number, language) : undefined;
  if (hasValue && hasThreshold) return { key: 'verification.figures.valueAndThreshold', values: { value, threshold } };
  if (hasValue) return { key: 'verification.figures.value', values: { value } };
  if (hasThreshold) return { key: 'verification.figures.threshold', values: { threshold } };
  return null;
}

/** The share of the concluded verifications an operator concluded, as a whole percentage (`0.4286` is 43 %). */
export function percentOf(share: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(Number.isFinite(share) ? share : 0);
}

/** How the arrival of a pending verification stands today: already past, today, or still to come (days in Europe/Rome). */
export type ArrivalTiming = 'past' | 'today' | 'upcoming' | 'unknown';

export function arrivalTiming(checkInDate: string, today: string = todayInRome()): ArrivalTiming {
  const day = parseStayDate(checkInDate);
  if (!day) return 'unknown';
  if (day < today) return 'past';
  return day === today ? 'today' : 'upcoming';
}

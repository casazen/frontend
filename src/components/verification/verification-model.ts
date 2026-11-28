import type { PendingVerification, VerificationReason } from '@/types/verification.types';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';

export const VERIFICATION_CHECKS = [
  'quality',
  'liveness',
  'document_validity',
  'mrz_consistency',
  'similarity',
  'processing',
] as const;

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
 * what the guest did, and not why the verification was handed to a person): the models could not run, the comparison is between the thresholds, the
 * last comparison found another face, a check other than the comparison asks for a person, the last automatic check did not pass, or there is no
 * automatic outcome (the guest asked for a person or did not give the consent, the face check is not used for the organization, the guest is a minor).
 *
 * `no_match` and `not_passed` are what the LAST automatic check found: a guest who failed an attempt and then asked for a person looks the same, so
 * their words say the guest may also have asked. The reason of the hand-off is the backend's to give (follow-up: the pending verification DTO).
 */
export const QUEUE_REASONS = ['operator_requested', 'uncertain', 'no_match', 'technical_error', 'review', 'not_passed'] as const;
export type QueueReason = (typeof QUEUE_REASONS)[number];

export function checkKey(check: string): string {
  return (VERIFICATION_CHECKS as readonly string[]).includes(check) ? `verification.check.${check}` : 'verification.check.other';
}

export function resultKey(result: string): string {
  return (VERIFICATION_RESULTS as readonly string[]).includes(result) ? `verification.result.${result}` : 'verification.result.other';
}

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

export type ResultTone = 'passed' | 'skipped' | 'attention';

export function resultTone(result: string): ResultTone {
  if (result === 'passed') return 'passed';
  if (result === 'not_run') return 'skipped';
  return 'attention';
}

export function mailtoOf(email: string | null | undefined): string | null {
  const address = email?.trim() ?? '';
  return /^[^\s@?&#,;<>"']+@[^\s@?&#,;<>"']+$/.test(address) ? `mailto:${address}` : null;
}

export function formatFigure(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
}

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

export function percentOf(share: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(Number.isFinite(share) ? share : 0);
}

export type ArrivalTiming = 'past' | 'today' | 'upcoming' | 'unknown';

export function arrivalTiming(checkInDate: string, today: string = todayInRome()): ArrivalTiming {
  const day = parseStayDate(checkInDate);
  if (!day) return 'unknown';
  if (day < today) return 'past';
  return day === today ? 'today' : 'upcoming';
}

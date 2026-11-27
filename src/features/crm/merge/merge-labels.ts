import type { TFunction } from 'i18next';

/** How sure the matching is, in words: the proposal is the host's to decide whatever the words say. */
export type MergeLikelihood = 'veryLikely' | 'likely' | 'possible';

/**
 * The score of a proposal is the strongest of its reasons (backend `GuestMatchRules`): 100 the same e-mail address, 90 the same name and
 * birth date, 80 the same phone number, 60 the same name at a property both stayed in. From 90 it is "very likely", from 70 "likely",
 * below it "possible".
 */
const VERY_LIKELY_FROM = 90;
const LIKELY_FROM = 70;

/** The words of each likelihood, with the key of each (written out, so that the i18n test finds a missing translation). */
const LIKELIHOODS: ReadonlyArray<{ likelihood: MergeLikelihood; labelKey: string }> = [
  { likelihood: 'veryLikely', labelKey: 'crm.merge.likelihood.veryLikely' },
  { likelihood: 'likely', labelKey: 'crm.merge.likelihood.likely' },
  { likelihood: 'possible', labelKey: 'crm.merge.likelihood.possible' },
];

/** The reasons the matching gives, as codes, and the sentence of each. A reason never says what matched: no date, no number. */
const REASONS: ReadonlyArray<{ reason: string; labelKey: string }> = [
  { reason: 'same_email', labelKey: 'crm.merge.reasons.sameEmail' },
  { reason: 'same_name_birth', labelKey: 'crm.merge.reasons.sameNameBirth' },
  { reason: 'same_phone', labelKey: 'crm.merge.reasons.samePhone' },
  { reason: 'same_name_same_property', labelKey: 'crm.merge.reasons.sameNameSameProperty' },
];

/** How likely it is that the two profiles are one guest, from the score of the proposal. */
export function likelihoodOf(score: number): MergeLikelihood {
  if (score >= VERY_LIKELY_FROM) return 'veryLikely';
  if (score >= LIKELY_FROM) return 'likely';
  return 'possible';
}

/** The likelihood of a proposal in words ("Very likely the same person"). */
export function likelihoodLabel(t: TFunction, score: number): string {
  const likelihood = likelihoodOf(score);
  const entry = LIKELIHOODS.find((candidate) => candidate.likelihood === likelihood);
  return entry ? t(entry.labelKey) : likelihood;
}

/** A reason of the matching in words ("They share the same phone number"); a code the app does not know yet is a sentence that says so. */
export function reasonLabel(t: TFunction, reason: string): string {
  const known = REASONS.find((entry) => entry.reason === reason);
  return t(known ? known.labelKey : 'crm.merge.reasons.unknown');
}

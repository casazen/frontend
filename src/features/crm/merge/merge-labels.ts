import type { TFunction } from 'i18next';

export type MergeLikelihood = 'veryLikely' | 'likely' | 'possible';

const VERY_LIKELY_FROM = 90;
const LIKELY_FROM = 70;

/** The words of each likelihood, with the key of each (written out, so that the i18n test finds a missing translation). */
const LIKELIHOODS: ReadonlyArray<{ likelihood: MergeLikelihood; labelKey: string }> = [
  { likelihood: 'veryLikely', labelKey: 'crm.merge.likelihood.veryLikely' },
  { likelihood: 'likely', labelKey: 'crm.merge.likelihood.likely' },
  { likelihood: 'possible', labelKey: 'crm.merge.likelihood.possible' },
];

const REASONS: ReadonlyArray<{ reason: string; labelKey: string }> = [
  { reason: 'same_email', labelKey: 'crm.merge.reasons.sameEmail' },
  { reason: 'same_name_birth', labelKey: 'crm.merge.reasons.sameNameBirth' },
  { reason: 'same_phone', labelKey: 'crm.merge.reasons.samePhone' },
  { reason: 'same_name_same_property', labelKey: 'crm.merge.reasons.sameNameSameProperty' },
];

export function likelihoodOf(score: number): MergeLikelihood {
  if (score >= VERY_LIKELY_FROM) return 'veryLikely';
  if (score >= LIKELY_FROM) return 'likely';
  return 'possible';
}

export function likelihoodLabel(t: TFunction, score: number): string {
  const likelihood = likelihoodOf(score);
  const entry = LIKELIHOODS.find((candidate) => candidate.likelihood === likelihood);
  return entry ? t(entry.labelKey) : likelihood;
}

export function reasonLabel(t: TFunction, reason: string): string {
  const known = REASONS.find((entry) => entry.reason === reason);
  return t(known ? known.labelKey : 'crm.merge.reasons.unknown');
}

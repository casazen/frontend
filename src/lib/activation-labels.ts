import type { TFunction } from 'i18next';
import type { ActivationStep } from '@/types/onboarding.types';

/**
 * Text under the title of a step: what the stored state proves when it is done, otherwise why it is not (the stable
 * reason code of the API, translated here). A reason this version does not know falls back to a neutral text.
 */
export function activationStepDetail(
  step: ActivationStep,
  t: TFunction,
  exists: (key: string) => boolean,
): string {
  const params = { done: step.done ?? 0, total: step.total ?? 0, count: step.done ?? 0 };
  if (step.state === 'done') return t(`activation.steps.${step.key}.done`, params);

  const reasonKey = step.reason ? `activation.reasons.${step.reason}` : null;
  return reasonKey && exists(reasonKey) ? t(reasonKey, params) : t('activation.reasons.unknown');
}
